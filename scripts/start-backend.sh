#!/bin/bash
# バックエンド API をポート 5002 で起動
cd "$(dirname "$0")/.."
source .venv/bin/activate 2>/dev/null || true
python -m uvicorn api.main:app --host 0.0.0.0 --port 5002
