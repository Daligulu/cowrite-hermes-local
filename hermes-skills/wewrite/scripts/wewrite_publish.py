#!/usr/bin/env python3
"""WeWrite local publisher: professional-clean render + WeChat draft API.

Secrets are loaded from /root/.hermes/.env or process environment and are never
printed. Use --dry-run for layout/account verification without creating drafts.
"""
from __future__ import annotations

import argparse
import html
import json
import mimetypes
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

EXPECTED_DOG_APPID = "wx27855f8407f2c81c"
TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token"
UPLOAD_URL = "https://api.weixin.qq.com/cgi-bin/material/add_material"
UPLOADIMG_URL = "https://api.weixin.qq.com/cgi-bin/media/uploadimg"
DRAFT_URL = "https://api.weixin.qq.com/cgi-bin/draft/add"
DEFAULT_ENV = "/root/.hermes/.env"

FORBIDDEN = ["本文由", "分钟阅读", "素材来源", "编辑锚点", "峰峰，可以", "这里可以加", "TODO", "PLACEHOLDER"]

# ---------------------------------------------------------------------------
# Theme system (adapted from gzh-design-skill, op7418/isjiamu, MIT).
# Each theme maps the gzh-design 6 preset design variables onto this renderer's
# component set (container / title card / h2 / h3 / paragraph / list card /
# blockquote / inline code / figure shadow). Keep keys consistent so a new
# theme is just another dict entry.
# ---------------------------------------------------------------------------
THEMES = {
    # Default legacy look — warm professional clean (unchanged colors).
    "professional-clean": {
        "label": "暖棕商务（默认）",
        "container_bg": "#ffffff",
        "title_card_bg": "linear-gradient(135deg,#fff7ec,#ffffff)",
        "title_card_border": "#f1dfc8",
        "title_color": "#5f371b",
        "h2_border": "#d48a45",
        "h2_color": "#7a4b24",
        "h3_color": "#8a5a35",
        "body_color": "#3f3f3f",
        "body_font_size": "16px",
        "body_line_height": "1.85",
        "list_bg": "#fffaf3",
        "list_border": "#f1dfc8",
        "list_item_color": "#4b4b4b",
        "check_color": "#d48a45",
        "quote_bg": "#f8f4ee",
        "quote_border": "#d9b98c",
        "quote_color": "#6a5a48",
        "code_bg": "#f6f6f6",
        "code_color": "#8a5a35",
        "figure_shadow": "rgba(95,55,27,0.08)",
    },
    # 摸鱼绿 — emerald, card-rich, high info density. Tutorials/reviews/lists.
    "moyu-green": {
        "label": "摸鱼绿（教程/测评/清单）",
        "container_bg": "#ffffff",
        "title_card_bg": "linear-gradient(135deg,#ECFDF5,#ffffff)",
        "title_card_border": "#BBF7D0",
        "title_color": "#111827",
        "h2_border": "#059669",
        "h2_color": "#065F46",
        "h3_color": "#047857",
        "body_color": "#374151",
        "body_font_size": "15px",
        "body_line_height": "1.85",
        "list_bg": "#F0FDF4",
        "list_border": "#BBF7D0",
        "list_item_color": "#374151",
        "check_color": "#059669",
        "quote_bg": "#ECFDF5",
        "quote_border": "#34D399",
        "quote_color": "#374151",
        "code_bg": "#F0FDF4",
        "code_color": "#047857",
        "figure_shadow": "rgba(5,150,105,0.10)",
    },
    # 红白色系 — classic editorial, numbered sections, restrained red accent.
    "red-white": {
        "label": "红白色系（深度分析/观点）",
        "container_bg": "#ffffff",
        "title_card_bg": "linear-gradient(135deg,#FEF2F2,#ffffff)",
        "title_card_border": "#FECACA",
        "title_color": "#1C1917",
        "h2_border": "#DC2626",
        "h2_color": "#991B1B",
        "h3_color": "#B91C1C",
        "body_color": "#374151",
        "body_font_size": "15px",
        "body_line_height": "1.8",
        "list_bg": "#FEF2F2",
        "list_border": "#FECACA",
        "list_item_color": "#374151",
        "check_color": "#DC2626",
        "quote_bg": "#FEF2F2",
        "quote_border": "#FCA5A5",
        "quote_color": "#57534E",
        "code_bg": "#FEF2F2",
        "code_color": "#991B1B",
        "figure_shadow": "rgba(220,38,38,0.08)",
    },
    # 石墨极简 — grayscale, rational whitespace, warm-orange ≤3 accents.
    "graphite-minimal": {
        "label": "石墨极简（科技/设计评论）",
        "container_bg": "#FFFFFF",
        "title_card_bg": "linear-gradient(135deg,#FAFAFA,#FFFFFF)",
        "title_card_border": "#E4E4E7",
        "title_color": "#27272A",
        "h2_border": "#52525B",
        "h2_color": "#27272A",
        "h3_color": "#3F3F46",
        "body_color": "#52525B",
        "body_font_size": "15px",
        "body_line_height": "1.8",
        "list_bg": "#FAFAFA",
        "list_border": "#E4E4E7",
        "list_item_color": "#3F3F46",
        "check_color": "#F97316",
        "quote_bg": "#FAFAFA",
        "quote_border": "#D4D4D8",
        "quote_color": "#52525B",
        "code_bg": "#F4F4F5",
        "code_color": "#3F3F46",
        "figure_shadow": "rgba(0,0,0,0.06)",
    },
    # 留白禅意 — serif headings, breathing whitespace, low-sat ink green.
    "zen-whitespace": {
        "label": "留白禅意（深度随笔/艺术）",
        "container_bg": "#FFFFFF",
        "title_card_bg": "linear-gradient(135deg,#EEF3F0,#FFFFFF)",
        "title_card_border": "#E8E8E8",
        "title_color": "#2B2B2B",
        "h2_border": "#4A5D52",
        "h2_color": "#2B2B2B",
        "h3_color": "#3D5046",
        "body_color": "#525252",
        "body_font_size": "15px",
        "body_line_height": "1.9",
        "list_bg": "#EEF3F0",
        "list_border": "#D6E4DC",
        "list_item_color": "#525252",
        "check_color": "#4A5D52",
        "quote_bg": "#EEF3F0",
        "quote_border": "#B5C8BC",
        "quote_color": "#525252",
        "code_bg": "#EEF3F0",
        "code_color": "#3D5046",
        "figure_shadow": "rgba(74,93,82,0.08)",
        "title_font": "'Noto Serif SC', Georgia, 'Times New Roman', serif",
    },
    # 摸鱼票据 — ticket visual metaphor, hard shadows, star ratings.
    "moyu-ticket": {
        "label": "摸鱼票据（测评/工具对比）",
        "container_bg": "#fffef8",
        "title_card_bg": "linear-gradient(135deg,#F0FDF4,#fffef8)",
        "title_card_border": "#A7F3D0",
        "title_color": "#1a1a1a",
        "h2_border": "#059669",
        "h2_color": "#1a1a1a",
        "h3_color": "#047857",
        "body_color": "#555555",
        "body_font_size": "15px",
        "body_line_height": "1.9",
        "list_bg": "#F0FDF4",
        "list_border": "#A7F3D0",
        "list_item_color": "#555555",
        "check_color": "#059669",
        "quote_bg": "#F0FDF4",
        "quote_border": "#A7F3D0",
        "quote_color": "#555555",
        "code_bg": "#F3F4F6",
        "code_color": "#1F2937",
        "figure_shadow": "rgba(26,26,26,0.10)",
    },
    # 橄榄手记 — editorial in-house journal, ink black + orange, small radius.
    "olive-journal": {
        "label": "橄榄手记（内刊/深度复盘）",
        "container_bg": "#fdfdf8",
        "title_card_bg": "linear-gradient(135deg,#eeefe9,#fdfdf8)",
        "title_card_border": "#bfc1b7",
        "title_color": "#23251d",
        "h2_border": "#ed7b2f",
        "h2_color": "#23251d",
        "h3_color": "#4d4f46",
        "body_color": "#4d4f46",
        "body_font_size": "15px",
        "body_line_height": "1.9",
        "list_bg": "#eeefe9",
        "list_border": "#bfc1b7",
        "list_item_color": "#4d4f46",
        "check_color": "#ed7b2f",
        "quote_bg": "#eeefe9",
        "quote_border": "#bfc1b7",
        "quote_color": "#4d4f46",
        "code_bg": "#e5e7e0",
        "code_color": "#23251d",
        "figure_shadow": "rgba(30,31,35,0.08)",
    },
    # ------------------------------------------------------------------
    # Upstream Obsidian WeWrite plugin v2.0 themes (learnerchen-forever/
    # wewrite, MIT). Mapping follows the same component-key contract.
    # ------------------------------------------------------------------
    # Tech Blue — cyan accent, center gradient H1, circled numbering.
    "tech-blue": {
        "label": "科技蓝（上游 Tech Blue）",
        "container_bg": "#ffffff",
        "title_card_bg": "linear-gradient(135deg,#eafcff,#ffffff)",
        "title_card_border": "#c9f0f7",
        "title_color": "#0f172a",
        "h2_border": "#25bfda",
        "h2_color": "#0e7490",
        "h3_color": "#0891b2",
        "body_color": "#334155",
        "body_font_size": "15px",
        "body_line_height": "1.9",
        "list_bg": "#f0fdff",
        "list_border": "#c9f0f7",
        "list_item_color": "#334155",
        "check_color": "#25bfda",
        "quote_bg": "#f0fdff",
        "quote_border": "#67e8f9",
        "quote_color": "#334155",
        "code_bg": "#f0fdff",
        "code_color": "#0e7490",
        "figure_shadow": "rgba(37,191,218,0.10)",
    },
    # Warm Daily — pink accent on warm paper.
    "warm-daily": {
        "label": "暖粉日常（上游 Warm Daily）",
        "container_bg": "#fffdf8",
        "title_card_bg": "linear-gradient(135deg,#fff0f7,#fffdf8)",
        "title_card_border": "#f9d4e4",
        "title_color": "#3f3a33",
        "h2_border": "#d62987",
        "h2_color": "#b81f66",
        "h3_color": "#d62987",
        "body_color": "#3f3a33",
        "body_font_size": "15px",
        "body_line_height": "1.85",
        "list_bg": "#fff0f7",
        "list_border": "#f9d4e4",
        "list_item_color": "#3f3a33",
        "check_color": "#d62987",
        "quote_bg": "#fff0f7",
        "quote_border": "#f0a8cd",
        "quote_color": "#786f63",
        "code_bg": "#fff0f7",
        "code_color": "#b81f66",
        "figure_shadow": "rgba(214,41,135,0.10)",
    },
    # Dark Mode — GitHub dark background, blue accent.
    "dark-mode": {
        "label": "深色暗夜（上游 Dark Mode）",
        "container_bg": "#0d1117",
        "title_card_bg": "linear-gradient(135deg,#161b22,#0d1117)",
        "title_card_border": "#30363d",
        "title_color": "#e6edf3",
        "h2_border": "#58a6ff",
        "h2_color": "#58a6ff",
        "h3_color": "#79c0ff",
        "body_color": "#c9d1d9",
        "body_font_size": "15px",
        "body_line_height": "1.85",
        "list_bg": "#161b22",
        "list_border": "#30363d",
        "list_item_color": "#c9d1d9",
        "check_color": "#58a6ff",
        "quote_bg": "#161b22",
        "quote_border": "#58a6ff",
        "quote_color": "#8b949e",
        "code_bg": "#21262d",
        "code_color": "#79c0ff",
        "figure_shadow": "rgba(0,0,0,0.4)",
    },
    # Elegant Serif — rose accent, serif body, warm paper.
    "elegant-serif": {
        "label": "优雅衬线（上游 Elegant Serif）",
        "container_bg": "#fffdf8",
        "title_card_bg": "linear-gradient(135deg,#fdf2f7,#fffdf8)",
        "title_card_border": "#f0d5e2",
        "title_color": "#3f3a33",
        "h2_border": "#e83e8c",
        "h2_color": "#b81f66",
        "h3_color": "#e83e8c",
        "body_color": "#3f3a33",
        "body_font_size": "16px",
        "body_line_height": "1.9",
        "list_bg": "#fdf2f7",
        "list_border": "#f0d5e2",
        "list_item_color": "#3f3a33",
        "check_color": "#e83e8c",
        "quote_bg": "#fdf2f7",
        "quote_border": "#e8a7c8",
        "quote_color": "#786f63",
        "code_bg": "#fdf2f7",
        "code_color": "#b81f66",
        "figure_shadow": "rgba(232,62,140,0.10)",
        "title_font": "Georgia, 'Times New Roman', serif",
    },
    # Fresh Green — emerald accent, light mint background, card images.
    "fresh-green": {
        "label": "清新薄荷（上游 Fresh Green）",
        "container_bg": "#f8fdfb",
        "title_card_bg": "linear-gradient(135deg,#d1fae5,#f8fdfb)",
        "title_card_border": "#a7f3d0",
        "title_color": "#064e3b",
        "h2_border": "#10b981",
        "h2_color": "#065f46",
        "h3_color": "#059669",
        "body_color": "#374151",
        "body_font_size": "15px",
        "body_line_height": "1.85",
        "list_bg": "#ecfdf5",
        "list_border": "#a7f3d0",
        "list_item_color": "#374151",
        "check_color": "#10b981",
        "quote_bg": "#ecfdf5",
        "quote_border": "#6ee7b7",
        "quote_color": "#374151",
        "code_bg": "#ecfdf5",
        "code_color": "#047857",
        "figure_shadow": "rgba(16,185,129,0.10)",
    },
    # Minimal Gray — quiet gray, no decoration, sharp corners.
    "minimal-gray": {
        "label": "极简灰（上游 Minimal Gray）",
        "container_bg": "#ffffff",
        "title_card_bg": "linear-gradient(135deg,#f9fafb,#ffffff)",
        "title_card_border": "#e5e7eb",
        "title_color": "#111827",
        "h2_border": "#6c757d",
        "h2_color": "#374151",
        "h3_color": "#4b5563",
        "body_color": "#374151",
        "body_font_size": "15px",
        "body_line_height": "1.88",
        "list_bg": "#f9fafb",
        "list_border": "#e5e7eb",
        "list_item_color": "#374151",
        "check_color": "#6c757d",
        "quote_bg": "#f9fafb",
        "quote_border": "#d1d5db",
        "quote_color": "#4b5563",
        "code_bg": "#f3f4f6",
        "code_color": "#374151",
        "figure_shadow": "rgba(0,0,0,0.05)",
    },
    # Vibrant Purple — gold accent, lavender background, gradient headers.
    "vibrant-purple": {
        "label": "活力紫金（上游 Vibrant Purple）",
        "container_bg": "#faf8ff",
        "title_card_bg": "linear-gradient(135deg,#f3e8ff,#faf8ff)",
        "title_card_border": "#e9d5ff",
        "title_color": "#1e1b4b",
        "h2_border": "#c7ac38",
        "h2_color": "#6d28d9",
        "h3_color": "#7c3aed",
        "body_color": "#3b3a4a",
        "body_font_size": "15px",
        "body_line_height": "1.82",
        "list_bg": "#f5f3ff",
        "list_border": "#ddd6fe",
        "list_item_color": "#3b3a4a",
        "check_color": "#c7ac38",
        "quote_bg": "#f5f3ff",
        "quote_border": "#c4b5fd",
        "quote_color": "#3b3a4a",
        "code_bg": "#f5f3ff",
        "code_color": "#6d28d9",
        "figure_shadow": "rgba(199,172,56,0.10)",
    },
    # Magazine Style — editorial red accent, bordered images, warm paper.
    "magazine-style": {
        "label": "杂志编辑（上游 Magazine Style）",
        "container_bg": "#fefaf6",
        "title_card_bg": "linear-gradient(135deg,#fef2f2,#fefaf6)",
        "title_card_border": "#fecaca",
        "title_color": "#1c1917",
        "h2_border": "#dc2626",
        "h2_color": "#991b1b",
        "h3_color": "#b91c1c",
        "body_color": "#1c1917",
        "body_font_size": "16px",
        "body_line_height": "1.88",
        "list_bg": "#fef2f2",
        "list_border": "#fecaca",
        "list_item_color": "#1c1917",
        "check_color": "#dc2626",
        "quote_bg": "#fef2f2",
        "quote_border": "#fca5a5",
        "quote_color": "#78716c",
        "code_bg": "#fef2f2",
        "code_color": "#991b1b",
        "figure_shadow": "rgba(220,38,38,0.08)",
    },
    # Academic Paper — amber accent, serif, bookmark quotes.
    "academic-paper": {
        "label": "学术论文（上游 Academic Paper）",
        "container_bg": "#fffdf8",
        "title_card_bg": "linear-gradient(135deg,#fef3c7,#fffdf8)",
        "title_card_border": "#fde68a",
        "title_color": "#292524",
        "h2_border": "#d97706",
        "h2_color": "#92400e",
        "h3_color": "#b45309",
        "body_color": "#292524",
        "body_font_size": "17px",
        "body_line_height": "1.92",
        "list_bg": "#fffbeb",
        "list_border": "#fde68a",
        "list_item_color": "#292524",
        "check_color": "#d97706",
        "quote_bg": "#fffbeb",
        "quote_border": "#fcd34d",
        "quote_color": "#78716c",
        "code_bg": "#fffbeb",
        "code_color": "#92400e",
        "figure_shadow": "rgba(217,119,6,0.10)",
        "title_font": "Georgia, 'Times New Roman', serif",
    },
    # Rose Romance — romantic rose palette (upstream frontmatter minimal).
    "rose-romance": {
        "label": "玫瑰浪漫（上游 Rose Romance）",
        "container_bg": "#fffafc",
        "title_card_bg": "linear-gradient(135deg,#ffe4ec,#fffafc)",
        "title_card_border": "#fbcfe8",
        "title_color": "#4c0519",
        "h2_border": "#ec4899",
        "h2_color": "#be185d",
        "h3_color": "#db2777",
        "body_color": "#4c1d34",
        "body_font_size": "15px",
        "body_line_height": "1.88",
        "list_bg": "#fdf2f8",
        "list_border": "#fbcfe8",
        "list_item_color": "#4c1d34",
        "check_color": "#ec4899",
        "quote_bg": "#fdf2f8",
        "quote_border": "#f9a8d4",
        "quote_color": "#6b3a52",
        "code_bg": "#fdf2f8",
        "code_color": "#be185d",
        "figure_shadow": "rgba(236,72,153,0.10)",
    },
}

DEFAULT_THEME = "professional-clean"

ACCOUNTS = {
    "dog": {
        "name": "狗狗生活小百科",
        "appid": EXPECTED_DOG_APPID,
        "secret_env": "DOG_WECHAT_SECRET",
    },
    "default": {
        "name": "峰AI路",
        "appid": os.environ.get("WECHAT_APP_ID_DEFAULT", "") or os.environ.get("WECHAT_APP_ID", "") or "wx42b46ea46863a720",
        "secret_env": "WECHAT_APP_SECRET_DEFAULT",
    },
    "feng": {
        "name": "峰AI路",
        "appid": os.environ.get("WECHAT_APP_ID_DEFAULT", "") or os.environ.get("WECHAT_APP_ID", "") or "wx42b46ea46863a720",
        "secret_env": "WECHAT_APP_SECRET_DEFAULT",
    },
}


def die(msg: str, code: int = 2) -> None:
    print(json.dumps({"ok": False, "error": msg}, ensure_ascii=False, indent=2), file=sys.stderr)
    raise SystemExit(code)


def load_default_env(env_path: str = DEFAULT_ENV) -> None:
    p = Path(env_path)
    if not p.exists():
        return
    for raw in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def resolve_account(account: str | None, appid: str | None, secret: str | None) -> tuple[str, str, str]:
    if account:
        if account not in ACCOUNTS:
            die(f"Unknown account alias: {account}. Known: {', '.join(ACCOUNTS)}")
        cfg = ACCOUNTS[account]
        resolved_appid = appid or cfg["appid"] or os.environ.get("DOG_WECHAT_APPID", "")
        resolved_secret = secret or os.environ.get(cfg["secret_env"], "")
        return cfg["name"], resolved_appid, resolved_secret
    resolved_appid = appid or os.environ.get("DOG_WECHAT_APPID", "")
    resolved_secret = secret or os.environ.get("DOG_WECHAT_SECRET", "")
    return "custom", resolved_appid, resolved_secret


def request_json(url: str, *, method: str = "GET", data: bytes | None = None, headers: dict | None = None) -> dict:
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=90) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        die(f"Non-JSON response from WeChat API: {raw[:500]}")
    if obj.get("errcode") not in (None, 0):
        die(f"WeChat API error: {obj}", code=3)
    return obj


def get_access_token(appid: str, secret: str) -> tuple[str, dict]:
    qs = urllib.parse.urlencode({"grant_type": "client_credential", "appid": appid, "secret": secret})
    obj = request_json(f"{TOKEN_URL}?{qs}")
    token = obj.get("access_token")
    if not token:
        die(f"access_token missing: {obj}")
    return token, {"expires_in": obj.get("expires_in"), "access_token_received": True}


def encode_multipart(fields: dict[str, str], files: dict[str, Path]) -> tuple[bytes, str]:
    boundary = "----HermesWeWriteBoundary7MA4YWxkTrZu0gW"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        chunks.append(str(value).encode())
        chunks.append(b"\r\n")
    for name, path in files.items():
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'.encode())
        chunks.append(f"Content-Type: {ctype}\r\n\r\n".encode())
        chunks.append(path.read_bytes())
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), boundary


def upload_thumb(token: str, cover: Path) -> str:
    if not cover.exists() or not cover.is_file():
        die(f"Cover image not found: {cover}")
    qs = urllib.parse.urlencode({"access_token": token, "type": "thumb"})
    body, boundary = encode_multipart({}, {"media": cover})
    obj = request_json(f"{UPLOAD_URL}?{qs}", method="POST", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    media_id = obj.get("media_id")
    if not media_id:
        die(f"thumb media_id missing: {obj}")
    return media_id


def upload_article_image(token: str, image: Path) -> str:
    """Upload a local body image for use inside WeChat article content HTML."""
    if not image.exists() or not image.is_file():
        die(f"Article image not found: {image}")
    qs = urllib.parse.urlencode({"access_token": token})
    body, boundary = encode_multipart({}, {"media": image})
    obj = request_json(f"{UPLOADIMG_URL}?{qs}", method="POST", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    url = obj.get("url")
    if not url:
        die(f"article image url missing: {obj}")
    return url


def collect_markdown_images(md: str, base_dir: Path) -> dict[str, Path]:
    """Collect local Markdown image references like ![alt](relative.png)."""
    images: dict[str, Path] = {}
    for m in re.finditer(r"!\[[^\]]*\]\(([^)]+)\)", md):
        raw = m.group(1).strip().strip('"').strip("'")
        if not raw or raw.startswith(("http://", "https://", "data:")):
            continue
        path = Path(raw)
        if not path.is_absolute():
            path = base_dir / path
        images[raw] = path
    return images


def inline(text: str, theme: dict | None = None) -> str:
    theme = theme or THEMES[DEFAULT_THEME]
    safe = html.escape(text)
    safe = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", safe)
    safe = re.sub(
        r"`(.+?)`",
        f"<code style='background:{theme['code_bg']};border-radius:4px;padding:1px 4px;color:{theme['code_color']};'>\\1</code>",
        safe,
    )
    return safe


def render_article(md: str, image_url_map: dict[str, str] | None = None, theme_name: str = DEFAULT_THEME) -> tuple[str, str]:
    theme = THEMES.get(theme_name, THEMES[DEFAULT_THEME])
    lines = md.splitlines()
    title = "微信公众号文章"
    body: list[str] = []
    pending_ul: list[str] = []
    para: list[str] = []
    image_url_map = image_url_map or {}
    title_font = theme.get("title_font", "")

    def flush_para() -> None:
        nonlocal para
        if para:
            text = " ".join(x.strip() for x in para if x.strip())
            body.append(
                f"<p style=\"margin: 14px 0; color:{theme['body_color']}; font-size:{theme['body_font_size']}; line-height:{theme['body_line_height']}; letter-spacing:0.2px;\">"
                + inline(text, theme)
                + "</p>"
            )
            para = []

    def flush_ul() -> None:
        nonlocal pending_ul
        if pending_ul:
            items = "".join(
                f"<li style=\"margin:8px 0;color:{theme['list_item_color']};font-size:15px;line-height:1.75;\">"
                f"<span style=\"color:{theme['check_color']};font-weight:700;\">✓</span> "
                + inline(item, theme)
                + "</li>"
                for item in pending_ul
            )
            body.append(
                f"<section style=\"margin:18px 0;padding:12px 16px;background:{theme['list_bg']};border-radius:12px;border:1px solid {theme['list_border']};\">"
                f"<ul style=\"padding-left:0;list-style:none;margin:0;\">{items}</ul></section>"
            )
            pending_ul = []

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            flush_para(); flush_ul(); continue
        img = re.match(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$", line.strip())
        if img:
            flush_para(); flush_ul()
            alt = img.group(1).strip()
            raw_src = img.group(2).strip().strip('"').strip("'")
            src = image_url_map.get(raw_src, raw_src)
            # Body images use Markdown alt text for accessibility/context only.
            # Do not render visible captions in WeChat drafts: writing workflows
            # historically inserted descriptive alt text such as "正文配图：...",
            # and exposing it below the image looks like an editor note in the
            # published article. Also strip that editor prefix from the alt attr.
            alt_attr = re.sub(r"^(正文配图|配图说明)\s*[：:]\s*", "", alt).strip()
            body.append(
                "<figure style=\"margin:22px 0;text-align:center;\">"
                f"<img src=\"{html.escape(src, quote=True)}\" alt=\"{html.escape(alt_attr, quote=True)}\" "
                f"style=\"max-width:100%;border-radius:14px;display:block;margin:0 auto;box-shadow:0 6px 18px {theme['figure_shadow']};\"/>"
                + "</figure>"
            )
            continue
        if line.startswith("# "):
            if title == "微信公众号文章":
                title = line[2:].strip()[:64]
            continue
        if line.startswith("## "):
            flush_para(); flush_ul()
            heading = line[3:].strip()
            body.append(
                f"<section style=\"margin:28px 0 14px;padding:0 0 0 12px;border-left:4px solid {theme['h2_border']};\">"
                f"<h2 style=\"margin:0;color:{theme['h2_color']};font-size:19px;line-height:1.5;font-weight:700;{('font-family:' + title_font + ';') if title_font else ''}\">{inline(heading, theme)}</h2></section>"
            )
            continue
        if line.startswith("### "):
            flush_para(); flush_ul()
            heading = line[4:].strip()
            body.append(f"<h3 style=\"margin:20px 0 8px;color:{theme['h3_color']};font-size:17px;line-height:1.6;\">{inline(heading, theme)}</h3>")
            continue
        if line.startswith(">"):
            flush_para(); flush_ul()
            quote = line.lstrip("> ").strip()
            body.append(
                f"<blockquote style=\"margin:18px 0;padding:12px 16px;background:{theme['quote_bg']};border-left:4px solid {theme['quote_border']};color:{theme['quote_color']};line-height:1.8;border-radius:8px;\">"
                + inline(quote, theme) + "</blockquote>"
            )
            continue
        m = re.match(r"^[-*]\s+(.+)$", line)
        if m:
            flush_para()
            pending_ul.append(m.group(1).strip())
            continue
        para.append(line)
    flush_para(); flush_ul()
    content = (
        f"<section style=\"max-width:100%;margin:0 auto;padding:4px 0 12px;background:{theme['container_bg']};\">"
        + f"<section style=\"margin:0 0 20px;padding:16px 18px;background:{theme['title_card_bg']};border-radius:14px;border:1px solid {theme['title_card_border']};\">"
        + f"<h1 style=\"margin:0;color:{theme['title_color']};font-size:22px;line-height:1.45;font-weight:800;{('font-family:' + title_font + ';') if title_font else ''}\">{inline(title, theme)}</h1>"
        + "</section>"
        + "".join(body)
        + "</section>"
    )
    return title, content


def add_draft(token: str, *, title: str, author: str, digest: str, content_html: str, thumb_media_id: str, source_url: str = "") -> dict:
    payload = {
        "articles": [
            {
                "title": title[:64],
                "author": author[:8] if author else "",
                "digest": digest[:120] if digest else "",
                "content": content_html,
                "content_source_url": source_url,
                "thumb_media_id": thumb_media_id,
                "need_open_comment": 0,
                "only_fans_can_comment": 0,
            }
        ]
    }
    qs = urllib.parse.urlencode({"access_token": token})
    return request_json(f"{DRAFT_URL}?{qs}", method="POST", data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Content-Type": "application/json; charset=utf-8"})


def main() -> int:
    load_default_env()
    ap = argparse.ArgumentParser(description="WeWrite professional-clean WeChat draft publisher")
    ap.add_argument("markdown", type=Path, nargs="?", help="Article markdown")
    ap.add_argument("cover", type=Path, nargs="?", help="Local cover image")
    ap.add_argument("--account", default="dog", help="Account alias, default: dog")
    ap.add_argument("--appid", default=None)
    ap.add_argument("--secret", default=None)
    ap.add_argument("--author", default="狗狗生活小百科")
    ap.add_argument("--digest", default="给铲屎官的一份实用提醒")
    ap.add_argument("--source-url", default="")
    ap.add_argument("--theme", default=DEFAULT_THEME, help="Render theme. Use --list-themes to see available themes. Default: professional-clean")
    ap.add_argument("--list-themes", action="store_true", help="List available render themes and exit")
    ap.add_argument("--html-out", type=Path, default=None, help="Write rendered HTML to this file")
    ap.add_argument("--dry-run", action="store_true", help="Render and validate token/account, but do not upload cover or create draft")
    ap.add_argument("--allow-non-dog-appid", action="store_true")
    args = ap.parse_args()

    if args.list_themes:
        print(json.dumps({name: t.get("label", name) for name, t in THEMES.items()}, ensure_ascii=False, indent=2))
        return 0

    if not args.markdown:
        ap.print_help()
        return 0
    if args.theme not in THEMES:
        die(f"Unknown theme: {args.theme}. Known: {', '.join(THEMES)}")
    account_name, appid, secret = resolve_account(args.account, args.appid, args.secret)
    if not appid:
        die("Missing appid. Use --appid or DOG_WECHAT_APPID/account alias.")
    if not secret:
        die("Missing secret. Use --secret or account secret env var.")
    if appid != EXPECTED_DOG_APPID and not args.allow_non_dog_appid:
        die(f"Refusing to publish to non-dog appid {appid}; expected {EXPECTED_DOG_APPID}.")
    if not args.markdown.exists():
        die(f"Markdown file not found: {args.markdown}")
    if not args.dry_run and (not args.cover or not args.cover.exists()):
        die(f"Cover image not found: {args.cover}")

    md = args.markdown.read_text(encoding="utf-8")
    hits = [x for x in FORBIDDEN if x in md]
    if hits:
        die("Forbidden publish text found: " + ", ".join(hits))

    local_images = collect_markdown_images(md, args.markdown.parent)
    token, token_meta = get_access_token(appid, secret)
    image_url_map: dict[str, str] = {}
    if args.dry_run:
        # Render local paths in dry-run so layout can be inspected without upload side effects.
        image_url_map = {raw: str(path) for raw, path in local_images.items()}
    else:
        image_url_map = {raw: upload_article_image(token, path) for raw, path in local_images.items()}

    title, content_html = render_article(md, image_url_map, args.theme)
    if args.html_out:
        args.html_out.parent.mkdir(parents=True, exist_ok=True)
        args.html_out.write_text(content_html, encoding="utf-8")

    if args.dry_run:
        print(json.dumps({
            "ok": True,
            "dry_run": True,
            "account": account_name,
            "appid": appid,
            "title": title,
            "theme": args.theme,
            "html_out": str(args.html_out) if args.html_out else None,
            "html_bytes": len(content_html.encode('utf-8')),
            "token": token_meta,
            "article_images": {raw: str(path) for raw, path in local_images.items()},
        }, ensure_ascii=False, indent=2))
        return 0

    thumb_media_id = upload_thumb(token, args.cover)
    draft_resp = add_draft(token, title=title, author=args.author, digest=args.digest, content_html=content_html, thumb_media_id=thumb_media_id, source_url=args.source_url)
    print(json.dumps({
        "ok": True,
        "renderer": f"wewrite/{args.theme}",
        "account": account_name,
        "appid": appid,
        "title": title,
        "markdown": str(args.markdown),
        "cover": str(args.cover),
        "html_out": str(args.html_out) if args.html_out else None,
        "article_images": image_url_map,
        "thumb_media_id": thumb_media_id,
        "draft_media_id": draft_resp.get("media_id"),
        "draft_response": draft_resp,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
