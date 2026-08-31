# Pillow + ffmpeg fallback renderer

Use this when native HyperFrames/GSAP is unavailable, too slow to set up, or the user needs a concrete MP4 quickly. This is a fallback, not the preferred final style for premium motion work.

## When to use

- Scheme B compressed Chinese narration video.
- Exact Chinese text, UI cards, flow diagrams, tables, and captions matter more than generated atmosphere.
- HyperFrames CLI cannot be verified in time.
- The user asked for a real rendered MP4, not just a plan.

## Pattern

1. Generate `voiceover.mp3` / `voiceover.srt` first with Edge TTS.
2. Probe actual audio duration with `ffprobe`; use it as the source of truth.
3. Write `make_video.py` that:
   - defines 1080×1920 canvas and 24 FPS;
   - uses Noto Sans CJK fonts;
   - draws all Chinese text, UI cards, diagrams, arrows, captions, and CTA in code;
   - stores scene ranges in a list or `BEAT_MAP.json`;
   - renders frames to an ffmpeg rawvideo pipe;
   - muxes audio with `-shortest` and `-movflags +faststart`;
   - extracts snapshots and builds `renders/contact-sheet.jpg`.
4. Write production artifacts: `BRIEF_DESIGN_PROPOSAL.md`, `DESIGN.md`, `STORYBOARD.md`, `BEAT_MAP.json`, `MOTION_MAP.json`, `REVIEW_REPORT.md`.
5. Publish MP4 only after `ffprobe`, contact sheet inspection, and public URL `curl -I` pass.

## Performance rules

- Precompute static backgrounds once, then `.copy()` per frame. Recomputing gradients per pixel per frame can make a 90s video exceed a 10-minute timeout.
- Suppress ffmpeg progress spam with `-loglevel error`; huge ffmpeg progress logs can drown out useful output.
- Prefer 24 FPS for fallback renders unless the motion truly needs 30 FPS.
- Keep generated MP4 paths deterministic: `renders/<slug>-final.mp4`.

## ffmpeg pipe skeleton

```python
cmd = [
  'ffmpeg', '-y', '-loglevel', 'error',
  '-f', 'rawvideo', '-vcodec', 'rawvideo',
  '-pix_fmt', 'rgb24', '-s', '1080x1920', '-r', '24', '-i', '-',
  '-i', 'voiceover.mp3',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart',
  'renders/<slug>-final.mp4'
]
```

## QA notes

- Contact sheets are mandatory. Check that the center content and bottom captions are readable at mobile scale.
- If a persistent Feng presenter was not requested, omit it; do not add a bottom-right character just because it is available.
- If a presenter is used, keep it secondary and ensure captions avoid it.
- Record that this is a fallback renderer in `REVIEW_REPORT.md` and suggest native HyperFrames/GSAP as the next quality upgrade.
