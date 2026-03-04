"""
engine/generated_posts_manager.py

投稿生成タブで生成されたツイート内容をスタイルごとに永続化するモジュール。
data/generated_posts.json に保存し、スケジューラーと共有する。
"""
import json
import os
from datetime import datetime
from typing import List, Optional

GENERATED_POSTS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "generated_posts.json"
)


def load_generated_posts() -> dict:
    """
    生成済み投稿を全件読み込む。
    Returns: { style_id: { style_id, style_name, content, contents, topic, generated_at } }
    """
    if not os.path.exists(GENERATED_POSTS_PATH):
        return {}
    try:
        with open(GENERATED_POSTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_generated_post(
    style_id: str,
    style_name: str,
    content: str,
    topic: str = "",
    contents: Optional[List[str]] = None,
):
    """
    スタイルの生成済み投稿を保存する（上書き）。
    contents: 3バリエーションのリスト（省略時は [content] として保存）
    """
    posts = load_generated_posts()
    variations = contents if contents else [content]
    posts[style_id] = {
        "style_id": style_id,
        "style_name": style_name,
        "content": variations[0] if variations else content,
        "contents": variations,
        "topic": topic,
        "generated_at": datetime.now().isoformat(),
    }
    os.makedirs(os.path.dirname(GENERATED_POSTS_PATH), exist_ok=True)
    with open(GENERATED_POSTS_PATH, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)


def delete_generated_post(style_id: str):
    """スタイルの生成済み投稿を削除する"""
    posts = load_generated_posts()
    if style_id in posts:
        del posts[style_id]
        with open(GENERATED_POSTS_PATH, "w", encoding="utf-8") as f:
            json.dump(posts, f, ensure_ascii=False, indent=2)


def pop_first_variation(style_id: str) -> bool:
    """
    生成済み投稿の contents の先頭を消費（削除）してシフトする。
    残りがある場合は content も更新する。
    空になった場合はエントリ自体を削除する。

    Returns:
        True: 消費成功（残りあり or エントリ削除）
        False: エントリなし
    """
    posts = load_generated_posts()
    if style_id not in posts:
        return False

    entry = posts[style_id]
    contents = entry.get("contents", [])

    if not contents:
        # contents がない場合は旧フォーマット: content を1件として扱い削除
        del posts[style_id]
        with open(GENERATED_POSTS_PATH, "w", encoding="utf-8") as f:
            json.dump(posts, f, ensure_ascii=False, indent=2)
        return True

    # 先頭を消費
    contents.pop(0)
    remaining = len(contents)
    print(f"[GeneratedPostsManager] Consumed variation. {remaining} remaining for {style_id}")

    if remaining == 0:
        del posts[style_id]
        print(f"[GeneratedPostsManager] All variations consumed. Entry deleted for {style_id}")
    else:
        entry["contents"] = contents
        entry["content"] = contents[0]
        posts[style_id] = entry

    with open(GENERATED_POSTS_PATH, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)

    return True
