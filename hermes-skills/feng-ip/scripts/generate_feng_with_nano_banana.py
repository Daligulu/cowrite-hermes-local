#!/usr/bin/env python3
"""Generate Nano Banana images through API易, with local Base64 reference images.

Does not print API keys or Base64 image payloads. Reference files stay local until
encoded into the HTTPS request body; no public URL is required.
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

API_BASE = "https://api.apiyi.com/v1beta/models"
MODELS = {
    "2": "gemini-3.1-flash-image-preview",
    "pro": "gemini-3-pro-image-preview",
}
MAX_REFERENCE_BYTES = 5 * 1024 * 1024


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def get_key() -> str:
    env = {**load_dotenv(Path("/root/.hermes/.env")), **os.environ}
    key = env.get("APIYI_API_KEY")
    if not key:
        raise SystemExit("Missing APIYI_API_KEY in /root/.hermes/.env or environment")
    return key


def encode_reference(value: str) -> dict[str, object]:
    path = Path(value).expanduser().resolve()
    if not path.is_file():
        raise SystemExit(f"Reference image not found: {path}")
    if path.stat().st_size > MAX_REFERENCE_BYTES:
        raise SystemExit(f"Reference image exceeds 5 MiB recommendation: {path.name}")
    mime, _ = mimetypes.guess_type(path.name)
    if mime not in {"image/png", "image/jpeg", "image/webp"}:
        raise SystemExit(f"Unsupported reference format: {path.name}; use PNG, JPEG, or WEBP")
    return {"inlineData": {"mimeType": mime, "data": base64.b64encode(path.read_bytes()).decode("ascii")}}


def response_image(response: dict[str, object]) -> tuple[str, bytes]:
    for candidate in response.get("candidates", []):
        content = candidate.get("content", {}) if isinstance(candidate, dict) else {}
        for part in content.get("parts", []) if isinstance(content, dict) else []:
            inline = part.get("inlineData") if isinstance(part, dict) else None
            if isinstance(inline, dict) and isinstance(inline.get("data"), str):
                return str(inline.get("mimeType") or "image/png"), base64.b64decode(inline["data"])
    raise SystemExit("No inlineData image found in API response")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt", help="Generation/edit instruction")
    parser.add_argument("--prompt-file", help="UTF-8 file containing generation/edit instruction")
    parser.add_argument("--reference-image", action="append", help="Local PNG/JPEG/WEBP identity or composition reference; repeatable")
    parser.add_argument("--model", choices=sorted(MODELS), default="2", help="2 for Nano Banana 2, pro for Nano Banana Pro")
    parser.add_argument("--aspect-ratio", default="16:9")
    parser.add_argument("--image-size", choices=["1K", "2K", "4K"], default="2K")
    parser.add_argument("--out", required=True, help="Output image path; extension is normalized to actual MIME type")
    args = parser.parse_args()

    if bool(args.prompt) == bool(args.prompt_file):
        parser.error("provide exactly one of --prompt or --prompt-file")
    prompt = args.prompt or Path(args.prompt_file).read_text(encoding="utf-8")
    refs = args.reference_image or []
    parts: list[dict[str, object]] = [{"text": prompt}]
    parts.extend(encode_reference(item) for item in refs)
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": args.aspect_ratio, "imageSize": args.image_size},
        },
    }
    model_id = MODELS[args.model]
    req = urllib.request.Request(
        f"{API_BASE}/{model_id}:generateContent",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {get_key()}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:1500]
        raise SystemExit(f"HTTP {exc.code} from Nano Banana: {detail}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Nano Banana request failed: {exc}") from exc

    mime, image = response_image(data)
    suffix = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}.get(mime, ".png")
    out = Path(args.out).expanduser().resolve()
    if out.suffix.lower() != suffix:
        out = out.with_suffix(suffix)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(image)
    print(json.dumps({
        "ok": True,
        "model": model_id,
        "mode": "image-to-image" if refs else "text-to-image",
        "reference_count": len(refs),
        "aspect_ratio": args.aspect_ratio,
        "image_size": args.image_size,
        "output": str(out),
        "bytes": out.stat().st_size,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
