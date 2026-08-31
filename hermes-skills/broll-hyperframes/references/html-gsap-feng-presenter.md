# HTML/GSAP B-roll render with Feng presenter

Use this when a `broll-hyperframes` project needs a more premium motion pass than the Pillow fallback, plus a small Feng anime guide.

## Proven pattern

1. Keep the existing Scheme B script/audio if the narration is already approved:
   - `script.txt`
   - `voiceover.mp3`
   - `voiceover.srt`
2. Build `index.html` as a 1080x1920 composition:
   - local `@font-face` for Noto Sans CJK;
   - all exact Chinese as DOM/CSS text;
   - local GSAP bundle: `node_modules/gsap/dist/gsap.min.js`;
   - one paused master timeline;
   - expose `window.seekTo(t)` and `window.totalDuration` for deterministic frame capture.
3. Render with `puppeteer-core` + system Chrome:
   - launch `/usr/bin/google-chrome` with `--no-sandbox`;
   - set viewport `{width:1080,height:1920,deviceScaleFactor:1}`;
   - seek each frame with `window.seekTo(t)`;
   - screenshot JPEG frames;
   - encode with ffmpeg and mux `voiceover.mp3`.
4. Create snapshots and contact sheet after render.
5. Publish only after `ffprobe`, contact sheet inspection, and public `curl -I` pass.

## Feng presenter rules for video

- Use Feng as a small bottom-right visual guide only.
- Do **not** add a visible text label such as `Feng 讲解` under or near the character unless the user explicitly asks for it. It makes the presenter feel like a UI widget and adds clutter.
- Keep captions left/up enough to avoid the presenter region.
- If fresh image generation is unavailable, reuse an accepted `feng-ip` reference asset and document the fallback; do not code-draw a fake Feng.
- Better next pass: generate 3-5 dedicated Feng poses once image generation works, then switch pose by scene.

## Minimal DOM contract

```html
<div class="caption" id="caption"></div>
<div class="speech" id="speech">这里要先问清楚</div>
<div class="feng-card" id="feng">
  <img src="assets/feng-anime-avatar-v2.jpg">
</div>
```

Avoid:

```html
<div class="feng-label">Feng 讲解</div>
```

## Renderer skeleton

```js
const puppeteer = require('puppeteer-core');
const { spawnSync } = require('child_process');

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'networkidle0' });
const dur = await page.evaluate(() => window.totalDuration);

for (let i = 0; i < Math.ceil(dur * fps); i++) {
  const t = i / fps;
  await page.evaluate(tt => window.seekTo(tt), t);
  await page.screenshot({ path: `renders/frames/frame_${String(i).padStart(5,'0')}.jpg`, type: 'jpeg', quality: 88 });
}

spawnSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-framerate', String(fps), '-i', 'renders/frames/frame_%05d.jpg',
  '-i', 'voiceover.mp3',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '24',
  '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart',
  'renders/<slug>-final.mp4'
], { stdio: 'inherit' });
```

## QA gates

- Grep source for unwanted presenter labels before publishing:

```bash
! grep -q 'Feng 讲解' index.html
```

- Inspect contact sheet specifically for:
  - no visible presenter label;
  - captions do not collide with Feng;
  - Feng is visible but secondary;
  - center B-roll remains the subject;
  - Chinese text remains DOM/CSS-rendered.
