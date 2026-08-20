import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { exportPagesToDrafts, sanitizeTitle } from '../server/exportPages.js'
import type { Page } from '../shared/types.js'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-export-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const page = (partial: Partial<Page>): Page => ({
  id: 'page_test',
  title: '测试页面',
  content: '# 标题\n\n正文',
  revision: 1,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  ...partial,
})

describe('sanitizeTitle', () => {
  it('cleans invalid filename characters', () => {
    expect(sanitizeTitle('草稿·Hermes/实战:指南?*<>|"')).toBe('草稿·Hermes-实战-指南------')
  })

  it('trims trailing dots and spaces', () => {
    expect(sanitizeTitle('标题。. ')).toBe('标题。')
  })

  it('falls back for empty titles', () => {
    expect(sanitizeTitle('')).toBe('未命名页面')
  })

  it('caps length at 80 chars', () => {
    expect(sanitizeTitle('x'.repeat(120))).toHaveLength(80)
  })
})

describe('exportPagesToDrafts', () => {
  it('writes pages as markdown files with page id meta', async () => {
    const drafts = path.join(directory, '草稿')
    const count = await exportPagesToDrafts([page({ id: 'page_abc', title: '第一篇' })], drafts)
    expect(count).toBe(1)
    const content = await readFile(path.join(drafts, '第一篇.md'), 'utf8')
    expect(content).toContain('<!-- cowrite-page: page_abc -->')
    expect(content).toContain('# 标题')
  })

  it('appends numeric suffix for duplicate titles', async () => {
    const drafts = path.join(directory, '草稿')
    await exportPagesToDrafts([
      page({ id: 'page_a', title: '同名' }),
      page({ id: 'page_b', title: '同名' }),
    ], drafts)
    const files = (await readdir(drafts)).sort()
    expect(files).toEqual(['同名-2.md', '同名.md'])
  })

  it('keeps existing files untouched and avoids overwrite', async () => {
    const drafts = path.join(directory, '草稿')
    await exportPagesToDrafts([page({ id: 'page_a', title: '已有' })], drafts)
    await exportPagesToDrafts([page({ id: 'page_b', title: '已有' })], drafts)
    const files = (await readdir(drafts)).sort()
    expect(files).toEqual(['已有-2.md', '已有.md'])
    const original = await readFile(path.join(drafts, '已有.md'), 'utf8')
    expect(original).toContain('page_a')
  })
})
