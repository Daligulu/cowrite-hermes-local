import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../server/app.js'
import { CowriteService } from '../server/service.js'
import { JsonStore } from '../server/store.js'
import { ChannelConfigStore } from '../server/channelConfig.js'
import { StyleConfigStore } from '../server/styleConfig.js'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-channel-api-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

function testApp() {
  const store = new JsonStore(path.join(directory, 'cowrite.json'))
  return createApp(
    new CowriteService(store),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    new ChannelConfigStore(path.join(directory, 'channel-config.json')),
    new StyleConfigStore(path.join(directory, 'style-config.json')),
  )
}

async function authed(app: ReturnType<typeof testApp>) {
  const token = (await request(app).get('/api/session').expect(200)).body.token as string
  return { token, host: '127.0.0.1:4320', origin: 'http://127.0.0.1:4321', site: 'same-origin' }
}

describe('channel config API', () => {
  it('returns the default channels on GET (no auth needed)', async () => {
    const app = testApp()
    const response = await request(app).get('/api/channel-config').expect(200)
    expect(response.body.config.channels).toHaveLength(3)
    expect(response.body.config.channels.map((channel: any) => channel.id)).toEqual(['obsidian', 'ima', 'aihot'])
  })

  it('rejects PUT without a session token', async () => {
    const app = testApp()
    const current = (await request(app).get('/api/channel-config').expect(200)).body.config
    await request(app).put('/api/channel-config').send(current).expect(403)
  })

  it('persists a customized channel config on PUT with token', async () => {
    const app = testApp()
    const auth = await authed(app)
    const current = (await request(app).get('/api/channel-config').expect(200)).body.config
    current.channels[0].enabled = false
    current.channels.push({
      id: 'x-hot',
      label: 'X 热点',
      type: 'public-api',
      enabled: true,
      description: '测试渠道',
      params: { baseUrl: 'https://example.com' },
    })
    await request(app)
      .put('/api/channel-config')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send(current)
      .expect(200)
    const reloaded = (await request(app).get('/api/channel-config').expect(200)).body.config
    expect(reloaded.channels[0].enabled).toBe(false)
    expect(reloaded.channels.map((channel: any) => channel.id)).toContain('x-hot')
  })

  it('rejects an invalid config on PUT', async () => {
    const app = testApp()
    const auth = await authed(app)
    const current = (await request(app).get('/api/channel-config').expect(200)).body.config
    current.channels[0].type = 'not-a-type'
    await request(app)
      .put('/api/channel-config')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send(current)
      .expect(400)
  })

  it('resets to defaults via POST /reset', async () => {
    const app = testApp()
    const auth = await authed(app)
    const current = (await request(app).get('/api/channel-config').expect(200)).body.config
    current.channels = current.channels.slice(0, 1)
    await request(app)
      .put('/api/channel-config')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send(current)
      .expect(200)
    await request(app)
      .post('/api/channel-config/reset')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .expect(200)
    const reloaded = (await request(app).get('/api/channel-config').expect(200)).body.config
    expect(reloaded.channels).toHaveLength(3)
  })
})

describe('style config API', () => {
  it('returns the default style library on GET (no auth needed)', async () => {
    const app = testApp()
    const response = await request(app).get('/api/style-config').expect(200)
    expect(response.body.config.styles.writing.length).toBeGreaterThan(0)
    expect(response.body.config.styles.layout.length).toBeGreaterThan(0)
    expect(response.body.config.styles.image.length).toBeGreaterThan(0)
  })

  it('rejects PUT without a session token', async () => {
    const app = testApp()
    const current = (await request(app).get('/api/style-config').expect(200)).body.config
    await request(app).put('/api/style-config').send(current).expect(403)
  })

  it('persists a customized style config on PUT with token', async () => {
    const app = testApp()
    const auth = await authed(app)
    const current = (await request(app).get('/api/style-config').expect(200)).body.config
    current.styles.writing.push({ id: 'custom-style', label: '自定义风格', description: '测试' })
    await request(app)
      .put('/api/style-config')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send(current)
      .expect(200)
    const reloaded = (await request(app).get('/api/style-config').expect(200)).body.config
    expect(reloaded.styles.writing.map((preset: any) => preset.id)).toContain('custom-style')
  })

  it('rejects an invalid config on PUT', async () => {
    const app = testApp()
    const auth = await authed(app)
    const current = (await request(app).get('/api/style-config').expect(200)).body.config
    current.styles.layout = 'not-an-array'
    await request(app)
      .put('/api/style-config')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send(current)
      .expect(400)
  })

  it('resets to defaults via POST /reset', async () => {
    const app = testApp()
    const auth = await authed(app)
    const current = (await request(app).get('/api/style-config').expect(200)).body.config
    current.styles.writing = []
    await request(app)
      .put('/api/style-config')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send(current)
      .expect(200)
    await request(app)
      .post('/api/style-config/reset')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .expect(200)
    const reloaded = (await request(app).get('/api/style-config').expect(200)).body.config
    expect(reloaded.styles.writing.length).toBeGreaterThan(0)
  })
})
