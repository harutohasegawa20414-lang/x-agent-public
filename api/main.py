import os
import sys

# プロジェクトのルートディレクトリを探索パスに追加（インポートエラーの根本解決）
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
import random
import time
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import List, Optional

# プロジェクトのルートディレクトリを探索パスに追加
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from engine.style_loader import load_style, load_custom_styles, save_custom_styles, save_style_username
from engine.generated_posts_manager import load_generated_posts, save_generated_post, delete_generated_post
from engine.prompt_builder import build_system_prompt, build_user_prompt
from engine.post_generator import PostGenerator
from engine.x_poster import XPoster
from engine.history_manager import load_history, save_post, delete_post, update_post_status
from engine import account_manager
from engine.source_fetcher import SourceAggregator
from engine.chat_agent import ChatAgent
from engine.scheduler import scheduler_instance
from engine.tweet_fetcher import fetch_recent_tweets, TweetFetchAuthError
from engine.style_extractor import extract_and_save_style
from engine.frameworks_manager import load_frameworks, save_frameworks, get_framework, delete_framework as delete_fw
from engine.framework_extractor import extract_frameworks

# Shared data
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
COMPANY_INFO_PATH = os.path.join(DATA_DIR, "color_monster.json")
STYLES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "styles")
COMPANY_INFO = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load company info and start scheduler
    global COMPANY_INFO
    if os.path.exists(COMPANY_INFO_PATH):
        with open(COMPANY_INFO_PATH, 'r', encoding='utf-8') as f:
            COMPANY_INFO = json.load(f)

    await scheduler_instance.start()
    yield
    # Shutdown: Stop scheduler
    await scheduler_instance.stop()

app = FastAPI(title="X Automation API", lifespan=lifespan)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_company_info():
    return COMPANY_INFO

# Models
class GenerateRequest(BaseModel):
    style: str
    topic: str
    context_override: Optional[str] = None
    framework_id: Optional[str] = None

class SaveFrameworksRequest(BaseModel):
    frameworks: List[dict]
    style_name: str

class ExtractByUsernameRequest(BaseModel):
    x_username: str

class PostRequest(BaseModel):
    content: str
    style_id: Optional[str] = ""
    style_name: Optional[str] = ""

class StyleResponse(BaseModel):
    id: str
    name: str
    is_custom: bool = False

class AddCustomStyleRequest(BaseModel):
    name: str
    x_username: Optional[str] = None

class UpdateStyleUsernameRequest(BaseModel):
    x_username: str

class SwitchAccountRequest(BaseModel):
    account_id: str

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

class ChatMessageRequest(BaseModel):
    message: str
    history: List[dict] = []

class ChatSessionData(BaseModel):
    messages: List[dict] = []
    active_context: Optional[str] = None

# ─── スタイル ───────────────────────────────────────────────

@app.get("/api/styles", response_model=List[StyleResponse])
async def get_styles():
    styles = []
    # custom_styles.json に登録済みのIDは styles/ ディレクトリで重複しないようスキップ
    custom_ids = {c["id"] for c in load_custom_styles()}
    for f in sorted(os.listdir(STYLES_DIR)):
        if f.endswith(".json"):
            style_id = f.replace(".json", "")
            if style_id in custom_ids:
                continue  # custom_styles.json で管理されているものは除外
            with open(os.path.join(STYLES_DIR, f), 'r', encoding='utf-8') as sf:
                data = json.load(sf)
                styles.append(StyleResponse(id=style_id, name=data.get("name", style_id)))
    # カスタムスタイルを追加
    for c in load_custom_styles():
        styles.append(StyleResponse(id=c["id"], name=c["name"], is_custom=True))
    return styles

@app.post("/api/styles/custom", response_model=StyleResponse)
async def add_custom_style(request: AddCustomStyleRequest):
    """アカウント名のみでカスタムスタイルを追加する"""
    import time as _time
    styles = load_custom_styles()

    # 同名チェック（カスタムスタイル + 固定スタイル）
    existing_names = {c["name"].strip().lower() for c in styles}
    custom_ids = {c["id"] for c in styles}
    for fname in os.listdir(STYLES_DIR):
        if fname.endswith(".json"):
            sid = fname.replace(".json", "")
            if sid not in custom_ids:
                try:
                    with open(os.path.join(STYLES_DIR, fname), "r", encoding="utf-8") as sf:
                        existing_names.add(json.load(sf).get("name", "").strip().lower())
                except Exception:
                    pass
    if request.name.strip().lower() in existing_names:
        raise HTTPException(status_code=409, detail=f"「{request.name.strip()}」という名前のスタイルは既に存在します")

    new_id = f"custom_{int(_time.time() * 1000)}"
    new_style = {"id": new_id, "name": request.name.strip()}
    if request.x_username and request.x_username.strip():
        new_style["x_username"] = request.x_username.strip().lstrip("@")
    styles.append(new_style)
    save_custom_styles(styles)

    # x_username が指定されていれば style_usernames.json にも保存
    if request.x_username and request.x_username.strip():
        save_style_username(new_id, request.x_username.strip())

    # スケジューラージョブを自動作成（無効状態・デフォルト毎日9時）
    config = scheduler_instance.load_config()
    config.setdefault("jobs", []).append({
        "id": f"job_{new_id}",
        "account_id": "default",
        "style_id": new_id,
        "topic": "",
        "content": "",
        "cron": "0 9 * * *",
        "enabled": False,
    })
    scheduler_instance.save_config(config)

    return StyleResponse(id=new_id, name=new_style["name"], is_custom=True)

@app.delete("/api/styles/custom/{style_id}")
async def delete_custom_style(style_id: str):
    """カスタムスタイルを削除する（スケジュール・生成済み投稿も連動削除）"""
    styles = load_custom_styles()
    new_styles = [s for s in styles if s["id"] != style_id]
    if len(new_styles) == len(styles):
        raise HTTPException(status_code=404, detail="Custom style not found")
    save_custom_styles(new_styles)

    # 対応するスケジューラージョブを削除
    config = scheduler_instance.load_config()
    config["jobs"] = [j for j in config.get("jobs", []) if j.get("style_id") != style_id]
    scheduler_instance.save_config(config)

    # 生成済み投稿も削除
    delete_generated_post(style_id)

    return {"status": "deleted"}

@app.put("/api/styles/{style_id}/username")
async def update_style_username(style_id: str, request: UpdateStyleUsernameRequest):
    """スタイルの x_username を data/style_usernames.json に保存する"""
    save_style_username(style_id, request.x_username)
    return {"status": "saved", "style_id": style_id, "x_username": request.x_username.strip().lstrip("@")}

# ─── 生成 ────────────────────────────────────────────────────

@app.post("/api/generate")
def generate_post(request: GenerateRequest):
    style = load_style(request.style)
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")

    company_info = load_company_info()

    # ツイートフェッチ（x_username が設定されている場合）
    tweet_examples = None
    if style.x_username:
        current = account_manager.get_current_account()
        consumer_key = current.get("x_api_key") if current else None
        consumer_secret = current.get("x_api_secret") if current else None
        access_token = current.get("x_access_token") if current else None
        access_token_secret = current.get("x_access_token_secret") if current else None
        tweet_examples = fetch_recent_tweets(
            x_username=style.x_username,
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )

        # カスタムスタイルで styles/{id}.json が未生成の場合: 初回のみスタイル抽出
        style_json_path = os.path.join(STYLES_DIR, f"{request.style}.json")
        if style.tone.get("is_custom") and tweet_examples and not os.path.exists(style_json_path):
            print(f"[API] Extracting style for custom profile: {request.style}")
            extracted = extract_and_save_style(request.style, style.name, tweet_examples)
            if extracted:
                # 抽出済みスタイルを再ロード
                style = load_style(request.style)

    # フレームワーク取得（指定されている場合）スタイル固有 → グローバル の順で探す
    framework = None
    if request.framework_id:
        framework = get_framework(request.style, request.framework_id)
        if framework is None:
            framework = get_framework("__global__", request.framework_id)

    system_prompt = build_system_prompt(style, tweet_examples=tweet_examples, framework=framework)

    # Google Drive / Notion から取得済みの一次情報を活用
    if request.context_override is not None:
        source_text = request.context_override
    else:
        aggregator = SourceAggregator()
        aggregator.get_sources()  # キャッシュ確認・更新
        source_text = aggregator.get_combined_text()

    user_prompt = build_user_prompt(request.topic, company_info, source_text)

    generator = PostGenerator()
    variations = generator.generate_variations(system_prompt, user_prompt)

    if not variations:
        raise HTTPException(status_code=500, detail="Failed to generate content")

    # 生成済み投稿をバックエンドに永続化（contents 配列 + content 先頭）
    save_generated_post(
        style_id=request.style,
        style_name=style.name,
        content=variations[0],
        topic=request.topic,
        contents=variations,
    )

    return {"content": variations[0], "contents": variations, "style": style.name}

# ─── フレームワーク ─────────────────────────────────────────

@app.post("/api/frameworks/extract-by-username")
async def extract_frameworks_by_username(request: ExtractByUsernameRequest):
    """任意のXユーザー名からツイートを取得し、フレームワーク候補を返す（保存しない）"""
    username = request.x_username.strip().lstrip("@")
    if not username:
        raise HTTPException(status_code=400, detail="Xユーザー名を入力してください")

    current = account_manager.get_current_account()
    consumer_key = current.get("x_api_key") if current else None
    consumer_secret = current.get("x_api_secret") if current else None
    access_token = current.get("x_access_token") if current else None
    access_token_secret = current.get("x_access_token_secret") if current else None

    try:
        tweets = fetch_recent_tweets(
            x_username=username,
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
            max_results=20,
        )
    except TweetFetchAuthError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not tweets:
        raise HTTPException(
            status_code=503,
            detail=f"@{username} のツイートを取得できませんでした。ユーザー名が正しいか確認してください。",
        )

    tweet_text = "\n".join(tweets)
    frameworks = extract_frameworks(username, tweet_text)
    if not frameworks:
        raise HTTPException(status_code=503, detail="フレームワークの生成に失敗しました。しばらく待ってから再試行してください。")

    return {"frameworks": frameworks, "x_username": username}

@app.get("/api/frameworks/{style_id}")
async def get_frameworks(style_id: str):
    """指定スタイルの保存済みフレームワーク一覧を返す"""
    entry = load_frameworks(style_id)
    return entry

@app.post("/api/frameworks/{style_id}/generate")
async def generate_frameworks_endpoint(style_id: str):
    """X APIでツイートを取得し Gemini で10個のフレームワーク候補を返す（保存しない）"""
    style = load_style(style_id)
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    if not style.x_username:
        raise HTTPException(status_code=400, detail="このスタイルにはXユーザー名が設定されていません。先にユーザー名を登録してください。")

    current = account_manager.get_current_account()
    consumer_key = current.get("x_api_key") if current else None
    consumer_secret = current.get("x_api_secret") if current else None
    access_token = current.get("x_access_token") if current else None
    access_token_secret = current.get("x_access_token_secret") if current else None

    try:
        tweets = fetch_recent_tweets(
            x_username=style.x_username,
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
            max_results=20,
        )
    except TweetFetchAuthError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not tweets:
        raise HTTPException(
            status_code=503,
            detail=f"@{style.x_username} のツイートを取得できませんでした。ユーザー名が正しいか確認してください。",
        )

    tweet_text = "\n".join(tweets)
    frameworks = extract_frameworks(style.name, tweet_text)
    if not frameworks:
        raise HTTPException(status_code=503, detail="フレームワークの生成に失敗しました。しばらく待ってから再試行してください。")

    # 保存はしない。フロントでユーザーが選択後に /save で保存する。
    return {"frameworks": frameworks, "style_name": style.name}

@app.post("/api/frameworks/{style_id}/save")
async def save_frameworks_endpoint(style_id: str, request: SaveFrameworksRequest):
    """ユーザーが選択したフレームワークをDBに保存する"""
    if not request.frameworks:
        raise HTTPException(status_code=400, detail="フレームワークを1つ以上選択してください")
    save_frameworks(style_id, request.style_name, request.frameworks)
    return load_frameworks(style_id)

@app.delete("/api/frameworks/{style_id}/{fw_id}")
async def remove_framework(style_id: str, fw_id: str):
    """特定フレームワークを削除する"""
    success = delete_fw(style_id, fw_id)
    if not success:
        raise HTTPException(status_code=404, detail="Framework not found")
    return {"status": "deleted"}

# ─── 投稿 ────────────────────────────────────────────────────

async def process_post_with_jitter(content: str, style_id: str, style_name: str, post_id: str):
    """
    Background task to post to X with a random delay (jitter).
    Default jitter: 30 to 300 seconds.
    """
    jitter = random.randint(30, 300)
    print(f"[{time.strftime('%H:%M:%S')}] Post queued. Waiting for {jitter} seconds jitter...")
    await asyncio.sleep(jitter)

    print(f"[{time.strftime('%H:%M:%S')}] Jitter finished. Posting to X...")

    # 現在のアカウントでXPosterを初期化
    current = account_manager.get_current_account()
    poster = XPoster(
        api_key=current.get("x_api_key") if current else None,
        api_secret=current.get("x_api_secret") if current else None,
        access_token=current.get("x_access_token") if current else None,
        access_token_secret=current.get("x_access_token_secret") if current else None,
    )
    success = poster.post_tweet(content)
    update_post_status(post_id, "posted" if success else "failed")

@app.post("/api/post")
async def post_to_x(request: PostRequest, background_tasks: BackgroundTasks):
    # 現在のアカウント情報を取得
    current = account_manager.get_current_account()
    account_id = current["id"] if current else "unknown"
    account_name = current["name"] if current else "不明"

    # 履歴に保存
    entry = save_post(
        content=request.content,
        style_id=request.style_id or "",
        style_name=request.style_name or "",
        account_id=account_id,
        account_name=account_name,
    )

    # バックグラウンドで投稿
    background_tasks.add_task(
        process_post_with_jitter,
        request.content,
        request.style_id or "",
        request.style_name or "",
        entry["id"],
    )
    return {"status": "queued", "message": "Post is being processed with a safety delay (30-300s)", "post_id": entry["id"]}

# ─── 投稿履歴 ─────────────────────────────────────────────

@app.get("/api/history")
async def get_history():
    return load_history()

@app.delete("/api/history/{post_id}")
async def delete_history_entry(post_id: str):
    success = delete_post(post_id)
    if not success:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"status": "deleted"}

# ─── アカウント ───────────────────────────────────────────

@app.get("/api/accounts")
async def get_accounts():
    return account_manager.load_accounts()

@app.get("/api/accounts/current")
async def get_current_account():
    current = account_manager.get_current_account()
    if not current:
        raise HTTPException(status_code=404, detail="No accounts configured")
    return {"id": current["id"], "name": current["name"]}

@app.post("/api/accounts/switch")
async def switch_account(request: SwitchAccountRequest):
    success = account_manager.switch_account(request.account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")
    current = account_manager.get_current_account()
    return {"status": "switched", "current": {"id": current["id"], "name": current["name"]}}

@app.post("/api/accounts")
async def add_account(request: AddAccountRequest):
    result = account_manager.add_account(
        account_id=request.id,
        name=request.name,
        x_api_key=request.x_api_key,
        x_api_secret=request.x_api_secret,
        x_access_token=request.x_access_token,
        x_access_token_secret=request.x_access_token_secret,
    )
    return result

@app.put("/api/accounts/{account_id}")
async def edit_account(account_id: str, request: EditAccountRequest):
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

@app.delete("/api/accounts/{account_id}")
async def remove_account(account_id: str):
    success = account_manager.delete_account(account_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete current account or account not found")
    return {"status": "deleted"}

# ─── 生成済み投稿 ────────────────────────────────────────────

@app.get("/api/generated")
async def get_generated_posts():
    """全スタイルの生成済み投稿を返す"""
    return load_generated_posts()

@app.delete("/api/generated/{style_id}")
async def clear_generated_post(style_id: str):
    """特定スタイルの生成済み投稿を削除する"""
    delete_generated_post(style_id)
    return {"status": "deleted"}

# ─── チャット ────────────────────────────────────────────────

CHAT_SESSION_PATH = os.path.join(DATA_DIR, "chat_session.json")

@app.post("/api/chat/message")
async def chat_message(request: ChatMessageRequest):
    """AIとのチャットメッセージを処理して応答を返す"""
    aggregator = SourceAggregator()
    source_text = aggregator.get_combined_text()

    agent = ChatAgent()
    result = agent.extract_info(
        user_message=request.message,
        chat_history=request.history,
        source_text=source_text,
    )
    return result

@app.get("/api/chat/session")
async def get_chat_session():
    """チャットセッションを返す"""
    if not os.path.exists(CHAT_SESSION_PATH):
        return {"messages": [], "active_context": None}
    with open(CHAT_SESSION_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

@app.post("/api/chat/session")
async def save_chat_session(data: ChatSessionData):
    """チャットセッションを保存する"""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CHAT_SESSION_PATH, "w", encoding="utf-8") as f:
        json.dump(data.model_dump(), f, ensure_ascii=False, indent=2)
    return {"status": "saved"}

@app.delete("/api/chat/session")
async def reset_chat_session():
    """チャットセッションをリセットする"""
    if os.path.exists(CHAT_SESSION_PATH):
        os.remove(CHAT_SESSION_PATH)
    return {"status": "reset"}

# ─── 一次情報（Google Drive / Notion） ───────────────────────

@app.get("/api/sources/status")
async def get_source_status():
    aggregator = SourceAggregator()
    return aggregator.get_status()

@app.post("/api/sources/sync")
async def sync_sources():
    aggregator = SourceAggregator()
    try:
        result = aggregator.refresh()
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

# ─── スケジューラー ─────────────────────────────────────────

class SchedulerConfigRequest(BaseModel):
    enabled: bool
    jobs: List[dict]

@app.get("/api/scheduler/status")
async def get_scheduler_status():
    config = scheduler_instance.load_config()
    jobs = []
    for job in scheduler_instance.scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None
        })
    return {
        "is_running": scheduler_instance.is_running,
        "config_enabled": config.get("enabled", False),
        "active_jobs": jobs
    }

@app.get("/api/scheduler/config")
async def get_scheduler_config():
    config = scheduler_instance.load_config()

    # 全スタイルに対応するジョブが存在するかチェックし、不足分を自動作成
    all_style_ids = []
    for f in os.listdir(STYLES_DIR):
        if f.endswith(".json"):
            all_style_ids.append(f.replace(".json", ""))
    for c in load_custom_styles():
        all_style_ids.append(c["id"])

    existing_style_ids = {j.get("style_id") for j in config.get("jobs", [])}
    updated = False
    for style_id in all_style_ids:
        if style_id not in existing_style_ids:
            config.setdefault("jobs", []).append({
                "id": f"job_{style_id}",
                "account_id": "default",
                "style_id": style_id,
                "topic": "",
                "content": "",
                "cron": "0 9 * * *",
                "enabled": False,
            })
            updated = True
    if updated:
        scheduler_instance.save_config(config)

    return config

@app.post("/api/scheduler/config")
async def update_scheduler_config(request: SchedulerConfigRequest):
    scheduler_instance.save_config(request.model_dump())
    # 再起動して設定反映
    await scheduler_instance.stop()
    await scheduler_instance.start()
    return {"status": "updated"}

@app.post("/api/scheduler/run-now/{job_id}")
async def run_scheduler_job_now(job_id: str):
    success = await scheduler_instance.run_now(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "triggered"}

@app.post("/api/scheduler/refresh")
async def refresh_scheduler():
    await scheduler_instance.stop()
    await scheduler_instance.start()
    return {"status": "refreshed"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)
