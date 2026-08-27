export interface Page {
  id: string
  title: string
  prompt?: string
  content: string
  revision: number
  createdAt: string
  updatedAt: string
}

export interface CowriteData {
  pages: Page[]
}

export interface LocalSkill {
  id: string
  name: string
  folder: string
  oneLine: string
  description: string
  category: string
  path: string
  skillFile: string
}

export interface LocalSkillExpert {
  id: string
  name: string
  emoji: string
  description: string
  skills: string[]
  source: 'local-category'
}

export interface LocalSkillCatalog {
  directory: string
  skills: LocalSkill[]
  categories: string[]
  experts: LocalSkillExpert[]
  warnings: string[]
}

export interface LocalSkillSource {
  id: 'hermes' | 'codex' | 'claude'
  label: string
  directory: string
  available: boolean
  readOnly?: boolean
}

export const TASK_ACTIONS = ['polish', 'illustrate', 'feng-ip', 'slides', 'wechat-layout', 'xiaohongshu', 'feishu-doc', 'knowledge-base', 'video'] as const
/** 动作标识符：配置化后支持任意自定义 id（不再限定字面量联合） */
export type TaskAction = string
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type TaskPriority = 'high' | 'normal' | 'low'

export interface ActionPrompt {
  id: string
  role: 'system' | 'user'
  text: string
}

export interface WorkflowStep {
  step: 'load' | 'process' | 'verify' | 'write'
  skill?: string | null
  prompt?: string | null
  input?: string
  output?: string
}

export interface ActionConfig {
  id: string
  label: string
  enabled: boolean
  chip: boolean
  keywords: string[]
  skills: string[]
  prompts: ActionPrompt[]
  workflow: WorkflowStep[]
}

export interface ActionConfigFile {
  version: 1
  updatedAt?: string
  actions: ActionConfig[]
}

/** 微信公众号账号（贴图/排版发布用） */
export interface WechatAccount {
  id: string
  label: string
  appId: string
  secret: string
}

export interface WechatAccountsFile {
  version: 1
  updatedAt?: string
  accounts: WechatAccount[]
}

/** 前端可读的账号视图（secret 打码，不返回明文） */
export interface WechatAccountView {
  id: string
  label: string
  appId: string
  secretSet: boolean
}

/** 选题渠道（写作前选题：obsidian / ima / aihot 等，可配置扩展） */
export type ChannelType = 'local-files' | 'openapi-script' | 'public-api'
export interface ChannelConfig {
  id: string
  label: string
  type: ChannelType
  enabled: boolean
  description?: string
  params: Record<string, string>
}
export interface ChannelConfigFile {
  version: 1
  updatedAt?: string
  channels: ChannelConfig[]
}

/** 风格库（写作/排版/配图三类预设，可配置扩展） */
export type StyleCategory = 'writing' | 'layout' | 'image'
export interface StylePreset {
  id: string
  label: string
  description?: string
}
export interface StyleConfig {
  writing: StylePreset[]
  layout: StylePreset[]
  image: StylePreset[]
}
export interface StyleConfigFile {
  version: 1
  updatedAt?: string
  styles: StyleConfig
}

/** 通用应用配置（UI 行为设置等，如任务完成提示自动消失时长） */
export interface AppConfigFile {
  version: 1
  updatedAt?: string
  autoHideSeconds: number
}

export interface CowriteTaskInput {
  action: TaskAction
  pageId?: string
  projectPath?: string
  anchor?: string
  requirements?: string
  delivery?: string
  priority?: TaskPriority
}

export interface CowriteTask extends CowriteTaskInput {
  id: string
  status: TaskStatus
  priority?: TaskPriority
  attempts?: number
  leaseUntil?: string
  cancelRequestedAt?: string
  recommendedSkills: string[]
  workerId?: string
  result?: { message: string; assets?: string[] }
  error?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectFileNode {
  name: string
  path: string
  type: 'directory' | 'markdown'
  children?: ProjectFileNode[]
}

export interface LocalProject {
  id: string
  name: string
  path: string
  tree: ProjectFileNode[]
  markdownFiles: string[]
  warnings: string[]
}

export interface ProjectMarkdownFile {
  path: string
  name: string
  content: string
  version: string
}
