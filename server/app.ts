import express, { type ErrorRequestHandler } from 'express'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { assetsDir, buildCreateCommand, CowriteService } from './service.js'
import { LocalSkillLibrary } from './skilldeck.js'
import { JsonStore } from './store.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function createApp(
  service = new CowriteService(new JsonStore()),
  skillLibrary = new LocalSkillLibrary(),
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
    const origin = request.headers.origin
    const originUrl = origin ? (() => {
      try { return new URL(origin) }
      catch { return undefined }
    })() : ''
    const fetchSite = request.headers['sec-fetch-site']
    if (!localHosts.has(host)
      || (origin !== undefined && (
        !originUrl
        || !localHosts.has(originUrl.hostname)
        || originUrl.host !== request.headers.host
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
