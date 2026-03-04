"""
engine/notion_fetcher.py

NotionのDBから一次情報を取得し、DM生成のコンテキストとして使うモジュール。
起動時に一度取得してキャッシュし、1時間ごとに自動更新する。
"""

import os
import json
import time
from datetime import datetime
from typing import Optional

NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_PATH = os.path.join(NO9_DIR, "data", "notion_cache.json")
CACHE_TTL_SECONDS = 3600  # 1時間


def _load_cache() -> dict:
    if not os.path.exists(CACHE_PATH):
        return {}
    with open(CACHE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_cache(data: dict):
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _is_cache_valid(cache: dict) -> bool:
    ts = cache.get("fetched_ts")
    if not ts:
        return False
    return (time.time() - ts) < CACHE_TTL_SECONDS


def _extract_text_from_properties(properties: dict) -> str:
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
            value = " / ".join(opt.get("name", "") for opt in prop.get("multi_select", []))
        elif ptype == "number":
            v = prop.get("number")
            value = str(v) if v is not None else ""
        elif ptype == "url":
            value = prop.get("url", "") or ""
        elif ptype == "email":
            value = prop.get("email", "") or ""
        elif ptype == "phone_number":
            value = prop.get("phone_number", "") or ""
        elif ptype == "checkbox":
            value = "はい" if prop.get("checkbox") else ""
        if value:
            parts.append(f"{name}: {value}")
    return "\n".join(parts)


def fetch_from_notion(api_token: str, database_id: str) -> dict:
    """NotionのDBを取得してテキストに変換する"""
    if not api_token or not database_id:
        return {"status": "not_configured", "text": "", "entries_count": 0}

    try:
        import urllib.request
        import urllib.error

        headers = {
            "Authorization": f"Bearer {api_token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        }

        req = urllib.request.Request(
            f"https://api.notion.com/v1/databases/{database_id}/query",
            data=b"{}",
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            db_response = json.loads(resp.read())

        results = [e for e in db_response.get("results", []) if e.get("object") == "page"]

        entry_texts = []
        for entry in results:
            props_text = _extract_text_from_properties(entry.get("properties", {}))
            if props_text:
                entry_texts.append(props_text)

        combined = "\n\n---\n\n".join(entry_texts)
        return {
            "status": "ok",
            "text": combined,
            "entries_count": len(results),
        }

    except Exception as e:
        print(f"[Notion] 取得エラー: {e}")
        return {"status": "error", "text": "", "entries_count": 0, "error": str(e)}


def get_context(api_token: str, database_id: str, force_refresh: bool = False) -> str:
    """
    キャッシュが有効ならそれを返す。なければNotionから取得してキャッシュ。
    DM生成時に渡す「一次情報テキスト」を返す。
    """
    cache = _load_cache()
    if not force_refresh and _is_cache_valid(cache):
        return cache.get("text", "")

    result = fetch_from_notion(api_token, database_id)
    if result["status"] == "ok":
        data = {
            "text": result["text"],
            "entries_count": result["entries_count"],
            "fetched_at": datetime.now().isoformat(),
            "fetched_ts": time.time(),
        }
        _save_cache(data)
        print(f"[Notion] {result['entries_count']}件のエントリを取得・キャッシュしました")
        return result["text"]
    else:
        print(f"[Notion] 取得失敗 (status={result['status']})")
        return cache.get("text", "")  # 失敗時は古いキャッシュを使う


def get_cache_status() -> dict:
    cache = _load_cache()
    return {
        "cached": bool(cache),
        "entries_count": cache.get("entries_count", 0),
        "fetched_at": cache.get("fetched_at"),
        "valid": _is_cache_valid(cache),
    }
