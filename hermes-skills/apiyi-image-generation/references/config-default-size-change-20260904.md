---
title: Config default size change 2026-09-04
created: 2026-09-04
updated: 2026-09-04
type: session-note
tags: [apiyi, config, size, gpt-image-2-vip]
---

# apiyi-image-generation: Config Default Size Change (2026-09-04)

## Summary

Fixed incorrect default `image_gen.apiyi.size` from portrait `1536x2048` to landscape `2048x1152` in `config.yaml`.

## Root Cause

The default config value `1536x2048` caused `gpt-image-2-vip` to output vertical images by default, breaking article cover and body image requirements (16:9 landscape).

## Fix Applied

```bash
hermes config set image_gen.apiyi.size "2048x1152"
```

## Verification

Post-fix test confirmed correct output:
- Command: `apiyi_image.py --model gpt-image-2-vip --prompt "test" --aspect-ratio landscape --output /tmp/test.jpg`
- Result: `2048×1152` (aspect ratio 1.78, 16:9 landscape) ✅

## Current Config State

```yaml
# config.yaml
image_gen:
  provider: apiyi
  model: gpt-image-2-vip
  apiyi:
    size: 2048x1152   # 16:9 landscape (article cover+body default)
```

## Size Presets Reference

| Preset | Command | Use Case |
|--------|---------|----------|
| 16:9 landscape | `hermes config set image_gen.apiyi.size "2048x1152"` | Article covers, body images |
| 2.35:1 cinematic | `hermes config set image_gen.apiyi.size "2752x1152"` | Article cover alternate |
| 3:4 portrait | `hermes config set image_gen.apiyi.size "1080x1440"` | Stickers, vertical content |
| auto (square) | `hermes config set image_gen.apiyi.size "auto"` | Reset to 1024×1024 |

## Session Evidence

End-to-end test run on 2026-09-05 validated the fix:
- Article: "狗狗秋季换毛期护理指南"
- Cover: 2048×1152 ✅
- Body images: 2048×1152 ✅
- Draft published to WeChat successfully
