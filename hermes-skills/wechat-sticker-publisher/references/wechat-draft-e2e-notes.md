# WeChat sticker draft E2E notes

Session-derived notes for real end-to-end sticker/image-message draft tests.

## Field-length pitfalls

The WeChat draft API may reject image-message drafts when text metadata is too long. Observed fixes:

- Keep `--title` short and human-readable, ideally under 20 Chinese chars even though article title limits are larger.
- Keep `--digest` very short; if the API returns a description/digest size error, retry with a compact digest such as `中暑应急提醒` or `AI 用电观察`.
- Keep `--text` as the article body/caption, not as title/digest metadata.

## Aspect-ratio pitfall

For workflows that specify a 3:4 vertical infographic, do not accept a square/landscape first draft as final. If a first attempt accidentally creates a square image and publishes successfully, generate the correct 3:4 version and publish again; report that the earlier square draft should be ignored or deleted in the WeChat backend.

## E2E verification pattern

A real successful run should leave:

- Local image file with expected dimensions and non-zero size.
- Publisher JSON under `/root/.hermes/workspace/workflows/stickers/outputs/` containing `ok: true`, `draft_media_id`, and the expected account/appid.
- Topic-pool entry for the relevant workflow with `published-draft`.

Use the JSON file as the source of truth for `draft_media_id`; do not infer success from command exit alone.
