# Scheme B: 短视频压缩男声配音版

Use this reference when the user says “方案 B” or wants a tighter short-video version from a long Chinese script.

## Goal

Compress long source text into a social-video narration that preserves the core insight while staying watchable. Use Edge TTS male Mandarin narration and build B-roll around the audio timeline.

## Default voice

```bash
zh-CN-YunxiNeural
```

Alternative for more formal/news tone:

```bash
zh-CN-YunyangNeural
```

Recommended default:

```bash
edge-tts \
  --voice zh-CN-YunxiNeural \
  --rate +10% \
  --text "<compressed final script>" \
  --write-media voiceover.mp3 \
  --write-subtitles voiceover.srt
```

If the script is long, call Edge TTS from Python or pass a file; do not paste huge text into a shell command.

## Compression rules

- Keep the hook, conflict, surprising question, concrete example, judgment, and CTA.
- Remove repeated setup and meta explanations.
- Prefer short spoken sentences.
- Preserve first-person authenticity when the source is personal workflow content.
- Do not fabricate tools, metrics, results, or project claims.
- If the natural version is longer than 2 minutes and the user asked for short video, create a compressed version instead of increasing TTS speed too much.

## Timing rules

- 0–2s: hook frame and first-eye target.
- Every 2–4s: visible center B-roll change.
- Every 8–15s: larger chapter shift.
- Important judgments get a readable hold.
- Captions follow Edge TTS SRT/VTT timing.

## Feng presenter in Scheme B

If requested, place Feng in the bottom-right as a small guide:

- use generated or accepted image asset from `feng-ip` canon;
- never code-draw the final character;
- keep it small and secondary;
- move captions left/up to avoid collision.

## Review gates

- Audio generated and probed.
- Captions exist.
- Center visuals are code-rendered for all exact Chinese/UI.
- Contact sheet inspected.
- Review report states whether the result is compressed or natural full-length.
