"""
engine/source_fetcher.py

Google Drive と Notion から一次情報を取得し、
data/source_cache.json にキャッシュするモジュール。
"""

import os
import json
import time
from datetime import datetime

# ── パス設定 ──────────────────────────────────────────────────
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CACHE_PATH = os.path.join(_DATA_DIR, "source_cache.json")
SELECTIONS_PATH = os.path.join(_DATA_DIR, "source_selections.json")
CACHE_TTL_SECONDS = 3600  # 1時間


# ── 選択状態の管理 ────────────────────────────────────────────

def load_selections() -> dict:
    if not os.path.exists(SELECTIONS_PATH):
        return {"drive": [], "notion": [], "urls": []}
    data = {}
    with open(SELECTIONS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("urls", [])
    return data


def save_selections(selections: dict):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(SELECTIONS_PATH, "w", encoding="utf-8") as f:
        json.dump(selections, f, ensure_ascii=False, indent=2)


# ── キャッシュ操作 ────────────────────────────────────────────

def _load_cache() -> dict:
    if not os.path.exists(CACHE_PATH):
        return {}
    with open(CACHE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_cache(data: dict):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _is_cache_valid(cache: dict) -> bool:
    ts = cache.get("fetched_ts")
    if not ts:
        return False
    return (time.time() - ts) < CACHE_TTL_SECONDS


# ── URL 解析ユーティリティ ────────────────────────────────────

def parse_google_drive_url(url: str) -> str | None:
    """Google Drive URL から FILE_ID を抽出"""
    import re
    m = re.search(r'/d/([a-zA-Z0-9_-]{25,})', url)
    return m.group(1) if m else None


def parse_notion_url(url: str) -> str | None:
    """Notion URL からページ ID を抽出"""
    import re
    # ハイフン付きUUID形式
    m = re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', url)
    if m:
        return m.group(1)
    # ハイフンなし32文字形式（URLの末尾）
    m = re.search(r'([a-f0-9]{32})(?:[?#].*)?$', url)
    return m.group(1) if m else None


# ── Google Drive フェッチャー ─────────────────────────────────

class GoogleDriveFetcher:

    def __init__(self, settings=None):
        self.settings = settings or {}

    def _get_service(self):
        token_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "token.json"
        )
        try:
            from googleapiclient.discovery import build
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request
            creds = Credentials.from_authorized_user_file(
                token_path, ["https://www.googleapis.com/auth/drive.readonly"]
            )
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                with open(token_path, "w") as f:
                    f.write(creds.to_json())
                print("[GoogleDrive] アクセストークンを自動更新しました。")
            return build("drive", "v3", credentials=creds)
        except Exception as e:
            print(f"[GoogleDrive] OAuth2 認証エラー: {e}")
            try:
                from googleapiclient.discovery import build
                from google.oauth2 import service_account
                creds = service_account.Credentials.from_service_account_file(
                    token_path,
                    scopes=["https://www.googleapis.com/auth/drive.readonly"]
                )
                return build("drive", "v3", credentials=creds)
            except Exception as e2:
                print(f"[GoogleDrive] サービスアカウント初期化エラー: {e2}")
                return None

    def list_files(self) -> list:
        """フォルダ内のファイル一覧をID付きで返す"""
        folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")
        if not folder_id:
            return []
        service = self._get_service()
        if not service:
            return []
        try:
            result = service.files().list(
                q=f"'{folder_id}' in parents and trashed=false",
                fields="files(id, name, mimeType)",
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            ).execute()
            files = result.get("files", [])
            return [
                {
                    "id": f["id"],
                    "name": f["name"],
                    "type": "document" if f["mimeType"] == "application/vnd.google-apps.document" else "spreadsheet",
                }
                for f in files
                if f["mimeType"] in (
                    "application/vnd.google-apps.document",
                    "application/vnd.google-apps.spreadsheet",
                )
            ]
        except Exception as e:
            print(f"[GoogleDrive] ファイル一覧取得エラー: {e}")
            return []

    def fetch_file_by_id(self, file_id: str) -> dict:
        """個別ファイルIDからコンテンツを取得"""
        service = self._get_service()
        if not service:
            return {"status": "auth_error", "title": "", "text": ""}
        try:
            meta = service.files().get(fileId=file_id, fields="name,mimeType").execute()
            name = meta.get("name", "ドキュメント")
            mime = meta.get("mimeType", "")
            if mime == "application/vnd.google-apps.document":
                content = service.files().export(fileId=file_id, mimeType="text/plain").execute()
            elif mime == "application/vnd.google-apps.spreadsheet":
                content = service.files().export(fileId=file_id, mimeType="text/csv").execute()
            else:
                return {"status": "unsupported", "title": name, "text": ""}
            text = content.decode("utf-8") if isinstance(content, bytes) else content
            return {"status": "ok", "title": name, "text": text}
        except Exception as e:
            return {"status": "error", "title": "", "text": "", "error": str(e)}

    def fetch(self) -> dict:
        """フォルダ内のドキュメントを取得してテキストに変換"""
        folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")
        if not folder_id:
            return {"status": "not_configured", "text": "", "files": []}

        service = self._get_service()
        if not service:
            return {"status": "auth_error", "text": "", "files": []}

        try:
            query = f"'{folder_id}' in parents and trashed=false"
            files_result = service.files().list(
                q=query, fields="files(id, name, mimeType)",
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            ).execute()
            files = files_result.get("files", [])

            texts = []
            file_names = []
            for file in files:
                mime = file.get("mimeType", "")
                name = file.get("name", "")
                text = ""
                try:
                    if mime == "application/vnd.google-apps.document":
                        content = service.files().export(
                            fileId=file["id"], mimeType="text/plain"
                        ).execute()
                        text = content.decode("utf-8") if isinstance(content, bytes) else content
                        texts.append(f"## {name}\n{text}")
                        file_names.append(name)
                    elif mime == "application/vnd.google-apps.spreadsheet":
                        content = service.files().export(
                            fileId=file["id"], mimeType="text/csv"
                        ).execute()
                        text = content.decode("utf-8") if isinstance(content, bytes) else content
                        texts.append(f"## {name} (表形式)\n{text}")
                        file_names.append(name)
                except Exception as e:
                    print(f"[GoogleDrive] ファイル読み込みエラー ({name}): {e}")

            return {
                "status": "ok",
                "text": "\n\n".join(texts),
                "files": file_names,
            }
        except Exception as e:
            print(f"[GoogleDrive] 取得エラー: {e}")
            return {"status": "error", "text": "", "files": []}


# ── Notion フェッチャー ───────────────────────────────────────

class NotionFetcher:

    def __init__(self, settings=None):
        self.settings = settings or {}
        p = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.database_id = os.environ.get("NOTION_DATABASE_ID", "")
        self.page_ids = []  # 個別ページID（必要に応じて設定ファイルから読む）

    def _get_client(self):
        try:
            from notion_client import Client
            token = os.environ.get("NOTION_API_TOKEN", "")
            return Client(auth=token)
        except Exception as e:
            print(f"[Notion] クライアント初期化エラー: {e}")
            return None

    def _extract_text_from_blocks(self, blocks: list) -> str:
        """Notionブロックからプレーンテキストを抽出"""
        texts = []
        for block in blocks:
            btype = block.get("type", "")
            content = block.get(btype, {})
            rt = content.get("rich_text", [])
            line = "".join(t.get("plain_text", "") for t in rt)
            if line:
                if "heading" in btype:
                    texts.append(f"\n### {line}")
                else:
                    texts.append(line)
        return "\n".join(texts)

    def _extract_text_from_properties(self, properties: dict) -> str:
        """データベースのプロパティからテキストを抽出"""
        parts = []
        for name, prop in properties.items():
            ptype = prop.get("type", "")
            value = ""
            if ptype == "title":
                value = "".join(t.get("plain_text", "") for t in prop.get("title", []))
            elif ptype == "rich_text":
                value = "".join(t.get("plain_text", "") for t in prop.get("rich_text", []))
            elif ptype == "select":
                opt = prop.get("select")
                value = opt.get("name", "") if opt else ""
            elif ptype == "multi_select":
                value = " | ".join(opt.get("name", "") for opt in prop.get("multi_select", []))
            elif ptype == "number":
                value = str(prop.get("number", ""))
            elif ptype == "url":
                value = prop.get("url", "") or ""
            elif ptype == "email":
                value = prop.get("email", "") or ""
            elif ptype == "phone_number":
                value = prop.get("phone_number", "") or ""
            elif ptype == "checkbox":
                value = "Yes" if prop.get("checkbox") else ""
            if value:
                parts.append(f"{name}: {value}")
        return "\n".join(parts)

    def _get_page_title(self, page: dict) -> str:
        props = page.get("properties", {})
        for key, prop in props.items():
            if prop.get("type") == "title":
                title_arr = prop.get("title", [])
                t = "".join(item.get("plain_text", "") for item in title_arr)
                if t:
                    return t
        return "（タイトルなし）"

    def _get_entry_name(self, entry: dict) -> str:
        """データベースエントリのタイトルプロパティ（type=title）から名前を取得"""
        props = entry.get("properties", {})
        for key, prop in props.items():
            if prop.get("type") == "title":
                title_arr = prop.get("title", [])
                t = "".join(item.get("plain_text", "") for item in title_arr)
                if t:
                    return t
        return "（名前なし）"

    def fetch_page_by_id(self, page_id: str) -> dict:
        """個別ページまたはデータベースIDからコンテンツを取得"""
        client = self._get_client()
        if not client:
            return {"status": "auth_error", "title": "", "text": ""}
        # まずページとして取得を試みる
        try:
            page = client.pages.retrieve(page_id=page_id)
            title = self._get_page_title(page)
            blocks = client.blocks.children.list(block_id=page_id).get("results", [])
            text = self._extract_text_from_blocks(blocks)
            if not text:
                text = self._extract_text_from_properties(page.get("properties", {}))
            return {"status": "ok", "title": title, "text": text}
        except Exception as page_err:
            # ページ取得失敗 → データベースとして取得を試みる
            if "not a page" not in str(page_err) and "database" not in str(page_err).lower():
                return {"status": "error", "title": "", "text": "", "error": str(page_err)}
        try:
            return self._fetch_database_by_id(client, page_id)
        except Exception as db_err:
            return {"status": "error", "title": "", "text": "", "error": str(db_err)}

    def _fetch_database_by_id(self, client, database_id: str) -> dict:
        """データベースIDから全エントリのコンテンツを取得"""
        import requests as _req
        token = os.environ.get("NOTION_API_TOKEN", "")
        # DB タイトル取得
        try:
            db_obj = client.databases.retrieve(database_id=database_id)
            title_arr = db_obj.get("title", [])
            db_title = "".join(t.get("plain_text", "") for t in title_arr) or "Notion Database"
        except Exception:
            db_title = "Notion Database"
        # エントリ取得
        headers = {
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        }
        r = _req.post(
            f"https://api.notion.com/v1/databases/{database_id}/query",
            headers=headers, json={},
        )
        results = r.json().get("results", [])
        entry_texts = []
        for entry in results:
            if entry.get("object") != "page":
                continue
            name = self._get_entry_name(entry)
            pid = entry.get("id", "")
            try:
                blocks_resp = client.blocks.children.list(block_id=pid)
                text = self._extract_text_from_blocks(blocks_resp.get("results", []))
            except Exception:
                text = self._extract_text_from_properties(entry.get("properties", {}))
            if text:
                entry_texts.append(f"### {name}\n{text}")
        return {
            "status": "ok",
            "title": db_title,
            "text": "\n\n".join(entry_texts),
        }

    def list_entries(self) -> list:
        """データベースのエントリ一覧をID付きで返す"""
        client = self._get_client()
        if not client or not self.database_id:
            return []
        try:
            import requests as _req
            token = os.environ.get("NOTION_API_TOKEN", "")
            headers = {
                "Authorization": f"Bearer {token}",
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            }
            r = _req.post(
                f"https://api.notion.com/v1/databases/{self.database_id}/query",
                headers=headers, json={},
            )
            results = r.json().get("results", [])
            return [
                {"id": e["id"], "name": self._get_entry_name(e)}
                for e in results if e.get("object") == "page"
            ]
        except Exception as e:
            print(f"[Notion] エントリ一覧取得エラー: {e}")
            return []

    def fetch(self) -> dict:
        """指定ページとデータベースからコンテンツを取得"""
        client = self._get_client()
        if not client:
            return {"status": "not_configured", "text": "", "pages": [], "db_entries_count": 0, "entries": []}

        if not self.database_id:
            return {"status": "auth_error", "text": "", "pages": [], "db_entries_count": 0, "entries": []}

        texts = []
        page_titles = []
        db_entries_count = 0
        entries = []

        # 個別ページの取得
        for page_id in self.page_ids:
            try:
                page = client.pages.retrieve(page_id=page_id)
                title = self._get_page_title(page)
                blocks_response = client.blocks.children.list(block_id=page_id)
                blocks = blocks_response.get("results", [])
                page_text = self._extract_text_from_blocks(blocks)
                texts.append(f"## {title} (Page)\n{page_text}")
                page_titles.append(title)
            except Exception as e:
                print(f"[Notion] ページ取得エラー ({page_id}): {e}")

        # データベースの取得
        if self.database_id:
            try:
                # データソース経由でDBが接続されている場合も考慮
                db_obj = None
                try:
                    db_obj = client.databases.retrieve(database_id=self.database_id)
                except Exception as e:
                    print(f"[Notion] DB詳細取得失敗: {e}")

                # DBのページ一覧を取得（queryはrequestsで）
                import requests as _req
                token = os.environ.get("NOTION_API_TOKEN", "")
                headers = {
                    "Authorization": f"Bearer {token}",
                    "Notion-Version": "2022-06-28",
                    "Content-Type": "application/json",
                }
                r = _req.post(
                    f"https://api.notion.com/v1/databases/{self.database_id}/query",
                    headers=headers,
                    json={},
                )
                db_response = r.json()
                results = db_response.get("results", [])

                # エントリの絞り込み（object=page かつ parent.type != data_source_id 以外も含む）
                matched_entries = [
                    e for e in results if e.get("object") == "page"
                ]

                db_entries_count = len(matched_entries)

                db_header = f"## Notion Database (ID: {self.database_id})\n"
                entry_texts = []

                for entry in matched_entries:
                    entry_name = self._get_entry_name(entry)
                    parent = entry.get("parent", {})
                    ptype = parent.get("type", "")
                    pid = entry.get("id", "")

                    # ページ本文のブロックを取得
                    try:
                        blocks_resp = client.blocks.children.list(block_id=pid)
                        blks = blocks_resp.get("results", [])
                        entry_text = self._extract_text_from_blocks(blks)
                    except Exception as e:
                        props_text = self._extract_text_from_properties(entry.get("properties", {}))
                        entry_text = props_text

                    entries.append({"name": entry_name, "text": entry_text})
                    if entry_text:
                        entry_texts.append(f"### {entry_name}\n{entry_text}")

                texts.append(db_header + "\n".join(entry_texts))

            except Exception as e:
                print(f"[Notion] データベース取得エラー ({self.database_id}): {e}")

        return {
            "status": "ok",
            "text": "\n\n".join(texts),
            "pages": page_titles,
            "db_entries_count": db_entries_count,
            "entries": entries,
        }


# ── SourceAggregator ─────────────────────────────────────────

class SourceAggregator:

    def __init__(self):
        pass

    def get_sources(self, force_refresh: bool = False) -> dict:
        """
        キャッシュが有効なら返す、なければ取得してキャッシュ。
        force_refresh=True の場合は常に再取得。
        """
        cache = _load_cache()
        if not force_refresh and _is_cache_valid(cache):
            return cache
        return self.refresh()

    def refresh(self) -> dict:
        """Google Drive と Notion を取得してキャッシュに保存"""
        drive_result = GoogleDriveFetcher().fetch()
        notion_result = NotionFetcher().fetch()

        parts = []
        if drive_result.get("text"):
            parts.append("### ▼ Google Drive から取得した情報\n" + drive_result["text"])
        if notion_result.get("text"):
            parts.append("### ▼ Notion から取得した情報\n" + notion_result["text"])

        combined = "\n\n".join(parts)

        data = {
            "drive": {
                "status": drive_result.get("status"),
                "text": drive_result.get("text", ""),
                "files": drive_result.get("files", []),
            },
            "notion": {
                "status": notion_result.get("status"),
                "text": notion_result.get("text", ""),
                "pages": notion_result.get("pages", []),
                "db_entries_count": notion_result.get("db_entries_count", 0),
                "entries": notion_result.get("entries", []),
            },
            "combined_text": combined,
            "fetched_at": datetime.now().isoformat(),
            "fetched_ts": time.time(),
        }
        _save_cache(data)
        return data

    def get_combined_text(self) -> str:
        """選択されたファイル・エントリのテキストのみ返す（未選択時は全件）"""
        cache = _load_cache()
        selections = load_selections()
        selected_drive = selections.get("drive", [])
        selected_notion = selections.get("notion", [])
        selected_urls = selections.get("urls", [])

        # 選択なし → ソースを使わない
        if not selected_drive and not selected_notion and not selected_urls:
            return ""

        parts = []

        # Drive: 選択ファイルのみ再取得
        if selected_drive:
            fetcher = GoogleDriveFetcher()
            service = fetcher._get_service()
            if service:
                texts = []
                for file_id in selected_drive:
                    try:
                        meta = service.files().get(fileId=file_id, fields="name,mimeType").execute()
                        mime = meta.get("mimeType", "")
                        name = meta.get("name", "")
                        if mime == "application/vnd.google-apps.document":
                            content = service.files().export(fileId=file_id, mimeType="text/plain").execute()
                            text = content.decode("utf-8") if isinstance(content, bytes) else content
                            texts.append(f"## {name}\n{text}")
                        elif mime == "application/vnd.google-apps.spreadsheet":
                            content = service.files().export(fileId=file_id, mimeType="text/csv").execute()
                            text = content.decode("utf-8") if isinstance(content, bytes) else content
                            texts.append(f"## {name} (表形式)\n{text}")
                    except Exception as e:
                        print(f"[GoogleDrive] 選択ファイル取得エラー ({file_id}): {e}")
                if texts:
                    parts.append("### ▼ Google Drive から取得した情報\n" + "\n\n".join(texts))

        # Notion: 選択エントリのみ
        if selected_notion:
            notion_cache_entries = cache.get("notion", {}).get("entries", [])
            # IDをキーにしたマップが必要なため再取得
            fetcher = NotionFetcher()
            client = fetcher._get_client()
            if client:
                texts = []
                for entry_id in selected_notion:
                    try:
                        page = client.pages.retrieve(page_id=entry_id)
                        name = fetcher._get_entry_name(page)
                        blocks_resp = client.blocks.children.list(block_id=entry_id)
                        text = fetcher._extract_text_from_blocks(blocks_resp.get("results", []))
                        if not text:
                            text = fetcher._extract_text_from_properties(page.get("properties", {}))
                        texts.append(f"### {name}\n{text}")
                    except Exception as e:
                        print(f"[Notion] 選択エントリ取得エラー ({entry_id}): {e}")
                if texts:
                    parts.append("### ▼ Notion から取得した情報\n" + "\n\n".join(texts))

        # URL ソース
        if selected_urls:
            url_texts = []
            for entry in selected_urls:
                title = entry.get("title", "URL")
                text = entry.get("text", "")
                if text:
                    url_texts.append(f"## {title}\n{text}")
            if url_texts:
                parts.append("### ▼ URL から取得した情報\n" + "\n\n".join(url_texts))

        return "\n\n".join(parts)

    def get_status(self) -> dict:
        """接続状況と最終更新時刻を返す"""
        cache = _load_cache()
        return {
            "drive": {
                "status": cache.get("drive", {}).get("status", "not_fetched"),
                "files": cache.get("drive", {}).get("files", []),
            },
            "notion": {
                "status": cache.get("notion", {}).get("status", "not_fetched"),
                "pages": cache.get("notion", {}).get("pages", []),
                "db_entries_count": cache.get("notion", {}).get("db_entries_count", 0),
            },
            "last_updated": cache.get("fetched_at"),
        }
