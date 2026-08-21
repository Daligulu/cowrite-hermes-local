# Style · Quirky Sketch（怪诞手绘）

## 一句话

怪诞手绘、隐喻叙事、留白透气，不做说明书。物件具体、有故事动线；靠线稿、大小和层次区分，不靠铺满色块。

## 画法

- **线条**：粗细不均、略有抖动、可不封口；不做光滑矢量或厚重卡通描边。
- **背景**：白色或极浅暖白；无纹理、噪点、渐变、阴影和深色背景。
- **留白**：主体占 50–75%，连续空白不少于 25%。留白不等于少画；需要时可有 4–8 个具名物件。
- **内容**：优先画原文中的具体物件；用箭头、路径、线缆、传送带、桥或角色动作连成故事动线。
- **人物**：峰峰保留个人 IP 全彩身份；只让边线略带手绘感，不改变脸、发型、服装和比例。

## 颜色纪律

- 详细规则以 `references/color-discipline.md` 为准；用户认可图 `assets/calibration/approved-color-reference.jpg` 只用于 QA 校准，不默认传给模型。
- 场景以白底黑色手绘线稿为主；近白区域目标 70–85%。
- 深海军蓝只属于峰峰的头发和夹克；机器、纸张、卡片不得使用深海军蓝填充或阴影。
- 峰峰的脸、耳朵、脖子和双手必须保留自然暖桃肤色，不得留成白色线稿脸、灰脸或蓝色阴影脸。
- 场景软蓝必须是浅粉蓝/雾蓝；故事路径默认黑色细线，只允许 1–3 个浅蓝小节点或一个小机械点。禁止实心蓝路径、宽蓝丝带和横贯画面的蓝色背景带；场景蓝面积目标不超过整图 2–3%。
- 软橙保留 1–2 处小点睛以平衡冷色；禁止橙色大物件填充和橙标签底。
- 禁止蓝色角阴影、蓝色排线、蓝色机器面板以及从人物夹克连续延伸到路径和卡片的蓝色带。
- 标签默认黑色；禁止便利贴底色、彩色下划线和红绿 diff 色块。
- 场景颜色不得染进峰峰的白 hoodie、深海军蓝夹克、头发或暖肤色。

## 审美方向

要：怪诞、有创意、简洁清爽、具体可读、有故事动线。  
不要：幼稚可爱、死板、彩虹色、商业海报、PPT 信息图、正式流程图、课程课件、精致扁平 UI、复杂科技背景。

## Prompt 风格段

```text
quirky hand-drawn editorial illustration, wobbly uneven black ink lines, expressive rough sketch, naive but intelligent visual metaphor, recognizable concrete objects connected by one clear story-flow path; clean white background covering roughly 70-85% of the image; machine, notes, and cards remain white and unfilled with black outlines; deep navy reserved only for Feng's hair and jacket; Feng's face, ears, neck, and hands retain natural warm peach skin fill; draw the story path as a thin black ink line and use only 1-3 tiny pale powder-blue nodes or one tiny mechanical accent outside the character, plus 1-2 tiny soft-orange accents; hierarchy through size and line weight, not color blocks; no solid blue path, no wide blue ribbon, no horizontal blue background band, no blue cast, no navy scene shadows, no blue card-corner shadows, no continuous blue band, no photorealism, no smooth vector, no 3D render, no PowerPoint infographic, no gradient, no dark or textured background, no colored label backgrounds, no large filled shapes
```

## 留白指令

```text
Subject group occupies 50-75% of the frame, with at least 25% continuous clean white space. Whitespace does not mean fewer meaningful objects; use size, line weight, and depth for hierarchy instead of filled color blocks.
```

## 人物风格适配

```text
Keep Feng's full-color identity exactly as defined by the attached personal-IP references. Only adapt outline quality slightly toward wobbly hand-drawn ink. Do not change his face, hair silhouette, eyebrows, eyes, white hoodie, deep navy jacket, clothing colors, or young-adult proportions. Fill his face, ears, neck, and visible hands with natural warm peach skin color; never leave them white/uncolored, gray, or blue-tinted. Scene blue/orange accents apply to objects only and must not tint the character.
```

## QA

- 白底、留白和主体占比合格。
- 场景线条明显手绘而非光滑矢量。
- 具体物件和故事动线三秒可读。
- 峰峰仍像个人素材，脸和手有自然暖肤色，人物配色未被场景色污染。
- 深海军蓝只在人物；机器、纸张和卡片白底黑线，场景浅蓝不超过 2–3%，软橙有 1–2 处。
- 运行 `scripts/check_color_balance.py`；默认正文图严格门禁不通过时先检查蓝化和暖肤色缺失。
- 不像 PPT、商业海报、科技 UI 或儿童插画。
