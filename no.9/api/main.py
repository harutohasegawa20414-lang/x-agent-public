"""
no.9/api/main.py

X営業入口最適化システム - FastAPI バックエンド
既存のXエージェントシステムとは独立して動作する（ポート8001）。
"""

import os
import sys
import base64
import urllib.request
import urllib.parse
import json as _json
from contextlib import asynccontextmanager
from datetime import datetime

# no.9ディレクトリをパスに追加
NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if NO9_DIR not in sys.path:
    sys.path.insert(0, NO9_DIR)

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    _SLOWAPI_AVAILABLE = True
except ImportError:
    _SLOWAPI_AVAILABLE = False

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    APSCHEDULER_AVAILABLE = True
except ImportError:
    APSCHEDULER_AVAILABLE = False

from config.settings import settings
from engine import (
    category_manager,
    user_searcher,
    dm_generator,
    dm_sender,
    reply_monitor,
    analytics_manager,
    notification_sender,
    notion_fetcher,
)

# X Agentのアカウントマネージャーをインポート
# ローカル: Xエージェント/engine/account_manager.py
# Cloud Run: /app/shared_engine/account_manager.py
try:
    import importlib.util, pathlib
    _root = pathlib.Path(__file__).resolve().parent.parent.parent  # Xエージェント/
    _am_path = _root / "engine" / "account_manager.py"
    if not _am_path.exists():
        # Cloud Run フォールバック
        _am_path = pathlib.Path("/app/shared_engine/account_manager.py")
    if not _am_path.exists():
        raise FileNotFoundError("account_manager.py not found")
    # shared_config をパスに追加（account_managerがconfig.settingsをimportするため）
    _shared_config_dir = _am_path.parent.parent
    if str(_shared_config_dir) not in sys.path:
        sys.path.insert(0, str(_shared_config_dir))
    _spec = importlib.util.spec_from_file_location(
        "xagent_account_manager",
        str(_am_path),
    )
    _acct_mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_acct_mod)
    account_manager = _acct_mod
    _ACCOUNT_MANAGER_AVAILABLE = True
except Exception as _e:
    print(f"[WARN] account_manager import失敗: {_e}")
    account_manager = None
    _ACCOUNT_MANAGER_AVAILABLE = False

_scheduler = None
_cached_bearer_token: str = None


def _get_current_x_credentials() -> Dict[str, str]:
    """現在のアカウント（accounts.json）からX API認証情報を取得する。
    アカウントマネージャーが利用不可の場合は.envにフォールバック。"""
    if _ACCOUNT_MANAGER_AVAILABLE:
        try:
            acc = account_manager.get_current_account()
            if acc and acc.get("x_api_key"):
                return {
                    "api_key": acc["x_api_key"],
                    "api_secret": acc.get("x_api_secret", ""),
                    "access_token": acc.get("x_access_token", ""),
                    "access_token_secret": acc.get("x_access_token_secret", ""),
                }
        except Exception as e:
            print(f"[WARN] アカウント取得失敗、.envにフォールバック: {e}")
    return {
        "api_key": settings.X_API_KEY or "",
        "api_secret": settings.X_API_SECRET or "",
        "access_token": settings.X_ACCESS_TOKEN or "",
        "access_token_secret": settings.X_ACCESS_TOKEN_SECRET or "",
    }


def _get_bearer_token(api_key: str, api_secret: str) -> str:
    """APIキー・シークレットからBearer Tokenを取得する（stdlib使用）"""
    try:
        credentials = base64.b64encode(f"{api_key}:{api_secret}".encode()).decode()
        data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
        req = urllib.request.Request(
            "https://api.twitter.com/oauth2/token",
            data=data,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return _json.loads(resp.read()).get("access_token")
    except Exception as e:
        print(f"[WARN] Bearer token取得失敗: {e}")
        return None


def _get_cached_bearer_token() -> str:
    """キャッシュ付きBearer Token取得。現在アカウントの認証情報を優先的に使用する。"""
    global _cached_bearer_token
    if _cached_bearer_token:
        return _cached_bearer_token

    # 1. 現在アカウント（accounts.json）のx_api_key / x_api_secretからBearerTokenを生成
    if _ACCOUNT_MANAGER_AVAILABLE:
        try:
            acc = account_manager.get_current_account()
            if acc:
                key = acc.get("x_api_key", "")
                secret = acc.get("x_api_secret", "")
                if key and secret:
                    token = _get_bearer_token(key, secret)
                    if token:
                        _cached_bearer_token = token
                        return _cached_bearer_token
        except Exception as _e:
            print(f"[WARN] account_manager経由のBearer Token取得失敗: {_e}")

    # 2. .envのX_BEARER_TOKENをフォールバックとして使用
    if settings.X_BEARER_TOKEN:
        _cached_bearer_token = settings.X_BEARER_TOKEN
        return _cached_bearer_token

    # 3. .envのX_API_KEY / X_API_SECRETから生成
    if settings.X_API_KEY and settings.X_API_SECRET:
        _cached_bearer_token = _get_bearer_token(settings.X_API_KEY, settings.X_API_SECRET)
    return _cached_bearer_token


def _scheduled_poll():
    """5分ごとにDM返信をポーリング"""
    try:
        creds = _get_current_x_credentials()
        reply_monitor.poll_dm_replies(
            api_key=creds["api_key"],
            api_secret=creds["api_secret"],
            access_token=creds["access_token"],
            access_token_secret=creds["access_token_secret"],
            openai_api_key=settings.OPENAI_API_KEY,
        )
    except Exception as e:
        print(f"[WARN] Scheduled poll error: {e}")


def _scheduled_auto_send():
    """
    1分ごとに実行。自動送信が有効なら pending ターゲットへ1件DMを送信する。
    送信間隔は can_send() の next_allowed_at で自動制御される。
    """
    try:
        config = dm_sender.load_send_config()
        if not config.get("auto_send_enabled"):
            return

        # 送信可否チェック（インターバル・日次上限など）
        check = dm_sender.can_send()
        if not check["can_send"]:
            return

        # 対象カテゴリを決定
        all_categories = category_manager.list_categories()
        auto_cats = set(config.get("auto_send_categories", []))
        enabled_cat_ids = {
            c["id"] for c in all_categories
            if c.get("enabled") and (not auto_cats or c["id"] in auto_cats)
        }
        if not enabled_cat_ids:
            return

        # pending ターゲットをスコア降順で取得
        targets = user_searcher.list_targets(status="pending")
        targets = [t for t in targets if t["category_id"] in enabled_cat_ids]
        if not targets:
            return

        # 1件だけ送信（インターバルが次回をブロックするので複数送らない）
        for target in targets:
            cat = category_manager.get_category(target["category_id"])
            if not cat:
                continue

            # カテゴリ別上限チェック（テストモード考慮）
            cat_limit = cat.get("test_mode_limit", 3) if cat.get("test_mode") else None
            cat_check = dm_sender.can_send(target["category_id"], cat_limit)
            if not cat_check["can_send"]:
                continue

            # 送信済みチェック
            if dm_sender.check_already_sent(target["user_id"]):
                user_searcher.update_target_status(target["id"], "dm_sent")
                continue

            # テンプレート取得
            template = None
            if cat.get("dm_template_id"):
                templates = dm_generator.list_templates()
                template = next((t for t in templates if t["id"] == cat["dm_template_id"]), None)

            # DM生成
            notion_context = notion_fetcher.get_context(settings.NOTION_API_TOKEN, settings.NOTION_DATABASE_ID)
            dm_result = dm_generator.generate_dm(
                target=target,
                category=cat,
                template=template,
                tone=template.get("tone", "professional") if template else "professional",
                openai_api_key=settings.OPENAI_API_KEY,
                ab_test=False,
                source_context=notion_context,
            )
            dm_text = dm_result.get("text", "")
            if not dm_text:
                continue

            # 送信（アカウントマネージャーの認証情報を使用）
            creds = _get_current_x_credentials()
            result = dm_sender.send_dm(
                user_id=target["user_id"],
                username=target["username"],
                dm_text=dm_text,
                category_id=target["category_id"],
                target_id=target["id"],
                api_key=creds["api_key"],
                api_secret=creds["api_secret"],
                access_token=creds["access_token"],
                access_token_secret=creds["access_token_secret"],
                category_limit_override=cat_limit,
            )

            if result.get("success"):
                user_searcher.update_target_status(target["id"], "dm_sent")
                category_manager.update_category_stats(target["category_id"], sent_delta=1)

                # テストモード自動卒業チェック
                if cat.get("test_mode"):
                    updated = category_manager.get_category(target["category_id"])
                    if updated and updated["stats"]["total_sent"] >= updated.get("test_mode_graduate_at", 10):
                        category_manager.graduate_from_test_mode(target["category_id"])

                print(f"[AUTO-SEND] @{target['username']} へ送信完了（カテゴリ: {cat['name']}）")

            break  # 1件送ったら終了（インターバルが次回をブロック）

    except Exception as e:
        print(f"[WARN] Auto-send job error: {e}")


def _scheduled_replenish():
    """
    10分ごとに実行。pending ターゲットが replenish_threshold を下回ったカテゴリへ
    自動でユーザー検索・スコアリング・追加を行う。
    """
    try:
        config = dm_sender.load_send_config()
        if not config.get("auto_send_enabled"):
            return

        all_categories = category_manager.list_categories()
        auto_cats = set(config.get("auto_send_categories", []))
        bearer_token = _get_cached_bearer_token()

        log = config.get("replenish_log", [])
        changed = False

        for cat in all_categories:
            if not cat.get("enabled"):
                continue
            if auto_cats and cat["id"] not in auto_cats:
                continue
            if not cat.get("auto_replenish", True):
                continue

            # pending数チェック
            pending = user_searcher.list_targets(category_id=cat["id"], status="pending")
            threshold = cat.get("replenish_threshold", 5)
            if len(pending) >= threshold:
                continue

            # 検索キーワード構築（プロフィールKW > 投稿KW > ハッシュタグ）
            kws = (
                cat["conditions"].get("profile_keywords", [])
                + cat["conditions"].get("post_keywords", [])
                + cat["conditions"].get("hashtags", [])
            )
            if not kws:
                continue
            search_kw = " ".join(kws[:3])

            # 検索・スコアリング・追加（プロフィール検索優先）
            creds = _get_current_x_credentials()
            result = user_searcher.search_users(
                keyword=search_kw,
                max_results=20,
                search_mode="profile",
                bearer_token=bearer_token,
                api_key=creds["api_key"],
                api_secret=creds["api_secret"],
                access_token=creds["access_token"],
                access_token_secret=creds["access_token_secret"],
            )
            users = result["users"]
            scores = {}
            scored_users = []
            for user in users:
                score = user_searcher.calculate_score(user, cat["conditions"], cat["score_weights"])
                if score > 0:
                    scores[user["id"]] = score
                    scored_users.append(user)

            added = user_searcher.add_targets(scored_users, cat["id"], scores, search_keyword=search_kw)
            entry = {
                "at": datetime.now().isoformat(),
                "category_id": cat["id"],
                "category_name": cat["name"],
                "keyword": search_kw,
                "found": len(users),
                "added": len(added),
                "pending_before": len(pending),
            }
            log.append(entry)
            changed = True
            print(
                f"[REPLENISH] カテゴリ '{cat['name']}': {len(added)}件補充"
                f"（KW: {search_kw}、pending: {len(pending)} → {len(pending) + len(added)}）"
            )

        if changed:
            config["replenish_log"] = log[-30:]
            dm_sender.save_send_config(config)

    except Exception as e:
        print(f"[WARN] Replenish job error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    # 起動時にNotionの一次情報を取得・キャッシュ
    if settings.NOTION_API_TOKEN and settings.NOTION_DATABASE_ID:
        notion_fetcher.get_context(settings.NOTION_API_TOKEN, settings.NOTION_DATABASE_ID)
    else:
        print("[WARN] Notion未設定。NOTION_API_TOKEN / NOTION_DATABASE_ID を .env に設定してください。")

    if APSCHEDULER_AVAILABLE:
        _scheduler = BackgroundScheduler()
        _scheduler.add_job(_scheduled_poll, "interval", minutes=5, id="reply_poll")
        _scheduler.add_job(_scheduled_auto_send, "interval", minutes=1, id="auto_send")
        _scheduler.add_job(_scheduled_replenish, "interval", minutes=10, id="replenish")
        _scheduler.add_job(
            lambda: notion_fetcher.get_context(
                settings.NOTION_API_TOKEN, settings.NOTION_DATABASE_ID, force_refresh=True
            ),
            "interval", hours=1, id="notion_refresh"
        )
        _scheduler.start()
        print("[INFO] スケジューラー起動（返信ポーリング: 5分 / 自動送信チェック: 1分 / ターゲット補充: 10分 / Notion更新: 1時間）")
    else:
        print("[WARN] apscheduler未インストール。自動ポーリング・自動送信無効。")
    yield
    if _scheduler and _scheduler.running:
        _scheduler.shutdown()


app = FastAPI(
    title="X営業入口最適化システム API",
    description="no.9 - X Sales Entry Optimization System",
    version="1.0.0",
    lifespan=lifespan,
)

# レート制限（slowapi）
if _SLOWAPI_AVAILABLE:
    _limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
    app.state.limiter = _limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5001,http://localhost:5003")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Api-Key"],
)

# Firebase Hosting は /no9-api/** をプレフィックス付きのまま転送するため剥がす
@app.middleware("http")
async def strip_prefix_middleware(request: Request, call_next):
    if request.url.path.startswith("/no9-api"):
        request.scope["path"] = request.url.path[len("/no9-api"):] or "/"
    return await call_next(request)

# API認証ミドルウェア
_API_SECRET_KEY = os.getenv("API_SECRET_KEY", "").strip()

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    if _API_SECRET_KEY:
        api_key = request.headers.get("x-api-key")
        if api_key != _API_SECRET_KEY:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)


# ============================================================
# Pydantic Models
# ============================================================

class CategoryCreate(BaseModel):
    name: str
    description: str = ""
    profile_keywords: List[str] = []
    post_keywords: List[str] = []
    hashtags: List[str] = []
    exclude_keywords: List[str] = []
    follower_min: int = 0
    follower_max: int = 10000000
    post_frequency_min: int = 0
    last_post_days_max: int = 0
    engagement_threshold: float = 0.0
    is_verified_only: bool = False
    score_weights: Optional[Dict[str, float]] = None
    dm_template_id: Optional[str] = None
    auto_replenish: bool = True
    replenish_threshold: int = 5


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    conditions: Optional[Dict[str, Any]] = None
    score_weights: Optional[Dict[str, float]] = None
    dm_template_id: Optional[str] = None
    auto_replenish: Optional[bool] = None
    replenish_threshold: Optional[int] = None


class SearchRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    category_id: str
    max_results: int = Field(20, ge=1, le=100)
    score_threshold: float = Field(0.0, ge=0.0, le=100.0)
    search_mode: Literal["profile", "tweet"] = "profile"


class TemplateCreate(BaseModel):
    name: str
    category_id: str
    content: str
    tone: str = "professional"
    value_proposition: str = ""


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    tone: Optional[str] = None
    value_proposition: Optional[str] = None


class DMGenerateRequest(BaseModel):
    target_id: str
    category_id: str
    template_id: Optional[str] = None
    tone: str = "professional"
    ab_test: bool = False


class DMSendRequest(BaseModel):
    target_id: str
    dm_text: str


class ReplyAddRequest(BaseModel):
    dm_history_id: str
    user_id: str
    username: str
    reply_text: str
    category_id: str
    target_id: str


class ReplyUpdateRequest(BaseModel):
    status: str
    assigned_to: Optional[str] = None
    conversation_summary: Optional[str] = None


class TargetStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
    deal_result: Optional[str] = None  # won / lost / pending_deal / continuing


class BlacklistAdd(BaseModel):
    user_id: str
    username: str
    reason: str = ""


class SendConfigUpdate(BaseModel):
    daily_limit: Optional[int] = None
    per_category_daily_limit: Optional[int] = None
    min_interval_seconds: Optional[int] = None
    max_interval_seconds: Optional[int] = None
    enabled: Optional[bool] = None
    emergency_stop: Optional[bool] = None
    auto_send_enabled: Optional[bool] = None
    auto_send_categories: Optional[List[str]] = None


class MeetingRegisterRequest(BaseModel):
    reply_id: str
    meeting_datetime: str
    notes: str = ""


# ============================================================
# Health Check
# ============================================================

@app.get("/health")
def health_check():
    return {"status": "ok", "system": "X営業入口最適化システム", "version": "1.0.0"}


# ============================================================
# アカウント管理 API（No.9独自 - X Agentとは独立）
# ============================================================

import pathlib as _pathlib

_NO9_CURRENT_ACC_FILE = _pathlib.Path(settings.NO9_DATA_DIR) / "current_account.json"


def _no9_get_current_account_id() -> Optional[str]:
    """No.9専用のcurrent_account.jsonからIDを読む。なければNone。"""
    try:
        if _NO9_CURRENT_ACC_FILE.exists():
            data = _json.loads(_NO9_CURRENT_ACC_FILE.read_text())
            return data.get("current_account_id")
    except Exception:
        pass
    return None


def _no9_save_current_account_id(account_id: str):
    _NO9_CURRENT_ACC_FILE.write_text(_json.dumps({"current_account_id": account_id}))


import re as _re

_ACCOUNT_ID_PATTERN = _re.compile(r'^[a-zA-Z0-9_]{1,64}$')
_ACCOUNT_NAME_MAX = 100
_CREDENTIAL_MAX = 256


def _validate_account_id(account_id: str):
    if not _ACCOUNT_ID_PATTERN.match(account_id):
        raise HTTPException(status_code=422, detail="アカウントIDは英数字・アンダースコアのみ（1-64文字）")


def _validate_credential_length(value: str, field: str):
    if len(value) > _CREDENTIAL_MAX:
        raise HTTPException(status_code=422, detail=f"{field}が長すぎます（最大{_CREDENTIAL_MAX}文字）")


class AddAccountRequest(BaseModel):
    id: str
    name: str
    x_api_key: str
    x_api_secret: str
    x_access_token: str
    x_access_token_secret: str

class EditAccountRequest(BaseModel):
    name: str
    x_api_key: str
    x_api_secret: str
    x_access_token: str
    x_access_token_secret: str


@app.post("/accounts")
def add_account(request: AddAccountRequest):
    if not _ACCOUNT_MANAGER_AVAILABLE:
        raise HTTPException(status_code=503, detail="account_manager利用不可")
    _validate_account_id(request.id)
    if not request.name or len(request.name) > _ACCOUNT_NAME_MAX:
        raise HTTPException(status_code=422, detail=f"アカウント名は1-{_ACCOUNT_NAME_MAX}文字で入力してください")
    for field_name, value in [("x_api_key", request.x_api_key), ("x_api_secret", request.x_api_secret),
                               ("x_access_token", request.x_access_token), ("x_access_token_secret", request.x_access_token_secret)]:
        _validate_credential_length(value, field_name)
    try:
        result = account_manager.add_account(
            account_id=request.id,
            name=request.name,
            x_api_key=request.x_api_key,
            x_api_secret=request.x_api_secret,
            x_access_token=request.x_access_token,
            x_access_token_secret=request.x_access_token_secret,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.put("/accounts/{account_id}")
def edit_account(account_id: str, request: EditAccountRequest):
    if not _ACCOUNT_MANAGER_AVAILABLE:
        raise HTTPException(status_code=503, detail="account_manager利用不可")
    _validate_account_id(account_id)
    if not request.name or len(request.name) > _ACCOUNT_NAME_MAX:
        raise HTTPException(status_code=422, detail=f"アカウント名は1-{_ACCOUNT_NAME_MAX}文字で入力してください")
    for field_name, value in [("x_api_key", request.x_api_key), ("x_api_secret", request.x_api_secret),
                               ("x_access_token", request.x_access_token), ("x_access_token_secret", request.x_access_token_secret)]:
        _validate_credential_length(value, field_name)
    success = account_manager.edit_account(
        account_id=account_id,
        name=request.name,
        x_api_key=request.x_api_key,
        x_api_secret=request.x_api_secret,
        x_access_token=request.x_access_token,
        x_access_token_secret=request.x_access_token_secret,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"status": "updated"}


@app.delete("/accounts/{account_id}")
def remove_account(account_id: str):
    if not _ACCOUNT_MANAGER_AVAILABLE:
        raise HTTPException(status_code=503, detail="account_manager利用不可")
    _validate_account_id(account_id)
    success = account_manager.delete_account(account_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete current account or account not found")
    return {"status": "deleted"}


@app.get("/accounts")
def get_accounts():
    if not _ACCOUNT_MANAGER_AVAILABLE:
        raise HTTPException(status_code=503, detail="account_manager利用不可")
    # アカウントリストはX Agentと共有、ただしis_currentはNo.9独自で管理
    all_accs = account_manager.load_accounts()
    no9_current_id = _no9_get_current_account_id()
    if no9_current_id is None:
        # 初回：X Agentのcurrentをデフォルト値として使う（書き込みはしない）
        for acc in all_accs:
            acc["is_current"] = bool(acc.get("is_current"))
    else:
        for acc in all_accs:
            acc["is_current"] = acc["id"] == no9_current_id
    return all_accs


@app.get("/accounts/current")
def get_current_account():
    if not _ACCOUNT_MANAGER_AVAILABLE:
        raise HTTPException(status_code=503, detail="account_manager利用不可")
    # No.9専用のcurrent_account.jsonが設定済みの場合のみ返す（X Agentのcurrentは引き継がない）
    no9_current_id = _no9_get_current_account_id()
    if not no9_current_id:
        return None
    all_accs = account_manager.load_accounts()
    acc = next((a for a in all_accs if a["id"] == no9_current_id), None)
    if not acc:
        return None
    return {"id": acc["id"], "name": acc["name"]}


@app.post("/accounts/switch/{account_id}")
def switch_account(account_id: str):
    if not _ACCOUNT_MANAGER_AVAILABLE:
        raise HTTPException(status_code=503, detail="account_manager利用不可")
    all_accs = account_manager.load_accounts()
    target = next((a for a in all_accs if a["id"] == account_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="アカウントが見つかりません")
    # No.9専用ファイルだけ更新（X Agentのaccounts.jsonには触らない）
    _no9_save_current_account_id(account_id)
    return {"success": True, "current": {"id": target["id"], "name": target["name"]}}


# ============================================================
# カテゴリ管理 API
# ============================================================

@app.get("/categories")
def get_categories():
    return category_manager.list_categories()


@app.post("/categories")
def create_category(req: CategoryCreate):
    return category_manager.create_category(
        name=req.name,
        description=req.description,
        profile_keywords=req.profile_keywords,
        post_keywords=req.post_keywords,
        hashtags=req.hashtags,
        exclude_keywords=req.exclude_keywords,
        follower_min=req.follower_min,
        follower_max=req.follower_max,
        post_frequency_min=req.post_frequency_min,
        last_post_days_max=req.last_post_days_max,
        engagement_threshold=req.engagement_threshold,
        is_verified_only=req.is_verified_only,
        score_weights=req.score_weights,
        dm_template_id=req.dm_template_id,
        auto_replenish=req.auto_replenish,
        replenish_threshold=req.replenish_threshold,
    )


@app.get("/categories/{category_id}")
def get_category(category_id: str):
    cat = category_manager.get_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")
    return cat


@app.put("/categories/{category_id}")
def update_category(category_id: str, req: CategoryUpdate):
    updates = req.model_dump(exclude_none=True)
    cat = category_manager.update_category(category_id, updates)
    if not cat:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")
    return cat


@app.delete("/categories/{category_id}")
def delete_category(category_id: str):
    success = category_manager.delete_category(category_id)
    if not success:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")
    return {"success": True}


@app.post("/categories/{category_id}/toggle")
def toggle_category(category_id: str):
    cat = category_manager.toggle_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")
    return cat


@app.post("/categories/{category_id}/duplicate")
def duplicate_category(category_id: str):
    cat = category_manager.duplicate_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")
    return cat


@app.post("/categories/{category_id}/graduate")
def graduate_category(category_id: str):
    """テストモードを手動で卒業させ通常運用に移行する"""
    cat = category_manager.graduate_from_test_mode(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")
    return cat


# ============================================================
# ターゲット検索・管理 API
# ============================================================

@app.post("/targets/search")
def search_targets(req: SearchRequest):
    """X APIでユーザーを検索し、スコアリングしてターゲットに追加"""
    category = category_manager.get_category(req.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")

    # ユーザー検索（統合ディスパッチ）
    creds = _get_current_x_credentials()
    result = user_searcher.search_users(
        keyword=req.keyword,
        max_results=req.max_results,
        search_mode=req.search_mode,
        bearer_token=_get_cached_bearer_token(),
        api_key=creds["api_key"],
        api_secret=creds["api_secret"],
        access_token=creds["access_token"],
        access_token_secret=creds["access_token_secret"],
    )
    users = result["users"]
    search_mode_used = result["search_mode_used"]

    # スコアリング
    scores = {}
    scored_users = []
    for user in users:
        score = user_searcher.calculate_score(
            user=user,
            conditions=category["conditions"],
            weights=category["score_weights"],
        )
        if score > 0 and score >= req.score_threshold:
            scores[user["id"]] = score
            user["score"] = score
            scored_users.append(user)

    # ターゲットとして保存（検索キーワードも記録）
    new_targets = user_searcher.add_targets(scored_users, req.category_id, scores, search_keyword=req.keyword)

    return {
        "found": len(users),
        "scored": len(scored_users),
        "added": len(new_targets),
        "targets": new_targets,
        "search_mode_used": search_mode_used,
    }


@app.get("/targets")
def list_targets(
    category_id: str = Query(None),
    status: str = Query(None),
    min_score: float = Query(0.0),
    limit: int = Query(100),
    offset: int = Query(0),
):
    return user_searcher.list_targets(
        category_id=category_id,
        status=status,
        min_score=min_score,
        limit=limit,
        offset=offset,
    )


@app.get("/targets/stats")
def get_target_stats():
    return user_searcher.get_target_stats()


@app.put("/targets/{target_id}/status")
def update_target_status(target_id: str, req: TargetStatusUpdate):
    target = user_searcher.update_target_status(target_id, req.status, req.notes, req.deal_result)
    if not target:
        raise HTTPException(status_code=404, detail="ターゲットが見つかりません")
    return target


@app.post("/targets/blacklist")
def add_to_blacklist(req: BlacklistAdd):
    user_searcher.add_to_blacklist(req.user_id, req.username, req.reason)
    return {"success": True}


@app.get("/targets/replenish-status")
def get_replenish_status():
    """自動ターゲット補充の状態を返す（カテゴリ別 pending 数・補充ログ）"""
    config = dm_sender.load_send_config()
    all_categories = category_manager.list_categories()

    by_category = []
    for cat in all_categories:
        if not cat.get("enabled"):
            continue
        pending = user_searcher.list_targets(category_id=cat["id"], status="pending")
        threshold = cat.get("replenish_threshold", 5)
        by_category.append({
            "category_id": cat["id"],
            "category_name": cat["name"],
            "pending": len(pending),
            "replenish_threshold": threshold,
            "auto_replenish": cat.get("auto_replenish", True),
            "needs_replenish": len(pending) < threshold and cat.get("auto_replenish", True),
        })

    return {
        "log": config.get("replenish_log", [])[-20:],
        "by_category": by_category,
    }


@app.post("/targets/{target_id}/mark-replied")
def mark_target_replied(target_id: str):
    """ターゲットを手動で「返信あり」に更新し、返信レコードを作成する。
    X APIのE2E暗号化により自動検出が不可能なため、手動登録用。"""
    targets = user_searcher.list_targets()
    target = next((t for t in targets if t["id"] == target_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="ターゲットが見つかりません")

    # DM履歴から送信済みエントリを検索
    history = dm_sender.list_dm_history()
    sent_dm = next(
        (h for h in history if h.get("user_id") == target["user_id"] and h.get("status") == "sent"),
        None,
    )
    dm_history_id = sent_dm["id"] if sent_dm else ""

    # 返信レコード作成（暗号化扱い）
    reply = reply_monitor.add_reply(
        dm_history_id=dm_history_id,
        user_id=target["user_id"],
        username=target["username"],
        reply_text="",
        category_id=target["category_id"],
        target_id=target["id"],
        openai_api_key=settings.OPENAI_API_KEY,
        dm_event_id=f"manual_{datetime.now().strftime('%Y%m%d%H%M%S')}_{target_id[:8]}",
        is_encrypted=True,
    )

    # ターゲットステータスを「返信あり」に更新
    user_searcher.update_target_status(target_id, "replied")
    category_manager.update_category_stats(target["category_id"], replied_delta=1)

    return {"success": True, "reply": reply}


@app.delete("/targets/{target_id}")
def delete_target(target_id: str):
    """指定IDのターゲットを個別削除"""
    success = user_searcher.delete_target(target_id)
    if not success:
        raise HTTPException(status_code=404, detail="ターゲットが見つかりません")
    return {"success": True}


@app.delete("/targets")
def delete_all_targets():
    """全ターゲットを一括削除"""
    count = user_searcher.delete_all_targets()
    return {"success": True, "deleted": count}


@app.post("/categories/{category_id}/replenish")
def replenish_category_targets(category_id: str):
    """カテゴリのターゲットを手動補充する"""
    cat = category_manager.get_category(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")

    kws = (
        cat["conditions"].get("profile_keywords", [])
        + cat["conditions"].get("post_keywords", [])
        + cat["conditions"].get("hashtags", [])
    )
    if not kws:
        raise HTTPException(status_code=400, detail="検索キーワードが設定されていません。プロフィールKWまたは投稿KWを設定してください。")

    search_kw = " ".join(kws[:3])
    bearer_token = _get_cached_bearer_token()
    creds = _get_current_x_credentials()

    result = user_searcher.search_users(
        keyword=search_kw,
        max_results=20,
        search_mode="profile",
        bearer_token=bearer_token,
        api_key=creds["api_key"],
        api_secret=creds["api_secret"],
        access_token=creds["access_token"],
        access_token_secret=creds["access_token_secret"],
    )
    users = result["users"]
    scores = {}
    scored_users = []
    for user in users:
        score = user_searcher.calculate_score(user, cat["conditions"], cat["score_weights"])
        if score > 0:
            scores[user["id"]] = score
            scored_users.append(user)

    added = user_searcher.add_targets(scored_users, category_id, scores, search_keyword=search_kw)

    # ログ記録
    config = dm_sender.load_send_config()
    log = config.get("replenish_log", [])
    log.append({
        "at": datetime.now().isoformat(),
        "category_id": cat["id"],
        "category_name": cat["name"],
        "keyword": search_kw,
        "found": len(users),
        "added": len(added),
        "pending_before": len(user_searcher.list_targets(category_id=category_id, status="pending")) - len(added),
    })
    config["replenish_log"] = log[-30:]
    dm_sender.save_send_config(config)

    print(f"[REPLENISH] 手動補充 '{cat['name']}': {len(added)}件追加（KW: {search_kw}）")
    return {"found": len(users), "scored": len(scored_users), "added": len(added), "keyword": search_kw}


# ============================================================
# DMテンプレート管理 API
# ============================================================

@app.get("/templates")
def list_templates(category_id: str = Query(None)):
    return dm_generator.list_templates(category_id)


@app.post("/templates")
def create_template(req: TemplateCreate):
    return dm_generator.create_template(
        name=req.name,
        category_id=req.category_id,
        content=req.content,
        tone=req.tone,
        value_proposition=req.value_proposition,
    )


@app.put("/templates/{template_id}")
def update_template(template_id: str, req: TemplateUpdate):
    updates = req.model_dump(exclude_none=True)
    t = dm_generator.update_template(template_id, updates)
    if not t:
        raise HTTPException(status_code=404, detail="テンプレートが見つかりません")
    return t


@app.delete("/templates/{template_id}")
def delete_template(template_id: str):
    success = dm_generator.delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="テンプレートが見つかりません")
    return {"success": True}


# ============================================================
# DM生成・送信 API
# ============================================================

@app.post("/dm/generate")
def generate_dm(req: DMGenerateRequest):
    """パーソナライズDMを生成する（送信しない）"""
    targets = user_searcher.list_targets()
    target = next((t for t in targets if t["id"] == req.target_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="ターゲットが見つかりません")

    category = category_manager.get_category(req.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")

    template = None
    if req.template_id:
        templates = dm_generator.list_templates()
        template = next((t for t in templates if t["id"] == req.template_id), None)

    notion_context = notion_fetcher.get_context(settings.NOTION_API_TOKEN, settings.NOTION_DATABASE_ID)
    result = dm_generator.generate_dm(
        target=target,
        category=category,
        template=template,
        tone=req.tone,
        openai_api_key=settings.OPENAI_API_KEY,
        ab_test=req.ab_test,
        source_context=notion_context,
    )
    return result


@app.post("/dm/send")
def send_dm(req: DMSendRequest):
    """DM送信（安全管理付き）。テストモードカテゴリは制限上限を絞る。"""
    targets = user_searcher.list_targets()
    target = next((t for t in targets if t["id"] == req.target_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="ターゲットが見つかりません")

    # テストモード判定
    category = category_manager.get_category(target["category_id"])
    category_limit_override = None
    if category and category.get("test_mode"):
        category_limit_override = category.get("test_mode_limit", 3)

    creds = _get_current_x_credentials()
    result = dm_sender.send_dm(
        user_id=target["user_id"],
        username=target["username"],
        dm_text=req.dm_text,
        category_id=target["category_id"],
        target_id=target["id"],
        api_key=creds["api_key"],
        api_secret=creds["api_secret"],
        access_token=creds["access_token"],
        access_token_secret=creds["access_token_secret"],
        category_limit_override=category_limit_override,
    )

    if result.get("success"):
        user_searcher.update_target_status(target["id"], "dm_sent")
        category_manager.update_category_stats(target["category_id"], sent_delta=1)

        # テストモード自動卒業チェック
        if category and category.get("test_mode"):
            updated_cat = category_manager.get_category(target["category_id"])
            graduate_at = updated_cat.get("test_mode_graduate_at", 10) if updated_cat else 10
            if updated_cat and updated_cat["stats"]["total_sent"] >= graduate_at:
                category_manager.graduate_from_test_mode(target["category_id"])
                result["test_mode_graduated"] = True

    if category_limit_override is not None:
        result["test_mode"] = True
        result["test_mode_limit"] = category_limit_override

    return result


@app.get("/dm/history")
def list_dm_history(
    category_id: str = Query(None),
    status: str = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
):
    return dm_sender.list_dm_history(category_id=category_id, status=status, limit=limit, offset=offset)


@app.get("/dm/health")
def get_health_score():
    return dm_sender.get_health_score()


@app.get("/dm/config")
def get_send_config():
    return dm_sender.load_send_config()


@app.put("/dm/config")
def update_send_config(req: SendConfigUpdate):
    config = dm_sender.load_send_config()
    updates = req.model_dump(exclude_none=True)
    config.update(updates)
    dm_sender.save_send_config(config)
    return config


@app.get("/dm/send-status")
def get_send_interval_status():
    """送信間隔の現在状況を取得"""
    return dm_sender.get_send_interval_status()


@app.get("/dm/auto-send/status")
def get_auto_send_status():
    """自動送信の現在状態を返す"""
    config = dm_sender.load_send_config()
    interval = dm_sender.get_send_interval_status()
    targets = user_searcher.list_targets(status="pending")
    return {
        "auto_send_enabled": config.get("auto_send_enabled", False),
        "auto_send_categories": config.get("auto_send_categories", []),
        "pending_targets": len(targets),
        "can_send_now": interval["can_send_now"],
        "wait_seconds": interval["wait_seconds"],
        "next_allowed_at": interval["next_allowed_at"],
        "last_sent_at": interval["last_sent_at"],
    }


@app.post("/dm/auto-send/enable")
def enable_auto_send(categories: Optional[List[str]] = None):
    """自動送信を有効化する。categories を指定すると対象カテゴリを絞れる。"""
    config = dm_sender.load_send_config()
    config["auto_send_enabled"] = True
    if categories is not None:
        config["auto_send_categories"] = categories
    dm_sender.save_send_config(config)
    return {"success": True, "auto_send_enabled": True}


@app.post("/dm/auto-send/disable")
def disable_auto_send():
    """自動送信を無効化する"""
    config = dm_sender.load_send_config()
    config["auto_send_enabled"] = False
    dm_sender.save_send_config(config)
    return {"success": True, "auto_send_enabled": False}


@app.post("/dm/emergency-stop")
def emergency_stop():
    dm_sender.emergency_stop()
    return {"success": True, "message": "緊急停止しました"}


@app.post("/dm/resume")
def resume_sending():
    dm_sender.resume_sending()
    return {"success": True, "message": "送信を再開しました"}


# ============================================================
# 返信管理 API
# ============================================================

@app.get("/replies")
def list_replies(
    category_id: str = Query(None),
    status: str = Query(None),
    requires_human: Optional[bool] = Query(None),
    sentiment: str = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
):
    return reply_monitor.list_replies(
        category_id=category_id,
        status=status,
        requires_human=requires_human,
        sentiment=sentiment,
        limit=limit,
        offset=offset,
    )


@app.post("/replies")
def add_reply(req: ReplyAddRequest):
    """返信を手動追加（webhook等から呼び出し）"""
    reply = reply_monitor.add_reply(
        dm_history_id=req.dm_history_id,
        user_id=req.user_id,
        username=req.username,
        reply_text=req.reply_text,
        category_id=req.category_id,
        target_id=req.target_id,
        openai_api_key=settings.OPENAI_API_KEY,
    )

    # 有効返信はLINEに通知
    if reply["classification"].get("requires_human"):
        notification_sender.notify_positive_reply(reply, settings.LINE_NOTIFY_TOKEN)
        user_searcher.update_target_status(req.target_id, "replied")
        category_manager.update_category_stats(req.category_id, replied_delta=1)

    return reply


@app.put("/replies/{reply_id}")
def update_reply(reply_id: str, req: ReplyUpdateRequest):
    reply = reply_monitor.update_reply_status(
        reply_id=reply_id,
        status=req.status,
        assigned_to=req.assigned_to,
        conversation_summary=req.conversation_summary,
    )
    if not reply:
        raise HTTPException(status_code=404, detail="返信が見つかりません")
    return reply


@app.get("/replies/stats")
def get_reply_stats():
    return reply_monitor.get_reply_stats()


@app.post("/replies/poll")
def poll_replies():
    """DM返信を手動ポーリング"""
    creds = _get_current_x_credentials()
    return reply_monitor.poll_dm_replies(
        api_key=creds["api_key"],
        api_secret=creds["api_secret"],
        access_token=creds["access_token"],
        access_token_secret=creds["access_token_secret"],
        openai_api_key=settings.OPENAI_API_KEY,
    )


@app.get("/replies/poll-status")
def get_poll_status():
    """ポーリング状況を取得"""
    return reply_monitor.get_poll_status()


# ============================================================
# 商談管理 API
# ============================================================

@app.post("/meetings/register")
def register_meeting(req: MeetingRegisterRequest):
    """商談をGoogle Calendarに登録し、LINEに通知"""
    replies = reply_monitor.list_replies()
    reply = next((r for r in replies if r["id"] == req.reply_id), None)
    if not reply:
        raise HTTPException(status_code=404, detail="返信が見つかりません")

    calendar_credentials = None
    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REFRESH_TOKEN:
        calendar_credentials = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": settings.GOOGLE_REFRESH_TOKEN,
        }

    result = notification_sender.register_business_meeting(
        reply=reply,
        meeting_datetime=req.meeting_datetime,
        notes=req.notes,
        line_notify_token=settings.LINE_NOTIFY_TOKEN,
        calendar_credentials=calendar_credentials,
        calendar_id=settings.GOOGLE_CALENDAR_ID,
    )

    # ターゲットをconvertedに更新
    user_searcher.update_target_status(reply["target_id"], "converted")

    return result


# ============================================================
# アナリティクス API
# ============================================================

@app.get("/analytics/overview")
def get_analytics_overview():
    return analytics_manager.get_overview()


@app.get("/analytics/daily")
def get_daily_stats(days: int = Query(14)):
    return analytics_manager.get_daily_stats(days)


@app.get("/analytics/categories")
def get_category_stats():
    return analytics_manager.get_category_stats()


@app.get("/analytics/templates")
def get_template_stats():
    return analytics_manager.get_template_stats()


@app.get("/analytics/time-distribution")
def get_time_distribution():
    return analytics_manager.get_time_distribution()


@app.get("/analytics/keywords")
def get_keyword_stats():
    return analytics_manager.get_keyword_stats()


# ============================================================
# エントリーポイント
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.NO9_API_PORT,
        reload=True,
    )
