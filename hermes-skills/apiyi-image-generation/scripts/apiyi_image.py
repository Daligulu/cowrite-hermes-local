#!/usr/bin/env python3
"""Explicit ApiYi image generator using the active Hermes provider plugin."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys

MODEL_CHOICES = ("nano-banana-2", "nano-banana-pro", "gpt-image-2-vip")
PLUGIN = Path.home() / ".hermes" / "plugins" / "image_gen" / "apiyi" / "__init__.py"


def load_provider():
    hermes_src = Path.home() / ".hermes" / "hermes-agent"
    if str(hermes_src) not in sys.path:
        sys.path.insert(0, str(hermes_src))
    spec = importlib.util.spec_from_file_location("hermes_apiyi_image_plugin", PLUGIN)
    if not spec or not spec.loader:
        raise RuntimeError(f"Could not load ApiYi plugin: {PLUGIN}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.ApiYiImageGenProvider()


def validate_mode(model: str, references: list[str]) -> None:
    """Keep an explicit validation hook; provider metadata enforces modalities."""
    return None


def materialize_output(source: Path, target: Path) -> Path:
    """Copy an image, converting when the requested extension differs."""
    source = source.expanduser().resolve()
    target = target.expanduser().resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    suffix = target.suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp"} and source.suffix.lower() != suffix:
        from PIL import Image
        with Image.open(source) as image:
            if suffix in {".jpg", ".jpeg"} and image.mode not in {"RGB", "L"}:
                image = image.convert("RGB")
            fmt = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP"}[suffix]
            image.save(target, format=fmt)
    else:
        shutil.copy2(source, target)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check plugin/config/key presence without a paid request")
    parser.add_argument("--model", choices=MODEL_CHOICES, default="nano-banana-2")
    parser.add_argument("--prompt")
    parser.add_argument("--prompt-file")
    parser.add_argument("--reference-image", action="append", default=[])
    parser.add_argument("--aspect-ratio", choices=("landscape", "square", "portrait"), default="landscape")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    provider = load_provider()
    if args.check:
        print(json.dumps({
            "ok": True,
            "provider": provider.name,
            "default_model": provider.default_model(),
            "approved_models": [item["id"] for item in provider.list_models()],
            "api_key_present": provider.is_available(),
            "modalities": provider.capabilities().get("modalities", []),
        }, ensure_ascii=False))
        return 0

    if bool(args.prompt) == bool(args.prompt_file):
        parser.error("provide exactly one of --prompt or --prompt-file")
    if not args.output:
        parser.error("--output is required for generation")
    validate_mode(args.model, args.reference_image)
    prompt = args.prompt or Path(args.prompt_file).read_text(encoding="utf-8")
    primary = args.reference_image[0] if args.reference_image else None
    extra = args.reference_image[1:] if len(args.reference_image) > 1 else None
    result = provider.generate(
        prompt,
        args.aspect_ratio,
        image_url=primary,
        reference_image_urls=extra,
        model=args.model,
    )
    if not result.get("success"):
        print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
        return 2
    source = str(result["image"])
    if source.startswith(("http://", "https://")):
        raise RuntimeError("Provider returned an uncached URL; use native image_generate or retry")
    final_output = materialize_output(Path(source), args.output)
    result["output"] = str(final_output)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
