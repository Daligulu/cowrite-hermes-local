# HyperFrames Motion Director Integration

## Installed source

External project:

```text
/root/.hermes/workspace/external-skills/hyperframes-motion-director
```

GitHub:

```text
https://github.com/geekjourneyx/hyperframes-motion-director
```

Local verification:

```bash
cd /root/.hermes/workspace/external-skills/hyperframes-motion-director
node scripts/check-structure.mjs
```

The project provides a disciplined production system for HyperFrames motion videos: brief/design proposal, visual system, storyboard, beat map, motion map, asset checks, snapshots, render, and review report.

## How broll-hyperframes uses it

Use Motion Director as the **production director layer** inside `broll-hyperframes`.

Keep `broll-hyperframes` defaults:

- 9:16 Chinese B-roll explainer.
- Center content is the main subject.
- Exact Chinese/UI/diagrams are code-rendered.
- Edge TTS male narration drives timing.
- Optional Feng anime guide is small and secondary.
- Clean modern explainer style is allowed; do not blindly copy black/gold cinematic style.

Borrow from Motion Director:

- structured production artifacts;
- essence extraction and visual metaphor selection;
- text-over-background layout contracts;
- kinetic text relay and anti-PPT motion gates;
- audio beat map discipline;
- asset validation and review pack mindset.

## Scaffold command

For serious video work, create the project with Motion Director templates:

```bash
HFMD=/root/.hermes/workspace/external-skills/hyperframes-motion-director
node "$HFMD/scripts/create_project.mjs" \
  ~/projects/Fengfeng/broll-hyperframes/<video-slug> \
  --with-timing \
  --with-motion
```

This creates:

```text
BRIEF_DESIGN_PROPOSAL.md
DESIGN.md
STORYBOARD.md
REVIEW_REPORT.md
BEAT_MAP.json
MOTION_MAP.json
```

Templates must be filled with project-specific content. Do not deliver reports that still contain placeholders.

## Workflow insertion

### 1. Essence extraction

Before design, extract:

- core viewpoint;
- largest conflict;
- emotional center;
- keyword that deserves visual amplification;
- restrained visual metaphor.

Do not draw the surface topic literally unless the user asked for it. Turn abstract ideas into objects, spatial systems, or transformations.

### 2. Brief / design proposal

`BRIEF_DESIGN_PROPOSAL.md` must include:

- goal and audience;
- platform, resolution, duration, FPS;
- script mode: compressed short version or natural full version;
- style override: clean B-roll explainer unless another style is requested;
- asset modality plan: text-to-image / supplied / code / hybrid;
- attention map: first eye target, biggest word/object, 0–2s scroll-stop event;
- kinetic relay plan: keyword chain, action-object chain, direction map, relay handoff, readable holds;
- motion risk gates.

### 3. Design system

`DESIGN.md` must lock:

- background and foreground palette;
- type scale and Chinese line-breaking rules;
- safe zones for 9:16 mobile platforms;
- center content area;
- text rectangles, subject rectangles, safe bottom boundary;
- generated image quiet zones and crop-safe subject zones;
- caption position and collision policy;
- Feng presenter region if used;
- component patterns: title card, UI card, flow, proof stat, CTA;
- motion vocabulary and repeated-pattern bans.

### 4. Storyboard

`STORYBOARD.md` must define each beat:

- start/end time;
- narration meaning;
- on-screen copy;
- first-eye target;
- hero frame timestamp;
- layout contract;
- text entry / lock / emphasis / exit / bridge;
- action object and transition direction;
- audio/rhythm note;
- QA risk.

### 5. Beat map and motion map

Use `BEAT_MAP.json` when there is voiceover, captions, music, or strict timing.

Use `MOTION_MAP.json` to prevent PPT-like animation:

- labels: hook, tension, reveal, proof, CTA;
- scene ranges;
- keyword chain;
- action objects;
- transition directions;
- relay objects;
- snapshot times;
- anti-PPT score / verdict.

### 6. Static build before animation

Build readable still frames before motion. Check:

- mobile legibility;
- text inside quiet zones;
- subject/caption/presenter non-collision;
- center content hierarchy;
- visual metaphor understandable without explanation.

### 7. Motion build

Motion should order attention, reveal cause/effect, and connect ideas. Avoid decorative effects.

Use at least one structural transition for important text/icon videos:

- mask reveal;
- scan pass;
- split;
- compression / expansion;
- cursor typing;
- timeline strip;
- path handoff;
- object-led cut.

If three adjacent beats share the same textRect, entry, and rhythm, revise before render.

### 8. Validation and review

Run the strongest available checks:

```bash
HFMD=/root/.hermes/workspace/external-skills/hyperframes-motion-director
node "$HFMD/scripts/check_assets.mjs" <project-dir> || true
node "$HFMD/scripts/validate_artifacts.mjs" <project-dir> || true
```

If using HyperFrames directly:

```bash
npx hyperframes doctor
npx hyperframes lint
npx hyperframes validate
npx hyperframes inspect
npx hyperframes snapshot <composition> --at <times>
npx hyperframes render --quality draft -o renders/verify.mp4
```

If HyperFrames CLI is unavailable, use the closest substitute:

- ffprobe final MP4;
- extract keyframes with ffmpeg;
- build contact sheet;
- inspect visually;
- record the blocker in `REVIEW_REPORT.md`.

## Kinetic relay scorecard

For text/icon-driven B-roll, score harshly out of 100:

- 20: first 0–2 seconds have a clear largest word/object and scroll-stop motion event.
- 20: important words are revealed, pushed, typed, scanned, compressed, split, or otherwise acted on.
- 20: icons/objects participate in transitions instead of sitting as decoration.
- 20: adjacent beats have relay continuity through direction, object, mask, line, cursor, scan, or camera movement.
- 10: rhythm alternates between motion hits and readable holds.
- 10: CTA resolves cleanly.

Below 90: deliver as draft or revise the weakest motion beat before final.
Below 70: rebuild the transition map before render.

## Style adaptation

Motion Director defaults to black cinematic metaphor. `broll-hyperframes` may use that for premium promos, but the default for 峰峰 is:

```text
clean Chinese B-roll explainer + modern product/demo UI + readable mobile captions + strong center content + optional small Feng guide
```

Do not force black/gold if it makes the video less clear.

## Licensing note

The external project is AGPL-3.0. Using it locally as a production aid is fine for this workflow; if redistributing modified code or packaging its scripts into another public project, preserve the license and source attribution.
