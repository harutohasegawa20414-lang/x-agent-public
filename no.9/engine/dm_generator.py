"""
engine/dm_generator.py

AIによるパーソナライズDM生成モジュール。
カテゴリ別テンプレート・トーン調整・A/Bテスト生成対応。
"""

import json
import os
import sys
import uuid
from datetime import datetime
from typing import List, Dict, Optional

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(NO9_DIR, "data")
TEMPLATES_PATH = os.path.join(DATA_DIR, "dm_templates.json")
DM_HISTORY_PATH = os.path.join(DATA_DIR, "dm_history.json")

# Firebase共有クライアントをインポート（プロジェクトルート経由）
_ROOT = os.path.dirname(NO9_DIR)  # Xエージェント/
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
try:
    from firebase_client import load_doc, save_doc
    _FIREBASE_IMPORTED = True
except ImportError:
    _FIREBASE_IMPORTED = False

_FS_KEY_TEMPLATES = "no9_dm_templates"
_FS_KEY_DM_HISTORY = "no9_dm_history"


def _load_templates() -> List[Dict]:
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY_TEMPLATES)
        if result is not None:
            return result
    if not os.path.exists(TEMPLATES_PATH):
        return []
    with open(TEMPLATES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_templates(templates: List[Dict]):
    if _FIREBASE_IMPORTED:
        save_doc(_FS_KEY_TEMPLATES, templates)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(TEMPLATES_PATH, "w", encoding="utf-8") as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)


def _get_recent_dms_for_target(target_id: str, limit: int = 5) -> List[str]:
    """同一ターゲットへの過去DM送信テキストを取得（類似度チェック用）"""
    if _FIREBASE_IMPORTED:
        history = load_doc(_FS_KEY_DM_HISTORY)
        if history is not None:
            texts = [h["dm_text"] for h in history if h.get("target_id") == target_id and h.get("dm_text")]
            return texts[-limit:]
    if not os.path.exists(DM_HISTORY_PATH):
        return []
    with open(DM_HISTORY_PATH, "r", encoding="utf-8") as f:
        history = json.load(f)
    texts = [h["dm_text"] for h in history if h.get("target_id") == target_id and h.get("dm_text")]
    return texts[-limit:]


# ---- テンプレート管理 ----

def list_templates(category_id: str = None) -> List[Dict]:
    templates = _load_templates()
    if category_id:
        templates = [t for t in templates if t.get("category_id") == category_id]
    return templates


def create_template(
    name: str,
    category_id: str,
    content: str,
    tone: str = "professional",  # professional / casual / friendly / formal
    value_proposition: str = "",
) -> Dict:
    templates = _load_templates()
    template = {
        "id": str(uuid.uuid4()),
        "name": name,
        "category_id": category_id,
        "content": content,
        "tone": tone,
        "value_proposition": value_proposition,
        "created_at": datetime.now().isoformat(),
        "stats": {"sent": 0, "replied": 0, "reply_rate": 0.0},
    }
    templates.append(template)
    _save_templates(templates)
    return template


def update_template(template_id: str, updates: Dict) -> Optional[Dict]:
    templates = _load_templates()
    for i, t in enumerate(templates):
        if t["id"] == template_id:
            templates[i].update(updates)
            _save_templates(templates)
            return templates[i]
    return None


def delete_template(template_id: str) -> bool:
    templates = _load_templates()
    new_templates = [t for t in templates if t["id"] != template_id]
    if len(new_templates) == len(templates):
        return False
    _save_templates(new_templates)
    return True


# ---- AI DM生成 ----

def generate_dm(
    target: Dict,
    category: Dict,
    template: Optional[Dict] = None,
    tone: str = "professional",
    openai_api_key: str = None,
    ab_test: bool = False,
    source_context: str = "",
) -> Dict:
    """
    ターゲットユーザーに対してパーソナライズDMを生成する。
    ab_test=True の場合、2パターンのDMを生成する。
    """
    user_summary = _build_user_summary(target)
    template_content = template["content"] if template else ""
    value_prop = template.get("value_proposition", "") if template else ""
    category_name = category.get("name", "")
    conditions = category.get("conditions", {})

    if not OPENAI_AVAILABLE or not openai_api_key:
        return _mock_generate_dm(target, category, ab_test)

    client = OpenAI(api_key=openai_api_key)

    notion_section = f"\n\n【自社・商材の一次情報】\n{source_context}" if source_context else ""

    system_prompt = f"""あなたはXのDMライターです。
以下の条件でターゲットに送るDMを作成してください：
- トーン: {_tone_description(tone)}
- 文字数: 200文字以内（Xの制限に合わせ簡潔に）
- 個人化: ユーザーの投稿・プロフィールの内容を具体的に言及する
- 価値提案: {value_prop or '相互メリットを明示する'}
- 自然な会話として始め、売り込み感を最小化する
- 最後に返信を促す一言を入れる
テンプレート参考（ゼロから書き直してよい）:
{template_content or 'なし'}{notion_section}"""

    user_prompt = f"""カテゴリ: {category_name}
ターゲット情報:
{user_summary}"""

    try:
        if ab_test:
            # A/Bパターン生成
            dm_a = _call_openai(client, system_prompt, user_prompt + "\n\nパターンA（インサイト型: 相手の悩み・課題から入る）")
            dm_b = _call_openai(client, system_prompt, user_prompt + "\n\nパターンB（実績型: 具体的な実績・数字から入る）")
            return {
                "pattern_a": dm_a,
                "pattern_b": dm_b,
                "ab_test": True,
                "generated_at": datetime.now().isoformat(),
            }
        else:
            # 類似度チェック付きリトライ（最大3回）
            recent_dms = _get_recent_dms_for_target(target.get("id", ""))
            dm_text = None
            similarity_retries = 0
            prompt = user_prompt
            for attempt in range(3):
                candidate = _call_openai(client, system_prompt, prompt)
                if not check_similarity(candidate, recent_dms):
                    dm_text = candidate
                    similarity_retries = attempt
                    break
                similarity_retries = attempt + 1
                prompt = user_prompt + f"\n\n（重要: 過去のDMと表現が重複しています。全く異なる切り口・言葉遣いで作成してください。試行{attempt + 2}回目）"
            if dm_text is None:
                dm_text = candidate  # 3回試しても類似の場合は最後の候補を使用
            return {
                "text": dm_text,
                "ab_test": False,
                "generated_at": datetime.now().isoformat(),
                "similarity_retries": similarity_retries,
            }
    except Exception as e:
        print(f"[WARN] OpenAI DM generation failed: {e}")
        return _mock_generate_dm(target, category, ab_test)


def _call_openai(client, system_prompt: str, user_prompt: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=300,
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()


def _build_user_summary(target: Dict) -> str:
    recent_posts = target.get("recent_posts", [])
    posts_text = "\n".join([f"- {p.get('text', '')}" for p in recent_posts[:3]])
    hashtags = ", ".join(target.get("hashtags_used", [])[:5])
    return f"""名前: {target.get('name', '')} (@{target.get('username', '')})
プロフィール: {target.get('bio', '')[:150]}
フォロワー数: {target.get('followers_count', 0):,}
エンゲージメント率: {target.get('engagement_rate', 0)}%
ハッシュタグ: {hashtags}
最近の投稿:
{posts_text}"""


def _tone_description(tone: str) -> str:
    tones = {
        "professional": "プロフェッショナル・礼儀正しく・ビジネス向け",
        "casual": "カジュアル・フレンドリー・親しみやすい",
        "friendly": "温かみがある・共感ベース・協力的",
        "formal": "フォーマル・丁寧語・格式ある",
    }
    return tones.get(tone, tones["professional"])


def _mock_generate_dm(target: Dict, category: Dict, ab_test: bool) -> Dict:
    name = target.get("name", "はじめまして")
    username = target.get("username", "")
    bio_snippet = (target.get("bio") or "")[:50]
    mock_a = f"[MOCK] {name}さん、はじめまして。\n{bio_snippet}というご活動、非常に共感しております。\n少しお時間いただけますでしょうか？"
    mock_b = f"[MOCK] @{username}さん、突然のご連絡失礼します。\n弊社の取り組みが{category.get('name', '')}において貢献できると考えています。\nよろしければお話できますか？"

    if ab_test:
        return {
            "pattern_a": mock_a,
            "pattern_b": mock_b,
            "ab_test": True,
            "generated_at": datetime.now().isoformat(),
            "is_mock": True,
        }
    return {
        "text": mock_a,
        "ab_test": False,
        "generated_at": datetime.now().isoformat(),
        "is_mock": True,
    }


def check_similarity(new_dm: str, recent_dms: List[str], threshold: float = 0.8) -> bool:
    """簡易類似度チェック（同一ターゲットへの重複送信防止）"""
    if not recent_dms:
        return False
    new_words = set(new_dm.lower().split())
    for dm in recent_dms:
        dm_words = set(dm.lower().split())
        if not dm_words:
            continue
        jaccard = len(new_words & dm_words) / len(new_words | dm_words)
        if jaccard >= threshold:
            return True
    return False
