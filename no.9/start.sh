#!/bin/bash
# X営業入口最適化システム (No.9) 起動スクリプト
# 既存のXエージェントとは独立して動作します

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  X営業入口最適化システム (No.9)"
echo "  バックエンド: http://localhost:8001"
echo "  フロントエンド: http://localhost:8002"
echo "========================================"

# バックエンド起動（バックグラウンド）
echo "[1/2] バックエンド起動中..."
cd "$SCRIPT_DIR"
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload > "$SCRIPT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "バックエンド PID: $BACKEND_PID"

# フロントエンド起動
echo "[2/2] フロントエンド起動中..."
cd "$SCRIPT_DIR/dashboard"
if [ ! -d "node_modules" ]; then
    echo "依存関係をインストール中..."
    npm install
fi
npm run dev

# フロントエンド終了時にバックエンドも停止
echo "シャットダウン中..."
kill $BACKEND_PID 2>/dev/null
