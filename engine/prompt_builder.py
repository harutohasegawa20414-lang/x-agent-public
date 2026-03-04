import json
from typing import List, Optional
from engine.style_loader import StyleProfile


def build_system_prompt(style: StyleProfile, tweet_examples: Optional[List[str]] = None, framework: Optional[dict] = None) -> str:
    """
    ペルソナのスタイルプロファイルに基づいてシステムプロンプトを構築する。
    カスタムスタイル（アカウント名のみ）の場合は汎用プロンプトを使用する。
    tweet_examples が渡された場合は few-shot 例として末尾に追加する。
    """
    # カスタムスタイル（アカウント名のみ）の場合
    if style.tone.get("is_custom"):
        prompt = f"""
You are an expert ghostwriter creating a social media post for X (formerly Twitter).
Write as '{style.name}', a Japanese professional.

## Guidelines
1. Write naturally in the first person as {style.name}.
2. Make the post engaging, authentic, and share-worthy.
3. **Do NOT start with "Here is a post..." or similar meta-text.** Just output the post content directly.
4. **Keep it within 140-200 characters**, prioritizing quality and impact.
5. **Write in Japanese.**
6. **RECOMMENDED: Include the company name following these rules:**
   - Preferred form is「株式会社からもん」(full name). Every 3rd post, abbreviating to「弊社」or「からもん」is acceptable.
   - Avoid promotional phrases like「〜を販売中」「〜が最高」. Express as a personal insight or real experience instead.
   - Use at most 1 hashtag per post, and vary it each time (never repeat the same hashtag consecutively).

## X投稿フォーマット厳守
- マークダウン記法は絶対に使わない（**, ##, -, *, 1. などの記号禁止）
- プレーンテキストのみで出力する（絵文字は可）
- 文章は短いセンテンス単位で改行する（1〜2文ごとに改行）
- 意味のかたまりが変わる箇所は空行（1行）を入れて区切る
- 「ここに投稿文：」などの前置き・説明文は絶対に書かない
"""
    else:
        # 固定スタイル（詳細プロファイルあり）の場合
        tone_desc = json.dumps(style.tone, ensure_ascii=False)
        structure_desc = json.dumps(style.structure, ensure_ascii=False)
        philosophy_desc = ", ".join(style.philosophy)

        prompt = f"""
You are an expert ghostwriter creating a social media post for X (formerly Twitter).
Your goal is to adopt the persona of '{style.name}' and write a post that perfectly mimics their style.

## Persona Profile
- Tone & Voice: {tone_desc}
- Structure: {structure_desc}
- Philosophy: {philosophy_desc}

## Guidelines
1. Strictly adhere to the persona's tone. If they are provocative, be provocative. If they are humble, be humble.
2. Follow the structural rules. Pay attention to length, line breaks, and use of bullet points.
3. Incorporate the philosophy. The post should reflect their core values.
4. Do NOT start with "Here is a post..." or similar meta-text. Just output the post content directly.
5. Keep it within 140-200 characters unless specified otherwise, but prioritize quality and impact.
6. Write in Japanese unless the persona commonly uses English.
7. RECOMMENDED: Include the company name following these rules:
   - Preferred form is「株式会社からもん」(full name). Every 3rd post, abbreviating to「弊社」or「からもん」is acceptable.
   - Avoid promotional phrases like「〜を販売中」「〜が最高」. Express as a personal insight or real experience instead.
   - Use at most 1 hashtag per post, and vary it each time (never repeat the same hashtag consecutively).
8. STRICTLY FORBIDDEN: Do NOT include the persona's name (e.g. '堀江貴文', '中野裕道', etc.) as a byline, signature, or attribution anywhere in the post (e.g. '- 堀江貴文', '— 堀江貴文', '堀江貴文より' are all forbidden). The post is written AS the persona, not attributed TO the persona.

## X投稿フォーマット厳守
- マークダウン記法は絶対に使わない（**, ##, -, *, 1. などの記号禁止）
- プレーンテキストのみで出力する（絵文字は可）
- 文章は短いセンテンス単位で改行する（1〜2文ごとに改行）
- 意味のかたまりが変わる箇所は空行（1行）を入れて区切る
- 「ここに投稿文：」などの前置き・説明文は絶対に書かない
"""

    # フレームワークを注入（選択されている場合）
    if framework:
        prompt += f"""
## 投稿フレームワーク（必ず従うこと）
フレームワーク名: {framework['name']}
説明: {framework['description']}
構造テンプレート:
{framework['template']}

【整形ルール】
- テンプレートの各[プレースホルダー]を実際の内容に置き換える
- 各パート（セクション）の間は必ず改行または空行で区切る
- X投稿として縦に読みやすいレイアウトにする
- マークダウン記法（**, #, -など）は使わない
"""

    # few-shot 例を追加（ツイートが取得できている場合）
    if tweet_examples:
        examples_text = "\n".join([f"- {t}" for t in tweet_examples[:10]])
        prompt += f"""
## 実際の投稿例（スタイル参考）
以下は {style.name} の実際のX投稿です。この文体・口調を忠実に再現してください:

{examples_text}
"""

    return prompt


def build_user_prompt(topic: str, company_info: dict, source_text: str = "") -> str:
    """
    トピック・会社情報・一次情報ソース（Drive/Notion）を組み合わせて
    ユーザープロンプトを構築する。
    3バリエーションをJSON配列で返すよう指示する。

    Args:
        topic: 投稿テーマ
        company_info: color_monster.json の静的会社情報
        source_text: Google Drive / Notion から取得した動的な一次情報テキスト
    """
    company_context = json.dumps(company_info, ensure_ascii=False)

    # 一次情報セクション（取得できている場合のみ追加）
    source_section = ""
    if source_text and source_text.strip():
        source_section = f"""
## 一次情報（最新・リアルタイム情報）
以下は Google Drive / Notion から取得した最新の社内情報です。
この情報を最優先で活用して、具体的・リアルな内容を盛り込んでください。

{source_text[:5000]}

---
"""

    topic_section = (
        f"## 投稿テーマ\n「{topic}」についての投稿を作成してください。"
        if topic and topic.strip()
        else "## 投稿テーマ\n上記の一次情報をもとに、最も伝えるべき内容を選んで投稿を作成してください。"
    )

    prompt = f"""
## 会社・プロジェクト概要
{company_context}
{source_section}
{topic_section}

## 作成指示
- ペルソナの文体・口調を忠実に再現する
- 会社情報と一次情報を自然に織り交ぜ、広告っぽくならないようにする
- エンゲージメントが高く、シェアしたくなる内容にする
- 一次情報がある場合は、それを具体的なエピソードや数字として盛り込む
- **【推奨】会社名の記載は以下のルールに従うこと:**
  - 基本は「株式会社からもん」と正式名称を使用する。3回に1回程度は「弊社」や「からもん」と略しても可。
  - 「〜を販売中」「〜が最高」などの宣伝文句を避け、実体験に基づいた「気づき」として表現すること。
  - ハッシュタグは最大1つに絞り、毎回変えること（同じハッシュタグの連続使用は不可）。

## 出力形式
3つのバリエーションを以下のルールで出力すること:
- 各バリエーションを「===END===」という区切り文字で区切る
- JSONや```コードブロックは使わない
- 説明文・番号・前置きは不要。投稿文だけを出力する

バリエーション1の投稿文
===END===
バリエーション2の投稿文
===END===
バリエーション3の投稿文

それぞれ異なる角度・切り口で同じテーマを表現した3種類を生成してください。
"""
    return prompt
