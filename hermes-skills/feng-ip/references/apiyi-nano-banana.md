# ApiYi Nano Banana 图生图适配

## 已验证接口

- API Base：`https://api.apiyi.com/v1beta/models`
- Nano Banana 2：`gemini-3.1-flash-image-preview`
- Nano Banana Pro：`gemini-3-pro-image-preview`
- 方法：`POST /{model}:generateContent`
- 鉴权：`Authorization: Bearer $APIYI_API_KEY`
- 密钥只从环境或 `~/.hermes/.env` 读取；不得打印、写入 Prompt 或提交到仓库。

## 请求结构

`contents[0].parts` 的第一项放文本 Prompt，之后每张本地参考图各放一个 `inlineData`：

```json
{
  "contents": [{
    "parts": [
      {"text": "<prompt>"},
      {"inlineData": {"mimeType": "image/png", "data": "<base64>"}}
    ]
  }],
  "generationConfig": {
    "responseModalities": ["IMAGE"],
    "imageConfig": {"aspectRatio": "16:9", "imageSize": "2K"}
  }
}
```

响应图片位于 `candidates[].content.parts[].inlineData`。按返回的 MIME 类型确定 `.png`、`.jpg` 或 `.webp` 后缀，不要假定服务一定返回 PNG。

## 参考图策略

- 默认 1–2 张，不堆叠更多。
- 第一张负责最接近目标场景的动作与身体角度。
- 第二张负责正脸、发型、眉眼、白 hoodie 和深海军蓝夹克身份。
- Prompt 开头必须逐张说明职责。
- 明确要求生成全新场景，不复制原背景、不贴原 PNG、不输出 contact sheet。
- 本地图片只在 HTTPS 请求体中编码成 Base64，不创建公网临时链接。

## 分级路由

- 构图、姿势、工作流测试：Nano Banana 2，1K/2K。
- 正文正式图：Nano Banana 2，2K。
- 人脸或服装仍漂移、用户要求高精定稿：Nano Banana Pro，2K/4K。
- 不得在没有参考图的情况下把纯文生图结果声称为“人物一致性图生图”。

## 真实验证基线

使用 `03_working.png` + `07_crossed.png`，Nano Banana 2、16:9、1K，接口返回：

- `ok: true`
- `mode: image-to-image`
- `reference_count: 2`
- 输出为 JPEG，尺寸 1376×768

视觉结果保留了深蓝黑短发、英气眉、温和深色眼睛、白 hoodie 双抽绳、深海军蓝夹克和无眼镜设定；人物可以一手投料、一手摇柄，承担信息动作。该结果说明“双参考职责拆分 + 身份块置前 + 新场景禁止项”是可复用基线，而不是要求未来复刻本次构图。

## 精确中文

不要让模型承担生产级中文。先生成无字底图，再用 `scripts/add_labels.py` 叠字：

1. 用视觉检查确定空白安全区。
2. 标签 JSON 使用 2–5 个短简体中文词。
3. 不遮挡脸、发型、眉眼、手部、核心物件和主路径。
4. 逐字比对最终图与 JSON，并检查乱码、裁切、重叠。

## 验证顺序

1. 脚本语法检查与 `--help`。
2. 参考素材文件数和 SHA-256 一致性。
3. 用 1K、1–2 张参考图做低成本真实调用。
4. 确认返回 `image-to-image` 且参考图数量正确。
5. Pillow 检查输出可打开、尺寸和 MIME 正常。
6. 视觉 QA 检查人物、动作、风格、禁忌和文字。
7. 最后才增加本地中文标签。

## 常见失败处理

- HTTP 错误：只报告状态码和截断错误摘要，不泄露密钥或 Base64。
- 没有图片 part：报告真实响应结构异常，不写伪造输出。
- 人物漂移：增加第二张身份参考并把稳定身份块放到 Prompt 最前。
- 复制原背景：强化“reference controls identity/pose only; generate a completely new scene”。
- 输出后缀变化：信任响应 MIME，允许脚本规范化后缀。
- 余额或模型权限不足：这是账户配置问题；提示检查 ApiYi 余额/权限，不固化为模型不可用结论。
