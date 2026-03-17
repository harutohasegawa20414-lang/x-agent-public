#!/bin/bash
##############################################################
# deploy-firebase.sh
#
# Firebase Hosting + Cloud Run へ一括デプロイ
#
# 前提条件:
#   - firebase login 済み
#   - gcloud auth login 済み
#   - .firebaserc の default に正しいプロジェクトIDが設定済み
#   - .env に FIREBASE_CREDENTIALS_JSON が設定済み
#
# 使い方:
#   bash scripts/deploy-firebase.sh YOUR_PROJECT_ID
##############################################################

set -e

PROJECT_ID="${1:-$(cat .firebaserc 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['projects']['default'])" 2>/dev/null)}"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "YOUR_FIREBASE_PROJECT_ID" ]; then
    echo "❌ Firebase プロジェクトIDを指定してください"
    echo "   使い方: bash scripts/deploy-firebase.sh YOUR_PROJECT_ID"
    exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="asia-northeast1"

echo "=== Firebase デプロイ開始 ==="
echo "  プロジェクト: $PROJECT_ID"
echo "  リージョン:   $REGION"
echo ""

# ── 0. Cloud Run サービスアカウントに Firestore 権限を付与 ──
# Cloud Run のデフォルトSAが Firestore に ADC でアクセスできるよう設定
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null)
if [ -n "$PROJECT_NUMBER" ]; then
    CR_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${CR_SA}" \
        --role="roles/datastore.user" \
        --quiet 2>/dev/null || true
    echo "[0/5] Cloud Run SA に Firestore 権限を付与完了 (${CR_SA})"
else
    echo "[0/5] プロジェクト番号取得失敗 - Firestore権限は手動で付与してください"
fi

# ── 1. プロジェクトID を .firebaserc に書き込む ──────────
sed -i.bak "s/YOUR_FIREBASE_PROJECT_ID/$PROJECT_ID/g" "$ROOT/.firebaserc"
echo "[1/5] .firebaserc 更新完了"

# ── 2. フロントエンドビルド ──────────────────────────────
echo "[2/5] フロントエンドをビルド中..."
cd "$ROOT/dashboard"
npm install --silent
# .env から VITE_API_KEY を取得してビルド時に埋め込む
VITE_API_KEY="$(grep '^VITE_API_KEY=' "$ROOT/.env" | cut -d'=' -f2-)" npm run build
echo "✓ dashboard/dist/ ビルド完了"

# Cloud Run に渡す環境変数ファイルを生成（YAML形式）
# --set-env-vars はカンマ区切りのためALLOWED_ORIGINSのカンマと衝突する
# → --env-vars-file (YAML) を使用して安全に渡す
_ENV_VARS_FILE="$ROOT/.cloud-env-vars.yaml"
python3 -c "
with open('$ROOT/.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('FIREBASE_CREDENTIALS_JSON=') or line.startswith('VITE_'):
            continue
        key, _, value = line.partition('=')
        # YAML値としてクォート
        value = value.replace('\\\\', '\\\\\\\\').replace('\"', '\\\\\"')
        print(f'{key}: \"{value}\"')
" > "$_ENV_VARS_FILE"

# ── 3. X-Agent を Cloud Run にデプロイ ───────────────────
echo "[3/5] X-Agent API を Cloud Run にデプロイ中..."
cd "$ROOT"
gcloud run deploy x-agent-api \
    --source . \
    --platform managed \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --allow-unauthenticated \
    --env-vars-file "$_ENV_VARS_FILE"
echo "✓ X-Agent API デプロイ完了"

# ── 4. No.9 を Cloud Run にデプロイ ─────────────────────
echo "[4/5] No.9 API を Cloud Run にデプロイ中..."
# No.9はno.9/Dockerfileを使うため、一時的にルートにコピーしてビルド
cp "$ROOT/Dockerfile" "$ROOT/Dockerfile.xagent.bak"
cp "$ROOT/no.9/Dockerfile" "$ROOT/Dockerfile"
gcloud run deploy no9-api \
    --source . \
    --platform managed \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --allow-unauthenticated \
    --env-vars-file "$_ENV_VARS_FILE"
# Dockerfileを元に戻す
mv "$ROOT/Dockerfile.xagent.bak" "$ROOT/Dockerfile"
echo "✓ No.9 API デプロイ完了"

# 一時ファイル削除
rm -f "$_ENV_VARS_FILE"

# ── 5. Firebase Hosting にデプロイ ──────────────────────
echo "[5/5] Firebase Hosting にデプロイ中..."
firebase deploy --only hosting --project "$PROJECT_ID"
echo "✓ Firebase Hosting デプロイ完了"

echo ""
echo "=== デプロイ完了 ==="
echo "  URL: https://$PROJECT_ID.web.app"
echo ""
echo "バックエンドURLの確認:"
echo "  gcloud run services list --region $REGION --project $PROJECT_ID"
