---
name: apiyi-image-generation
description: Use for any text-to-image or image-to-image task, and when adapting or creating a Skill that generates images. Makes ApiYi the default backend and limits normal routing to Nano Banana 2, Nano Banana Pro, or GPT Image 2 VIP.
version: 1.1.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [apiyi, image-generation, text-to-image, image-to-image, nano-banana, gpt-image]
    related_skills: [feng-ip, adapt-external-skill]
---

# ApiYi Image Generation

## Global policy

For every current or future Skill on this Hermes profile:

1. Use the native `image_generate` tool by default. Its profile-level backend is ApiYi, so ordinary Skills inherit the active model without storing provider code or credentials.
2. Approved default models are only:
   - `nano-banana-2` → `gemini-3.1-flash-image-preview`; supports text-to-image and image-to-image.
   - `nano-banana-pro` → `gemini-3-pro-image-preview`; supports text-to-image and image-to-image; use for approved high-detail finals.
   - `gpt-image-2-vip` → 中文渲染更强、支持参考图编辑；**狗狗文章/贴图默认模型（峰峰指定 2026-09-04）**；当中文信息图质量或角色参考需求时使用。
3. The profile default remains `gpt-image-2-vip` for dog account workflows after 2026-09-04 user decision; select `nano-banana-2` explicitly when speed/cost is preferred over Chinese rendering quality.
3. The profile default remains `nano-banana-2` for general-purpose speed and already-established workflows; select `gpt-image-2-vip` explicitly when its stronger Chinese rendering or reference-based editing is desired.
4. A new or adapted image Skill must call `image_generate`, or use this Skill's CLI only when it needs explicit model selection/local reference files. Do not introduce another default provider without explicit user approval.
5. Read the API key only from `APIYI_API_KEY` in the process environment or `~/.hermes/.env`. Never write keys into SKILL.md, scripts, project configs, prompts, logs, or generated artifacts.

## Native tool

- Text-to-image: call `image_generate(prompt=..., aspect_ratio=...)`.
- Image-to-image: call `image_generate(prompt=..., image_url=..., reference_image_urls=[...])`.
- Model selection is user/profile-configured, not prompt-controlled.

### Size control — critical distinction between models

The `image_generate` tool's `aspect_ratio` parameter (landscape/square/portrait) is **ONLY respected by Gemini models** (nano-banana-2, nano-banana-pro). For `gpt-image-2-vip` (OpenAI family), `aspect_ratio` is silently ignored and the model falls back to `auto` → 1024×1024 square.

To control gpt-image-2-vip output dimensions, use the config `size` parameter instead:

```bash
# Set exact pixel dimensions for gpt-image-2-vip
# Default (2026-09-04): 2048x1152 landscape for dog account articles
hermes config set image_gen.apiyi.size "2048x1152"   # 16:9 landscape (article cover+body) - DEFAULT
hermes config set image_gen.apiyi.size "1080x1440"   # 3:4 portrait (dog sticker)
hermes config set image_gen.apiyi.size "2752x1152"   # 2.35:1 cinematic (article cover alt)
hermes config set image_gen.apiyi.size "auto"        # reset to auto (square 1024×1024)
```

**Current default**: `2048x1152` (16:9 landscape) — set on 2026-09-04 to fix vertical output bug. See `references/config-default-size-change-20260904.md` for details.

Or via Python/CLI directly — the provider plugin reads `cfg.get("size", "auto")` and passes it as `payload["size"]` to the OpenAI-compatible endpoint.

### Size presets from ApiYi docs (gpt-image-2-vip)

| Ratio | Name | 1K Fast | 2K Recommended | 4K Detail |
|-------|------|---------|----------------|-----------|
| 1:1 | Square | 1280×1280 | 2048×2048 | 2880×2880 |
| 3:4 | Portrait | 960×1280 | **1536×2048** | 2480×3312 |
| 4:3 | Standard | 1280×960 | 2048×1536 | 3312×2480 |
| 16:9 | Wide | 1280×720 | **2048×1152** | 3840×2160 |
| 9:16 | Story | 720×1280 | 1152×2048 | 2160×3840 |
| 21:9 | Cinema | 1280×544 | 2048×864 | 3840×1632 |

Dog account workflow uses: portrait 1536×2048 (sticker) / landscape 2048×1152 (article cover+body images).

**Critical**: For article covers and body images, always pass `size="2048x1152"` or `size="2752x1152"` explicitly. Without it, the default is portrait 1536×2048.

### Direct 3:4 generation via CLI (2026-09-06 verified)

`gpt-image-2-vip` **natively supports `size=1536x2048` (3:4 portrait)** — verified to return exactly `1536×2048` (ratio 0.75, zero cropping). Use this instead of generating landscape-then-cropping:

```bash
python3 scripts/apiyi_image.py --model gpt-image-2-vip --size 1536x2048 --prompt "<prompt>" --output /out.png
```

The `apiyi_image.py --size` argument overrides `config image_gen.apiyi.size` for that single call; the config value is left untouched (so article covers can still default to landscape `2048x1152`). The underlying plugin (`plugins/image_gen/apiyi/__init__.py`) now prefers `kwargs.get("size")` over the config value when provided.

## Explicit model CLI

```bash
SKILL_DIR="$HOME/.hermes/skills/creative/apiyi-image-generation"
python3 "$SKILL_DIR/scripts/apiyi_image.py" --check
python3 "$SKILL_DIR/scripts/apiyi_image.py" \
  --model nano-banana-2 \
  --prompt "<prompt>" \
  --aspect-ratio portrait \
  --output /absolute/path/output.png
python3 "$SKILL_DIR/scripts/apiyi_image.py" \
  --model gpt-image-2-vip \
  --prompt "<edit instruction>" \
  --reference-image /absolute/path/reference.png \
  --aspect-ratio portrait \
  --output /absolute/path/final.png
```

`--reference-image` is repeatable for Nano Banana 2/Pro and GPT Image 2 VIP. GPT Image 2 VIP reference requests automatically use multipart `/v1/images/edits`; its current `size` behavior is not reliable, so the CLI expresses aspect intent through a `[16:9]`, `[1:1]`, or `[9:16]` prompt prefix instead of sending `size` on edits.

## Common Pitfalls

1. **GPT Image 2 VIP requires `size` param for dimension control, not `aspect_ratio`.** The `aspect_ratio` parameter is only respected by Gemini models (nano-banana-2, nano-banana-pro). For `gpt-image-2-vip`, `aspect_ratio` is silently ignored and falls back to auto → portrait 1536×2048. Always use `size="WxH"` to control dimensions explicitly.

2. **Default output is 1536×2048 portrait for gpt-image-2-vip.** Without explicit `size`, the model outputs portrait, not landscape. Article covers and body illustrations MUST be explicitly set to landscape dimensions (`size="2048x1152"` or `size="2752x1152"`).

3. **Always verify post-generation with Pillow.** Dimensions may not match intent. Run `python3 -c "from PIL import Image; i=Image.open('<path>'); print(i.size)"` to confirm before using the image.

4. **CLI aspect prefix for edits.** When using `--reference-image` for GPT Image 2 VIP edits, the CLI expresses aspect intent through `[16:9]`, `[1:1]`, or `[9:16]` prompt prefixes instead of `size` — the edit endpoint's size behavior is unreliable.

5. **MIME type vs filename.** Trust the response MIME type, not the requested filename suffix. Nano Banana may return JPEG even when `.png` was requested.

## Response and file handling

- Trust the response MIME type, not the requested filename suffix. Nano Banana may return JPEG even when `.png` was requested.
- Cache Base64 results with the extension implied by MIME (`image/jpeg` → `.jpg`, `image/png` → `.png`, `image/webp` → `.webp`).
- If the user explicitly requests a different output suffix, convert with Pillow instead of byte-copying data under the wrong extension.
- Verify the final artifact by opening it with Pillow and checking format, dimensions, and nonzero size; a successful HTTP response alone is not completion.
- For live provider validation, use one minimal request per approved model and one Nano Banana reference-image request. Do not automatically retry paid generation calls.

## Verification

Use `references/provider-validation.md` for the minimal live-test matrix, provider response shapes, MIME checks, and paid-call safety gate.

- `hermes config check` passes.
- `python3 scripts/apiyi_image.py --check` reports the selected provider and key presence without revealing the key.
- Before claiming a model works, make one real minimal request and verify the returned file is a valid non-empty image.
