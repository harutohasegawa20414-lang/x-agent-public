import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# 権限スコープ（Google Drive への読み取り専用アクセス）
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def setup_auth():
    """
    credentials.json を使用して認証を行い、token.json を保存する。
    credentials.json は Google Cloud Console から「デスクトップアプリ」として作成・ダウンロードが必要。
    """
    creds = None
    # token.json は、以前のログインで生成されたアクセスとリフレッシュトークンを保存
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # 有効な認証情報がない場合は、ユーザーにログインしてもらう
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                print("Error: 'credentials.json' が見つかりません。")
                print("Google Cloud Console から作成して、プロジェクトのルートディレクトリに配置してください。")
                return
            
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
            
        # 次回の実行のために認証情報を保存
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    print("認証に成功しました。'token.json' が保存されました。")

if __name__ == '__main__':
    setup_auth()
