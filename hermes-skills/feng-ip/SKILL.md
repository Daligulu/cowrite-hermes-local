---
name: feng-ip
description: >
  Use when the user asks for 峰峰个人IP、峰峰形象、峰峰动漫小人、个人品牌正文配图、文章插图、工作流图、观点图、封面或多图系列。Combines the gimi-illustration quirky-sketch workflow, 21 private personal-IP reference assets, 14 composition calibration examples, ApiYi Nano Banana image-to-image generation, exact local Chinese labels, and an optional Agnes fallback. Do not use for generic no-character illustration.
version: 4.0.4
author: Hermes Agent for 峰峰; workflow derived from GiMi-Xiaomi/gimi-illustration-skill
license: MIT for workflow and scripts; personal-IP assets are private user assets
platforms: [linux]
metadata:
  hermes:
    tags: [feng, personal-ip, article-illustration, quirky-sketch, nano-banana, image-to-image]
    category: creative
    related_skills: [gimi-illustration, personal-ip-generator]
---

# 峰峰个人 IP · 怪诞手绘正文配图

## 定位

把中文文章里的判断、流程、结构、状态和隐喻，转成带有峰峰个人 IP 形象的怪诞手绘配图。构图协议继承 `gimi-illustration`：具体物件、故事动线、白底留白、抖动线稿、少量软蓝/软橙；角色层固定为峰峰个人 IP，并通过 ApiYi Nano Banana 图生图锁定人物一致性。

本 Skill 的优先级：

1. 人物身份以 `references/ip/feng/ip.md` 和 `assets/reference/personal-ip/` 为最高事实来源。
2. 构图与内容表达以 `references/composition-patterns.md`、`references/shot-config.md` 为准。
3. 风格以 `references/styles/quirky-sketch.md` 为准。
4. 生图与中文标签以本文件和 `references/prompt-template.md` 为准。
5. `assets/examples/` 的 14 张历史图只用于校准信息密度、留白和怪诞隐喻；不得复刻旧构图、旧角色或旧文字。

完整合并清单见 `references/merged-capabilities.md`。不要从已淘汰的旧角色规则或其他人物 Skill 继承设定；本 Skill 是峰峰个人 IP 的唯一生图工作流。不要默认添加狗、黄蓝运动服、球队元素、篮球、科技网格、霓虹或素材中没有的配饰。

## 触发与分流

使用本 Skill：

- “用峰峰个人 IP 配图”“用我的动漫形象配图”
- “峰峰动漫小人正文配图 / 封面 / 工作流图 / 观点图”
- 要求角色像 `/root/Documents/Obsidian Vault/30-Assets/PersonalBrand/峰峰IP-Canon/` 中的形象

不要使用：

- 普通无角色文章配图 → `gimi-illustration` 的 `none` 模式或 `baoyu-article-illustrator`
- 新建完整个人品牌视觉系统 → `personal-ip-generator`
- 用户明确指定其他人物或品牌 IP

## 固定变量

- `$STYLE=quirky-sketch`
- `$IP=feng`
- `$RATIO=16:9`，小红书竖版可用 `3:4`，用户指定优先
- `$COUNT=自动推断`
- 默认生图模型：Nano Banana 2，`2K`
- 最终定稿：Nano Banana Pro，`2K` 或 `4K`
- 默认不让模型直接生成中文；中文由本地脚本叠加

## 生图能力与配置

接口结构、双参考职责、真实验证基线和故障处理详见 `references/apiyi-nano-banana.md`；涉及 ApiYi/Nano Banana 调用时先读该文件。生成九宫格、切图、透明贴纸或飞书逐图交付时，另读 `references/transparent-sticker-deliverables.md`。

主脚本：

```bash
SKILL_DIR="$HOME/.hermes/skills/creative/feng-ip"
python3 "$SKILL_DIR/scripts/generate_feng_with_nano_banana.py" --help
```

模型路由：

- Nano Banana 2：`gemini-3.1-flash-image-preview`，参数 `--model 2`
- Nano Banana Pro：`gemini-3-pro-image-preview`，参数 `--model pro`
- 接口：`https://api.apiyi.com/v1beta/models/{model}:generateContent`
- 密钥：`APIYI_API_KEY`，只从环境或 `~/.hermes/.env` 读取，不得打印、写入 Prompt 或保存到 Skill

参考图以 Base64 `inlineData` 放入 HTTPS 请求体，不创建公网链接。每次使用 1–2 张：第一张选择最接近目标动作的素材；第二张仅用于补身份、正脸或服装约束。不得默认堆叠更多参考图。

**应急回退：** 只有 Nano Banana 不可用且用户明确允许时，才加载 `references/agnes-fallback.md` 并调用 `scripts/generate_feng_with_agnes.py`。Agnes 结果不得冒充 Nano Banana 人物一致性定稿。

## 多图系列一致性（同一文章/同一批配图强制）

同一篇文章或同一批次的 2+ 张峰峰配图，必须执行以下锚定协议（2026-08-20 用户确认）：

1. **固定身份锚点图**：整批使用同一张身份锚点图作为每张图的第二参考。默认锚点 `assets/reference/personal-ip/07_crossed.png`；已在本批内生成过任意一张成功图时，把「身份锚点图 + 最近一张成功图」作为参考（接力锚定）。
2. **身份描述块常量**：从 `references/ip/feng/ip.md` 抽取的身份描述块（深蓝黑短发、自然英气眉、温和深色眼神、白 hoodie 双抽绳、深海军蓝夹克、无眼镜、暖桃肤色）在同一批所有 Prompt 中**逐字复用**，不得按场景改写。
3. **默认模型**：多图系列（2+ 张）**默认 `gpt-image-2-vip`**（2026-08-20 A/B 实测：批内一致性 7.0–8.5 显著优于 Nano Banana 2 的 3.0–7.0，角色参考锁身份更强）。单图快速迭代/构图测试仍用 Nano Banana 2；用户明确指定时以用户为准。
4. **禁止行为**：不得为每张图重新描述人物（等于重新掷骰子）；不得把动作参考图当成身份参考图。
5. **一致性门禁**：批内图生成后必须运行 `scripts/check_character_consistency.py` 对「锚点图 vs 每张成图」做一致性评分，低于阈值（默认 7/10）时收紧 Prompt 重生成（最多 2 次）。具体见该脚本 README 注释。

### Step 1 · 消化内容

读取文章、段落、链接、Markdown、截图或主题，提炼：

- 这一张图最想让读者记住的一个判断；
- 信息类型：结果、对比、路径、状态、风险、选择、转折或承接；
- 2–5 个原文中可画的具体名词；
- 峰峰在图里必须执行的核心动作；
- 2–5 个必要短标签。

不要平均配图。短文通常 1–3 张，普通长文 3–6 张；非用户明确要求，不超过 9 张。

完成标准：每张图只承担一个核心信息，物件和人物动作都能对应原文。

### Step 2 · Shot Config

加载：

- `references/composition-patterns.md`
- `references/shot-config.md`
- `references/ip/feng/ip.md`

按“二轴分析 → 创意生成法六步 → 构图 → Shot Config”执行。Shot Config 必须写清：

- 放置位置和锚定句；
- 核心信息、结构轴和构图；
- 具体物件与信息分工；
- A→B→C 故事动线；
- 峰峰的站位、动作和作用；
- 参考图选择及每张参考图解决的约束；
- 中文标签内容。

默认直接进入生成；用户说“先看策略”时才先展示并等待确认。

完成标准：移除峰峰后，核心动作链应明显缺少执行者；峰峰不能只是角落装饰。

### Step 3 · 选择参考图

先读 `references/ip/feng/ip.md` 的参考图选择表。常用选择：

- 工作、电脑、分拣、流程操作：`03_working.png`
- 观点、讲解、判断：`07_crossed.png` 或 `01_wave.png`
- 思考、诊断、复盘：`06_thinking.png`
- 阅读、学习：`08_reading.png`
- 成果、认可：`02_thumbsup.png` 或 `09_celebrate.png`
- 生活方式：选对应的 `*_coffee`、`*_travel`、`*_beach`、`*_camera` 等原始素材

不得把九宫格 contact sheet 直接作为最终拼贴。需要时可把 contact sheet 作为第二参考，但 Prompt 必须要求生成单一新场景。

完成标准：参考动作和目标场景匹配；身份参考能看清头发、眉眼、白 hoodie 和深海军蓝夹克。

### Step 4 · 组装 Prompt

加载：

- `references/styles/quirky-sketch.md`
- `references/color-discipline.md`
- `references/prompt-template.md`
- `references/ip/feng/ip.md`

Prompt 顺序固定：

1. 参考图职责与人物身份锁定
2. 峰峰身份锚点（脸、耳朵、脖子、双手强制暖桃肤色）
3. 用户认可的配色纪律（深海军蓝只属于人物；场景白底黑线；极少浅粉蓝与软橙）
4. 核心动作和故事动线
5. 具体物件与信息分工
6. 怪诞手绘风格与留白
7. 比例和输出规格
8. 文字策略
9. 负向约束

必须明确：生成新的完整场景，不把原 PNG 贴入画面，不复制原背景或九宫格布局。

需要准确中文时，模型只生成无文字底图：

`no text, no letters, no words, no watermark, no empty text boxes; reserve quiet white space near the named objects for later labels`

完成标准：Prompt 能区分“身份必须保留”“场景新生成”“禁止出现”。

### Step 5 · Nano Banana 图生图

先把 Prompt 写入输出目录，再调用：

```bash
SKILL_DIR="$HOME/.hermes/skills/creative/feng-ip"
python3 "$SKILL_DIR/scripts/generate_feng_with_nano_banana.py" \
  --model 2 \
  --prompt-file /absolute/path/prompt.md \
  --reference-image "$SKILL_DIR/assets/reference/personal-ip/03_working.png" \
  --reference-image "$SKILL_DIR/assets/reference/personal-ip/07_crossed.png" \
  --aspect-ratio 16:9 \
  --image-size 2K \
  --out /absolute/path/01-topic.png
```

迭代图先用 `--model 2`。用户明确要求最终高精，或 Nano Banana 2 的脸、服装仍漂移时，改用：

```bash
--model pro --image-size 4K
```

**多图系列（2+ 张）默认 `gpt-image-2-vip`**（A/B 实测锁身份更强，2026-08-20 确认）。调用用 `apiyi-image-generation` 的 CLI：

```bash
python3 "$HOME/.hermes/skills/creative/apiyi-image-generation/scripts/apiyi_image.py" \
  --model gpt-image-2-vip \
  --prompt-file /absolute/path/prompt.md \
  --reference-image <身份锚点图> \
  --reference-image <动作参考图> \
  --aspect-ratio landscape \
  --output /absolute/path/01-topic.png
```

**Cowrite worker 配图（2026-08-20 起）强制走 `scripts/feng_ip_batch.py`**：worker 子会话只提供场景描述（--scenes-file），脚本固定身份锚点/身份块/模型/画幅，生成→门禁→重试全自动。个人/单图流程仍走本 skill 手动作业。

**已实测的坑（2026-08-20）：**
- gpt-image-2-vip 对部分措辞会触发内容安全拦截（HTTP 451 "blocked by the content safety policy"），重试 3 次也会拦。触发过的措辞：`hands a folder to another small robot coworker`。规避：把「robot」等换成中性表述（如 `passes a document to a colleague at the neighboring desk`）。脚本不会自动改写场景，需在源头换措辞。
- gpt-image-2-vip 的尺寸不稳定：传 `--aspect-ratio landscape` 仍可能返回 816×816 方形。方形图在公众号正文可用；若严格要求 16:9，生成后用 PIL 校验尺寸，不符则用 Nano Banana 2 重生成或接受方形。
- ApiYi 无 seed 参数，门禁重试靠模型随机性，同一 prompt 重试通常能改善。

完成标准：脚本返回 `ok: true`、`mode: image-to-image`、`reference_count >= 1`，输出文件存在且可由 Pillow 打开。

### Step 6 · 本地中文标签

底图通过人物和构图 QA 后再叠字。准备 UTF-8 `labels.json`：

```json
{"labels":[{"text":"输入","x":0.10,"y":0.18,"font_size":42,"box":false}]}
```

运行：

```bash
python3 "$SKILL_DIR/scripts/add_labels.py" base.png final.png --labels-json labels.json
```

`x`、`y` 在 0–1 时为相对坐标，大于 1 时为像素。先用视觉工具确定安全位置；标签不得遮挡脸、眉眼、头发主体、hoodie 上半部、关键物件、箭头或路径。风格默认黑色无底短标签；只有用户要求信息卡时才使用圆角框。

完成标准：逐字比对标签 JSON 与成图；无错字、乱码、裁切、重叠和多余空框。

### Step 7 · QA 与迭代

加载 `references/qa-checklist.md`，必须检查：

- 人物像峰峰个人素材；
- 峰峰承担核心动作；
- 新场景不是参考图贴片；
- 画面是怪诞手绘正文配图，不是头像写真、PPT 或商业海报；
- 白底、留白、颜色和故事动线合格；
- 中文标签准确。

透明贴纸还必须生成棋盘格 QA 总览并视觉检查；`RGBA` 模式、文件数量和“存在少量透明像素”只能作为程序门禁，不能替代对白 Hoodie、眼白、牙齿、浅色道具、残底和光晕的检查。具体流程见 `references/transparent-sticker-deliverables.md`。

默认 16:9 正文图还必须运行：

```bash
python3 "$SKILL_DIR/scripts/check_color_balance.py" base.png \
  --reference "$SKILL_DIR/assets/calibration/approved-color-reference.jpg" \
  --strict
```

若蓝色总量、深蓝、暖肤色或蓝暖比例门禁失败，结合视觉检查重生成；不得把白脸/灰脸或场景整体蓝化当成风格差异放行。

失败时保留原输出，收紧 Prompt 后重生成，最多重试 2 次。不得用原人物 PNG 覆盖生成图来伪装修复一致性。白板讲解/演示类画面若出现“人物过大 + 近白比例高于 88%”，按 `references/presenter-whiteboard-refinement.md` 做定向收敛，不要换模型或无目的重试。

完成标准：视觉检查明确通过；若仍有偏差，诚实标注并建议 Nano Banana Pro 定稿。

### Step 8 · 保存与交付

有项目上下文：保存到项目 `assets/<article-slug>-illustrations/`。

无项目上下文：

```text
$HOME/.hermes/workspace/generated/feng-ip/<article-slug>/
  shot-config.md
  prompts/01-topic.md
  labels/01-topic.json
  01-topic-base.png
  01-topic.png
```

飞书交付使用 `MEDIA:/absolute/path/to/file`。

## 常见坑

1. **人物变成泛化动漫男生**：增加第二张正脸/交叉手臂参考，把发型、眉眼、hoodie、夹克写在 Prompt 最前。
2. **参考图已传入但肤色仍漂移**：不要凭视觉猜测“可能没用参考图”。先核对脚本返回 `mode: image-to-image` 和真实 `reference_count`；参考图生效只证明模型收到了身份信息，不保证每个颜色特征都会被保留。必须在人物身份块最前明确：脸、耳朵、脖子和所有可见双手填自然暖桃肤色；禁止白色未上色皮肤、灰脸和蓝色阴影脸。生成后逐部位视觉检查。
3. **整体偏蓝**：不要只看白底面积。蓝色总量可能只略增，但暖肤色/橙色消失、深海军蓝与路径/卡片连成连续色带时，主观蓝感会显著增强。对照 `assets/calibration/approved-color-reference.jpg`，运行 `scripts/check_color_balance.py --strict`，同时检查暖肤色、蓝暖比例、场景蓝位置和连续性。
4. **人物只是装饰**：改 Shot Config，让峰峰亲自分拣、拉线、搬运、检查、按压、搭桥、守门或操作装置。
5. **人物太大**：正文解释图限制人物占画面宽度约 10–20%，核心信息仍由物件和动线承担；人物明显变大时，深蓝占比门禁需要结合视觉判断，但场景蓝和肤色门禁仍必须执行。
6. **复刻参考背景**：明确只借身份和动作，不复制咖啡馆、办公室、海滩或九宫格构图。
7. **出现狗、黄蓝运动服或科技网格**：这些不是默认 Canon，加入负向约束后重生成。
8. **模型直接写中文**：重生成无文字底图，再用 `add_labels.py`。
9. **参考图隐私**：只通过 HTTPS 请求内的 Base64 发送给 ApiYi，不建立公网链接。
10. **ApiYi 失败**：报告真实 HTTP 状态和错误摘要，不泄露密钥，不用无参考文生图冒充人物一致性结果。若供应商返回空候选、空图片或反序列化空值而请求未形成有效图片，可做一次有限重试；仍失败则停止并报告，不无限重试付费调用。
11. **透明贴纸“程序通过但肉眼失败”**：不要只检查 RGBA 或一个透明像素。先从无标签九宫格切图，再按棋盘格视觉验收；白衣触边时用边框背景色 + 轮廓/GrabCut 的自适应分割，不能靠降低亮度阈值硬抠。
12. **系统 python3（3.9）下脚本 TypeError「unsupported operand type(s) for |: 'type' and 'type'」**：`hermes_constants.py` 的 `ContextVar[str | object]` 在 Python 3.9 模块级求值失败，导致 apiyi 插件链路（apiyi_image.py / feng_ip_batch.py / check_character_consistency.py）全部报错。必须用 Hermes venv 解释器运行：`export PATH=/root/.hermes/hermes-agent/venv/bin:$PATH`（Python 3.11+）后再执行脚本；feng_ip_batch.py 内部 subprocess 调用裸 `python3`，同样依赖该 PATH 前缀。
13. **gpt-image-2-vip 场景被 HTTP 451 内容安全策略拦截**：供应商对某些人物交互场景（如“递文件夹给同事”）返回 `Your prompt was blocked by the content safety policy`，重试同 prompt 不会恢复。feng_ip_batch.py 固定模型/身份块，无法自行改措辞；如实 fail_task 上报，或由用户在 requirements 侧调整场景描述后重新排队。

## 验证清单

- [ ] `APIYI_API_KEY` 已配置但未输出
- [ ] 选择 1–2 张相关参考图
- [ ] 结果是 Nano Banana `image-to-image`
- [ ] 峰峰身份锚点与服装一致
- [ ] 人物承担核心动作
- [ ] 脸、耳朵、脖子和双手保留自然暖桃肤色，不是白色未上色皮肤
- [ ] 深海军蓝只用于人物头发和夹克；机器、纸张、卡片白底黑线
- [ ] 默认正文图通过配色像素门禁并对照用户认可基准图
- [ ] 无狗、黄蓝运动服、篮球、队徽、科技网格或未授权元素
- [ ] 构图符合 gimi-illustration 怪诞手绘协议
- [ ] 中文通过本地叠字准确呈现
- [ ] 透明贴纸已在棋盘格上复核，无残底、光晕或白 Hoodie 穿孔
- [ ] 飞书逐图发送前已预检单图 5 MB 上限；传输版不覆盖无损 PNG
- [ ] 输出文件存在、尺寸正确、视觉 QA 通过
