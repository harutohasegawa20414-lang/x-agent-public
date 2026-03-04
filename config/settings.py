import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    # X (Twitter) API
    X_API_KEY = os.getenv("X_API_KEY")
    X_API_SECRET = os.getenv("X_API_SECRET")
    X_ACCESS_TOKEN = os.getenv("X_ACCESS_TOKEN")
    X_ACCESS_TOKEN_SECRET = os.getenv("X_ACCESS_TOKEN_SECRET")
    # Google Drive
    GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
    # Notion
    NOTION_API_TOKEN = os.getenv("NOTION_API_TOKEN")
    NOTION_PAGE_IDS = os.getenv("NOTION_PAGE_IDS")  # カンマ区切り
    NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

settings = Settings()
