import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../server/app.js'
import { LocalProjectService } from '../server/projectWorkspace.js'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-project-'))
  await mkdir(path.join(directory, 'notes', 'nested'), { recursive: true })
  await mkdir(path.join(directory, 'node_modules', 'ignored'), { recursive: true })
  await writeFile(path.join(directory, 'README.md'), '# Project\n', 'utf8')
  await writeFile(path.join(directory, 'notes', 'idea.markdown'), '# Idea\n\nFirst draft.', 'utf8')
  await writeFile(path.join(directory, 'notes', 'nested', 'reference.md'), '# Reference\n', 'utf8')
  await writeFile(path.join(directory, 'notes', 'plain.txt'), 'not markdown', 'utf8')
  await writeFile(path.join(directory, 'node_modules', 'ignored', 'package.md'), '# dependency', 'utf8')
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

async function mutationToken(app: ReturnType<typeof createApp>): Promise<string> {
  return (await request(app).get('/api/session').expect(200)).body.token as string
}

describe('local project workspace', () => {
  it('authorizes a chosen folder and builds a Markdown-only tree', async () => {
    const projectService = new LocalProjectService(async () => {
      throw new Error('picker should not run')
    })
    const project = await projectService.openProject(directory)

    expect(project.path).toBe(await realpath(directory))
    expect(project.markdownFiles).toEqual([
      'notes/idea.markdown',
      'notes/nested/reference.md',
      'README.md',
    ])
    expect(JSON.stringify(project.tree)).not.toContain('plain.txt')
    expect(JSON.stringify(project.tree)).not.toContain('node_modules')
  })

  it('opens the default projects root when no directory is given, without the system picker', async () => {
    const projectService = new LocalProjectService(async () => {
      throw new Error('picker should not run')
    }, [], directory)
    const project = await projectService.openProject()

    expect(project.path).toBe(await realpath(directory))
    expect(project.markdownFiles).toContain('README.md')
  })

  it('reads and saves selected Markdown with conflict protection', async () => {
    const projectService = new LocalProjectService(async () => directory)
    const project = await projectService.openProject(directory)
    const file = await projectService.getMarkdown(project.id, 'notes/idea.markdown')
    expect(file.content).toContain('First draft')

    const updated = await projectService.updateMarkdown(
      project.id,
      file.path,
      '# Idea\n\nRevised in Cowrite.',
      file.version,
    )
    expect(updated.version).not.toBe(file.version)
    expect(await readFile(path.join(directory, 'notes', 'idea.markdown'), 'utf8')).toContain('Revised in Cowrite')

    await expect(projectService.updateMarkdown(project.id, file.path, 'stale overwrite', file.version))
      .rejects.toThrow(/conflict/i)
  })

  it('rejects traversal, non-Markdown files, and unknown project ids', async () => {
    const projectService = new LocalProjectService(async () => directory)
    const project = await projectService.openProject(directory)
    await expect(projectService.getMarkdown(project.id, '../outside.md')).rejects.toThrow(/项目文件夹内/)
    await expect(projectService.getMarkdown(project.id, 'notes/plain.txt')).rejects.toThrow(/只支持 Markdown/)
    await expect(projectService.getProject('missing')).rejects.toThrow(/not found/)
  })

  it('restricts projects to configured allowed roots', async () => {
    const allowed = path.join(directory, 'notes')
    const service = new LocalProjectService(async () => directory, [allowed])
    await expect(service.openProject(directory)).rejects.toThrow(/allowed root/i)
    await expect(service.openProject(allowed)).resolves.toMatchObject({ path: await realpath(allowed) })
  })

  it('exposes folder selection, file read, and protected write through the local API', async () => {
    const app = createApp(undefined, undefined, new LocalProjectService(async () => directory))
    const token = await mutationToken(app)
    const opened = await request(app)
      .post('/api/projects/open')
      .set('X-Cowrite-Token', token)
      .send({ directory })
      .expect(201)
    const file = await request(app)
      .get(`/api/projects/${opened.body.id}/file`)
      .query({ path: 'README.md' })
      .expect(200)

    await request(app)
      .patch(`/api/projects/${opened.body.id}/file`)
      .set('X-Cowrite-Token', token)
      .send({ path: 'README.md', content: '# Updated project\n', expectedVersion: file.body.version })
      .expect(200)
    expect(await readFile(path.join(directory, 'README.md'), 'utf8')).toBe('# Updated project\n')

    await request(app)
      .patch(`/api/projects/${opened.body.id}/file`)
      .set('X-Cowrite-Token', token)
      .send({ path: 'README.md', content: '# Stale\n', expectedVersion: file.body.version })
      .expect(409)
  })

  it('accepts an explicitly entered directory without invoking the system picker', async () => {
    const app = createApp(undefined, undefined, new LocalProjectService(async () => {
      throw new Error('picker should not run')
    }))
    const token = await mutationToken(app)
    const opened = await request(app)
      .post('/api/projects/open')
      .set('X-Cowrite-Token', token)
      .send({ directory })
      .expect(201)
    expect(opened.body.path).toBe(await realpath(directory))
    expect(opened.body.markdownFiles).toContain('README.md')
  })
})
