---
name: feng-video
description: Use when the user provides a Chinese manuscript, article, technical case study, product experiment, AI/tool review, or knowledge topic and wants a 16:9 knowledge-sharing video in the proven form of fast narration, white-background hand-drawn information animation, real dark screen-recording evidence, chapter cards, concise bottom captions, occasional Feng personal-IP character beats, and optional authorized custom/clone voices. Produces a complete executable production package and can render through HTML/GSAP/HyperFrames + provider-agnostic TTS + FFmpeg. Reuses `feng-ip` as the only character canon; do not use for a single illustration or generic vertical B-roll.
version: 1.11.0
author: Hermes Agent for 峰峰
license: MIT for workflow/scripts; Feng personal-IP assets remain private
platforms: [linux]
metadata:
  hermes:
    tags: [feng, knowledge-video, explainer, html, gsap, screen-recording, tts, voice-cloning, ffmpeg]
    related_skills: [claude-real-video, feng-ip, html-video, broll-hyperframes, ai-script]
---

# 峰峰知识视频 · 手绘动画 × 真实录屏

## Overview

把用户提供的文稿转成可执行的 16:9 知识分享视频：高密度旁白推进叙事，白底手绘信息图解释概念，深色真实录屏提供证据，章节卡建立目录感，峰峰个人 IP 只在挑战、选择、反应和总结节点出现。

本 Skill 借鉴参考视频的抽象表现语法，不复制原作者角色、插画、文案、Logo、水印或逐帧构图。详细依据见 `references/reference-video-analysis.md`。

人物唯一事实来源是 `feng-ip`。本 Skill 只定义人物在视频中的职责、镜头和资产接口，不复制人物 Canon。

## When to Use

适用：

- 技术实验、AI 工具实测、产品能力验证、开源项目介绍；
- 把文章、逐字稿、README、研究笔记做成横屏知识视频；
- 需要“动画解释 + 真实操作/代码证据 + 个人 IP 剧情节点”；
- 用户说“按小白debug这类表现形式”“用峰峰形象做知识分享视频”。

不适用：

- 单张峰峰配图 → `feng-ip`；
- 默认 9:16 纯 B-roll → `broll-hyperframes`；
- 真人实拍剪辑、影视剧情、纯音乐 MV；
- 没有真实证据却要求伪造测试、代码、数据或产品结果。

## Defaults

- 画布：1920×1080，16:9，30fps。
- 旁白：默认Profile为 `feng-yunxi`，使用Edge TTS `zh-CN-YunxiNeural`、语速 `1.08`（约 `+8%`）；它是供应商预置男声，不是本人克隆音色。
- 音色扩展：`VOICE_PRESETS.json`注册音色，`VOICE_PROFILE.json`选择音色，`scripts/voice_adapters/`隔离供应商，`scripts/generate_voice.py`统一输出；新增同供应商音色不改视频主流程。
- 预置男声：当用户不使用克隆音色且偏好清晰、悦耳、轻松明快的中文男声时，先按 `references/preset-male-voice-selection.md` 生成公平试听，不凭音量或文字描述直接替用户决定。
- 目标语速：300–340 中文字符/分钟；参考视频约 336 字符/分钟。
- 声音：生产母版48kHz WAV，最终 `loudnorm` 约 -16 LUFS，峰值不高于 -1 dBTP。
- 字幕：底部安全区，白色粗体 + 深色半透明底/描边；每块 8–18 个汉字，最多两行。
- 章节卡：白底大号蓝字，0.8–1.5 秒。
- 视觉转场：语义段中位约 5 秒；对象内部每 1.5–4 秒至少一次状态变化。
- 峰峰：只在约 15–25% 场景出现，必须执行动作。
- 技术型文稿：白底动画约 55–70%，真实录屏约 30–45%。
- 非技术型文稿：真实录屏可降到 10–25%，但不能用伪造录屏填配额。

## Input Contract

最低输入只有一份文稿。可选输入：

- 目标平台与比例；
- 目标时长；
- 受众与认知起点；
- 语气；
- 真实代码、产品、数据、截图、网页或录屏素材；
- 是否需要完整渲染或只生成制作包；
- 峰峰动作偏好；
- CTA。

用户未指定时不要先追问。按默认参数推进，并把假设写入 `BRIEF_DESIGN_PROPOSAL.md`。

## Output Contract

每个项目目录至少包含：

```text
<project>/
  PROJECT.json
  source.md
  script-final.md
  BRIEF_DESIGN_PROPOSAL.md
  DESIGN.md
  STORYBOARD.md
  storyboard.json
  BEAT_MAP.json
  MOTION_MAP.json
  SCREEN_RECORDING_PLAN.md
  VOICE_PROFILE.json
  VOICE_PRESETS.json
  assets/
    feng/
    illustration/
    screen/
    ui/
  html/
  audio/
  captions/
  renders/
  REVIEW_REPORT.md
  validation-report.json
```

完整制作任务还必须产生 `audio/voiceover.wav`、`audio/voiceover.mp3`、`audio/voice-qa.json`、`audio/pronunciation-log.json`、字幕、草稿 MP4、联系表和最终 MP4。使用定制音色时，项目只保存非敏感Voice Profile；原始样本、speaker embedding、授权原件和凭据留在项目外的私有目录。

## 单一事实来源与可恢复执行

`storyboard.json` 是所有下游资产、字幕、时间线和渲染场景的单一事实来源。`STORYBOARD.md` 只作为人类可读视图；修改镜头时先改 JSON，再局部重建受影响场景。

项目使用 `work/state.json` 记录 P0–P8 的输入/输出 hash、状态、时间和错误。重跑时只重做输入变化、输出缺失或失败的阶段。原创差异和证据来源分别记录在 `originality-plan.json` 与 `assets/manifest.json`。完整规则见 `references/state-originality.md`。

## Workflow

### Step 1 · 建项目

运行：

```bash
SKILL_DIR="$HOME/.hermes/skills/media/feng-video"
python3 "$SKILL_DIR/scripts/init_project.py" \
  --title "<标题>" \
  --source /absolute/path/manuscript.md \
  --voice-profile feng-yunxi \
  --out /absolute/path/project
```

完成标准：目录、模板和 `PROJECT.json` 均存在，`source.md` 已包含原文。

### Step 2 · 决定完整版或压缩版

先按 `references/manuscript-to-video-algorithm.md` 运行场景预算：

```bash
python3 "$SKILL_DIR/scripts/plan_manuscript.py" \
  /absolute/path/project/source.md \
  --duration <目标秒数> \
  --out /absolute/path/project/production-plan.json
```

用户未给目标时长时省略 `--duration`。`production-plan.json` 必须先约束 Hook 截止时间、总场景数、证据画面配额、峰峰场景数、章节卡和证据候选，再进入分镜；不得仅凭直觉平均切句。

估算自然旁白时长：

`中文有效字符数 ÷ 320 × 60 秒`

- 用户要求保留全文：按自然时长做完整版，不强压。
- 用户给定较短时长：先删重复、铺垫和同义句，再保留因果、数据、转折和结论。
- 压缩后仍超时：明确标为“摘要版”，不得声称完整覆盖原文。

完成标准：`script-final.md` 是可直接朗读的连续口语，不含“这里放图”“待补充”等占位符。

### Step 3 · 重构叙事

优先使用七段式：

1. **反常识 Hook**：结论或冲突先行。
2. **证据与挑战**：一张可验证证据 + 一个具体高难任务。
3. **价值与缺口**：为什么观众应该关心。
4. **概念教学**：日常例子 → 抽象概念 → 机制 → 旧方案不足。
5. **实施过程**：环境/需求 → 追问 → 决策 → Spec → Plan → 执行。
6. **人性化转折**：失败、纠结、意外选择或作者反应。
7. **证据链与结论**：功能 → 正确性 → 性能 → 缺点 → 优化 → 总架构/价值判断。

非技术文稿可替换“代码实现”为“过程证据”，但证据必须来自真实素材。

前 5–12 秒必须完成 Hook；在前 15% 时长内给出观看承诺。CTA 放在价值承诺之后或结尾，不在第一个画面硬要关注。

完成标准：每段都有明确叙事功能，删除任何一段都会破坏因果链，而不是只减少重复。

### Step 4 · 场景化

使用 `references/scene-grammar.md`。每个旁白语义块分配一种视觉模板：

- `hook`
- `metaphor`
- `diagram`
- `chapter-card`
- `code-screen`
- `browser-demo`
- `data-chart`
- `character-beat`
- `result-proof`
- `comparison`
- `summary`

规则：

- 普通动画场景 2.5–8 秒；代码/演示证据可 8–15 秒。
- 章节卡 0.8–1.5 秒。
- 连续三个场景不得使用同一模板、同一布局和同一入场方式。
- 每场只承担一个视觉任务；一个画面通常 1 个主物件、1 条动线、2–4 个辅助对象。
- 旁白说到重要动词时，画面必须发生对象级动作：出现、连接、筛选、拆分、写入、报错、修复、比较或增长。

完成标准：`storyboard.json` 覆盖全部旁白，无孤立句、无无意义装饰镜头；每场包含可回指原文的 `source_span`，并在 `originality-plan.json` 记录借用的抽象语法与新创作差异。

### Step 5 · 资产模态计划

每个视觉元素必须选一种：

- **HTML/SVG/Canvas**：准确中文、图表、模块、箭头、数据库、UI、字幕、章节卡。
- **真实录屏/截图**：代码、终端、产品操作、网页、测试结果、数据证据。
- **feng-ip 生成素材**：峰峰动作镜头。
- **生成插画**：无精确文字的复杂隐喻背景或物件。

禁止：

- 让生图模型生成生产级中文；
- 用卡通假终端冒充真实证据；
- 用静态卡片连续淡入替代对象动作；
- 未标注地把模拟 UI 当真实产品结果。

完成标准：`BRIEF_DESIGN_PROPOSAL.md` 中每个主要元素都有 modality、来源、路径与 QA 门禁。

### Step 6 · 峰峰人物镜头

先加载 `feng-ip`，按其 Canon 和 Nano Banana 双参考图流程生成动作素材。推荐动作：

- Hook：提出疑问、指向证据；
- Challenge：操作夸张机器；
- Concept：观察/搬运/连接具体物件；
- Build：看终端、记录、做决定；
- Turn：惊讶、思考、离开去休息；
- Proof：验收、对照、总结。

先根据动作选择资产路由，完整门禁见 `references/character-scene-integration.md`：

- `gaze-gesture`：观察、思考、惊讶、指向、总结，可用透明人物素材叠加。
- `surface-contact`：点击、书写、滑动、翻页；接触简单时可分层合成，接触复杂时整帧生成。
- `force-contact`、`body-support`、`locomotion`、`handoff`、`environment-integrated`：推拉、拿取、旋转、搬运、坐靠、行走、递接、进入复杂空间等，默认整帧生成。
- 本规则不限于机器场景；纸片和摇柄只是校准案例。去白底只能解决矩形遮挡，不能修复悬空手、错误受力、穿模或画风割裂。

每个含峰峰的场景必须在 `storyboard.json` 写入：

- `interaction_mode` 与 `interaction_contract`：`actor`、`intent`、`action`、`target`、`contact_points`、`motion_or_force`、`body_response`、`object_response`、`occlusion`、`result_state`；
- `motion_strategy`：`static-overlay`、`anchored-micro-motion`、`rigged-animation`、`pose-sequence`、`integrated-frame` 或 `generated-video`；
- `action_phases`：连续的 `anticipation → contact → manipulation → release → result` 五阶段。

完整时序规则见 `references/action-timeline-coherence.md`。单张静态人物只允许无接触手势；简单按压可用 `anchored-micro-motion`；转动、推拉、搬运、承重、行走和递接必须使用可改变关节的姿势序列、绑定动画、整帧场景或连续视频。某一张 Hero Frame 接触正确，不代表连续动作通过。

### 泛化门禁

用户认可的单张图只作为质量校准，不得自动固化其中的道具、动作、构图或空间方向。任何从一次修图中提炼出的新规则，必须先改写为“人物—动作—对象—结果”的关系约束，并至少用三类差异明显的动作验证后，才能视为通用规则：

1. 一类无接触动作，如观察、思考或指向；
2. 一类表面接触动作，如点击、书写或翻页；
3. 一类强交互动作，如推拉、搬运、坐靠、行走或递接。

验证时只复用接触真实性、受力、遮挡、对象响应、空间一致性等抽象标准；不得复用校准图里的纸片、机器、摇柄、左右布局或具体标签。若规则只能解释当前案例，把细节放入 `references/`，不要提升为 SKILL.md 的全局硬约束。

约束：

- 只在 15–25% 场景出现；
- 每次承担操作、提问、观察、选择或反应；
- 禁止常驻右下角、站桩比赞或遮挡字幕；
- 人物外观只引用 `feng-ip`，不在本 Skill 另写一套 Canon；
- 人物素材不含文字，中文由代码层叠加。
- 峰峰白底JPEG需要覆盖HTML机器、路径或卡片时，先运行 `scripts/remove_connected_background.py`，只删除与画布边缘连通的近白背景；禁止全局白色转透明，以免破坏白hoodie。具体复查规则见 `references/ten-second-smoke-test.md`。
- 每只关键手都必须有明确接触对象；手指包裹、物件遮挡和状态变化必须可见。人物通常占画面宽度12–20%，不得遮住主机器、槽口、摇柄或输出。

完成标准：移除人物后，该场的动作或情绪功能会缺失；需要操作的镜头中，手部接触真实、输入→处理→输出路径连续、人物与物件像同一张图；叠加素材无白色矩形遮挡，白hoodie保持不透明。

### Step 7 · 真实录屏设计

填写 `SCREEN_RECORDING_PLAN.md`：

- 要证明的主张；
- 操作步骤；
- 需要看到的真实结果；
- 安全裁切/脱敏；
- 高亮区域；
- 对应旁白和时间段。

录屏处理：暗色原屏 + 圆角局部高亮 + 轻微金色边光 + 必要红箭头/放大；一次只强调一个证据。不得让小号代码占满全屏却无法读。

完成标准：每段录屏都能回答“它证明了哪句话”。

### Step 8 · 配音、定制音色与节拍

先用 `VOICE_PRESETS.json` 注册可用音色，再由项目 `VOICE_PROFILE.json` 选择Profile。默认 `feng-yunxi`；切换现有音色只改 `profile_id`，新增同供应商音色只增加注册项，新增供应商才在 `scripts/voice_adapters/` 增加Adapter。完整协议见 `references/voice-provider-adapters.md`。

列出音色并生成统一产物：

```bash
python3 "$SKILL_DIR/scripts/generate_voice.py" --list-profiles
python3 "$SKILL_DIR/scripts/generate_voice.py" --project /absolute/path/project
```

统一生成器负责解析Profile、调用Provider、两遍响度标准化、输出48kHz WAV/MP3、复制供应商字幕并生成QA报告。不要在HTML、分镜、FFmpeg封装或渲染器中写死供应商和Voice ID。

当用户中止本人克隆并改选现成音色时，立即停止克隆流程，不再继续要求录音或授权；已有样本不得上传或复用，并询问用户是删除还是仅本地保留。随后按 `references/preset-male-voice-selection.md` 使用同文案、同语速、同采样率和同LUFS生成3–4个候选试听。预置音色在Voice Profile中标记为 `provider_preset`，不得描述为本人声音。

首次使用本人或授权真人音色时，必须按 `references/voice-cloning-and-providers.md` 执行：

1. 从 `templates/VOICE_RECORDING_GUIDE.md`、`VOICE_CONSENT.md` 和 `VOICE_SAMPLE_MANIFEST.json` 建立私有录音包；
2. 录音先做本地有效时长、底噪、混响、削波、爆音和技术词覆盖检查；
3. 云端上传前再次确认声音主体、供应商、用途、渠道和删除策略；
4. 用户通过安全浏览器自行登录，不在聊天中粘贴密码或API Key；
5. 项目只记录授权状态与 `voice_id`，不复制原始样本或speaker embedding；
6. 先用同一段30秒文稿生成Edge基线与克隆音色，用户确认后才设为主音色。

统一音频输出：

- `audio/voiceover.wav`：48kHz生产母版；
- `audio/voiceover.mp3`：预览副本；
- `captions/voiceover.srt` 或VTT；
- `audio/voice-qa.json`；
- `audio/pronunciation-log.json`。

供应商不能提供可靠时间戳时，使用本地ASR或强制对齐生成字幕。始终以实际音频和字幕时间为准更新 `BEAT_MAP.json`，不得按估算时长硬切画面。自动字幕过长时，保留原始SRT，再按语义短语拆成8–18字显示字幕；若音轨整体延迟，字幕和场景边界同步平移。

声音规则：

- 旁白连续、短停顿；章节卡和转折允许0.3–0.8秒呼吸；
- 检查姓名、数字、英文缩写、技术词、吞字、重复、金属音和情绪漂移；
- BGM在人声下保持低位；短SFX只用于章节、成功、失败、选择和数据跳变；
- 最终约 `-16 LUFS`，峰值不高于 `-1 dBTP`；AAC封装显式重采样至48kHz；
- 任何后端失败时保留Edge兜底，不为赶进度伪造克隆结果。

完成标准：Voice Profile与授权类型可回溯；`ffprobe`可读取音频；首/中/尾字幕与真实语音对齐；定制音色通过本人试听；项目包不含原始样本、凭据或未经授权的声音资产。

### Step 9 · HTML/GSAP / HyperFrames 实现

优先复用：

- `html-video`：HTML/CSS/GSAP + 浏览器 + FFmpeg；
- `broll-hyperframes`：Motion Director、文本容器、音画同步和联系表 QA；
- 必要时调用 HyperFrames。

白底动画系统见 `references/visual-system.md`；渲染细节见 `references/render-pipeline.md`。HTML应暴露 `window.seekTo(t)` 和 `window.totalDuration`，用 `scripts/render_playwright_frames.py` 做确定性截图，不依赖实时播放抓帧。短样片先检查Hook完成态、人物核心动作、结果半完成态和结尾完成态四类Hero Frames，再批量渲染全部帧。

关键规则：

- 镜头稳定，物件运动；
- 通过路径接力、页面翻转、对象缩放或遮罩完成语义转场；
- 章节卡、信息图、录屏和人物剧情必须交替，不能整片像 PPT；
- 精确文字全部代码渲染；
- 人物动作按 `references/action-timeline-coherence.md` 先渲染顺序联系表：预备、首次接触、操纵25%/50%/75%、释放和结果；强交互每0.2–0.4秒采样。单张Hero Frame通过但动作序列失败时，必须重做动作，禁止批量渲染。

完成标准：静态 Hero Frames 和人物动作顺序联系表都通过后，再批量渲染。

### Step 10 · 验证

运行：

```bash
python3 "$SKILL_DIR/scripts/validate_package.py" /absolute/path/project --strict
```

再渲染草稿、抽关键帧联系表并填写 `REVIEW_REPORT.md`。检查 `references/qa-checklist.md`。

完成标准：

- validator 退出 0；
- `timeline/edit-decision-list.json` 存在，所有场景、资产与字幕均可按 `scene.id` 回溯；
- 声称真实执行结果的代码/录屏场景具有可验证来源，未采集素材不得进入最终阶段；
- MP4 可由 ffprobe 读取；
- 分辨率、帧率、时长与音频正常；AAC最终明确重采样到48kHz，避免沿用上游异常采样率；
- `source_span` 使用包含 `source/start_char/end_char/excerpt` 的结构化对象，不能是纯字符串；
- 字幕不撞人物和 UI；
- 峰峰身份一致且不常驻；
- 真实录屏与主张匹配；
- 没有连续三场相同 PPT 节奏；
- 用户可获得最终 MP4 与项目文件。

## 可选生成后端：Coze CLI 或 TokenDance H3（耗积分/余额）

默认渲染路径是 HTML/GSAP/HyperFrames + FFmpeg。当用户明确要求“用扣子/Coze 生成视频”“耗扣子积分”，或某类镜头是写实/影像化素材（实景、产品演示、电影感画面、真人 IP 动作镜头）时，可将**画面生成**切换到 **Coze CLI**（模型 `doubao-seedance-1-5-pro`，CLI 固定无 --model 参数，按积分计费）。

切换规则：

- 保留本项目全部前期流程（剧本、storyboard.json、BEAT_MAP、配音与字幕），只把“画面渲染”换成 Coze。
- 每个需要 Coze 的 scene 转成一条自包含视频提示词（视觉 + 运镜 + 风格；精确中文/UI/图表/录屏**不要**交给 Coze，仍走代码渲染或真实录屏；峰峰动作镜头按 `feng-ip` canon 描述人物外观）。
- 混合模式：部分场景 Coze 生成、部分场景代码渲染，最终统一按 `BEAT_MAP.json` 时间线拼接。
- 批量生成走共享脚本（先 `--dry-run` 预检，不耗积分）：

```bash
bash ~/.hermes/skills/creative/coze-media-generation/scripts/generate_clips.sh \
  prompts.txt renders/coze_clips --ratio 16:9 --duration 10 --resolution 720p --dry-run
# 确认后去掉 --dry-run 正式生成（耗积分）
```

- `prompts.txt` 每行一条提示词，顺序对应 storyboard 场景；图生视频用 `<prompt>\t<image_url>`。
- 生成后仍按本项目流程：ffmpeg concat 拼接（参数一致时 `-c copy`，AAC 显式 48kHz），叠 `audio/voiceover.wav` 与字幕，validator + ffprobe 验收。
- 积分提醒：seedance 1.5-pro 720p 约每 5 秒 1 次生成；视频 URL 24h 有效，及时下载。
- 失败的补救：单个 clip failed → 修提示词重跑；多 clip 音色/风格不一致 → 外部 VO 覆盖（本项目已有统一配音层，天然解决）。

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


## Copyright / Imitation Boundary

允许复用：

- 高密度旁白；
- 白底信息动画与深色录屏交替；
- 章节卡、底部字幕、对象级动效；
- 少量人物剧情节点；
- 结论—原理—过程—证据—评价结构。

禁止复制：

- 原作者人物、插画、Logo、水印、逐句文案；
- 独特物件造型、逐帧布局和一一对应镜头；
- 原视频生成资产或画面截图进入新成片。

每份新文稿必须重新选择隐喻物件、动作链和证据画面。

## Common Pitfalls

1. **只换角色，不换叙事资产**：这是逐帧翻拍。必须重新设计隐喻和构图。
2. **峰峰常驻角落**：人物变贴纸。只放关键剧情节点。
3. **纯信息图无证据**：技术实测没有真实录屏就缺乏可信度。
4. **纯录屏无解释**：画面难读。用白底动画先解释，再回录屏证明。
5. **字幕太长**：按语义切成 8–18 字块，不照搬整句旁白。
6. **小代码不可读**：裁切并局部高亮，一次只展示一个主张。
7. **整片像 PPT**：重要动词必须触发对象级状态变化。
8. **伪造测试数据**：缺素材时写入待采集清单，不能编造结果。
9. **照搬参考配色和角色**：只借形式语法；峰峰视觉以 `feng-ip` 为准。
10. **先做动画后定音频**：必须从最终旁白/SRT反推节拍。
11. **白底人物遮住机器**：JPEG白底会覆盖HTML物件；只移除与画布边缘连通的近白背景，保留白hoodie。
12. **一条SRT塞完整句**：保留原始SRT，另按语义和字符比例生成短显示字幕，并随音轨延迟整体平移；短片结论字幕至少保留1秒，不能把最后一个语义块压到片尾几百毫秒。
13. **操作镜头只验一张静态帧**：静态接触通过不代表连续动作成立。必须先选择与动作匹配的 `motion_strategy`，再检查预备、首次接触、操纵25%/50%/75%、释放和结果联系表。单张静态PNG禁止承担转动、推拉、搬运、行走或递接；简单按钮按压只能在人物与按钮共享接触锚点并同步微动时使用。
14. **AAC采样率随上游漂移**：封装时显式 `aresample=48000` 和 `-ar 48000`，再用ffprobe确认。
15. **短样片总时长语速误报**：结尾停留会拉低按总时长计算的字符/分钟；同时报告实际旁白时长和结尾停留，不为消除警告而破坏可读性。
16. **人物与机器像两层贴图**：如果手要抓、推、按或转，改用完整整合场景生成；人物PNG叠加仅用于不需要精确接触的观察/反应镜头。
17. **人物在“操作”但手悬空**：逐手写明接触对象、手指包裹和物件进入状态；不能用指向或捏空气冒充握柄。
18. **人物过大遮住流程**：将人物限制为画面宽度约12–20%，主机器、输入槽和输出路径必须完整可读。
19. **把Edge预置音色当本人克隆**：Edge只作为免费基线和回退；定制音色必须有Voice Profile与真实 `voice_id`。
20. **先上传录音再补授权**：任何云端上传前确认声音主体、供应商、用途、渠道和删除策略。
21. **把原始录音打进项目包**：原始/清理样本、speaker embedding、授权原件和凭据只能留在私有目录。
22. **模仿未授权真人**：改用供应商预置、原创虚构声音或获得书面授权的演员/品牌声音。
23. **供应商输出直接进时间线**：先做发音、响度、削波和时间戳QA，再更新 `BEAT_MAP.json`。
24. **用户取消克隆后仍继续处理样本**：立即停止上传和克隆任务，样本不复用；询问删除或仅本地保留，再切换到预置音色流程。
25. **不同音量的试听直接比较**：更响会被误判为更好；候选必须同文案、同语速并统一LUFS和True Peak后再交付。
26. **把预置男声写成本人声音**：Voice Profile必须使用 `provider_preset`，并保留完整供应商Voice ID。
27. **把Voice ID写死在视频代码中**：所有场景只消费最终音频和字幕；音色选择必须经过 `VOICE_PROFILE.json` 与注册表。
28. **新增音色时复制生成流程**：同供应商只增加Profile；新供应商只增加Adapter并复用统一标准化、字幕与QA层。

10秒端到端样片的完整复现与门禁见 `references/ten-second-smoke-test.md`；新项目的文稿场景预算、视觉谓词、证据阶梯和15秒四场验收模式见 `references/manuscript-to-video-algorithm.md`。

## Verification Checklist

- [ ] 原文与最终口播均存在
- [ ] 七段叙事或有理由的等价结构成立
- [ ] 前 5–12 秒有反常识 Hook
- [ ] 真实证据与观点一一对应
- [ ] 白底动画/录屏比例适配文稿
- [ ] 章节卡建立清晰目录
- [ ] 峰峰只在 15–25% 场景出现并承担动作
- [ ] 峰峰素材由 `feng-ip` 生成或引用已验收资产
- [ ] 操作型人物镜头优先整帧生成；观察/反应型镜头才允许透明人物叠加
- [ ] 每个峰峰场景均声明通用 `interaction_mode`、完整 `interaction_contract`、`motion_strategy` 与连续五阶段 `action_phases`
- [ ] `static-overlay` 只用于无接触手势；`anchored-micro-motion` 只用于简单表面接触；强交互使用绑定动画、≥3姿势序列、整帧场景或连续视频
- [ ] 人物动作顺序联系表覆盖预备、首次接触、操纵25%/50%/75%、释放和结果，接触在整个操纵阶段持续成立
- [ ] 新规则已跨无接触、表面接触、强交互三类动作验证；用户认可图仅作为质量校准，不作为构图模板
- [ ] 接触、受力、承重、步态或视线关系与当前动作匹配，对象响应和结果状态可见
- [ ] 人物通常占画面宽度12–20%，不遮挡动作目标、接触点、运动路径和结果
- [ ] 人物、对象与环境共享线条、光影、透视、接地和空间层级，无白色矩形、硬裁切、漂浮、穿模或贴图感
- [ ] 动作前→人物动作→对象响应→结果状态形成连续因果链；移除峰峰后核心动作链会断裂
- [ ] 中文、数据、UI均代码渲染
- [ ] 字幕每块 8–18 字、最多两行；短片最后一个结论字幕停留至少1秒
- [ ] 操作型人物镜头已检查动作中段Hero Frame，手—对象接触点、遮挡和对象响应同时成立
- [ ] 视觉语义切换中位约 4–7 秒
- [ ] 连续三场不重复同一模板和动效
- [ ] Voice Profile声明Provider、音色、语言、速度、授权类型、输出规格和Edge回退
- [ ] 默认Profile为 `feng-yunxi`，解析结果严格对应Edge `zh-CN-YunxiNeural`、速度1.08和 `provider_preset`
- [ ] 新音色通过 `VOICE_PRESETS.json` 注册；新供应商通过独立Adapter接入，视频主流程未写死Voice ID
- [ ] `generate_voice.py`已生成48kHz WAV、MP3、字幕、voice-qa和pronunciation-log
- [ ] 用户取消克隆时已停止样本上传与复用，并确认私有样本删除或保留策略
- [ ] 预置音色候选使用同文案、同语速、同采样率和同LUFS试听；未把音量差异当作音色优势
- [ ] 选定预置音色标记为 `provider_preset`，没有描述为本人克隆声音
- [ ] 本人或授权真人音色在云端上传前完成授权确认，未经许可的真实人物声音未进入流程
- [ ] 原始样本、speaker embedding、授权原件和凭据未进入Skill、Git、同步知识库或项目导出
- [ ] 旁白WAV/MP3、SRT/VTT、voice-qa、pronunciation-log与BEAT_MAP同步
- [ ] 克隆音色与Edge基线完成30秒A/B试听，并由声音主体确认
- [ ] 草稿 MP4、联系表与 REVIEW_REPORT 存在
- [ ] validator 与 ffprobe 通过
