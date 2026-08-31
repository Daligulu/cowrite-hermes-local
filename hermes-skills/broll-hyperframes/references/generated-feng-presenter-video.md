# Generated Feng presenter for B-roll / GSAP videos

Use this when the user asks for a Feng anime guide in a video, especially when they say the character must be generated / text-to-image / text-to-animation and not code-drawn.

## Rule

The bottom-right presenter must be an image or animation asset, not a CSS/Pillow/SVG/geometric drawing. All exact Chinese labels, captions, and UI remain code-rendered separately.

## Preferred asset order

1. Generate a dedicated full-body Feng presenter asset with the active image backend.
2. If native `image_generate` is unavailable, use the `feng-ip` Agnes fallback script to generate a Feng-style full-body presenter.
3. If generation is blocked, use a previously accepted generated Feng asset and document the blocker.
4. Do not use a contact-sheet crop as the final presenter when the user specifically asked for text-to-image / generated character. Pose-library crops are acceptable only as temporary placeholders or as reference for a prompt.
5. Do not code-draw the character.

## Prompt requirements

Ask for:

- full-body Feng anime young man;
- short black slightly spiky hair;
- refined slimmer black eyebrows with a masculine heroic look;
- calm warm eyes;
- white hoodie with hood and drawstrings;
- dark black-gray jacket;
- standing 3/4 view;
- gently pointing toward the center/left as if explaining;
- head, torso, arms, legs, and shoes fully visible;
- white background or transparent-friendly background;
- no text, labels, speech bubble, watermark, signature, frame, UI, or blank label boxes.

Negative requirements:

- not a headshot or bust portrait;
- not chibi, not cute mascot, not photorealistic;
- do not crop the feet;
- do not copy cafe/avatar composition.

## Agnes fallback pattern

```bash
SKILL=/root/.hermes/skills/creative/feng-ip
cd "$SKILL"
python3 scripts/generate_feng_with_agnes.py \
  --prompt-file /tmp/feng-video-presenter-prompt.txt \
  --slug <video-slug>-presenter \
  --name feng-generated-fullbody-presenter \
  --size 1024x1024 \
  --out-dir <project>/assets/generated-feng \
  --raw
```

Then create a transparent overlay from the generated PNG by making near-white pixels transparent. Use the transparent version in the HTML/GSAP/Pillow composition.

## Placement contract

- Keep the presenter bottom-right and secondary.
- Do not place a visible text label such as “Feng 讲解” under the character unless the user explicitly asks for it.
- Reduce caption width or move captions left/up so the presenter never covers subtitles.
- A speech bubble may be used if it does not collide with captions or center content, but avoid persistent label clutter.
- Target about 8–12% visual attention. Full-body can be taller, but it must not dominate the center story.

## QA checklist

- The asset is visibly generated/anime, not code-drawn.
- Full body is visible: head, torso, legs, and shoes.
- No generated text, watermark, signature, blank label boxes, or leftover contact-sheet fragments.
- Captions avoid the presenter.
- Contact sheet includes enough frames to verify the presenter across the whole video.
- Review report states which backend produced the presenter and where the source/transparent assets live.
