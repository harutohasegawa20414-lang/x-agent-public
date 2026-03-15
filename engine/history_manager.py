import json
import os
import sys
import uuid
from datetime import datetime

HISTORY_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "post_history.json"
)

# Firebase共有クライアントをインポート
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
try:
    from firebase_client import load_doc, save_doc
    _FIREBASE_IMPORTED = True
except ImportError:
    _FIREBASE_IMPORTED = False

_FS_KEY = "xagent_post_history"


def load_history() -> list:
    """投稿履歴を読み込む"""
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY)
        if result is not None:
            return result
    if not os.path.exists(HISTORY_PATH):
        return []
    try:
        with open(HISTORY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_post(content: str, style_id: str, style_name: str, account_id: str, account_name: str) -> dict:
    """投稿を履歴に追加して保存する"""
    history = load_history()
    entry = {
        "id": str(uuid.uuid4()),
        "content": content,
        "style_id": style_id,
        "style_name": style_name,
        "account_id": account_id,
        "account_name": account_name,
        "posted_at": datetime.now().isoformat(),
        "status": "queued",  # queued / posted / failed
    }
    history.insert(0, entry)  # 最新を先頭に
    # 最大500件まで保持
    history = history[:500]
    _write_history(history)
    return entry


def update_post_status(post_id: str, status: str):
    """投稿ステータスを更新する"""
    history = load_history()
    for entry in history:
        if entry.get("id") == post_id:
            entry["status"] = status
            break
    _write_history(history)


def delete_post(post_id: str) -> bool:
    """履歴から指定の投稿を削除する"""
    history = load_history()
    new_history = [e for e in history if e.get("id") != post_id]
    if len(new_history) == len(history):
        return False  # 見つからなかった
    _write_history(new_history)
    return True


def _write_history(history: list):
    if _FIREBASE_IMPORTED:
        save_doc(_FS_KEY, history)
    os.makedirs(os.path.dirname(HISTORY_PATH), exist_ok=True)
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
