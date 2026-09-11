# 狗狗贴图内容被裁剪 — 根因分析与治本 (2026-09-06)

## 问题

用户发现 2026-09-05/06 生成的狗狗号贴图内容被裁剪：板块标题首字被切（「换牙期不适」→「牙期不适」），标题「狗狗乱咬东西」首字「狗」左侧被切。

## 根因（证据链完整）

1. **全局 config 横版硬编码**：`config.yaml` → `image_gen.apiyi.size = "2048x1152"`（16:9 横版）。
2. **gpt-image-2-vip 忽略 aspect_ratio**：它是 OpenAI-family 模型，`aspect_ratio` 参数（landscape/square/portrait）对其无效，只认 `size` 参数。所以即使提示词写"3:4 vertical"，它仍输出横版 2048×1152（缓存今日 31 张 ApiYi 原图全部 2048×1152）。
3. **强制裁横版成竖版 → 丢 58% 宽度**：为满足 3:4，流程把 2048×1152 等比放大再 center-crop 成 1080×1440 竖条，左右各砍约 740px → 每行文本首字/末字被切。

量化证据：ear-care 贴图 left 边缘内容占比 0.170 vs right 0.082（center-crop 残留）；4 个板块标题均缺首字。

## 关键结论（重要更正）

**gpt-image-2-vip 原生支持直出 3:4**：`size=1536x2048` 实测精确返回 `1536×2048`（比例 0.75，零裁剪）。ApiYi 文档尺寸表（SKILL.md `### Size presets`）列出 3:4 Portrait 2K = `1536×2048`。

**因此不需要换 nano-banana-2**。保留 gpt-image-2-vip（中文渲染最强、用户 2026-09-04 指定的狗狗默认模型），只显式传 `size=1536x2048` 即可直出 3:4 竖版，彻底根除裁剪。

## 治本方案（已落地）

1. **`apiyi_image.py` 新增 `--size` 参数**：显式指定像素尺寸，覆盖全局 config 的 `image_gen.apiyi.size`（只影响本次调用，不污染写文封面横版）。
2. **plugin `plugins/image_gen/apiyi/__init__.py`**：gpt-image-2-vip 分支 `size = kwargs.get("size") or cfg.get("size", "auto")` 优先读显式 size。
3. **贴图 cron prompt**（jobs.json `7c7eb2ec2a6b` + `wechat-sticker-publisher/templates/cron_prompt.md` 步骤 6）：改为调用 `apiyi_image.py --model gpt-image-2-vip --size 1536x2048` 直出 3:4，并强制验证宽/高=0.75±0.02。
4. **写文 cron 不受影响**：保持全局 config `size=2048x1152`（横版封面），写文 cron 已单独验证不含 `--size 1536x2048`。
5. **SKILL.md 沉淀**：`wechat-sticker-publisher` 与 `apiyi-image-generation` 两处同步更新；新增 Pitfall #12「Landscape-then-cropped cuts title/first characters」。

## 验证记录

- `apiyi_image.py --model gpt-image-2-vip --size 1536x2048 --prompt '<中文信息图提示词>'` → 返回精确 `1536×2048`（比例 0.75）。
- 成图 vision 复核：三大板块完整、标题/底部标语齐全、零裁剪、中文无乱码。
- 全局 config 归位：`image_gen.apiyi.size = 2048x1152`（写文封面用，横版）。

## 下次若再遇"贴图内容被裁剪"

1. 先 `python3 -c "from PIL import Image; i=Image.open('<path>'); print(i.size, i.size[0]/i.size[1])"` 看实际尺寸。
2. 若为 16:9 横版（比例≈1.78）→ 根因是生成了横版，用 `--size 1536x2048` 重新生成，**禁止 center-crop**。
3. 若输出已是 3:4 但内容仍被切 → 可能是微信预览裁剪，检查上/下留白 ≥80px。
