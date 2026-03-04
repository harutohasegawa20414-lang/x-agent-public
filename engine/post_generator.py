import json
import re
from typing import List
from openai import OpenAI
from config.settings import settings


def _parse_json_with_literal_newlines(raw: str) -> list:
    """
    LLMがJSON文字列値の中に実際の改行を入れてしまった場合でもパースできる。
    文字列リテラル内の改行を \\n にエスケープしてからjson.loadsする。
    """
    in_string = False
    escaped = []
    i = 0
    while i < len(raw):
        c = raw[i]
        if c == '\\' and i + 1 < len(raw):
            escaped.append(c)
            escaped.append(raw[i + 1])
            i += 2
            continue
        if c == '"':
            in_string = not in_string
        if in_string and c == '\n':
            escaped.append('\\n')
        elif in_string and c == '\r':
            pass
        else:
            escaped.append(c)
        i += 1
    return json.loads(''.join(escaped))

class PostGenerator:
    def __init__(self, model_name="gpt-4o-mini"):
        self.api_key = settings.OPENAI_API_KEY
        self.model_id = model_name

        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None

    def generate_variations(self, system_prompt: str, user_prompt: str) -> List[str]:
        """
        OpenAI API を使用して3バリエーションの投稿文を生成。
        """
        if not self.client:
            print("[WARN] OpenAI API Key is missing. Returning MOCK responses.")
            return [
                f"[MOCK VARIATION 1] Simulated post using the requested style.",
                f"[MOCK VARIATION 2] Another angle on the same topic.",
                f"[MOCK VARIATION 3] A third perspective on the theme.",
            ]

        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            raw = response.choices[0].message.content.strip()

            # JSONブロックマーカーを除去
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            # セパレーター形式でパース（===END=== 区切り）
            SEP = "===END==="
            if SEP in raw:
                parts = [p.strip() for p in raw.split(SEP) if p.strip()]
                if len(parts) >= 2:
                    return parts[:3]

            # 通常のJSONパース
            try:
                variations = json.loads(raw)
                if isinstance(variations, list) and len(variations) > 0:
                    return [str(v).strip() for v in variations if v]
            except json.JSONDecodeError:
                pass

            # 改行入りJSONのパース
            try:
                variations = _parse_json_with_literal_newlines(raw)
                if isinstance(variations, list) and len(variations) > 0:
                    return [str(v).strip() for v in variations if v]
            except (json.JSONDecodeError, Exception):
                pass

            print("[PostGenerator] parse failed, using raw text as single variation.")
            return [raw]

        except Exception as e:
            print(f"Error generating variations: {e}")
            error_msg = f"[生成エラー] APIの制限またはサーバーエラーが発生しました。時間をおいて再試行してください。\n詳細: {str(e)}"
            return [error_msg]

    def generate_post(self, system_prompt: str, user_prompt: str) -> str:
        """
        後方互換ラッパー: generate_variations() の最初の要素を返す。
        """
        variations = self.generate_variations(system_prompt, user_prompt)
        return variations[0] if variations else ""
