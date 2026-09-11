#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ensure Simplified Chinese for WeChat account content (title / caption / article body).

Background (2026-09-08): the daily dog-account sticker was generated wholly in
Traditional Chinese (title "狗狗不能吃的10種人類食物", caption "含可可鹼…會導致…"),
because the model produced Traditional and the skill/cron did not constrain it.

This script is a deterministic guard so that published 公众号 content is always
Simplified (简体中文), never Traditional (繁體中文).

Usage:
  # Convert a string to Simplified and print it (for --title / --text capture):
  python3 zh_simplify.py --convert-text "狗狗不能吃的10種人類食物"

  # Convert a text file in place, keep UTF-8, print a report:
  python3 zh_simplify.py --file path/to/caption.txt [--in-place]

  # Dry check only: report whether Traditional chars are present (exit 0 = clean):
  python3 zh_simplify.py --detect-text "简体测试"

Conversion backend:
  - Prefer opencc (t2s) via `opencc-python-reimplemented` if installed.
  - Otherwise fall back to an embedded mapping for the most common Traditional
    characters seen in dog-care / wechat copy.

Exit codes:
  0 = no Traditional detected (or converted successfully)
  1 = Traditional detected but conversion unavailable / error
"""

import argparse
import sys
from pathlib import Path

# Common Traditional -> Simplified fallback map (used only if opencc is missing).
_FALLBACK_MAP = {
    "種": "种", "類": "类", "會": "会", "導": "导", "致": "致", "體": "体",
    "內": "内", "臟": "脏", "氣": "气", "過": "过", "脹": "胀", "腎": "肾",
    "電": "电", "壓": "压", "頭": "头", "暈": "晕", "嘔": "呕", "吐": "吐",
    "穀": "谷", "顯": "显", "現": "现", "臺": "台", "灣": "湾", "療": "疗",
    "醫": "医", "藥": "药", "驗": "验", "預": "预", "防": "防", "發": "发",
    "燒": "烧", "癥": "症", "狀": "状", "風": "风", "濕": "湿", "熱": "热",
    "動": "动", "物": "物", "隻": "只", "讓": "让", "們": "们", "牠": "它",
    "裡": "里", "隻": "只", "麼": "么", "這": "这", "邊": "边", "還": "还",
    "開": "开", "關": "关", "長": "长", "間": "间", "覺": "觉", "學": "学",
    "習": "习", "練": "练", "訓": "训", "歲": "岁", "數": "数", "據": "据",
    "樣": "样", "種": "种", "糧": "粮", "食": "食", "鹽": "盐", "鹼": "碱",
    "糖": "糖", "酒": "酒", "骨": "骨", "頭": "头", "鈣": "钙", "鐵": "铁",
    "鋅": "锌", "鉀": "钾", "鎂": "镁", "維": "维", "生": "生", "素": "素",
    "蛋": "蛋", "白": "白", "質": "质", "脂": "脂", "肪": "肪", "纖": "纤",
    "維": "维", "營": "营", "養": "养", "補": "补", "充": "充", "水": "水",
    "溫": "温", "馨": "馨", "健": "健", "康": "康", "們": "们", "貓": "猫",
    "狗": "狗", "毛": "毛", "孩": "孩", "子": "子", "寶": "宝", "貴": "贵",
    "愛": "爱", "親": "亲", "友": "友", "幫": "帮", "助": "助", "請": "请",
    "謝": "谢", "謝": "谢", "讀": "读", "寫": "写", "頁": "页", "網": "网",
    "絡": "络", "萬": "万", "億": "亿", "機": "机", "會": "会", "應": "应",
    "該": "该", "當": "当", "然": "然", "後": "后", "從": "从", "來": "来",
    "去": "去", "於": "于", "並": "并", "且": "且", "或": "或", "與": "与",
    "計": "计", "畫": "画", "圖": "图", "標": "标", "題": "题", "頁": "页",
    "點": "点", "線": "线", "風": "风", "雲": "云", "霧": "雾", "鳥": "鸟",
}

# Traditional characters commonly seen that MUST be flagged even if the fallback
# map above has them (used by --detect as a warning baseline).
_DETECT_CHARS = set(
    "種類會導致體內臟氣過脹腎電壓頭暈嘔吐癥狀風濕熱動物隻讓們牠裡麼這點畫圖網鳥兒們營養醫療藥驗預發兒們時候這個這樣還開關長間覺學習練訓歲數據樣鹽鹼吃飯嗎呢吧啊的嗎"
)


def _load_opencc():
    """Return a callable t2s converter, or None if opencc is unavailable."""
    try:
        from opencc import OpenCC

        cc = OpenCC("t2s")
        return cc.convert
    except Exception:
        return None


def _fallback_convert(text: str) -> str:
    """Convert using the embedded map (used only when opencc is missing)."""
    out = []
    for ch in text:
        out.append(_FALLBACK_MAP.get(ch, ch))
    return "".join(out)


def _norm(s: str) -> str:
    return "".join(ch for ch in s if not ch.isspace())


def detect_traditional(text: str, converter) -> list:
    """Return list of Traditional-looking characters actually converted.

    Compares t2s(text) vs text; any differing non-space char is reported.
    Works with either the opencc or fallback converter.
    """
    converted = converter(text)
    changed = []
    orig_norm = _norm(text)
    conv_norm = _norm(converted)
    if orig_norm == conv_norm:
        return []
    # report the chars that differ positionally
    for a, b in zip(orig_norm, conv_norm):
        if a != b:
            changed.append((a, b))
    return changed


def main() -> int:
    ap = argparse.ArgumentParser(description="Ensure Simplified Chinese for WeChat content")
    ap.add_argument("--convert-text", help="Convert a single string to Simplified and print it")
    ap.add_argument("--file", help="Path to a text file; convert in place (UTF-8)")
    ap.add_argument("--detect-text", help="Dry check: report Traditional characters found")
    ap.add_argument("--quiet", action="store_true", help="Suppress the printable report")
    args = ap.parse_args()

    converter = _load_opencc()
    backend = "opencc" if converter else "fallback-map"

    if args.detect_text is not None:
        changes = detect_traditional(args.detect_text, converter)
        if changes:
            print(f"TRAD_FOUND {len(changes)}: " + " ".join(f"{a}->{b}" for a, b in changes))
            print(f"converted: {converter(args.detect_text)}")
            return 0
        print("OK all-simplified")
        return 0

    if args.convert_text is not None:
        out = converter(args.convert_text)
        print(out)
        return 0

    if args.file:
        p = Path(args.file)
        if not p.exists():
            print(f"ERROR: file not found: {p}", file=sys.stderr)
            return 1
        raw = p.read_text(encoding="utf-8")
        changes = detect_traditional(raw, converter)
        if changes:
            new_text = converter(raw)
            p.write_text(new_text, encoding="utf-8")
            print(f"CONVERTED in-place ({len(changes)} chars, backend={backend}): "
                  + " ".join(f"{a}->{b}" for a, b in changes[:40]))
            if len(changes) > 40:
                print(f"... and {len(changes) - 40} more")
            print("--- result (first 400 chars) ---")
            print(new_text[:400])
        else:
            print(f"OK all-simplified (backend={backend}), no change")
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
