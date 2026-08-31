import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../server/app.js'
import { CowriteService } from '../server/service.js'
import { JsonStore } from '../server/store.js'
import { ActionConfigStore } from '../server/actionConfig.js'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-action-api-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

function testApp() {
  const store = new JsonStore(path.join(directory, 'cowrite.json'))
  const actionConfig = new ActionConfigStore(path.join(directory, 'action-config.json'))
  return createApp(new CowriteService(store), undefined, undefined, undefined, actionConfig)
}

async function mutationToken(app: ReturnType<typeof testApp>): Promise<string> {
  return (await request(app).get('/api/session').expect(200)).body.token as string
}

async function authed(app: ReturnType<typeof testApp>) {
  const token = await mutationToken(app)
  return { token, host: '127.0.0.1:4320', origin: 'http://127.0.0.1:4321', site: 'same-origin' }
}

describe('action config API', () => {
  it('returns the default action config on GET', async () => {
    const app = testApp()
    const response = await request(app).get('/api/action-config').expect(200)
    expect(response.body.config.actions).toHaveLength(23)
    expect(response.body.config.actions[0]).toMatchObject({ id: 'polish', skills: ['humanizer-zh'] })
    expect(response.body.config.actions.map((action: any) => action.id)).toContain('wechat-sticker')
    expect(response.body.config.actions.map((action: any) => action.id)).toContain('publish-sticker')
    expect(response.body.config.actions.map((action: any) => action.id)).toContain('topic-collect')
    expect(response.body.config.actions.map((action: any) => action.id)).toContain('topic-create')
  })

  it('rejects PUT without a session token', async () => {
    const app = testApp()
    const current = (await request(app).get('/api/action-config').expect(200)).body.config
    await request(app).put('/api/action-config').send(current).expect(403)
  })

  it('persists a customized config on PUT with token', async () => {
    const app = testApp()
    const auth = await authed(app)
    const current = (await request(app).get('/api/action-config').expect(200)).body.config
    current.actions[0].skills = ['humanizer-zh', 'wewrite']
    current.actions[0].keywords = ['润色', '自然', '口语']
    current.actions.push({
      id: 'custom-test',
      label: '自定义测试',
      enabled: true,
      chip: true,
      keywords: ['自定义'],
      skills: ['wewrite'],
      prompts: [{ id: 'main', role: 'system', text: '执行自定义测试' }],
      workflow: [{ step: 'process', skill: 'wewrite', input: 'page', output: 'text' }],
    })
    await request(app)
      .put('/api/action-config')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send(current)
      .expect(200)
    const reloaded = (await request(app).get('/api/action-config').expect(200)).body.config
    expect(reloaded.actions[0].skills).toEqual(['humanizer-zh', 'wewrite'])
    expect(reloaded.actions.map((action: any) => action.id)).toContain('custom-test')
  })

  it('rejects an invalid config on PUT', async () => {
    const app = testApp()
    const auth = await authed(app)
    const current = (await request(app).get('/api/action-config').expect(200)).body.config
    current.actions[0].skills = 'not-an-array'
    await request(app)
      .put('/api/action-config')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send(current)
      .expect(400)
  })

  it('resets to defaults via POST reset', async () => {
    const app = testApp()
    const auth = await authed(app)
    const current = (await request(app).get('/api/action-config').expect(200)).body.config
    current.actions[0].skills = ['wewrite']
    await request(app)
      .put('/api/action-config')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send(current)
      .expect(200)
    await request(app)
      .post('/api/action-config/reset')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .expect(200)
    const reloaded = (await request(app).get('/api/action-config').expect(200)).body.config
    expect(reloaded.actions[0].skills).toEqual(['humanizer-zh'])
  })

  it('accepts tasks with custom action ids (no longer enum-bound)', async () => {
    const app = testApp()
    const auth = await authed(app)
    const response = await request(app)
      .post('/api/tasks')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send({ action: 'my-custom-action', pageId: 'page_x' })
      .expect(201)
    expect(response.body.action).toBe('my-custom-action')
    expect(response.body.recommendedSkills).toEqual([])
  })
})
