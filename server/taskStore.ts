import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { nanoid } from 'nanoid'
import type { CowriteTask, CowriteTaskInput, TaskAction } from '../shared/types.js'

const ACTION_SKILLS: Record<TaskAction, string[]> = {
  polish: ['humanizer-zh'],
  illustrate: ['apiyi-image-generation'],
  'feng-ip': ['feng-ip'],
  slides: ['dashiai-ppt'],
  'wechat-layout': ['wewrite'],
  xiaohongshu: ['xiaohongshu', 'apiyi-image-generation'],
  'feishu-doc': ['lark-doc'],
  'knowledge-base': ['feng-knowledge-base'],
  video: ['feng-video'],
}

interface TaskData { tasks: CowriteTask[] }

export class TaskStore {
  private operationChain: Promise<unknown> = Promise.resolve()

  constructor(private readonly filePath = process.env.COWRITE_TASKS_FILE
    || path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'tasks.json')) {}

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationChain.then(operation, operation)
    this.operationChain = result.then(() => undefined, () => undefined)
    return result
  }

  private async readUnlocked(): Promise<TaskData> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as TaskData
      return { tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      return { tasks: [] }
    }
  }

  private async writeUnlocked(data: TaskData): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.${process.pid}.${nanoid(6)}.tmp`
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, this.filePath)
  }

  async create(input: CowriteTaskInput): Promise<CowriteTask> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const now = new Date().toISOString()
      const task: CowriteTask = {
        ...input,
        id: `task_${nanoid(12)}`,
        status: 'queued',
        recommendedSkills: ACTION_SKILLS[input.action],
        createdAt: now,
        updatedAt: now,
      }
      data.tasks.unshift(task)
      await this.writeUnlocked(data)
      return task
    })
  }

  async list(status?: CowriteTask['status']): Promise<CowriteTask[]> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      return data.tasks.filter((task) => !status || task.status === status)
    })
  }

  async get(id: string): Promise<CowriteTask> {
    return this.serialize(async () => {
      const task = (await this.readUnlocked()).tasks.find((candidate) => candidate.id === id)
      if (!task) throw new Error(`Task '${id}' was not found`)
      return task
    })
  }

  async claim(id: string, workerId: string): Promise<CowriteTask | null> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const task = data.tasks.find((candidate) => candidate.id === id)
      if (!task) throw new Error(`Task '${id}' was not found`)
      if (task.status !== 'queued') return null
      task.status = 'running'
      task.workerId = workerId
      task.updatedAt = new Date().toISOString()
      await this.writeUnlocked(data)
      return task
    })
  }

  async claimNext(workerId: string): Promise<CowriteTask | null> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const task = data.tasks.slice().reverse().find((candidate) => candidate.status === 'queued')
      if (!task) return null
      task.status = 'running'
      task.workerId = workerId
      task.updatedAt = new Date().toISOString()
      await this.writeUnlocked(data)
      return task
    })
  }

  async complete(id: string, result: NonNullable<CowriteTask['result']>): Promise<CowriteTask> {
    return this.finish(id, { status: 'succeeded', result })
  }

  async fail(id: string, error: string): Promise<CowriteTask> {
    return this.finish(id, { status: 'failed', error })
  }

  private async finish(id: string, patch: Pick<CowriteTask, 'status'> & Partial<CowriteTask>): Promise<CowriteTask> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const task = data.tasks.find((candidate) => candidate.id === id)
      if (!task) throw new Error(`Task '${id}' was not found`)
      if (task.status !== 'running') throw new Error('Task must be running before it can finish')
      Object.assign(task, patch, { updatedAt: new Date().toISOString() })
      await this.writeUnlocked(data)
      return task
    })
  }
}

export { ACTION_SKILLS }
