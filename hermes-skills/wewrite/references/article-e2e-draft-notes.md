# WeWrite article E2E notes

Use these notes when the user asks for a real end-to-end article draft-box test, not a dry-run.

## Real draft verification

A real article publish should produce and verify all of the following:

- Markdown file with final article text.
- Cover image file with non-zero size.
- WeWrite HTML file from `--html-out`.
- Publisher JSON captured with `tee <publish-json-path>` containing:
  - `ok: true`
  - expected account/appid
  - `thumb_media_id`
  - `draft_media_id`

Use the publisher JSON as the source of truth for draft success. Do not report success from cron status alone.

## Non-dog account publishing

For 峰AI路 / default account article workflows, use both:

```bash
--account default --allow-non-dog-appid
```

This makes non-dog publishing intentional and avoids the dog-account safety gate.

## Topic recording

Record `published-draft` only after the WeChat draft API returns `draft_media_id`. When adding notes to topic pools, do not duplicate `status=...` inside freeform notes if the helper already has a `--status` argument.
