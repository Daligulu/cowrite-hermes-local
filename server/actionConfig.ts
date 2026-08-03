import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import type { ActionConfig, ActionConfigFile } from '../shared/types.js'

export const actionPromptSchema = z.object({
  id: z.string().min(1).max(80),
  role: z.enum(['system', 'user']).default('system'),
  text: z.string().min(1).max(20_000),
})

export const workflowStepSchema = z.object({
  step: z.enum(['load', 'process', 'verify', 'write']),
  skill: z.string().max(200).nullable().optional(),
  prompt: z.string().max(80).nullable().optional(),
  input: z.string().max(80).optional(),
  output: z.string().max(80).optional(),
})

export const actionConfigSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  chip: z.boolean().default(true),
  keywords: z.array(z.string().min(1).max(50)).default([]),
  skills: z.array(z.string().min(1).max(200)).default([]),
  prompts: z.array(actionPromptSchema).default([]),
  workflow: z.array(workflowStepSchema).default([]),
})

export const actionConfigFileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().optional(),
  actions: z.array(actionConfigSchema).min(1),
})

/** 与旧版硬编码 ACTION_SKILLS / CommandBar ACTIONS / ACTION_KEYWORDS 完全一致的默认配置 */
export const DEFAULT_ACTIONS: ActionConfig[] = [
  {
    id: 'polish',
    label: '润色文章',
    enabled: true,
    chip: true,
    keywords: ['润色', '改写', '优化', '修改', '口语化', '通顺'],
    skills: ['humanizer-zh'],
    prompts: [
      { id: 'main', role: 'system', text: '你是文章润色专家。读取页面正文，去除 AI 痕迹（宣传腔、AI 词汇、三段式法则、破折号滥用、模糊归因、过多连接短语），让表达更自然、像真人写作。保留原意与结构。' },
    ],
    workflow: [],
  },
  {
    id: 'illustrate',
    label: '文章配图',
    enabled: true,
    chip: true,
    keywords: ['配图', '插图', '插画', '配\\d+张图', '生成图', '图片'],
    skills: ['apiyi-image-generation'],
    prompts: [
      { id: 'main', role: 'system', text: '根据页面内容与用户要求，用 ApiYi 生成与文章匹配的插图。生成后上传 Cowrite 资产库，并选择合适位置插入页面。' },
    ],
    workflow: [],
  },
  {
    id: 'feng-ip',
    label: '峰峰 IP 配图',
    enabled: true,
    chip: false,
    keywords: ['峰峰配图', 'IP配图', '峰峰形象'],
    skills: ['feng-ip'],
    prompts: [
      { id: 'main', role: 'system', text: '按峰峰个人 IP 一致性规范生成配图：深海军蓝夹克+白 hoodie、深蓝黑短发、自然英气眉、温和深色眼神，白底黑线暖肤色为主，蓝色仅局部点缀。优先图生图保持人物一致。' },
    ],
    workflow: [],
  },
  {
    id: 'slides',
    label: '制作 PPT',
    enabled: true,
    chip: true,
    keywords: ['ppt', '幻灯片', '演示文稿', 'slides', '做\\d+页'],
    skills: ['dashiai-ppt'],
    prompts: [
      { id: 'main', role: 'system', text: '根据页面内容生成演示文稿：用 DashiAI PPT 预置视觉主题组合页面，生成可离线打开、浏览器可编辑的 HTML 演示，导出 PPTX/PDF，上传 Cowrite 资产并把下载链接写回页面。' },
    ],
    workflow: [],
  },
  {
    id: 'wechat-layout',
    label: '公众号排版',
    enabled: true,
    chip: true,
    keywords: ['排版', '公众号', '微信文章', '草稿箱'],
    skills: ['wewrite'],
    prompts: [
      { id: 'main', role: 'system', text: '把页面内容整理为适合微信公众号发布的文章：标题、摘要、分段、配图建议、排版样式。' },
    ],
    workflow: [],
  },
  {
    id: 'xiaohongshu',
    label: '小红书图组',
    enabled: true,
    chip: false,
    keywords: ['小红书'],
    skills: ['xiaohongshu', 'apiyi-image-generation'],
    prompts: [
      { id: 'main', role: 'system', text: '生成小红书内容与图组：标题、正文、标签，并用 ApiYi 生成配图，按小红书平台规范排版。' },
    ],
    workflow: [],
  },
  {
    id: 'feishu-doc',
    label: '发布飞书文档',
    enabled: true,
    chip: true,
    keywords: ['飞书', '云文档', '发布文档'],
    skills: ['lark-doc'],
    prompts: [
      { id: 'main', role: 'system', text: '把页面内容整理为飞书云文档并创建/更新到用户飞书，返回文档链接写回页面。' },
    ],
    workflow: [],
  },
  {
    id: 'knowledge-base',
    label: '存入峰峰知识库',
    enabled: true,
    chip: false,
    keywords: ['知识库', '归档', 'KB'],
    skills: ['feng-knowledge-base'],
    prompts: [
      { id: 'main', role: 'system', text: '把页面内容整理后写入峰的知识库（Obsidian，LLM Wiki Markdown + [[wikilinks]] 结构），链接先解析内容再入库，返回入库路径写回页面。' },
    ],
    workflow: [],
  },
  {
    id: 'video',
    label: '制作视频',
    enabled: true,
    chip: false,
    keywords: ['视频', 'video'],
    skills: ['feng-video'],
    prompts: [
      { id: 'main', role: 'system', text: '把页面内容制作为 16:9 知识分享视频：中文文稿 → 分镜 → Edge 男声配音 → B-roll 渲染，返回视频链接写回页面。' },
    ],
    workflow: [],
  },
]

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export function parseActionConfig(serialized: string): ActionConfigFile {
  const parsed = actionConfigFileSchema.parse(JSON.parse(serialized))
  return {
    version: 1,
    updatedAt: parsed.updatedAt,
    actions: parsed.actions,
  }
}

function defaultFile(): ActionConfigFile {
  return {
    version: 1,
    actions: structuredClone(DEFAULT_ACTIONS),
  }
}

export class ActionConfigStore {
  private readonly filePath: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor(filePath = process.env.COWRITE_ACTION_CONFIG
    || path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'action-config.json')) {
    this.filePath = filePath
  }

  async load(): Promise<ActionConfigFile> {
    let serialized: string
    try {
      serialized = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) return defaultFile()
      throw error
    }
    try {
      return parseActionConfig(serialized)
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

  async save(config: ActionConfigFile): Promise<ActionConfigFile> {
    const validated = parseActionConfig(JSON.stringify(config))
    validated.updatedAt = new Date().toISOString()
    const operation = this.writeChain.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(validated, null, 2), 'utf8')
    })
    this.writeChain = operation
    await operation
    return validated
  }

  async reset(): Promise<ActionConfigFile> {
    const fresh = defaultFile()
    return this.save(fresh)
  }

  async skillsFor(actionId: string): Promise<string[]> {
    const config = await this.load()
    return config.actions.find((action) => action.id === actionId)?.skills ?? []
  }

  async actionById(actionId: string): Promise<ActionConfig | undefined> {
    const config = await this.load()
    return config.actions.find((action) => action.id === actionId)
  }
}
