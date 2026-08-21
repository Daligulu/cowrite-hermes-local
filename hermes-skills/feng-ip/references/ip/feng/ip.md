# IP · 峰峰个人形象

> `ref_mode: dual-preferred`  
> 气质：可靠、温和、开放、认真但不严肃的年轻男性内容创作者  
> 事实来源：`assets/reference/personal-ip/` 中的 21 张原始素材

## 参考图协议

每次 Nano Banana 图生图使用 1–2 张本地参考图：

1. 第一张负责目标动作与大致视角。
2. 第二张只在需要时补人物身份、正脸、服装或表情。
3. 参考图通过脚本编码成 HTTPS 请求内的 Base64 `inlineData`，不得创建公网链接。
4. 生成新场景；不得把原 PNG 直接贴入画面，不得复制原背景、九宫格或 contact sheet 布局。

## 稳定身份锚点

这些特征在素材中高度稳定，生成时必须保留：

1. **角色**：年轻男性日系 2D 动漫角色，无眼镜，自然年轻成人比例；不是儿童 Q 版，不是写实照片。
2. **头发**：浓密、短、深蓝黑色；自然侧分，顶部有清晰发束和轻微碎发；发梢不遮住眼睛。
3. **脸型与肤色**：略长鹅蛋脸，轮廓干净；脸、耳朵、脖子和可见双手必须填自然暖桃肤色，不能变成白色未上色皮肤、灰脸、蓝色阴影脸、过圆幼态脸或方硬脸。
4. **眉毛**：自然清晰、略有眉峰、带英气；不能极细，不能粗黑块压眼。
5. **眼睛**：温和开放的深色眼睛，清晰瞳孔与小高光；神态可靠、友好、有参与感。
6. **表情基线**：小而克制的友好微笑，认真但不严肃；动作场景可自然变化，但不要夸张表情包脸。
7. **内搭**：明亮白色 hoodie，帽子、领口和两根抽绳清楚可见。
8. **外套**：深海军蓝夹克，翻领、前襟、口袋和少量褶皱可见；不能替换成黄蓝运动服、队服或西装。
9. **画法**：清晰动漫描边、平滑色块、克制柔和阴影；进入怪诞手绘场景时，人物边线可以略有抖动，但脸、发型和服装颜色不能漂移。

## 非默认元素

以下只在部分素材或场景出现，不得自动加入：

- 相机、咖啡杯、书、电脑、背包、行李箱、哑铃、篮球；
- 海滩、机场、健身房、城市夜景、办公室、咖啡馆；
- 狗、任何宠物、球队、队徽、运动服；
- 科技网格、电路、六边形、霓虹、赛博背景；
- 眼镜、帽子、耳机、胡须、夸张配饰。

只有当前文章或用户明确要求时，才选择对应道具和背景。

## 参考图选择

| 目标 | 第一参考 | 可选第二参考 | 说明 |
|---|---|---|---|
| 工作、电脑、流程操作 | `03_working.png` | `07_crossed.png` | 第一张给动作，第二张锁正脸与服装 |
| 写作、记录、整理 | `07_desk_writing.png` | `03_working.png` | 适合桌面和笔记动作 |
| 思考、诊断、复盘 | `06_thinking.png` | `07_crossed.png` | 思考动作 + 稳定身份 |
| 观点、判断、讲解 | `07_crossed.png` | `01_wave.png` | 稳重站姿或开放引导 |
| 欢迎、开场、引导 | `01_wave.png` | `07_crossed.png` | 挥手动作 + 正脸身份 |
| 认可、成果、正反馈 | `02_thumbsup.png` | `09_celebrate.png` | 比赞或庆祝；避免过度表情包化 |
| 阅读、学习、知识整理 | `08_reading.png` | `03_reading_coffee.png` | 站姿读书或生活化阅读 |
| 摄影、内容创作 | `01_camera_photographer.png` | `07_crossed.png` | 相机只在当前内容相关时使用 |
| 旅行、出发 | `09_airport_travel.png` | `05_backpack.png` | 行李箱或背包按场景二选一 |
| 生活方式 | 对应的 `*_coffee`、`*_beach`、`*_gym`、`*_city` | `07_crossed.png` | 不复制原背景，只取动作和气质 |

`10_lifestyle-activities.jpg`、`11_daily-life-scenarios.jpg`、`12_reactions-productivity.jpg` 是动作/场景索引。需要综合动作时可作第二参考，但最终必须生成一个单一新场景，不能输出九宫格。

## Prompt 身份块

每次 Prompt 开头原样复用以下身份块，仅动作和场景随任务变化：

```text
Use the attached Feng personal-IP references as identity and pose guidance. Generate a completely new scene; do not paste, trace, or collage the original PNG, and do not copy its original background or contact-sheet layout.

Feng is a young adult male Japanese 2D anime character with no glasses: thick short deep navy-black hair with a natural side part and defined loose spikes that do not cover the eyes; a slightly long oval face; natural clear heroic eyebrows with a gentle arch; warm open dark eyes with visible pupils and small highlights; a restrained friendly smile. His face, ears, neck, and every visible hand must be filled with a natural warm peach skin tone matching the references—never white/uncolored, gray, or blue-tinted. He always wears a bright white hoodie with the hood and two drawstrings clearly visible, under a deep navy jacket with lapels, front opening, pockets, and subtle folds. Keep the same face, warm skin color, hair silhouette, navy-and-white clothing palette, and natural young-adult proportions as the references.
```

## 怪诞手绘适配块

```text
Preserve Feng's full-color identity—including warm peach skin on face, ears, neck, and hands—while adapting only the surrounding scene to quirky hand-drawn editorial sketch. The surrounding objects may be mostly white black-line sketches; Feng himself must not become uncolored line art. His outline may be slightly wobbly, but do not simplify away the skin fill, eyebrows, eyes, hoodie drawstrings, jacket lapels, pockets, or clothing colors. Feng must perform the core information-bearing action, not stand as decoration. For article explanation images, keep Feng at roughly 10-20% of the frame width unless the user explicitly requests a portrait or cover.
```

## 负向约束

```text
No glasses, no beard, no dog or pet, no yellow-blue sportswear, no team logo, no basketball unless explicitly requested, no black bean mascot, no horse hood, no Gimi character, no cyber grid, no neon circuit background, no photorealistic person, no childlike chibi body, no white or uncolored skin, no gray face, no blue-tinted skin, no pasted reference-image edges, no contact sheet, no nine-panel collage.
```

## 动作库

优先从文章语义选择：分拣、筛选、搬运、拉线、接线、汇聚、检查、记录、打开、递出、按按钮、操作旋钮、守门、搭桥、修补、称重、抽取、归档、指向、阅读、思考、复盘。

禁止为了“有角色”让峰峰站在角落比赞。动作必须承担问题源、动作入口、结果或状态中的至少一个信息职责。

## 序列图导游

路径序列中默认只出现一个峰峰：

- 站在步骤之间、机器旁或主路径侧面；
- 亲自推动故事从 A 到 B；
- 不遮挡编号圈、箭头、关键物件和中文标签区；
- 不在每个节点复制一个峰峰；
- Shot Config 必须写明站位、动作和信息职责。

## QA 失败信号

- 发型变浅蓝、纯黑平头、长发或遮眼；
- 眉毛过细、过粗压眼或完全消失；
- 眼睛变成无瞳孔小黑点、夸张星星眼或写实眼；
- 脸、耳朵、脖子或双手变成白色未上色、灰色或蓝色阴影，未保留参考图的自然暖桃肤色；
- hoodie 帽子/双抽绳消失；
- 深海军蓝夹克变成西装、运动服、黄蓝外套或科技战衣；
- 人物变成儿童 Q 版、头像写真、真人照片或无关动漫男生；
- 原参考图背景、矩形贴片边缘或九宫格被直接复制；
- 人物只是装饰，移除后画面信息仍完全成立。
