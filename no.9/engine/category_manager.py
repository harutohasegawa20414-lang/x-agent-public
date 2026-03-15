"""
engine/category_manager.py

ターゲットカテゴリの管理（ジャンル非依存設計）。
カテゴリ = 保存可能な検索ロジック。
"""

import json
import os
import sys
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(NO9_DIR, "data")
CATEGORIES_PATH = os.path.join(DATA_DIR, "categories.json")

# Firebase共有クライアントをインポート（プロジェクトルート経由）
_ROOT = os.path.dirname(NO9_DIR)  # Xエージェント/
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
try:
    from firebase_client import load_doc, save_doc
    _FIREBASE_IMPORTED = True
except ImportError:
    _FIREBASE_IMPORTED = False

_FS_KEY = "no9_categories"


def _load() -> List[Dict]:
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY)
        if result is not None:
            return result
    if not os.path.exists(CATEGORIES_PATH):
        return []
    with open(CATEGORIES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(categories: List[Dict]):
    if _FIREBASE_IMPORTED:
        save_doc(_FS_KEY, categories)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CATEGORIES_PATH, "w", encoding="utf-8") as f:
        json.dump(categories, f, ensure_ascii=False, indent=2)


def list_categories() -> List[Dict]:
    return _load()


def get_category(category_id: str) -> Optional[Dict]:
    for cat in _load():
        if cat["id"] == category_id:
            return cat
    return None


def create_category(
    name: str,
    description: str = "",
    profile_keywords: List[str] = None,
    post_keywords: List[str] = None,
    hashtags: List[str] = None,
    exclude_keywords: List[str] = None,
    follower_min: int = 0,
    follower_max: int = 10000000,
    post_frequency_min: int = 0,
    last_post_days_max: int = 0,
    engagement_threshold: float = 0.0,
    is_verified_only: bool = False,
    score_weights: Dict[str, float] = None,
    dm_template_id: Optional[str] = None,
    test_mode: bool = True,
    test_mode_limit: int = 3,
    test_mode_graduate_at: int = 10,
    auto_replenish: bool = True,
    replenish_threshold: int = 5,
) -> Dict:
    categories = _load()
    category = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": description,
        "enabled": True,
        "conditions": {
            "profile_keywords": profile_keywords or [],
            "post_keywords": post_keywords or [],
            "hashtags": hashtags or [],
            "exclude_keywords": exclude_keywords or [],
            "follower_min": follower_min,
            "follower_max": follower_max,
            "post_frequency_min": post_frequency_min,
            "last_post_days_max": last_post_days_max,
            "engagement_threshold": engagement_threshold,
            "is_verified_only": is_verified_only,
        },
        "score_weights": score_weights or {
            "profile_match": 30,
            "post_match": 25,
            "hashtag_match": 15,
            "follower_range": 15,
            "engagement": 15,
        },
        "dm_template_id": dm_template_id,
        "test_mode": test_mode,
        "test_mode_limit": test_mode_limit,
        "test_mode_graduate_at": test_mode_graduate_at,
        "auto_replenish": auto_replenish,
        "replenish_threshold": replenish_threshold,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "stats": {
            "total_sent": 0,
            "total_replied": 0,
            "reply_rate": 0.0,
        },
    }
    categories.append(category)
    _save(categories)
    return category


def update_category(category_id: str, updates: Dict[str, Any]) -> Optional[Dict]:
    categories = _load()
    for i, cat in enumerate(categories):
        if cat["id"] == category_id:
            # 深いマージ（conditions, score_weightsはネスト更新）
            for key, val in updates.items():
                if key in ("conditions", "score_weights") and isinstance(val, dict):
                    categories[i][key] = {**categories[i].get(key, {}), **val}
                else:
                    categories[i][key] = val
            categories[i]["updated_at"] = datetime.now().isoformat()
            _save(categories)
            return categories[i]
    return None


def delete_category(category_id: str) -> bool:
    categories = _load()
    new_categories = [c for c in categories if c["id"] != category_id]
    if len(new_categories) == len(categories):
        return False
    _save(new_categories)
    return True


def toggle_category(category_id: str) -> Optional[Dict]:
    categories = _load()
    for i, cat in enumerate(categories):
        if cat["id"] == category_id:
            categories[i]["enabled"] = not categories[i]["enabled"]
            categories[i]["updated_at"] = datetime.now().isoformat()
            _save(categories)
            return categories[i]
    return None


def duplicate_category(category_id: str) -> Optional[Dict]:
    original = get_category(category_id)
    if not original:
        return None
    return create_category(
        name=original["name"] + " (コピー)",
        description=original["description"],
        profile_keywords=original["conditions"]["profile_keywords"],
        post_keywords=original["conditions"]["post_keywords"],
        hashtags=original["conditions"]["hashtags"],
        exclude_keywords=original["conditions"]["exclude_keywords"],
        follower_min=original["conditions"]["follower_min"],
        follower_max=original["conditions"]["follower_max"],
        post_frequency_min=original["conditions"]["post_frequency_min"],
        last_post_days_max=original["conditions"].get("last_post_days_max", 0),
        engagement_threshold=original["conditions"]["engagement_threshold"],
        is_verified_only=original["conditions"].get("is_verified_only", False),
        score_weights=original["score_weights"],
        dm_template_id=original.get("dm_template_id"),
        test_mode=True,  # 複製は常にテストモードから開始
        test_mode_limit=original.get("test_mode_limit", 3),
        test_mode_graduate_at=original.get("test_mode_graduate_at", 10),
        auto_replenish=original.get("auto_replenish", True),
        replenish_threshold=original.get("replenish_threshold", 5),
    )


def graduate_from_test_mode(category_id: str) -> Optional[Dict]:
    """テストモードを卒業させ、通常運用に移行する"""
    categories = _load()
    for i, cat in enumerate(categories):
        if cat["id"] == category_id:
            categories[i]["test_mode"] = False
            categories[i]["updated_at"] = datetime.now().isoformat()
            _save(categories)
            print(f"[INFO] カテゴリ '{cat['name']}' がテストモードを卒業しました")
            return categories[i]
    return None


def update_category_stats(category_id: str, sent_delta: int = 0, replied_delta: int = 0):
    categories = _load()
    for i, cat in enumerate(categories):
        if cat["id"] == category_id:
            categories[i]["stats"]["total_sent"] += sent_delta
            categories[i]["stats"]["total_replied"] += replied_delta
            total_sent = categories[i]["stats"]["total_sent"]
            total_replied = categories[i]["stats"]["total_replied"]
            categories[i]["stats"]["reply_rate"] = (
                round(total_replied / total_sent * 100, 1) if total_sent > 0 else 0.0
            )
            _save(categories)
            return
