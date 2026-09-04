#!/usr/bin/env python3
"""Unified image source wrapper for Cowrite illustration (illustrate/topic-create).

Primary source: ApiYi (Hermes native image_generate backend, profile default).
Fallback source: Agnes AI (free) — used when ApiYi fails (rate-limit, 451,
provider error) or when the caller explicitly requests `--source agnes`.

Usage:
  python3 generate_image.py --prompt "<prompt>" --out <path> [--source apiyi|agnes] [--aspect portrait|square|landscape]

Exit 0 on success (writes JSON to stdout), 2 on hard failure (both sources failed).
Never prints secrets.
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, time
from pathlib import Path

ENV_PATH = Path(os.getenv("HERMES_ENV_PATH", "/root/.hermes/.env"))
AGNES_SKILL_DIR = Path("/root/.hermes/skills/creative/agnes-ai-generation")
APIEYI_SKILL_DIR = Path("/root/.hermes/skills/creative/apiyi-image-generation")
AGNES_SCRIPT = AGNES_SKILL_DIR / "scripts" / "agnes_api.py"
APIEYI_SCRIPT = APIEYI_SKILL_DIR / "scripts" / "apiyi_image.py"


def load_dotenv(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def run_agnes(prompt: str, out: Path, aspect: str) -> str:
    """Generate with Agnes (free). Returns local path or raises."""
    size = {"square": "1024x1024", "portrait": "1080x1440", "landscape": "1344x768"}.get(aspect, "1024x1024")
    env = os.environ.copy()
    env.update({k: v for k, v in load_dotenv(ENV_PATH).items() if k not in env or not env[k]})
    if not any(env.get(k) for k in ("AGNES_API_KEY", "AGNES_API_TOKEN", "APIHUB_AGNES_API_KEY")):
        raise RuntimeError("Agnes 免费图源缺少凭据（AGNES_API_KEY 未设置）")
    if not AGNES_SCRIPT.exists():
        raise RuntimeError(f"Agnes helper not found: {AGNES_SCRIPT}")
    # 用 Agnes 生成，返回 URL 后下载到本地
    cmd = [sys.executable, str(AGNES_SCRIPT), "image", "--prompt", prompt, "--size", size, "--no-translate-prompt"]
    proc = subprocess.run(cmd, cwd=str(AGNES_SKILL_DIR), env=env, text=True, capture_output=True, timeout=300)
    if proc.returncode != 0:
        raise RuntimeError(f"Agnes 生成失败: {proc.stderr[:300]}")
    data = json.loads(proc.stdout)
    urls = []
    for item in data.get("urls", []) if isinstance(data, dict) else []:
        if item.startswith("http"):
            urls.append(item)
    if not urls:
        raise RuntimeError(f"Agnes 返回无图 URL: {proc.stdout[:300]}")
    # 下载
    import urllib.request
    out.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(urls[0], headers={"User-Agent": "hermes-image-wrapper/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        out.write_bytes(r.read())
    if out.stat().st_size < 5000:
        raise RuntimeError(f"Agnes 图片下载过小: {out.stat().st_size} bytes")
    return str(out)


def run_apiyi(prompt: str, out: Path, aspect: str) -> str:
    """Generate with ApiYi via native CLI. Returns local path or raises."""
    if not APIEYI_SCRIPT.exists():
        raise RuntimeError(f"ApiYi CLI not found: {APIEYI_SCRIPT}")
    cmd = [sys.executable, str(APIEYI_SCRIPT), "--prompt", prompt,
           "--aspect-ratio", aspect, "--output", str(out)]
    proc = subprocess.run(cmd, text=True, capture_output=True, timeout=300)
    if proc.returncode != 0 or not out.exists():
        raise RuntimeError(f"ApiYi 生成失败 (exit {proc.returncode}): {proc.stderr[:300]}")
    if out.stat().st_size < 5000:
        raise RuntimeError(f"ApiYi 图片过小: {out.stat().st_size} bytes")
    return str(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--source", choices=("auto", "apiyi", "agnes"), default="auto")
    parser.add_argument("--aspect", choices=("square", "portrait", "landscape"), default="landscape")
    args = parser.parse_args()

    if args.source == "apiyi":
        chain = ["apiyi"]
    elif args.source == "agnes":
        chain = ["agnes"]
    else:
        chain = ["apiyi", "agnes"]  # auto: ApiYi 优先，失败降级 Agnes

    errors = []
    for src in chain:
        try:
            path = run_apiyi(args.prompt, args.out, args.aspect) if src == "apiyi" else run_agnes(args.prompt, args.out, args.aspect)
            print(json.dumps({"ok": True, "source": src, "path": str(path), "used_fallback": args.source == "auto" and src == "agnes"}, ensure_ascii=False))
            return 0
        except Exception as e:
            errors.append(f"{src}: {e}")
        if args.source != "auto":
            break  # 显式指定时不降级，直接失败

    print(json.dumps({"ok": False, "errors": errors}, ensure_ascii=False, indent=2), file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
