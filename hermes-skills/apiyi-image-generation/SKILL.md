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
   - `gpt-image-2-vip`; supports text-to-image plus single/multiple-reference image editing through multipart `/v1/images/edits`. The local Hermes ApiYi plugin and explicit CLI implement both paths and were verified with one real reference-image request on 2026-07-30. Prefer it when Chinese text/infographic quality and character references matter.
3. The profile default remains `nano-banana-2` for general-purpose speed and already-established workflows; select `gpt-image-2-vip` explicitly when its stronger Chinese rendering or reference-based editing is desired.
4. A new or adapted image Skill must call `image_generate`, or use this Skill's CLI only when it needs explicit model selection/local reference files. Do not introduce another default provider without explicit user approval.
5. Read the API key only from `APIYI_API_KEY` in the process environment or `~/.hermes/.env`. Never write keys into SKILL.md, scripts, project configs, prompts, logs, or generated artifacts.

## Native tool

- Text-to-image: call `image_generate(prompt=..., aspect_ratio=...)`.
- Image-to-image: call `image_generate(prompt=..., image_url=..., reference_image_urls=[...])`.
- Model selection is user/profile-configured, not prompt-controlled.

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

## Response and file handling

- Trust the response MIME type, not the requested filename suffix. Nano Banana may return JPEG even when the caller suggested `.png`.
- Cache Base64 results with the extension implied by MIME (`image/jpeg` → `.jpg`, `image/png` → `.png`, `image/webp` → `.webp`).
- If the user explicitly requests a different output suffix, convert with Pillow instead of byte-copying data under the wrong extension.
- Verify the final artifact by opening it with Pillow and checking format, dimensions, and nonzero size; a successful HTTP response alone is not completion.
- For live provider validation, use one minimal request per approved model and one Nano Banana reference-image request. Do not automatically retry paid generation calls.

## Verification

Use `references/provider-validation.md` for the minimal live-test matrix, provider response shapes, MIME checks, and paid-call safety gate.

- `hermes config check` passes.
- `python3 scripts/apiyi_image.py --check` reports the selected provider and key presence without revealing the key.
- Before claiming a model works, make one real minimal request and verify the returned file is a valid non-empty image.
