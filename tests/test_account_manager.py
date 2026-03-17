"""engine/account_manager.py のユニットテスト"""
import importlib.util
import json
import os
import sys
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_am(monkeypatch):
    """engine/account_manager を importlib で直接ロードして返す（no.9/engine との衝突回避）"""
    if ROOT not in sys.path:
        sys.path.insert(0, ROOT)
    spec = importlib.util.spec_from_file_location(
        "xagent_account_manager",
        os.path.join(ROOT, "engine", "account_manager.py"),
    )
    am = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(am)
    monkeypatch.setattr(am, "_FIREBASE_IMPORTED", False)
    return am


@pytest.fixture
def am_with_tmp(tmp_path, monkeypatch):
    """一時ファイルを使う account_manager モジュールを返す"""
    accounts_file = tmp_path / "accounts.json"
    am = _load_am(monkeypatch)
    am.ACCOUNTS_PATH = str(accounts_file)
    return am


def test_add_account_no_duplicate(am_with_tmp):
    """同じIDでアカウントを2回追加しても重複しないこと"""
    am = am_with_tmp
    am.add_account("acc1", "テスト1", "k", "s", "t", "ts")
    am.add_account("acc1", "テスト1更新", "k2", "s2", "t2", "ts2")
    data = am.load_data()
    ids = [a["id"] for a in data["accounts"]]
    assert ids.count("acc1") == 1, "同一IDのアカウントが重複している"


def test_add_account_updates_existing(am_with_tmp):
    """同じIDで追加すると既存データが更新されること"""
    am = am_with_tmp
    am.add_account("acc1", "元の名前", "k", "s", "t", "ts")
    am.add_account("acc1", "新しい名前", "k2", "s2", "t2", "ts2")
    data = am.load_data()
    acc = next(a for a in data["accounts"] if a["id"] == "acc1")
    assert acc["name"] == "新しい名前"
    assert acc["x_api_key"] == "k2"


def test_switch_account(am_with_tmp):
    """存在するアカウントへの切り替えが成功すること"""
    am = am_with_tmp
    am.add_account("acc1", "A", "k", "s", "t", "ts")
    am.add_account("acc2", "B", "k", "s", "t", "ts")
    result = am.switch_account("acc2")
    assert result is True
    data = am.load_data()
    assert data["current"] == "acc2"


def test_switch_account_nonexistent(am_with_tmp):
    """存在しないアカウントへの切り替えが失敗すること"""
    am = am_with_tmp
    result = am.switch_account("nonexistent")
    assert result is False


def test_get_current_account_none_when_empty(am_with_tmp):
    """アカウントが0件のとき get_current_account() が None を返すこと"""
    am = am_with_tmp
    sys.path.insert(0, ROOT)
    from utils import atomic_json_save
    atomic_json_save(am.ACCOUNTS_PATH, {"current": "none", "accounts": []})
    result = am.get_current_account()
    assert result is None


def test_delete_account(am_with_tmp):
    """アクティブでないアカウントが削除できること"""
    am = am_with_tmp
    am.add_account("acc1", "A", "k", "s", "t", "ts")
    am.add_account("acc2", "B", "k", "s", "t", "ts")
    am.switch_account("acc1")
    result = am.delete_account("acc2")
    assert result is True
    data = am.load_data()
    assert not any(a["id"] == "acc2" for a in data["accounts"])


def test_delete_current_account_fails(am_with_tmp):
    """現在のアカウントは削除できないこと"""
    am = am_with_tmp
    am.add_account("acc1", "A", "k", "s", "t", "ts")
    am.switch_account("acc1")
    result = am.delete_account("acc1")
    assert result is False
