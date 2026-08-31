import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ActionConfigStore, DEFAULT_ACTIONS } from '../server/actionConfig.js'

let directory: string
let store: ActionConfigStore

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-actions-'))
  store = new ActionConfigStore(path.join(directory, 'action-config.json'))
})

afterEach(async () => rm(directory, { recursive: true, force: true }))

describe('Action config', () => {
  it('exposes the 18 default actions matching the legacy hardcoded skill map', async () => {
    const config = await store.load()
    expect(config.actions).toHaveLength(20)
    const byId = Object.fromEntries(config.actions.map((action) => [action.id, action]))
    expect(byId['polish'].skills).toEqual(['humanizer-zh'])
    expect(byId['illustrate'].skills).toEqual(['apiyi-image-generation'])
    expect(byId['feng-ip'].skills).toEqual(['feng-ip'])
    expect(byId['slides'].skills).toEqual(['dashiai-ppt'])
    expect(byId['wechat-layout'].skills).toEqual(['wewrite'])
    expect(byId['xiaohongshu'].skills).toEqual(['xiaohongshu', 'apiyi-image-generation'])
    expect(byId['feishu-doc'].skills).toEqual(['lark-doc'])
    expect(byId['knowledge-base'].skills).toEqual(['feng-knowledge-base'])
    expect(byId['video'].skills).toEqual(['feng-video'])
    expect(byId['polish'].chip).toBe(true)
    expect(byId['feng-ip'].chip).toBe(false)
  })

  it('includes the topic-collect and topic-create actions with the right skills', async () => {
    const config = await store.load()
    const byId = Object.fromEntries(config.actions.map((action) => [action.id, action]))
    expect(byId['topic-collect']).toBeTruthy()
    expect(byId['topic-collect']!.chip).toBe(true)
    expect(byId['topic-collect']!.keywords).toContain('选题')
    expect(byId['topic-collect']!.skills).toEqual(['obsidian', 'ima', 'aihot'])
    expect(byId['topic-create']).toBeTruthy()
    expect(byId['topic-create']!.skills).toEqual(['humanizer-zh', 'apiyi-image-generation'])
  })

  it('returns defaults when the file does not exist', async () => {
    const config = await store.load()
    expect(config.version).toBe(1)
    expect(config.actions[0]?.id).toBe('polish')
  })

  it('persists a saved config and returns it on load', async () => {
    const custom = structuredClone(await store.load())
    custom.actions[0]!.skills = ['humanizer-zh', 'wewrite']
    custom.actions[0]!.keywords = ['润色', '口语化', '自然']
    custom.actions[0]!.workflow = [
      { step: 'process', skill: 'humanizer-zh', prompt: 'main', input: 'page', output: 'text' },
      { step: 'write', input: 'text', output: 'page' },
    ]
    custom.actions.push({
      id: 'my-custom-action',
      label: '自定义动作',
      enabled: true,
      chip: true,
      keywords: ['自定义'],
      skills: ['wewrite'],
      prompts: [{ id: 'main', role: 'system', text: '执行自定义动作' }],
      workflow: [],
    })
    await store.save(custom)

    const reloaded = await store.load()
    expect(reloaded.actions[0]!.skills).toEqual(['humanizer-zh', 'wewrite'])
    expect(reloaded.actions[0]!.workflow).toHaveLength(2)
    expect(reloaded.actions.map((action) => action.id)).toContain('my-custom-action')
  })

  it('rejects invalid configs on save', async () => {
    const invalid = structuredClone(await store.load()) as any
    invalid.actions[0]!.label = '' // label required
    await expect(store.save(invalid)).rejects.toThrow()
    invalid.actions[0]!.label = '润色文章'
    invalid.actions[0]!.skills = 'not-an-array' // must be array
    await expect(store.save(invalid)).rejects.toThrow()
    invalid.actions[0]!.skills = ['humanizer-zh']
    invalid.actions[0]!.workflow = [{ step: 'unknown-step' }] // invalid step type
    await expect(store.save(invalid)).rejects.toThrow()
  })

  it('backs up a corrupt file and falls back to defaults', async () => {
    await writeFile(path.join(directory, 'action-config.json'), '{{{ not json', 'utf8')
    const config = await store.load()
    expect(config.actions).toHaveLength(20)
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(directory)
    const backup = entries.find((name) => name.startsWith('action-config.json.corrupt-'))
    expect(backup).toBeTruthy()
  })

  it('resets to defaults', async () => {
    const custom = structuredClone(await store.load()) as any
    custom.actions[0]!.skills = ['wewrite']
    await store.save(custom)
    await store.reset()
    const reloaded = await store.load()
    expect(reloaded.actions[0]!.skills).toEqual(['humanizer-zh'])
  })

  it('resolves skills for an action id, defaulting to empty for unknown ids', async () => {
    expect(await store.skillsFor('polish')).toEqual(['humanizer-zh'])
    expect(await store.skillsFor('no-such-action')).toEqual([])
  })

  it('supports disabled actions in the list', async () => {
    const custom = structuredClone(await store.load()) as any
    custom.actions[0]!.enabled = false
    await store.save(custom)
    const reloaded = await store.load()
    expect(reloaded.actions[0]!.enabled).toBe(false)
  })
})

describe('Default actions', () => {
  it('contains unique ids and valid shapes', () => {
    const ids = DEFAULT_ACTIONS.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const action of DEFAULT_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0)
      expect(Array.isArray(action.skills)).toBe(true)
      expect(Array.isArray(action.keywords)).toBe(true)
      expect(Array.isArray(action.prompts)).toBe(true)
      expect(Array.isArray(action.workflow)).toBe(true)
    }
  })
})
