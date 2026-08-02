import { describe, expect, it } from 'vitest'
import { buildProjectSkillPrompt } from '../src/projectModel.js'

describe('project Skill prompt', () => {
  it('combines the Skill, absolute project path, Markdown inventory, current content, and task', () => {
    const prompt = buildProjectSkillPrompt({
      skill: {
        name: 'Article Writer',
        oneLine: '写文章',
        skillFile: '/skills/writer/SKILL.md',
        path: '/skills/writer',
        folder: 'writer',
        category: '写作',
      },
      project: {
        id: 'project_1',
        name: 'knowledge-base',
        path: '/Users/me/knowledge-base',
        tree: [],
        markdownFiles: ['README.md', 'notes/idea.md'],
        warnings: [],
      },
      file: {
        path: 'notes/idea.md',
        name: 'idea.md',
        content: '# Idea\n\nDraft',
        version: 'v1',
      },
      requirement: '整理成一份发布提纲',
    })

    expect(prompt).toContain('/skills/writer/SKILL.md')
    expect(prompt).toContain('Skill 所属文件夹："/skills/writer"')
    expect(prompt).toContain('Skill 分类："写作"')
    expect(prompt).toContain('/Users/me/knowledge-base')
    expect(prompt).toContain('notes/idea.md')
    expect(prompt).toContain('README.md')
    expect(prompt).toContain('# Idea\\n\\nDraft')
    expect(prompt).toContain('整理成一份发布提纲')
  })

  it('uses a useful default task when the requirement is blank', () => {
    const prompt = buildProjectSkillPrompt({
      skill: {
        name: 'Review',
        oneLine: '审阅',
        skillFile: '/skills/review/SKILL.md',
        path: '/skills/review',
        folder: 'review',
        category: '写作',
      },
      project: { id: 'p', name: 'docs', path: '/docs', tree: [], markdownFiles: ['a.md'], warnings: [] },
      file: { path: 'a.md', name: 'a.md', content: 'text', version: 'v1' },
      requirement: '   ',
    })
    expect(prompt).toContain('按该 Skill 的默认流程执行')
  })
})
