import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import path from 'node:path'

interface SkilldeckPreferences {
  version: 1
  hiddenExpertsByDirectory: Record<string, string[]>
}

const EMPTY_PREFERENCES: SkilldeckPreferences = {
  version: 1,
  hiddenExpertsByDirectory: {},
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function parsePreferences(serialized: string): SkilldeckPreferences {
  const value = JSON.parse(serialized) as Partial<SkilldeckPreferences>
  if (value.version !== 1 || !value.hiddenExpertsByDirectory || Array.isArray(value.hiddenExpertsByDirectory)) {
    throw new Error('Cowrite Skill preferences are invalid')
  }

  const entries = Object.entries(value.hiddenExpertsByDirectory)
    .filter((entry): entry is [string, string[]] => (
      typeof entry[0] === 'string'
      && Array.isArray(entry[1])
      && entry[1].every((item) => typeof item === 'string')
    ))
  return {
    version: 1,
    hiddenExpertsByDirectory: Object.fromEntries(entries),
  }
}

export class LocalSkillPreferencesStore {
  private readonly filePath: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor(filePath = process.env.COWRITE_SKILLDECK_DATA
    || path.join(homedir(), '.cowrite', 'skilldeck-preferences.json')) {
    this.filePath = filePath
  }

  private async read(): Promise<SkilldeckPreferences> {
    let serialized: string
    try {
      serialized = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) return structuredClone(EMPTY_PREFERENCES)
      throw error
    }
    try {
      return parsePreferences(serialized)
    } catch {
      const backupFile = `${this.filePath}.corrupt-${Date.now()}-${randomUUID()}`
      try {
        await rename(this.filePath, backupFile)
      } catch (error) {
        if (!isMissingFile(error)) throw error
      }
      return structuredClone(EMPTY_PREFERENCES)
    }
  }

  async hiddenExpertIds(directory: string): Promise<Set<string>> {
    const preferences = await this.read()
    return new Set(preferences.hiddenExpertsByDirectory[directory] ?? [])
  }

  async hideExpert(directory: string, expertId: string): Promise<void> {
    const operation = this.writeChain.catch(() => undefined).then(async () => {
      const current = await this.read()
      const existing = current.hiddenExpertsByDirectory[directory] ?? []
      if (existing.includes(expertId)) return
      const next: SkilldeckPreferences = {
        version: 1,
        hiddenExpertsByDirectory: {
          ...current.hiddenExpertsByDirectory,
          [directory]: [...existing, expertId],
        },
      }
      await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 })
      const temporaryFile = `${this.filePath}.${randomUUID()}.tmp`
      await writeFile(temporaryFile, `${JSON.stringify(next, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      })
      await rename(temporaryFile, this.filePath)
    })
    this.writeChain = operation.catch(() => undefined)
    await operation
  }
}
