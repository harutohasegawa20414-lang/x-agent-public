"""
engine/notification_sender.py

LINE Notify / Google Calendar連携モジュール。
返信検知時の通知・商談自動登録を担当。
"""

import json
import os
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict

try:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False


def send_line_notification(message: str, line_notify_token: str = None) -> bool:
    """LINE Notifyでメッセージを送信する"""
    if not line_notify_token:
        print(f"[MOCK LINE] {message}")
        return False

    try:
        response = requests.post(
            "https://notify-api.line.me/api/notify",
            headers={"Authorization": f"Bearer {line_notify_token}"},
            data={"message": f"\n{message}"},
            timeout=10,
        )
        return response.status_code == 200
    except Exception as e:
        print(f"[ERROR] LINE notification failed: {e}")
        return False


def notify_positive_reply(reply: Dict, line_notify_token: str = None):
    """有効返信をLINEに通知"""
    username = reply.get("username", "不明")
    summary = reply.get("classification", {}).get("summary", "")
    purpose = reply.get("classification", {}).get("purpose", "other")
    sentiment = reply.get("classification", {}).get("sentiment", "unknown")

    purpose_labels = {
        "business": "商談",
        "partnership": "提携",
        "consultation": "相談",
        "other": "その他",
        "rejection": "拒否",
    }

    message = f"""[X営業] 有効返信を受信しました

送信者: @{username}
目的: {purpose_labels.get(purpose, purpose)}
感情: {sentiment}
要約: {summary}

対応が必要です。ダッシュボードを確認してください。"""

    return send_line_notification(message, line_notify_token)


def register_google_calendar_event(
    title: str,
    description: str,
    start_datetime: str,
    end_datetime: str = None,
    credentials_dict: Dict = None,
    calendar_id: str = "primary",
) -> Optional[str]:
    """
    Google Calendarにイベントを登録する。
    credentials_dictがない場合はモック動作。
    """
    if end_datetime is None:
        # デフォルト1時間
        start_dt = datetime.fromisoformat(start_datetime)
        end_datetime = (start_dt + timedelta(hours=1)).isoformat()

    if not GOOGLE_AVAILABLE or not credentials_dict:
        print(f"[MOCK CALENDAR] イベント登録: {title} at {start_datetime}")
        return "mock_event_id"

    try:
        from google.auth.transport.requests import Request
        creds = Credentials(
            token=None,
            refresh_token=credentials_dict.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=credentials_dict.get("client_id"),
            client_secret=credentials_dict.get("client_secret"),
        )
        creds.refresh(Request())
        service = build("calendar", "v3", credentials=creds)
        event = {
            "summary": title,
            "description": description,
            "start": {"dateTime": start_datetime, "timeZone": "Asia/Tokyo"},
            "end": {"dateTime": end_datetime, "timeZone": "Asia/Tokyo"},
        }
        created = service.events().insert(calendarId=calendar_id, body=event).execute()
        return created.get("id")
    except Exception as e:
        print(f"[ERROR] Google Calendar registration failed: {e}")
        return None


def register_business_meeting(
    reply: Dict,
    meeting_datetime: str,
    notes: str = "",
    line_notify_token: str = None,
    calendar_credentials: Dict = None,
    calendar_id: str = "primary",
) -> Dict:
    """
    商談確定時にGoogle Calendarに登録し、LINEに通知する。
    """
    username = reply.get("username", "不明")
    user_id = reply.get("user_id", "")
    summary = reply.get("classification", {}).get("summary", "")

    title = f"[X営業] @{username} との商談"
    description = f"""Xアカウント: @{username} (ID: {user_id})
返信内容: {reply.get('reply_text', '')[:200]}
要約: {summary}
メモ: {notes}"""

    event_id = register_google_calendar_event(
        title=title,
        description=description,
        start_datetime=meeting_datetime,
        credentials_dict=calendar_credentials,
        calendar_id=calendar_id,
    )

    line_message = f"""[X営業] 商談が登録されました

相手: @{username}
日時: {meeting_datetime}
メモ: {notes}
カレンダーID: {event_id or 'N/A'}"""

    send_line_notification(line_message, line_notify_token)

    return {
        "success": True,
        "event_id": event_id,
        "username": username,
        "meeting_datetime": meeting_datetime,
    }
