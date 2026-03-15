"""
OAuth 2.0 PKCE フローで X API のユーザーアクセストークンを取得するスクリプト。
DM Received イベントサブスクリプションに必要。

使い方:
  python scripts/get_oauth2_token.py

ブラウザが開くので、Xアカウントで認証を承認してください。
トークンは .env の X_OAUTH2_ACCESS_TOKEN / X_OAUTH2_REFRESH_TOKEN に書き込まれます。
"""

import base64
import hashlib
import http.server
import json
import os
import secrets
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser

# .env から読み込み
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(ROOT_DIR, ".env")


def _load_env():
    env = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return env


env = _load_env()
CLIENT_ID = env.get("X_OAUTH2_CLIENT_ID", "")
CLIENT_SECRET = env.get("X_OAUTH2_CLIENT_SECRET", "")
REDIRECT_URI = "http://127.0.0.1:5001/callback"
SCOPES = "dm.read dm.write users.read tweet.read offline.access"

if not CLIENT_ID or not CLIENT_SECRET:
    print("[ERROR] .env に X_OAUTH2_CLIENT_ID / X_OAUTH2_CLIENT_SECRET が設定されていません")
    sys.exit(1)

# PKCE パラメータ生成
code_verifier = secrets.token_urlsafe(64)[:128]
code_challenge = (
    base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest())
    .rstrip(b"=")
    .decode()
)
state = secrets.token_urlsafe(16)

# 認証URL構築
auth_params = urllib.parse.urlencode({
    "response_type": "code",
    "client_id": CLIENT_ID,
    "redirect_uri": REDIRECT_URI,
    "scope": SCOPES,
    "state": state,
    "code_challenge": code_challenge,
    "code_challenge_method": "S256",
})
auth_url = f"https://twitter.com/i/oauth2/authorize?{auth_params}"

# コールバック受信用サーバー
received_code = None
server_ready = threading.Event()


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global received_code
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/callback":
            params = urllib.parse.parse_qs(parsed.query)
            if params.get("state", [None])[0] != state:
                self.send_response(400)
                self.end_headers()
                self.wfile.write("State mismatch".encode())
                return

            received_code = params.get("code", [None])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                "<html><body><h2>認証完了！このタブを閉じてください。</h2></body></html>".encode()
            )
            threading.Thread(target=self.server.shutdown, daemon=True).start()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # ログ抑制


def run_server():
    server = http.server.HTTPServer(("127.0.0.1", 5001), CallbackHandler)
    server_ready.set()
    server.serve_forever()


# サーバー起動 → ブラウザ起動
print("コールバックサーバーを起動中...")
server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
server_ready.wait()

print(f"ブラウザで認証ページを開きます...")
print(f"  URL: {auth_url[:80]}...")
webbrowser.open(auth_url)
print("ブラウザで認証を承認してください。待機中...")

server_thread.join(timeout=120)

if not received_code:
    print("[ERROR] 認証コードを受信できませんでした（タイムアウト）")
    sys.exit(1)

print(f"認証コード取得成功。トークンを交換中...")

# トークン交換
token_data = urllib.parse.urlencode({
    "grant_type": "authorization_code",
    "code": received_code,
    "redirect_uri": REDIRECT_URI,
    "code_verifier": code_verifier,
    "client_id": CLIENT_ID,
}).encode()

credentials = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
req = urllib.request.Request(
    "https://api.twitter.com/2/oauth2/token",
    data=token_data,
    headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {credentials}",
    },
)

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        token_response = json.loads(resp.read())
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"[ERROR] トークン交換失敗: {e.code} {body}")
    sys.exit(1)

access_token = token_response.get("access_token", "")
refresh_token = token_response.get("refresh_token", "")
expires_in = token_response.get("expires_in", 0)
scope = token_response.get("scope", "")

print(f"トークン取得成功！")
print(f"  スコープ: {scope}")
print(f"  有効期限: {expires_in}秒")

# .env に書き込み
with open(ENV_PATH, "r") as f:
    env_content = f.read()

# 既存のトークン行を削除してから追加
new_lines = []
for line in env_content.split("\n"):
    if line.strip().startswith("X_OAUTH2_ACCESS_TOKEN=") or line.strip().startswith("X_OAUTH2_REFRESH_TOKEN="):
        continue
    new_lines.append(line)

# CLIENT_SECRET の直後にトークンを追加
final_lines = []
for line in new_lines:
    final_lines.append(line)
    if line.strip().startswith("X_OAUTH2_CLIENT_SECRET="):
        final_lines.append(f"X_OAUTH2_ACCESS_TOKEN={access_token}")
        if refresh_token:
            final_lines.append(f"X_OAUTH2_REFRESH_TOKEN={refresh_token}")

with open(ENV_PATH, "w") as f:
    f.write("\n".join(final_lines))

print(f".env にトークンを保存しました。")
print("完了！イベントサブスクリプションの作成を再度試してください。")
