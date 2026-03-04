"""
engine/tweet_fetcher.py

X API App-Only auth でユーザーの最新ツイートを取得し、
data/tweet_examples_cache.json に7日間キャッシュするモジュール。
"""
import json
import os
from datetime import datetime, timedelta
from typing import List, Optional


class TweetFetchAuthError(Exception):
    """X API 認証エラー（401 Unauthorized）。APIキーが無効または期限切れ。"""
    pass

CACHE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "tweet_examples_cache.json"
)

CACHE_TTL_DAYS = 7


def _load_cache() -> dict:
    if not os.path.exists(CACHE_PATH):
        return {}
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_cache(cache: dict):
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def fetch_recent_tweets(
    x_username: str,
    consumer_key: Optional[str],
    consumer_secret: Optional[str],
    access_token: Optional[str] = None,
    access_token_secret: Optional[str] = None,
    max_results: int = 10,
) -> Optional[List[str]]:
    """
    指定ユーザーの最新ツイートを取得する。
    7日間キャッシュが有効な場合はキャッシュから返す。
    失敗時は None を返す（呼び出し元でフォールバック）。

    Args:
        x_username: Xのユーザー名（@なし）
        consumer_key: X API Consumer Key
        consumer_secret: X API Consumer Secret
        access_token: X API Access Token（User Context auth用）
        access_token_secret: X API Access Token Secret
        max_results: 取得件数（最大10）

    Returns:
        ツイートテキストのリスト、または None（失敗時）
    """
    username = x_username.strip().lstrip("@")
    if not username:
        return None

    # キャッシュ確認
    cache = _load_cache()
    if username in cache:
        entry = cache[username]
        cached_at = datetime.fromisoformat(entry.get("cached_at", "2000-01-01"))
        if datetime.now() - cached_at < timedelta(days=CACHE_TTL_DAYS):
            print(f"[TweetFetcher] Cache hit for @{username}")
            return entry.get("tweets", [])

    print(f"[TweetFetcher] Fetching tweets for @{username}")

    if not consumer_key or not consumer_secret:
        print(f"[TweetFetcher] Missing X API credentials. Skipping tweet fetch.")
        return None

    try:
        import tweepy
    except ImportError:
        print("[TweetFetcher] tweepy not installed. Skipping tweet fetch.")
        return None

    try:
        client = tweepy.Client(
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )

        # ユーザーIDを取得
        user_resp = client.get_user(username=username, user_auth=True)
        if not user_resp or not user_resp.data:
            print(f"[TweetFetcher] User not found: @{username}")
            return None

        user_id = user_resp.data.id

        # ツイートを取得（リプライ・RTを除く）
        tweets_resp = client.get_users_tweets(
            id=user_id,
            max_results=max(5, min(max_results, 100)),
            exclude=["retweets", "replies"],
            tweet_fields=["text"],
            user_auth=True,
        )

        if not tweets_resp or not tweets_resp.data:
            print(f"[TweetFetcher] No tweets found for @{username}")
            return None

        tweets = [t.text for t in tweets_resp.data]

        # キャッシュ保存
        cache[username] = {
            "tweets": tweets,
            "cached_at": datetime.now().isoformat(),
        }
        _save_cache(cache)
        print(f"[TweetFetcher] Fetched {len(tweets)} tweets for @{username}, cached.")
        return tweets

    except tweepy.errors.Unauthorized:
        msg = (
            "X APIの認証情報が無効または期限切れです。"
            "アカウント設定でConsumer Key/Secret・Access Token/Secretを確認してください。"
        )
        print(f"[TweetFetcher] Auth error for @{username}: 401 Unauthorized")
        raise TweetFetchAuthError(msg)
    except Exception as e:
        print(f"[TweetFetcher] Error fetching tweets for @{username}: {e}")
        return None
