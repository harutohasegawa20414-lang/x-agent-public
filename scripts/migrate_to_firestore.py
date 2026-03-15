#!/usr/bin/env python3
"""
migrate_to_firestore.py

data/accounts.json など既存のローカルJSONを Firestore へ一括移行するスクリプト。
初回デプロイ前に一度だけ実行してください。

使い方:
    cd /Users/hasegawaharuto/Desktop/Xエージェント
    python3 scripts/migrate_to_firestore.py
"""

import os
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, ".env"))

# firebase_client を使って Firestore に接続
from firebase_client import get_db, save_doc

# 移行対象: (ローカルJSONパス, Firestoreキー)
MIGRATIONS = [
    (os.path.join(ROOT, "data", "accounts.json"),          "xagent_accounts"),
    (os.path.join(ROOT, "data", "post_history.json"),       "xagent_post_history"),
    (os.path.join(ROOT, "data", "generated_posts.json"),    "xagent_generated_posts"),
    (os.path.join(ROOT, "data", "custom_styles.json"),      "xagent_custom_styles"),
    (os.path.join(ROOT, "data", "style_usernames.json"),    "xagent_style_usernames"),
    (os.path.join(ROOT, "data", "schedule_config.json"),    "xagent_schedule_config"),
    (os.path.join(ROOT, "data", "frameworks.json"),         "xagent_frameworks"),
    (os.path.join(ROOT, "no.9", "data", "categories.json"),     "no9_categories"),
    (os.path.join(ROOT, "no.9", "data", "dm_templates.json"),   "no9_dm_templates"),
    (os.path.join(ROOT, "no.9", "data", "send_config.json"),    "no9_send_config"),
    (os.path.join(ROOT, "no.9", "data", "targets.json"),        "no9_targets"),
    (os.path.join(ROOT, "no.9", "data", "dm_history.json"),     "no9_dm_history"),
    (os.path.join(ROOT, "no.9", "data", "replies.json"),        "no9_replies"),
    (os.path.join(ROOT, "no.9", "data", "blacklist.json"),      "no9_blacklist"),
]


def main():
    db = get_db()
    if db is None:
        print("❌ Firestore に接続できません。")
        print("   FIREBASE_CREDENTIALS_JSON が正しく設定されているか確認してください。")
        sys.exit(1)

    print("=== Firestore 移行開始 ===\n")
    success = 0
    skipped = 0
    failed = 0

    for local_path, fs_key in MIGRATIONS:
        if not os.path.exists(local_path):
            print(f"  [SKIP] {os.path.relpath(local_path, ROOT)} (ファイルなし)")
            skipped += 1
            continue

        with open(local_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        ok = save_doc(fs_key, data)
        if ok:
            print(f"  [OK]   {os.path.relpath(local_path, ROOT)} → {fs_key}")
            success += 1
        else:
            print(f"  [ERR]  {os.path.relpath(local_path, ROOT)} → {fs_key} ❌")
            failed += 1

    print(f"\n=== 完了: 成功 {success} / スキップ {skipped} / 失敗 {failed} ===")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
