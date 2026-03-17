"""utils.py のユニットテスト"""
import json
import os
import sys
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from utils import atomic_json_save


def test_atomic_json_save_creates_file(tmp_path):
    """ファイルが正常に作成されること"""
    path = str(tmp_path / "data.json")
    data = {"key": "value", "num": 42}
    atomic_json_save(path, data)
    assert os.path.exists(path)
    with open(path, encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded == data


def test_atomic_json_save_overwrites(tmp_path):
    """既存ファイルが上書きされること"""
    path = str(tmp_path / "data.json")
    atomic_json_save(path, {"v": 1})
    atomic_json_save(path, {"v": 2})
    with open(path, encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded == {"v": 2}


def test_atomic_json_save_no_tmp_file_on_success(tmp_path):
    """成功後に .tmp ファイルが残らないこと"""
    path = str(tmp_path / "data.json")
    atomic_json_save(path, {"x": 1})
    tmp_files = [f for f in os.listdir(tmp_path) if f.endswith(".tmp")]
    assert tmp_files == []


def test_atomic_json_save_creates_parent_dirs(tmp_path):
    """親ディレクトリが存在しなくても作成されること"""
    path = str(tmp_path / "sub" / "dir" / "data.json")
    atomic_json_save(path, {"nested": True})
    assert os.path.exists(path)


def test_atomic_json_save_unicode(tmp_path):
    """日本語を含むデータが正しく保存・読み込みできること"""
    path = str(tmp_path / "data.json")
    data = {"name": "テスト", "desc": "日本語テスト"}
    atomic_json_save(path, data)
    with open(path, encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded["name"] == "テスト"
