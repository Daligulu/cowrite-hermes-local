# 微信贴图生图：T2I portrait ≠ 3:4 的强制后处理

## 背景
`image_generate(aspect_ratio:"portrait")`（当前后端 ApiYi，model_alias=nano-banana-2，response_kind=gemini_inline_data）实际输出是 **9:16**，不是 WeChat 贴图要求的 **3:4**。

实测：输出 `1536 × 2752`，ratio = 0.558（≈9:16）。直接 publish 会被 `wechat-sticker-publisher` 判定不合格。

## 强制 3:4 后处理（PIL）
```python
from PIL import Image
im = Image.open(src).convert("RGB")
w, h = im.size            # 例如 1536×2752 = 9:16
new_h = int(w * 4 / 3)    # 保持宽度，裁出 3:4 窗口高
top = (h - new_h) // 2    # 居中裁切（裁掉上下，保留主体）
im = im.crop((0, top, w, top + new_h))       # -> 1536×2048 (3:4)
im = im.resize((1080, 1440), Image.LANCZOS)  # 缩到标准 1080×1440
im.save(out, "JPEG", quality=92)
```

## 发布前校验（缺一不可）
1. 比例：`round(w/h, 3) == 0.75`（1080×1440 = 0.75）
2. 资产可访问，本地 + 公网双端：
```bash
curl -sI "http://127.0.0.1:4320/assets/<hash>.jpg" | head -6
curl -sI "http://107.150.109.152/cowrite-<子路径>/assets/<hash>.jpg" | head -6
# 期望 HTTP 200 + image/jpeg（非 text/html，非 404）
```
3. 文案字数：`len(re.sub(r'\s','',text))` 落在 280–320。

## 其它注意
- 显示器近景时，生成模型可能在底座带 **iMac 苹果 logo** 或真实品牌摆件——属场景级、非主体，不当作「无真实 logo」红线的硬性违规，但交付时向用户提一句。
- 主视觉提示词建议已包含：无文字、无 logo、无人物面部特写、留 10% 上下安全区。生成后可用 vision_analyze 复核这四点。
