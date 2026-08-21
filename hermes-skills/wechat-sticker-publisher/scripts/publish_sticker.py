#!/usr/bin/env python3
"""Publish a WeChat Official Account sticker / image-message draft.

Hermes local adaptation for the OpenClaw 04/06 sticker cron workflows.
Creates a draft only; it does not mass-send.
"""
from __future__ import annotations

import argparse
import html
import json
import mimetypes
import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import requests

HERMES_ENV = Path('/root/.hermes/.env')
DEFAULT_ACCOUNTS_FILE = Path('/root/.cowrite/wechat-accounts.json')
DEFAULT_OUTPUT_DIR = Path('/root/.hermes/workspace/workflows/stickers/outputs')
RECOMMENDED_NEWPIC_SIZE = (1080, 1440)  # 3:4, common WeChat picture-message/card practice.
MIN_NEWPIC_SIZE = (720, 960)  # Hard quality gate; official doc does not publish a pixel minimum.
TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token'
ADD_MATERIAL_URL = 'https://api.weixin.qq.com/cgi-bin/material/add_material'
UPLOADIMG_URL = 'https://api.weixin.qq.com/cgi-bin/media/uploadimg'
DRAFT_ADD_URL = 'https://api.weixin.qq.com/cgi-bin/draft/add'


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding='utf-8', errors='ignore').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, val = line.split('=', 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def _load_accounts_file(path: Path) -> Dict[str, Dict[str, str]]:
    """Load wechat accounts from Cowrite's JSON config (id → {label, appId, secret})."""
    try:
        raw = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}
    accounts = raw.get('accounts', []) if isinstance(raw, dict) else []
    result: Dict[str, Dict[str, str]] = {}
    for account in accounts:
        if not isinstance(account, dict):
            continue
        account_id = str(account.get('id', '')).strip().lower()
        if not account_id:
            continue
        result[account_id] = {
            'label': str(account.get('label', '') or ''),
            'appId': str(account.get('appId', '') or ''),
            'secret': str(account.get('secret', '') or ''),
        }
    return result


def account_credentials(alias: str, accounts_file: Path | None = None) -> Tuple[str, str, str]:
    alias = (alias or 'default').strip().lower()
    accounts = _load_accounts_file(accounts_file or DEFAULT_ACCOUNTS_FILE) if (accounts_file or DEFAULT_ACCOUNTS_FILE).exists() else {}
    if alias in accounts:
        entry = accounts[alias]
        appid = entry.get('appId')
        secret = entry.get('secret')
        label = entry.get('label') or alias
        if appid and secret:
            return appid, secret, label
        raise SystemExit(f'Missing credentials for account {alias} in accounts file. Required appId/secret are not configured.')
    if alias == 'dog':
        appid = os.getenv('DOG_WECHAT_APPID') or os.getenv('WECHAT_APP_ID_DOG')
        secret = os.getenv('DOG_WECHAT_SECRET') or os.getenv('WECHAT_APP_SECRET_DOG')
        label = '狗狗生活小百科'
    elif alias in {'default', 'feng', 'feng-ai', '峰ai路', '峰ai'}:
        appid = os.getenv('WECHAT_APP_ID_DEFAULT') or os.getenv('WECHAT_APP_ID') or os.getenv('FENGAI_WECHAT_APPID')
        secret = os.getenv('WECHAT_APP_SECRET_DEFAULT') or os.getenv('WECHAT_APP_SECRET') or os.getenv('FENGAI_WECHAT_SECRET')
        label = '峰AI路'
    else:
        raise SystemExit(f'Unknown account alias: {alias!r}. Use dog, default, or an account id in {DEFAULT_ACCOUNTS_FILE}.')
    if not appid or not secret:
        raise SystemExit(f'Missing credentials for account {alias}. Required env vars are not configured.')
    return appid, secret, label


def wx_get(url: str, params: Dict[str, str], timeout: int = 30) -> Dict:
    r = requests.get(url, params=params, timeout=timeout)
    try:
        data = r.json()
    except Exception:
        raise RuntimeError(f'Non-JSON response from {url}: HTTP {r.status_code} {r.text[:500]}')
    if data.get('errcode'):
        raise RuntimeError(f'WeChat API error from {url}: {data}')
    return data


def wx_post_json(url: str, params: Dict[str, str], payload: Dict, timeout: int = 60) -> Dict:
    # Do NOT use requests.post(json=payload) here: requests/json.dumps defaults
    # to ensure_ascii=True, and WeChat draft editor has been observed to show
    # literal \uXXXX sequences in title/content fields. Send real UTF-8 JSON.
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    r = requests.post(
        url,
        params=params,
        data=body,
        headers={'Content-Type': 'application/json; charset=utf-8'},
        timeout=timeout,
    )
    try:
        data = r.json()
    except Exception:
        raise RuntimeError(f'Non-JSON response from {url}: HTTP {r.status_code} {r.text[:500]}')
    if data.get('errcode'):
        raise RuntimeError(f'WeChat API error from {url}: {data}')
    return data


def get_access_token(appid: str, secret: str) -> str:
    data = wx_get(TOKEN_URL, {'grant_type': 'client_credential', 'appid': appid, 'secret': secret})
    token = data.get('access_token')
    if not token:
        raise RuntimeError(f'No access_token in response: {data}')
    return token


def _open_file_for_upload(path: Path):
    mime = mimetypes.guess_type(str(path))[0] or 'image/jpeg'
    return {'media': (path.name, path.open('rb'), mime)}


def upload_thumb(access_token: str, image: Path) -> str:
    with image.open('rb') as fh:
        files = {'media': (image.name, fh, mimetypes.guess_type(str(image))[0] or 'image/jpeg')}
        r = requests.post(ADD_MATERIAL_URL, params={'access_token': access_token, 'type': 'thumb'}, files=files, timeout=90)
    data = r.json()
    if data.get('errcode'):
        raise RuntimeError(f'add_material thumb failed: {data}')
    mid = data.get('media_id')
    if not mid:
        raise RuntimeError(f'No media_id from add_material thumb: {data}')
    return mid


def upload_permanent_image(access_token: str, image: Path) -> str:
    """Upload an image as permanent material for WeChat newspic drafts.

    WeChat's draft/add `article_type="newspic"` does not use article body
    `uploadimg` URLs or `thumb_media_id`. It requires `image_info.image_list`
    entries with `image_media_id`, obtained from permanent image material.
    """
    with image.open('rb') as fh:
        files = {'media': (image.name, fh, mimetypes.guess_type(str(image))[0] or 'image/jpeg')}
        r = requests.post(ADD_MATERIAL_URL, params={'access_token': access_token, 'type': 'image'}, files=files, timeout=90)
    data = r.json()
    if data.get('errcode'):
        raise RuntimeError(f'add_material image failed: {data}')
    mid = data.get('media_id')
    if not mid:
        raise RuntimeError(f'No media_id from add_material image: {data}')
    return mid


def upload_content_image(access_token: str, image: Path) -> str:
    # Official Account article body images should be uploaded through media/uploadimg.
    with image.open('rb') as fh:
        files = {'media': (image.name, fh, mimetypes.guess_type(str(image))[0] or 'image/jpeg')}
        r = requests.post(UPLOADIMG_URL, params={'access_token': access_token}, files=files, timeout=90)
    data = r.json()
    if data.get('errcode'):
        raise RuntimeError(f'uploadimg failed: {data}')
    url = data.get('url')
    if not url:
        raise RuntimeError(f'No url from uploadimg: {data}')
    return url


def build_content(text: str, image_urls: Iterable[str]) -> str:
    parts = []
    if text:
        for para in text.split('\n'):
            para = para.strip()
            if para:
                parts.append(f'<p>{html.escape(para)}</p>')
    for url in image_urls:
        parts.append(f'<p><img src="{html.escape(url)}" /></p>')
    return '\n'.join(parts) or '<p></p>'


def truncate_utf8(value: str, max_bytes: int) -> str:
    """Trim a string to a WeChat byte-oriented field limit without splitting UTF-8."""
    raw = (value or '').encode('utf-8')
    if len(raw) <= max_bytes:
        return value or ''
    return raw[:max_bytes].decode('utf-8', errors='ignore')


def truncate_chars(value: str, max_chars: int) -> str:
    value = value or ''
    return value if len(value) <= max_chars else value[:max_chars]


def normalize_newspic_text(text: str) -> str:
    """Normalize picture-message body copy for readable plain text in WeChat."""
    raw = (text or '').replace('\\n', '\n').replace('\r\n', '\n').replace('\r', '\n')
    raw = re.sub(r'<[^>]+>', '', raw)
    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in raw.split('\n')]
    compact: List[str] = []
    blank = False
    for line in lines:
        if not line:
            if compact and not blank:
                compact.append('')
            blank = True
            continue
        compact.append(line)
        blank = False
    content = '\n'.join(compact).strip()
    if content and '\n' not in content and len(content) > 90:
        sentences = re.split(r'(?<=[。！？!?])', content)
        paras: List[str] = []
        buf = ''
        for sentence in sentences:
            if not sentence:
                continue
            if len(buf) + len(sentence) > 65 and buf:
                paras.append(buf.strip())
                buf = sentence
            else:
                buf += sentence
        if buf.strip():
            paras.append(buf.strip())
        content = '\n\n'.join(paras)
    # WeChat official doc says newspic content is plain text and must be <=2KB.
    return truncate_utf8(content, 1900)


def image_dimensions(path: Path) -> Tuple[int, int]:
    try:
        from PIL import Image
    except Exception as exc:
        raise RuntimeError('Pillow is required to validate WeChat newspic image dimensions') from exc
    with Image.open(path) as im:
        return im.size


def validate_newspic_images(images: List[Path], strict: bool = True) -> Tuple[List[Dict], List[str]]:
    """Validate local images against WeChat picture-message requirements/practice."""
    if not images:
        raise RuntimeError('newspic draft requires at least one local image')
    if len(images) > 20:
        raise RuntimeError('newspic draft supports at most 20 images')
    infos: List[Dict] = []
    warnings: List[str] = []
    for path in images:
        w, h = image_dimensions(path)
        ratio = w / h if h else 0
        infos.append({'path': str(path), 'width': w, 'height': h, 'ratio': round(ratio, 4)})
        if strict and abs(ratio - 0.75) > 0.015:
            raise RuntimeError(f'newspic image must be 3:4 portrait ratio; got {w}x{h} ({ratio:.3f}) for {path}')
        if strict and (w < MIN_NEWPIC_SIZE[0] or h < MIN_NEWPIC_SIZE[1]):
            raise RuntimeError(f'newspic image too small for readable mobile card; got {w}x{h}, require at least {MIN_NEWPIC_SIZE[0]}x{MIN_NEWPIC_SIZE[1]} for {path}')
        if w != RECOMMENDED_NEWPIC_SIZE[0] or h != RECOMMENDED_NEWPIC_SIZE[1]:
            warnings.append(f'{path.name}: {w}x{h}; recommended {RECOMMENDED_NEWPIC_SIZE[0]}x{RECOMMENDED_NEWPIC_SIZE[1]} 3:4')
    return infos, warnings


def create_news_draft(access_token: str, title: str, author: str, digest: str, thumb_media_id: str, content: str) -> Dict:
    payload = {
        'articles': [{
            'article_type': 'news',
            'title': truncate_utf8(title, 64),
            'author': truncate_utf8(author, 8) if author else 'Hermes',
            'digest': truncate_utf8(digest, 120) if digest else '',
            'content': content,
            'thumb_media_id': thumb_media_id,
            'need_open_comment': 0,
            'only_fans_can_comment': 0,
        }]
    }
    return wx_post_json(DRAFT_ADD_URL, {'access_token': access_token}, payload, timeout=90)


def _crop_percent_for_ratio(width: int, height: int, ratio: float) -> Dict[str, str]:
    """Return centered crop percent coordinates matching a target width/height ratio."""
    if width <= 0 or height <= 0:
        return {'x1': '0', 'y1': '0', 'x2': '1', 'y2': '1'}
    src_ratio = width / height
    if src_ratio > ratio:
        crop_w = ratio * height
        x1 = (width - crop_w) / 2 / width
        x2 = 1 - x1
        y1, y2 = 0.0, 1.0
    else:
        crop_h = width / ratio
        y1 = (height - crop_h) / 2 / height
        y2 = 1 - y1
        x1, x2 = 0.0, 1.0
    return {
        'x1': f'{max(0.0, min(1.0, x1)):.6f}'.rstrip('0').rstrip('.') or '0',
        'y1': f'{max(0.0, min(1.0, y1)):.6f}'.rstrip('0').rstrip('.') or '0',
        'x2': f'{max(0.0, min(1.0, x2)):.6f}'.rstrip('0').rstrip('.') or '0',
        'y2': f'{max(0.0, min(1.0, y2)):.6f}'.rstrip('0').rstrip('.') or '0',
    }


def create_newspic_draft(access_token: str, title: str, content: str, image_media_ids: List[str], cover_size: Tuple[int, int] | None = None) -> Dict:
    """Create a WeChat picture-message/sticker draft (`article_type=newspic`).

    Official draft/add supports two structures: `news` for normal article
    drafts, and `newspic` for picture-message drafts. Sticker workflows must
    use `newspic`, otherwise the result appears in the normal article editor.
    """
    if not image_media_ids:
        raise RuntimeError('newspic draft requires at least one image_media_id')
    cover_w, cover_h = cover_size or (1, 1)
    square_crop = _crop_percent_for_ratio(cover_w, cover_h, 1.0)
    landscape_crop = _crop_percent_for_ratio(cover_w, cover_h, 16 / 9)
    wide_crop = _crop_percent_for_ratio(cover_w, cover_h, 2.35)
    payload = {
        'articles': [{
            'article_type': 'newspic',
            # Official doc: title <= 32 chars and no Unicode escape strings.
            'title': truncate_chars(title, 32),
            'content': normalize_newspic_text(content),
            'need_open_comment': 0,
            'only_fans_can_comment': 0,
            'image_info': {
                'image_list': [{'image_media_id': mid} for mid in image_media_ids]
            },
            'cover_info': {
                # Centered legal crops for the ratios used by WeChat backend.
                'crop_percent_list': [
                    {'ratio': '1_1', **square_crop},
                    {'ratio': '16_9', **landscape_crop},
                    {'ratio': '2.35_1', **wide_crop},
                ]
            },
        }]
    }
    return wx_post_json(DRAFT_ADD_URL, {'access_token': access_token}, payload, timeout=90)


def main() -> int:
    ap = argparse.ArgumentParser(description='Create a WeChat Official Account sticker/image draft')
    ap.add_argument('--account', default='default', help='Account id (alias): dog, default, or an id from --accounts-file')
    ap.add_argument('--accounts-file', default=str(DEFAULT_ACCOUNTS_FILE), help='JSON accounts file (Cowrite wechat-accounts.json)')
    ap.add_argument('--image', action='append', required=True, help='Local image path, repeatable')
    ap.add_argument('--title', required=True)
    ap.add_argument('--text', default='')
    ap.add_argument('--author', default='Hermes')
    ap.add_argument('--digest', default='')
    ap.add_argument('--source-url', default='')
    ap.add_argument('--mode', choices=['newspic', 'news'], default='newspic', help='Draft type. Sticker workflows must use newspic.')
    ap.add_argument('--skip-newspic-image-check', action='store_true', help='Disable 3:4/min-size validation for emergency/manual runs only.')
    ap.add_argument('--output-dir', default=str(DEFAULT_OUTPUT_DIR))
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    load_env_file(HERMES_ENV)

    images = [Path(p).expanduser().resolve() for p in args.image]
    missing = [str(p) for p in images if not p.exists()]
    if missing:
        raise SystemExit('Missing image file(s): ' + ', '.join(missing))

    appid, secret, label = account_credentials(args.account, Path(args.accounts_file))
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    result = {
        'ok': False,
        'dry_run': args.dry_run,
        'mode': args.mode,
        'account': args.account,
        'account_label': label,
        'appid': appid,
        'title': args.title,
        'images': [str(p) for p in images],
        'created_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
    }

    if args.mode == 'newspic':
        try:
            image_info, image_warnings = validate_newspic_images(images, strict=not args.skip_newspic_image_check)
            result['image_info'] = image_info
            if image_warnings:
                result['image_warnings'] = image_warnings
            result['formatted_text'] = normalize_newspic_text(args.text)
        except Exception as exc:
            result['error'] = str(exc)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 1

    if args.dry_run:
        result['ok'] = True
        result['message'] = 'dry-run validated credentials, draft mode, image dimensions, text formatting, and local image paths; no WeChat API call made'
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    try:
        token = get_access_token(appid, secret)
        if args.mode == 'newspic':
            image_media_ids = [upload_permanent_image(token, img) for img in images]
            cover_size = None
            try:
                from PIL import Image
                with Image.open(images[0]) as im:
                    cover_size = im.size
            except Exception:
                cover_size = None
            draft = create_newspic_draft(token, args.title, args.text, image_media_ids, cover_size=cover_size)
            result.update({
                'ok': True,
                'draft_type': 'newspic',
                'image_media_ids': image_media_ids,
                'draft_media_id': draft.get('media_id'),
                'draft_response': draft,
            })
        else:
            thumb_media_id = upload_thumb(token, images[0])
            urls = [upload_content_image(token, img) for img in images]
            content = build_content(args.text, urls)
            digest = args.digest or (args.text.strip().replace('\n', ' ')[:110] if args.text.strip() else args.title[:110])
            draft = create_news_draft(token, args.title, args.author, digest, thumb_media_id, content)
            result.update({
                'ok': True,
                'draft_type': 'news',
                'thumb_media_id': thumb_media_id,
                'content_image_urls_count': len(urls),
                'draft_media_id': draft.get('media_id'),
                'draft_response': draft,
            })
    except Exception as exc:
        result['error'] = str(exc)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1

    out_file = out_dir / f"sticker-publish-{time.strftime('%Y%m%d-%H%M%S')}.json"
    out_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    result['output_file'] = str(out_file)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
