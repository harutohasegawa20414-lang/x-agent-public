"""
engine/chat_agent.py

ユーザーとの対話を通じて一次情報からコンテキストを抽出するエージェント。
"""

from openai import OpenAI
from config.settings import settings


SYSTEM_INSTRUCTION = """あなたはXの投稿生成を支援するAIアシスタントです。
ユーザーの質問や指示に基づいて、提供された一次情報（GoogleドライブやNotionのデータ）から
関連する情報を抽出・整理して回答してください。

以下のルールに従ってください：
- 提供された一次情報の範囲内で回答してください
- ユーザーが「この情報を使う」「これで生成して」などと言った場合、extracted_contextに関連テキストを含めてください
- 情報の抽出が完了した場合はextracted_contextにその内容をまとめてください
- 会話の流れを理解し、文脈に沿った回答をしてください
- 日本語で回答してください
"""


class ChatAgent:

    def __init__(self, model_name="gpt-4o-mini"):
        self.api_key = settings.OPENAI_API_KEY
        self.model_id = model_name

        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None

    def extract_info(self, user_message: str, chat_history: list, source_text: str) -> dict:
        """
        ユーザーメッセージと一次情報をもとにAIが応答・情報抽出を行う。

        Args:
            user_message: ユーザーの入力メッセージ
            chat_history: [{role: "user"|"ai", content: str}] の会話履歴
            source_text: Google Drive + Notion から取得した一次情報テキスト

        Returns:
            {ai_message: str, extracted_context: str | None}
        """
        if not self.client:
            return {
                "ai_message": "[MOCK] OpenAI APIキーが設定されていません。モック応答です。",
                "extracted_context": None,
            }

        # コンテキストを含むシステム指示を構築
        system_with_context = SYSTEM_INSTRUCTION
        if source_text:
            system_with_context += f"\n\n## 利用可能な一次情報\n\n{source_text}"

        # 会話履歴からmessagesを構築
        messages = [{"role": "system", "content": system_with_context}]
        for msg in chat_history:
            role = "user" if msg.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": msg.get("content", "")})

        # 抽出指示を付加したユーザーメッセージ
        extraction_instruction = """

回答の最後に、もしユーザーが情報の確定・使用を求めている場合は、
以下の形式で抽出したコンテキストを付加してください：

[EXTRACTED_CONTEXT_START]
（抽出した関連情報をここに記述）
[EXTRACTED_CONTEXT_END]

投稿生成に使う情報が確定していない通常の会話の場合は、このブロックは不要です。
"""
        messages.append({"role": "user", "content": user_message + extraction_instruction})

        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=messages,
            )
            full_text = response.choices[0].message.content.strip()

            # 抽出コンテキストをパース
            extracted_context = None
            if "[EXTRACTED_CONTEXT_START]" in full_text and "[EXTRACTED_CONTEXT_END]" in full_text:
                start = full_text.index("[EXTRACTED_CONTEXT_START]") + len("[EXTRACTED_CONTEXT_START]")
                end = full_text.index("[EXTRACTED_CONTEXT_END]")
                extracted_context = full_text[start:end].strip()
                ai_message = full_text[:full_text.index("[EXTRACTED_CONTEXT_START]")].strip()
            else:
                ai_message = full_text

            return {
                "ai_message": ai_message,
                "extracted_context": extracted_context,
            }

        except Exception as e:
            print(f"[ChatAgent] エラー: {e}")
            return {
                "ai_message": f"申し訳ありません、エラーが発生しました: {str(e)}",
                "extracted_context": None,
            }
