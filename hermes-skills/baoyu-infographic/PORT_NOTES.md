# Hermes Port Notes

Updated from the first-party repository [JimLiu/baoyu-skills](https://github.com/JimLiu/baoyu-skills) at commit `6b7a2e417500561a5ecdd0b168332f4142584617` (upstream `1.117.4`).

## Hermes adaptations

- Keeps upstream workflow and reference files intact.
- Uses Hermes frontmatter metadata and natural-language skill discovery.
- Pins the saved backend preference to `image_generate`; this profile resolves it through ApiYi unless the user explicitly selects another configured model.
- Uses `clarify` for option confirmation.
- Direct reference images are allowed through `image_url` / `reference_image_urls` when supported by the active Hermes backend.
- Prompt files remain mandatory before image generation.
- Programmatic bitmap text repair remains forbidden; regenerate from a corrected prompt instead.

## Upgrade rule

Sync references from upstream, then reapply Hermes frontmatter and verify all Markdown links, EXTEND preferences, discovery, and any bundled script before replacing the prior version.
