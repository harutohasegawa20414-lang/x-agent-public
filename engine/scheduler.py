import json
import os
import sys
import random
import asyncio
import time
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from engine.source_fetcher import SourceAggregator
from engine.style_loader import load_style
from engine.prompt_builder import build_system_prompt, build_user_prompt
from engine.post_generator import PostGenerator
from engine.x_poster import XPoster
from engine.history_manager import save_post, update_post_status
from engine.generated_posts_manager import load_generated_posts, delete_generated_post, pop_first_variation
from engine import account_manager

CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "schedule_config.json"
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

_FS_KEY = "xagent_schedule_config"

COMPANY_INFO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "color_monster.json"
)

class AutomationScheduler:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AutomationScheduler, cls).__new__(cls)
            cls._instance.scheduler = AsyncIOScheduler()
            cls._instance.is_running = False
        return cls._instance

    def load_config(self) -> dict:
        if _FIREBASE_IMPORTED:
            result = load_doc(_FS_KEY)
            if result is not None:
                return result
        if not os.path.exists(CONFIG_PATH):
            return {"enabled": True, "jobs": []}
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"enabled": True, "jobs": []}

    def save_config(self, config: dict):
        if _FIREBASE_IMPORTED:
            save_doc(_FS_KEY, config)
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)

    async def start(self):
        if self.is_running:
            return

        self.scheduler.remove_all_jobs()
        config = self.load_config()

        for job_cfg in config.get("jobs", []):
            if not job_cfg.get("enabled", True):
                continue

            self.scheduler.add_job(
                self.run_automation_job,
                CronTrigger.from_crontab(job_cfg["cron"]),
                id=job_cfg["id"],
                args=[job_cfg],
                replace_existing=True
            )
            print(f"[Scheduler] Added job: {job_cfg['id']} ({job_cfg['cron']})")

        self.scheduler.start()
        self.is_running = True
        print(f"[Scheduler] Started with {len(config.get('jobs', []))} potential jobs.")

    async def stop(self):
        if self.scheduler.running:
            self.scheduler.shutdown()
        self.is_running = False
        # APScheduler は shutdown 後に start できないため、再起動用に新インスタンスを用意する
        self.scheduler = AsyncIOScheduler()
        print("[Scheduler] Stopped.")

    async def run_now(self, job_id: str):
        """特定のジョブを即時実行（テスト用）"""
        config = self.load_config()
        for job_cfg in config.get("jobs", []):
            if job_cfg["id"] == job_id:
                asyncio.create_task(self.run_automation_job(job_cfg))
                return True
        return False

    async def run_automation_job(self, job_cfg: dict):
        """
        自動投稿メインロジック
        """
        job_id = job_cfg["id"]
        account_id = job_cfg["account_id"]
        style_id = job_cfg["style_id"]
        topic = job_cfg["topic"]

        print(f"[Automation] Starting job: {job_id} ({style_id})")

        try:
            # 1. スタイル & 会社情報読み込み
            style = load_style(style_id)
            if not style:
                print(f"[Automation] Style not found: {style_id}")
                return

            company_info = {}
            if os.path.exists(COMPANY_INFO_PATH):
                with open(COMPANY_INFO_PATH, "r", encoding="utf-8") as f:
                    company_info = json.load(f)

            # 2. コンテンツの決定（優先順: ジョブ設定 > 生成済み投稿(contents[0]) > 新規生成）
            content = (job_cfg.get("content") or "").strip()
            used_variation = False

            if not content:
                # 生成済み投稿を確認（contents[0] 優先、旧 content フィールドにフォールバック）
                generated = load_generated_posts()
                if style_id in generated:
                    entry = generated[style_id]
                    contents = entry.get("contents", [])
                    if contents:
                        content = contents[0]
                        total = len(contents)
                        print(f"[Automation] Using pre-generated content (variation 1 of {total}) for {style_id}")
                        used_variation = True
                    elif entry.get("content"):
                        content = entry["content"]
                        print(f"[Automation] Using pre-generated content for {style_id}")
                        used_variation = True

            if not content:
                # 一次情報リフレッシュして新規生成
                aggregator = SourceAggregator()
                sources = aggregator.refresh()
                source_text = sources.get("combined_text", "")

                system_prompt = build_system_prompt(style)
                user_prompt = build_user_prompt(topic, company_info, source_text)

                generator = PostGenerator()
                content = generator.generate_post(system_prompt, user_prompt)

            if not content:
                print(f"[Automation] Generation failed for {job_id}")
                return

            # 4. アカウント取得
            if account_id and account_id != "default":
                print(f"[Automation] Switching account to: {account_id}")
                account_manager.switch_account(account_id)
            else:
                print(f"[Automation] Using default/current account")

            current = account_manager.get_current_account()
            print(f"[Automation] Active account for this post: {current['name']} (ID: {current['id']})")

            # 5. 履歴保存
            entry = save_post(
                content=content,
                style_id=style_id,
                style_name=style.name,
                account_id=current["id"],
                account_name=current["name"]
            )
            print(f"[Automation] Post saved to history: {entry['id']}")

            # 6. Jitter (待機)
            jitter_max = self.load_config().get("default_jitter_seconds", 15)
            jitter = random.randint(3, max(3, jitter_max))
            print(f"[Automation] Job {job_id} queued. Waiting {jitter}s jitter...")
            await asyncio.sleep(jitter)

            # 7. X に投稿
            poster = XPoster(
                api_key=current.get("x_api_key"),
                api_secret=current.get("x_api_secret"),
                access_token=current.get("x_access_token"),
                access_token_secret=current.get("x_access_token_secret"),
            )
            success = poster.post_tweet(content)

            # 8. ステータス更新
            update_post_status(entry["id"], "posted" if success else "failed")
            print(f"[Automation] Job {job_id} completed. Success: {success}")

            # 9. 使用済みコンテンツを消費（成功・失敗問わず）
            if used_variation:
                # バリエーション消費（先頭を削除してシフト）
                pop_first_variation(style_id)
            else:
                # generated_posts から削除（次回は新規生成）
                delete_generated_post(style_id)

                # schedule_config の content フィールドもクリア
                config = self.load_config()
                for job in config.get("jobs", []):
                    if job["id"] == job_id and job.get("content"):
                        job["content"] = ""
                        self.save_config(config)
                        print(f"[Automation] Cleared used content for {job_id}")

        except Exception as e:
            print(f"[Automation] Critical error in job {job_id}: {e}")

scheduler_instance = AutomationScheduler()
