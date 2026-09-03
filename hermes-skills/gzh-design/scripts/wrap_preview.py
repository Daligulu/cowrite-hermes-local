#!/usr/bin/env python3
"""把已校验的公众号正文片段（纯 <section>）包成带「复制」按钮的浏览器预览页。

用户打开预览页 → 点右上角「复制到公众号」→ 按钮把渲染后的富文本**物化成内联样式**
写入剪贴板（text/html + text/plain 双格式）→ 到公众号编辑器 Ctrl+V 粘贴即可。

本预览页的「复制」经过粘贴加固（见 assets/preview-template.html）：
- 仅物化 safeProps 白名单属性，不把固定宽高/绝对定位/float 写进正文
- 物化 ::before/::after/::marker 伪元素为真实 <span>
- ol/ul/li 展平为 section+p 行，避免公号重写语义列表致符号错行
- 图片 max-width:100%/height:auto、表格 width:100%/table-layout:fixed
- 移除 id/class/data-*/contenteditable；aria-hidden 装饰在纯文本里剔除

按钮和 JS 只存在于预览外壳里，**不在被复制的 section 内**，粘进公众号的仍是
干净合规正文。校验请对原始 section 文件跑 validate_gzh_html.py（本预览页含 script/style，不参与校验）。

用法:
    wrap_preview.py <section.html> [output.html] [--title "标题"] [--readonly]
    默认输出 <section去扩展名>_预览.html；标题缺省取文件名或正文首个大字号段落
    --readonly 生成「只读 + 复制」预览（隐藏微调面板/我的排版，仅保留复制按钮）
"""

import os
import sys
import re
import argparse


def guess_title(content):
    """从正文第一个像标题的段落提取标题，避免落到 messy 文件名。"""
    # 找第一个 font-size 较大（>19px）且较短的 p/h 或 <strong> 文本
    for m in re.finditer(r"<p[^>]*font-size\s*:\s*(\d+)px[^>]*>(.*?)</p>", content, re.S):
        size = int(m.group(1))
        text = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        if size >= 19 and text and len(text) <= 60:
            return text
    # 退化：第一个纯文本 <p>
    for m in re.finditer(r"<p[^>]*>(.*?)</p>", content, re.S):
        text = re.sub(r"<[^>]+>", "", m.group(1)).strip()
        if text and len(text) <= 60:
            return text
    return "公众号文章"


def main():
    ap = argparse.ArgumentParser(description="生成公众号排版预览页")
    ap.add_argument("src")
    ap.add_argument("output", nargs="?")
    ap.add_argument("--title", default=None)
    ap.add_argument("--readonly", action="store_true", help="只读+复制预览（隐藏微调面板/我的排版）")
    args = ap.parse_args()

    if not os.path.isfile(args.src):
        print(f"✗ 找不到文件: {args.src}")
        sys.exit(1)

    content = open(args.src, encoding="utf-8").read().strip()

    # 防御性检查：正文里不应出现 script/style（gzh 红线已禁），若仍出现则警告
    if re.search(r"<\s*(script|style)\b", content, flags=re.I):
        print("⚠  检测到正文含 <script>/<style>，将被原样保留；若来自未校验产物请先跑 validate_gzh_html.py")
    if re.search(r"\b(class|id)\s*=", content):
        print("⚠  检测到正文含 class= 或 id= 属性（gzh 红线已禁），粘贴后可能样式丢失，请先校验")

    tpl_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "assets", "preview-template.html")
    tpl = open(tpl_path, encoding="utf-8").read()

    title = args.title or os.path.splitext(os.path.basename(args.src))[0]
    if not args.title:
        guessed = guess_title(content)
        if guessed:
            title = guessed
    title = title.replace("{{", "").replace("}}", "").strip()[:80]

    readonly_flag = "1" if args.readonly else "0"
    out_html = tpl.replace("{{TITLE}}", title).replace("{{READONLY}}", readonly_flag).replace("<!--GZH_CONTENT-->", content)
    out = args.output or os.path.splitext(args.src)[0] + "_预览.html"
    open(out, "w", encoding="utf-8").write(out_html)
    if args.readonly:
        print(f"✓ 已生成「只读 + 复制」预览页: {out}")
        print(f"  标题: {title}")
        print("  打开后可点右上角「复制到公众号」，不含微调面板。")
    else:
        print(f"✓ 已生成带「复制 + 微调」按钮的预览页: {out}")
        print(f"  标题: {title}")
        print("  用浏览器打开它，可点右上角「复制到公众号」或左侧「微调」实时调参。")


if __name__ == "__main__":
    main()
