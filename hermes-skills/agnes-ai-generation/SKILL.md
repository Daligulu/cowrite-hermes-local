---
name: agnes-ai-generation
description: >-
  Use when calling Agnes AI / Sapiens AI generation APIs for text, image, and video; generating or editing images; creating text-to-video, image-to-video, multi-image, or keyframe videos; using Agnes 2.0 Flash, Agnes Image, Agnes Video, or apihub.agnes-ai.com.
version: 0.1.0
author: Yacey
license: MIT
triggers:
  - Agnes AI
  - Sapiens AI
  - Agnes Image
  - Agnes Video
  - Agnes 2.0 Flash
  - apihub.agnes-ai.com
  - text generation
  - image generation
  - image editing
  - text-to-video
  - image-to-video
  - keyframe video
metadata:
  hermes:
    tags: [agnes, ai-generation, text-generation, image-generation, video-generation, creative]
    related_skills: [stable-diffusion-image-generation, comfyui]
---

# Agnes AI Generation

> **Hermes local install:** this skill is installed at `/root/.hermes/skills/creative/agnes-ai-generation`. Before running examples from another working directory, set and use:
>
> ```bash
> SKILL_DIR="$HOME/.hermes/skills/creative/agnes-ai-generation"
> cd "$SKILL_DIR"
> ```
>
> The helper script uses only Python standard library modules. API calls require one of `AGNES_API_KEY`, `AGNES_API_TOKEN`, or `APIHUB_AGNES_API_KEY` in the environment. Do not print or commit the key.
>
> **When ComfyUI is requested but no GPU is available**, see `references/comfyui-fallback.md` for the decision flow and Agnes AI fallback pattern.


Use this skill to call Agnes text, image, and video generation APIs through `https://apihub.agnes-ai.com`.

## Quick Start

1. Read `references/api.md` when endpoint details, parameters, or response fields are needed.
2. Use `scripts/agnes_api.py` for real API calls instead of rewriting curl by hand.
3. Require an API key in `AGNES_API_KEY`, `AGNES_API_TOKEN`, or `APIHUB_AGNES_API_KEY`. Never print the key.
4. For light live verification, run `smoke-test`; it avoids video creation by default. Add `--include-image-edit` for image-to-image, and add `--video-case <case>` explicitly for video modes. Treat the skill as fully tested only when basic text, text streaming, text tool calling, text-to-image, image-to-image, text-to-video, image-to-video, multi-image video, keyframe video, and video retrieval return successful responses.

## Commands

Text generation:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py text --prompt "Write a concise product tagline for an AI assistant."
```

Streaming text:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py text --prompt "Write a short product intro." --stream
```

Streaming output is normalized and includes aggregated `content`, `events`, `done`, and a short `raw_prefix`.

Image generation:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py image --prompt "A luminous floating city above a misty canyon at sunrise, cinematic realism" --size 1024x768
```

Image-to-image with a local file (encoded in-memory as a data URL; it is not publicly hosted):

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py image --prompt "Preserve the provided character identity while changing the scene" --image-file /absolute/path/to/reference.png --size 1024x768
```

Image-to-image with a remote URL:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py image --prompt "Turn the scene into a rainy cyberpunk night while preserving composition" --image https://example.com/input.png --size 1024x768
```

Text-to-video with polling:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py video --prompt "A cinematic shot of a cat walking on the beach at sunset" --poll
```

Image-to-video:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py video --prompt "Animate subtle camera movement and natural lighting" --image https://example.com/image.png --poll
```

Keyframe / multi-image video:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py video --prompt "Create a smooth cinematic transition between the two keyframes" --image https://example.com/a.png --image https://example.com/b.png --mode keyframes --poll
```

Retrieve a video task:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py video-get video_123456
```

Light live smoke test:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py smoke-test
```

Image edit smoke test:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py smoke-test --include-image-edit
```

Single video smoke test:

```bash
cd "$SKILL_DIR" && python3 scripts/agnes_api.py smoke-test --video-case text-to-video
```

## Workflow

- Prefer `agnes-2.0-flash` for text chat/completions.
- Do not use Agnes Responses API multi-turn function calling for autonomous tool workflows. Live testing showed the provider can return `function_call` with overall `status=completed`, and submitting `function_call_output` with `previous_response_id` may fail. Use this skill's chat completions path for text generation and treat tool-calling as best-effort request-shape compatibility only.
- Prefer `agnes-image-2.1-flash` for text-to-image, image-to-image, and high-information-density image generation. High-density generation is prompt-driven; include subject hierarchy, environment, secondary details, lighting, composition, and quality requirements.
- For images that require exact readable Chinese text, do not rely on Agnes to render the characters. Ask the model for a no-text illustration with blank label/callout space, then add exact Simplified Chinese locally with a CJK font or an image editor. This avoids translated labels, pseudo-Chinese, and plausible-looking wrong characters.
- Prefer `agnes-video-v2.0` for text-to-video, image-to-video, multi-image video, keyframe animation, prompt-based motion and scene control, cinematic output, asynchronous task creation, polling-based result retrieval, and seed-based reproducibility.
- For image and video generation, convert any non-English user prompt to a fluent English generation prompt before calling the image/video API. English prompts are more stable for Agnes video generation. Preserve concrete visual details, style, lighting, composition, motion, camera instructions, and constraints during translation.
- For videos, remember the API is asynchronous: create a task first, then poll or retrieve by `video_id` when the create response includes it. The script falls back to legacy `task_id` lookup only when `video_id` is absent.
- For user-requested live video generation, prefer creating the task first without `--poll`, capture the `video_id`, then run `video-get` in a polling loop. If `POST /v1/videos` times out or returns `503 Service busy (tasks: 1)`, wait a few minutes and retry task creation once rather than declaring failure immediately; the provider may be busy with a queued/rendering job. Once a `video_id` is returned, poll until `completed` and extract the MP4 URL from `video_url`, `url`, or `remixed_from_video_id`.
- The script validates image sizes, video frame counts, frame rates, and dimensions before sending requests. `num_frames` must be `8n + 1` and `<= 441`; `81` or `121` are good short values.
- The script validates image sizes, video frame counts, frame rates, and dimensions before sending requests. `num_frames` must be `8n + 1` and `<= 441`; `81` or `121` are good short values.
- The video command defaults to `num_frames=121` and `frame_rate=24` for more stable generation. Video smoke tests default to `num_frames=81` and `frame_rate=24`.
- Warn the user before costly or long-running live video generation unless they explicitly asked to test or generate video.
- Test video capabilities one at a time with `smoke-test --video-case <case>` to avoid creating many tasks at once. Supported cases are `text-to-video`, `image-to-video`, `multi-image`, and `keyframes`.

## Current Validation Notes

- Confirmed locally: skill metadata validation and Python syntax.
- Confirmed by live API: basic text, streaming text, tool-calling request shape, text-to-image, image-to-image, high-information-density text-to-image, Chinese prompt translation for image/video, completed text-to-video URL retrieval, and completed image-to-video URL retrieval.
- Caveat: Agnes may accept tool-calling request parameters without consistently returning `tool_calls`; use `smoke-test --strict-tools` when strict tool-call validation is required.
- Caveat: Agnes Responses API multi-turn function calling is not reliable for agent tool loops; do not rely on it for Codex/Claude-style automatic tool continuation.
- Supported by the script and smoke-test selector, but not re-run end-to-end in the latest pass: multi-image video and keyframe animation.
- Not yet confirmed end-to-end: completed URL retrieval for every multi-image video and keyframe animation task. A previous text-to-video task returned a provider-side `division by zero` error, so keep video retries visible and report provider errors clearly.

## Character Consistency Across Multiple Poses

When generating a **series of images with the same character** (e.g., personal brand assets, mascot illustrations, sticker sets), Agnes AI does NOT have IP-Adapter or face-locking. Achieve consistency by:

1. **Write a master character description block** — every detail about the character (hair color/style, face features, glasses/no glasses, clothing brand/colors/types, body type, expression baseline).
2. **Append the same style block** — art style, color palette, background treatment, decorative elements, linework quality.
3. **Change ONLY the pose/action/scene** in each prompt — the rest stays identical word-for-word.
4. **Generate in batches** — use `image_generate` with the same prompt structure, varying only the action clause.
5. **Store reference** — keep the master prompt as a template for future sessions.

**Pitfall:** If the character drifts (wrong hair color, added glasses, different outfit), add the master description block MORE explicitly at the START of the prompt, before the action. Repetition of key identifiers ("NO glasses", "navy blue zip-up jacket", "short spiky dark navy-blue hair") across the prompt helps.

**Pitfall:** Agnes AI struggles with multiple characters in one image. If you need a person + animals/objects, describe them in order and be very explicit about each one's attributes.

## Output Handling

- Return generated image/video URLs directly by default. Do not download, save, open, or inspect generated media unless the user explicitly asks for a local file or visual inspection.
- For image responses, expect URL-style results when `extra_body.response_format` is `url`.
- For video responses, extract URLs from `video_url`, `url`, or `remixed_from_video_id` when `status` is `completed`.
- For video retrieval, prefer `GET /agnesapi?video_id=...&model_name=agnes-video-v2.0`; legacy `GET /v1/videos/{task_id}` remains a fallback.
- If a request fails, report HTTP status and provider error body without exposing the API key.
