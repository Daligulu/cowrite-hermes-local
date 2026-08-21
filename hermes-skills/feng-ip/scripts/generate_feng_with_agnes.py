#!/usr/bin/env python3
"""Generate a 峰峰 personal-IP workflow illustration through the Agnes helper.

This optional fallback preserves the merged Feng IP workflow features:
1. Generate the illustration with NO model-rendered text by default.
2. Optionally overlay exact Simplified Chinese labels locally with PIL.

feng-ip owns the prompting and character-consistency methodology;
agnes-ai-generation owns the provider API call.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_OUT_DIR = Path("/root/.hermes/workspace/generated/feng-ip")
AGNES_SKILL_DIR = Path(os.getenv("AGNES_SKILL_DIR", "/root/.hermes/skills/creative/agnes-ai-generation"))
AGNES_SCRIPT = AGNES_SKILL_DIR / "scripts" / "agnes_api.py"
ENV_PATH = Path(os.getenv("HERMES_ENV_PATH", "/root/.hermes/.env"))
FONT_CANDIDATES = [
    "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/google-noto-cjk/NotoSerifCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
]
COLOR_MAP = {
    "black": (0, 0, 0),
    "red": (190, 50, 50),
    "orange": (231, 112, 28),
    "blue": (30, 101, 171),
}


def load_dotenv(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            env[key] = value
    return env


def extract_urls(obj: Any) -> list[str]:
    urls: list[str] = []
    if isinstance(obj, dict):
        for key in ("url", "image_url"):
            value = obj.get(key)
            if isinstance(value, str) and value.startswith(("http://", "https://")):
                urls.append(value)
        for key in ("urls", "data", "images", "raw"):
            urls.extend(extract_urls(obj.get(key)))
    elif isinstance(obj, list):
        for item in obj:
            urls.extend(extract_urls(item))
    return list(dict.fromkeys(urls))


def download(url: str, path: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "hermes-feng-ip-skill/4.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def load_font(size: int):
    from PIL import ImageFont

    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def parse_labels(value: str | None) -> list[dict[str, Any]]:
    if not value:
        return []
    path = Path(value)
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        data = json.loads(value)
    if not isinstance(data, list):
        raise SystemExit("--labels-json must be a JSON list")
    labels: list[dict[str, Any]] = []
    for i, item in enumerate(data, 1):
        if not isinstance(item, dict):
            raise SystemExit(f"label #{i} must be an object")
        text = str(item.get("text", "")).strip()
        if not text:
            raise SystemExit(f"label #{i} missing text")
        if len(text) > 12:
            raise SystemExit(f"label #{i} too long ({len(text)} chars): {text!r}. Keep labels short for article illustrations.")
        labels.append(item | {"text": text})
    return labels


def overlay_labels(image_path: Path, labels: list[dict[str, Any]], output_path: Path | None = None) -> Path:
    """Overlay exact labels. Coordinates can be absolute pixels or 0..1 ratios."""
    if not labels:
        return image_path
    from PIL import Image, ImageDraw

    im = Image.open(image_path).convert("RGBA")
    draw = ImageDraw.Draw(im)
    w, h = im.size
    for item in labels:
        x = float(item.get("x", 0.05))
        y = float(item.get("y", 0.05))
        if 0 <= x <= 1:
            x *= w
        if 0 <= y <= 1:
            y *= h
        size = int(item.get("size", max(22, min(w, h) * 0.035)))
        color = item.get("color", "black")
        fill = COLOR_MAP.get(str(color), COLOR_MAP["black"])
        font = load_font(size)
        text = item["text"]
        # Optional white pad keeps deterministic local labels readable on generated line art.
        if item.get("pad", True):
            bbox = draw.textbbox((x, y), text, font=font)
            pad = int(size * 0.22)
            draw.rounded_rectangle(
                (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad),
                radius=max(4, pad),
                fill=(255, 255, 255, 232),
            )
        draw.text((x, y), text, fill=fill + (255,), font=font)
    final = output_path or image_path
    im.convert("RGB").save(final)
    return final


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a Feng personal-IP article illustration with Agnes.")
    parser.add_argument("--prompt", help="Full image prompt text. Use --prompt-file for long prompts.")
    parser.add_argument("--prompt-file", help="Read full image prompt from a UTF-8 text file.")
    parser.add_argument("--slug", default="demo", help="Output subdirectory slug under the generated workspace.")
    parser.add_argument("--name", default="01-feng-illustration", help="Output file basename without extension.")
    parser.add_argument("--size", default="1536x864", help="Agnes image size, e.g. 1536x864 or 1024x576.")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Base output directory.")
    parser.add_argument("--labels-json", help="JSON list or file path for exact local labels: [{text,x,y,color,size}]. Coordinates may be ratios.")
    parser.add_argument(
        "--reference-image",
        action="append",
        help="Local personal-IP reference image. Passed privately to Agnes as an in-memory image-to-image input; never publicly hosted. Repeat if needed.",
    )
    parser.add_argument("--no-download", action="store_true", help="Return provider URL only; do not download locally.")
    parser.add_argument("--translate-prompt", action="store_true", help="Allow Agnes helper to translate non-English prompts. Default preserves prompt text to protect Chinese label instructions.")
    parser.add_argument("--raw", action="store_true", help="Print raw Agnes helper JSON plus wrapper metadata.")
    args = parser.parse_args()

    if bool(args.prompt) == bool(args.prompt_file):
        parser.error("Provide exactly one of --prompt or --prompt-file")
    prompt = args.prompt if args.prompt else Path(args.prompt_file).read_text(encoding="utf-8")
    labels = parse_labels(args.labels_json)

    if not AGNES_SCRIPT.exists():
        raise SystemExit(f"Agnes helper not found: {AGNES_SCRIPT}")

    env = os.environ.copy()
    env.update({k: v for k, v in load_dotenv(ENV_PATH).items() if k not in env or not env[k]})
    if not any(env.get(k) for k in ("AGNES_API_KEY", "AGNES_API_TOKEN", "APIHUB_AGNES_API_KEY")):
        raise SystemExit("Missing Agnes credentials: set AGNES_API_KEY, AGNES_API_TOKEN, or APIHUB_AGNES_API_KEY in /root/.hermes/.env")

    reference_images = [Path(value).expanduser().resolve() for value in (args.reference_image or [])]
    for ref in reference_images:
        if not ref.is_file():
            parser.error(f"--reference-image not found: {ref}")

    cmd = [sys.executable, str(AGNES_SCRIPT), "image", "--prompt", prompt, "--size", args.size]
    for ref in reference_images:
        cmd.extend(["--image-file", str(ref)])
    if not args.translate_prompt:
        cmd.append("--no-translate-prompt")
    completed = subprocess.run(cmd, cwd=str(AGNES_SKILL_DIR), env=env, text=True, capture_output=True, timeout=300)
    if completed.returncode != 0:
        print(completed.stdout, end="")
        print(completed.stderr, end="", file=sys.stderr)
        return completed.returncode

    data = json.loads(completed.stdout)
    urls = extract_urls(data)
    if not urls:
        raise SystemExit(f"No image URL found in Agnes response: {completed.stdout[:1000]}")

    local_path = None
    exact_labels: list[str] = []
    if not args.no_download:
        local_path = Path(args.out_dir) / args.slug / f"{args.name}.png"
        download(urls[0], local_path)
        if labels:
            overlay_labels(local_path, labels)
            exact_labels = [str(item["text"]) for item in labels]

    result = {
        "ok": True,
        "type": "feng-ip-agnes-image",
        "url": urls[0],
        "local_path": str(local_path) if local_path else None,
        "size": args.size,
        "prompt_chars": len(prompt),
        "exact_local_labels": exact_labels,
        "reference_image_mode": bool(reference_images),
        "reference_image_count": len(reference_images),
        "model_path": {
            "hermes_image_generate": "ApiYi Nano Banana 2 by profile default; Nano Banana Pro and GPT Image 2 VIP are approved explicit choices",
            "fallback_used_by_this_script": "Agnes IMAGE_MODEL=agnes-image-2.1-flash",
        },
        "agnes": data if args.raw else {"type": data.get("type"), "translated_prompt": data.get("translated_prompt")},
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
