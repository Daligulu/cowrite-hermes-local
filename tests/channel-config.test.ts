import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ChannelConfigStore, DEFAULT_CHANNELS } from '../server/channelConfig.js'

let directory: string
let store: ChannelConfigStore

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-channels-'))
  store = new ChannelConfigStore(path.join(directory, 'channel-config.json'))
})

afterEach(async () => rm(directory, { recursive: true, force: true }))

describe('Channel config', () => {
  it('exposes the 3 default channels (obsidian / ima / aihot)', async () => {
    const config = await store.load()
    expect(config.channels).toHaveLength(3)
    const byId = Object.fromEntries(config.channels.map((channel) => [channel.id, channel]))
    expect(byId['obsidian'].type).toBe('local-files')
    expect(byId['ima'].type).toBe('openapi-script')
    expect(byId['aihot'].type).toBe('public-api')
    expect(byId['obsidian'].params.vaultPath).toBeTruthy()
  })

  it('returns defaults when the file does not exist', async () => {
    const config = await store.load()
    expect(config.version).toBe(1)
    expect(config.channels[0]?.id).toBe('obsidian')
  })

  it('persists a saved config and returns it on load', async () => {
    const custom = structuredClone(await store.load())
    custom.channels.push({
      id: 'x-hot',
      label: 'X 热点',
      type: 'public-api',
      enabled: true,
      description: 'X/Twitter 热点',
      params: { baseUrl: 'https://example.com' },
    })
    await store.save(custom)
    const reloaded = await store.load()
    expect(reloaded.channels.map((channel) => channel.id)).toContain('x-hot')
  })

  it('rejects invalid configs on save', async () => {
    const invalid = structuredClone(await store.load()) as any
    invalid.channels[0]!.label = ''
    await expect(store.save(invalid)).rejects.toThrow()
    invalid.channels[0]!.label = 'Obsidian 仓库'
    invalid.channels[0]!.type = 'not-a-type'
    await expect(store.save(invalid)).rejects.toThrow()
  })

  it('backs up a corrupt file and falls back to defaults', async () => {
    await writeFile(path.join(directory, 'channel-config.json'), '{{{ not json', 'utf8')
    const config = await store.load()
    expect(config.channels).toHaveLength(3)
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(directory)
    const backup = entries.find((name) => name.startsWith('channel-config.json.corrupt-'))
    expect(backup).toBeTruthy()
  })

  it('resets to defaults and respects enabled filter', async () => {
    const custom = structuredClone(await store.load()) as any
    custom.channels[0]!.enabled = false
    await store.save(custom)
    expect(await store.enabledChannels()).toHaveLength(2)
    await store.reset()
    expect(await store.enabledChannels()).toHaveLength(3)
  })

  it('resolves a channel by id', async () => {
    expect((await store.channelById('aihot'))?.type).toBe('public-api')
    expect(await store.channelById('no-such')).toBeUndefined()
  })
})

describe('Default channels', () => {
  it('contains unique ids and valid shapes', () => {
    const ids = DEFAULT_CHANNELS.map((channel) => channel.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const channel of DEFAULT_CHANNELS) {
      expect(channel.label.length).toBeGreaterThan(0)
      expect(['local-files', 'openapi-script', 'public-api']).toContain(channel.type)
      expect(channel.params).toBeTruthy()
    }
  })
})
