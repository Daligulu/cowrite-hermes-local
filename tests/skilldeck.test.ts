import { lstat, mkdir, mkdtemp, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../server/app.js'
import { LocalSkillLibrary, classifySkill, parseSkillFrontmatter } from '../server/skilldeck.js'
import { LocalSkillPreferencesStore } from '../server/skilldeckPreferences.js'
import { CowriteService } from '../server/service.js'
import { JsonStore } from '../server/store.js'

let directory: string
let skillsDirectory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cowrite-skilldeck-'))
  skillsDirectory = path.join(directory, 'skills')
  await mkdir(skillsDirectory)
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

async function addSkill(folder: string, markdown: string, fileName = 'SKILL.md') {
  const skillDirectory = path.join(skillsDirectory, folder)
  await mkdir(skillDirectory)
  await writeFile(path.join(skillDirectory, fileName), markdown, 'utf8')
}

function testApp() {
  const pageService = new CowriteService(new JsonStore(path.join(directory, 'cowrite.json')))
  return createApp(pageService, new LocalSkillLibrary({ defaultDirectory: skillsDirectory }))
}

async function mutationToken(app: ReturnType<typeof testApp>): Promise<string> {
  const response = await request(app).get('/api/session').expect(200)
  return response.body.token as string
}

describe('SkillDeck-compatible local skill library', () => {
  it('parses quoted and folded frontmatter values', () => {
    expect(parseSkillFrontmatter(`---
name: "article-writer"
description: >
  Write thoughtful long-form articles.
  Use when a user needs a structured draft.
---

# Article writer
`)).toEqual({
      name: 'article-writer',
      description: 'Write thoughtful long-form articles. Use when a user needs a structured draft.',
    })
  })

  it('classifies common local skill types without a model call', () => {
    expect(classifySkill('article-writer', '公众号文章写作')).toBe('写作')
    expect(classifySkill('slide-deck', 'Create PPT presentations')).toBe('PPT/幻灯片')
    expect(classifySkill('unknown', 'Unrelated capability')).toBe('其它')
  })

  it('loads SkillDeck metadata, lowercase filenames, symlinked skills, and derived experts', async () => {
    await addSkill('writer', `---
name: article-writer
description: >
  写作与润色长文章。
  当用户需要公众号内容时使用。
---
`)
    await addSkill('slides', `---
name: slide-deck
description: Create polished PPT presentations.
---
`, 'skill.md')
    await mkdir(path.join(skillsDirectory, 'not-a-skill'))

    const linkedTarget = path.join(directory, 'linked-skill')
    await mkdir(linkedTarget)
    await writeFile(path.join(linkedTarget, 'SKILL.md'), `---
name: image-maker
description: 生成封面和配图。
---
`)
    await symlink(linkedTarget, path.join(skillsDirectory, 'image-link'))

    const catalog = await new LocalSkillLibrary({ defaultDirectory: skillsDirectory }).getCatalog()

    expect(catalog.directory).toBe(await realpath(skillsDirectory))
    expect(catalog.skills.map((skill) => skill.name)).toEqual(['article-writer', 'image-maker', 'slide-deck'])
    expect(catalog.skills[0]).toMatchObject({
      folder: 'writer',
      oneLine: '写作与润色长文章',
      category: '写作',
    })
    expect(catalog.categories).toEqual(['写作', '图片/设计', 'PPT/幻灯片'])
    expect(catalog.experts.map((expert) => expert.name)).toEqual(['内容创作专家', '视觉设计专家', '演示设计专家'])
    expect(catalog.experts[0].skills).toEqual(['writer'])
  })

  it('recursively scans categorized Hermes skills and marks the source read-only', async () => {
    const hermesHome = path.join(directory, '.hermes')
    const hermesSkills = path.join(hermesHome, 'skills')
    await mkdir(path.join(hermesSkills, 'creative', 'feng-ip'), { recursive: true })
    await writeFile(path.join(hermesSkills, 'creative', 'feng-ip', 'SKILL.md'), `---\nname: feng-ip\ndescription: 峰峰个人IP生图。\n---\n`)
    const library = new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      hermesDirectory: hermesSkills,
    })
    const config = await library.getConfig()
    expect(config.sources).toContainEqual({ id: 'hermes', label: 'Hermes', directory: hermesSkills, available: true, readOnly: true })
    const catalog = await library.getCatalog(hermesSkills)
    expect(catalog.skills).toHaveLength(1)
    expect(catalog.skills[0]).toMatchObject({ name: 'feng-ip', folder: 'creative/feng-ip' })
    await expect(library.deleteSkill(hermesSkills, 'creative/feng-ip')).rejects.toThrow(/read-only/i)
  })

  it('rejects relative paths and reports unreadable directories', async () => {
    const library = new LocalSkillLibrary({ defaultDirectory: skillsDirectory })
    await expect(library.getCatalog('../skills')).rejects.toThrow('absolute')
    await expect(library.getCatalog(path.join(directory, 'missing'))).rejects.toThrow('not found')
    await expect(library.getCatalog(path.parse(directory).root)).rejects.toThrow('too broad')
    await expect(library.getCatalog(homedir())).rejects.toThrow('too broad')
    await expect(library.getCatalog('~')).rejects.toThrow('too broad')
    await expect(library.getCatalog('~/definitely-missing-cowrite-skills')).rejects.toThrow('not found')

    const filePath = path.join(directory, 'plain-file')
    await writeFile(filePath, 'not a directory')
    await expect(library.getCatalog(filePath)).rejects.toThrow('not a directory')
  })

  it('limits directory entries and skips oversized Skill files with a warning', async () => {
    await addSkill('one', `---
name: one
description: First skill
---
`)
    await addSkill('two', `---
name: two
description: ${'x'.repeat(120)}
---
`)

    await expect(new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      maxSkills: 1,
    }).getCatalog()).rejects.toThrow('more than 1')

    const catalog = await new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      maxSkillFileBytes: 100,
    }).getCatalog()
    expect(catalog.skills.map((skill) => skill.name)).toEqual(['one'])
    expect(catalog.warnings).toEqual([expect.stringContaining('two: SKILL.md exceeds 100 bytes')])
  })

  it('caps total reads and truncates oversized frontmatter text', async () => {
    await addSkill('large-copy', `---
name: ${'n'.repeat(220)}
description: ${'d'.repeat(4_100)}
---
`)

    const truncated = await new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      maxSkillFileBytes: 10_000,
    }).getCatalog()
    expect(truncated.skills[0].name).toHaveLength(200)
    expect(truncated.skills[0].description).toHaveLength(4_000)
    expect(truncated.warnings).toEqual([expect.stringContaining('frontmatter text was truncated')])

    const capped = await new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      maxSkillFileBytes: 10_000,
      maxTotalSkillBytes: 100,
    }).getCatalog()
    expect(capped.skills).toEqual([])
    expect(capped.warnings).toEqual([expect.stringContaining('total SKILL.md read limit of 100 bytes reached')])
  })

  it('serves config and catalog through validated HTTP endpoints', async () => {
    await addSkill('writer', `---
name: article-writer
description: 写作公众号文章。
---
`)

    const app = testApp()
    const config = await request(app).get('/api/skilldeck/config').expect(200)
    expect(config.body.defaultDirectory).toBe(skillsDirectory)
    expect(config.body.sources).toEqual([
      { id: 'codex', label: 'Codex', directory: skillsDirectory, available: true },
      expect.objectContaining({ id: 'claude', label: 'Claude Code' }),
      expect.objectContaining({ id: 'hermes', label: 'Hermes', readOnly: true }),
    ])

    const catalog = await request(app)
      .get('/api/skilldeck/catalog')
      .query({ directory: skillsDirectory })
      .expect(200)
    expect(catalog.body.skills).toHaveLength(1)
    expect(catalog.body.experts).toHaveLength(1)
    expect(catalog.body.experts[0].name).toBe('内容创作专家')

    await request(app)
      .get('/api/skilldeck/catalog')
      .query({ directory: '../relative' })
      .expect(400)
  })

  it('detects Codex and Claude Code Skill roots independently', async () => {
    const claudeDirectory = path.join(directory, 'claude-skills')
    await mkdir(claudeDirectory)
    const config = await new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      codexDirectory: skillsDirectory,
      claudeDirectory,
    }).getConfig()

    expect(config.sources).toEqual([
      { id: 'codex', label: 'Codex', directory: skillsDirectory, available: true },
      { id: 'claude', label: 'Claude Code', directory: claudeDirectory, available: true },
      expect.objectContaining({ id: 'hermes', label: 'Hermes', readOnly: true }),
    ])

    await rm(claudeDirectory, { recursive: true })
    expect((await new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      codexDirectory: skillsDirectory,
      claudeDirectory,
    }).getConfig()).sources[1].available).toBe(false)
  })

  it('can scan a built-in Skill root created after initial detection', async () => {
    const lateCodexDirectory = path.join(directory, 'late-codex-skills')
    const library = new LocalSkillLibrary({
      codexDirectory: lateCodexDirectory,
      claudeDirectory: path.join(directory, 'missing-claude-skills'),
    })

    expect((await library.getConfig()).sources[0].available).toBe(false)
    await mkdir(path.join(lateCodexDirectory, 'late-skill'), { recursive: true })
    await writeFile(path.join(lateCodexDirectory, 'late-skill', 'SKILL.md'), `---
name: late-skill
description: Created after Cowrite opened.
---
`)

    expect((await library.getCatalog(lateCodexDirectory)).skills.map((skill) => skill.name))
      .toEqual(['late-skill'])
  })

  it('rejects cross-site and non-local Host access to the local API', async () => {
    const app = testApp()
    await request(app)
      .get('/api/skilldeck/config')
      .set('Host', 'attacker.example')
      .expect(403)
    await request(app)
      .get('/api/skilldeck/config')
      .set('Origin', 'https://attacker.example')
      .expect(403)
    await request(app)
      .get('/api/skilldeck/config')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403)
    await request(app)
      .get('/api/skilldeck/config')
      .set('Host', '127.0.0.1:4322')
      .set('Origin', 'http://127.0.0.1:9999')
      .expect(403)
  })

  it('requires the current Cowrite session token for destructive requests', async () => {
    await addSkill('writer', `---
name: article-writer
description: 写作公众号文章。
---
`)
    const app = testApp()
    const bridgeToken = (await request(app).get('/api/bridge-session').expect(200)).body.token as string
    const body = {
      directory: skillsDirectory,
      folder: 'writer',
      confirmation: 'move-to-trash',
    }

    await request(app).delete('/api/skilldeck/skills').send(body).expect(403)
    await request(app)
      .delete('/api/skilldeck/skills')
      .set('X-Cowrite-Token', 'wrong-token')
      .send(body)
      .expect(403)
    await request(app)
      .delete('/api/skilldeck/skills')
      .set('X-Cowrite-Token', bridgeToken)
      .send(body)
      .expect(403)
    expect((await stat(path.join(skillsDirectory, 'writer', 'SKILL.md'))).isFile()).toBe(true)
  })

  it('rejects deletion from a custom root until Cowrite has loaded that directory', async () => {
    const unapprovedRoot = path.join(directory, 'unapproved-skills')
    await mkdir(path.join(unapprovedRoot, 'writer'), { recursive: true })
    await writeFile(path.join(unapprovedRoot, 'writer', 'SKILL.md'), `---
name: article-writer
description: 写作公众号文章。
---
`)
    const app = testApp()
    const token = await mutationToken(app)

    await request(app)
      .delete('/api/skilldeck/skills')
      .set('X-Cowrite-Token', token)
      .send({
        directory: unapprovedRoot,
        folder: 'writer',
        confirmation: 'move-to-trash',
      })
      .expect(400)
    expect((await stat(path.join(unapprovedRoot, 'writer', 'SKILL.md'))).isFile()).toBe(true)
  })

  it('moves a deleted Skill folder into a recoverable local trash directory', async () => {
    await addSkill('writer', `---
name: article-writer
description: 写作公众号文章。
---
`)
    const app = testApp()
    const token = await mutationToken(app)
    const response = await request(app)
      .delete('/api/skilldeck/skills')
      .set('X-Cowrite-Token', token)
      .send({
        directory: skillsDirectory,
        folder: 'writer',
        confirmation: 'move-to-trash',
      })
      .expect(200)

    expect(response.body.skills).toEqual([])
    await expect(stat(path.join(skillsDirectory, 'writer'))).rejects.toThrow()
    expect(await readdir(path.join(skillsDirectory, '.cowrite-trash')))
      .toEqual([expect.stringMatching(/writer$/)])
  })

  it('moves only a symlinked Skill entry and leaves its target untouched', async () => {
    const linkedTarget = path.join(directory, 'linked-delete-target')
    await mkdir(linkedTarget)
    await writeFile(path.join(linkedTarget, 'SKILL.md'), `---
name: linked-writer
description: 写作文章。
---
`)
    await symlink(linkedTarget, path.join(skillsDirectory, 'linked-writer'))
    const app = testApp()
    const token = await mutationToken(app)

    await request(app)
      .delete('/api/skilldeck/skills')
      .set('X-Cowrite-Token', token)
      .send({
        directory: skillsDirectory,
        folder: 'linked-writer',
        confirmation: 'move-to-trash',
      })
      .expect(200)

    expect((await stat(path.join(linkedTarget, 'SKILL.md'))).isFile()).toBe(true)
    await expect(lstat(path.join(skillsDirectory, 'linked-writer'))).rejects.toThrow()
  })

  it('rejects traversal and deletion requests without the exact confirmation value', async () => {
    const outsideDirectory = path.join(directory, 'outside-skill')
    await mkdir(outsideDirectory)
    await writeFile(path.join(outsideDirectory, 'SKILL.md'), '# outside')
    const app = testApp()
    const token = await mutationToken(app)

    await request(app)
      .delete('/api/skilldeck/skills')
      .set('X-Cowrite-Token', token)
      .send({
        directory: skillsDirectory,
        folder: '../outside-skill',
        confirmation: 'move-to-trash',
      })
      .expect(400)
    await request(app)
      .delete('/api/skilldeck/skills')
      .set('X-Cowrite-Token', token)
      .send({ directory: skillsDirectory, folder: 'writer' })
      .expect(400)

    expect((await stat(path.join(outsideDirectory, 'SKILL.md'))).isFile()).toBe(true)
  })

  it('refuses to move a Skill through a symlinked trash directory', async () => {
    await addSkill('writer', `---
name: article-writer
description: 写作公众号文章。
---
`)
    const outsideTrash = path.join(directory, 'outside-trash')
    await mkdir(outsideTrash)
    await symlink(outsideTrash, path.join(skillsDirectory, '.cowrite-trash'))
    const app = testApp()
    const token = await mutationToken(app)

    await request(app)
      .delete('/api/skilldeck/skills')
      .set('X-Cowrite-Token', token)
      .send({
        directory: skillsDirectory,
        folder: 'writer',
        confirmation: 'move-to-trash',
      })
      .expect(400)

    expect((await stat(path.join(skillsDirectory, 'writer', 'SKILL.md'))).isFile()).toBe(true)
    expect(await readdir(outsideTrash)).toEqual([])
  })

  it('persists deleted expert groups without deleting their member Skills', async () => {
    await addSkill('writer', `---
name: article-writer
description: 写作公众号文章。
---
`)
    await addSkill('slides', `---
name: slide-deck
description: Create PPT presentations.
---
`)
    const preferencesFile = path.join(directory, 'skilldeck-preferences.json')
    const library = new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      preferencesFile,
    })
    const pageService = new CowriteService(new JsonStore(path.join(directory, 'cowrite.json')))
    const app = createApp(pageService, library)
    const token = await mutationToken(app)

    const response = await request(app)
      .delete('/api/skilldeck/experts')
      .set('X-Cowrite-Token', token)
      .send({
        directory: skillsDirectory,
        expertId: 'category:写作',
        confirmation: 'delete-expert',
      })
      .expect(200)

    expect(response.body.skills.map((skill: { folder: string }) => skill.folder))
      .toEqual(['writer', 'slides'])
    expect(response.body.experts.map((expert: { id: string }) => expert.id))
      .toEqual(['category:PPT/幻灯片'])
    expect((await new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      preferencesFile,
    }).getCatalog()).experts.map((expert) => expert.id))
      .toEqual(['category:PPT/幻灯片'])
    expect((await stat(path.join(skillsDirectory, 'writer', 'SKILL.md'))).isFile()).toBe(true)
  })

  it('recovers the preference write queue after one failed write', async () => {
    const blockedParent = path.join(directory, 'blocked-parent')
    await writeFile(blockedParent, 'not a directory')
    const store = new LocalSkillPreferencesStore(path.join(blockedParent, 'preferences.json'))

    await expect(store.hideExpert(skillsDirectory, 'category:写作')).rejects.toThrow()
    await rm(blockedParent)
    await mkdir(blockedParent)
    await expect(store.hideExpert(skillsDirectory, 'category:PPT/幻灯片')).resolves.toBeUndefined()
    expect(await store.hiddenExpertIds(skillsDirectory)).toEqual(new Set(['category:PPT/幻灯片']))
  })

  it('backs up corrupted expert preferences and keeps the catalog available', async () => {
    await addSkill('writer', `---
name: article-writer
description: 写作公众号文章。
---
`)
    const preferencesFile = path.join(directory, 'skilldeck-preferences.json')
    await writeFile(preferencesFile, '{not-valid-json', 'utf8')
    const library = new LocalSkillLibrary({
      defaultDirectory: skillsDirectory,
      preferencesFile,
    })

    expect((await library.getCatalog()).experts.map((expert) => expert.id))
      .toEqual(['category:写作'])
    expect(await readdir(directory))
      .toContainEqual(expect.stringMatching(/^skilldeck-preferences\.json\.corrupt-/))
  })
})
