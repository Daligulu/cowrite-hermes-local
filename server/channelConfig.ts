import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import type { ChannelConfig, ChannelConfigFile } from '../shared/types.js'

export const channelConfigSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(100),
  type: z.enum(['local-files', 'openapi-script', 'public-api']),
  enabled: z.boolean().default(true),
  description: z.string().max(500).optional(),
  params: z.record(z.string(), z.string()).default({}),
})

export const channelConfigFileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().optional(),
  channels: z.array(channelConfigSchema).min(1),
})

/** 写作前选题的默认渠道：obsidian（本地文件）/ ima（OpenAPI 脚本）/ aihot（公开 API） */
export const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    id: 'obsidian',
    label: 'Obsidian 仓库',
    type: 'local-files',
    enabled: true,
    description: '本地 Obsidian 笔记仓库，直接搜索 vault 内容收集选题线索',
    params: {
      vaultPath: '/root/Documents/Obsidian Vault',
      searchScope: '全部',
    },
  },
  {
    id: 'ima',
    label: 'IMA 知识库',
    type: 'openapi-script',
    enabled: true,
    description: '腾讯 IMA 笔记与知识库（需要 ~/.config/ima 凭证）',
    params: {
      script: 'ima_api.cjs',
      credentialRef: '~/.config/ima',
    },
  },
  {
    id: 'aihot',
    label: 'AI HOT 热点',
    type: 'public-api',
    enabled: true,
    description: '中文 AI 资讯热点（公开只读 API，无需凭证）',
    params: {
      baseUrl: 'https://aihot.virxact.com/api/public',
      mode: 'selected',
      take: '30',
    },
  },
]

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export function parseChannelConfig(serialized: string): ChannelConfigFile {
  const parsed = channelConfigFileSchema.parse(JSON.parse(serialized))
  return {
    version: 1,
    updatedAt: parsed.updatedAt,
    channels: parsed.channels,
  }
}

function defaultFile(): ChannelConfigFile {
  return {
    version: 1,
    channels: structuredClone(DEFAULT_CHANNELS),
  }
}

export class ChannelConfigStore {
  private readonly filePath: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor(filePath = process.env.COWRITE_CHANNEL_CONFIG
    || path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'channel-config.json')) {
    this.filePath = filePath
  }

  async load(): Promise<ChannelConfigFile> {
    let serialized: string
    try {
      serialized = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) return defaultFile()
      throw error
    }
    try {
      return parseChannelConfig(serialized)
    } catch {
      const backupFile = `${this.filePath}.corrupt-${Date.now()}-${randomUUID()}`
      try {
        await rename(this.filePath, backupFile)
      } catch (error) {
        if (!isMissingFile(error)) throw error
      }
      return defaultFile()
    }
  }

  async save(config: ChannelConfigFile): Promise<ChannelConfigFile> {
    const validated = parseChannelConfig(JSON.stringify(config))
    validated.updatedAt = new Date().toISOString()
    const operation = this.writeChain.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(validated, null, 2), 'utf8')
    })
    this.writeChain = operation
    await operation
    return validated
  }

  async reset(): Promise<ChannelConfigFile> {
    return this.save(defaultFile())
  }

  async enabledChannels(): Promise<ChannelConfig[]> {
    const config = await this.load()
    return config.channels.filter((channel) => channel.enabled)
  }

  async channelById(channelId: string): Promise<ChannelConfig | undefined> {
    const config = await this.load()
    return config.channels.find((channel) => channel.id === channelId)
  }
}
