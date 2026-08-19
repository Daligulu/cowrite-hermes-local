import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import type { WechatAccount, WechatAccountsFile, WechatAccountView } from '../shared/types.js'

export const wechatAccountSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(100),
  appId: z.string().min(1).max(200),
  secret: z.string().min(1).max(500),
})

export const wechatAccountsFileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().optional(),
  accounts: z.array(wechatAccountSchema).min(1),
})

export type WechatAccountInput = Omit<WechatAccount, 'secret'> & { secret?: string }

const HERMES_ENV = '/root/.hermes/.env'

function parseEnvFile(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    if (!key) continue
    result[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
  }
  return result
}

/** 从 /root/.hermes/.env 迁移已有微信凭据作为默认账号（dog / default） */
export async function defaultAccountsFromEnv(): Promise<WechatAccount[]> {
  const accounts: WechatAccount[] = []
  try {
    const env = parseEnvFile(await readFile(HERMES_ENV, 'utf8'))
    const dogAppId = env.DOG_WECHAT_APPID || env.WECHAT_APP_ID_DOG
    const dogSecret = env.DOG_WECHAT_SECRET || env.WECHAT_APP_SECRET_DOG
    if (dogAppId && dogSecret) {
      accounts.push({ id: 'dog', label: '狗狗生活小百科', appId: dogAppId, secret: dogSecret })
    }
    const fengAppId = env.WECHAT_APP_ID_DEFAULT || env.WECHAT_APP_ID || env.FENGAI_WECHAT_APPID
    const fengSecret = env.WECHAT_APP_SECRET_DEFAULT || env.WECHAT_APP_SECRET || env.FENGAI_WECHAT_SECRET
    if (fengAppId && fengSecret) {
      accounts.push({ id: 'default', label: '峰AI路', appId: fengAppId, secret: fengSecret })
    }
  } catch {
    // .env 不存在或不可读 → 返回空数组（调用方兜底）
  }
  return accounts
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export function parseWechatAccounts(serialized: string): WechatAccountsFile {
  return wechatAccountsFileSchema.parse(JSON.parse(serialized))
}

export class WechatAccountsStore {
  private readonly filePath: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor(filePath = process.env.COWRITE_WECHAT_ACCOUNTS
    || path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'wechat-accounts.json')) {
    this.filePath = filePath
  }

  async load(): Promise<WechatAccountsFile> {
    let serialized: string
    try {
      serialized = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) {
        const defaults = await defaultAccountsFromEnv()
        if (defaults.length > 0) return this.save({ version: 1, accounts: defaults })
        return { version: 1, accounts: [{ id: 'default', label: '峰AI路', appId: '', secret: '' }] }
      }
      throw error
    }
    try {
      const parsed = parseWechatAccounts(serialized)
      return { version: 1, updatedAt: parsed.updatedAt, accounts: parsed.accounts }
    } catch {
      const backupFile = `${this.filePath}.corrupt-${Date.now()}-${randomUUID()}`
      try {
        await rename(this.filePath, backupFile)
      } catch (error) {
        if (!isMissingFile(error)) throw error
      }
      const defaults = await defaultAccountsFromEnv()
      if (defaults.length > 0) return this.save({ version: 1, accounts: defaults })
      return { version: 1, accounts: [{ id: 'default', label: '峰AI路', appId: '', secret: '' }] }
    }
  }

  async save(config: WechatAccountsFile): Promise<WechatAccountsFile> {
    const validated = wechatAccountsFileSchema.parse(config)
    validated.updatedAt = new Date().toISOString()
    const operation = this.writeChain.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(validated, null, 2), { encoding: 'utf8', mode: 0o600 })
      await chmod(this.filePath, 0o600)
    })
    this.writeChain = operation
    await operation
    return validated
  }

  /** 保存前端提交的账号列表：secret 为空时保留旧值（不覆盖） */
  async saveInput(inputs: WechatAccountInput[]): Promise<WechatAccountsFile> {
    const current = await this.load()
    const merged: WechatAccount[] = []
    for (const input of inputs) {
      const previous = current.accounts.find((account) => account.id === input.id)
      if (!input.secret && !previous) throw new Error(`账号 ${input.id} 缺少 Secret（新建账号必须填写）`)
      merged.push({
        id: input.id,
        label: input.label,
        appId: input.appId,
        secret: input.secret || previous?.secret || '',
      })
    }
    return this.save({ version: 1, accounts: merged })
  }

  async toViews(): Promise<WechatAccountView[]> {
    const config = await this.load()
    return config.accounts.map((account) => ({
      id: account.id,
      label: account.label,
      appId: account.appId,
      secretSet: Boolean(account.secret),
    }))
  }

  async accountById(id: string): Promise<WechatAccount | undefined> {
    const config = await this.load()
    return config.accounts.find((account) => account.id === id)
  }
}
