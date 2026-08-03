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
export type TaskAction = typeof TASK_ACTIONS[number]
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface CowriteTaskInput {
  action: TaskAction
  pageId?: string
  projectPath?: string
  anchor?: string
  requirements?: string
  delivery?: string
}

export interface CowriteTask extends CowriteTaskInput {
  id: string
  status: TaskStatus
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
