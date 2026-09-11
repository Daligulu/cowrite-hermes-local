# ComfyUI Fallback Pattern

When the user asks for ComfyUI / Stable Diffusion / IP-Adapter for character-consistent image generation, ALWAYS run the hardware check FIRST before attempting any installation.

## Decision Flow

1. **Run hardware check:**
   ```bash
   python3 ~/.hermes/skills/creative/comfyui/scripts/hardware_check.py --json
   ```

2. **Interpret verdict:**
   - `verdict: ok` → Proceed with local ComfyUI install
   - `verdict: marginal` → SD1.5 may work, SDXL tight, suggest Comfy Cloud for heavy workflows
   - `verdict: cloud` → No usable GPU. Options:
     a. **Comfy Cloud** (requires API key, paid)
     b. **Agnes AI** (fallback, no GPU needed, uses gpt-image-2-vip or agnes-image-2.1-flash)

3. **If no GPU and no Comfy Cloud key:** Fall back to Agnes AI with character consistency pattern.

## Common Pitfall

Never attempt `comfy install` or `pip install diffusers` without checking hardware first. This wastes time and produces confusing errors on headless/CPU-only machines.

## Agnes AI as Fallback

When ComfyUI is not available:
- Use `image_generate` with highly detailed, repeated character descriptions
- Generate poses in batches (5-9 at a time)
- Store results in an organized assets directory
- Create an inventory document (ASSETS.md) listing each image's scenario and intended use
