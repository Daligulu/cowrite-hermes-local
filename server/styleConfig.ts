import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import type { StyleConfig, StyleConfigFile, StylePreset } from '../shared/types.js'

export const stylePresetSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const styleConfigSchema = z.object({
  writing: z.array(stylePresetSchema).default([]),
  layout: z.array(stylePresetSchema).default([]),
  image: z.array(stylePresetSchema).default([]),
})

export const styleConfigFileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().optional(),
  styles: styleConfigSchema,
})

/** 写作前选题的默认风格库：写作 / 排版 / 配图三类预设 */
export const DEFAULT_STYLES: StyleConfig = {
  writing: [
    { id: 'howto', label: '干货教程', description: '步骤清晰、可执行性强、结构分明' },
    { id: 'deep-comment', label: '深度评论', description: '观点鲜明、有分析纵深、行业视角' },
    { id: 'casual', label: '轻松口语', description: '像朋友聊天、口语化、易读' },
    { id: 'story', label: '故事叙事', description: '用故事和场景带入、有画面感' },
    { id: 'brief', label: '极简短讯', description: '短平快、信息密度高、要点前置' },
  ],
  layout: [
    { id: 'graphite-minimal', label: '石墨极简', description: '黑白灰极简、留白多、阅读舒适（默认·16px/行高1.75/段距24px）' },
    { id: 'moyu-green', label: '摸鱼绿', description: '青绿主色、轻松自然、适合生活/工具类' },
    { id: 'red-white', label: '红白色系', description: '正红点缀、干净利落、适合活动/产品类' },
    { id: 'zen-whitespace', label: '留白禅意', description: '墨绿大留白、沉稳安静、适合长文/深度' },
    { id: 'moyu-ticket', label: '摸鱼票据', description: '票据风、灰底卡片、适合清单/攻略类' },
    { id: 'olive-journal', label: '橄榄手记', description: '橄榄墨色+橙点缀、手记质感、适合复盘/日记类' },
  ],
  image: [
    { id: 'anime-fresh', label: '日系清新', description: '清新明亮动漫感，自然光线' },
    { id: 'flat-illustration', label: '扁平插画', description: '扁平插画、色块干净' },
    { id: '3d-render', label: '3D 质感', description: '3D 渲染质感、光影立体' },
    { id: 'photoreal', label: '摄影写实', description: '写实摄影感、真实场景' },
    { id: 'guofeng-ink', label: '国风水墨', description: '水墨晕染、留白写意、东方意境' },
  ],
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export function parseStyleConfig(serialized: string): StyleConfigFile {
  const parsed = styleConfigFileSchema.parse(JSON.parse(serialized))
  return {
    version: 1,
    updatedAt: parsed.updatedAt,
    styles: parsed.styles,
  }
}

function defaultFile(): StyleConfigFile {
  return {
    version: 1,
    styles: structuredClone(DEFAULT_STYLES),
  }
}

export class StyleConfigStore {
  private readonly filePath: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor(filePath = process.env.COWRITE_STYLE_CONFIG
    || path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'style-config.json')) {
    this.filePath = filePath
  }

  async load(): Promise<StyleConfigFile> {
    let serialized: string
    try {
      serialized = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) return defaultFile()
      throw error
    }
    try {
      return parseStyleConfig(serialized)
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

  async save(config: StyleConfigFile): Promise<StyleConfigFile> {
    const validated = parseStyleConfig(JSON.stringify(config))
    validated.updatedAt = new Date().toISOString()
    const operation = this.writeChain.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(validated, null, 2), 'utf8')
    })
    this.writeChain = operation
    await operation
    return validated
  }

  async reset(): Promise<StyleConfigFile> {
    return this.save(defaultFile())
  }

  async presets(category: 'writing' | 'layout' | 'image'): Promise<StylePreset[]> {
    const config = await this.load()
    return config.styles[category] ?? []
  }
}
