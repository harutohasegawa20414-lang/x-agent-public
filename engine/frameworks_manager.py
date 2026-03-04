"""
engine/frameworks_manager.py

各スタイルカードに紐づく「投稿フレームワーク」を data/frameworks.json で管理する。
"""
import json
import os
import time
from typing import List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
FRAMEWORKS_PATH = os.path.join(DATA_DIR, "frameworks.json")


def _load_all() -> dict:
    if not os.path.exists(FRAMEWORKS_PATH):
        return {}
    with open(FRAMEWORKS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_all(data: dict) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(FRAMEWORKS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_frameworks(style_id: str) -> dict:
    """指定スタイルのフレームワーク情報を返す。存在しなければ空の構造を返す。"""
    all_data = _load_all()
    return all_data.get(style_id, {"style_id": style_id, "frameworks": []})


def save_frameworks(style_id: str, style_name: str, frameworks: List[dict]) -> None:
    """フレームワーク一覧を上書き保存する。"""
    all_data = _load_all()
    all_data[style_id] = {
        "style_id": style_id,
        "style_name": style_name,
        "frameworks": frameworks,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    _save_all(all_data)


def get_framework(style_id: str, framework_id: str) -> Optional[dict]:
    """特定フレームワークを返す。見つからなければ None。"""
    entry = load_frameworks(style_id)
    for fw in entry.get("frameworks", []):
        if fw.get("id") == framework_id:
            return fw
    return None


def delete_framework(style_id: str, framework_id: str) -> bool:
    """特定フレームワークを削除する。成功すれば True。"""
    all_data = _load_all()
    if style_id not in all_data:
        return False
    original = all_data[style_id].get("frameworks", [])
    updated = [fw for fw in original if fw.get("id") != framework_id]
    if len(updated) == len(original):
        return False
    all_data[style_id]["frameworks"] = updated
    _save_all(all_data)
    return True
