#!/usr/bin/env python3
"""Measure default Feng article-illustration color balance.

This is an advisory gate for 16:9 white-background article illustrations where
Feng occupies roughly 10-20% of the frame. It never replaces visual QA.
"""
from __future__ import annotations

import argparse
import colorsys
import json
from pathlib import Path

from PIL import Image


def metrics(path: Path) -> dict[str, float]:
    image = Image.open(path).convert("RGB")
    image.thumbnail((768, 768))
    pixels = list(image.get_flattened_data()) if hasattr(image, "get_flattened_data") else list(image.getdata())
    total = max(1, len(pixels))
    hsv = [colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0) for r, g, b in pixels]

    def pct(count: int) -> float:
        return round(100.0 * count / total, 2)

    white = pct(sum(1 for r, g, b in pixels if r > 235 and g > 235 and b > 235))
    saturated = pct(sum(1 for h, s, v in hsv if s > 0.18 and v > 0.25))
    blue = pct(sum(1 for h, s, v in hsv if 0.50 <= h <= 0.72 and s > 0.18 and v > 0.20))
    dark_blue = pct(sum(1 for h, s, v in hsv if 0.50 <= h <= 0.72 and s > 0.22 and v < 0.60))
    warm = pct(sum(1 for h, s, v in hsv if 0.035 <= h <= 0.14 and s > 0.22 and v > 0.30))
    ratio = round(blue / max(warm, 0.01), 2)
    return {
        "white_pct": white,
        "saturated_pct": saturated,
        "blue_pct": blue,
        "dark_blue_pct": dark_blue,
        "warm_skin_orange_pct": warm,
        "blue_to_warm_ratio": ratio,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--reference", type=Path)
    parser.add_argument("--strict", action="store_true", help="Exit 1 when default article-image thresholds fail")
    parser.add_argument("--min-white", type=float, default=70.0)
    parser.add_argument("--max-white", type=float, default=88.0)
    parser.add_argument("--max-blue", type=float, default=8.0)
    parser.add_argument("--max-dark-blue", type=float, default=7.8)
    parser.add_argument("--min-warm", type=float, default=0.5)
    parser.add_argument("--max-blue-warm-ratio", type=float, default=10.0)
    args = parser.parse_args()

    if not args.image.is_file():
        parser.error(f"image not found: {args.image}")

    current = metrics(args.image)
    failures: list[str] = []
    if not args.min_white <= current["white_pct"] <= args.max_white:
        failures.append(f"white_pct outside {args.min_white}-{args.max_white}")
    if current["blue_pct"] > args.max_blue:
        failures.append(f"blue_pct exceeds {args.max_blue}")
    if current["dark_blue_pct"] > args.max_dark_blue:
        failures.append(f"dark_blue_pct exceeds {args.max_dark_blue}")
    if current["warm_skin_orange_pct"] < args.min_warm:
        failures.append(f"warm_skin_orange_pct below {args.min_warm}")
    if current["blue_to_warm_ratio"] > args.max_blue_warm_ratio:
        failures.append(f"blue_to_warm_ratio exceeds {args.max_blue_warm_ratio}")

    result: dict[str, object] = {
        "ok": not failures,
        "image": str(args.image.resolve()),
        "metrics": current,
        "failures": failures,
    }
    if args.reference:
        if not args.reference.is_file():
            parser.error(f"reference not found: {args.reference}")
        ref = metrics(args.reference)
        result["reference"] = {"path": str(args.reference.resolve()), "metrics": ref}
        result["delta_vs_reference"] = {
            key: round(current[key] - ref[key], 2) for key in current
        }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if args.strict and failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
