# WeChat HTML Rendering Quirks — how WeChat parses the published draft

WeChat's published-draft HTML engine is NOT a standard browser. The safest
principle when generating draft HTML: **a local headless-Chrome render is NOT
proof of how WeChat renders it.** The only authoritative verification is a REAL
draft publish read in the WeChat mobile app (or `draft/get` content grep).

## 1. Leading block/inline elements on a `<p>` line can sink onto their own line

Symptom (real case, 2026-09-06): a green checkmark `✓` rendered on its own line
ABOVE the list-item text, instead of inline before the text.

Structures WeChat parsed as block-level (marker sank to its own line):

```html
<!-- BAD: <li> + leading <span> -->
<li><span style="color:#10b981;">✓</span> item text</li>

<!-- BAD: bare leading span, even without ul/li wrapper -->
<p><span style="color:#10b981;">✓</span> item text</p>
```

Working structure (marker stays inline on the same line as text):

```html
<p style="margin:8px 0;color:#374151;font-size:15px;line-height:1.75;">
  <span style="color:#10b981;">✓</span> item text
</p>
```

Key details that matter:
- Use a `<p>` row per item, NOT `<ul>`/`<li>` (avoid native list semantics).
- Colored checkmark is an inline `<span>`, immediately followed by a **NORMAL
  space**, then the text. **Never use `&nbsp;`** between marker and text — WeChat's
  nbsp handling is unstable and contributed to the split in the observed case.
- Confirm the draft on a phone (WeChat mobile app) after publish. Do not conclude
  "fixed" from a local screenshot alone.

## 2. Layout claims are validated by the real publish, not a local render

1. Publish without `--dry-run` (real draft, `draft_media_id` returned).
2. Grep the returned `news_item[0].content` for the structural signature
   (absence of `<li>`, presence of inline `<span>✓</span>` + plain space).
3. Best: have the user open it in the WeChat mobile app.

## 3. General WeChat HTML constraints (recurring)

- Inline styles only; WeChat strips `<style>` blocks / class-based CSS.
- Avoid `&nbsp;`, flexbox, and CSS-grid for inline text runs — keep marker + text
  as a single plain text flow.
- For list/checklist cards, a `<p>` row inside a `<section>` box is the reliable
  pattern; do not lean on native list semantics.

## Debugging replay (2026-09-06 checkmark split)

- Root cause: `flush_ul()` in `wewrite_publish.py` used
  `<li><span>✓</span> text</li>`; WeChat split the marker to its own line.
- Iterations: tried `<strong>✓</strong>` then `<span>✓</span>` with `&nbsp;` —
  all looked fine in headless Chrome but the user's WeChat screenshot still split.
- Final fix: `<p>` row + colored inline `<span>✓</span>` + NORMAL space (no
  `&nbsp;`), no `<ul>`/`<li>`. Real-published and verified in WeChat's reader.
- Lesson: the Chrome-screenshot loop is misleading. Stop guessing from local
  render; publish and read back, or ask the user to check the phone.
