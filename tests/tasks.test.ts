import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TaskStore } from '../server/taskStore.js'

let directory: string
let store: TaskStore

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-tasks-'))
  store = new TaskStore(path.join(directory, 'tasks.json'))
})

afterEach(async () => rm(directory, { recursive: true, force: true }))

describe('Hermes task queue', () => {
  it('persists structured routed tasks without embedding page content', async () => {
    const task = await store.create({ action: 'feng-ip', pageId: 'page_1', requirements: '白底黑线', delivery: 'cowrite' })
    expect(task).toMatchObject({ status: 'queued', recommendedSkills: ['feng-ip'], pageId: 'page_1', priority: 'normal', attempts: 0 })
    expect((await new TaskStore(path.join(directory, 'tasks.json')).get(task.id)).status).toBe('queued')
  })

  it('atomically lets only one worker claim a queued task', async () => {
    const task = await store.create({ action: 'polish', pageId: 'page_1' })
    const results = await Promise.all([
      store.claim(task.id, 'worker-a'),
      store.claim(task.id, 'worker-b'),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(results.find(Boolean)).toMatchObject({ status: 'running' })
  })

  it('enforces transitions and stores completion output', async () => {
    const task = await store.create({ action: 'slides', projectPath: '/vault/article.md' })
    await expect(store.complete(task.id, { message: 'no' })).rejects.toThrow('running')
    await store.claim(task.id, 'worker')
    const completed = await store.complete(task.id, { message: 'done', assets: ['/assets/deck.pptx'] })
    expect(completed).toMatchObject({ status: 'succeeded', result: { message: 'done' } })
    await expect(store.fail(task.id, 'late')).rejects.toThrow('running')
  })

  it('claims tasks in priority order, then FIFO', async () => {
    const normalA = await store.create({ action: 'polish', pageId: 'p1' })
    const high = await store.create({ action: 'illustrate', pageId: 'p2', priority: 'high' })
    const normalB = await store.create({ action: 'slides', pageId: 'p3' })
    const low = await store.create({ action: 'video', pageId: 'p4', priority: 'low' })

    const first = await store.claimNext('w1')
    expect(first?.id).toBe(high.id)
    const second = await store.claimNext('w1')
    // normalA was created before normalB, so it should run first.
    expect(second?.id).toBe(normalA.id)
    const third = await store.claimNext('w1')
    expect(third?.id).toBe(normalB.id)
    const fourth = await store.claimNext('w1')
    expect(fourth?.id).toBe(low.id)
    expect(await store.claimNext('w1')).toBeNull()
  })

  it('cancels queued tasks and stops running tasks from finishing', async () => {
    const queued = await store.create({ action: 'polish', pageId: 'p1' })
    const cancelled = await store.cancel(queued.id)
    expect(cancelled).toMatchObject({ status: 'cancelled' })
    await expect(store.claim(queued.id, 'w1')).resolves.toBeNull()

    const running = await store.create({ action: 'polish', pageId: 'p2' })
    await store.claim(running.id, 'w1')
    await expect(store.cancel(running.id)).resolves.toMatchObject({ status: 'cancelled' })
    await expect(store.complete(running.id, { message: 'late' })).rejects.toThrow('running')
  })

  it('retries failed and cancelled tasks as queued', async () => {
    const task = await store.create({ action: 'polish', pageId: 'p1' })
    await store.claim(task.id, 'w1')
    await store.fail(task.id, 'boom')
    const retried = await store.retry(task.id)
    expect(retried).toMatchObject({ status: 'queued', attempts: 1 })
    expect(retried.error).toBeUndefined()

    const cancelled = await store.create({ action: 'slides', pageId: 'p2' })
    await store.cancel(cancelled.id)
    await expect(store.retry(cancelled.id)).resolves.toMatchObject({ status: 'queued' })
  })

  it('moves a queued task to the front with high priority', async () => {
    const first = await store.create({ action: 'polish', pageId: 'p1' })
    const second = await store.create({ action: 'slides', pageId: 'p2' })
    await store.moveToFront(second.id)
    const next = await store.claimNext('w1')
    expect(next?.id).toBe(second.id)
    expect(next?.priority).toBe('high')
    expect((await store.claimNext('w1'))?.id).toBe(first.id)
  })

  it('recovers expired leases by re-queueing within attempt limits', async () => {
    const task = await store.create({ action: 'polish', pageId: 'p1' })
    await store.claim(task.id, 'w1')
    // Simulate an expired lease by claiming again after time travel is impossible,
    // so instead craft an old task through direct file surgery in a second store.
    const second = new TaskStore(path.join(directory, 'tasks.json'))
    await second.heartbeat(task.id, 'w1')
    const raw = await import('node:fs/promises').then((fs) => fs.readFile(path.join(directory, 'tasks.json'), 'utf8'))
    const data = JSON.parse(raw)
    data.tasks[0].leaseUntil = new Date(Date.now() - 1000).toISOString()
    await import('node:fs/promises').then((fs) => fs.writeFile(path.join(directory, 'tasks.json'), JSON.stringify(data)))

    const result = await store.recoverExpiredLeases()
    expect(result).toEqual({ recovered: 1, failed: 0 })
    const recovered = await store.get(task.id)
    expect(recovered.status).toBe('queued')
    expect(recovered.attempts).toBe(2)
  })

  it('fails tasks whose lease expired too many times', async () => {
    const task = await store.create({ action: 'polish', pageId: 'p1' })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await store.claim(task.id, 'w1')
      const raw = await import('node:fs/promises').then((fs) => fs.readFile(path.join(directory, 'tasks.json'), 'utf8'))
      const data = JSON.parse(raw)
      data.tasks[0].leaseUntil = new Date(Date.now() - 1000).toISOString()
      await import('node:fs/promises').then((fs) => fs.writeFile(path.join(directory, 'tasks.json'), JSON.stringify(data)))
      await store.recoverExpiredLeases()
    }
    const final = await store.get(task.id)
    expect(final.status).toBe('failed')
    expect(final.error).toContain('租约')
  })
})
