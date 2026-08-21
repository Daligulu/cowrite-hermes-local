#!/usr/bin/env python3
"""WeWrite image generation with ApiYi gpt-image-2-vip by default.

Implements the Obsidian/OpenClaw WeWrite design locally:
- Read provider config from /root/.hermes/workspace/wewrite/config.yaml
- Load secrets from /root/.hermes/.env
- Launch enabled providers concurrently (normal config enables only ApiYi)
- First successful image wins if multiple providers are manually enabled
- Supports dry-run and optional deterministic local fallback for continuity
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures as futures
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_CONFIG = Path('/root/.hermes/workspace/wewrite/config.yaml')
DEFAULT_ENV = Path('/root/.hermes/.env')
DEFAULT_OUTPUT_DIR = Path('/root/.hermes/workspace/wewrite/output')


def load_env(path: Path = DEFAULT_ENV) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding='utf-8', errors='ignore').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        import yaml  # type: ignore
        data = yaml.safe_load(path.read_text(encoding='utf-8')) or {}
    except Exception as e:
        raise SystemExit(f'Failed to load config {path}: {e}')
    if not isinstance(data, dict):
        raise SystemExit(f'Config {path} must be a mapping')
    return data


def slugify(text: str, max_len: int = 60) -> str:
    s = re.sub(r'[^A-Za-z0-9\u4e00-\u9fff]+', '-', text).strip('-')
    return (s[:max_len] or 'cover').strip('-')


def normalize_url(base: str, endpoint: str) -> str:
    return base.rstrip('/') + '/' + endpoint.lstrip('/')


def request_json(url: str, payload: dict[str, Any], api_key: str, timeout: int) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=body,
        method='POST',
        headers={
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': f'Bearer {api_key}',
            'User-Agent': 'Hermes-WeWrite/1.0',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='replace')[:1000]
        raise RuntimeError(f'HTTP {e.code}: {detail}')
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError(f'Non-JSON response: {raw[:500]}')


def decode_image_response(obj: dict[str, Any]) -> tuple[bytes | None, str | None, str]:
    """Return (image_bytes, image_url, response_kind)."""
    data = obj.get('data')
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            b64 = first.get('b64_json') or first.get('b64') or first.get('image')
            if isinstance(b64, str) and len(b64) > 100:
                if b64.startswith('data:image'):
                    b64 = b64.split(',', 1)[-1]
                try:
                    return base64.b64decode(b64), None, 'b64_json'
                except Exception:
                    pass
            url = first.get('url') or first.get('image_url')
            if isinstance(url, str) and url.startswith(('http://', 'https://')):
                return None, url, 'url'
    # Some providers return top-level URL/b64.
    for key in ('url', 'image_url'):
        url = obj.get(key)
        if isinstance(url, str) and url.startswith(('http://', 'https://')):
            return None, url, key
    for key in ('b64_json', 'image'):
        b64 = obj.get(key)
        if isinstance(b64, str) and len(b64) > 100:
            if b64.startswith('data:image'):
                b64 = b64.split(',', 1)[-1]
            return base64.b64decode(b64), None, key
    return None, None, 'unknown'


def download(url: str, timeout: int) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'Hermes-WeWrite/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def provider_call(provider: dict[str, Any], prompt: str, output_dir: Path, stem: str, timeout: int) -> dict[str, Any]:
    name = str(provider.get('provider', 'unknown'))
    api_key_env = str(provider.get('api_key_env') or '')
    api_key = os.environ.get(api_key_env, '') if api_key_env else str(provider.get('api_key') or '')
    if not api_key:
        raise RuntimeError(f'missing API key env {api_key_env}')
    base_url = str(provider.get('base_url') or '')
    endpoint = str(provider.get('endpoint') or '/images/generations')
    model = str(provider.get('model') or '')
    if not base_url or not model:
        raise RuntimeError('base_url/model missing')
    payload: dict[str, Any] = {
        'model': model,
        'prompt': prompt,
    }
    # Do not send `n`: gpt-image-2-vip only returns one image and API易 docs
    # warn that n can cause extra billing without extra outputs.
    size = provider.get('size')
    if size:
        payload['size'] = size
    response_format = provider.get('response_format')
    if response_format and response_format != 'auto':
        payload['response_format'] = response_format
    started = time.time()
    obj = request_json(normalize_url(base_url, endpoint), payload, api_key, timeout)
    img_bytes, img_url, kind = decode_image_response(obj)
    if img_url and img_bytes is None:
        img_bytes = download(img_url, timeout)
    if not img_bytes:
        raise RuntimeError(f'no image in response kind={kind}; keys={list(obj.keys())}')
    output_dir.mkdir(parents=True, exist_ok=True)
    # WeChat thumb accepts jpg/png; keep extension by response kind mostly jpg.
    out = output_dir / f'{stem}-{name}.png'
    out.write_bytes(img_bytes)
    return {
        'ok': True,
        'provider': name,
        'model': model,
        'response_kind': kind,
        'path': str(out),
        'bytes': out.stat().st_size,
        'elapsed_sec': round(time.time() - started, 2),
    }


def local_fallback(prompt: str, output_dir: Path, stem: str) -> dict[str, Any]:
    from PIL import Image, ImageDraw, ImageFilter
    W, H = 900, 383
    img = Image.new('RGB', (W, H), (255, 244, 226))
    d = ImageDraw.Draw(img)
    for i in range(0, W, 18):
        color = (255, 244 - int(i / W * 16), 222 - int(i / W * 18))
        d.rectangle([i, 0, i + 18, H], fill=color)
    for xy, fill in [((-120, -90, 250, 260), (255, 230, 185)), ((650, -80, 1020, 230), (255, 225, 190)), ((530, 210, 960, 520), (255, 238, 205))]:
        d.ellipse(xy, fill=fill)
    d.rounded_rectangle([0, 270, W, 383], radius=0, fill=(242, 221, 190))
    d.rounded_rectangle([510, 282, 790, 340], radius=28, fill=(211, 166, 116))
    d.ellipse([270, 155, 590, 315], fill=(202, 143, 86), outline=(145, 92, 54), width=4)
    d.ellipse([455, 90, 660, 260], fill=(211, 154, 94), outline=(145, 92, 54), width=4)
    d.ellipse([420, 105, 505, 235], fill=(131, 82, 52))
    d.ellipse([600, 105, 685, 235], fill=(131, 82, 52))
    d.ellipse([510, 165, 620, 235], fill=(255, 238, 214))
    d.ellipse([555, 188, 585, 214], fill=(69, 50, 43))
    d.ellipse([505, 145, 525, 165], fill=(55, 45, 38))
    d.ellipse([595, 145, 615, 165], fill=(55, 45, 38))
    for x in [330, 420, 520]:
        d.rounded_rectangle([x, 285, x + 38, 350], radius=17, fill=(187, 125, 75), outline=(145, 92, 54), width=3)
        d.ellipse([x - 2, 335, x + 48, 363], fill=(255, 238, 214), outline=(145, 92, 54), width=2)
    img = img.filter(ImageFilter.SMOOTH_MORE)
    output_dir.mkdir(parents=True, exist_ok=True)
    out = output_dir / f'{stem}-local-fallback.jpg'
    img.save(out, format='JPEG', quality=78, optimize=True, progressive=True)
    return {'ok': True, 'provider': 'local-fallback', 'model': 'PIL', 'path': str(out), 'bytes': out.stat().st_size, 'elapsed_sec': 0}


def main() -> int:
    ap = argparse.ArgumentParser(description='WeWrite ApiYi gpt-image-2-vip image generator')
    ap.add_argument('--prompt', required=False, help='Full image prompt')
    ap.add_argument('--topic', default='', help='Topic to fill config cover.default_prompt_template')
    ap.add_argument('--output', type=Path, default=None, help='Final output path; winner is copied here')
    ap.add_argument('--output-dir', type=Path, default=None)
    ap.add_argument('--config', type=Path, default=DEFAULT_CONFIG)
    ap.add_argument('--timeout', type=int, default=None)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--allow-local-fallback', action='store_true')
    args = ap.parse_args()

    load_env()
    cfg = load_config(args.config)
    image_cfg = cfg.get('image') or {}
    cover_cfg = cfg.get('cover') or {}
    prompt = args.prompt
    if not prompt:
        tmpl = cover_cfg.get('default_prompt_template') or '暖色调治愈系公众号封面插画，主题是「{topic}」，不要文字，不要水印，高清插画'
        prompt = str(tmpl).format(topic=args.topic or '狗狗生活小百科')
    timeout = args.timeout or int(image_cfg.get('timeout') or 300)
    output_dir = args.output_dir or Path(image_cfg.get('output_dir') or DEFAULT_OUTPUT_DIR)
    providers = [p for p in (image_cfg.get('providers') or []) if p.get('enabled', True)]
    stem = slugify(args.topic or prompt[:30])
    statuses = []
    for p in providers:
        key_env = str(p.get('api_key_env') or '')
        statuses.append({
            'provider': p.get('provider'),
            'model': p.get('model'),
            'base_url': p.get('base_url'),
            'api_key_env': key_env,
            'api_key_present': bool(os.environ.get(key_env, '')) if key_env else bool(p.get('api_key')),
        })
    if args.dry_run:
        print(json.dumps({'ok': True, 'dry_run': True, 'config': str(args.config), 'timeout': timeout, 'prompt': prompt, 'providers': statuses}, ensure_ascii=False, indent=2))
        return 0
    if not providers:
        raise SystemExit(json.dumps({'ok': False, 'error': 'no enabled image providers'}, ensure_ascii=False))

    failures = []
    winner = None
    with futures.ThreadPoolExecutor(max_workers=len(providers)) as ex:
        fut_map = {ex.submit(provider_call, p, prompt, output_dir, stem, timeout): p for p in providers}
        try:
            for fut in futures.as_completed(fut_map, timeout=timeout):
                p = fut_map[fut]
                try:
                    result = fut.result()
                    winner = result
                    break
                except Exception as e:
                    failures.append({'provider': p.get('provider'), 'error': str(e)})
        except futures.TimeoutError:
            failures.append({'provider': 'race', 'error': f'timeout after {timeout}s'})
    if winner is None and (args.allow_local_fallback or bool(cover_cfg.get('fallback_local'))):
        try:
            winner = local_fallback(prompt, output_dir, stem)
        except Exception as e:
            failures.append({'provider': 'local-fallback', 'error': str(e)})
    if winner is None:
        print(json.dumps({'ok': False, 'prompt': prompt, 'failures': failures, 'providers': statuses}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2
    final_path = Path(winner['path'])
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(final_path.read_bytes())
        final_path = args.output
    print(json.dumps({'ok': True, 'prompt': prompt, 'winner': winner, 'output': str(final_path), 'failures': failures}, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
