#!/bin/bash
# バックエンド＋ダッシュボードを一括起動するスクリプト

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== X エージェント 起動中 ==="

# ── 既存プロセスをクリア ──────────────────────────
for PORT in 5001 5002; do
    PIDS=$(lsof -ti:$PORT 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "Port $PORT: 既存プロセス ($PIDS) を終了します..."
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
done

# ── バックエンド起動 ──────────────────────────────
echo "バックエンドを起動中 (port 5002)..."
cd "$ROOT"
source .venv/bin/activate 2>/dev/null || true
PYTHONUNBUFFERED=1 python -m uvicorn api.main:app --host 0.0.0.0 --port 5002 > "$ROOT/backend.log" 2>&1 &
BACKEND_PID=$!

# ── バックエンド起動待機（最大15秒）─────────────────
echo "バックエンドの準備を待機中..."
READY=false
for i in $(seq 1 30); do
    if curl -s http://localhost:5002/api/styles > /dev/null 2>&1; then
        READY=true
        break
    fi
    sleep 0.5
done

if [ "$READY" = false ]; then
    echo "⚠ バックエンドの起動に時間がかかっています。ログを確認してください: $ROOT/backend.log"
else
    echo "✓ バックエンド起動完了"
fi

# ── フロントエンド起動 ────────────────────────────
echo "ダッシュボードを起動中 (port 5001)..."
cd "$ROOT/dashboard"
npm run dev > "$ROOT/frontend.log" 2>&1 &
FRONTEND_PID=$!

# ── フロントエンド起動待機（最大10秒）───────────
for i in $(seq 1 20); do
    if curl -s http://localhost:5001 > /dev/null 2>&1; then
        break
    fi
    sleep 0.5
done
echo "ブラウザを開きます: http://localhost:5001"
open http://localhost:5001

echo ""
echo "=== 起動完了 ==="
echo "  ダッシュボード: http://localhost:5001"
echo "  バックエンド:   http://localhost:5002"
echo "  ログ: backend.log / frontend.log"
echo ""
echo "停止するには Ctrl+C を押してください"

# ── Ctrl+C で両プロセスを終了 ────────────────────
trap "echo '停止中...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait $BACKEND_PID $FRONTEND_PID
