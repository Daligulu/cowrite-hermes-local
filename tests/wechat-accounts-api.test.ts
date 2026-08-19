import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../server/app.js'
import { CowriteService } from '../server/service.js'
import { JsonStore } from '../server/store.js'
import { ActionConfigStore } from '../server/actionConfig.js'
import { WechatAccountsStore } from '../server/wechatAccounts.js'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-wechat-api-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

function testApp() {
  const store = new JsonStore(path.join(directory, 'cowrite.json'))
  const actionConfig = new ActionConfigStore(path.join(directory, 'action-config.json'))
  const wechatAccounts = new WechatAccountsStore(path.join(directory, 'wechat-accounts.json'))
  return createApp(new CowriteService(store), undefined, undefined, undefined, actionConfig, wechatAccounts)
}

async function authed(app: ReturnType<typeof testApp>) {
  const token = (await request(app).get('/api/session').expect(200)).body.token as string
  return { token, host: '127.0.0.1:4320', origin: 'http://127.0.0.1:4321', site: 'same-origin' }
}

describe('wechat accounts API', () => {
  it('returns accounts on GET with secret masked', async () => {
    const app = testApp()
    const auth = await authed(app)
    await request(app)
      .put('/api/wechat-accounts')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send({ accounts: [{ id: 'dog', label: '狗狗生活小百科', appId: 'wx123', secret: 'secret-dog' }] })
      .expect(200)
    const response = await request(app).get('/api/wechat-accounts').expect(200)
    expect(response.body.accounts).toHaveLength(1)
    expect(response.body.accounts[0]).toMatchObject({ id: 'dog', label: '狗狗生活小百科', appId: 'wx123', secretSet: true })
    expect(response.body.accounts[0].secret).toBeUndefined()
  })

  it('rejects PUT without a session token', async () => {
    const app = testApp()
    await request(app)
      .put('/api/wechat-accounts')
      .send({ accounts: [{ id: 'dog', label: '狗狗生活小百科', appId: 'wx123', secret: 'secret-dog' }] })
      .expect(403)
  })

  it('keeps the previous secret when the update omits it', async () => {
    const app = testApp()
    const auth = await authed(app)
    await request(app)
      .put('/api/wechat-accounts')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send({ accounts: [{ id: 'dog', label: '狗狗生活小百科', appId: 'wx123', secret: 'secret-dog' }] })
      .expect(200)
    await request(app)
      .put('/api/wechat-accounts')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send({ accounts: [{ id: 'dog', label: '狗狗生活小百科（改名）', appId: 'wx123' }] })
      .expect(200)
    const response = await request(app).get('/api/wechat-accounts').expect(200)
    expect(response.body.accounts[0].label).toBe('狗狗生活小百科（改名）')
    expect(response.body.accounts[0].secretSet).toBe(true)
  })

  it('rejects a new account without a secret', async () => {
    const app = testApp()
    const auth = await authed(app)
    await request(app)
      .put('/api/wechat-accounts')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send({ accounts: [{ id: 'new', label: '新账号', appId: 'wx999' }] })
      .expect(400)
  })

  it('persists multiple accounts and replaces the list', async () => {
    const app = testApp()
    const auth = await authed(app)
    await request(app)
      .put('/api/wechat-accounts')
      .set('Host', auth.host)
      .set('Origin', auth.origin)
      .set('Sec-Fetch-Site', auth.site)
      .set('X-Cowrite-Token', auth.token)
      .send({ accounts: [
        { id: 'dog', label: '狗狗生活小百科', appId: 'wx123', secret: 'secret-dog' },
        { id: 'default', label: '峰AI路', appId: 'wx456', secret: 'secret-feng' },
      ] })
      .expect(200)
    const response = await request(app).get('/api/wechat-accounts').expect(200)
    expect(response.body.accounts.map((account: any) => account.id).sort()).toEqual(['default', 'dog'])
  })
})
