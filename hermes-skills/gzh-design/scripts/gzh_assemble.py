#!/usr/bin/env python3
"""
gzh_assemble.py - gzh-design 主题装配脚本（简化版）
"""

import argparse
import re
import sys
from pathlib import Path
from typing import Optional, Dict, Any

THEMES = {
    "moyu-green": {"name": "摸鱼绿", "file": "references/theme-moyu-green.md", "primary": "#059669", "accent": "#10B981"},
    "red-white": {"name": "红白色系", "file": "references/theme-red-white.md", "primary": "#DC2626", "accent": "#FEE2E2"},
    "graphite-minimal": {"name": "石墨极简风", "file": "references/theme-graphite-minimal.md", "primary": "#52525B", "accent": "#E5E7EB"},
    "zen-whitespace": {"name": "留白禅意风", "file": "references/theme-zen-whitespace.md", "primary": "#4A5D52", "accent": "#B5C8BC"},
    "moyu-ticket": {"name": "摸鱼票据风", "file": "references/theme-moyu-ticket.md", "primary": "#059669", "accent": "#A7F3D0"},
    "olive-journal": {"name": "橄榄手记", "file": "references/theme-olive-journal.md", "primary": "#1e1f23", "accent": "#ed7b2f"},
    "serif-green": {"name": "衬线绿色方格纸", "file": "references/theme-serif-green.md", "primary": "#28a745", "accent": "#D1FAE5"},
    "serif-navy": {"name": "衬线深蓝方格纸", "file": "references/theme-serif-navy.md", "primary": "#1E5AA8", "accent": "#DBEAFE"},
}

DOG_ARTICLE_THEME_MAP = {
    "健康预警": "red-white",
    "行为解读": "moyu-green",
    "训练技巧": "moyu-green",
    "季节护理": "serif-navy",
    "营养饮食": "serif-navy",
    "医疗常识": "olive-journal",
    "老年犬照护": "olive-journal",
}

class GZHEditor:
    def __init__(self, gzh_root: Path):
        self.root = gzh_root
        self.theme_data = {}

    def load_theme(self, theme_id: str) -> bool:
        if theme_id not in THEMES:
            return False
        theme = THEMES[theme_id]
        theme_file = self.root / theme["file"]
        if not theme_file.exists():
            return False
        content = theme_file.read_text(encoding="utf-8")
        self.theme_data[theme_id] = {"config": theme, "components": self._parse_components(content)}
        return True

    def _parse_components(self, content: str) -> Dict[str, str]:
        components = {}
        lines = content.split('\n')
        current_component = None
        current_html = []
        in_html_block = False

        for line in lines:
            match = re.match(r'^## 组件\s+(\d+(?:[a-z])?)[^\n]*', line)
            if match:
                if current_component and current_html:
                    components[current_component] = '\n'.join(current_html).strip()
                current_component = match.group(1)
                current_html = []
                in_html_block = False
                continue
            if '```html' in line:
                in_html_block = True
                continue
            if '```' in line and in_html_block:
                if current_component:
                    components[current_component] = '\n'.join(current_html).strip()
                current_html = []
                in_html_block = False
                continue
            if in_html_block and current_component:
                current_html.append(line)

        if current_component and current_html:
            components[current_component] = '\n'.join(current_html).strip()
        return components

    def parse_markdown(self, md: str) -> Dict[str, Any]:
        lines = md.split("\n")
        structure = {"title": "", "chapters": [], "paragraphs": [], "images": [], "lists": [], "quotes": []}
        current_chapter = None
        current_sub = None

        for line in lines:
            if line.startswith("# ") and not structure["title"]:
                structure["title"] = line[2:].strip()
            elif line.startswith("## "):
                if current_sub and current_chapter:
                    current_chapter["sub_chapters"].append(current_sub)
                    current_sub = None
                current_chapter = {"title": line[3:].strip(), "content": [], "sub_chapters": []}
                structure["chapters"].append(current_chapter)
            elif line.startswith("### "):
                if current_chapter:
                    if current_sub:
                        current_chapter["sub_chapters"].append(current_sub)
                    current_sub = {"title": line[4:].strip(), "content": []}
            elif line.startswith("> "):
                structure["quotes"].append(line[2:])
            elif line.startswith("!["):
                match = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", line)
                if match:
                    structure["images"].append({"alt": match.group(1), "src": match.group(2)})
            elif line.startswith("- ") or re.match(r"^\d+\. ", line):
                structure["lists"].append(line)
            elif line.strip() and not line.startswith("|"):
                if current_sub:
                    current_sub["content"].append(line)
                elif current_chapter:
                    current_chapter["content"].append(line)
                else:
                    structure["paragraphs"].append(line)

        if current_sub and current_chapter:
            current_chapter["sub_chapters"].append(current_sub)
        return structure

    def assemble_html(self, md_content: str, theme_id: str, author: str = "峰AI路") -> str:
        if theme_id not in self.theme_data:
            self.load_theme(theme_id)
        if theme_id not in self.theme_data:
            raise ValueError(f"无法加载主题: {theme_id}")

        theme = self.theme_data[theme_id]
        config = theme["config"]
        components = theme["components"]
        structure = self.parse_markdown(md_content)

        primary = config["primary"]
        html_parts = []

        # 封面（组件2）
        if "2" in components:
            hero = components["2"]
            title = structure["title"][:30] if structure["title"] else "文章"
            hero = hero.replace("{{顶部标签}}", "狗狗生活小百科")
            hero = hero.replace("{{日期}}", "2026.09")
            hero = hero.replace("{{划线旧认知}}", "遛狗就是牵着走？")
            hero = hero.replace("{{主标题行1}}", title[:15])
            hero = hero.replace("{{绿色高亮词}}", title[15:] if len(title) > 15 else "指南")
            hero = hero.replace("{{主标题行2}}", "")
            hero = hero.replace("{{副标题关键词}}", "科学养犬 · 正向训练")
            hero = hero.replace("{{底部左侧文字}}", "狗狗生活小百科")
            hero = hero.replace("{{标签1}}", "训练")
            hero = hero.replace("{{标签2}}", "技巧")
            html_parts.append(hero)

        # 目录（组件3）
        if "3" in components and len(structure["chapters"]) >= 2:
            toc = components["3"]
            toc_cards = []
            for i, chapter in enumerate(structure["chapters"]):
                is_first = i == 0
                style = "background:linear-gradient(135deg,#059669,#10B981);border-radius:12px;padding:12px;margin-right:8px;" if is_first else "background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:12px;margin-right:8px;box-shadow:0 2px 6px rgba(0,0,0,0.04);"
                color = "#fff" if is_first else "#111827"
                sub_color = "rgba(255,255,255,0.7)" if is_first else "#9CA3AF"
                part_label = f"PART {i+1:02d}" if i < len(structure["chapters"])-1 else "PART ///"
                chapter_short = chapter["title"][:10] + ("..." if len(chapter["title"]) > 10 else "")
                card = f'<section style="display:inline-block;white-space:normal;vertical-align:top;width:110px;{style}"><p style="font-size:9px;font-weight:700;color:{sub_color};letter-spacing:1px;margin:0 0 5px;"><span leaf="">{part_label}</span></p><p style="font-size:13px;font-weight:800;color:{color};margin:0 0 3px;"><span leaf="">{chapter_short}</span></p><p style="font-size:10px;color:{sub_color};margin:0;"><span leaf="">{chapter["title"][10:] if len(chapter["title"]) > 10 else ""}</span></p></section>'
                toc_cards.append(card)
            toc_cards.append(f'<section style="display:inline-block;white-space:normal;vertical-align:top;width:110px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:12px;box-shadow:0 2px 6px rgba(0,0,0,0.04);"><p style="font-size:9px;font-weight:700;color:#9CA3AF;letter-spacing:1px;margin:0 0 5px;"><span leaf="">PART ///</span></p><p style="font-size:13px;font-weight:800;color:#111827;margin:0 0 3px;"><span leaf="">写在最后</span></p><p style="font-size:10px;color:#9CA3AF;margin:0;"><span leaf="">总结</span></p></section>')
            toc_html = toc.replace("{{N}}", str(len(structure["chapters"])))
            for i, card in enumerate(toc_cards):
                if i < len(structure["chapters"]):
                    toc_html = toc_html.replace("{{章节名}}", structure["chapters"][i]["title"], 1)
                    title = structure["chapters"][i]["title"]
                    sub_title = title[len(title)//2:] if len(title) > 5 else ""
                    toc_html = toc_html.replace("{{副标题}}", sub_title, 1)
            html_parts.append(toc_html)

        # 章节内容
        for i, chapter in enumerate(structure["chapters"]):
            # 章节标题（组件4）
            if "4" in components:
                ct = components["4"]
                is_first = i == 0
                is_last = i == len(structure["chapters"]) - 1
                num = f"{i+1:02d}" if not is_last else "///"
                part_label = "PART" if not is_last else "LAST"
                ct = ct.replace("{{编号}}", num).replace("{{中文标题}}", chapter["title"]).replace("{{PART}}", part_label).replace("{{ENGLISH · 英文副标题}}", "")
                if is_first:
                    ct = ct.replace("margin-top:48px", "margin-top:16px")
                html_parts.append(ct)

            # 子章节和正文
            for sub in chapter.get("sub_chapters", []):
                if "9c" in components:
                    html_parts.append(components["9c"].replace("{{小节标题}}", sub["title"]))
                for para in sub["content"]:
                    html_parts.append(self._format_paragraph(para))
            for para in chapter["content"]:
                html_parts.append(self._format_paragraph(para))

        # 引言段落
        for para in structure["paragraphs"]:
            html_parts.append(self._format_paragraph(para))

        # 引用
        for quote in structure["quotes"]:
            html_parts.append(f'<p style="font-size:16px;line-height:1.75;margin-bottom:24px;color:#374151;padding:12px 16px;background:#f8f9fa;border-left:4px solid {primary};"><span leaf="">{quote}</span></p>')

        # 图片
        for img in structure["images"]:
            html_parts.append(f'<figure style="margin:24px 0;"><img src="{img["src"]}" alt="{img["alt"]}" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:8px;"><figcaption style="text-align:center;font-size:12px;color:#9CA3AF;margin-top:8px;"><span leaf="">{img["alt"]}</span></figcaption></figure>')

        # 列表
        for item in structure["lists"]:
            text = re.sub(r"^[-*]\s+", "", item)
            text = re.sub(r"^\d+\.\s+", "", text)
            html_parts.append(f'<p style="font-size:16px;line-height:1.75;margin-bottom:12px;padding-left:16px;color:#374151;"><span leaf="">{text}</span></p>')

        # 结尾
        if "13" in components:
            ending = components["13"]
            # 替换CSS变量占位符（所有变体）
            ending = ending.replace("{卡片底}", "#FFFFFF")
            ending = ending.replace("{卡片描边}", "#E5E7EB")
            ending = ending.replace("{主色}", primary)
            ending = ending.replace("{标题色}", "#111827")
            ending = ending.replace("{正文色}", "#374151")
            ending = ending.replace("{次要文字}", "#4B5563")
            ending = ending.replace("{辅助英文}", "#9CA3AF")
            ending = ending.replace("{常规图标描边}", "#E5E7EB")
            ending = ending.replace("{常规图标色}", "#6B7280")
            ending = ending.replace("{{作者名}}", author)
            ending = ending.replace("{{一句话简介}}", "一个专注狗狗养护的公众号")
            html_parts.append(ending)

        # 感谢卡（使用组件13的footer-cta）
        if "13" in components:
            thanks_card = components["13"]
            # 清理占位符
            thanks_card = thanks_card.replace("{主色}", primary)
            thanks_card = thanks_card.replace("{{作者名}}", author)
            html_parts.append(thanks_card)

        html_parts.append("</section>")
        html_parts.append('<p style="display:none;"><mp-style-type data-value="3"></mp-style-type></p>')
        return "\n".join(html_parts)

    def _format_paragraph(self, text: str) -> str:
        text = text.replace("**", "").replace("__", "")
        paragraphs = []
        while len(text) > 150:
            split_pos = text.rfind("。", 0, 150)
            if split_pos == -1:
                split_pos = text.rfind("；", 0, 150)
            if split_pos == -1:
                split_pos = 150
            paragraphs.append(text[:split_pos+1])
            text = text[split_pos+1:]
        if text.strip():
            paragraphs.append(text)
        return "\n".join([f'<p style="margin-bottom:24px;font-size:16px;line-height:1.75;text-align:justify;"><span leaf="">{p}</span></p>' for p in paragraphs])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("--theme", "-t", choices=list(THEMES.keys()))
    parser.add_argument("--auto", "-a", action="store_true")
    parser.add_argument("--category", "-c")
    parser.add_argument("--output", "-o", required=True)
    parser.add_argument("--author", default="峰AI路")
    parser.add_argument("--gzh-root", default="/root/.hermes/skills/creative/gzh-design")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"❌ 输入文件不存在: {input_path}", file=sys.stderr)
        sys.exit(1)

    md_content = input_path.read_text(encoding="utf-8")
    theme_id = args.category and DOG_ARTICLE_THEME_MAP.get(args.category) or args.theme or "moyu-green"
    print(f"📝 使用主题: {THEMES[theme_id]['name']}")

    editor = GZHEditor(Path(args.gzh_root))
    html = editor.assemble_html(md_content, theme_id, args.author)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")
    print(f"✅ 已生成: {output_path} ({len(html)} 字符)")

if __name__ == "__main__":
    main()
