#!/usr/bin/env python3
"""主色同族联动（换色）——把已排版 gzh 正文里同色族的颜色按 HSL 相对偏移迁移到新主色。

借鉴 zhouxing-paiban-wx 的 shiftCssColors 方法论，为 gzh 内联样式产物独立实现：
- 以主题原主色为基准，同色族（hue 距离 <= hue_range 且饱和 >= sat_min）按 H/S/L 相对偏移迁移；
- alpha 保持不变；低饱和中性色（灰/黑/白正文）不染色；
- 灰度主题（grayscale:true，如石墨）只迁移「主色灰族」：饱和度低且明度落在主色明度 ±10 的深色识别元素；
- 不同色族的点缀色（如摸鱼绿的黄色高亮、橄榄手记的橙）保持不变。

用法:
    retint.py <input.html> --accent #RRGGBB [--theme <id>] [--hue-range N] [--output out.html]
    --theme 未给时从 --accent 作目标色、默认 hue_range=42/sat_min=15；给了 --theme 则读
    assets/theme-vars.json 中该主题的 accent/hue_range/sat_min/grayscale。

仅重写内联 style 里的颜色，不改行内文本 / 结构 / 其它属性。
"""

import argparse
import json
import os
import re
import sys
import copy


def parse_color(token):
    token = token.strip()
    if token.startswith("#"):
        hexv = token[1:]
        if len(hexv) in (3, 4):
            hexv = "".join(c * 2 for c in hexv)
        if len(hexv) not in (6, 8):
            return None
        try:
            r = int(hexv[0:6], 16)
        except ValueError:
            return None
        return {
            "r": (r >> 16) & 255, "g": (r >> 8) & 255, "b": r & 255,
            "a": int(hexv[6:8], 16) / 255 if len(hexv) == 8 else 1.0,
        }
    m = re.match(r"^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$", token, re.I)
    if m:
        return {
            "r": int(float(m.group(1))), "g": int(float(m.group(2))), "b": int(float(m.group(3))),
            "a": float(m.group(4)) if m.group(4) is not None else 1.0,
        }
    return None


def rgb_to_hsl(r, g, b):
    r, g, b = r / 255, g / 255, b / 255
    mx, mn = max(r, g, b), min(r, g, b)
    d = mx - mn
    l = (mx + mn) / 2
    if d == 0:
        return {"h": 0, "s": 0, "l": l * 100}
    s = d / (1 - abs(2 * l - 1))
    if mx == r:
        h = 60 * (((g - b) / d) % 6)
    elif mx == g:
        h = 60 * ((b - r) / d + 2)
    else:
        h = 60 * ((r - g) / d + 4)
    return {"h": (h + 360) % 360, "s": s * 100, "l": l * 100}


def hsl_to_rgb(h, s, l):
    s, l = s / 100, l / 100
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60:
        r, g, b = c, x, 0
    elif h < 120:
        r, g, b = x, c, 0
    elif h < 180:
        r, g, b = 0, c, x
    elif h < 240:
        r, g, b = 0, x, c
    elif h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    return {"r": round((r + m) * 255), "g": round((g + m) * 255), "b": round((b + m) * 255)}


def color_to_css(color):
    if color["a"] < 0.999:
        return "rgba(%d, %d, %d, %s)" % (color["r"], color["g"], color["b"], round(color["a"], 3))
    return "#%02X%02X%02X" % (color["r"], color["g"], color["b"])


def hue_distance(a, b):
    return abs(((a - b + 540) % 360) - 180)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def shift_css_colors(css, old_hex, new_hex, hue_range=42, sat_min=15, grayscale=False):
    if old_hex.upper() == new_hex.upper():
        return css
    old = parse_color(old_hex)
    new = parse_color(new_hex)
    if not old or not new:
        return css
    old_hsl = rgb_to_hsl(old["r"], old["g"], old["b"])
    target_hsl = rgb_to_hsl(new["r"], new["g"], new["b"])

    def shift_token(token):
        color = parse_color(token)
        if not color:
            return token
        hsl = rgb_to_hsl(color["r"], color["g"], color["b"])
        exact = color["r"] == old["r"] and color["g"] == old["g"] and color["b"] == old["b"]
        if grayscale:
            # 灰度主题：只迁移主色灰族（低饱和且明度落在主色 ±10 的深色识别元素）
            related = (hsl["s"] < sat_min and abs(hsl["l"] - old_hsl["l"]) <= 10)
        else:
            related = (hsl["s"] >= sat_min and hue_distance(hsl["h"], old_hsl["h"]) <= hue_range)
        if not exact and not related:
            return token
        hue_off = ((hsl["h"] - old_hsl["h"] + 540) % 360) - 180
        shifted = hsl_to_rgb(
            (target_hsl["h"] + hue_off) % 360,
            clamp(target_hsl["s"] + (hsl["s"] - old_hsl["s"]), 0, 100),
            clamp(target_hsl["l"] + (hsl["l"] - old_hsl["l"]), 2, 98),
        )
        return color_to_css({**shifted, "a": color["a"]})

    color_re = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+)?\s*\)")
    return color_re.sub(lambda m: shift_token(m.group(0)), css)


def process_html(html, old_hex, new_hex, hue_range, sat_min, grayscale):
    # 只改 style="..." 属性内的颜色；否定后顾避免误中 data-style 等其它属性
    def repl_style(m):
        return m.group(1) + shift_css_colors(m.group(2), old_hex, new_hex, hue_range, sat_min, grayscale) + m.group(3)

    style_re = re.compile(r'(?<![\w-])(style=")(.*?)(")', re.S)
    return style_re.sub(repl_style, html)


def load_theme(theme_id, theme_vars_path):
    data = json.load(open(theme_vars_path, encoding="utf-8"))
    t = data.get("themes", {}).get(theme_id)
    if not t:
        sys.exit(f"✗ 主题 {theme_id} 不在 theme-vars.json")
    return t["accent"], t.get("hue_range", 42), t.get("sat_min", 15), bool(t.get("grayscale"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--accent", required=True)
    ap.add_argument("--theme")
    ap.add_argument("--hue-range", type=int)
    ap.add_argument("--sat-min", type=int)
    ap.add_argument("--output")
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        sys.exit(f"✗ 找不到文件: {args.input}")

    tpl_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    theme_vars_path = os.path.join(tpl_dir, "assets", "theme-vars.json")

    if args.theme:
        old_accent, hue, sat, grayscale = load_theme(args.theme, theme_vars_path)
    else:
        old_accent, hue, sat, grayscale = args.accent, args.hue_range or 42, args.sat_min or 15, False
    if args.hue_range:
        hue = args.hue_range
    if args.sat_min:
        sat = args.sat_min

    html = open(args.input, encoding="utf-8").read()
    out = process_html(html, old_accent, args.accent, hue, sat, grayscale)
    out_path = args.output or (os.path.splitext(args.input)[0] + f"_re-{args.accent.lstrip('#')}.html")
    open(out_path, "w", encoding="utf-8").write(out)
    changes = sum(1 for _ in re.finditer(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)", out))
    print(f"✓ 已换色: 主题原主色 {old_accent} → 新主色 {args.accent.upper()} (hue_range={hue}, sat_min={sat}, grayscale={grayscale})")
    print(f"  输出: {out_path}  （共 {changes} 处颜色）")


if __name__ == "__main__":
    main()
