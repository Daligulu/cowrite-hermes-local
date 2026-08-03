import express, { type ErrorRequestHandler } from 'express'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { assetsDir, buildCreateCommand, CowriteService } from './service.js'
import { LocalSkillLibrary } from './skilldeck.js'
import { JsonStore } from './store.js'
import { LocalProjectService } from './projectWorkspace.js'
import { TaskStore } from './taskStore.js'
import { TASK_ACTIONS } from '../shared/types.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function createApp(
  service = new CowriteService(new JsonStore()),
  skillLibrary = new LocalSkillLibrary(),
  projectService = new LocalProjectService(),
  taskStore = new TaskStore(),
) {
  const app = express()
  const sessionToken = randomBytes(32).toString('base64url')
  const bridgeToken = randomBytes(32).toString('base64url')
  app.use(express.json({ limit: '2mb' }))
  app.use('/api', (request, response, next) => {
    const localHosts = new Set(['127.0.0.1', 'localhost', '::1'])
    const parseHostname = (value: string, protocol = 'http:') => {
      try {
        return new URL(`${protocol}//${value}`).hostname.replace(/^\[|\]$/g, '')
      } catch {
        return ''
      }
    }
    const host = parseHostname(request.headers.host ?? '')
    const requestPort = (() => {
      try { return new URL(`http://${request.headers.host ?? ''}`).port }
      catch { return '' }
    })()
    const origin = request.headers.origin
    const originUrl = origin ? (() => {
      try { return new URL(origin) }
      catch { return undefined }
    })() : ''
    const fetchSite = request.headers['sec-fetch-site']
    const isViteDevelopmentOrigin = Boolean(
      originUrl
      && originUrl.hostname === host
      && originUrl.port === '4321'
      && requestPort === '4320',
    )
    const publicMode = Boolean(process.env.COWRITE_PUBLIC_BASE_PATH)
    const sameSitePublicOrigin = Boolean(publicMode && originUrl && fetchSite !== 'cross-site')
    if (!localHosts.has(host)
      || (origin !== undefined && (
        !originUrl
        || (!sameSitePublicOrigin && (!localHosts.has(originUrl.hostname)
          || (originUrl.host !== request.headers.host && !isViteDevelopmentOrigin)))
      ))
      || fetchSite === 'cross-site') {
      response.status(403).json({ error: 'Cowrite API only accepts requests from the local app.' })
      return
    }
    next()
  })

  app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'cowrite' }))
  app.get('/api/session', (_request, response) => response.json({ token: sessionToken }))
  app.get('/api/bridge-session', (_request, response) => response.json({ token: bridgeToken }))
  app.use('/api', (request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next()
      return
    }
    const fetchSite = request.headers['sec-fetch-site']
    if ((fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'none')
      || request.headers['x-cowrite-token'] !== sessionToken) {
      response.status(403).json({ error: 'This action requires the current Cowrite session.' })
      return
    }
    next()
  })
  app.get('/api/skilldeck/config', async (_request, response) => response.json(await skillLibrary.getConfig()))
  app.get('/api/skilldeck/catalog', async (request, response) => {
    const directory = z.string().trim().min(1).max(2000).optional().parse(request.query.directory)
    response.json(await skillLibrary.getCatalog(directory))
  })
  app.delete('/api/skilldeck/skills', async (request, response) => {
    const input = z.object({
      directory: z.string().trim().min(1).max(2000),
      folder: z.string().min(1).max(255),
      confirmation: z.literal('move-to-trash'),
    }).strict().parse(request.body)
    response.json(await skillLibrary.deleteSkill(input.directory, input.folder))
  })
  app.delete('/api/skilldeck/experts', async (request, response) => {
    const input = z.object({
      directory: z.string().trim().min(1).max(2000),
      expertId: z.string().min(1).max(300),
      confirmation: z.literal('delete-expert'),
    }).strict().parse(request.body)
    response.json(await skillLibrary.deleteExpert(input.directory, input.expertId))
  })
  const taskInput = z.object({
    action: z.enum(TASK_ACTIONS),
    pageId: z.string().min(1).max(200).optional(),
    projectPath: z.string().min(1).max(4000).optional(),
    anchor: z.string().min(1).max(4000).optional(),
    requirements: z.string().max(20_000).optional(),
    delivery: z.string().max(200).optional(),
  }).strict().refine((value) => value.pageId || value.projectPath, 'pageId or projectPath is required')
  app.post('/api/tasks', async (request, response) => {
    response.status(201).json(await taskStore.create(taskInput.parse(request.body)))
  })
  app.get('/api/tasks', async (request, response) => {
    const status = z.enum(['queued', 'running', 'succeeded', 'failed']).optional().parse(request.query.status)
    response.json(await taskStore.list(status))
  })
  app.post('/api/tasks/claim-next', async (request, response) => {
    const input = z.object({ workerId: z.string().min(1).max(200) }).strict().parse(request.body)
    response.json({ task: await taskStore.claimNext(input.workerId) })
  })
  app.get('/api/tasks/:id', async (request, response) => response.json(await taskStore.get(request.params.id)))
  app.post('/api/tasks/:id/claim', async (request, response) => {
    const input = z.object({ workerId: z.string().min(1).max(200) }).strict().parse(request.body)
    const task = await taskStore.claim(request.params.id, input.workerId)
    if (!task) response.status(409).json({ error: 'Task is no longer queued' })
    else response.json(task)
  })
  app.post('/api/tasks/:id/heartbeat', async (request, response) => {
    const input = z.object({ workerId: z.string().min(1).max(200) }).strict().parse(request.body)
    response.json(await taskStore.heartbeat(request.params.id, input.workerId))
  })
  app.post('/api/tasks/:id/cancel', async (request, response) => {
    response.json(await taskStore.cancel(request.params.id))
  })
  app.post('/api/tasks/:id/retry', async (request, response) => {
    response.json(await taskStore.retry(request.params.id))
  })
  app.post('/api/tasks/:id/move-to-front', async (request, response) => {
    response.json(await taskStore.moveToFront(request.params.id))
  })
  app.post('/api/tasks/:id/priority', async (request, response) => {
    const input = z.object({ priority: z.enum(['high', 'normal', 'low']) }).strict().parse(request.body)
    response.json(await taskStore.setPriority(request.params.id, input.priority))
  })
  app.post('/api/tasks/recover', async (_request, response) => {
    response.json(await taskStore.recoverExpiredLeases())
  })
  app.get('/api/worker/status', async (_request, response) => {
    const statusPath = path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'worker-status.json')
    const raw = await readFile(statusPath, 'utf8').catch(() => null)
    response.json(raw ? JSON.parse(raw) : { lastRunAt: null, lastResult: null, lastError: null, lastErrorAt: null })
  })
  app.post('/api/tasks/:id/complete', async (request, response) => {
    const input = z.object({ message: z.string().min(1).max(20_000), assets: z.array(z.string().max(4000)).max(100).optional() }).strict().parse(request.body)
    response.json(await taskStore.complete(request.params.id, input))
  })
  app.post('/api/tasks/:id/fail', async (request, response) => {
    const input = z.object({ error: z.string().min(1).max(20_000) }).strict().parse(request.body)
    response.json(await taskStore.fail(request.params.id, input.error))
  })
  app.post('/api/projects/open', async (request, response) => {
    const input = z.object({ directory: z.string().trim().min(1).max(4000).optional() }).strict().parse(request.body ?? {})
    response.status(201).json(await projectService.openProject(input.directory))
  })
  app.get('/api/projects/:id', async (request, response) => {
    response.json(await projectService.getProject(request.params.id))
  })
  app.get('/api/projects/:id/file', async (request, response) => {
    const filePath = z.string().trim().min(1).max(4000).parse(request.query.path)
    response.json(await projectService.getMarkdown(request.params.id, filePath))
  })
  app.patch('/api/projects/:id/file', async (request, response) => {
    const input = z.object({
      path: z.string().trim().min(1).max(4000),
      content: z.string().max(2 * 1024 * 1024),
      expectedVersion: z.string().min(1).max(100),
    }).strict().parse(request.body)
    response.json(await projectService.updateMarkdown(request.params.id, input.path, input.content, input.expectedVersion))
  })
  app.get('/api/pages', async (_request, response) => response.json(await service.listPages()))
  app.get('/api/pages/:id', async (request, response) => response.json(await service.getPage(request.params.id)))
  app.get('/api/pages/:id/command', async (request, response) => {
    const page = await service.getPage(request.params.id)
    response.type('text/plain').send(buildCreateCommand(page))
  })
  app.post('/api/pages', async (request, response) => {
    const input = z.object({
      title: z.string().max(300).optional(),
      prompt: z.string().max(5000).optional(),
      content: z.string().max(500_000).optional(),
    }).parse(request.body ?? {})
    response.status(201).json(await service.createPage(input))
  })
  app.patch('/api/pages/:id', async (request, response) => {
    const input = z.object({
      title: z.string().max(300).optional(),
      prompt: z.string().max(5000).optional(),
      content: z.string().max(500_000).optional(),
      expectedRevision: z.number().int().positive().optional(),
    }).parse(request.body)
    response.json(await service.updatePage(request.params.id, input))
  })
  app.delete('/api/pages/:id', async (request, response) => response.json(await service.deletePage(request.params.id)))
  app.post('/api/pages/:id/insert', async (request, response) => {
    const input = z.object({
      anchor: z.string().min(1).max(2000),
      markdown: z.string().min(1).max(100_000),
      expectedRevision: z.number().int().positive(),
    }).parse(request.body)
    response.json(await service.insertAfter(request.params.id, input.anchor, input.markdown, input.expectedRevision))
  })
  app.post('/api/assets', async (request, response) => {
    const input = z.object({ path: z.string().min(1).max(2000) }).parse(request.body)
    response.status(201).json(await service.uploadAsset(input.path))
  })
  app.post('/api/assets/upload', express.raw({
    type: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    limit: '10mb',
  }), async (request, response) => {
    const mimeType = request.headers['content-type']?.split(';', 1)[0] ?? ''
    if (!(request.body instanceof Buffer)) throw new Error('Paste a PNG, JPEG, GIF, or WebP image.')
    response.status(201).json(await service.uploadImage(request.body, mimeType))
  })
  app.use('/assets', express.static(assetsDir))

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(projectRoot, 'dist')))
    app.get('/{*splat}', (_request, response) => response.sendFile(path.join(projectRoot, 'dist/index.html')))
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    response.status(message.includes('not found') ? 404 : message.includes('conflict') ? 409 : 400).json({ error: message })
  }
  app.use(errorHandler)
  return app
}
