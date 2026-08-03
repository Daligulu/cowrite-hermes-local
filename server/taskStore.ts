import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { ActionConfigStore } from './actionConfig.js'
import type { CowriteTask, CowriteTaskInput, TaskAction, TaskPriority, TaskStatus } from '../shared/types.js'

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 }
const LEASE_MS = 30 * 60 * 1000
const MAX_ATTEMPTS = 3

interface TaskData { tasks: CowriteTask[] }

export class TaskStore {
  private operationChain: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly filePath = process.env.COWRITE_TASKS_FILE
      || path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'tasks.json'),
    private readonly actionConfig = new ActionConfigStore(),
  ) {}

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
      const recommendedSkills = await this.actionConfig.skillsFor(input.action)
      const task: CowriteTask = {
        ...input,
        id: `task_${nanoid(12)}`,
        status: 'queued',
        priority: input.priority ?? 'normal',
        attempts: 0,
        recommendedSkills,
        createdAt: now,
        updatedAt: now,
      }
      data.tasks.unshift(task)
      await this.writeUnlocked(data)
      return task
    })
  }

  async list(status?: TaskStatus): Promise<CowriteTask[]> {
    return this.serialize(async () => {
      await this.recoverExpiredLeasesUnlocked()
      const data = await this.readUnlocked()
      return data.tasks.filter((task) => !status || task.status === status)
    })
  }

  async get(id: string): Promise<CowriteTask> {
    return this.serialize(async () => {
      await this.recoverExpiredLeasesUnlocked()
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
      this.startLeaseUnlocked(task, workerId)
      await this.writeUnlocked(data)
      return task
    })
  }

  async claimNext(workerId: string): Promise<CowriteTask | null> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const ordered = data.tasks
        .map((task, index) => ({ task, index }))
        .filter(({ task }) => task.status === 'queued')
        .sort((a, b) => {
          const rankA = PRIORITY_RANK[a.task.priority ?? 'normal']
          const rankB = PRIORITY_RANK[b.task.priority ?? 'normal']
          if (rankA !== rankB) return rankA - rankB
          // Same priority: older tasks (higher index) run first.
          return b.index - a.index
        })
      const next = ordered[0]
      if (!next) return null
      this.startLeaseUnlocked(next.task, workerId)
      await this.writeUnlocked(data)
      return next.task
    })
  }

  async heartbeat(id: string, workerId: string): Promise<CowriteTask> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const task = data.tasks.find((candidate) => candidate.id === id)
      if (!task) throw new Error(`Task '${id}' was not found`)
      if (task.status !== 'running') throw new Error('Task must be running before it can heartbeat')
      if (task.workerId && task.workerId !== workerId) throw new Error(`Task is leased to '${task.workerId}'`)
      task.leaseUntil = new Date(Date.now() + LEASE_MS).toISOString()
      task.updatedAt = new Date().toISOString()
      await this.writeUnlocked(data)
      return task
    })
  }

  async cancel(id: string): Promise<CowriteTask> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const task = data.tasks.find((candidate) => candidate.id === id)
      if (!task) throw new Error(`Task '${id}' was not found`)
      if (task.status !== 'queued' && task.status !== 'running') {
        throw new Error(`Only queued or running tasks can be cancelled, task is ${task.status}`)
      }
      task.status = 'cancelled'
      task.cancelRequestedAt = new Date().toISOString()
      task.updatedAt = new Date().toISOString()
      await this.writeUnlocked(data)
      return task
    })
  }

  async retry(id: string): Promise<CowriteTask> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const task = data.tasks.find((candidate) => candidate.id === id)
      if (!task) throw new Error(`Task '${id}' was not found`)
      if (task.status !== 'failed' && task.status !== 'cancelled') {
        throw new Error(`Only failed or cancelled tasks can be retried, task is ${task.status}`)
      }
      task.status = 'queued'
      delete task.error
      delete task.result
      delete task.workerId
      delete task.leaseUntil
      delete task.cancelRequestedAt
      task.updatedAt = new Date().toISOString()
      // Move to the newest end of the queue so retries run after fresh tasks unless re-prioritized.
      const index = data.tasks.findIndex((candidate) => candidate.id === id)
      if (index !== -1) data.tasks.splice(index, 1)
      data.tasks.unshift(task)
      await this.writeUnlocked(data)
      return task
    })
  }

  async moveToFront(id: string): Promise<CowriteTask> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const task = data.tasks.find((candidate) => candidate.id === id)
      if (!task) throw new Error(`Task '${id}' was not found`)
      if (task.status !== 'queued') throw new Error(`Only queued tasks can be moved to the front, task is ${task.status}`)
      const index = data.tasks.findIndex((candidate) => candidate.id === id)
      if (index !== -1) data.tasks.splice(index, 1)
      data.tasks.push(task) // Highest index => oldest => first in its priority group.
      task.priority = 'high'
      task.updatedAt = new Date().toISOString()
      await this.writeUnlocked(data)
      return task
    })
  }

  async setPriority(id: string, priority: TaskPriority): Promise<CowriteTask> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const task = data.tasks.find((candidate) => candidate.id === id)
      if (!task) throw new Error(`Task '${id}' was not found`)
      if (task.status !== 'queued') throw new Error(`Only queued tasks can change priority, task is ${task.status}`)
      task.priority = priority
      task.updatedAt = new Date().toISOString()
      await this.writeUnlocked(data)
      return task
    })
  }

  async recoverExpiredLeases(): Promise<{ recovered: number; failed: number }> {
    return this.serialize(() => this.recoverExpiredLeasesUnlocked())
  }

  private async recoverExpiredLeasesUnlocked(): Promise<{ recovered: number; failed: number }> {
    const data = await this.readUnlocked()
    const now = Date.now()
    let recovered = 0
    let failed = 0
    for (const task of data.tasks) {
      if (task.status !== 'running' || !task.leaseUntil) continue
      if (new Date(task.leaseUntil).getTime() > now) continue
      const attempts = task.attempts ?? 0
      if (attempts < MAX_ATTEMPTS) {
        task.status = 'queued'
        task.attempts = attempts + 1
        delete task.workerId
        delete task.leaseUntil
        delete task.error
        recovered += 1
      } else {
        task.status = 'failed'
        task.error = `运行租约过期且重试已达 ${MAX_ATTEMPTS} 次，任务被自动判为失败；请检查 Worker 状态后重试。`
        delete task.workerId
        delete task.leaseUntil
        failed += 1
      }
      task.updatedAt = new Date().toISOString()
    }
    if (recovered > 0 || failed > 0) await this.writeUnlocked(data)
    return { recovered, failed }
  }

  async complete(id: string, result: NonNullable<CowriteTask['result']>): Promise<CowriteTask> {
    return this.finish(id, { status: 'succeeded', result })
  }

  async fail(id: string, error: string): Promise<CowriteTask> {
    return this.finish(id, { status: 'failed', error })
  }

  private startLeaseUnlocked(task: CowriteTask, workerId: string): void {
    task.status = 'running'
    task.workerId = workerId
    task.attempts = (task.attempts ?? 0) + 1
    task.leaseUntil = new Date(Date.now() + LEASE_MS).toISOString()
    task.updatedAt = new Date().toISOString()
  }

  private async finish(id: string, patch: Pick<CowriteTask, 'status'> & Partial<CowriteTask>): Promise<CowriteTask> {
    return this.serialize(async () => {
      const data = await this.readUnlocked()
      const task = data.tasks.find((candidate) => candidate.id === id)
      if (!task) throw new Error(`Task '${id}' was not found`)
      if (task.status !== 'running') throw new Error('Task must be running before it can finish')
      Object.assign(task, patch, { updatedAt: new Date().toISOString() })
      delete task.leaseUntil
      await this.writeUnlocked(data)
      return task
    })
  }
}
