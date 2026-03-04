import os
import sys

# 親ディレクトリの .env を参照（APIキーの共有のみ、既存システムには変更なし）
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    from dotenv import load_dotenv
    # no.9/ → Xエージェント/ へ1階層上の .env を優先的に検索
    _no9_dir = ROOT_DIR
    _parent_dir = os.path.dirname(_no9_dir)
    env_path = (
        os.path.join(_parent_dir, ".env") if os.path.exists(os.path.join(_parent_dir, ".env"))
        else os.path.join(_no9_dir, ".env")
    )
    if os.path.exists(env_path):
        load_dotenv(env_path)
except ImportError:
    pass


class Settings:
    # OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    # X (Twitter) API - 既存の認証情報を読み取り専用で参照
    X_API_KEY = os.getenv("X_API_KEY")
    X_API_SECRET = os.getenv("X_API_SECRET")
    X_ACCESS_TOKEN = os.getenv("X_ACCESS_TOKEN")
    X_ACCESS_TOKEN_SECRET = os.getenv("X_ACCESS_TOKEN_SECRET")
    X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN")

    # Google Calendar
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN")
    GOOGLE_CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "primary")

    # Notion
    NOTION_API_TOKEN = os.getenv("NOTION_API_TOKEN")
    NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

    # LINE Notify
    LINE_NOTIFY_TOKEN = os.getenv("LINE_NOTIFY_TOKEN")

    # No.9 固有設定
    NO9_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    NO9_API_PORT = int(os.getenv("NO9_API_PORT", "8001"))


settings = Settings()
