#!/usr/bin/env python3
"""Compose a WeChat newspic/sticker infographic with deterministic Simplified Chinese text.

The background should come from a real text-to-image model and contain NO text.
This compositor creates the final 1080x1440 3:4 mobile-safe card with reliable
Noto CJK text so T2I pseudo-Chinese never reaches the WeChat draft box.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Iterable, List, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont

CANVAS = (1080, 1440)
SAFE_X = 92
SAFE_TOP = 142
SAFE_BOTTOM = 1294
FONT_REG = "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc"
FONT_MED = "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Medium.ttc"
FONT_BOLD = "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Bold.ttc"
FONT_BLACK = "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Black.ttc"

FORBIDDEN_RE = re.compile(r"[\u3040-\u30ff\uff66-\uff9f\u1100-\u11ff\u3130-\u318f\ufffd]")
# High-signal traditional variants commonly produced by image models.
TRADITIONAL_HINTS = set("體醫為與觀點門開關後變應發現號風險學習數據資訊圖標題樣態時長雲這裡個會腳獸齒濕護補營養")


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size, index=0)


def text_w(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> int:
    if not text:
        return 0
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0]


def text_h(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> int:
    box = draw.textbbox((0, 0), text or "测", font=fnt)
    return box[3] - box[1]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int, max_lines: int | None = None) -> List[str]:
    text = re.sub(r"\s+", " ", (text or "").strip())
    lines: List[str] = []
    buf = ""
    no_line_start = set("。，、；：！？）】》,.!?;:)")
    for ch in text:
        trial = buf + ch
        # Do not leave punctuation alone at the start of the next line; allow a
        # tiny overflow so Chinese sentences keep natural rhythm.
        if text_w(draw, trial, fnt) <= max_width or not buf or ch in no_line_start:
            buf = trial
        else:
            lines.append(buf.rstrip())
            buf = ch
            if max_lines and len(lines) >= max_lines:
                break
    if buf and (not max_lines or len(lines) < max_lines):
        lines.append(buf.rstrip())
    # If a line still starts with punctuation, merge it back into previous line.
    fixed: List[str] = []
    for line in lines:
        if fixed and line and line[0] in no_line_start:
            fixed[-1] += line[0]
            if len(line) > 1:
                fixed.append(line[1:])
        else:
            fixed.append(line)
    lines = fixed
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
    return lines


def draw_multiline(draw: ImageDraw.ImageDraw, xy: Tuple[int, int], lines: Iterable[str], fnt: ImageFont.ImageFont, fill, line_gap=10, anchor_center=False) -> int:
    x, y = xy
    total_h = 0
    prepared = list(lines)
    for i, line in enumerate(prepared):
        h = text_h(draw, line, fnt)
        w = text_w(draw, line, fnt)
        dx = x - w // 2 if anchor_center else x
        draw.text((dx, y + total_h), line, font=fnt, fill=fill)
        total_h += h + (line_gap if i < len(prepared) - 1 else 0)
    return total_h


def rounded_panel(draw: ImageDraw.ImageDraw, box, radius=34, fill=(255, 255, 255, 232), outline=(255, 255, 255, 245)):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)


def cover_crop(im: Image.Image, size=CANVAS) -> Image.Image:
    im = im.convert("RGB")
    sw, sh = im.size
    tw, th = size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def make_gradient(size=CANVAS) -> Image.Image:
    w, h = size
    grad = Image.new("RGBA", size, (0, 0, 0, 0))
    px = grad.load()
    for y in range(h):
        top_alpha = max(0, 135 - int(y * 0.45)) if y < 320 else 0
        bottom_alpha = max(0, int((y - 1050) * 0.38)) if y > 1050 else 0
        a = min(155, top_alpha + bottom_alpha)
        for x in range(w):
            px[x, y] = (8, 18, 34, a)
    return grad


def parse_cards(cards_raw: str) -> List[Tuple[str, str]]:
    try:
        data = json.loads(cards_raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"--cards must be JSON array: {exc}")
    cards = []
    for item in data:
        if isinstance(item, dict):
            title = str(item.get("title", "")).strip()
            body = str(item.get("body", "") or item.get("text", "")).strip()
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            title, body = str(item[0]).strip(), str(item[1]).strip()
        else:
            raise SystemExit("Each card must be {'title':..., 'body':...} or [title, body]")
        if title and body:
            cards.append((title, body))
    if not (3 <= len(cards) <= 4):
        raise SystemExit("Require 3-4 cards for readable sticker layout")
    return cards


def audit_simplified_text(texts: Iterable[str]) -> List[str]:
    issues = []
    for text in texts:
        if FORBIDDEN_RE.search(text):
            issues.append(f"forbidden non-Simplified/CJK-adjacent glyph in: {text}")
        hits = sorted({ch for ch in text if ch in TRADITIONAL_HINTS})
        # This is intentionally conservative: only warn, because some chars overlap in valid contexts.
        if hits:
            issues.append(f"possible traditional/variant chars {''.join(hits)} in: {text}")
        if "\\u" in text or "�" in text:
            issues.append(f"escaped/mojibake text in: {text}")
    return issues


def compose(background: Path, output: Path, title: str, subtitle: str, cards: List[Tuple[str, str]], footer: str, theme: str) -> dict:
    base = cover_crop(Image.open(background), CANVAS)
    # Suppress any accidental model text/noise in the background. Production
    # prompts still require text-free backgrounds, but this makes the compositor
    # robust when a model ignores "no text".
    bg = base.filter(ImageFilter.GaussianBlur(radius=2.4)).convert("RGBA")
    wash = Image.new("RGBA", CANVAS, (255, 255, 255, 34 if theme == "dog" else 18))
    bg = Image.alpha_composite(bg, wash)
    bg = Image.alpha_composite(bg, make_gradient())
    draw = ImageDraw.Draw(bg)
    # Extra crop-safety masks: never leave readable model text in WeChat's top
    # and bottom preview/crop bands.
    draw.rectangle((0, 0, CANVAS[0], 126), fill=(10, 22, 42, 154))
    draw.rectangle((0, 1308, CANVAS[0], CANVAS[1]), fill=(10, 22, 42, 168))

    title_font = font(FONT_BLACK, 70 if len(title) <= 12 else 62)
    subtitle_font = font(FONT_MED, 34)
    card_title_font = font(FONT_BOLD, 42)
    card_body_font = font(FONT_REG, 30)
    footer_font = font(FONT_MED, 30)
    tag_font = font(FONT_MED, 26)

    # Header container deliberately starts below SAFE_TOP to avoid WeChat crop/preview overlap.
    header_box = (SAFE_X, SAFE_TOP, CANVAS[0] - SAFE_X, 345)
    rounded_panel(draw, header_box, radius=38, fill=(255, 255, 255, 236))
    accent = (255, 137, 75, 255) if theme == "dog" else (70, 138, 255, 255)
    draw.rounded_rectangle((SAFE_X + 28, SAFE_TOP + 30, SAFE_X + 42, 314), radius=7, fill=accent)
    title_lines = wrap_text(draw, title, title_font, header_box[2] - header_box[0] - 110, max_lines=2)
    y = SAFE_TOP + 34
    draw_multiline(draw, (SAFE_X + 68, y), title_lines, title_font, fill=(30, 36, 48, 255), line_gap=8)
    sub_y = SAFE_TOP + 128 if len(title_lines) == 1 else SAFE_TOP + 154
    subtitle_lines = wrap_text(draw, subtitle, subtitle_font, header_box[2] - header_box[0] - 110, max_lines=1)
    if subtitle_lines:
        draw_multiline(draw, (SAFE_X + 70, sub_y), subtitle_lines, subtitle_font, fill=(74, 85, 104, 255))

    # Cards: 2x2 for four, vertical spacious for three.
    card_area_top = 405
    card_area_bottom = 1126
    gap = 26
    if len(cards) == 4:
        card_w = (CANVAS[0] - SAFE_X * 2 - gap) // 2
        card_h = 308
        positions = [
            (SAFE_X, card_area_top),
            (SAFE_X + card_w + gap, card_area_top),
            (SAFE_X, card_area_top + card_h + gap),
            (SAFE_X + card_w + gap, card_area_top + card_h + gap),
        ]
    else:
        card_w = CANVAS[0] - SAFE_X * 2
        card_h = 205
        positions = [(SAFE_X, card_area_top + i * (card_h + gap)) for i in range(3)]

    for idx, ((ct, body), (x, y)) in enumerate(zip(cards, positions), 1):
        box = (x, y, x + card_w, y + card_h)
        rounded_panel(draw, box, radius=32, fill=(255, 255, 255, 232))
        draw.ellipse((x + 26, y + 26, x + 74, y + 74), fill=accent)
        num = str(idx)
        nw = text_w(draw, num, tag_font)
        draw.text((x + 50 - nw / 2, y + 34), num, font=tag_font, fill=(255, 255, 255, 255))
        title_lines = wrap_text(draw, ct, card_title_font, card_w - 120, max_lines=2)
        draw_multiline(draw, (x + 92, y + 25), title_lines, card_title_font, fill=(31, 41, 55, 255), line_gap=6)
        body_top = y + 112 if len(title_lines) == 1 else y + 150
        body_lines = wrap_text(draw, body, card_body_font, card_w - 62, max_lines=3 if len(cards) == 4 else 2)
        draw_multiline(draw, (x + 31, body_top), body_lines, card_body_font, fill=(55, 65, 81, 255), line_gap=8)

    footer_box = (SAFE_X, 1168, CANVAS[0] - SAFE_X, SAFE_BOTTOM)
    rounded_panel(draw, footer_box, radius=30, fill=(22, 30, 46, 218), outline=(255, 255, 255, 70))
    footer_lines = wrap_text(draw, footer, footer_font, footer_box[2] - footer_box[0] - 66, max_lines=2)
    draw_multiline(draw, (footer_box[0] + 34, footer_box[1] + 28), footer_lines, footer_font, fill=(255, 255, 255, 255), line_gap=10)

    output.parent.mkdir(parents=True, exist_ok=True)
    bg.convert("RGB").save(output, quality=94, subsampling=0)
    return {"output": str(output), "size": CANVAS, "safe_area": {"x": SAFE_X, "top": SAFE_TOP, "bottom": SAFE_BOTTOM}, "cards": len(cards)}


def main() -> int:
    ap = argparse.ArgumentParser(description="Compose deterministic Chinese newspic infographic over a T2I background")
    ap.add_argument("--background", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--cards", required=True, help="JSON array of {'title','body'} entries, 3-4 items")
    ap.add_argument("--footer", default="")
    ap.add_argument("--theme", choices=["dog", "ai"], default="ai")
    ap.add_argument("--no-audit", action="store_true")
    args = ap.parse_args()

    cards = parse_cards(args.cards)
    all_text = [args.title, args.subtitle, args.footer] + [x for card in cards for x in card]
    issues = audit_simplified_text(all_text) if not args.no_audit else []
    if issues:
        print(json.dumps({"ok": False, "issues": issues}, ensure_ascii=False, indent=2))
        return 2
    result = compose(Path(args.background), Path(args.output), args.title, args.subtitle, cards, args.footer, args.theme)
    result["ok"] = True
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
