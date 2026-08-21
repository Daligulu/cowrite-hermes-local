# Obsidian WeWrite Source Summary

Source note: `/root/Documents/Obsidian Vault/20-Library/Skills/Content/wewrite_skill.md`

Key points adapted locally:

- Skill name: `wewrite`
- Purpose: WeChat Official Account full content workflow: topic → outline → enhanced writing → SEO → visual AI → layout → draft-box publish.
- Theme: `professional-clean`.
- Multi-account requirement: dog account `wx27855f8407f2c81c`.
- Original gotcha: OpenClaw `publish` did not support `--account`; account switching required editing `config.yaml`.
- Hermes adaptation: `scripts/wewrite_publish.py --account dog` resolves dog account and refuses unsafe defaults.
- Secrets are read from `/root/.hermes/.env` and are not stored in notes.
