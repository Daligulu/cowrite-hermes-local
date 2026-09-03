#!/usr/bin/env python3
"""直接提交 gzh-design 渲染好的公众号 HTML 正文到微信草稿箱（article_type=news）。

用途：当文章已用 gzh-design 组件库排好版（含完整版式：水印编号/STEP卡/指令框/点评卡等），
直接用本脚本把这段 HTML 作为正文发到公众号草稿箱，**不再经 wewrite 重新渲染**（避免丢失组件版式）。

复用 wewrite_publish.py 的 token/封面上传/draft/add 逻辑，只替换 content 为 gzh 已排版 HTML。

用法：
  python3 publish_gzh_html.py --account default \
      --title '文章标题' --author '峰AI路' --digest '摘要' \
      /path/to/draft.html /path/to/cover.jpg

可选：
  --dry-run     只验证 token/账号/正文，不上传封面、不建草稿
  --source-url  设置原文链接

账号别名：dog=狗狗生活小百科，default=峰AI路（appid wx42b46ea46863a720）。
凭据从 /root/.hermes/.env 或环境读取（WECHAT_APP_ID_DEFAULT / WECHAT_APP_SECRET_DEFAULT 或
DOG_WECHAT_APPID / DOG_WECHAT_SECRET），不写入本文件。
"""
import json, sys, os, re, argparse
from pathlib import Path

sys.path.insert(0, "/root/.hermes/workspace/cowrite-hermes-local/hermes-skills/wewrite/scripts")
import wewrite_publish as wp


def derive_title(content_html: str, fallback: str = "微信公众号文章") -> str:
    m = re.search(r"<h1[^>]*>(.*?)</h1>|<h3[^>]*>(.*?)</h3>", content_html, re.S)
    if m:
        raw = (m.group(1) or m.group(2) or "")
        t = re.sub(r"<[^>]+>", "", raw).strip()
        if t:
            return t
    return fallback


def main() -> int:
    wp.load_default_env()
    ap = argparse.ArgumentParser(description="Publish a pre-rendered gzh-design HTML article to WeChat draft box")
    ap.add_argument("html", type=Path, help="Pre-rendered gzh-design clean HTML (section fragment)")
    ap.add_argument("cover", type=Path, help="Local cover image")
    ap.add_argument("--account", default="default", help="Account alias: dog or default")
    ap.add_argument("--author", default="峰AI路", help="Author name (max 8 chars)")
    ap.add_argument("--digest", default="", help="Article digest (max 120 chars)")
    ap.add_argument("--title", default="", help="Override title (default: derive from HTML h1/h3)")
    ap.add_argument("--source-url", default="")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.html.exists():
        wp.die(f"HTML not found: {args.html}")
    content_html = args.html.read_text(encoding="utf-8")

    title = args.title or derive_title(content_html)

    account_name, appid, secret = wp.resolve_account(args.account, None, None)
    if not appid:
        wp.die("Missing appid. Use --appid or env.")
    if not secret:
        wp.die("Missing secret. Use --secret or env.")

    token, token_meta = wp.get_access_token(appid, secret)

    result = {
        "ok": True,
        "renderer": "gzh-design(no-rerender)",
        "account": account_name,
        "appid": appid,
        "title": title,
        "html_bytes": len(content_html.encode("utf-8")),
        "token": token_meta,
    }

    if args.dry_run:
        result["dry_run"] = True
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if not args.cover.exists():
        wp.die(f"Cover not found: {args.cover}")
    thumb_media_id = wp.upload_thumb(token, args.cover)
    result["thumb_media_id"] = thumb_media_id

    draft_resp = wp.add_draft(
        token,
        title=title,
        author=args.author[:8],
        digest=args.digest[:120],
        content_html=content_html,
        thumb_media_id=thumb_media_id,
        source_url=args.source_url,
    )
    result["draft_media_id"] = draft_resp.get("media_id")
    result["draft_response"] = draft_resp
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
