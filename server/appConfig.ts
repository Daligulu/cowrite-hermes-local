import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'

/** 任务完成提示默认自动消失时长（秒） */
export const DEFAULT_AUTO_HIDE_SECONDS = 30

export const appConfigFileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().optional(),
  autoHideSeconds: z.number().int().min(3).max(600),
})

export interface AppConfigFile {
  version: 1
  updatedAt?: string
  autoHideSeconds: number
}

export function parseAppConfig(serialized: string): AppConfigFile {
  const parsed = appConfigFileSchema.parse(JSON.parse(serialized))
  return {
    version: 1,
    updatedAt: parsed.updatedAt,
    autoHideSeconds: parsed.autoHideSeconds,
  }
}

function defaultFile(): AppConfigFile {
  return {
    version: 1,
    autoHideSeconds: DEFAULT_AUTO_HIDE_SECONDS,
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export class AppConfigStore {
  private readonly filePath: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor(filePath = process.env.COWRITE_APP_CONFIG
    || path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'app-config.json')) {
    this.filePath = filePath
  }

  async load(): Promise<AppConfigFile> {
    let serialized: string
    try {
      serialized = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) return defaultFile()
      throw error
    }
    try {
      return parseAppConfig(serialized)
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

  async save(config: AppConfigFile): Promise<AppConfigFile> {
    const validated = parseAppConfig(JSON.stringify(config))
    validated.updatedAt = new Date().toISOString()
    const operation = this.writeChain.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(validated, null, 2), 'utf8')
    })
    this.writeChain = operation
    await operation
    return validated
  }

  async reset(): Promise<AppConfigFile> {
    return this.save(defaultFile())
  }
}
