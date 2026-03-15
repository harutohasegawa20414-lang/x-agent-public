"""共有ユーティリティ関数"""

import json
import os
import tempfile


def atomic_json_save(path: str, data, *, ensure_ascii=False, indent=2):
    """JSON データをアトミックに書き込む（tempfile + rename）。
    書き込み途中のクラッシュによるファイル破損を防止する。"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=os.path.dirname(path), suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=ensure_ascii, indent=indent)
        os.replace(tmp_path, path)
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
