import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { lstat, mkdir, opendir, readFile, realpath, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import type { LocalSkill, LocalSkillCatalog, LocalSkillExpert, LocalSkillSource } from '../shared/types.js'
import { LocalSkillPreferencesStore } from './skilldeckPreferences.js'

const SKILL_FILE_NAMES = ['SKILL.md', 'skill.md', 'Skill.md'] as const
const DEFAULT_MAX_SKILLS = 3_000
const DEFAULT_MAX_SKILL_FILE_BYTES = 1_000_000
const DEFAULT_MAX_TOTAL_SKILL_BYTES = 25_000_000
const MAX_NAME_CHARACTERS = 200
const MAX_DESCRIPTION_CHARACTERS = 4_000

const CATEGORY_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ['标题/爆款', /标题|爆款|10万|起名|命名/],
  ['写作', /写作|文章|改写|润色|公众号|文案|口播|翻译|humaniz/i],
  ['图片/设计', /配图|封面|图片|设计|海报|logo|绘图|绘|视觉|image|design|draw|poster/i],
  ['PPT/幻灯片', /ppt|slide|幻灯|演示|deck|presentation/i],
  ['视频/音频', /视频|音频|录音|字幕|播客|video|audio|remotion|ffmpeg|tts|asr|妙记/i],
  ['产品/PM', /\bpm\b|产品|prd|原型|需求|roadmap|竞品|okr|prototype|proto/i],
  ['飞书/协作', /飞书|lark|多维表格|云文档|知识库|审批|日历|妙记/i],
  ['编程/开发', /代码|编程|coding|code|repo|调试|debug|mcp|skill.*creat|插件|extension|git/i],
  ['信息获取', /rss|抓取|爬|采集|搜索|热点|feed|scrap|news|trend|职位|job|research/i],
  ['数据/表格', /excel|表格|数据|xlsx|csv|财务|对账|报表|analy/i],
]

const EXPERT_PRESENTATION: Record<string, Omit<LocalSkillExpert, 'id' | 'skills' | 'source'>> = {
  '标题/爆款': { name: '增长文案专家', emoji: '⚡', description: '聚合标题、命名与传播型内容能力。' },
  写作: { name: '内容创作专家', emoji: '✍️', description: '聚合写作、改写、润色与内容表达能力。' },
  '图片/设计': { name: '视觉设计专家', emoji: '◈', description: '聚合图片、封面、品牌与视觉设计能力。' },
  'PPT/幻灯片': { name: '演示设计专家', emoji: '▤', description: '聚合演示文稿、幻灯片与叙事设计能力。' },
  '视频/音频': { name: '影音制作专家', emoji: '▶', description: '聚合视频、音频、字幕与多媒体能力。' },
  '产品/PM': { name: '产品策略专家', emoji: '◇', description: '聚合产品规划、需求、研究与路线图能力。' },
  '飞书/协作': { name: '协作效率专家', emoji: '⌁', description: '聚合飞书、文档与团队协作能力。' },
  '编程/开发': { name: '软件开发专家', emoji: '⌘', description: '聚合编码、调试、架构与工程化能力。' },
  信息获取: { name: '信息研究专家', emoji: '◎', description: '聚合搜索、采集、研究与趋势发现能力。' },
  '数据/表格': { name: '数据分析专家', emoji: '▦', description: '聚合数据、表格、报表与分析能力。' },
  其它: { name: '通用能力专家', emoji: '✦', description: '收纳尚未归入专门领域的本地能力。' },
}

function decodeScalar(value: string): string {
  const trimmed = value.trim()
  const quote = trimmed[0]
  if (trimmed.length >= 2 && (quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function parseSkillFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---(?:[ \t]*\r?\n|$)/)
  if (!match) return {}

  const lines = match[1].split(/\r?\n/)
  const result: Record<string, string> = {}
  let index = 0

  while (index < lines.length) {
    const entry = lines[index].match(/^([A-Za-z_][\w-]*):[ \t]*(.*)$/)
    if (!entry) {
      index += 1
      continue
    }

    const key = entry[1]
    let value = entry[2]
    if (!value || /^[|>][+-]?\s*$/.test(value)) {
      const block: string[] = []
      index += 1
      while (index < lines.length && (/^\s+\S/.test(lines[index]) || !lines[index].trim())) {
        block.push(lines[index].replace(/^\s+/, ''))
        index += 1
      }
      while (block.at(-1) === '') block.pop()
      value = block.join(' ').replace(/\s+/g, ' ').trim()
    } else {
      index += 1
    }
    result[key] = decodeScalar(value)
  }

  return result
}

export function classifySkill(name: string, description: string): string {
  const text = `${name} ${description}`
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? '其它'
}

function summarize(description: string): string {
  const firstPhrase = description.split(/。|\.\s|；|当用户|触发/)[0]?.trim()
  return (firstPhrase || description).slice(0, 80)
}

function deriveExperts(skills: LocalSkill[], categories: string[]): LocalSkillExpert[] {
  return categories.map((category) => {
    const presentation = EXPERT_PRESENTATION[category] ?? EXPERT_PRESENTATION.其它
    return {
      id: `category:${category}`,
      ...presentation,
      skills: skills.filter((skill) => skill.category === category).map((skill) => skill.folder),
      source: 'local-category' as const,
    }
  })
}

function expandDirectory(input: string): string {
  const trimmed = input.trim()
  if (trimmed === '~') return homedir()
  if (trimmed.startsWith('~/')) return path.join(homedir(), trimmed.slice(2))
  if (!path.isAbsolute(trimmed)) {
    throw new Error('Skill directory must be an absolute path or start with "~/"')
  }
  return path.normalize(trimmed)
}

function isWithin(base: string, target: string): boolean {
  const relative = path.relative(base, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function assertNarrowDirectory(directory: string): void {
  if (directory === path.parse(directory).root || directory === homedir()) {
    throw new Error('Skill directory is too broad; choose a dedicated folder that contains Skill subdirectories')
  }
}

async function findSkillFile(skillDirectory: string): Promise<string | undefined> {
  for (const fileName of SKILL_FILE_NAMES) {
    const candidate = path.join(skillDirectory, fileName)
    const info = await stat(candidate).catch(() => undefined)
    if (info?.isFile()) return candidate
  }
  return undefined
}

export interface LocalSkillLibraryOptions {
  defaultDirectory?: string
  codexDirectory?: string
  claudeDirectory?: string
  preferencesFile?: string
  maxSkills?: number
  maxSkillFileBytes?: number
  maxTotalSkillBytes?: number
}

export class LocalSkillLibrary {
  readonly defaultDirectory: string
  private readonly codexDirectory: string
  private readonly claudeDirectory: string
  private readonly maxSkills: number
  private readonly maxSkillFileBytes: number
  private readonly maxTotalSkillBytes: number
  private readonly preferences: LocalSkillPreferencesStore
  private readonly builtInDirectories: ReadonlySet<string>
  private readonly approvedDirectories = new Set<string>()

  constructor(options: LocalSkillLibraryOptions = {}) {
    this.codexDirectory = expandDirectory(
      options.codexDirectory
      ?? options.defaultDirectory
      ?? process.env.COWRITE_SKILLS_DIR
      ?? path.join(homedir(), '.codex', 'skills'),
    )
    this.claudeDirectory = expandDirectory(
      options.claudeDirectory
      ?? path.join(homedir(), '.claude', 'skills'),
    )
    this.defaultDirectory = this.codexDirectory
    this.builtInDirectories = new Set([this.codexDirectory, this.claudeDirectory])
    this.maxSkills = options.maxSkills ?? DEFAULT_MAX_SKILLS
    this.maxSkillFileBytes = options.maxSkillFileBytes ?? DEFAULT_MAX_SKILL_FILE_BYTES
    this.maxTotalSkillBytes = options.maxTotalSkillBytes ?? DEFAULT_MAX_TOTAL_SKILL_BYTES
    this.preferences = new LocalSkillPreferencesStore(options.preferencesFile)
  }

  async getConfig(): Promise<{ defaultDirectory: string; sources: LocalSkillSource[] }> {
    const definitions = [
      { id: 'codex' as const, label: 'Codex', directory: this.codexDirectory },
      { id: 'claude' as const, label: 'Claude Code', directory: this.claudeDirectory },
    ]
    const sources = await Promise.all(definitions.map(async (source) => ({
      ...source,
      available: await stat(source.directory).then((info) => info.isDirectory()).catch(() => false),
    })))
    return { defaultDirectory: this.defaultDirectory, sources }
  }

  private async resolveRootDirectory(directory: string): Promise<string> {
    const requestedDirectory = expandDirectory(directory)
    const resolvedDirectory = await realpath(requestedDirectory).catch(() => undefined)
    if (!resolvedDirectory) throw new Error(`Skill directory was not found: ${requestedDirectory}`)
    assertNarrowDirectory(resolvedDirectory)
    const rootInfo = await stat(resolvedDirectory)
    if (!rootInfo.isDirectory()) throw new Error(`Skill directory is not a directory: ${resolvedDirectory}`)
    return resolvedDirectory
  }

  private async assertApprovedDirectory(directory: string): Promise<void> {
    const requestedDirectory = expandDirectory(directory)
    const resolvedDirectory = await this.resolveRootDirectory(directory)
    if (!this.builtInDirectories.has(requestedDirectory)
      && !this.approvedDirectories.has(resolvedDirectory)) {
      throw new Error('Load this custom Skill directory in Cowrite before deleting from it')
    }
  }

  async getCatalog(directory = this.defaultDirectory): Promise<LocalSkillCatalog> {
    const resolvedDirectory = await this.resolveRootDirectory(directory)
    this.approvedDirectories.add(resolvedDirectory)

    const entries = []
    const directoryHandle = await opendir(resolvedDirectory)
    for await (const entry of directoryHandle) {
      if (entries.length >= this.maxSkills) {
        throw new Error(`Skill directory contains more than ${this.maxSkills.toLocaleString()} entries`)
      }
      entries.push(entry)
    }

    const skills: LocalSkill[] = []
    const warnings: string[] = []
    let totalSkillBytes = 0
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      const linkedSkillDirectory = path.join(resolvedDirectory, entry.name)
      const skillDirectory = await realpath(linkedSkillDirectory).catch(() => undefined)
      if (!skillDirectory) continue
      const allowedSymlinkBases = [resolvedDirectory, path.dirname(resolvedDirectory), homedir()]
      if (!allowedSymlinkBases.some((base) => isWithin(base, skillDirectory))) {
        warnings.push(`${entry.name}: linked Skill directory is outside the allowed local roots`)
        continue
      }
      const directoryInfo = await stat(skillDirectory).catch(() => undefined)
      if (!directoryInfo?.isDirectory()) continue
      const skillFile = await findSkillFile(skillDirectory)
      if (!skillFile) continue

      try {
        const fileInfo = await stat(skillFile)
        if (fileInfo.size > this.maxSkillFileBytes) {
          warnings.push(`${entry.name}: SKILL.md exceeds ${this.maxSkillFileBytes.toLocaleString()} bytes`)
          continue
        }
        if (totalSkillBytes + fileInfo.size > this.maxTotalSkillBytes) {
          warnings.push(`${entry.name}: total SKILL.md read limit of ${this.maxTotalSkillBytes.toLocaleString()} bytes reached`)
          continue
        }
        totalSkillBytes += fileInfo.size
        const frontmatter = parseSkillFrontmatter(await readFile(skillFile, 'utf8'))
        const rawName = frontmatter.name?.trim() || entry.name
        const rawDescription = frontmatter.description?.trim() || '（无描述）'
        const name = rawName.slice(0, MAX_NAME_CHARACTERS)
        const description = rawDescription.slice(0, MAX_DESCRIPTION_CHARACTERS)
        if (rawName.length > name.length || rawDescription.length > description.length) {
          warnings.push(`${entry.name}: frontmatter text was truncated to the local display limit`)
        }
        skills.push({
          id: entry.name,
          name,
          folder: entry.name,
          oneLine: summarize(description),
          description,
          category: classifySkill(name, description),
          path: skillDirectory,
          skillFile,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warnings.push(`${entry.name}: ${message}`)
      }
    }

    skills.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    const categories = [...new Set(skills.map((skill) => skill.category))]
    const hiddenExperts = await this.preferences.hiddenExpertIds(resolvedDirectory)
    return {
      directory: resolvedDirectory,
      skills,
      categories,
      experts: deriveExperts(skills, categories)
        .filter((expert) => !hiddenExperts.has(expert.id)),
      warnings,
    }
  }

  async deleteSkill(directory: string, folder: string): Promise<LocalSkillCatalog> {
    if (!folder
      || folder === '.'
      || folder === '..'
      || folder.length > 255
      || folder.startsWith('.cowrite-')
      || path.basename(folder) !== folder
      || folder.includes('/')
      || folder.includes('\\')) {
      throw new Error('Skill folder must be one direct child directory')
    }

    await this.assertApprovedDirectory(directory)
    const catalog = await this.getCatalog(directory)
    if (!catalog.skills.some((skill) => skill.folder === folder)) {
      throw new Error('Skill was not found in this directory')
    }

    const skillEntry = path.join(catalog.directory, folder)
    const entryInfo = await lstat(skillEntry).catch(() => undefined)
    if (!entryInfo || (!entryInfo.isDirectory() && !entryInfo.isSymbolicLink())) {
      throw new Error('Skill folder is no longer available')
    }

    const trashDirectory = path.join(catalog.directory, '.cowrite-trash')
    const existingTrash = await lstat(trashDirectory).catch(() => undefined)
    if (existingTrash?.isSymbolicLink() || (existingTrash && !existingTrash.isDirectory())) {
      throw new Error('Cowrite trash directory is not a safe local directory')
    }
    if (!existingTrash) await mkdir(trashDirectory, { mode: 0o700 })
    const resolvedTrash = await realpath(trashDirectory)
    if (resolvedTrash !== trashDirectory) {
      throw new Error('Cowrite trash directory resolves outside the selected Skill directory')
    }
    const currentEntry = await lstat(skillEntry).catch(() => undefined)
    const currentSkillDirectory = await realpath(skillEntry).catch(() => undefined)
    if (!currentEntry
      || (!currentEntry.isDirectory() && !currentEntry.isSymbolicLink())
      || !currentSkillDirectory
      || !await findSkillFile(currentSkillDirectory)) {
      throw new Error('Skill folder changed before it could be moved')
    }
    const currentTrash = await lstat(trashDirectory)
    if (!currentTrash.isDirectory() || currentTrash.isSymbolicLink()) {
      throw new Error('Cowrite trash directory changed before the Skill could be moved')
    }
    const trashName = `${Date.now()}-${randomUUID()}-${folder}`
    await rename(skillEntry, path.join(trashDirectory, trashName))
    return this.getCatalog(catalog.directory)
  }

  async deleteExpert(directory: string, expertId: string): Promise<LocalSkillCatalog> {
    await this.assertApprovedDirectory(directory)
    const catalog = await this.getCatalog(directory)
    if (!catalog.experts.some((expert) => expert.id === expertId)) {
      throw new Error('Expert was not found in this directory')
    }
    await this.preferences.hideExpert(catalog.directory, expertId)
    return this.getCatalog(catalog.directory)
  }
}
