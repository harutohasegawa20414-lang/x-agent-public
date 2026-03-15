import json
import os
import sys
from dataclasses import dataclass, field
from typing import List, Dict, Optional

CUSTOM_STYLES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "custom_styles.json"
)

STYLE_USERNAMES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "style_usernames.json"
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

_FS_KEY_STYLES = "xagent_custom_styles"
_FS_KEY_USERNAMES = "xagent_style_usernames"


@dataclass
class StyleProfile:
    name: str
    tone: Dict[str, any]
    structure: Dict[str, any]
    philosophy: List[str]
    x_username: Optional[str] = None


def load_custom_styles() -> list:
    """data/custom_styles.json からカスタムスタイル一覧を読み込む"""
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY_STYLES)
        if result is not None:
            return result
    if not os.path.exists(CUSTOM_STYLES_PATH):
        return []
    try:
        with open(CUSTOM_STYLES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_custom_styles(styles: list):
    """カスタムスタイル一覧を data/custom_styles.json に保存する"""
    if _FIREBASE_IMPORTED:
        save_doc(_FS_KEY_STYLES, styles)
    os.makedirs(os.path.dirname(CUSTOM_STYLES_PATH), exist_ok=True)
    with open(CUSTOM_STYLES_PATH, "w", encoding="utf-8") as f:
        json.dump(styles, f, ensure_ascii=False, indent=2)


def load_style_usernames() -> dict:
    """data/style_usernames.json から全スタイルの x_username マップを読み込む"""
    if _FIREBASE_IMPORTED:
        result = load_doc(_FS_KEY_USERNAMES)
        if result is not None:
            return result
    if not os.path.exists(STYLE_USERNAMES_PATH):
        return {}
    try:
        with open(STYLE_USERNAMES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_style_username(style_id: str, x_username: str):
    """特定スタイルの x_username を data/style_usernames.json に保存する"""
    usernames = load_style_usernames()
    if x_username:
        usernames[style_id] = x_username.strip().lstrip("@")
    else:
        usernames.pop(style_id, None)
    if _FIREBASE_IMPORTED:
        save_doc(_FS_KEY_USERNAMES, usernames)
    os.makedirs(os.path.dirname(STYLE_USERNAMES_PATH), exist_ok=True)
    with open(STYLE_USERNAMES_PATH, "w", encoding="utf-8") as f:
        json.dump(usernames, f, ensure_ascii=False, indent=2)


def _make_generic_profile(name: str, x_username: Optional[str] = None) -> "StyleProfile":
    """アカウント名のみからジェネリックな StyleProfile を生成"""
    return StyleProfile(
        name=name,
        tone={"style": "natural", "sentiment": "positive", "is_custom": True},
        structure={"length": "short", "line_breaks": "moderate"},
        philosophy=["authenticity", "engagement"],
        x_username=x_username,
    )


def load_style(style_name: str, style_dir: str = "styles") -> Optional[StyleProfile]:
    """
    Loads a style definition from a JSON file.

    Args:
        style_name: The name of the style (file name without .json extension)
        style_dir: Directory containing style files

    Returns:
        StyleProfile object or None if file not found
    """
    # style_usernames.json から x_username を取得
    usernames = load_style_usernames()
    x_username = usernames.get(style_name)

    file_path = os.path.join(style_dir, f"{style_name}.json")

    if not os.path.exists(file_path):
        # Try looking in absolute path if style_dir is relative
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file_path = os.path.join(base_dir, style_dir, f"{style_name}.json")

        if not os.path.exists(file_path):
            # カスタムスタイルをフォールバックで確認
            for c in load_custom_styles():
                if c.get("id") == style_name:
                    # カスタムスタイルの x_username: JSON内 > style_usernames.json の順で優先
                    cu = c.get("x_username") or x_username
                    return _make_generic_profile(c["name"], x_username=cu)
            print(f"Style file not found: {file_path}")
            return None

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return StyleProfile(
            name=data.get("name", "Unknown"),
            tone=data.get("tone", {}),
            structure=data.get("structure", {}),
            philosophy=data.get("philosophy", []),
            x_username=x_username,
        )
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON for style {style_name}: {e}")
        return None
    except Exception as e:
        print(f"Error loading style {style_name}: {e}")
        return None
