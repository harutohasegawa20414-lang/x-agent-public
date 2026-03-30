"""
engine/bio_learner.py

Bio判定辞書の自動学習モジュール。
OpenAI (gpt-4o-mini) を使って _BIO_CATEGORIES を自動拡張する。
ベースライン辞書はハードコードのまま不変に保ち、学習結果は bio_learned.json に保存。
"""

import json
import os
import re
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional

NO9_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(NO9_DIR, "data")
LEARNED_PATH = os.path.join(DATA_DIR, "bio_learned.json")


# ============================================================
# 永続化
# ============================================================

def load_learned() -> Dict[str, Any]:
    """bio_learned.json を読み込む。破損・不在時は空構造を返す。"""
    try:
        if os.path.exists(LEARNED_PATH):
            with open(LEARNED_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
    except Exception as e:
        print(f"[WARN] bio_learned.json 読み込み失敗（ベースラインのみで動作）: {e}")
    return {"categories": [], "history": []}


def save_learned(data: Dict[str, Any]):
    """bio_learned.json に保存する。"""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(LEARNED_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ============================================================
# マージ
# ============================================================

def merge_categories(base: List[Dict], learned: List[Dict]) -> List[Dict]:
    """
    ベースライン辞書と学習済み辞書をマージする。
    triggersの共通度でカテゴリを同定し、既存カテゴリにはパターン/同義語を追加。
    新規カテゴリはそのまま追加。
    """
    import copy
    merged = copy.deepcopy(base)

    for lcat in learned:
        l_triggers = set(lcat.get("triggers", []))
        if not l_triggers:
            continue

        # ベースラインのどのカテゴリに対応するか（triggers の共通度で判定）
        best_match = None
        best_overlap = 0
        for i, bcat in enumerate(merged):
            b_triggers = set(bcat.get("triggers", set()))
            overlap = len(l_triggers & b_triggers)
            if overlap > best_overlap:
                best_overlap = overlap
                best_match = i

        if best_match is not None and best_overlap >= 1:
            # 既存カテゴリにマージ
            target = merged[best_match]
            # triggers
            existing_triggers = set(target.get("triggers", set()))
            existing_triggers.update(l_triggers)
            target["triggers"] = existing_triggers

            # synonyms
            existing_synonyms = set(target.get("synonyms", set()))
            existing_synonyms.update(set(lcat.get("synonyms", [])))
            target["synonyms"] = existing_synonyms

            # patterns（重複排除）
            existing_patterns = set(target.get("patterns", []))
            for p in lcat.get("patterns", []):
                if p not in existing_patterns:
                    target["patterns"].append(p)
                    existing_patterns.add(p)

            # exclude（重複排除）
            existing_excludes = set(target.get("exclude", []))
            for e in lcat.get("exclude", []):
                if e not in existing_excludes:
                    target.setdefault("exclude", []).append(e)
                    existing_excludes.add(e)
        else:
            # 新規カテゴリとして追加
            new_cat = {
                "triggers": set(lcat.get("triggers", [])),
                "synonyms": set(lcat.get("synonyms", [])),
                "patterns": list(lcat.get("patterns", [])),
            }
            if lcat.get("exclude"):
                new_cat["exclude"] = list(lcat["exclude"])
            merged.append(new_cat)

    return merged


# ============================================================
# メモリ上のマージ済み辞書
# ============================================================

_merged_categories: Optional[List[Dict]] = None


def _refresh_merged_categories():
    """メモリ上のマージ済み辞書を再構築する。"""
    global _merged_categories
    from engine.user_searcher import _BIO_CATEGORIES
    learned_data = load_learned()
    learned_cats = learned_data.get("categories", [])
    _merged_categories = merge_categories(_BIO_CATEGORIES, learned_cats)
    print(f"[BIO-LEARN] 辞書マージ完了: {len(_merged_categories)} カテゴリ")


def get_merged_categories() -> List[Dict]:
    """マージ済み辞書を取得。未初期化なら初期化する。"""
    global _merged_categories
    if _merged_categories is None:
        _refresh_merged_categories()
    return _merged_categories


# ============================================================
# バリデーション
# ============================================================

_PATTERN_MAX_LENGTH = 200  # ReDoS防止: パターン長の上限
_DANGEROUS_REGEX = re.compile(r'(\(.+\+\)\+|\(.+\*\)\*|\(.+\+\)\*|\(.+\*\)\+)')  # ネストした量指定子


def _validate_pattern(pattern: str) -> bool:
    """正規表現パターンの有効性をチェックする（ReDoS防止付き）。"""
    if not pattern or len(pattern) > _PATTERN_MAX_LENGTH:
        return False
    # ネストした量指定子（ReDoSの典型パターン）を拒否
    if _DANGEROUS_REGEX.search(pattern):
        return False
    try:
        re.compile(pattern)
        return True
    except re.error:
        return False


# ============================================================
# AI学習実行
# ============================================================

def run_learning(api_key: str) -> Dict[str, Any]:
    """
    OpenAI (gpt-4o-mini) を使って辞書を自動拡張する。
    既存辞書を渡して新パターンを生成→バリデーション→マージ→保存。
    """
    from engine.user_searcher import _BIO_CATEGORIES

    # 現在のマージ済み辞書をシリアライズ
    current = get_merged_categories()
    categories_for_prompt = []
    for cat in current:
        categories_for_prompt.append({
            "triggers": sorted(cat.get("triggers", set())),
            "synonyms": sorted(cat.get("synonyms", set())),
            "patterns": cat.get("patterns", []),
            "exclude": cat.get("exclude", []),
        })

    prompt = f"""あなたはX（Twitter）のbioテキストからユーザーの職種・肩書きを判定するための辞書を拡張するアシスタントです。

以下は現在の辞書（{len(categories_for_prompt)}カテゴリ）です:

{json.dumps(categories_for_prompt, ensure_ascii=False, indent=2)}

タスク:
1. 各既存カテゴリについて、まだ辞書に含まれていない日本語・英語の triggers / synonyms / patterns を追加してください。
   - triggers: 検索語にこれが含まれたらそのカテゴリを発動させるキーワード（2〜5個追加）
   - synonyms: bioに含まれていたら一致とみなす同義語（3〜8個追加）
   - patterns: bioに対する正規表現パターン（3〜10個追加）。有効な正規表現であること。
2. 新カテゴリも最大3つまで提案可能です。日本のビジネス・専門職でまだカバーされていない職種を提案してください。
3. 既存のパターンと重複するものは含めないでください。

JSON形式で回答してください。以下のフォーマットに従ってください:
{{
  "updates": [
    {{
      "triggers": ["既存カテゴリを特定するためのtrigger（既存のもの1つ以上含む）", "新しいtrigger1", ...],
      "new_synonyms": ["新しいsynonym1", "新しいsynonym2", ...],
      "new_patterns": ["新しいpattern1", "新しいpattern2", ...],
      "new_excludes": []
    }}
  ],
  "new_categories": [
    {{
      "triggers": ["trigger1", "trigger2", ...],
      "synonyms": ["synonym1", "synonym2", ...],
      "patterns": ["pattern1", "pattern2", ...],
      "exclude": []
    }}
  ]
}}"""

    # OpenAI API呼び出し（stdlib使用）
    body = json.dumps({
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "max_tokens": 4000,
        "temperature": 0.8,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
    except Exception as e:
        return {"success": False, "error": f"OpenAI API呼び出し失敗: {e}"}

    # レスポンスからJSONを抽出
    try:
        content = result["choices"][0]["message"]["content"]
        ai_output = json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        return {"success": False, "error": f"AIレスポンスのパース失敗: {e}"}

    # バリデーション＆マージ用データ構築
    learned_data = load_learned()
    learned_cats = learned_data.get("categories", [])
    stats = {"updated_categories": 0, "new_categories": 0, "new_patterns": 0, "invalid_patterns": 0}

    # 既存カテゴリの更新
    for update in ai_output.get("updates", []):
        triggers = update.get("triggers", [])
        new_synonyms = update.get("new_synonyms", [])
        new_patterns = update.get("new_patterns", [])
        new_excludes = update.get("new_excludes", [])

        if not triggers:
            continue

        # パターンバリデーション
        valid_patterns = []
        for p in new_patterns:
            if _validate_pattern(p):
                valid_patterns.append(p)
            else:
                stats["invalid_patterns"] += 1
                print(f"[BIO-LEARN] 無効なパターンをスキップ: {p}")

        if not new_synonyms and not valid_patterns:
            continue

        # learned_catsから該当カテゴリを探す（なければ新規作成）
        trigger_set = set(triggers)
        found = False
        for lcat in learned_cats:
            l_triggers = set(lcat.get("triggers", []))
            if len(l_triggers & trigger_set) >= 1:
                # 既存の学習済みカテゴリにマージ
                existing_triggers = set(lcat.get("triggers", []))
                existing_triggers.update(trigger_set)
                lcat["triggers"] = sorted(existing_triggers)

                existing_syns = set(lcat.get("synonyms", []))
                existing_syns.update(new_synonyms)
                lcat["synonyms"] = sorted(existing_syns)

                existing_pats = set(lcat.get("patterns", []))
                for p in valid_patterns:
                    if p not in existing_pats:
                        lcat.setdefault("patterns", []).append(p)
                        existing_pats.add(p)

                existing_excl = set(lcat.get("exclude", []))
                for e in new_excludes:
                    if e not in existing_excl:
                        lcat.setdefault("exclude", []).append(e)
                        existing_excl.add(e)

                found = True
                break

        if not found:
            learned_cats.append({
                "triggers": sorted(trigger_set),
                "synonyms": sorted(set(new_synonyms)),
                "patterns": valid_patterns,
                "exclude": new_excludes,
            })

        stats["updated_categories"] += 1
        stats["new_patterns"] += len(valid_patterns)

    # 新カテゴリの追加（最大3つ）
    new_cats = ai_output.get("new_categories", [])[:3]
    for ncat in new_cats:
        triggers = ncat.get("triggers", [])
        synonyms = ncat.get("synonyms", [])
        patterns = ncat.get("patterns", [])
        excludes = ncat.get("exclude", [])

        if not triggers or not patterns:
            continue

        valid_patterns = [p for p in patterns if _validate_pattern(p)]
        invalid_count = len(patterns) - len(valid_patterns)
        stats["invalid_patterns"] += invalid_count

        if not valid_patterns:
            continue

        learned_cats.append({
            "triggers": sorted(set(triggers)),
            "synonyms": sorted(set(synonyms)),
            "patterns": valid_patterns,
            "exclude": excludes,
        })
        stats["new_categories"] += 1
        stats["new_patterns"] += len(valid_patterns)

    # 保存
    learned_data["categories"] = learned_cats
    learned_data.setdefault("history", []).append({
        "at": datetime.now().isoformat(),
        "stats": stats,
    })
    # 履歴は最新30件のみ保持
    learned_data["history"] = learned_data["history"][-30:]
    save_learned(learned_data)

    # メモリ上の辞書を再構築
    _refresh_merged_categories()

    return {"success": True, "stats": stats}


# ============================================================
# ステータス取得
# ============================================================

def get_learn_status() -> Dict[str, Any]:
    """学習状態をダッシュボード用に返す。"""
    learned_data = load_learned()
    history = learned_data.get("history", [])
    categories = learned_data.get("categories", [])

    merged = get_merged_categories()

    return {
        "learned_categories": len(categories),
        "merged_total_categories": len(merged),
        "total_learned_patterns": sum(len(c.get("patterns", [])) for c in categories),
        "total_learned_synonyms": sum(len(c.get("synonyms", [])) for c in categories),
        "history": history[-10:],
        "last_learned_at": history[-1]["at"] if history else None,
    }


def get_current_dictionary() -> List[Dict]:
    """マージ済み辞書をAPI返却用にシリアライズして返す。"""
    merged = get_merged_categories()
    result = []
    for cat in merged:
        result.append({
            "triggers": sorted(cat.get("triggers", set())),
            "synonyms": sorted(cat.get("synonyms", set())),
            "patterns": cat.get("patterns", []),
            "exclude": cat.get("exclude", []),
        })
    return result
