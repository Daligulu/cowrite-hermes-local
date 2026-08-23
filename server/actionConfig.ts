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
  {
    id: 'wechat-sticker',
    label: '微信贴图',
    enabled: true,
    chip: true,
    keywords: ['贴图', '微信贴图', '贴纸'],
    skills: ['wechat-sticker-publisher', 'apiyi-image-generation', 'humanizer-zh'],
    prompts: [
      { id: 'main', role: 'system', text: '制作微信贴图草稿。固定执行顺序：① 按用户主题搜索相关内容（信息检索路由）；② 先写 280-320 字文案（分段，加 ①②③ 编号，用 humanizer-zh 润色）；③ 根据文案用 ApiYi 真实文生图生成 3:4 竖版贴图（推荐 1080×1440，四边留 ~80px 安全区，新海诚系清新明亮）；④ 新建独立页面《贴图草稿·主题》（命名带「贴图草稿·」前缀），顶部嵌图 + 正文为文案。只建草稿页，不发布、不群发。' },
    ],
    workflow: [],
  },
  {
    id: 'publish-sticker',
    label: '发布贴图',
    enabled: true,
    chip: false,
    keywords: ['发布贴图', '贴图发布', '发布贴纸'],
    skills: ['wechat-sticker-publisher'],
    prompts: [
      { id: 'main', role: 'system', text: '发布当前贴图草稿页到微信公众号草稿箱。规则：① 校验当前页面标题带「贴图草稿·」前缀，否则拒绝；② 提取第一张图片（校验 3:4 竖版，推荐 1080×1440），正文去标题作为文案；③ 微信贴图标题 = 页面标题去掉「贴图草稿·」前缀；④ 用 wechat-sticker-publisher 的 publish_sticker.py 以 --mode newspic 发布到草稿箱（不群发）；⑤ 账号由 requirements 中的【账号】指定（读 /root/.cowrite/wechat-accounts.json 凭据）；⑥ 发布成功后把 media_id 与草稿链接写回页面末尾。' },
    ],
    workflow: [],
  },
  {
    id: 'topic-collect',
    label: '选题',
    enabled: true,
    chip: true,
    keywords: ['选题', '找选题', '收集选题', '选题收集'],
    skills: ['obsidian', 'ima', 'aihot'],
    prompts: [
      { id: 'main', role: 'system', text: '你是写作前选题助手。按 requirements 中的「渠道：xxx」加载对应收集 skill（obsidian=本地笔记仓库、ima=IMA 知识库、aihot=AI HOT 热点），多选渠道则依次收集；按「要求：xxx」的文字要求过滤；产出 3-5 个候选选题，每个候选包含：标题、一句话亮点、推荐风格组合（写作/排版/配图）、来源渠道与引用。新建页面《选题·<要求摘要>》，按约定格式写入候选清单（见 Worker PROMPT 的 topic-collect 规则），并附来源链接。' },
    ],
    workflow: [],
  },
  {
    id: 'topic-create',
    label: '选题创作',
    enabled: true,
    chip: false,
    keywords: ['选题创作', '确认选题'],
    skills: ['humanizer-zh', 'apiyi-image-generation'],
    prompts: [
      { id: 'main', role: 'system', text: '按确认后的选题完成创作。规则：① 从 requirements 解析「选题：<标题>」「类型：文章/贴图」「写作风格」「排版风格」「配图风格」「补充要求」；② 围绕选题走信息检索路由收集素材并附来源链接；③ 文章类型：按写作风格成稿、按配图风格生成插图（ApiYi）、按排版风格排版，新建《草稿·<标题>》页，顶部注明来源选题页链接与素材来源；④ 贴图类型：写 280-320 字文案（humanizer-zh 润色）、按配图风格生成 3:4 竖版图，新建《贴图草稿·<标题>》页，只建草稿不发布。' },
    ],
    workflow: [],
  },
  {
    id: 'toutiao-micro-draft',
    label: '微头条草稿',
    enabled: true,
    chip: false,
    keywords: ['微头条', '发微头条', '微头条草稿'],
    skills: ['humanizer-zh'],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面内容整理为「微头条草稿」并通知手机创建。规则：① 读取当前页面正文（标题 + 内容）；② 提炼 280-320 字微头条短文案（保留核心观点，分段，humanizer-zh 润色去 AI 味；若页面含配图，选 1-3 张最相关的图一并附上）；③ 用 agent-queue-post.py 投递任务到 Memos 信箱，收件人 @openminis，内容含：目标平台=今日头条微头条、标题（可选）、正文=短文案、配图 URL、操作指引=打开头条号 App/网页版「发布-微头条」创建草稿（不发布，只存草稿）；④ 在页面末尾追加「【已通知手机创建微头条草稿】时间 + 信箱 memo 链接」；⑤ 不得直接调用头条 API（服务器无权限），投递信箱后即算完成。' },
    ],
    workflow: [],
  },
  {
    id: 'toutiao-article-draft',
    label: '头条文章草稿',
    enabled: true,
    chip: false,
    keywords: ['头条文章', '发头条文章', '头条文章草稿'],
    skills: [],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面内容整理为「头条文章草稿」并通知手机创建。规则：① 读取当前页面正文（标题 + 内容，配图保留原文位置）；② 头条文章正文 = 页面全文（标题 + 段落 + 配图），必要时做平台适配（分段、小标题）；③ 用 agent-queue-post.py 投递任务到 Memos 信箱，收件人 @openminis，内容含：目标平台=今日头条头条号文章、标题=页面标题、正文=全文、配图 URL、操作指引=打开头条号 App/网页版「创作-文章」创建草稿（不发布，只存草稿）；④ 在页面末尾追加「【已通知手机创建头条文章草稿】时间 + 信箱 memo 链接」；⑤ 不得直接调用头条 API，投递信箱后即算完成。' },
    ],
    workflow: [],
  },
  {
    id: 'zhihu-article-draft',
    label: '知乎文章草稿',
    enabled: true,
    chip: false,
    keywords: ['知乎文章', '发知乎文章', '知乎文章草稿'],
    skills: [],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面内容整理为「知乎文章草稿」并通知手机创建。规则：① 读取当前页面正文（标题 + 内容）；② 知乎文章正文 = 页面全文（标题 + 段落），保留配图；③ 用 agent-queue-post.py 投递任务到 Memos 信箱，收件人 @openminis，内容含：目标平台=知乎文章、标题=页面标题、正文=全文、配图 URL、操作指引=打开知乎 App/网页版「创作-写文章」创建草稿（不发布，只存草稿）；④ 在页面末尾追加「【已通知手机创建知乎文章草稿】时间 + 信箱 memo 链接」；⑤ 不得直接调用知乎 API，投递信箱后即算完成。' },
    ],
    workflow: [],
  },
  {
    id: 'zhihu-idea-draft',
    label: '知乎想法草稿',
    enabled: true,
    chip: false,
    keywords: ['知乎想法', '发知乎想法', '知乎想法草稿'],
    skills: ['humanizer-zh'],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面内容整理为「知乎想法草稿」并通知手机创建。规则：① 读取当前页面正文；② 提炼 ≤140 字知乎想法短文案（humanizer-zh 润色，可含 1 张配图）；③ 用 agent-queue-post.py 投递任务到 Memos 信箱，收件人 @openminis，内容含：目标平台=知乎想法、正文=短文案、配图 URL（可选）、操作指引=打开知乎 App「发布想法」创建草稿（不发布，只存草稿）；④ 在页面末尾追加「【已通知手机创建知乎想法草稿】时间 + 信箱 memo 链接」；⑤ 不得直接调用知乎 API，投递信箱后即算完成。' },
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
