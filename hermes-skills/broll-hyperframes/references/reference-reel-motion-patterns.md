# Reference Reel Motion Patterns for broll-hyperframes

Use this reference when analyzing external short-video examples and extracting reusable motion/demo patterns. This note was derived from a Douyin Grill-with-docs reference video while intentionally ignoring the真人出镜 part and focusing only on the animation/demo overlays.

## Core lesson

A strong B-roll explainer should not be a sequence of static PPT cards. It should behave like a narrated live demo: every spoken concept causes a visible object to appear, move, transform, get checked, get rejected, or become a document/rule.

## Reusable visual motifs

### 1. Command-first hook

Start with a terminal/browser/document object, then type or reveal the command/topic. Use the command bar as the first-eye target.

Good for:
- open-source skill introduction;
- agent workflow videos;
- "I tried this tool" hooks.

Motion:
- type cursor;
- command bar slides in;
- result card pops beside it;
- metric badge appears last, e.g. `10 小时`.

### 2. Question count as object system

Instead of only showing `12 个问题` as large text, show a grid of question tiles. Reveal/fill/highlight individual tiles as the narration enumerates questions.

Motion:
- 12 small squares appear in a grid;
- current question tile flips or glows;
- side panel expands with the exact question;
- rejected/approved options get check/cross marks.

### 3. Messy idea -> structured brief transformation

Represent confusion as a scribble/blob, then transform it into a checklist, brief document, or structured cards.

Motion:
- scribble rotates/wobbles;
- a scan line passes over it;
- lines straighten into checklist rows;
- checkmarks land after the narrator says the requirement.

### 4. One-question-at-a-time branching

For a skill that asks questions, show a single speech bubble or prompt node that branches into answer options. Do not show a dense list too early.

Motion:
- one question bubble drops in;
- two or three option nodes grow from it;
- selected option gets a check or highlight;
- rejected option fades/desaturates.

### 5. Document as memory / brief artifact

When the narration says "写进文档 / 变成 brief / 以后 Agent 都能读", show the answer being written into a document card, then connect that document to multiple agent icons.

Motion:
- typed lines enter a `CONTEXT.md`/brief document;
- document card scales from small to central;
- connector lines extend to several agent icons;
- final lock/check icon confirms it became a rule.

### 6. Approval gate / human boundary

For approval workflows, show a timeline strip and an approval modal/status gate. The gate must be its own container, not loose text.

Motion:
- workflow strip advances left to right;
- stops at approval gate;
- Lark/Feishu approval card pops up;
- approve button checks;
- only then the final publish node activates.

### 7. Rejection as a visible action

When the narration says "不要 / 我拒绝 / 不能虚构", show a strong visual rejection rather than just text.

Motion:
- red X stamp over the bad option;
- rejected card slides backward/desaturates;
- correct boundary card moves forward;
- the remaining system path continues.

### 8. Funnel: raw tasks -> judgments

For content strategy, a funnel works well: raw task cards go in; useless completion-log cards are filtered out; judgment/rule cards come out.

Motion:
- many task cards drift toward funnel;
- weak cards fade or get blocked;
- selected judgment cards emerge with short labels;
- final row is arranged into a clean content rule.

### 9. Ghosted context retention

Keep prior scene objects faintly visible behind the current one to create continuity, but never at full contrast.

Motion:
- previous object fades to 15-25% opacity;
- new object builds on top;
- connector line or arrow makes the relay explicit.

### 10. Audio-word hits

Important words should trigger a visible micro-event at the exact spoken word:

- "10 小时" -> badge hits/pop.
- "12 个问题" -> question grid appears.
- "不要" -> red X stamp.
- "Approve" -> approval button checks.
- "brief" -> document card receives text.
- "Agent" -> agent icons connect.
- "评论拷问" -> comment input types the CTA.

## Motion timing rules

- A page may appear slightly before the key phrase, but the decisive animation should happen on the phrase.
- For each 2-4 seconds of narration, at least one object should change state.
- Avoid keeping a finished diagram static for more than 3 seconds unless it is a deliberate readable hold.
- Use object-led transitions: command bar -> question bubble -> brief document -> workflow strip -> approval gate -> rule document.
- Build diagrams progressively. Do not reveal the complete diagram before the narration explains it.

## Design rules

- Prefer soft off-white background + dark blue line art + one accent color.
- Use thin, hand-drawn or product-sketch connectors for question flows.
- Use large single object per beat; avoid dense slide-like diagrams.
- Keep exact Chinese text in code-rendered containers.
- Use short labels on objects; let captions carry the full sentence.
- Do not show internal production/tooling labels such as `broll-hyperframes`, `SRT-aligned`, or renderer/debug names in the final video unless the user explicitly asks for them. Chapter bars and progress/navigation UI should be viewer-facing, not maker-facing.

## Chapter progress / top navigation pattern

For longer narrated videos with several conceptual chapters, prefer a top chapter progress bar instead of a generic thin progress line.

Use when:

- the video has 5+ semantic chapters;
- the user wants the viewer to know where they are in the story;
- the video feels like a guided lesson, course, or PPT-style walkthrough.

Pattern:

- Place a semi-transparent gray bar near the top of the video content.
- Show short chapter labels separated by vertical dividers.
- Highlight the current chapter based on SRT/VTT-aligned time.
- Optionally brighten completed chapters and add a thin progress fill along the bottom of the chapter bar.
- Keep labels short; truncate or group chapters if there are too many.
- Do not let the chapter bar cover the main hero object or first-eye target.

Example chapter labels:

```text
开源 Skill | 12 个问题 | 定位重构 | Brief 文档 | 边界审批 | 内容判断 | 工作规则
```

Implementation note:

- Define chapters from `BEAT_MAP.json` / SRT cue ranges.
- Update the active chapter inside `window.seekTo(t)` during render/snapshot generation.
- Treat the chapter bar as a navigation layer, not as a decorative progress line.

## Integration into broll-hyperframes production

This is a general production layer for future videos, not a one-off fix for a single Grill-with-docs video. Apply it to any narrated B-roll / HyperFrames / HTML-GSAP explainer where the user expects high-quality motion, page demonstration, and PPT-like audio-visual synchronization.

Before rendering any future video, convert the script into reusable motion units:

1. **Concept object** — what visual object represents this spoken idea?
2. **Action verb** — what changes when the narrator says the keyword?
3. **State transition** — before → after state of the object.
4. **Audio hit** — exact SRT/VTT cue or phrase where the decisive motion happens.
5. **Readable hold** — how long the viewer gets to understand the result.
6. **Relay object** — what carries continuity into the next beat?

Add a `MOTION_MAP.json` field per beat:

```json
{
  "beat": "approval gate",
  "audio_hit": "发布前先推到 Lark 给我审批",
  "main_object": "workflow_strip + approval_card",
  "state_change": "strip stops -> approval card pops -> approve checks -> publish node activates",
  "hold_after": 0.8,
  "risk": "do not show publish before approve is spoken"
}
```

During review, score whether each beat has:

- current spoken phrase represented by the current object;
- one visible state change tied to audio;
- object continuity from the previous beat;
- no premature reveal of future conclusions;
- readable hold after the motion.
