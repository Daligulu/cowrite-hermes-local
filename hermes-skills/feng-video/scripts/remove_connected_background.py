#!/usr/bin/env python3
"""Remove only near-white background pixels connected to image borders.

This preserves enclosed white clothing such as Feng's hoodie, unlike global
white-to-alpha replacement.
"""
from __future__ import annotations
import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--min-channel", type=int, default=238)
    ap.add_argument("--max-chroma", type=int, default=12)
    args = ap.parse_args()

    if not args.input.exists():
        raise SystemExit(f"input not found: {args.input}")
    image = Image.open(args.input).convert("RGBA")
    array = np.array(image)
    rgb = array[:, :, :3]
    candidate = (rgb.min(axis=2) >= args.min_channel) & (
        (rgb.max(axis=2) - rgb.min(axis=2)) <= args.max_chroma
    )
    height, width = candidate.shape
    connected = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        for y in (0, height - 1):
            if candidate[y, x] and not connected[y, x]:
                connected[y, x] = True
                queue.append((y, x))
    for y in range(height):
        for x in (0, width - 1):
            if candidate[y, x] and not connected[y, x]:
                connected[y, x] = True
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if (
                0 <= yy < height
                and 0 <= xx < width
                and candidate[yy, xx]
                and not connected[yy, xx]
            ):
                connected[yy, xx] = True
                queue.append((yy, xx))

    array[connected, 3] = 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array, "RGBA").save(args.output)
    transparent_pct = float((array[:, :, 3] == 0).mean() * 100)
    print(
        {
            "output": str(args.output),
            "size": [width, height],
            "transparent_pct": round(transparent_pct, 2),
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
