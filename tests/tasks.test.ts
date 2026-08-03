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
    expect(task).toMatchObject({ status: 'queued', recommendedSkills: ['feng-ip'], pageId: 'page_1' })
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
})
