---
name: feng-knowledge-base
description: "Use when operating 峰的知识库: obey explicit write/search trigger phrases, ingest links only after parsing content, maintain LLM Wiki Markdown structure with [[wikilinks]], and rely on Obsidian Headless on-change sync to 峰的知识库（远程）."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [knowledge-base, llm-wiki, obsidian, markdown, wikilinks, feishu]
    category: note-taking
    related_skills: [llm-wiki, obsidian-headless, claude-real-video]
---

# 峰的知识库

## Overview

峰的知识库 is 峰峰's local LLM Wiki / Obsidian vault for durable, curated knowledge. It lives at:

```text
/root/Documents/峰的知识库
```

Remote Obsidian Sync vault:

```text
峰的知识库（远程）
Vault ID: ecb1b3a6f43a58c5f1a2d60da21ef69d
```

This skill is the source-of-process for using that vault. Follow it before any operation involving 峰的知识库.

## When to Use

Use this skill when the user mentions any of:

- 峰的知识库
- 知识库, when context refers to 峰峰's local KB
- 写入知识库 / 存入知识库 / 存到知识库
- 结合知识库 / 根据知识库 / 查询知识库
- syncing 峰的知识库 with Obsidian
- ingesting a video/article/image-text link into 峰的知识库

Also load related skills as needed:

- `llm-wiki` for LLM Wiki structure and lint/query/ingest discipline.
- `obsidian-headless` for Obsidian Sync operations.
- `claude-real-video` for video links or local video files.

## Absolute Trigger Rules

### Write trigger

Only write, modify, delete, archive, or create formal knowledge pages when 峰峰 explicitly says one of:

- `写入知识库`
- `存入知识库`
- `存到知识库`

If none of these exact intent phrases is present, do **not** write ordinary conversation content into the KB.

Infrastructure maintenance is allowed when explicitly requested, such as creating this skill, updating sync scripts, linting, or fixing KB rules. Deletion or remote-overwrite actions still require explicit scope and verification.

### Search trigger

Only search/read the KB before answering when 峰峰 explicitly says one of:

- `结合知识库`
- `根据知识库`
- `查询知识库`

If none of these phrases is present, answer normally without using the KB as default context.

## Orientation Step

Before any KB write, query, lint, or rule update, orient yourself:

1. Read `/root/Documents/峰的知识库/SCHEMA.md`.
2. Read `/root/Documents/峰的知识库/index.md`.
3. Read recent `/root/Documents/峰的知识库/log.md`.
4. For topic-specific writes or queries, search existing pages before creating new ones.

Completion criterion: you know the current trigger rules, existing page catalog, and recent operations.

## File Structure

```text
/root/Documents/峰的知识库/
├── SCHEMA.md
├── index.md
├── log.md
├── raw/
│   ├── articles/
│   ├── papers/
│   ├── transcripts/
│   └── assets/
├── entities/
├── concepts/
├── comparisons/
├── queries/
├── _meta/
└── _archive/
```

Formal knowledge pages use Markdown and Obsidian `[[wikilinks]]`. Raw source captures live under `raw/` and should be treated as immutable.

## Write Workflow

Use this only after a valid write trigger.

1. **Orient** using SCHEMA, index, and log.
2. **Capture source material**:
   - Web article / image-text link → extract full content first; save raw markdown in `raw/articles/`.
   - PDF / paper → extract full text; save in `raw/papers/`.
   - Video link / local video → use `claude-real-video` to produce transcript, keyframes/contact sheets, timestamps, and visual notes; save transcript/manifest in `raw/transcripts/` and useful images in `raw/assets/`.
   - Pasted text → save raw text in the appropriate raw subfolder when substantial.
3. **Do not write from a title card alone.** For links, parse concrete content before writing. If extraction fails, retry with browser/platform-specific tools or report the blocker.
4. **Check existing pages** with `index.md` and `search_files` to avoid duplicates.
5. **Create/update formal pages** under `entities/`, `concepts/`, `comparisons/`, or `queries/`:
   - YAML frontmatter required.
   - Use tags from `SCHEMA.md`; add tags to schema first if genuinely needed.
   - Use `[[wikilinks]]`; target at least 2 outbound links when possible.
   - Add source references to raw files.
   - Mark low-confidence or contested claims explicitly.
6. **Update navigation**:
   - Add every new formal page to `index.md` with a one-line summary.
   - Update index date/page count when formal pages change.
   - Append `log.md` with action, subject, and files touched.
7. **Verify** by reading changed snippets and confirming every new page is indexed and logged.
8. **Sync** is normally handled automatically by the on-change job. For urgent confirmation, run `/root/.hermes/scripts/peak-kb-obsidian-sync-on-change.sh` and report the result.

Completion criterion: raw source captured, formal pages updated, index/log updated, and sync either queued by change detection or manually verified.

## Query Workflow

Use this only after a valid search trigger.

1. Read `SCHEMA.md` and `index.md`.
2. Search relevant terms across `/root/Documents/峰的知识库/**/*.md`.
3. Read the relevant pages, not just filenames or snippets.
4. Answer with references to `[[page-name]]` where useful.
5. Do not file the answer back into the KB unless the user also gives a valid write trigger.

Completion criterion: answer is grounded in specific KB pages and does not silently create new notes.

## Link Ingestion Rules

When the user provides a video/article/image-text link and asks to write it into the KB:

- **Article/image-text links:** extract title, author, publication time, body text, image captions/alt text where available, and important quoted claims.
- **Video links:** use `claude-real-video` where possible. Inspect `MANIFEST.txt`, `transcript.txt`, and `grids/`/keyframes when visual details matter.
- **Evidence discipline:** preserve raw extraction and cite it from formal pages. Do not invent inaccessible content.
- **Failure mode:** if a source is gated, blocked, or extraction fails, report exactly what failed and ask for a file/cookie/alternate source if needed.

## Sync Operations

Current sync model:

- Old daily fixed-time sync has been removed.
- Active job: `峰的知识库 Obsidian 本地变更触发同步`.
- Job ID as of creation: `3338b8c51383`.
- It runs every 5 minutes and checks content hash.
- No local changes → silent exit.
- Local changes → run Obsidian Headless sync and notify 峰峰.
- Script: `/root/.hermes/scripts/peak-kb-obsidian-sync-on-change.sh`.

Manual sync / verification:

```bash
/root/.hermes/scripts/peak-kb-obsidian-sync-on-change.sh
ob sync-status --path "/root/Documents/峰的知识库"
```

The sync config should show:

```text
Vault: 峰的知识库（远程） (ecb1b3a6f43a58c5f1a2d60da21ef69d)
Location: /root/Documents/峰的知识库
Sync mode: bidirectional
Conflict strategy: merge
Device name: Hermes-Agent
```

## Rule Update Workflow

When 峰峰 asks to supplement KB rules:

1. Read current `SCHEMA.md` and `log.md`.
2. Patch `SCHEMA.md` in the relevant section; avoid duplicating old wording.
3. Append a dated `log.md` entry.
4. Update this skill too if the new rule affects recurring behavior.
5. Run the on-change sync script to push the rule update.
6. Report files changed and sync result.

Completion criterion: SCHEMA, log, and this skill all agree.

## Common Pitfalls

1. **Writing without a trigger phrase.** Do not treat “remember this” or normal discussion as KB write permission unless it includes 写入/存入/存到知识库.
2. **Searching by default.** Do not consult the KB for ordinary answers unless the user says 结合/根据/查询知识库.
3. **Link-title hallucination.** Never write a link based only on title, unfurled preview, or guesswork.
4. **Forgetting raw capture.** Formal pages should point back to raw extracted material when the write is based on a source.
5. **Skipping index/log.** A page that is not indexed and logged degrades the wiki.
6. **Remote deletion risk.** Bidirectional sync can propagate deletions; ask before deleting files or mirror-overwriting remote content.
7. **Stale rule drift.** When SCHEMA changes, update this skill; when this skill changes behavior, verify SCHEMA does not contradict it.

## Verification Checklist

- [ ] Valid trigger phrase checked for write or search.
- [ ] `SCHEMA.md`, `index.md`, and recent `log.md` read before KB operation.
- [ ] Link/video content parsed before write; video uses `claude-real-video` when appropriate.
- [ ] Raw source saved under `raw/` for source-based writes.
- [ ] Formal pages use Markdown, YAML frontmatter, tags from schema, and `[[wikilinks]]`.
- [ ] New pages are added to `index.md`.
- [ ] `log.md` records every write/rule update/lint/sync change.
- [ ] On-change sync job or manual sync has pushed updates to `峰的知识库（远程）` when needed.
