# gzh-video 讲解员比例选择器（2026-08-31 落地，commit 89a989b）

给「公众号视频」（gzh-video）动作加右下角 Feng 讲解员**比例可选项**，并做到**每次生成前询问**用户。

## 用户偏好（已确认，必须遵守）
- 讲解员**默认全身**（不用半身/3-4身）。
- **每次生成视频前询问**全身 vs 半身。
- canon `01_wave` 是**半身**（脚不可见），**不能当全身讲解员**——全身须文生图生成（方法见 `broll-hyperframes/references/cowrite-video-feng-presenter.md`）。

## 引擎侧：cowrite-video.py 已支持 `--feng-mode`
`~/.hermes/scripts/cowrite-video.py`：
- `--feng <透明PNG>`：贴讲解员；不传则无讲解员。
- `--feng-mode full|half`：`full`=窄高全身图按高度控制尺寸（`target_h=max(380,H*0.27)`，`fw=min(target_h/aspect, W*0.28)`）；`half`=裁切 alpha bbox 上部 **55%** 成半身/3-4身，方图按宽度控制（`fw=min(W*0.26,300)`）。
- 画布必须 **RGBA**（`Image.new("RGBA",...)`），否则 paste 透明讲解员会变成白方块。
- 尺寸自适应用 `aspect = f.height/max(1,f.width)` 判断：>1.15 走窄高（全身）分支，否则走方/半身分支。

## 前端：CommandBar 讲解员比例弹窗
照搬 publish-sticker 的 account 弹窗模式（`src/CommandBar.tsx`）：
- 新增 state：`fengChoice`（`{action, requirements}|null`）、`fengMode`（`'full'|'half'|'none'`，初值 `'full'`）。
- `submit()` 在 `topic-collect`/`gzh-video` 分支后加：
  ```ts
  if (chosen === 'gzh-video' && !(req ?? '').includes('讲解员比例')) {
    setFengChoice({ action: chosen, requirements: req }); setFengMode('full'); return
  }
  ```
- `confirmFeng()`：按 `fengMode` 拼 suffix `讲解员比例：全身|半身|无`，`join('；')` 进 requirements，再 `doSubmit`。
- 弹窗 JSX 复用 `.sticker-account-modal`/`.sticker-account-option`（3 个 option：全身/full、半身-3-4身/half、无讲解员/none）+ `.modal-actions`。

## Worker/动作侧：gzh-video prompt 解析
`server/actionConfig.ts` DEFAULT 动作 + **生产 action-config.json 都要 merge**。prompt 加：
> 第二步生成：解析 requirements 里的「讲解员比例：全身/半身/无」（未写默认全身）：全身 → 命令加 `--feng-mode full`；半身 → `--feng-mode half`；无 → 去掉 `--feng ...` 段不贴讲解员。运行 `... cowrite-video.py --title ... --feng .../feng-guide.png --feng-mode <full|half> -o .../gzh-video.mp4`（按所选比例：full=全身 / half=半身3-4身 / 无=不贴；透明底贴右下角、小比例、不遮字幕/进度/关键文本、带柔和投影）。

Worker PROMPT（`deploy/scripts/cowrite-hermes-worker.py`）无需单独改——Worker 读 action-config 的 gzh-video prompt 执行。

### 生产 merge 注意
- 用 API：GET `/api/session` 取 token → GET `/api/action-config` → 对 `gzh-video` 的 `prompts[0].text` 做**子串替换**（旧命令 `--feng .../feng-guide.png -o .../gzh-video.mp4` → `--feng .../feng-guide.png --feng-mode <full|half> -o ...`；旧说明「右下角全身小比例 Feng 讲解员…」→「右下角 Feng 讲解员（按所选比例…）」；在「第二步生成：」后插入解析规则）→ PUT `{version, actions}`（无 config 包装）→ 读回断言含「讲解员比例」与 `--feng-mode`。

## 验收（CDP 实测通过）
1. 前端：命令栏输入「公众号视频」→ 点「✦交给 Hermes」→ 弹窗标题「选择讲解员比例」+ 3 选项 + 「确认生成」；点「半身」→ `.sticker-account-option.on`；确认 → 弹窗关闭 → 任务 requirements=「公众号视频；讲解员比例：半身」。
2. Worker 端到端：requirements 带「讲解员比例：半身」→ 生成半身讲解员视频。ffprobe 1080×1920/50.1s + 抽帧 vision 确认半身（无脚、比全身版更大更聚焦上半身、透明融入、不遮字幕/进度/标题）。产物示例 `/root/.cowrite/assets/gzh-video-judgment-half-*.mp4`，写回页面 revision 2→3。

## 踩坑：给 submit() 加新拦截分支别覆盖既有分支
`CommandBar.submit()` 是 publish-sticker → wechat-sticker → topic-collect → gzh-video 的链式拦截。一次 patch 误把 `if (chosen === 'topic-collect') { void openTopicChoice(req); return }` **整段替换**成 gzh-video 分支 → `openTopicChoice` 失去调用者 → LSP 报 **TS6133 `'openTopicChoice' is declared but its value is never read`**，且 topic-collect 渠道弹窗功能**静默丢失**。
- **教训**：新增拦截分支要**append 在既有分支之后**，不要替换既有分支；改完跑 `tsc` 看是否出现 *declared but never read*（TS6133）——那通常说明你把某函数/状态孤弃了。
- 修复 = 恢复 topic-collect 分支 + gzh-video 分支加在其后（两条 `if` 并存）。
