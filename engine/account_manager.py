import json
import os
import sys

ACCOUNTS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "accounts.json"
)

# Firebase共有クライアントをインポート
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
try:
    from firebase_client import load_doc, save_doc
    _FIREBASE_IMPORTED = True
except ImportError:
    _FIREBASE_IMPORTED = False

_FS_KEY = "xagent_accounts"


def _default_data() -> dict:
    """デフォルトのアカウントデータを生成（.envから読み込む）"""
    from config.settings import settings
    return {
        "current": "default",
        "accounts": [
            {
                "id": "default",
                "name": "株式会社からもん 公式",
                "x_api_key": settings.X_API_KEY or "",
                "x_api_secret": settings.X_API_SECRET or "",
                "x_access_token": settings.X_ACCESS_TOKEN or "",
                "x_access_token_secret": settings.X_ACCESS_TOKEN_SECRET or "",
            }
        ],
    }


def load_data() -> dict:
    """アカウントデータを読み込む。なければデフォルトを作成して返す。"""
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY)
        if result is not None:
            return result
    if not os.path.exists(ACCOUNTS_PATH):
        data = _default_data()
        save_data(data)
        return data
    try:
        with open(ACCOUNTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return _default_data()


def save_data(data: dict):
    if _FIREBASE_IMPORTED:
        save_doc(_FS_KEY, data)
    os.makedirs(os.path.dirname(ACCOUNTS_PATH), exist_ok=True)
    with open(ACCOUNTS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_accounts() -> list:
    """アカウント一覧を返す（APIキーは除く）"""
    data = load_data()
    current_id = data.get("current")
    result = []
    for a in data.get("accounts", []):
        result.append({
            "id": a["id"],
            "name": a["name"],
            "is_current": a["id"] == current_id,
        })
    return result


def get_current_account() -> dict | None:
    """現在選択中のアカウント情報（APIキー含む）を返す"""
    data = load_data()
    current_id = data.get("current")
    for a in data.get("accounts", []):
        if a["id"] == current_id:
            return a
    # fallback: 最初のアカウント
    accounts = data.get("accounts", [])
    return accounts[0] if accounts else None


def switch_account(account_id: str) -> bool:
    """指定IDのアカウントに切り替える"""
    data = load_data()
    ids = [a["id"] for a in data.get("accounts", [])]
    if account_id not in ids:
        return False
    data["current"] = account_id
    save_data(data)
    return True


def add_account(account_id: str, name: str, x_api_key: str, x_api_secret: str,
                x_access_token: str, x_access_token_secret: str) -> dict:
    """新しいアカウントを追加する。同じIDが既に存在する場合は情報を更新して返す。"""
    data = load_data()
    # 既存IDの場合は情報を更新して返す（X-AgentとNo.9で同じアカウントを登録可能にする）
    for account in data.get("accounts", []):
        if account["id"] == account_id:
            account["name"] = name
            if (x_api_key or "").strip():
                account["x_api_key"] = x_api_key.strip()
            if (x_api_secret or "").strip():
                account["x_api_secret"] = x_api_secret.strip()
            if (x_access_token or "").strip():
                account["x_access_token"] = x_access_token.strip()
            if (x_access_token_secret or "").strip():
                account["x_access_token_secret"] = x_access_token_secret.strip()
            save_data(data)
            is_current = data.get("current") == account_id
            return {"id": account_id, "name": name, "is_current": is_current}
    new_account = {
        "id": account_id,
        "name": name,
        "x_api_key": x_api_key,
        "x_api_secret": x_api_secret,
        "x_access_token": x_access_token,
        "x_access_token_secret": x_access_token_secret,
    }
    data["accounts"].append(new_account)
    # 初回アカウント or current が未設定なら自動で current に設定
    if not data.get("current"):
        data["current"] = account_id
    is_current = data["current"] == account_id
    save_data(data)
    return {"id": account_id, "name": name, "is_current": is_current}


def edit_account(account_id: str, name: str, x_api_key: str, x_api_secret: str,
                 x_access_token: str, x_access_token_secret: str) -> bool:
    """既存のアカウント情報を更新する。空文字の認証情報は「変更しない」として既存値を維持する。"""
    data = load_data()
    for account in data.get("accounts", []):
        if account["id"] == account_id:
            account["name"] = name
            if (x_api_key or "").strip():
                account["x_api_key"] = x_api_key.strip()
            if (x_api_secret or "").strip():
                account["x_api_secret"] = x_api_secret.strip()
            if (x_access_token or "").strip():
                account["x_access_token"] = x_access_token.strip()
            if (x_access_token_secret or "").strip():
                account["x_access_token_secret"] = x_access_token_secret.strip()
            save_data(data)
            return True
    return False

def delete_account(account_id: str) -> bool:
    """アカウントを削除する。現在のアカウントの場合は別のアカウントに自動切り替え。
    関連データ（スタイル、フレームワーク、投稿履歴、DM履歴等）もすべて削除する。"""
    data = load_data()
    # 対象アカウントが存在するか確認
    if not any(a["id"] == account_id for a in data.get("accounts", [])):
        return False
    data["accounts"] = [a for a in data["accounts"] if a["id"] != account_id]
    # 削除したのが現在のアカウントなら別のアカウントに切り替え
    if data.get("current") == account_id:
        data["current"] = data["accounts"][0]["id"] if data["accounts"] else None
    save_data(data)

    # 関連データをすべて削除
    _cascade_delete_related_data()
    return True


def _cascade_delete_related_data():
    """アカウント削除時に関連データをすべてクリアする"""
    # --- X-Agent 側 ---
    try:
        from engine.style_loader import save_custom_styles, STYLE_USERNAMES_PATH
        save_custom_styles([])
        # style_usernames もクリア
        if _FIREBASE_IMPORTED:
            save_doc("xagent_style_usernames", {})
        if os.path.exists(STYLE_USERNAMES_PATH):
            with open(STYLE_USERNAMES_PATH, "w", encoding="utf-8") as f:
                json.dump({}, f)
    except Exception:
        pass

    try:
        from engine.frameworks_manager import _save_all
        _save_all({})
    except Exception:
        pass

    try:
        gp_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               "data", "generated_posts.json")
        if _FIREBASE_IMPORTED:
            save_doc("xagent_generated_posts", {})
        if os.path.exists(gp_path):
            with open(gp_path, "w", encoding="utf-8") as f:
                json.dump({}, f)
    except Exception:
        pass

    try:
        from engine.history_manager import _FS_KEY as hist_key, HISTORY_PATH
        if _FIREBASE_IMPORTED:
            save_doc(hist_key, [])
        if os.path.exists(HISTORY_PATH):
            with open(HISTORY_PATH, "w", encoding="utf-8") as f:
                json.dump([], f)
    except Exception:
        pass

    try:
        sched_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                  "data", "schedule_config.json")
        empty_config = {"enabled": True, "jobs": []}
        if _FIREBASE_IMPORTED:
            save_doc("xagent_schedule_config", empty_config)
        if os.path.exists(sched_path):
            with open(sched_path, "w", encoding="utf-8") as f:
                json.dump(empty_config, f)
    except Exception:
        pass

    # --- No.9 側 ---
    _no9_data = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                             "no.9", "data")

    _no9_clear_targets = [
        ("dm_history.json", "no9_dm_history", []),
        ("replies.json", "no9_replies", []),
        ("categories.json", "no9_categories", []),
        ("targets.json", "no9_targets", []),
        ("dm_templates.json", "no9_dm_templates", []),
        ("poll_status.json", "no9_poll_status", {}),
    ]
    for filename, fs_key, empty_val in _no9_clear_targets:
        try:
            filepath = os.path.join(_no9_data, filename)
            if _FIREBASE_IMPORTED:
                save_doc(fs_key, empty_val)
            if os.path.exists(filepath):
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(empty_val, f)
        except Exception:
            pass
