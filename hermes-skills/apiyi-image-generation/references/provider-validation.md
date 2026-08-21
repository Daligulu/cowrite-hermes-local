# ApiYi 生图 Provider 验证基线

## 批准模型与接口

- Nano Banana 2：`gemini-3.1-flash-image-preview`，Gemini `generateContent`，文生图 + 图生图。
- Nano Banana Pro：`gemini-3-pro-image-preview`，Gemini `generateContent`，文生图 + 图生图。
- GPT Image 2 VIP：`gpt-image-2-vip`。本地 Hermes plugin/CLI 已实现 `/v1/images/generations` 文生图，以及 multipart `/v1/images/edits` 单图编辑/多图融合；2026-07-30 已用一张本地峰峰IP参考图完成一次真实付费垫图调用，响应为 `b64_json`，`modality=image`、`reference_count=1`，输出 PNG 可由 Pillow 正常验证。

## 最小真实验证矩阵

每次更换 Key、端点或插件实现后，按顺序执行且每项只提交一次：

1. Nano Banana 2 文生图：简单几何图标，无文字。
2. Nano Banana 2 图生图：以前一步输出为参考，做明显颜色/形状修改。
3. Nano Banana Pro 文生图：简单几何图标，无文字。
4. GPT Image 2 VIP 文生图：简单几何图标，无文字。
5. GPT Image 2 VIP 图生图：传一张标准 PNG/JPEG/WebP，通过 `/v1/images/edits` 做明显修改；确认 `modality=image`、`reference_count>=1` 与有效输出。默认不传 `size`，画幅意图由提示词前缀表达。

每项必须验证：provider、实际模型 ID、modality、reference count、响应类型、输出可由 Pillow 打开、尺寸非零。付费调用不自动重试。

## 响应差异

- Gemini 图像通常位于 `candidates[].content.parts[].inlineData`，并携带 `mimeType`。
- GPT Image 2 VIP 常见为 `data[0].b64_json`。
- Nano Banana 可能返回 JPEG；不得固定保存为 `.png`。
- CLI 若接收显式目标扩展名，应进行真实格式转换，而不是简单改名或字节复制。

## 安全门禁

- Key 只从环境/密钥文件读取，不进入 Prompt、项目配置、测试 fixture 或日志。
- 检查只报告 Key 是否存在，不回显内容。
- 真实测试产物放缓存/测试目录，不混入 Skill 包。
