# X-Agent バックエンド用 Dockerfile (Cloud Run)
FROM python:3.11-slim

WORKDIR /app

# 依存パッケージをインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY api/        ./api/
COPY engine/     ./engine/
COPY config/     ./config/
COPY styles/     ./styles/
COPY data/       ./data/
COPY firebase_client.py .

# Cloud Run はポート 8080 を使用
ENV PORT=8080
# 本番環境では Firebase（Firestore）を使用
ENV USE_FIREBASE=true

CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
