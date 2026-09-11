# nano-banana-2 Aspect Ratio Quirk (2026-09-04)

## Symptom

When calling `image_generate` (ApiYi nano-banana-2 / gemini-3.1-flash-image-preview) with `aspect_ratio='portrait'`, the returned image is **not guaranteed** to be 3:4 vertical. The model sometimes outputs non-standard ratios (e.g. 4:5, 2:3, or near-square).

## Evidence

During the 2026-09-04 E2E verification run of the dog-sticker cron (job `7c7eb2ec2a6b`), the first generated image was rejected because it was not strictly 3:4. The agent had to regenerate once before getting a compliant 1080×1440 image. The run log explicitly states: "图片模型首次输出为非 3:4 竖版，已重新生成并保存为合规 1080×1440 贴图后发布。"

## Mitigation

Always verify dimensions after generation using PIL:

```bash
python3 -c "from PIL import Image; i=Image.open('<path>'); print(i.size)"
```

Accept only when `width / height == 0.75 ± 0.02` AND `width <= height`. Regenerate otherwise.

This check is now mandatory in:
- `wechat-sticker-publisher/SKILL.md` (Cron Workflow Rules step 3)
- Both cron prompts for dog-sticker job

## Note on `aspect_ratio` parameter

The Hermes `image_generate` tool maps `aspect_ratio='portrait'` to an aspect ratio hint sent to the backend, but **this is advisory, not enforced**. The model can and does ignore it. Always verify post-generation.
