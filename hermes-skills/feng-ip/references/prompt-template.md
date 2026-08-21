# Prompt Template · 峰峰个人 IP 怪诞手绘

## 原则

每张图单独生成。Prompt 必须先锁人物身份，再说明新动作和新场景，最后写风格与负向约束。

## 组装顺序

```text
{REFERENCE_ROLE}
{FENG_IDENTITY}
{FENG_STYLE_ADAPT}
{COLOR_DISCIPLINE}
{MESSAGE_DESC}
{COMPOSITION_DESC}
{OBJECTS_AND_ROLES}
{STORY_FLOW}
{FENG_ACTION}
{STYLE_DNA}
{WHITESPACE_DESC}
{RATIO_DESC}
{TEXT_POLICY}
{NEGATIVE_DESC}
```

## 变量填写

### `{REFERENCE_ROLE}`

说明每张参考图的职责，不要只写“参考这些图片”。例如：

```text
Reference 1 controls Feng's working pose and body angle. Reference 2 controls face, hair silhouette, white hoodie, and deep navy jacket identity. Create a new illustration scene; do not copy either original background or paste the source image.
```

### `{FENG_IDENTITY}` / `{FENG_STYLE_ADAPT}`

从 `references/ip/feng/ip.md` 原样读取“Prompt 身份块”和“怪诞手绘适配块”。不要每次改写核心身份描述。

### `{COLOR_DISCIPLINE}`

从 `references/color-discipline.md` 原样读取“默认 Prompt 色彩块”。它必须紧跟人物身份块，不能被后面的黑色线稿风格覆盖。核心硬规则是：脸、耳朵、脖子、双手保留自然暖桃肤色；深海军蓝只用于头发和夹克；机器、纸张、卡片保持白底黑线；场景只使用极少浅粉蓝和 1–2 处软橙。

### `{MESSAGE_DESC}`

```text
Reader takeaway: <这张图必须让读者理解的一个判断>.
```

### `{COMPOSITION_DESC}`

根据 `composition-patterns.md` 选择：

- 单主体居中：`single centered subject, generous negative space`
- 对比并置：`two contrasting states side by side with one clear transition`
- 行动中人物：`Feng in mid-action, with the action carrying the meaning`
- 物件特写：`one exaggerated concrete object, Feng actively operating it`
- 环境隐喻：`Feng small within one strange but readable environment metaphor`
- 隐喻场景 mini：`minimal scene with one complete metaphor and no more than 3 main elements`
- 序列逻辑：`2-4 main nodes in a left-to-right story path; exceptions nested inside the final node`
- 信息聚焦：`one clear visual focus; supporting elements smaller and subordinate`

### `{OBJECTS_AND_ROLES}`

```text
Draw these specific objects from the source: <2-5具名物件>.
Information roles: <问题源> is the problem source; <动作入口> is the action entry; <结果物> is the result; <状态物> shows the state.
Do not replace named objects with generic lightbulbs, magnifying glasses, dashboards, or file icons.
```

### `{STORY_FLOW}`

```text
Clear story flow: <A> → <B> → <C>, connected by one readable arrow, path, cable, conveyor, bridge, or action sequence. The viewer should understand what happened within three seconds.
```

### `{FENG_ACTION}`

必须包含站位、动作、信息职责和尺寸约束：

```text
Feng stands <位置> and actively <动作>. His action is the mechanism that changes <A> into <B>; he is not a decorative presenter. Keep him at roughly 10-20% of frame width and do not let him cover the main path or future label areas.
```

封面、肖像或用户明确要求大人物时，才放宽尺寸。

### `{STYLE_DNA}`

从 `references/styles/quirky-sketch.md` 读取 Prompt 风格段。人物保留全彩个人 IP 和暖桃肤色；场景物件以白底黑色抖动线稿为主。深海军蓝不得用于场景物件；故事路径默认黑色细线，只允许少量浅粉蓝小节点或一个小机械点；保留 1–2 处软橙平衡冷色。

### `{WHITESPACE_DESC}`

```text
Subject group occupies 50-75% of the frame, with at least 25% continuous clean white space. Use size, line weight, and depth for hierarchy, not filled color blocks.
```

### `{RATIO_DESC}`

- 16:9：`aspect ratio 16:9, landscape, wide frame, not portrait, not square`
- 3:4：`aspect ratio 3:4, portrait, tall frame, not landscape`
- 1:1：`aspect ratio 1:1, square composition`
- 9:16：`aspect ratio 9:16, vertical mobile frame`

### `{TEXT_POLICY}`

准确中文默认：

```text
No text, no letters, no words, no numbers, no watermark, no logo, no empty text boxes, and no speech bubbles. Reserve quiet white space near the named objects for exact Chinese labels to be added locally later.
```

用户明确接受模型直接写字时才可让模型写 2–5 个短标签，但仍需 QA；生产用途优先本地叠字。

### `{NEGATIVE_DESC}`

合并：

1. `references/styles/quirky-sketch.md` 的“绝对不要”；
2. `references/ip/feng/ip.md` 的“负向约束”；
3. 当张内容特有禁忌。

默认补充：

```text
No PowerPoint infographic, no formal workflow chart, no dense tutorial page, no colored sticky-note labels, no gradients, no textured or dark background, no photorealism, no 3D render, no generic tech UI, no copied reference background. No white or uncolored skin, no gray face, no blue-tinted skin, no blue cast, no navy scene shadows, no blue card-corner shadows, no blue-filled machine panels, and no continuous blue band across the composition.
```

## Nano Banana 调用

Prompt 写入文件后使用：

```bash
SKILL_DIR="$HOME/.hermes/skills/creative/feng-ip"
python3 "$SKILL_DIR/scripts/generate_feng_with_nano_banana.py" \
  --model 2 \
  --prompt-file prompt.md \
  --reference-image "$SKILL_DIR/assets/reference/personal-ip/<动作参考>" \
  --reference-image "$SKILL_DIR/assets/reference/personal-ip/<身份参考>" \
  --aspect-ratio 16:9 \
  --image-size 2K \
  --out output.png
```

## 本地中文标签

生成底图后，先用视觉工具选择安全位置，再运行：

```bash
python3 "$SKILL_DIR/scripts/add_labels.py" base.png final.png --labels-json labels.json
```

标签默认黑色无底，放在物件附近的白色空区；不得遮挡脸、眉眼、发型、hoodie 上半部、箭头或核心物件。
