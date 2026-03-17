"""
firebase_client.py

Firebase Admin SDK 共有クライアント（X Agent + No.9 両システムで共有）。

環境変数 USE_FIREBASE で制御:
  - USE_FIREBASE=true  → Firestore を使用（本番環境）
  - USE_FIREBASE=false  → ローカルファイルのみ使用（ローカル開発環境、デフォルト）

本番での接続優先順位:
  1. FIREBASE_CREDENTIALS_JSON 環境変数にパスが設定されている場合 → サービスアカウントJSONで認証
  2. パス未設定または該当ファイルが存在しない場合 → ADC（Application Default Credentials）で認証
     （Cloud Run / GCE 環境では自動的にメタデータサーバーを使用）
  3. 上記すべて失敗の場合 → NoOp（既存のローカルJSONにフォールバック）

データはJSON文字列としてFirestoreに保存することで、Firestoreのフィールド名制限を回避する。
"""

import os
import json as _json

try:
    import firebase_admin
    from firebase_admin import credentials, firestore as _firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False

_db = None
_initialized = False


def _is_firebase_enabled() -> bool:
    """USE_FIREBASE 環境変数で Firebase の使用可否を判定する。デフォルトは無効。"""
    return os.getenv("USE_FIREBASE", "false").lower() in ("true", "1", "yes")


def get_db():
    """Firestoreクライアントを返す。未設定・未インストール・USE_FIREBASE=false の場合はNoneを返す。"""
    global _db, _initialized
    if _initialized:
        return _db
    _initialized = True

    if not _is_firebase_enabled():
        print("[Firebase] USE_FIREBASE=false のためスキップ（ローカルファイルを使用）")
        return None

    if not FIREBASE_AVAILABLE:
        return None

    try:
        if not firebase_admin._apps:
            creds_path = os.getenv("FIREBASE_CREDENTIALS_JSON", "").strip()
            if creds_path and os.path.exists(creds_path):
                cred = credentials.Certificate(creds_path)
            else:
                if creds_path:
                    print(f"[Firebase] 認証ファイルが見つかりません: {creds_path} → ADCにフォールバック")
                cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
        _db = _firestore.client()
        print("[Firebase] Firestore接続成功")
    except Exception as e:
        print(f"[Firebase] 初期化失敗: {e}")
        _db = None

    return _db


def load_doc(key: str):
    """
    Firestoreドキュメントを読み込む。
    Collection: app_data / Document: {key}
    存在しない・Firebase未設定の場合はNoneを返す。

    データはJSON文字列（data_json フィールド）として保存されている。
    """
    db = get_db()
    if db is None:
        return None
    try:
        doc = db.collection("app_data").document(key).get()
        if doc.exists:
            raw = doc.to_dict().get("data_json")
            if raw is not None:
                return _json.loads(raw)
    except Exception as e:
        print(f"[Firebase] load_doc({key}) 失敗: {e}")
    return None


def save_doc(key: str, data) -> bool:
    """
    Firestoreドキュメントに書き込む。
    データはJSON文字列として保存し、Firestoreのフィールド名制限（__xxx__等）を回避する。
    成功すればTrue、Firebase未設定または失敗の場合はFalseを返す。
    """
    db = get_db()
    if db is None:
        return False
    try:
        db.collection("app_data").document(key).set({"data_json": _json.dumps(data, ensure_ascii=False)})
        return True
    except Exception as e:
        print(f"[Firebase] save_doc({key}) 失敗: {e}")
        return False
