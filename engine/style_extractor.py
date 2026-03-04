"""
engine/style_extractor.py

ツイートリストを OpenAI で分析し、tone/structure/philosophy を抽出して
styles/{style_id}.json に自動保存するモジュール。
カスタムスタイルの初回生成時のみ使用する。
"""
import json
import os
from typing import List, Optional

from openai import OpenAI
from config.settings import settings

STYLES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "styles"
)


def extract_and_save_style(style_id: str, name: str, tweets: List[str]) -> Optional[dict]:
    """
    ツイートリストを OpenAI で分析して tone/structure/philosophy を抽出し、
    styles/{style_id}.json に保存する。

    Args:
        style_id: スタイルID（ファイル名に使用）
        name: アカウント名
        tweets: 分析対象ツイートのリスト

    Returns:
        保存したスタイルデータの dict、または None（失敗時）
    """
    if not tweets:
        return None

    api_key = settings.OPENAI_API_KEY
    if not api_key:
        print("[StyleExtractor] OpenAI API key missing. Skipping style extraction.")
        return None

    tweets_text = "\n".join([f"- {t}" for t in tweets[:10]])

    prompt = f"""以下は「{name}」のXへの実際の投稿例です。
これらの投稿を分析し、このアカウントの文体・トーン・投稿スタイルを抽出してください。

## 投稿例
{tweets_text}

## 出力形式
以下のJSONフォーマットのみで返してください（説明文・コードブロックマーカーなし）:
{{
  "name": "{name}",
  "tone": {{
    "style": "（文体の特徴: provocative/casual/formal/humorous 等）",
    "sentiment": "（感情トーン: positive/negative/neutral/mixed 等）",
    "formality": "（丁寧さ: formal/informal/very_informal 等）",
    "keywords": ["（よく使うキーワード1）", "（よく使うキーワード2）"]
  }},
  "structure": {{
    "length": "（投稿の長さ: short/medium/long 等）",
    "line_breaks": "（改行の使い方: frequent/moderate/rare 等）",
    "uses_emojis": true/false,
    "uses_hashtags": true/false,
    "bullet_points": "（箇条書きの使い方: frequent/rare/never 等）"
  }},
  "philosophy": [
    "（この人物の核となる価値観・哲学1）",
    "（この人物の核となる価値観・哲学2）",
    "（この人物の核となる価値観・哲学3）"
  ]
}}"""

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        style_data = json.loads(raw)

        os.makedirs(STYLES_DIR, exist_ok=True)
        out_path = os.path.join(STYLES_DIR, f"{style_id}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(style_data, f, ensure_ascii=False, indent=2)

        print(f"[StyleExtractor] Style extracted and saved: {out_path}")
        return style_data

    except json.JSONDecodeError as e:
        print(f"[StyleExtractor] JSON parse error: {e}")
        return None
    except Exception as e:
        print(f"[StyleExtractor] Error: {e}")
        return None
