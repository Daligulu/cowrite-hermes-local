---
name: wechat-article-publishing
description: 公众号 HTML 排版发布工程知识。公众号排版/微信排版/主题库融合/gzh-design 时使用。
triggers:
  - 公众号排版
  - 公众号 HTML
  - 微信排版
  - theme fusion
  - 主题库融合
  - 公众号平台兼容
  - gzh-design
---

# WeChat Article Publishing Engineering

公众号文章 HTML 排版与发布的工程知识库。本 skill 承载跨工具复用的平台约束与
工作流模式；具体账号（狗狗生活小百科 / 峰AI路）的发布脚本走 `wewrite` 或
`wechat-sticker-publisher`，本 skill 不替代它们，只提供它们共用的规则与验收方法。

## When to Use

- 用户要把 Markdown 排成公众号可粘贴 HTML（任何工具链）
- 用户要新增/切换公众号排版主题，或把外部 skill 的主题库融合进本地渲染器
- 需要验证生成的公众号 HTML 是否符合平台规则（不依赖视觉模型）
- 评估是否要升级某个公众号排版工具（Obsidian 插件 vs Python CLI 形态判断）

## WeChat Platform Constraints（公众号平台铁律）

Verified against gzh-design component libraries + local wewrite publishing. Hard rules:

- ❌ `<style>` / `<script>` / CSS class / id selectors are stripped.
- ❌ External fonts, `position:fixed/absolute`, `float`, `@media`, `@keyframes`, `display:grid` are unsafe.
- ❌ `white-space:pre` on code blocks causes a giant blank area in the WeChat editor.
- ✅ Inline `style`, `display:flex` (limited), `linear-gradient`, `border-radius`, `box-shadow`, basic `<section>/<p>/<span>/<strong>/<img>` tags survive.
- Decorative empty elements (dots, gradient dividers, timeline bars) MUST contain a `<span leaf=""><br></span>` placeholder or WeChat strips their styling.
- Do NOT put `font-size`/`border-bottom` on `<strong>`; do NOT mix multiple font sizes in one `<p>` — the editor "auto-corrects" and rewrites styles. Split into multiple `<p>`, one font size each; put highlights on an outer `<span>`.
- Body images need WeChat-hosted URLs (`media/uploadimg`); a publisher must upload local images and rewrite `src` before draft creation.
- Cover → permanent thumb material (`material/add_material` type=thumb); draft → `cgi-bin/draft/add` with `thumb_media_id` + inline-styled `content`.

## Theme Library Fusion（外部主题库反哺本地渲染器）

When a local renderer/publisher exists (e.g. `wewrite_publish.py`) and the user wants
themes from an external design skill WITHOUT rewriting the pipeline, fuse the external
theme VARIABLES into the local renderer instead of adopting the external skill
end-to-end. Proven with gzh-design → wewrite (2026-08):

1. Extract each external theme's 设计变量速查表 (accent, bg, title/body colors, borders,
   font sizes, line heights).
2. Map onto the local renderer's component set (container / title card / h2 / h3 /
   paragraph / list card / blockquote / inline code / figure shadow). Keep keys
   consistent across themes — a new theme is just another dict entry.
3. Add a `THEMES` dict + `--theme <name>` CLI arg + `--list-themes` listing command.
4. **Keep the legacy default theme byte-identical** so existing workflows are
   unaffected without --theme.
5. Update the host skill's SKILL.md with a theme table (arg → label → best for).
6. Verify EVERY theme renders (section below) AND diff the default theme's HTML bytes
   vs pre-fusion output to prove backward compatibility.

Why fusion beats wholesale adoption: external skill lacks local publishing (cover
upload, article image upload, draft API); local renderer lacks theme variety. Take
only the design variables — the reusable part.

### When NOT to fuse — install the external skill separately

Fusing design VARIABLES preserves only the *look* (colors/fonts/line-heights). It
cannot reproduce component-level *layout effects* — cover cards, numbered sections,
per-paragraph keyword underlines, callout/timeline/flow-card blocks — because those
come from a thick component library + an LLM assembly workflow, not from variables.

Decision rule (verified 2026-08-10 with gzh-design → local wewrite):
- User only wants the same color scheme → keep the fused THEMES dict (already done).
- User wants the upstream's full layout effects → install the external skill itself
  under `~/.hermes/skills/<category>/<name>/` (full upstream tree, keep LICENSE) and
  compose: external skill produces the layout HTML → local wewrite continues to own
  cover upload / body-image upload / draft-box API. Do NOT try to merge a 4000+-line
  component library into the deterministic renderer.
- ALWAYS verify the license from the actual repo `LICENSE` file, not from earlier
  notes: gzh-design was once recorded as MIT but upstream is AGPL-3.0 (local use OK;
  adapted re-distribution must preserve AGPL copyright notice).

## Deterministic Render Verification Without a Vision Model

When `vision_analyze`/browser vision backends are unavailable (HTTP 400), verify HTML
render output deterministically:

```bash
google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=480,1600 --screenshot=/tmp/out/<theme>.png "file:///tmp/out/<theme>.html"
```

```python
from PIL import Image
from collections import Counter
im = Image.open("shot.png").convert("RGB")
cnt = Counter(im.getdata())
print([f"#{r:02X}{g:02X}{b:02X}" for (r, g, b), _ in cnt.most_common(3)])
```

Expected per theme: `#FFFFFF` + the theme's bg tint (moyu-green → `#F0FDF4`,
red-white → `#FEF2F2`, olive-journal → `#FDFDF8`). Structural grep for
`border-left:4px solid <accent>` / `font-family:...serif` confirms variable injection.

OCR caveat: tesseract chi_sim on 3D/stylized Chinese returns garbage; OCR failure is
inconclusive, NOT proof of missing text. When the user can see the image, deliver the
screenshot and ask for label confirmation.

## Upstream Tool Version Assessment

Distinguish FORMS before updating from upstream:

- Obsidian plugin (TypeScript, `themes/*.md` YAML frontmatter) ≠ Hermes Python CLI
  skill. Theme DESIGN VARIABLES port cleanly; plugin code does not.
- An Obsidian source note may claim "多种排版主题" while the local adaptation only
  implemented one. Re-read the vault source note + upstream plugin `themes/` dir to
  see what was lost in adaptation.
- Recommend: port variable tables (colors/fonts/line-heights), not plugin internals.

## Known Reference Points (2026-08)

- gzh-design (isjiamu/gzh-design-skill, **AGPL-3.0** — 注意不是 MIT): 6 themes fused — moyu-green /
  red-white / graphite-minimal / zen-whitespace / moyu-ticket / olive-journal.
- 2026-08-10: gzh-design-skill **本体已单独安装**到 `~/.hermes/skills/creative/gzh-design/`（完整上游结构：
  SKILL.md + references/ 厚组件库 + scripts 校验工具）。本地 wewrite 保留 6 主题变量融合版（无智能排版），
  需要章节编号/关键词下划线/引言卡/目录/签名卡等完整版式效果时，改用 gzh-design skill 排版，
  wewrite 继续负责封面/上传/草稿箱发布。license 为 AGPL-3.0，改造分发需保留版权声明。
- Upstream Obsidian plugin `learnerchen-forever/wewrite` v2.0.pre5: 10 themes
  (Tech Blue / Warm Daily / Dark Mode / Elegant Serif / Fresh Green / Minimal Gray /
  Vibrant Purple / Magazine Style / Academic Paper / Rose Romance) + modifier engine.
- wewrite_publish.py THEMES dict: 7 entries (6 fused + legacy professional-clean).
