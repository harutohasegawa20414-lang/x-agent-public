"""no.9/engine/user_searcher.py のユニットテスト"""
import json
import os
import sys
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NO9_DIR = os.path.join(ROOT, "no.9")
sys.path.insert(0, ROOT)
sys.path.insert(0, NO9_DIR)

from engine.user_searcher import calculate_score, _load_blacklist_raw


def test_calculate_score_profile_keyword_match():
    """プロフィールキーワードが一致するとスコアが上がること"""
    user = {"bio": "起業家 スタートアップ CEO", "tweet_count": 100,
            "recent_posts": [], "hashtags_used": []}
    conditions = {"profile_keywords": ["起業家", "CEO"], "post_keywords": []}
    weights = {"profile_match": 30, "post_keyword_match": 20}
    score = calculate_score(user, conditions, weights)
    assert score > 0


def test_calculate_score_exclude_keyword():
    """除外キーワードが含まれるとスコア 0 を返すこと"""
    user = {"bio": "転職したい 求職中", "tweet_count": 100,
            "recent_posts": [], "hashtags_used": []}
    conditions = {"exclude_keywords": ["転職"], "profile_keywords": [], "post_keywords": []}
    weights = {}
    score = calculate_score(user, conditions, weights)
    assert score == 0.0


def test_calculate_score_verified_only_filter():
    """is_verified_only=True で未認証ユーザーはスコア 0"""
    user = {"bio": "CEO", "verified": False, "tweet_count": 100,
            "recent_posts": [], "hashtags_used": []}
    conditions = {"is_verified_only": True, "profile_keywords": [], "post_keywords": []}
    weights = {}
    score = calculate_score(user, conditions, weights)
    assert score == 0.0


def test_load_blacklist_raw_old_format(tmp_path, monkeypatch):
    """旧形式（List[str]）のブラックリストが List[Dict] に変換されること"""
    bl_path = str(tmp_path / "blacklist.json")
    with open(bl_path, "w", encoding="utf-8") as f:
        json.dump(["user123", "user456"], f)

    import engine.user_searcher as us
    monkeypatch.setattr(us, "BLACKLIST_PATH", bl_path)
    monkeypatch.setattr(us, "_FIREBASE_IMPORTED", False)

    result = _load_blacklist_raw()
    assert isinstance(result, list)
    assert all(isinstance(entry, dict) for entry in result)
    assert result[0]["user_id"] == "user123"
