#!/bin/bash
##############################################################
# deploy.sh - 本番デプロイ用ビルド＆起動スクリプト
#
# 使い方:
#   bash scripts/deploy.sh
#
# このスクリプトがやること:
#   1. pip パッケージをインストール
#   2. フロントエンドをビルド (npm run build)
#   3. X-Agent バックエンド (port 5002) を起動
#   4. No.9 バックエンド (port 5003) を起動
#   5. nginx で静的ファイルを配信 + API プロキシ
##############################################################

set -e  # エラーで即停止

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== デプロイ開始: $ROOT ==="

# ── 1. Pythonパッケージインストール ──────────────────────
echo "[1/4] Pythonパッケージをインストール中..."
cd "$ROOT"
pip install -r requirements.txt --quiet
pip install -r no.9/requirements.txt --quiet
echo "✓ Pythonパッケージ完了"

# ── 2. フロントエンドビルド ──────────────────────────────
echo "[2/4] フロントエンドをビルド中 (dashboard → dist/)..."
cd "$ROOT/dashboard"
npm install --silent
npm run build
echo "✓ フロントエンドビルド完了 → dashboard/dist/"

# ── 3. 既存プロセスをクリア ──────────────────────────────
echo "[3/4] 既存のバックエンドプロセスを停止中..."
for PORT in 5002 5003; do
    PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "  Port $PORT: プロセス($PIDS)を終了"
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
done

# ── 4. バックエンド起動 ──────────────────────────────────
echo "[4/4] バックエンドを起動中..."
cd "$ROOT"

# X-Agent バックエンド (port 5002)
PYTHONUNBUFFERED=1 python -m uvicorn api.main:app \
    --host 0.0.0.0 --port 5002 \
    > "$ROOT/backend.log" 2>&1 &
BACKEND_PID=$!
echo "  X-Agent バックエンド起動 (PID: $BACKEND_PID, port: 5002)"

# No.9 バックエンド (port 5003)
cd "$ROOT/no.9"
PYTHONUNBUFFERED=1 python -m uvicorn api.main:app \
    --host 0.0.0.0 --port 5003 \
    > "$ROOT/no9-backend.log" 2>&1 &
NO9_PID=$!
echo "  No.9 バックエンド起動 (PID: $NO9_PID, port: 5003)"

# ── バックエンド起動待機 ─────────────────────────────────
echo "バックエンドの準備を待機中..."
for i in $(seq 1 30); do
    if curl -s http://localhost:5002/api/styles > /dev/null 2>&1; then
        echo "✓ X-Agent バックエンド起動完了"
        break
    fi
    sleep 0.5
done

for i in $(seq 1 20); do
    if curl -s http://localhost:5003/health > /dev/null 2>&1; then
        echo "✓ No.9 バックエンド起動完了"
        break
    fi
    sleep 0.5
done

echo ""
echo "=== デプロイ完了 ==="
echo ""
echo "【nginx を設定する場合】"
echo "  sudo cp $ROOT/scripts/nginx.conf /etc/nginx/sites-available/x-agent"
echo "  # nginx.conf 内の root パスをサーバーの実際のパスに編集してください"
echo "  sudo ln -sf /etc/nginx/sites-available/x-agent /etc/nginx/sites-enabled/"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo "  → ブラウザでサーバーIPにアクセスすると統合ダッシュボードが表示されます"
echo ""
echo "ログ:"
echo "  X-Agent: $ROOT/backend.log"
echo "  No.9:    $ROOT/no9-backend.log"
echo ""
echo "停止するには: kill $BACKEND_PID $NO9_PID"
