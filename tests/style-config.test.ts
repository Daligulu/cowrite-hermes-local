import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_STYLES, StyleConfigStore } from '../server/styleConfig.js'

let directory: string
let store: StyleConfigStore

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-styles-'))
  store = new StyleConfigStore(path.join(directory, 'style-config.json'))
})

afterEach(async () => rm(directory, { recursive: true, force: true }))

describe('Style config', () => {
  it('exposes the default style library with three categories', async () => {
    const config = await store.load()
    expect(config.styles.writing.length).toBeGreaterThan(0)
    expect(config.styles.layout.length).toBeGreaterThan(0)
    expect(config.styles.image.length).toBeGreaterThan(0)
    const byId = Object.fromEntries(config.styles.writing.map((preset) => [preset.id, preset]))
    expect(byId['howto'].label).toBe('干货教程')
    expect(config.styles.image.map((preset) => preset.id)).toContain('guofeng-ink')
  })

  it('returns defaults when the file does not exist', async () => {
    const config = await store.load()
    expect(config.version).toBe(1)
  })

  it('persists a saved config and returns it on load', async () => {
    const custom = structuredClone(await store.load())
    custom.styles.writing.push({ id: 'custom-style', label: '自定义风格', description: '测试' })
    await store.save(custom)
    const reloaded = await store.load()
    expect(reloaded.styles.writing.map((preset) => preset.id)).toContain('custom-style')
  })

  it('rejects invalid configs on save', async () => {
    const invalid = structuredClone(await store.load()) as any
    invalid.styles.writing = 'not-an-array'
    await expect(store.save(invalid)).rejects.toThrow()
  })

  it('backs up a corrupt file and falls back to defaults', async () => {
    await writeFile(path.join(directory, 'style-config.json'), '{{{ not json', 'utf8')
    const config = await store.load()
    expect(config.styles.writing.length).toBeGreaterThan(0)
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(directory)
    const backup = entries.find((name) => name.startsWith('style-config.json.corrupt-'))
    expect(backup).toBeTruthy()
  })

  it('resets to defaults', async () => {
    const custom = structuredClone(await store.load()) as any
    custom.styles.writing = []
    await store.save(custom)
    expect((await store.load()).styles.writing).toHaveLength(0)
    await store.reset()
    expect((await store.load()).styles.writing.length).toBeGreaterThan(0)
  })

  it('returns presets for a category', async () => {
    expect((await store.presets('layout')).length).toBe(DEFAULT_STYLES.layout.length)
  })
})
