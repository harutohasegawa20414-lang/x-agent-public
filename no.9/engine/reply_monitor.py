"""
engine/reply_monitor.py

DM返信リアルタイム取得・感情分類・人間引き継ぎ管理。
"""

import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple

try:
    import tweepy
    TWEEPY_AVAILABLE = True
except ImportError:
    TWEEPY_AVAILABLE = False

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(NO9_DIR, "data")
REPLIES_PATH = os.path.join(DATA_DIR, "replies.json")
POLL_STATUS_PATH = os.path.join(DATA_DIR, "poll_status.json")
DM_HISTORY_PATH = os.path.join(DATA_DIR, "dm_history.json")


def _load_poll_status() -> Dict:
    if not os.path.exists(POLL_STATUS_PATH):
        return {"last_polled_at": None, "last_event_id": None, "total_polled": 0, "last_error": None}
    with open(POLL_STATUS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_poll_status(status: Dict):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(POLL_STATUS_PATH, "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False, indent=2)


def _load_dm_history() -> List[Dict]:
    if not os.path.exists(DM_HISTORY_PATH):
        return []
    with open(DM_HISTORY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_replies() -> List[Dict]:
    if not os.path.exists(REPLIES_PATH):
        return []
    with open(REPLIES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_replies(replies: List[Dict]):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(REPLIES_PATH, "w", encoding="utf-8") as f:
        json.dump(replies, f, ensure_ascii=False, indent=2)


def classify_reply(reply_text: str, openai_api_key: str = None) -> Dict:
    """
    返信テキストを感情・目的で分類する。
    感情: positive / neutral / negative
    目的: business / partnership / consultation / other / rejection
    """
    if not OPENAI_AVAILABLE or not openai_api_key:
        return _mock_classify(reply_text)

    client = OpenAI(api_key=openai_api_key)
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """返信テキストを分析し、以下のJSON形式で返してください：
{
  "sentiment": "positive|neutral|negative",
  "purpose": "business|partnership|consultation|other|rejection",
  "summary": "返信の要約（50文字以内）",
  "requires_human": true|false,
  "urgency": "high|medium|low"
}
requires_humanは、商談・提携・相談など人間が対応すべき場合にtrue。""",
                },
                {"role": "user", "content": f"返信内容: {reply_text}"},
            ],
            max_tokens=200,
            temperature=0.3,
        )
        content = response.choices[0].message.content.strip()
        # JSONを抽出
        import re
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"[WARN] Reply classification failed: {e}")

    return _mock_classify(reply_text)


def _mock_classify(reply_text: str) -> Dict:
    text_lower = reply_text.lower()
    # 簡易ルールベース分類
    negative_words = ["不要", "結構です", "やめてください", "迷惑", "ブロック", "報告"]
    positive_words = ["興味", "ぜひ", "話しましょう", "詳しく", "連絡", "よろしく", "お願い"]
    business_words = ["商談", "提携", "ビジネス", "仕事", "打ち合わせ", "ミーティング"]

    sentiment = "neutral"
    if any(w in text_lower for w in negative_words):
        sentiment = "negative"
    elif any(w in text_lower for w in positive_words):
        sentiment = "positive"

    purpose = "other"
    requires_human = False
    if any(w in text_lower for w in business_words):
        purpose = "business"
        requires_human = True
    elif "提携" in text_lower:
        purpose = "partnership"
        requires_human = True
    elif "相談" in text_lower:
        purpose = "consultation"
        requires_human = True
    elif any(w in text_lower for w in negative_words):
        purpose = "rejection"

    return {
        "sentiment": sentiment,
        "purpose": purpose,
        "summary": reply_text[:50],
        "requires_human": requires_human,
        "urgency": "high" if requires_human else "low",
        "is_mock": True,
    }


def _generate_conversation_summary(
    dm_text: str,
    reply_text: str,
    username: str,
    openai_api_key: str,
) -> str:
    """送信DMと返信から会話要約を自動生成する"""
    if not OPENAI_AVAILABLE or not openai_api_key:
        # ルールベースの簡易要約
        return f"@{username} より返信あり。返信内容: {reply_text[:80]}"

    from openai import OpenAI
    client = OpenAI(api_key=openai_api_key)
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "送信したDMと受け取った返信から、営業担当者向けの会話要約を100文字以内で作成してください。次のアクション（返信すべき内容・商談打診の可否など）も一言含めてください。",
                },
                {
                    "role": "user",
                    "content": f"送信DM: {dm_text[:200]}\n\n受信返信(@{username}): {reply_text[:200]}",
                },
            ],
            max_tokens=150,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[WARN] Summary generation failed: {e}")
        return f"@{username} より返信あり。返信内容: {reply_text[:80]}"


def add_reply(
    dm_history_id: str,
    user_id: str,
    username: str,
    reply_text: str,
    category_id: str,
    target_id: str,
    openai_api_key: str = None,
    dm_event_id: str = None,
    is_encrypted: bool = False,
) -> Optional[Dict]:
    """返信を記録し、自動分類する。dm_event_idが指定された場合は重複チェックを行う。"""
    replies = _load_replies()

    # 重複チェック（ポーリング由来の場合）
    if dm_event_id and any(r.get("dm_event_id") == dm_event_id for r in replies):
        return None

    conversation_summary = None
    if is_encrypted:
        classification = {
            "sentiment": "encrypted",
            "purpose": "unknown",
            "summary": "",
            "requires_human": False,
            "urgency": "low",
        }
        status = "encrypted"
    else:
        classification = classify_reply(reply_text, openai_api_key)
        requires_human = classification.get("requires_human", False)
        status = "pending_human" if requires_human else "auto_classified"

        # 人間対応が必要な場合、送信DMを取得して会話要約を自動生成
        if requires_human:
            dm_history = _load_dm_history()
            sent_dm = next((h for h in dm_history if h["id"] == dm_history_id), None)
            dm_text = sent_dm["dm_text"] if sent_dm else ""
            conversation_summary = _generate_conversation_summary(dm_text, reply_text, username, openai_api_key)

    reply = {
        "id": str(uuid.uuid4()),
        "dm_history_id": dm_history_id,
        "dm_event_id": dm_event_id,
        "user_id": user_id,
        "username": username,
        "category_id": category_id,
        "target_id": target_id,
        "reply_text": reply_text,
        "is_encrypted": is_encrypted,
        "classification": classification,
        "status": status,
        "assigned_to": None,
        "conversation_summary": conversation_summary,
        "received_at": datetime.now().isoformat(),
        "handled_at": None,
    }
    replies.append(reply)
    _save_replies(replies)
    return reply


def list_replies(
    category_id: str = None,
    status: str = None,
    requires_human: bool = None,
    sentiment: str = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict]:
    replies = _load_replies()
    if category_id:
        replies = [r for r in replies if r.get("category_id") == category_id]
    if status:
        replies = [r for r in replies if r.get("status") == status]
    if requires_human is not None:
        replies = [r for r in replies if r["classification"].get("requires_human") == requires_human]
    if sentiment:
        replies = [r for r in replies if r["classification"].get("sentiment") == sentiment]
    replies.sort(key=lambda x: x.get("received_at", ""), reverse=True)
    return replies[offset: offset + limit]


def update_reply_status(
    reply_id: str,
    status: str,
    assigned_to: str = None,
    conversation_summary: str = None,
) -> Optional[Dict]:
    replies = _load_replies()
    for i, r in enumerate(replies):
        if r["id"] == reply_id:
            replies[i]["status"] = status
            if assigned_to:
                replies[i]["assigned_to"] = assigned_to
            if conversation_summary:
                replies[i]["conversation_summary"] = conversation_summary
            if status == "handled":
                replies[i]["handled_at"] = datetime.now().isoformat()
            _save_replies(replies)
            return replies[i]
    return None


def get_reply_stats() -> Dict:
    replies = _load_replies()
    total = len(replies)
    if total == 0:
        return {"total": 0, "by_sentiment": {}, "by_purpose": {}, "pending_human": 0}

    by_sentiment = {}
    by_purpose = {}
    pending_human = 0

    for r in replies:
        cls = r.get("classification", {})
        sentiment = cls.get("sentiment", "unknown")
        purpose = cls.get("purpose", "unknown")
        by_sentiment[sentiment] = by_sentiment.get(sentiment, 0) + 1
        by_purpose[purpose] = by_purpose.get(purpose, 0) + 1
        if r.get("status") == "pending_human":
            pending_human += 1

    return {
        "total": total,
        "by_sentiment": by_sentiment,
        "by_purpose": by_purpose,
        "pending_human": pending_human,
        "positive_rate": round(by_sentiment.get("positive", 0) / total * 100, 1),
    }


def poll_dm_replies(
    api_key: str = None,
    api_secret: str = None,
    access_token: str = None,
    access_token_secret: str = None,
    openai_api_key: str = None,
) -> Dict:
    """X API DM eventsをポーリングして新しい返信を記録する"""
    poll_status = _load_poll_status()

    if not TWEEPY_AVAILABLE or not all([api_key, api_secret, access_token, access_token_secret]):
        # モック: ステータスのみ更新
        poll_status["last_polled_at"] = datetime.now().isoformat()
        poll_status["total_polled"] = poll_status.get("total_polled", 0) + 1
        poll_status["last_error"] = None
        _save_poll_status(poll_status)
        return {"new_replies": 0, "mock": True, "polled_at": poll_status["last_polled_at"]}

    try:
        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )

        kwargs: Dict = {
            "event_types": "MessageCreate",
            "dm_event_fields": ["id", "text", "created_at", "sender_id"],
            "max_results": 100,
        }
        if poll_status.get("last_event_id"):
            kwargs["since_id"] = poll_status["last_event_id"]

        response = client.get_dm_events(**kwargs)
        events = response.data or []

        # 送信済みDM履歴: user_id → 最初の送信履歴エントリ
        dm_history = _load_dm_history()
        sent_by_user: Dict[str, Dict] = {}
        for h in dm_history:
            uid = h.get("user_id")
            if uid and h.get("status") in ("sent", "mock") and uid not in sent_by_user:
                sent_by_user[uid] = h

        new_count = 0
        latest_event_id: Optional[str] = None

        for event in events:
            sender_id = str(getattr(event, "sender_id", ""))
            if sender_id not in sent_by_user:
                continue  # 送信相手からの返信でない

            hist = sent_by_user[sender_id]
            raw_text = getattr(event, "text", "") or ""
            result = add_reply(
                dm_history_id=hist["id"],
                user_id=sender_id,
                username=hist.get("username", ""),
                reply_text=raw_text,
                category_id=hist.get("category_id", ""),
                target_id=hist.get("target_id", ""),
                openai_api_key=openai_api_key,
                dm_event_id=str(event.id),
                is_encrypted=(raw_text == ""),
            )
            if result is not None:
                new_count += 1

            eid = str(event.id)
            if latest_event_id is None or int(eid) > int(latest_event_id):
                latest_event_id = eid

        poll_status["last_polled_at"] = datetime.now().isoformat()
        poll_status["total_polled"] = poll_status.get("total_polled", 0) + 1
        poll_status["last_error"] = None
        if latest_event_id:
            poll_status["last_event_id"] = latest_event_id
        _save_poll_status(poll_status)

        return {"new_replies": new_count, "mock": False, "polled_at": poll_status["last_polled_at"]}

    except Exception as e:
        print(f"[ERROR] DM poll failed: {e}")
        poll_status["last_polled_at"] = datetime.now().isoformat()
        poll_status["last_error"] = str(e)
        _save_poll_status(poll_status)
        return {"new_replies": 0, "error": str(e), "polled_at": poll_status["last_polled_at"]}


def get_poll_status() -> Dict:
    """ポーリング状況を返す"""
    return _load_poll_status()
