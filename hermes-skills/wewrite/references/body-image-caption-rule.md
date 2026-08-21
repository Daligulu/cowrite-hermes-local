# Body image caption rule for WeWrite article drafts

Session learning: in WeChat article writing workflows,正文配图 Markdown was being inserted as `![正文配图：<scene>](path)`. The WeWrite renderer converted image alt text into a visible `<figcaption>`, so published drafts showed editor-like labels such as “正文配图：主人观察空调房里狗狗咳嗽状态” below images.

Durable rule:

- Markdown image alt text is for accessibility/context only in writing workflows.
- Do not render alt text as visible captions by default.
- Strip generated/editor prefixes like `正文配图：` and `配图说明：` from the final image `alt` attribute if older Markdown still contains them.
- When prompting writing cron jobs or agents to insert body images, prefer short neutral alt text or empty alt text:
  - Good: `![主人观察空调房里狗狗咳嗽状态](body-1.jpg)`
  - Avoid: `![正文配图：主人观察空调房里狗狗咳嗽状态](body-1.jpg)`

Verification pattern:

1. Render a draft with `wewrite_publish.py --dry-run --html-out out.html`.
2. Confirm the output HTML has no `<figcaption>` and no visible `正文配图：` string.
3. It is acceptable for sanitized alt text to remain on the `<img>` tag, e.g. `alt="主人观察空调房里狗狗咳嗽状态"`.

This applies especially to dog-writing and AI-daily writing tasks, both of which generate two article body illustrations.