"""
engine/source_fetcher.py

URLから一次情報を取得し、DM生成のコンテキストとして使うモジュール。
ダッシュボードからURLを貼り付け→スクレイピング→選択→DM生成に反映。
"""

import json
import os
import re
import urllib.request
import urllib.error
from typing import Dict, List

NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(NO9_DIR, "data")
SELECTIONS_PATH = os.path.join(DATA_DIR, "source_selections.json")


# ============================================================
# 選択状態の永続化
# ============================================================

def load_selections() -> Dict:
    """保存済みのURL選択状態を読み込む。"""
    if not os.path.exists(SELECTIONS_PATH):
        return {"urls": []}
    try:
        with open(SELECTIONS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        data.setdefault("urls", [])
        return data
    except Exception:
        return {"urls": []}


def save_selections(selections: Dict):
    """URL選択状態を保存する。"""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SELECTIONS_PATH, "w", encoding="utf-8") as f:
        json.dump(selections, f, ensure_ascii=False, indent=2)


# ============================================================
# URLスクレイピング
# ============================================================

def _validate_url_safety(url: str) -> str:
    """SSRF防止: URLのスキーム・ホストを検証し、安全な場合のみURLを返す。"""
    import ipaddress
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("http/httpsのURLのみ対応しています")
    hostname = parsed.hostname or ""
    if not hostname:
        raise ValueError("無効なURLです")
    # localhost / プライベートIPをブロック
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "[::]", "[::1]"):
        raise ValueError("内部ネットワークのURLは指定できません")
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise ValueError("内部ネットワークのURLは指定できません")
    except ValueError as ve:
        if "内部ネットワーク" in str(ve):
            raise
        pass  # ホスト名の場合はスキップ
    return url


def fetch_url_content(url: str) -> Dict:
    """
    URLからWebページの内容を取得してタイトルとテキストを返す。
    stdlib + 簡易HTMLパーサーで実装（BeautifulSoup利用可能なら優先）。
    """
    url = url.strip()
    if not url:
        return {"status": "error", "error": "URLが空です"}

    # SSRF防止
    try:
        _validate_url_safety(url)
    except ValueError as e:
        return {"status": "error", "error": str(e)}

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; No9Bot/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            # エンコーディング判定
            charset = resp.headers.get_content_charset() or "utf-8"
            html = resp.read().decode(charset, errors="replace")
    except Exception:
        return {"status": "error", "error": "URLの取得に失敗しました"}

    # BeautifulSoupが使えるなら使う、なければ簡易パーサー
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # title
        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()

        # body text
        article = soup.find("article")
        container = article if article else soup.find("body")
        if container:
            for tag in container.find_all(["script", "style", "nav", "header", "footer"]):
                tag.decompose()
            text = container.get_text(separator="\n", strip=True)
        else:
            text = soup.get_text(separator="\n", strip=True)

    except ImportError:
        # BeautifulSoup なし → 簡易パーサー
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else ""

        # scriptとstyleを除去
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.IGNORECASE | re.DOTALL)
        # タグを除去
        text = re.sub(r"<[^>]+>", "\n", text)
        # 空白を整理
        text = re.sub(r"\n{3,}", "\n\n", text).strip()

    # テキストが長すぎる場合は切り詰め（DMプロンプトへの注入を考慮）
    if len(text) > 5000:
        text = text[:5000] + "\n...(以下省略)"

    return {
        "status": "ok",
        "url": url,
        "title": title,
        "text": text,
        "type": "url",
    }


# ============================================================
# DM生成用テキスト統合
# ============================================================

def get_combined_text() -> str:
    """
    選択済みURLソースのテキストを結合して返す。
    DM生成の source_context として使用される。
    """
    selections = load_selections()
    selected_urls = selections.get("urls", [])

    if not selected_urls:
        return ""

    url_texts = []
    for entry in selected_urls:
        title = entry.get("title", "URL")
        text = entry.get("text", "")
        if text:
            url_texts.append(f"## {title}\n{text}")

    if not url_texts:
        return ""

    return "### ▼ URL から取得した情報\n" + "\n\n".join(url_texts)


# ============================================================
# ステータス取得
# ============================================================

def get_status() -> Dict:
    """ソース選択の現状を返す。"""
    selections = load_selections()
    urls = selections.get("urls", [])
    return {
        "url_count": len(urls),
        "urls": [{"url": u.get("url", ""), "title": u.get("title", "")} for u in urls],
    }
