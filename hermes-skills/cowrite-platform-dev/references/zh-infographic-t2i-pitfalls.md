# 中文信息图/微信贴图·文生图（Text-to-Image）常见坑与最佳做法

场景：用 baoyu-infographic 或 image_generate（ApiYi / nano-banana-2）生成中文信息图 / 微信贴图（3:4 竖版）。
下列由 2026-09-03 GPT-6 Astra 信息图实测沉淀。

## 关键认知
- `image_generate`（ApiYi）竖版直出约 **1536×2752（ratio≈0.558，约 9:16）**，**不是请求的 3:4**。要 3:4 必须先直出 portrait 再居中裁剪到 1080×1440（裁法见 t2i-3x4-crop.md）。严格 3:4 需 1080×1440。
- 文生图产出的是**位图**，中文/数字易错易乱码——**不能事后用 PIL/图片编辑覆盖改正**（会糊/穿帮）。规则是「出错就重生成，或换成画面文字更少的布局」，绝不涂改位图补字。

## 高频缺陷（逐类）
1. **提示词指令字泄漏进画面**：把风格/警示指令写成内容标签的一部分，会被当作文字渲染进标题。实测 MOD-5 标题渲染出「（警示,荧光粉高亮）」。**内容标签与风格指令必须分开**——内容标签只放正文词，风格/排版指令放独立段落。
2. **英文节标记违和**：中文信息图里用 `CELL A / SPOKE A / MOD-1` 英文标记观感不一致（`MOD-1` 尚可、`CELL`/`SPOKE` 明显违和）。**中文输出用中文节标记**（如「01」「02」或「一」「二」）更统一。
3. **乱码/伪中文/缺字/重复单元格或节点**：bento-grid×craft-handmade 出现过右上空单元格 + 混入乱码「首个5tJ」；hub-spoke×corporate-memphis 出现过「结论」节点重复两次。**数据/跑分密集内容 → dense-modules × pop-laboratory 渲染最干净（实测零缺陷）**。

## 最佳实践
- 数据/跑分/价格密集 → `dense-modules` × `pop-laboratory`（坐标标签 + 数据高亮 + 警示三角，最清晰）。
- 内容标签全部用规范简体中文，数字单独强调、字号略大于正文。
- 生成后必 `vision_analyze` 校验中文可读性/乱码/重复；有缺陷改提示词**重生成**（保留坏图对比，别覆盖、别涂改）。
- 信息图交付归档：`source.md` / `analysis.md` / `structured-content.md` / `prompts/infographic.md`（提示词先落盘再生成，可复现、可换后端）+ `infographic.png`，放 `<out>/infographic/<slug>/`。
