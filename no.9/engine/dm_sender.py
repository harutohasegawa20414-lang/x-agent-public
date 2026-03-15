"""
engine/dm_sender.py

DM送信制御・安全管理モジュール。
凍結リスク最小化・送信制限・異常検知を担当。
"""

import json
import os
import sys
import uuid
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional

try:
    import tweepy
    TWEEPY_AVAILABLE = True
except ImportError:
    TWEEPY_AVAILABLE = False

NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(NO9_DIR, "data")
DM_HISTORY_PATH = os.path.join(DATA_DIR, "dm_history.json")
SEND_CONFIG_PATH = os.path.join(DATA_DIR, "send_config.json")

# Firebase共有クライアントをインポート（プロジェクトルート経由）
_ROOT = os.path.dirname(NO9_DIR)  # Xエージェント/
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
try:
    from firebase_client import load_doc, save_doc
    _FIREBASE_IMPORTED = True
except ImportError:
    _FIREBASE_IMPORTED = False

_FS_KEY_HISTORY = "no9_dm_history"
_FS_KEY_CONFIG = "no9_send_config"

DEFAULT_CONFIG = {
    "daily_limit": 20,
    "per_category_daily_limit": 10,
    "min_interval_seconds": 120,
    "max_interval_seconds": 600,
    "enabled": True,
    "emergency_stop": False,
    "auto_send_enabled": False,
    "auto_send_categories": [],  # 空リスト = 有効な全カテゴリが対象
}


def _load_dm_history() -> List[Dict]:
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY_HISTORY)
        if result is not None:
            return result
    if not os.path.exists(DM_HISTORY_PATH):
        return []
    with open(DM_HISTORY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_dm_history(history: List[Dict]):
    if _FIREBASE_IMPORTED:
        save_doc(_FS_KEY_HISTORY, history)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DM_HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def load_send_config() -> Dict:
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY_CONFIG)
        if result is not None:
            return {**DEFAULT_CONFIG, **result}
    if not os.path.exists(SEND_CONFIG_PATH):
        return DEFAULT_CONFIG.copy()
    with open(SEND_CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)
    return {**DEFAULT_CONFIG, **config}


def save_send_config(config: Dict):
    if _FIREBASE_IMPORTED:
        save_doc(_FS_KEY_CONFIG, config)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SEND_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def get_today_send_count(category_id: str = None) -> int:
    """今日の送信数を取得"""
    history = _load_dm_history()
    today = datetime.now().date().isoformat()
    count = 0
    for entry in history:
        if entry.get("sent_at", "").startswith(today) and entry.get("status") == "sent":
            if category_id is None or entry.get("category_id") == category_id:
                count += 1
    return count


def check_already_sent(user_id: str) -> bool:
    """同一ユーザーへの送信済みチェック"""
    history = _load_dm_history()
    return any(
        entry.get("user_id") == user_id and entry.get("status") == "sent"
        for entry in history
    )


def can_send(category_id: str = None, category_limit_override: int = None) -> Dict:
    """送信可能かどうかチェック。category_limit_override を指定するとカテゴリ上限を上書きする。"""
    config = load_send_config()

    if config.get("emergency_stop"):
        return {"can_send": False, "reason": "緊急停止中"}

    if not config.get("enabled"):
        return {"can_send": False, "reason": "送信無効化中"}

    # ── 送信間隔チェック（Fix 1）──
    next_allowed_at = config.get("next_allowed_at")
    if next_allowed_at:
        try:
            remaining = (datetime.fromisoformat(next_allowed_at) - datetime.now()).total_seconds()
            if remaining > 0:
                return {
                    "can_send": False,
                    "reason": f"送信間隔制限中（あと {int(remaining)} 秒）",
                    "wait_seconds": int(remaining),
                    "next_allowed_at": next_allowed_at,
                }
        except Exception:
            pass

    total_today = get_today_send_count()
    if total_today >= config["daily_limit"]:
        return {"can_send": False, "reason": f"日次送信上限 ({config['daily_limit']}) に到達"}

    if category_id:
        cat_today = get_today_send_count(category_id)
        effective_limit = category_limit_override if category_limit_override is not None else config["per_category_daily_limit"]
        if cat_today >= effective_limit:
            label = f"テストモード上限 ({effective_limit})" if category_limit_override is not None else f"カテゴリ別送信上限 ({effective_limit})"
            return {"can_send": False, "reason": f"{label} に到達"}

    return {"can_send": True, "today_count": total_today, "daily_limit": config["daily_limit"]}


def record_dm(
    user_id: str,
    username: str,
    category_id: str,
    target_id: str,
    dm_text: str,
    status: str = "sent",
    error_msg: str = None,
) -> Dict:
    """DM送信履歴を記録"""
    history = _load_dm_history()
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "username": username,
        "category_id": category_id,
        "target_id": target_id,
        "dm_text": dm_text,
        "status": status,  # sent / failed / mock
        "error_msg": error_msg,
        "sent_at": datetime.now().isoformat(),
    }
    history.append(entry)
    _save_dm_history(history)
    return entry


def send_dm(
    user_id: str,
    username: str,
    dm_text: str,
    category_id: str,
    target_id: str,
    api_key: str = None,
    api_secret: str = None,
    access_token: str = None,
    access_token_secret: str = None,
    category_limit_override: int = None,
) -> Dict:
    """
    DMを送信する。APIキーがない場合はモック送信。
    category_limit_override はテストモード時のカテゴリ上限として使用。
    """
    config = load_send_config()

    # 送信可否チェック
    check = can_send(category_id, category_limit_override)
    if not check["can_send"]:
        return {"success": False, "reason": check["reason"]}

    # 重複送信チェック
    if check_already_sent(user_id):
        return {"success": False, "reason": "既に送信済みのユーザー"}

    # APIキーなし → モック
    if not TWEEPY_AVAILABLE or not all([api_key, api_secret, access_token, access_token_secret]):
        print(f"[MOCK DM] @{username}: {dm_text[:50]}...")
        entry = record_dm(user_id, username, category_id, target_id, dm_text, status="mock")
        _update_interval()  # モック送信でも間隔を記録
        return {"success": True, "mock": True, "entry": entry}

    try:
        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )
        client.create_direct_message(participant_id=user_id, text=dm_text)
        entry = record_dm(user_id, username, category_id, target_id, dm_text, status="sent")
        _update_interval()  # ── 送信成功後に次回許可時刻を設定（Fix 1）
        return {"success": True, "mock": False, "entry": entry}

    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] DM send failed to @{username}: {error_msg}")
        entry = record_dm(user_id, username, category_id, target_id, dm_text, status="failed", error_msg=error_msg)

        # 異常検知: 凍結・制限関連エラー
        if any(kw in error_msg.lower() for kw in ["suspend", "limit", "forbidden", "unauthorized"]):
            emergency_stop()

        return {"success": False, "error": error_msg, "entry": entry}


def _update_interval():
    """送信後に次回許可時刻をランダム間隔で設定する（Fix 1）"""
    config = load_send_config()
    interval = get_random_interval()
    config["last_sent_at"] = datetime.now().isoformat()
    config["next_allowed_at"] = (datetime.now() + timedelta(seconds=interval)).isoformat()
    config["last_interval_seconds"] = round(interval)
    save_send_config(config)


def get_send_interval_status() -> Dict:
    """現在の送信間隔状況を返す"""
    config = load_send_config()
    next_allowed_at = config.get("next_allowed_at")
    last_sent_at = config.get("last_sent_at")
    if next_allowed_at:
        try:
            remaining = (datetime.fromisoformat(next_allowed_at) - datetime.now()).total_seconds()
            remaining = max(0, int(remaining))
        except Exception:
            remaining = 0
    else:
        remaining = 0
    return {
        "last_sent_at": last_sent_at,
        "next_allowed_at": next_allowed_at,
        "wait_seconds": remaining,
        "last_interval_seconds": config.get("last_interval_seconds"),
        "can_send_now": remaining == 0,
    }


def emergency_stop():
    """全送信を緊急停止"""
    config = load_send_config()
    config["emergency_stop"] = True
    save_send_config(config)
    print("[ALERT] 緊急停止が発動されました。手動で解除してください。")


def resume_sending():
    """緊急停止を解除"""
    config = load_send_config()
    config["emergency_stop"] = False
    save_send_config(config)


def get_random_interval() -> float:
    """ランダム送信間隔（秒）を返す"""
    config = load_send_config()
    return random.uniform(
        config.get("min_interval_seconds", 120),
        config.get("max_interval_seconds", 600),
    )


def list_dm_history(
    category_id: str = None,
    status: str = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict]:
    history = _load_dm_history()
    if category_id:
        history = [h for h in history if h.get("category_id") == category_id]
    if status:
        history = [h for h in history if h.get("status") == status]
    history.sort(key=lambda x: x.get("sent_at", ""), reverse=True)
    return history[offset: offset + limit]


def _load_replies_for_health() -> List[Dict]:
    """健全度チェック用に返信データを読み込む（循環インポート回避のためインライン定義）"""
    if _FIREBASE_IMPORTED:
        result = load_doc("no9_replies")
        if result is not None:
            return result
    replies_path = os.path.join(DATA_DIR, "replies.json")
    if not os.path.exists(replies_path):
        return []
    with open(replies_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_health_score() -> Dict:
    """アカウント健全度スコアを算出（0〜100）。通報率・拒否率・返信率低下を含む。"""
    history = _load_dm_history()
    config = load_send_config()
    all_replies = _load_replies_for_health()

    if not history:
        return {"score": 100, "status": "健全", "details": {}, "alerts": []}

    # 直近7日間の統計
    week_ago = (datetime.now() - timedelta(days=7)).isoformat()
    recent = [h for h in history if h.get("sent_at", "") >= week_ago]

    total_sent = len([h for h in recent if h.get("status") in ("sent", "mock")])
    total_failed = len([h for h in recent if h.get("status") == "failed"])
    daily_avg = total_sent / 7

    # 直近7日の返信データ
    recent_replies = [r for r in all_replies if r.get("received_at", "") >= week_ago]
    rejection_count = len([
        r for r in recent_replies
        if r.get("classification", {}).get("purpose") == "rejection"
        or r.get("classification", {}).get("sentiment") == "negative"
    ])
    rejection_rate = rejection_count / len(recent_replies) if recent_replies else 0.0

    # 直近3日 vs 7日の返信率比較（急激な低下検知）
    three_days_ago = (datetime.now() - timedelta(days=3)).isoformat()
    sent_3d = len([h for h in history if h.get("sent_at", "") >= three_days_ago and h.get("status") in ("sent", "mock")])
    replied_3d = len([r for r in all_replies if r.get("received_at", "") >= three_days_ago])
    overall_rr = len(recent_replies) / total_sent if total_sent > 0 else 0.0
    recent_rr = replied_3d / sent_3d if sent_3d > 0 else 0.0
    reply_rate_drop = (overall_rr - recent_rr) / overall_rr if overall_rr > 0.01 else 0.0

    score = 100
    alerts = []
    fail_rate = 0.0

    # 送信失敗率ペナルティ
    if total_sent + total_failed > 0:
        fail_rate = total_failed / (total_sent + total_failed)
        score -= int(fail_rate * 40)
        if fail_rate > 0.2:
            alerts.append({"level": "danger", "message": f"送信失敗率が高い ({round(fail_rate*100,1)}%)"})

    # 日平均送信数ペナルティ
    limit = config.get("daily_limit", 20)
    if daily_avg > limit * 0.8:
        score -= 20
        alerts.append({"level": "warning", "message": f"送信数が上限に近い（日平均 {round(daily_avg,1)} / 上限 {limit}）"})

    # 拒否・ネガティブ返信率ペナルティ（通報リスク指標）
    if rejection_rate > 0.3:
        score -= 25
        alerts.append({"level": "danger", "message": f"拒否・否定的返信が多い ({round(rejection_rate*100,1)}%) — 通報リスクに注意"})
    elif rejection_rate > 0.15:
        score -= 10
        alerts.append({"level": "warning", "message": f"拒否率がやや高い ({round(rejection_rate*100,1)}%)"})

    # 返信率急落ペナルティ
    if reply_rate_drop > 0.5:
        score -= 15
        alerts.append({"level": "danger", "message": f"直近3日の返信率が急落 ({round(reply_rate_drop*100,1)}%低下)"})
    elif reply_rate_drop > 0.3:
        score -= 8
        alerts.append({"level": "warning", "message": f"返信率が低下傾向 ({round(reply_rate_drop*100,1)}%低下)"})

    # 緊急停止中
    if config.get("emergency_stop"):
        score = max(score - 30, 0)
        alerts.append({"level": "danger", "message": "緊急停止中"})

    score = max(0, min(100, score))
    status = "健全" if score >= 80 else ("注意" if score >= 50 else "警告")

    return {
        "score": score,
        "status": status,
        "alerts": alerts,
        "details": {
            "recent_sent": total_sent,
            "recent_failed": total_failed,
            "daily_avg": round(daily_avg, 1),
            "emergency_stop": config.get("emergency_stop", False),
            "rejection_count": rejection_count,
            "rejection_rate": round(rejection_rate * 100, 1),
            "reply_rate_drop_pct": round(reply_rate_drop * 100, 1),
        },
    }
