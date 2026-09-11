---
name: wechat-sticker-publisher
description: Use when creating WeChat Official Account image-message/sticker drafts from local images and short Chinese copy, including dog/default account alias resolution and draft-box publishing.
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [wechat, official-account, sticker, image-message, draft]
    related_skills: [wewrite]
---

# WeChat Sticker Publisher · 微信公众号贴图草稿发布

## Overview

This is the Hermes local adaptation of the Obsidian note `20-Library/Skills/Content/wechat-sticker-publisher.md` from 峰之宝库. It creates WeChat Official Account image-message drafts (`newspic`) from one or more local images plus a short text caption.

Important: WeChat `draft/add` has two different draft structures:

- Normal article draft: `article_type="news"`, uses `thumb_media_id` + HTML `content`.
- Picture-message/sticker draft: `article_type="newspic"`, uses permanent image material IDs in `image_info.image_list[].image_media_id` plus `cover_info.crop_percent_list`.

Dog/AI sticker workflows must use `newspic`; do not publish stickers as normal `news` article drafts.

It is designed for the OpenClaw cron workflows migrated into Hermes:

- `04-狗狗贴图` → account alias `dog`
- `06-AI日报贴图` → account alias `default`

The script creates a **draft** in the WeChat backend. It does not mass-send.

## 语言要求（简体中文，禁止繁体）⚠️

**本工作流所有对外内容必须一律使用简体中文（Simplified Chinese），严禁繁体中文。**

2026-09-08 事故：模型产出整张繁体贴图（标题「狗狗不能吃的10種人類食物」、正文「含可可鹼…會導致…」），因为 prompt/skill 未强制简体，模型自行漂移到繁体。

强制规则：

1. **生图 prompt 必须显式声明**：`所有文字使用简体中文 / all text in Simplified Chinese (简体中文)`。这是模型最容易漂移的地方（图片上的标题、卡片、正文都可能是繁体）。
2. **标题、正文配文、摘要** 一律简体。
3. **发布前必跑统一校验脚本**，把标题和正文各过一次繁→简转换，杜绝繁体进入草稿：

   ```bash
   # 把标题/正文转成简体并打印（用输出替换 --title / --text）
   python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/zh_simplify.py \
     --convert-text "<标题>"
   python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/zh_simplify.py \
     --convert-text "<正文>"
   ```

   校验脚本用 opencc `t2s`（opencc-python-reimplemented，已完成 `pip install`），若检测到繁体会自动转简体；`--detect-text` 可用于断言：

   ```bash
   python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/zh_simplify.py \
     --detect-text "<标题或正文>"   # 输出含 "TRAD_FOUND" 表示有繁体，需修正
   ```

4. **最终校验**：发布前对 `--title` 与 `--text` 各跑一次 `--detect-text`，必须返回 `OK all-simplified`。若返回 `TRAD_FOUND`，先 `--convert-text` 转简体再发布（如 opencc 不可用，回退到内置映射表）。

## Local Paths

```text
SKILL_DIR=/root/.hermes/skills/productivity/wechat-sticker-publisher
SCRIPT=/root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/publish_sticker.py
OUTPUT_DIR=/root/.hermes/workspace/workflows/stickers/outputs
```

## Credentials

Secrets must come from `/root/.hermes/.env` or the environment. Do not put AppSecrets in prompts, notes, logs, or Feishu messages.

Supported account aliases:

| Alias | Account | AppID / Original ID | Env vars |
|---|---|---|---|
| `dog` | 狗狗生活小百科 | AppID `wx27855f8407f2c81c`; Original ID `gh_08e4f228bbda` | `DOG_WECHAT_APPID`, `DOG_WECHAT_SECRET` |
| `default` | 峰AI路 | AppID `wx42b46ea46863a720`; Original ID unknown | `WECHAT_APP_ID_DEFAULT`/`WECHAT_APP_SECRET_DEFAULT`, or `WECHAT_APP_ID`/`WECHAT_APP_SECRET` |

Dog account identity verified from 峰峰's WeChat backend screenshot (2026-07-12): display name `狗狗生活小百科`, region `上海 浦东新区`, real-name status `已实名`, login email `graysonfeng214@gmail.com`. The Original ID `gh_08e4f228bbda` is not an API AppID; publishing still uses `DOG_WECHAT_APPID`.

If the default account credentials are not configured locally, `default` runs will stop with a clear error.

## Usage

Single-image draft, using the WeChat picture-message/sticker structure:

```bash
python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/publish_sticker.py \
  --mode newspic \
  --account dog \
  --image /path/to/infographic.png \
  --title '狗狗夏季饮水误区' \
  --text '今天这张图，帮你快速看懂夏季补水的几个重点。'
```

The default mode is `newspic`, but sticker cron prompts should still pass `--mode newspic` explicitly as a safety check.

Default/峰AI路 draft:

```bash
python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/publish_sticker.py \
  --account default \
  --image /path/to/ai-infographic.png \
  --title 'AI 工具选择清单' \
  --text '一张图快速看懂今天的 AI 热点。'
```

Dry-run without creating a draft:

```bash
python3 scripts/publish_sticker.py --account dog --image image.png --title '测试' --text '测试' --dry-run
```

## Image Requirements

- Local file only; download remote URLs first.
- WeChat official `draft/add` for picture-message/newspic uses `image_info.image_list` (max 20 images; first image is the cover) and `cover_info.crop_percent_list`; supported cover crop ratios include `1_1`, `16_9`, and `2.35_1`.
- For 峰峰's dog/AI sticker workflows, final sticker images must be vertical 3:4. Recommended exact canvas: `1080×1440 px`; minimum quality gate: `720×960 px`. Do not publish 9:16, 1:1, landscape, or near-landscape images as final newspic stickers.
- Leave a mobile-safe area: keep all key text at least ~80 px from image edges on a 1080×1440 canvas; reserve ~10% low-information space at top/bottom so WeChat preview/cropping does not cut the title or bottom reminder.
- For 峰峰's dog/AI sticker workflows, the final infographic should be generated directly as a complete **简体中文** (Simplified Chinese) infographic using the **baoyu-infographic** system (峰峰指定 2026-09-04，已取消原新海诚风格). The image prompt MUST explicitly say `所有文字使用简体中文 / all text in Simplified Chinese (简体中文)` to stop the model drifting to Traditional (2026-09-08 incident). Call the ApiYi CLI with `gpt-image-2-vip` and an explicit `--size 1536x2048` to produce a strict 3:4 vertical infographic in one pass (2026-09-06 fix: gpt-image-2-vip natively supports `size=1536x2048` = 3:4, so it must be generated directly, NOT landscape-then-cropped). Do **not** use the previous text-free-background + deterministic Chinese overlay/composition flow, and do not run a separate Chinese OCR/text-quality self-check.
- Final sticker infographics must be generated by a real text-to-image model (`image_generate`). Do **not** publish PIL/HTML/CSS/SVG/Canvas/local drawing output as the final image. If generation fails, report the failure and do not publish a fallback-image draft. Never use `--allow-local-fallback`.
- Required visual direction for these sticker workflows (峰峰指定 2026-09-10，取代 2026-09-04 的「按内容自动选」): **baoyu-infographic 信息图 + 固定 4 风格按星期几轮播**。写文与贴图同一天必须使用同一风格（同一脚本、同一北京时间口径）：
  - 周一 → `1 morandi-journal`（暖调手账手绘）；周二 → `2 craft-handmade`（手作纸艺剪贴）；周三 → `3 storybook-watercolor`（水彩绘本）；周四 → `4 hand-drawn-edu`（马卡龙手绘教育）；周五回到 1，周六 2，周日 3。公式 `style_no = ((isoweekday - 1) % 4) + 1`。
  - **唯一权威取法（禁止手算星期、禁止改选）**：`python3 /root/.hermes/skills/social-media/dog-wechat-daily-writer/scripts/daily_style.py`；输出 `本次风格 = N ｜ <style-id>` 与 `PROMPT-FRAGMENT:` 行（该英文视觉片段必须逐字写进生图 prompt）。`--json` 给机器可读结果。
  - 不再使用旧池成员（kawaii / ikea-manual / corporate-memphis）；也禁止 cyberpunk-neon / pixel-art / ui-wireframe / technical-schematic / subway-map / chalkboard / lego-brick / origami / claymation / pop-laboratory / retro-pop-grid / retro-popup-pop / aged-academia / knolling / bold-graphic。
  Layout chosen by content structure (dense-modules high-density / bento-grid overview default / hub-spoke central concept). Pure Chinese numeric section markers (① ② ③, no English CELL A/SPOKE A). Sticker images keep 3:4 vertical (recommended 1080×1440, min 720×960); article cover landscape 2.35:1 or 16:9; body illustrations landscape 16:9. Chinese, title not touching top, key text ≥80px from edges, no watermark, no garbled English. Report the chosen combo in the final response as 「本次选用：布局=xxx + 风格=<no>-<style-id>（当日轮播固定）」. Keep the image original and do not copy protected IP.
- Verify final dimensions before publishing when the workflow requires 3:4; a square/landscape test draft is not acceptable as the final draft.
- Keep WeChat upload size reasonable; compress if the API rejects the image.
- First image is used as the main image.

Reference: `references/wechat-draft-e2e-notes.md` captures field-length and 3:4 E2E testing pitfalls from real draft-box runs.

Reference: `references/sticker-crop-root-cause-20260906.md` captures the 2026-09-06 sticker-content-crop root cause and the `gpt-image-2-vip --size 1536x2048` direct-3:4 fix.

Reference: `references/nano-banana-2-aspect-ratio-quirk.md` documents the nano-banana-2 (gemini-3.1-flash-image-preview) aspect_ratio advisory-not-enforced quirk: always verify dimensions post-generation with PIL.

Reference: `../wewrite/references/wechat-image-style-tuning.md` captures the shared image-style tuning preference: Shinkai-inspired, fresh-natural, bright, medium-low saturation, and not gray/dark.

## Cron Workflow Rules

0. 【选题与分类轮换】（2026-09-04 新增）在调研前跑 `python3 /root/.hermes/skills/social-media/dog-wechat-daily-writer/scripts/topic_pool.py category_balance --days 90`，按返回的 `suggested_rotation`（使用最少类别优先）选定本次类别；再从该类别里挑一个近 30 天未写过、不重复的具体角度。固定 6 大类：健康预警/急症、行为解读、训练技巧、季节护理、营养饮食、医疗常识。避免连续多天扎堆某一类。
1. 【素材搜集】优先 IMA/knowledge-base（若返回 `skill auth failed` 或 10 秒内不可用，立即降级）；中文可靠源依次用 `byted-web-search`（豆包，查中文权威兽医科普/时效）→ `zhihu-search`（知乎，查养宠经验/高赞问答）→ 直接 web research 抓取 VCA/AKC/PetMD 等兽医信源。
2. Generate or save the full Chinese infographic under the workflow output directory using a real text-to-image provider. Current user preference is direct T2I for sticker image testing; do not use the previous deterministic overlay/composition flow.
2.5 【图片 prompt 落盘硬规则｜2026-09-10】调用生图后端之前，必须先把该图完整最终 prompt 写入磁盘，再出图（生图后端不记日志、图片无 EXIF，落盘是唯一可复现凭据）：`outputs/prompts/<日期>-<主题>-sticker.md`（先 `mkdir -p outputs/prompts`），同时写 `outputs/<slug>-sticker-req.json`（`prompt`/`size`/`aspect_ratio`/`model`/`source`/`style`/`layout`）。优先用 `apiyi_image.py --prompt-file <该文件>`，让 prompt 文件直接成为出图输入。禁止“先出图、后补写”；最终回复报告 prompt 文件路径。
2.6 【风格按日轮播｜2026-09-10】本任务不再按内容自选风格。出图前先跑 `python3 /root/.hermes/skills/social-media/dog-wechat-daily-writer/scripts/daily_style.py`，把输出的 `PROMPT-FRAGMENT:` 片段逐字写进生图 prompt（北京时间口径；写文与贴图同日必须同风格）。不得手算星期、不得改选、不得用旧池风格。
3. 【尺寸验证与重试】**必须生成严格 3:4 竖版**：用 `gpt-image-2-vip` + `--size 1536x2048`（2026-09-06 验证：gpt-image-2-vip 原生直出 1536×2048，比例 0.75，零裁剪）。生成后用 `python3 -c "from PIL import Image; i=Image.open('<path>'); print(i.size)"` 读尺寸，必须 宽/高 = 0.75 ±0.02 且宽 < 高，否则立即用 `--size 1536x2048` 重新生成。**明确禁止**：现流程先出横版再 center-crop 到 3:4（会砍掉左右标题/首字）。不要接受任何首次生成的非 3:4 图片作为最终图。
4. Verify image dimensions before publishing: must be 3:4 vertical, recommended `1080×1440 px`, minimum `720×960 px`; if the title or bottom reminder is cropped/too close to the edge, regenerate. Do not run a separate Chinese text-quality/OCR self-check unless the user explicitly asks.
5. Write a 280-320 **简体中文** character caption with readable paragraphs: one opening sentence, 2-3 short重点段落 using `① ② ③` or `•`, and one closing action/reminder. Do not send one dense paragraph.
6. Apply HumanizerZH to the caption before publishing: remove AI-flavored filler (`此外`/`值得注意的是`/`这不仅仅是`), slogan-like endings, vague claims, excessive emoji/bold, and stiff three-part rhythm; keep the caption warm, specific, and natural while preserving medical caution and action reminders.
6.5 **【简体中文强制校验】** 发布前对标题和正文各跑一次繁→简转换，杜绝繁体进入草稿（2026-09-08 模型漂移繁体事故）：
    ```bash
    python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/zh_simplify.py --detect-text '<标题>'
    python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/zh_simplify.py --detect-text '<正文>'
    ```
    两条命令都必须返回 `OK all-simplified`。任何一条返回 `TRAD_FOUND` 就先用 `--convert-text` 转简体，把转换结果作为最终 `--title` / `--text`。
7. Call `publish_sticker.py --mode newspic` with explicit `--account`.
8. Verify the returned JSON includes `ok: true`, `draft_type: newspic`, `draft_media_id`, image dimensions, and formatted text.
9. Record the topic only after the newspic draft is created, or record `generated-not-published` if generation succeeded but publishing failed. **使用 `topic_pool.py record --category '<类名>' --target sticker` 写入所属类别（写入贴图池 `dog-shared`，不污染写文池）**，与写文任务保持一致口径。写文任务用 `--target writer`（写入 `shared+dog`），两流程写入分离、读取仍共享以跨工序去重。
10. Final cron response must include title, account alias, appid, local image path, dimensions, crop/dimension check result, HumanizerZH caption editing result, draft media id if present, draft type (`newspic`), chosen layout+style, and any real error.

## Common Pitfalls

1. **Wrong account.** Always pass `--account dog` or `--account default`; do not rely on process defaults.
2. **Secrets in prompts.** Prompts should mention env var names, not AppSecrets.
3. **Remote image URL.** The WeChat material API needs a local file upload.
4. **Invented publish success.** Only report success when the script returns a successful JSON response with a draft media id.
5. **Overlong WeChat metadata.** If the API rejects `description`/digest/title size, keep the title short and retry with a very short digest; keep the long copy in `--text`, not metadata.
6. **Unicode escape garbling in WeChat editor.** Do not send draft payloads through `requests.post(json=payload)` because it serializes Chinese as `\uXXXX`; WeChat draft editor may display those escapes literally in title/body. Use `json.dumps(payload, ensure_ascii=False).encode('utf-8')` with `Content-Type: application/json; charset=utf-8`.
7. **Accidental preliminary drafts.** If a wrong-ratio image was already published during E2E testing, publish the corrected draft and explicitly tell the user which earlier `draft_media_id` to ignore/delete.
8. **Wrong draft type.** Sticker workflows must use WeChat `article_type="newspic"` through `publish_sticker.py --mode newspic`. Do not use normal article `news` payloads (`thumb_media_id` + HTML content image); those show up in the writing/article draft flow instead of the picture-message/sticker flow.
9. **Cropped title/bottom text.** WeChat preview/crops can hide content near the top/bottom. Use 1080×1440, keep critical text at least 80px from edges, and leave ~10% safe area at top/bottom. Regenerate if the title or bottom reminder touches the edge.
10. **Direct-T2I text limits.** In current direct-T2I testing mode, do not run a separate Chinese quality self-check/OCR audit unless the user explicitly asks. Keep only file-existence, 3:4 dimension, and crop/safe-area checks before publishing; do not use deterministic overlay/composition unless the user asks to restore that architecture.
11. **Dense newspic body copy.** Newspic `content` is plain text; make it readable with short paragraphs and visible重点 markers (`① ② ③` or `•`). The publisher normalizes text and caps it under the documented 2KB limit, but the workflow should still write clean segmented copy.
12. **Landscape-then-cropped cuts title/first characters (root cause of 2026-09-06 sticker crop).** If a sticker is generated as 16:9 landscape (e.g. `2048x1152`) then center-cropped to 3:4, the crop removes ~58% of the width and cuts each line's leading character (e.g. 「换牙期不适」→「牙期不适」). Use `gpt-image-2-vip --size 1536x2048` to generate the 3:4 canvas directly; do NOT generate landscape then crop. If the model returns a non-3:4 image, regenerate with `--size 1536x2048` rather than cropping.
13. **Model drifts to Traditional Chinese (2026-09-08).** With no explicit constraint, the model produced the whole sticker (title + on-image text + caption) in 繁體中文 (e.g. 「狗狗不能吃的10種人類食物」, 「可可鹼…會導致…」). Always (a) state `所有文字使用简体中文 / all text in Simplified Chinese` in the image prompt, and (b) run the `zh_simplify.py` guard on `--title`/`--text` before publishing (`--detect-text` must return `OK all-simplified`). If opencc is unavailable, fall back to the embedded mapping the script ships with.

## Verification Checklist

- [ ] `python3 scripts/publish_sticker.py --help` works.
- [ ] `--dry-run` validates image paths and account env vars without creating a draft.
- [ ] Real run returns JSON with `draft_media_id` or an explicit WeChat API error.
- [ ] Final notification names the account alias and appid used.
- [ ] 当日风格由 `daily_style.py` 取得（北京时间口径），且与同日写文任务同一风格号
