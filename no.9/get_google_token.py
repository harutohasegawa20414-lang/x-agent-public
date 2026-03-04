"""
Google Calendar の Refresh Token を取得するスクリプト。
一度だけ実行すれば OK。取得した token を .env に貼り付ける。

実行方法:
  cd no.9
  python3 get_google_token.py
"""

import os
import sys

# .env を読み込む
try:
    from dotenv import load_dotenv
    parent = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(parent, ".env"))
except ImportError:
    pass

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: .env に GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が設定されていません")
    sys.exit(1)

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    print("ERROR: google-auth-oauthlib が必要です")
    print("  pip3 install google-auth-oauthlib")
    sys.exit(1)

SCOPES = ["https://www.googleapis.com/auth/calendar"]

client_config = {
    "installed": {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
    }
}

print("ブラウザが開きます。Googleにログインして許可してください。")
print()

flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
creds = flow.run_local_server(port=0)

print()
print("=" * 60)
print("取得成功！以下を .env に追加してください：")
print("=" * 60)
print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
print(f"GOOGLE_CALENDAR_ID=primary")
print("=" * 60)
