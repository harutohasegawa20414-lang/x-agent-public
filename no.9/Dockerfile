# No.9 バックエンド用 Dockerfile (Cloud Run)
# ビルドコンテキストは プロジェクトルート(Xエージェント/)で実行すること:
#   docker build -f no.9/Dockerfile .

FROM python:3.11-slim

WORKDIR /app

# 依存パッケージをインストール
COPY no.9/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY no.9/api/      ./api/
COPY no.9/engine/   ./engine/
COPY no.9/config/   ./config/
COPY no.9/data/     ./data/
COPY firebase_client.py .

# 共有モジュール（account_manager等）とデータ
COPY engine/        ./shared_engine/
COPY config/        ./shared_config/
COPY data/          ./shared_data/

# Cloud Run はポート 8080 を使用
ENV PORT=8080
# 本番環境では Firebase（Firestore）を使用
ENV USE_FIREBASE=true

CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
