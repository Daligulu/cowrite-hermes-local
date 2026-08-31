# Audio-Visual Sync QA for Narrated PPT-like B-roll

Use this reference when the goal is "像一个人讲 PPT 一样音画同步" — the viewer should feel the speaker is advancing slides exactly as they talk.

## Trigger

Apply when:

- the voiceover mentions one idea while the screen shows a different page;
- captions are coarse scene summaries instead of the current spoken sentence;
- scene durations are guessed rather than derived from audio/subtitle timing;
- the user says the video page, animation, text, and narration are out of sync.

## Source of truth

For Scheme B voiceover videos, the timeline source of truth is:

```text
voiceover.srt or voiceover.vtt
```

Do not use rough equal scene durations when SRT/VTT exists. Use each subtitle cue to decide:

- scene switch points;
- visual page order;
- caption text;
- snapshot times;
- readable holds.

## Workflow

1. Generate or load `voiceover.mp3` and `voiceover.srt`.
2. Parse SRT timestamps into cue objects:
   - `start`
   - `end`
   - `text`
3. Map cues to visual pages by meaning, not by the old storyboard order.
4. Reorder or retime visual pages so the page shown matches what is being said.
5. Use exact SRT cue text for bottom captions whenever possible.
6. Update `BEAT_MAP.json` with SRT-aligned scene ranges and snapshot times.
7. Render and inspect contact-sheet frames at cue-aligned times, not arbitrary evenly spaced times.
8. If a page still feels early or late, adjust the scene boundary, not the audio.

## Scene mapping pattern

For a narrated article or short script, build a mapping like:

```json
[
  {"visual": "hook", "start": 0.10, "end": 3.22, "cue": "省了十个小时"},
  {"visual": "X agent setup", "start": 3.22, "end": 9.26, "cue": "自动运营 X 系统"},
  {"visual": "first question", "start": 9.26, "end": 16.32, "cue": "账号到底是干嘛的"},
  {"visual": "positioning", "start": 16.32, "end": 32.10, "cue": "接客户 -> 机会口碑引擎"}
]
```

## Caption rule

Avoid this for final narrated videos:

```js
function captionAt(t) {
  return currentScene.summary;
}
```

Prefer this:

```js
const cues = [
  {s: 0.10, e: 3.22, text: '这个开源 skill，至少帮我省了十个小时。'}
]
function captionAt(t) {
  return cues.find(x => t >= x.s && t < x.e)?.text || ''
}
```

This ensures the subtitle and voiceover stay locked even when visual pages have longer or shorter holds.

## PPT-like pacing rules

- Each major page should appear slightly before or exactly when the speaker introduces its subject.
- Do not show a future concept more than 1-2 seconds early unless it is a deliberate tease.
- Do not keep an old page on screen after the narration has moved to a new topic.
- For list questions, show the list while the speaker enumerates the questions.
- For a conclusion sentence, show the conclusion card before the sentence midpoint, then hold it.
- If a page is only loosely related to the current narration, either retime it or remove it.

## Verification checklist

- [ ] `BEAT_MAP.json` includes `caption_source` and SRT-aligned `scene_ranges`.
- [ ] Captions are generated from exact SRT cue text.
- [ ] Contact sheet timestamps include cue starts or meaningful midpoints.
- [ ] The page shown at every inspected timestamp matches the spoken phrase.
- [ ] The CTA appears only when the speaker reaches the CTA.
- [ ] Feng presenter/captions remain non-colliding after timing changes.
- [ ] Final report states that scene boundaries were aligned to `voiceover.srt`.
