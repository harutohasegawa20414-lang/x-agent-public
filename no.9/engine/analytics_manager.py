"""
engine/analytics_manager.py

ダッシュボード用の分析・集計モジュール。
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List


NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(NO9_DIR, "data")


def _load_json(path: str, default=None):
    if not os.path.exists(path):
        return default if default is not None else []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_overview() -> Dict:
    """全体のKPI概要を返す"""
    dm_history = _load_json(os.path.join(DATA_DIR, "dm_history.json"))
    replies = _load_json(os.path.join(DATA_DIR, "replies.json"))
    targets = _load_json(os.path.join(DATA_DIR, "targets.json"))
    categories = _load_json(os.path.join(DATA_DIR, "categories.json"))

    total_sent = len([h for h in dm_history if h.get("status") in ("sent", "mock")])
    total_replied = len(replies)
    positive_replies = len([r for r in replies if r.get("classification", {}).get("sentiment") == "positive"])
    business_replies = len([r for r in replies if r.get("classification", {}).get("purpose") == "business"])

    reply_rate = round(total_replied / total_sent * 100, 1) if total_sent > 0 else 0.0
    positive_rate = round(positive_replies / total_replied * 100, 1) if total_replied > 0 else 0.0
    conversion_rate = round(business_replies / total_replied * 100, 1) if total_replied > 0 else 0.0

    converted_targets = len([t for t in targets if t.get("status") == "converted"])
    deal_rate = round(converted_targets / total_sent * 100, 1) if total_sent > 0 else 0.0

    return {
        "total_sent": total_sent,
        "total_replied": total_replied,
        "reply_rate": reply_rate,
        "positive_rate": positive_rate,
        "conversion_rate": conversion_rate,
        "deal_rate": deal_rate,
        "total_targets": len(targets),
        "total_categories": len(categories),
        "pending_human": len([r for r in replies if r.get("status") == "pending_human"]),
    }


def get_daily_stats(days: int = 14) -> List[Dict]:
    """日別送信・返信数の推移"""
    dm_history = _load_json(os.path.join(DATA_DIR, "dm_history.json"))
    replies = _load_json(os.path.join(DATA_DIR, "replies.json"))

    result = []
    for i in range(days - 1, -1, -1):
        date = (datetime.now() - timedelta(days=i)).date().isoformat()
        sent = len([h for h in dm_history if h.get("sent_at", "").startswith(date) and h.get("status") in ("sent", "mock")])
        replied = len([r for r in replies if r.get("received_at", "").startswith(date)])
        result.append({"date": date, "sent": sent, "replied": replied})
    return result


def get_category_stats() -> List[Dict]:
    """カテゴリ別の送信・返信統計"""
    categories = _load_json(os.path.join(DATA_DIR, "categories.json"))
    dm_history = _load_json(os.path.join(DATA_DIR, "dm_history.json"))
    replies = _load_json(os.path.join(DATA_DIR, "replies.json"))

    result = []
    for cat in categories:
        cat_id = cat["id"]
        cat_sent = len([h for h in dm_history if h.get("category_id") == cat_id and h.get("status") in ("sent", "mock")])
        cat_replied = len([r for r in replies if r.get("category_id") == cat_id])
        reply_rate = round(cat_replied / cat_sent * 100, 1) if cat_sent > 0 else 0.0
        result.append({
            "category_id": cat_id,
            "category_name": cat["name"],
            "sent": cat_sent,
            "replied": cat_replied,
            "reply_rate": reply_rate,
        })

    result.sort(key=lambda x: x["reply_rate"], reverse=True)
    return result


def get_template_stats() -> List[Dict]:
    """テンプレート別の送信・返信統計"""
    templates = _load_json(os.path.join(DATA_DIR, "dm_templates.json"))
    return [
        {
            "template_id": t["id"],
            "template_name": t["name"],
            "sent": t.get("stats", {}).get("sent", 0),
            "replied": t.get("stats", {}).get("replied", 0),
            "reply_rate": t.get("stats", {}).get("reply_rate", 0.0),
            "tone": t.get("tone", ""),
        }
        for t in templates
    ]


def get_keyword_stats() -> List[Dict]:
    """キーワード別の送信・返信統計"""
    targets = _load_json(os.path.join(DATA_DIR, "targets.json"))
    dm_history = _load_json(os.path.join(DATA_DIR, "dm_history.json"))
    replies = _load_json(os.path.join(DATA_DIR, "replies.json"))

    # target_id → search_keyword のマップ
    kw_by_target = {t["id"]: t.get("search_keyword", "") for t in targets}

    # キーワード別集計
    kw_sent: Dict[str, int] = {}
    kw_replied: Dict[str, int] = {}

    for h in dm_history:
        if h.get("status") not in ("sent", "mock"):
            continue
        kw = kw_by_target.get(h.get("target_id"), "") or "（未分類）"
        kw_sent[kw] = kw_sent.get(kw, 0) + 1

    for r in replies:
        kw = kw_by_target.get(r.get("target_id"), "") or "（未分類）"
        kw_replied[kw] = kw_replied.get(kw, 0) + 1

    all_kws = set(kw_sent) | set(kw_replied)
    result = []
    for kw in all_kws:
        sent = kw_sent.get(kw, 0)
        replied = kw_replied.get(kw, 0)
        result.append({
            "keyword": kw,
            "sent": sent,
            "replied": replied,
            "reply_rate": round(replied / sent * 100, 1) if sent > 0 else 0.0,
        })
    result.sort(key=lambda x: x["reply_rate"], reverse=True)
    return result


def get_time_distribution() -> List[Dict]:
    """時間帯別の返信率"""
    dm_history = _load_json(os.path.join(DATA_DIR, "dm_history.json"))
    replies = _load_json(os.path.join(DATA_DIR, "replies.json"))

    # ユーザーIDをキーに送信時刻を記録
    sent_hours = {}
    for h in dm_history:
        if h.get("status") in ("sent", "mock"):
            try:
                hour = datetime.fromisoformat(h["sent_at"]).hour
                uid = h.get("user_id")
                sent_hours[uid] = hour
            except Exception:
                pass

    hour_sent = [0] * 24
    hour_replied = [0] * 24

    for h in dm_history:
        if h.get("status") in ("sent", "mock"):
            try:
                hour = datetime.fromisoformat(h["sent_at"]).hour
                hour_sent[hour] += 1
            except Exception:
                pass

    for r in replies:
        try:
            hour = datetime.fromisoformat(r["received_at"]).hour
            hour_replied[hour] += 1
        except Exception:
            pass

    result = []
    for h in range(24):
        rate = round(hour_replied[h] / hour_sent[h] * 100, 1) if hour_sent[h] > 0 else 0.0
        result.append({"hour": h, "sent": hour_sent[h], "replied": hour_replied[h], "reply_rate": rate})
    return result
