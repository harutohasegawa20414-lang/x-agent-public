"""
engine/framework_extractor.py

ツイートテキストまたはスタイル名だけから OpenAI で
「投稿の型（フレームワーク）」を 10 個生成する。X API は一切使用しない。
"""
import json
import time
from typing import List

from openai import OpenAI
from config.settings import settings


def generate_frameworks_from_name(style_name: str) -> List[dict]:
    """
    ツイート例なし・スタイル名だけから OpenAI で 10 個のフレームワークを生成する。
    スタイル追加時の自動生成用。
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        print("[FrameworkExtractor] OpenAI API key missing.")
        return []

    prompt = f"""あなたはSNSマーケティングと文章構造の専門家です。
「{style_name}」というX（旧Twitter）アカウントの投稿スタイルを想定し、
このアカウントが使いそうな「投稿の型（フレームワーク）」を10種類考えてください。

アカウント名やキャラクターから推測できる特徴・文体・テーマを踏まえ、
バリエーション豊かな10種類を作成してください。

## 出力形式
以下の JSON 配列のみを返してください（説明文・コードブロックマーカー不要）:
[
  {{
    "name": "フレームワーク名（例: 単刀直入断言型）",
    "description": "このフレームワークの説明（1〜2文）",
    "template": "構造テンプレート（[プレースホルダー]を使い、パート間は\\n\\nで区切る）"
  }},
  ...
]
必ず10個返すこと。"""

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()

        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            print("[FrameworkExtractor] Unexpected response format.")
            return []

        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        result = []
        for i, item in enumerate(parsed[:10]):
            result.append({
                "id": f"fw_{int(time.time() * 1000) + i}",
                "name": item.get("name", f"フレームワーク{i+1}"),
                "description": item.get("description", ""),
                "template": item.get("template", ""),
                "created_at": now,
            })
        return result

    except json.JSONDecodeError as e:
        print(f"[FrameworkExtractor] JSON parse error: {e}")
        return []
    except Exception as e:
        print(f"[FrameworkExtractor] Error: {e}")
        return []


def extract_frameworks(style_name: str, tweet_text: str) -> List[dict]:
    """
    tweet_text（複数のツイートを含む生テキスト）を OpenAI に渡し、
    10 個の投稿フレームワークを抽出して返す。
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        print("[FrameworkExtractor] OpenAI API key missing.")
        return []

    prompt = f"""以下は「{style_name}」のXへの実際の投稿例です。
これらを分析し、この人物が使う「投稿の型（フレームワーク）」を10種類抽出してください。

## 投稿例
{tweet_text[:8000]}

## 出力形式
以下の JSON 配列のみを返してください（説明文・コードブロックマーカー不要）:
[
  {{
    "name": "フレームワーク名（例: 単刀直入断言型）",
    "description": "このフレームワークの説明（1〜2文）",
    "template": "構造テンプレート（[プレースホルダー]を使った構造。改行は\\nで表現）"
  }},
  ...
]
必ず10個返すこと。"""

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()

        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            print("[FrameworkExtractor] Unexpected response format.")
            return []

        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        result = []
        for i, item in enumerate(parsed[:10]):
            result.append({
                "id": f"fw_{int(time.time() * 1000) + i}",
                "name": item.get("name", f"フレームワーク{i+1}"),
                "description": item.get("description", ""),
                "template": item.get("template", ""),
                "created_at": now,
            })
        return result

    except json.JSONDecodeError as e:
        print(f"[FrameworkExtractor] JSON parse error: {e}")
        return []
    except Exception as e:
        print(f"[FrameworkExtractor] Error: {e}")
        return []
