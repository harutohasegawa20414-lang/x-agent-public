"""
engine/user_searcher.py

X上のユーザーを検索・フィルタリングし、スコアリングするモジュール。
"""

import json
import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Any

try:
    import tweepy
    TWEEPY_AVAILABLE = True
except ImportError:
    TWEEPY_AVAILABLE = False

NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(NO9_DIR, "data")
TARGETS_PATH = os.path.join(DATA_DIR, "targets.json")
BLACKLIST_PATH = os.path.join(DATA_DIR, "blacklist.json")

# Firebase共有クライアントをインポート（プロジェクトルート経由）
_ROOT = os.path.dirname(NO9_DIR)  # Xエージェント/
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
try:
    from firebase_client import load_doc, save_doc
    _FIREBASE_IMPORTED = True
except ImportError:
    _FIREBASE_IMPORTED = False

_FS_KEY_TARGETS = "no9_targets"
_FS_KEY_BLACKLIST = "no9_blacklist"


def _load_targets() -> List[Dict]:
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY_TARGETS)
        if result is not None:
            return result
    if not os.path.exists(TARGETS_PATH):
        return []
    with open(TARGETS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_targets(targets: List[Dict]):
    if _FIREBASE_IMPORTED:
        save_doc(_FS_KEY_TARGETS, targets)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(TARGETS_PATH, "w", encoding="utf-8") as f:
        json.dump(targets, f, ensure_ascii=False, indent=2)


def _load_blacklist() -> List[str]:
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY_BLACKLIST)
        if result is not None:
            return [entry["user_id"] for entry in result]
    if not os.path.exists(BLACKLIST_PATH):
        return []
    with open(BLACKLIST_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        return [entry["user_id"] for entry in data]


def calculate_score(user: Dict, conditions: Dict, weights: Dict) -> float:
    """
    ユーザーに対してカテゴリ条件に基づくスコアを算出する（0〜100）。
    """
    # 認証済みアカウント（青バッジ）フィルタ — カテゴリ設定がある場合のみ適用
    if conditions.get("is_verified_only") and not user.get("verified"):
        return 0.0

    score = 0.0

    bio = (user.get("bio") or "").lower()
    posts_text = " ".join([p.get("text", "") for p in user.get("recent_posts", [])]).lower()
    user_hashtags = set(user.get("hashtags_used", []))
    exclude_kws = [kw.lower() for kw in conditions.get("exclude_keywords", [])]

    # 除外キーワードチェック
    for kw in exclude_kws:
        if kw in bio or kw in posts_text:
            return 0.0

    # 投稿頻度チェック（ツイート総数で代用）
    post_frequency_min = conditions.get("post_frequency_min", 0)
    if post_frequency_min > 0:
        tweet_count = user.get("tweet_count", 0)
        if tweet_count < post_frequency_min:
            return 0.0

    # 最終投稿日チェック
    last_post_days_max = conditions.get("last_post_days_max", 0)
    if last_post_days_max > 0:
        last_post_date = user.get("last_post_date")
        if last_post_date:
            try:
                cutoff = datetime.now(timezone.utc) - timedelta(days=last_post_days_max)
                last_dt = datetime.fromisoformat(last_post_date.replace("Z", "+00:00"))
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                if last_dt < cutoff:
                    return 0.0
            except Exception:
                pass

    # プロフィールキーワードマッチ
    profile_kws = [kw.lower() for kw in conditions.get("profile_keywords", [])]
    if profile_kws:
        matched = sum(1 for kw in profile_kws if kw in bio)
        profile_score = (matched / len(profile_kws)) * weights.get("profile_match", 30)
        score += profile_score

    # 投稿キーワードマッチ
    post_kws = [kw.lower() for kw in conditions.get("post_keywords", [])]
    if post_kws:
        matched = sum(1 for kw in post_kws if kw in posts_text)
        post_score = (matched / len(post_kws)) * weights.get("post_match", 25)
        score += post_score

    # ハッシュタグマッチ
    target_hashtags = set([h.lower().lstrip("#") for h in conditions.get("hashtags", [])])
    if target_hashtags:
        overlap = len(target_hashtags & {h.lower() for h in user_hashtags})
        hashtag_score = (overlap / len(target_hashtags)) * weights.get("hashtag_match", 15)
        score += hashtag_score

    # フォロワー数スコア
    followers = user.get("followers_count", 0)
    follower_min = conditions.get("follower_min", 0)
    follower_max = conditions.get("follower_max", 10000000)
    if follower_min <= followers <= follower_max:
        score += weights.get("follower_range", 15)

    # エンゲージメントスコア
    engagement_rate = user.get("engagement_rate", 0.0)
    threshold = conditions.get("engagement_threshold", 0.0)
    if engagement_rate >= threshold:
        score += weights.get("engagement", 15)

    # 認証済みボーナス
    if "verified_bonus" in weights and user.get("verified"):
        score += weights["verified_bonus"]

    return round(min(score, 100.0), 1)


# ============================================================
# bio 判定用: 関連語辞書 & 肩書きパターン
# ============================================================

# 各カテゴリ: triggers (検索語にこれが含まれたら発動), synonyms (bio単純一致), patterns (bio正規表現)
_BIO_CATEGORIES = [
    {
        "triggers": {"経営", "経営者", "起業", "起業家", "創業", "オーナー", "社長", "代表", "ceo"},
        "synonyms": {"経営者", "起業家", "創業者", "実業家", "事業家", "オーナー", "社長", "会長"},
        "patterns": [
            r"経営者", r"経営して", r"会社経営",
            r"代表取締役", r"代表\b",
            r"社長", r"CEO", r"COO", r"CFO",
            r"創業者", r"創業\d", r"ファウンダー", r"founder",
            r"起業家", r"起業\d+年", r"起業して",
            r"オーナー", r"事業家", r"実業家", r"会長",
            r"取締役", r"理事", r"director",
            r"㈱.{1,50}代表", r"株式会社.{1,50}代表",
            r"年商\d", r"法人\d",
        ],
        "exclude": [r"事業家集団"],
    },
    {
        "triggers": {"エンジニア", "プログラマー", "開発者", "developer", "プログラマ"},
        "synonyms": {"エンジニア", "プログラマー", "プログラマ", "開発者", "developer", "engineer", "swe"},
        "patterns": [
            r"エンジニア", r"プログラマ", r"開発者",
            r"developer", r"engineer", r"SWE",
            r"フルスタック", r"full.?stack", r"フロントエンド", r"バックエンド",
            r"frontend", r"backend", r"web開発", r"アプリ開発",
            r"CTO", r"tech.?lead", r"テックリード",
            r"コーダー", r"coder",
        ],
    },
    {
        "triggers": {"デザイナー", "デザイン", "designer", "クリエイター"},
        "synonyms": {"デザイナー", "クリエイター", "designer", "creator", "アートディレクター"},
        "patterns": [
            r"デザイナー", r"designer", r"クリエイター", r"creator",
            r"UI/?UX", r"グラフィック", r"graphic",
            r"アートディレクター", r"art.?director",
            r"イラストレーター", r"illustrator",
            r"ウェブデザイン", r"web.?design",
        ],
    },
    {
        "triggers": {"投資家", "投資", "vc", "エンジェル", "investor"},
        "synonyms": {"投資家", "investor", "エンジェル投資", "vc", "ベンチャーキャピタル"},
        "patterns": [
            r"投資家", r"investor", r"エンジェル",
            r"VC", r"ベンチャーキャピタル", r"venture.?capital",
            r"ファンド", r"fund", r"資産運用",
            r"トレーダー", r"trader",
            r"個人投資", r"不動産投資",
        ],
    },
    {
        "triggers": {"マーケター", "マーケティング", "marketer", "marketing"},
        "synonyms": {"マーケター", "marketer", "マーケティング"},
        "patterns": [
            r"マーケター", r"marketer", r"マーケティング", r"marketing",
            r"CMO", r"グロース", r"growth",
            r"広告運用", r"SNS運用", r"web集客",
            r"コピーライター", r"copywriter",
            r"ブランディング", r"branding",
        ],
    },
    {
        "triggers": {"コンサル", "コンサルタント", "consultant", "アドバイザー"},
        "synonyms": {"コンサルタント", "コンサル", "consultant", "アドバイザー", "advisor"},
        "patterns": [
            r"コンサルタント", r"コンサル", r"consultant",
            r"アドバイザー", r"advisor", r"adviser",
            r"戦略", r"strategy", r"経営支援",
            r"士業", r"税理士", r"会計士", r"弁護士", r"社労士",
        ],
    },
    {
        "triggers": {"営業", "セールス", "sales"},
        "synonyms": {"営業", "セールス", "sales", "営業部長", "営業マネージャー"},
        "patterns": [
            r"営業", r"セールス", r"sales",
            r"法人営業", r"BtoB", r"B2B",
            r"インサイドセールス", r"フィールドセールス",
            r"営業部長", r"営業マネージャー",
        ],
    },
    {
        "triggers": {"医師", "医者", "ドクター", "doctor", "医療"},
        "synonyms": {"医師", "医者", "ドクター", "doctor", "歯科医", "薬剤師"},
        "patterns": [
            r"医師", r"医者", r"ドクター", r"doctor", r"Dr\.",
            r"外科", r"内科", r"歯科", r"薬剤師",
            r"院長", r"クリニック", r"病院",
            r"看護師", r"nurse",
        ],
    },
]

# マージ済み辞書（遅延初期化）
_ACTIVE_BIO_CATEGORIES = None


def _get_active_bio_categories():
    """マージ済みbio辞書を返す。未初期化ならload→mergeする。"""
    global _ACTIVE_BIO_CATEGORIES
    if _ACTIVE_BIO_CATEGORIES is not None:
        return _ACTIVE_BIO_CATEGORIES
    try:
        from engine.bio_learner import get_merged_categories
        _ACTIVE_BIO_CATEGORIES = get_merged_categories()
    except Exception as e:
        print(f"[WARN] bio_learner読み込み失敗、ベースラインのみで動作: {e}")
        _ACTIVE_BIO_CATEGORIES = _BIO_CATEGORIES
    return _ACTIVE_BIO_CATEGORIES


def refresh_active_bio_categories():
    """外部からマージ済み辞書をリフレッシュする。"""
    global _ACTIVE_BIO_CATEGORIES
    _ACTIVE_BIO_CATEGORIES = None


def _build_bio_matchers(search_terms: List[str]):
    """検索語から関連するbioパターンと同義語セットを構築する。"""
    matched_patterns = []
    matched_synonyms = set()
    matched_excludes = []
    terms_lower = {t.lower() for t in search_terms}

    for cat in _get_active_bio_categories():
        # triggers のいずれかが検索語に含まれていれば発動
        if any(trigger in term or term in trigger for trigger in cat["triggers"] for term in terms_lower):
            matched_patterns.extend(cat.get("patterns", []))
            matched_synonyms.update(cat.get("synonyms", set()))
            matched_excludes.extend(cat.get("exclude", []))

    # どのカテゴリにもマッチしなければ、検索語そのものをsynonymとして使う
    if not matched_synonyms:
        matched_synonyms = terms_lower

    return (matched_patterns, matched_excludes), matched_synonyms


def _is_bio_match(combined_text: str, patterns_tuple, synonyms: set) -> bool:
    """bio+表示名テキストが関連語/パターンにマッチするか判定する。"""
    patterns, excludes = patterns_tuple

    # 除外パターンに該当したら不一致
    if any(re.search(p, combined_text, re.IGNORECASE) for p in excludes):
        return False

    # 同義語の単純一致
    if any(syn in combined_text for syn in synonyms):
        return True

    # 正規表現パターン
    if any(re.search(p, combined_text, re.IGNORECASE) for p in patterns):
        return True

    return False


def search_users_by_keyword(
    keyword: str,
    max_results: int = 20,
    bearer_token: str = None
) -> List[Dict]:
    """
    X APIを使ってキーワードでユーザーを検索する。
    APIキーがない場合はモックデータを返す。
    """
    if not TWEEPY_AVAILABLE or not bearer_token:
        return _mock_search_users(keyword, max_results)

    try:
        client = tweepy.Client(bearer_token=bearer_token)
        # スペース区切りキーワードをOR結合（複数語で検索ヒット率を上げる）
        terms = keyword.strip().split()
        if len(terms) > 1:
            or_query = " OR ".join(terms)
            query = f"({or_query}) -is:retweet lang:ja"
        else:
            query = f"{keyword} -is:retweet lang:ja"

        # 母数を最大化（100件=1APIコール）してbioマッチユーザーを多く確保
        response = client.search_recent_tweets(
            query=query,
            max_results=100,
            expansions=["author_id"],
            user_fields=["name", "username", "description", "public_metrics", "created_at", "verified"],
            tweet_fields=["public_metrics", "created_at"],
        )

        # bio 判定用: 関連語辞書 & 肩書きパターン辞書
        bio_patterns, bio_synonyms = _build_bio_matchers(terms)

        bio_matched = []   # bioにキーワード/肩書きがあるユーザー（優先）
        others = []        # それ以外

        if response.includes and "users" in response.includes:
            tweets_by_author = {}
            if response.data:
                for tweet in response.data:
                    author_id = str(tweet.author_id)
                    if author_id not in tweets_by_author:
                        tweets_by_author[author_id] = []
                    tweets_by_author[author_id].append({
                        "text": tweet.text,
                        "metrics": tweet.public_metrics or {},
                        "created_at": str(tweet.created_at) if getattr(tweet, "created_at", None) else None,
                    })

            seen_ids = set()
            for user in response.includes["users"]:
                uid = str(user.id)
                if uid in seen_ids:
                    continue
                seen_ids.add(uid)

                metrics = user.public_metrics or {}
                followers = metrics.get("followers_count", 0)
                user_tweets = tweets_by_author.get(uid, [])

                # エンゲージメント計算
                engagement_rate = 0.0
                if user_tweets and followers > 0:
                    avg_engagement = sum(
                        (t["metrics"].get("like_count", 0) + t["metrics"].get("retweet_count", 0))
                        for t in user_tweets
                    ) / len(user_tweets)
                    engagement_rate = round(avg_engagement / followers * 100, 2)

                # ハッシュタグ抽出 & 最終投稿日取得
                hashtags_used = []
                last_post_date = None
                for tweet in user_tweets:
                    hashtags_used.extend(re.findall(r"#(\w+)", tweet["text"]))
                    if tweet.get("created_at") and (last_post_date is None or tweet["created_at"] > last_post_date):
                        last_post_date = tweet["created_at"]

                user_dict = {
                    "id": uid,
                    "name": user.name,
                    "username": user.username,
                    "bio": user.description or "",
                    "followers_count": followers,
                    "following_count": metrics.get("following_count", 0),
                    "tweet_count": metrics.get("tweet_count", 0),
                    "engagement_rate": engagement_rate,
                    "recent_posts": user_tweets[:5],
                    "hashtags_used": list(set(hashtags_used)),
                    "last_post_date": last_post_date,
                    "profile_url": f"https://x.com/{user.username}",
                    "verified": user.verified,
                }

                # bio + 表示名で判定
                combined = ((user.description or "") + " " + (user.name or "")).lower()
                if _is_bio_match(combined, bio_patterns, bio_synonyms):
                    bio_matched.append(user_dict)
                else:
                    others.append(user_dict)

        # bio マッチを優先し、足りなければ残りで補完
        users = (bio_matched + others)[:max_results]
        return users
    except Exception as e:
        print(f"[WARN] X API search failed: {e}. Falling back to mock.")
        return _mock_search_users(keyword, max_results)


def _mock_search_users(keyword: str, max_results: int = 10) -> List[Dict]:
    """APIキーなし時のモックユーザーデータ"""
    mock_users = []
    for i in range(min(max_results, 5)):
        last_post = (datetime.now(timezone.utc) - timedelta(days=i * 3)).isoformat()
        mock_users.append({
            "id": f"mock_{uuid.uuid4().hex[:8]}",
            "name": f"[MOCK] ユーザー {i+1} ({keyword})",
            "username": f"mock_user_{i+1}",
            "bio": f"{keyword}に関連するプロフィール。経営者・起業家として活動中。",
            "followers_count": 1000 * (i + 1),
            "following_count": 500,
            "tweet_count": 200 * (i + 1),
            "engagement_rate": round(1.5 + i * 0.3, 2),
            "recent_posts": [
                {"text": f"{keyword}について日々発信しています。#{keyword.replace(' ', '')}", "metrics": {}, "created_at": last_post},
            ],
            "hashtags_used": [keyword.replace(" ", ""), "ビジネス", "起業"],
            "last_post_date": last_post,
            "profile_url": f"https://x.com/mock_user_{i+1}",
            "verified": True,
            "is_mock": True,
        })
    return mock_users


def search_users_by_profile(
    keyword: str,
    max_results: int = 20,
    api_key: str = None,
    api_secret: str = None,
    access_token: str = None,
    access_token_secret: str = None,
    max_pages: int = 3,  # 上限5

) -> List[Dict]:
    """
    v1.1 API.search_users() を使ってプロフィール（bio/名前/ユーザー名）を直接検索する。
    OAuth 1.0a 認証が必要。認証失敗・レート制限時はモックにフォールバック。
    """
    max_pages = min(max_pages, 5)
    if not TWEEPY_AVAILABLE or not all([api_key, api_secret, access_token, access_token_secret]):
        return _mock_search_users(keyword, max_results)

    try:
        auth = tweepy.OAuth1UserHandler(api_key, api_secret, access_token, access_token_secret)
        api = tweepy.API(auth, wait_on_rate_limit=False)

        users = []
        seen_ids = set()
        for page in range(1, max_pages + 1):
            try:
                results = api.search_users(q=keyword, page=page, count=20)
            except tweepy.TooManyRequests:
                print(f"[WARN] v1.1 search_users rate limit at page {page}")
                break
            except Exception as e:
                print(f"[WARN] v1.1 search_users page {page} error: {e}")
                break

            if not results:
                break

            for u in results:
                uid = str(u.id)
                if uid in seen_ids:
                    continue
                seen_ids.add(uid)

                metrics = {
                    "followers_count": u.followers_count or 0,
                    "following_count": u.friends_count or 0,
                    "tweet_count": u.statuses_count or 0,
                }

                # 最新ツイート1件（status属性があれば取得）
                recent_posts = []
                last_post_date = None
                hashtags_used = []
                if hasattr(u, "status") and u.status:
                    tweet_text = u.status.text or ""
                    created = str(u.status.created_at) if u.status.created_at else None
                    recent_posts.append({
                        "text": tweet_text,
                        "metrics": {},
                        "created_at": created,
                    })
                    last_post_date = created
                    hashtags_used = re.findall(r"#(\w+)", tweet_text)

                # エンゲージメント（プロフィール検索では正確な値が取れないため0）
                engagement_rate = 0.0

                users.append({
                    "id": uid,
                    "name": u.name or "",
                    "username": u.screen_name or "",
                    "bio": u.description or "",
                    "followers_count": metrics["followers_count"],
                    "following_count": metrics["following_count"],
                    "tweet_count": metrics["tweet_count"],
                    "engagement_rate": engagement_rate,
                    "recent_posts": recent_posts,
                    "hashtags_used": list(set(hashtags_used)),
                    "last_post_date": last_post_date,
                    "profile_url": f"https://x.com/{u.screen_name}",
                    "verified": getattr(u, "verified", False),
                })

                if len(users) >= max_results:
                    break
            if len(users) >= max_results:
                break

        return users
    except Exception as e:
        print(f"[WARN] v1.1 search_users failed: {e}. Falling back to mock.")
        return _mock_search_users(keyword, max_results)


def search_users(
    keyword: str,
    max_results: int = 20,
    search_mode: str = "profile",
    bearer_token: str = None,
    api_key: str = None,
    api_secret: str = None,
    access_token: str = None,
    access_token_secret: str = None,
) -> Dict[str, Any]:
    """
    統合ディスパッチ関数。search_mode に応じて検索方式を切り替える。
    返り値: {"users": [...], "search_mode_used": "profile"|"tweet"}
    """
    if search_mode == "profile":
        users = search_users_by_profile(
            keyword=keyword,
            max_results=max_results,
            api_key=api_key,
            api_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )
        if users:
            return {"users": users, "search_mode_used": "profile"}
        # プロフィール検索が0件の場合、bearer_token があればツイート検索にフォールバック
        if bearer_token:
            print("[INFO] プロフィール検索0件 → ツイート検索にフォールバック")
            users = search_users_by_keyword(
                keyword=keyword, max_results=max_results, bearer_token=bearer_token,
            )
            return {"users": users, "search_mode_used": "tweet"}
        return {"users": [], "search_mode_used": "profile"}
    else:
        # tweet モード
        users = search_users_by_keyword(
            keyword=keyword, max_results=max_results, bearer_token=bearer_token,
        )
        return {"users": users, "search_mode_used": "tweet"}


def add_targets(users: List[Dict], category_id: str, scores: Dict[str, float], search_keyword: str = "") -> List[Dict]:
    """スコア付きユーザーをターゲットリストに追加"""
    targets = _load_targets()
    blacklist = _load_blacklist()
    existing_ids = {t["user_id"] for t in targets}

    new_targets = []
    for user in users:
        uid = user["id"]
        if uid in existing_ids or uid in blacklist:
            continue
        target = {
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "username": user["username"],
            "name": user["name"],
            "bio": user.get("bio", ""),
            "followers_count": user.get("followers_count", 0),
            "engagement_rate": user.get("engagement_rate", 0.0),
            "profile_url": user.get("profile_url", ""),
            "category_id": category_id,
            "search_keyword": search_keyword,
            "score": scores.get(uid, 0.0),
            "status": "pending",  # pending / dm_sent / replied / converted / blacklisted
            "deal_result": None,  # won / lost / pending_deal / continuing / null
            "dm_sent_at": None,
            "replied_at": None,
            "notes": "",
            "added_at": datetime.now().isoformat(),
            "recent_posts": user.get("recent_posts", []),
            "hashtags_used": user.get("hashtags_used", []),
        }
        targets.append(target)
        new_targets.append(target)
        existing_ids.add(uid)

    _save_targets(targets)
    return new_targets


def list_targets(
    category_id: str = None,
    status: str = None,
    min_score: float = 0.0,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict]:
    targets = _load_targets()
    if category_id:
        targets = [t for t in targets if t["category_id"] == category_id]
    if status:
        targets = [t for t in targets if t["status"] == status]
    targets = [t for t in targets if t["score"] >= min_score]
    targets.sort(key=lambda t: t["score"], reverse=True)
    return targets[offset: offset + limit]


def update_target_status(target_id: str, status: str, notes: str = None, deal_result: str = None) -> Optional[Dict]:
    targets = _load_targets()
    for i, t in enumerate(targets):
        if t["id"] == target_id:
            targets[i]["status"] = status
            if notes is not None:
                targets[i]["notes"] = notes
            if deal_result is not None:
                targets[i]["deal_result"] = deal_result
            if status == "dm_sent":
                targets[i]["dm_sent_at"] = datetime.now().isoformat()
            elif status == "replied":
                targets[i]["replied_at"] = datetime.now().isoformat()
            _save_targets(targets)
            return targets[i]
    return None


def delete_target(target_id: str) -> bool:
    """指定IDのターゲットを削除する。成功したらTrue。"""
    targets = _load_targets()
    new_targets = [t for t in targets if t["id"] != target_id]
    if len(new_targets) == len(targets):
        return False
    _save_targets(new_targets)
    return True


def delete_all_targets() -> int:
    """全ターゲットを削除する。削除件数を返す。"""
    targets = _load_targets()
    count = len(targets)
    _save_targets([])
    return count


def add_to_blacklist(user_id: str, username: str, reason: str = ""):
    """ユーザーをブラックリストに追加し、ターゲットから除外"""
    # ブラックリスト読み込み
    blacklist = []
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY_BLACKLIST)
        if result is not None:
            blacklist = result
    elif os.path.exists(BLACKLIST_PATH):
        with open(BLACKLIST_PATH, "r", encoding="utf-8") as f:
            blacklist = json.load(f)

    if not any(b["user_id"] == user_id for b in blacklist):
        blacklist.append({
            "user_id": user_id,
            "username": username,
            "reason": reason,
            "added_at": datetime.now().isoformat(),
        })
        if _FIREBASE_IMPORTED:
            save_doc(_FS_KEY_BLACKLIST, blacklist)
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(BLACKLIST_PATH, "w", encoding="utf-8") as f:
            json.dump(blacklist, f, ensure_ascii=False, indent=2)

    # ターゲットリストからも除外
    targets = _load_targets()
    for i, t in enumerate(targets):
        if t["user_id"] == user_id:
            targets[i]["status"] = "blacklisted"
    _save_targets(targets)


def get_target_stats() -> Dict:
    targets = _load_targets()
    total = len(targets)
    by_status = {}
    by_deal_result = {}
    for t in targets:
        s = t["status"]
        by_status[s] = by_status.get(s, 0) + 1
        dr = t.get("deal_result")
        if dr:
            by_deal_result[dr] = by_deal_result.get(dr, 0) + 1
    avg_score = round(sum(t["score"] for t in targets) / total, 1) if total > 0 else 0.0
    return {
        "total": total,
        "by_status": by_status,
        "by_deal_result": by_deal_result,
        "avg_score": avg_score,
        "pending": by_status.get("pending", 0),
        "dm_sent": by_status.get("dm_sent", 0),
        "replied": by_status.get("replied", 0),
        "converted": by_status.get("converted", 0),
    }
