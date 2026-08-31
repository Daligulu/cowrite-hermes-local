---
name: broll-hyperframes
description: Use when creating 9:16 B-roll / HyperFrames explainer videos from Chinese scripts, articles, docs, README files, or product ideas. Enforces asset-modality decisions, Edge TTS male narration, optional bottom-right Feng anime guide, code-rendered Chinese/UI/diagrams, anti-PPT motion, draft render, keyframe QA, and review report before delivery.
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [b-roll, hyperframes, video, edge-tts, chinese, feng, qa]
    related_skills: [html-video, feng-ip]
---

# B-roll HyperFrames 视频制作

## Overview

本 skill 用来把中文文案、文章、飞书文档、README、GitHub 项目或产品说明，做成 9:16 竖屏 B-roll / HyperFrames 知识讲解视频。核心目标是：**中心画面好看、信息清楚、中文准确、节奏有变化、最终可真实渲染交付。**

默认视频结构：中心区域承载主要信息表达；字幕和配音同步；右下角可放一个小比例 Feng 动漫小人作为辅助讲解员，但不能让角色喧宾夺主。失败经验写入本 skill：不要为了“有角色”牺牲主画面，不要用代码几何小人冒充角色，不要把所有画面做成 PPT 卡片淡入淡出。

## When to Use

Use this skill when the user asks for:

- 用 HyperFrames 做 B-roll 视频；
- 把中文脚本、文章、README、飞书文档、项目介绍做成 9:16 讲解视频；
- 做知识类、AI 工具类、GitHub 项目类、产品介绍类短视频；
- 需要 Edge TTS 男生中文配音；
- 需要中心画面配 UI、流程图、图表、卡片、隐喻物件、字幕和动效；
- 需要右下角 Feng 动漫小人辅助讲解。

Do **not** use this skill for:

- 真人口播剪辑；
- 纯音乐 MV；
- 复杂 3D / 粒子特效；
- 只要单张插图的任务（用 `feng-ip`）；
- 不需要真实渲染、只要脚本建议的任务。

## Defaults

When the user says “方案 B”, use the compressed short-video male-voice workflow in `references/scheme-b-edge-tts.md`.

For serious B-roll / HyperFrames work, embed `geekjourneyx/hyperframes-motion-director` as the production director layer. Its local path is `/root/.hermes/workspace/external-skills/hyperframes-motion-director`; details are in `references/hyperframes-motion-director-integration.md`.

For any HTML/GSAP/card-based video, apply the text/container alignment rules in `references/text-container-layout-qa.md` before final render.

For narrated videos, apply `references/audio-visual-sync-qa.md`: scene boundaries, page order, captions, and snapshot times must be aligned to `voiceover.srt` / `voiceover.vtt`, not guessed durations.

For motion-rich explainer demos, apply `references/reference-reel-motion-patterns.md`: each spoken concept should trigger an object-level state change (type, reveal, connect, check, reject, transform, or write-to-document), not just a static slide.

- Format: 9:16 vertical.
- Resolution: 1080×1920 unless speed or platform constraints require a documented lower resolution.
- Voice: Edge TTS male Mandarin, default `zh-CN-YunxiNeural`.
- Visual style: clean modern Chinese explainer, readable, mobile-first, not PPT-like.
- Presenter: optional bottom-right Feng anime guide, based on `feng-ip` canon.
- Text: all exact Chinese text is code-rendered, never generated inside an image model.
- Delivery: final MP4 + project files + contact sheet / keyframe QA + review report.

## Asset Modality Decision

Before implementation, write an asset-modality plan. The goal is beauty and controllability, not “all code” or “all image generation.”

Use **text-to-image / image assets** for:

- Feng anime presenter, when used.
- Emotional background plates.
- Complex visual metaphors or hand-drawn props.
- Illustration scenes where beauty matters more than exact text.

Use **code drawing / HTML / SVG / Canvas / CSS** for:

- Chinese titles, subtitles, labels, captions, CTA.
- UI cards, app screens, dashboards, approval flows.
- Charts, timelines, arrows, process diagrams.
- Highlight boxes, masks, scan lines, cursors, badges.
- Any element that needs precise text, exact data, responsive layout, or deterministic animation.

Mandatory plan format:

```text
Asset Modality Plan
- Element:
- Role:
- Modality: text-to-image / supplied image / code / hybrid
- Reason:
- Source or prompt:
- Local path:
- QA gate:
```

Completion criterion: every major visual element has a modality decision before animation starts.

## Feng Anime Presenter Rule

If the video uses a bottom-right anime guide, the character must follow `feng-ip` canon. When the user asks for a generated / text-to-image / text-to-animation presenter, follow `references/generated-feng-presenter-video.md`: use a real generated full-body character asset, not code drawing and not a contact-sheet crop as the final.

Character canon:

- short black hair;
- slightly slim but heroic eyebrows;
- gentle focused eyes;
- white hoodie;
- dark outer jacket;
- clean young-anime look;
- warm, serious, practical, not mascot-like.

Placement:

- bottom-right;
- about 8–12% of visual attention / frame area;
- never covers subtitles, UI, diagrams, CTA, or key text;
- can point, nod, think, react, or summarize;
- stays auxiliary — the center B-roll is the main subject;
- do not add a visible label like `Feng 讲解` under the character unless the user explicitly asks for that text.
- do **not** add a visible label such as `Feng 讲解` under/near the character unless the user explicitly asks for it; the character image should speak visually without extra UI clutter.

Asset rule:

- Prefer a dedicated text-to-image / generated Feng full-body asset for final video presenters.
- If native `image_generate` is unavailable, use the `feng-ip` Agnes fallback to generate the presenter and convert the white background to a transparent overlay.
- Do not use a rough code-drawn geometric character as the final presenter.
- Do not use a pose-library contact-sheet crop as the final presenter when the user asked for generated / text-to-image / text-to-animation. It may be used only as a prompt reference or temporary placeholder.
- Code may only scale, crop, shadow, bob, mask, or switch generated pose assets.
- If image generation fails, document the blocker and either reuse a previously accepted generated Feng asset or omit the presenter; do not fake it with a doodle.

Prompt skeleton:

```text
Clean anime explainer presenter, Feng anime boy, short black hair, slightly slim heroic eyebrows, gentle focused eyes, white hoodie, dark outer jacket, clean young-anime look, warm and serious but not stiff. Pose: <pointing / thinking / nodding / explaining / summary>. Full-body or 3/4 body, simple clean background, no text, no labels, no cafe background, no photorealism, no front-facing avatar portrait crop. Designed as a small bottom-right guide in a 9:16 Chinese explainer video.
```

## Voiceover: Edge TTS Male Narration

Default voiceover uses Edge TTS male Mandarin.

Preferred voice:

```bash
zh-CN-YunxiNeural
```

Default command:

```bash
edge-tts \
  --voice zh-CN-YunxiNeural \
  --rate +10% \
  --text "<final narration script>" \
  --write-media voiceover.mp3 \
  --write-subtitles voiceover.srt
```

For long scripts, write `script.txt` and call Edge TTS from a helper script to avoid shell command length issues.

Voice criteria:

- male, clear, young, practical;
- not salesy, not robotic, not over-dramatic;
- generated audio is the timeline source for captions and scene beats.

Completion criterion: `voiceover.mp3` and `voiceover.srt` exist; ffprobe returns a valid duration; spot-check the first/middle/end audio.

## 可选生成后端：Coze CLI 或 TokenDance H3（耗积分/余额）

默认路径是 HTML/GSAP 代码渲染 + ffmpeg。当用户明确要求“用扣子/Coze 生成视频”“耗扣子积分”，或内容本身是写实/影像化素材（实景、产品、人物、电影感画面）时，可切换到 **Coze CLI 生成后端**（模型 `doubao-seedance-1-5-pro`，CLI 固定无 --model 参数，按积分计费）。

切换规则：

- 保留本项目全部前期流程（脚本定稿、BEAT_MAP、STORYBOARD、配音 SRT），只有“画面生成”这一步换成 Coze。
- 每个 scene 转成一条自包含的视频提示词（视觉描述 + 运镜 + 风格 + 无文字要求；精确中文/UI/图表**不要**交给 Coze，文字类场景仍走代码渲染）。
- 批量生成走共享脚本（先 `--dry-run` 预检，不耗积分）：

```bash
bash ~/.hermes/skills/creative/coze-media-generation/scripts/generate_clips.sh \
  prompts.txt renders/coze_clips --ratio 9:16 --duration 10 --resolution 720p --dry-run
# 确认后去掉 --dry-run 正式生成（耗积分）
```

- `prompts.txt` 每行一条提示词，顺序对应 STORYBOARD 场景；需要图生视频时用 `<prompt>\t<image_url>`。
- 生成后仍按本项目流程：ffmpeg concat 拼接（参数一致时 `-c copy`），叠 Edge TTS 配音与字幕（`audio-visual-sync-qa.md`），抽帧联系表 QA。
- 积分提醒：seedance 1.5-pro 720p 约每 5 秒 1 次生成，10s×N 场景即 2×N 次。视频 URL 24h 有效，及时下载。
- 失败的补救：单个 clip failed → 修该条提示词重跑；多 clip 音色/画风不一致 → 统一用 Edge TTS 外部 VO 覆盖。

### TokenDance H3 后端（可选，走 TokenDance 余额）

若用户要求「用 TokenDance / MiniMax H3 生成视频」（而非扣子积分），切换到 **H3 后端**（模型 `minimax-h3`，768P/2K，3–15s，原生双声道；共享脚本 `~/.hermes/scripts/generate_clips_tokendance.sh`）：

```bash
bash ~/.hermes/scripts/generate_clips_tokendance.sh \
  prompts.txt renders/h3_clips --ratio 16:9 --duration 10 --resolution 768P --dry-run
# 确认后去掉 --dry-run 正式生成（耗 TokenDance 余额）
```

- prompts 格式与 Coze 脚本一致（每行一条；图生视频 `<prompt>\t<image_url>`；本地首帧文件自动上传）；先 `--dry-run` 预检。
- 注意：H3 分辨率只支持 768P/2K（传 1K 报 400 错误）；视频任务有上游并发限流（429 需等待 45–90s 重试）。
- Key 读取顺序：环境变量 `TOKENDANCE_API_KEY` → `~/.hermes/secrets/tokendance-api-key.key`（600 权限）。
- 详细协议、陷阱与验收清单见 skill `tokendance-video-generation`。


## Motion Director Integration

Motion Director（`geekjourneyx/hyperframes-motion-director`）安装于：

```text
/root/.hermes/workspace/external-skills/hyperframes-motion-director
```

Use it as the production discipline for non-trivial videos. It adds:

- production scaffold;
- essence extraction;
- brief/design proposal;
- text-over-background layout contract;
- storyboard detail;
- beat map and motion map;
- kinetic relay scorecard;
- artifact validation;
- review pack standards.

Default scaffold command:

```bash
HFMD=/root/.hermes/workspace/external-skills/hyperframes-motion-director
node "$HFMD/scripts/create_project.mjs" \
  ~/projects/Fengfeng/broll-hyperframes/<video-slug> \
  --with-timing \
  --with-motion
```

Do not blindly copy its black/gold cinematic style. Use its process and anti-PPT gates; keep this skill's default clean Chinese B-roll explainer style unless the user requests cinematic premium visuals.

Read `references/hyperframes-motion-director-integration.md` when creating or revising a serious video project.

For the proven HTML/GSAP browser-render path with a bottom-right Feng presenter, read `references/html-gsap-feng-presenter.md`. This reference includes the no-visible-label rule for Feng and a deterministic `puppeteer-core` + Chrome + ffmpeg render pattern.

## Production Artifacts

Each serious video project should create:

```text
BRIEF_DESIGN_PROPOSAL.md
DESIGN.md
STORYBOARD.md
BEAT_MAP.json
MOTION_MAP.json
REVIEW_REPORT.md
script.txt
voiceover.mp3
voiceover.srt
index.html or composition source
renders/verify.mp4
renders/contact-sheet.jpg
renders/<slug>-final.mp4
```

The project may use HyperFrames directly, or an HTML/CSS/Canvas renderer when HyperFrames is unavailable. If HyperFrames commands cannot run, state the blocker and perform the closest substitute: ffprobe, frame extraction, contact sheet, and visual inspection.

## Workflow

### 1. Intake and script finalization

Read the source material. Produce a final Chinese narration script if the user did not provide one.

Completion criterion: `script.txt` contains a complete narration that can be read aloud without placeholders.

### 2. Brief and modality plan

For serious videos, first run the Motion Director scaffold:

```bash
HFMD=/root/.hermes/workspace/external-skills/hyperframes-motion-director
node "$HFMD/scripts/create_project.mjs" \
  ~/projects/Fengfeng/broll-hyperframes/<video-slug> \
  --with-timing \
  --with-motion
```

Write `BRIEF_DESIGN_PROPOSAL.md` and include:

- core viewpoint;
- audience and purpose;
- 9:16 format and duration target;
- visual metaphor;
- whether Feng presenter is used;
- Asset Modality Plan;
- first 0–2 second hook target;
- essence extraction: core viewpoint, largest conflict, emotional center, amplified keyword, visual metaphor;
- attention map: first eye target, biggest word/object, scroll-stop event;
- kinetic relay plan: keyword chain, action-object chain, direction map, relay object, readable holds;
- anti-PPT risks.

Completion criterion: the plan says what is image-generated, what is code-drawn, and why; it also names the first-eye target, kinetic relay chain, and anti-PPT gate before implementation.

### 3. Voiceover and timing

Generate Edge TTS male narration and subtitles.

Then create `BEAT_MAP.json` from audio/subtitle timing:

- duration;
- scene time ranges aligned to actual SRT/VTT cue meanings;
- caption chunks from exact SRT/VTT text;
- important audio hits;
- readable hold times.

Completion criterion: scene durations and visual page order match actual audio/subtitle timing, not guessed script length; the contact sheet should feel like a person advancing PPT slides while speaking.

### 4. Design system

Write `DESIGN.md`:

- canvas and safe zones;
- typography;
- color system;
- layout contracts: textRect, subjectRect, quiet text zone, safeBottomY, title tier, motion bounds;
- text container contracts for every card/node/pill/chip: width, height, padding, line-height, horizontal and vertical centering;
- center content rules;
- subtitle placement;
- Feng presenter placement and asset path if used;
- asset-modality decisions;
- mobile readability constraints.

Completion criterion: a paused frame can be drawn from the design without improvising style; text and image zones are explicitly contracted before generated/supplied imagery is used.

### 5. Storyboard

Write `STORYBOARD.md`. For each scene:

- time range;
- narration meaning;
- center visual;
- screen text;
- caption behavior;
- Feng action if used;
- hero frame timestamp;
- transition out;
- QA risk.

Completion criterion: every scene has one visual job and one readable hero frame.

### 6. Motion map

Write `MOTION_MAP.json` before animation.

Define:

- keyword chain;
- action object per important beat;
- transition direction;
- relay object / handoff;
- mask / scan / split / compression / path handoff where useful;
- hold moments;
- anti-PPT check.

Completion criterion: no three consecutive scenes use the same text rectangle, same entrance, and same rhythm unless repetition is the concept; text/icon videos should target a kinetic relay score of 90+ before final delivery.

### 7. Static build before animation

Build static hold frames first. Use code for text/UI/diagrams and image assets only where the modality plan says so.

Completion criterion: extracted still frames are readable and attractive before motion is added.

### 8. Animation and render

Add motion after the still frames work. Render a draft and final MP4.

Prefer:

```bash
npx hyperframes lint
npx hyperframes render --quality draft -o renders/verify.mp4
```

Fallback is allowed via HTML/Pillow/Canvas + ffmpeg, but must still create keyframes/contact sheet. For the proven Pillow rawvideo-pipe pattern, performance tips, and QA gates, read `references/pillow-ffmpeg-fallback.md`.

Completion criterion: final MP4 exists and ffprobe shows correct duration, size, resolution, and FPS.

### 9. Keyframe QA and review report

Extract snapshots from every major scene and create a contact sheet.

Write `REVIEW_REPORT.md` with:

- final file path;
- Motion Director artifact validation result;
- duration, resolution, FPS;
- voice used;
- asset-modality summary;
- Feng presenter status;
- keyframe timestamps inspected;
- subtitle collision status;
- anti-PPT verdict;
- known blockers;
- recommended next edit.

Completion criterion: the report is filled with actual results, not template placeholders.

## Failure Lessons to Preserve

1. **Do not let the presenter dominate.** The center B-roll is the main product; Feng is optional support.
2. **Do not fake Feng.** If Feng appears, use a dedicated generated/accepted image asset. If the user asked for text-to-image/text-to-animation, generate a full-body asset; do not use code drawing or a contact-sheet crop as the final.
3. **Do not outsource Chinese text to image generation.** All exact Chinese text must be code-rendered.
4. **Do not make static PPT cards.** Use motion relay: scan, mask, split, compression, cursor, path handoff, camera push, or UI transitions.
5. **Do not skip contact sheet review.** A rendered MP4 without frame QA is not done.
6. **Do not force long scripts into 60 seconds.** For long Chinese narration, choose either compressed short version or natural full version and document it.
7. **Do not pretend HyperFrames validation ran.** If unavailable, state fallback checks honestly.
8. **Do not label the Feng presenter by default.** A visible `Feng 讲解` tag under the bottom-right character adds clutter; omit it unless requested.
9. **Do not let text float outside its container contract.** Cards, workflow nodes, pills, chips, status bars, and captions need explicit centering, padding, line-height, and width/height; see `references/text-container-layout-qa.md`.
10. **Do not leave Motion Director templates half-empty.** If scaffolded artifacts still contain placeholders, fill them or clearly mark the work as a rough draft, not final.
11. **Do not copy black/gold cinematic style by default.** Borrow Motion Director's process and quality gates; use the visual style that best serves the B-roll explanation.
12. **Do not desynchronize narration and pages.** For narrated videos, retime and reorder visual pages from `voiceover.srt` / `voiceover.vtt`; captions should use the current cue text so it feels like a person presenting slides.
13. **Do not let diagrams sit inert.** Important spoken phrases need object-level state changes: type/reveal/connect/check/reject/transform/write-to-document; see `references/reference-reel-motion-patterns.md`.

## Common Pitfalls

1. **Edge TTS command too long.** Put narration in `script.txt` and call from helper script.
2. **Caption collides with presenter.** Reserve right-bottom safe zone; cap caption width or move captions above presenter.
3. **Generated image contains bad Chinese.** Regenerate without text; overlay all Chinese in code.
4. **Presenter is too large.** Keep it about 8–12% visual attention.
5. **UI is unreadable on mobile.** Increase type, reduce text density, and inspect 9:16 snapshots.
6. **Video feels like slides.** Add motion handoffs and vary layout/transition rhythm.

## Verification Checklist

- [ ] Motion Director scaffold used for serious projects, or an explicit lightweight exception is written.
- [ ] `script.txt` finalized.
- [ ] `BRIEF_DESIGN_PROPOSAL.md` includes Asset Modality Plan.
- [ ] Edge TTS male `voiceover.mp3` and `voiceover.srt` generated.
- [ ] `DESIGN.md` defines safe zones, typography, center content, subtitles, Feng status.
- [ ] Card/node/pill/chip/status text uses explicit container contracts and is visually centered in contact-sheet frames.
- [ ] If Feng appears, it is based on `feng-ip` image asset, not code doodle.
- [ ] All exact Chinese text is code-rendered.
- [ ] `BEAT_MAP.json` matches actual audio duration and aligns scene/page order to `voiceover.srt` / `voiceover.vtt` cue meanings.
- [ ] Captions use exact current SRT/VTT cue text, not only coarse scene summaries.
- [ ] `MOTION_MAP.json` defines an object-level state change for each important spoken concept: type, reveal, connect, check, reject, transform, or write-to-document.
- [ ] `STORYBOARD.md` covers every scene and hero frame.
- [ ] `MOTION_MAP.json` avoids repeated PPT rhythm and includes kinetic relay / action object decisions.
- [ ] Motion Director `check_assets.mjs` / `validate_artifacts.mjs` run when applicable; failures are fixed or documented.
- [ ] Draft render exists.
- [ ] If using Pillow/ffmpeg fallback, `references/pillow-ffmpeg-fallback.md` pattern was followed and the fallback is documented in `REVIEW_REPORT.md`.
- [ ] Contact sheet or keyframe snapshots exist.
- [ ] Final MP4 exists; ffprobe verifies duration/resolution/FPS.
- [ ] `REVIEW_REPORT.md` contains actual validation results and blockers.
- [ ] Public URL or media file is delivered if requested.
