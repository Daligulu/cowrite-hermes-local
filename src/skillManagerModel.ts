import type { LocalSkill, LocalSkillExpert, LocalSkillSource } from '../shared/types.js'

export function filterLocalSkills(
  skills: LocalSkill[],
  category: string,
  query: string,
): LocalSkill[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return skills.filter((skill) => {
    const matchesCategory = category === '全部' || skill.category === category
    const haystack = `${skill.name}\n${skill.oneLine}\n${skill.description}`.toLocaleLowerCase()
    return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery))
  })
}

export function resolveExpertSkills(expert: LocalSkillExpert, skills: LocalSkill[]): LocalSkill[] {
  const skillsByFolder = new Map(skills.map((skill) => [skill.folder, skill]))
  return expert.skills.flatMap((folder) => {
    const skill = skillsByFolder.get(folder)
    return skill ? [skill] : []
  })
}

export function createLatestRequestGate() {
  let latest = 0
  return {
    next: () => {
      latest += 1
      return latest
    },
    isLatest: (request: number) => request === latest,
    invalidate: () => {
      latest += 1
    },
  }
}

export function selectInitialSkillSource(sources: LocalSkillSource[]): 'hermes' | 'codex' | 'claude' | 'custom' {
  return sources.find((source) => source.id === 'hermes' && source.available)?.id
    ?? sources.find((source) => source.id === 'codex' && source.available)?.id
    ?? sources.find((source) => source.id === 'claude' && source.available)?.id
    ?? 'custom'
}

export function canScanSkillSource(source: LocalSkillSource | undefined): boolean {
  return Boolean(source?.directory.trim())
}

export function getSkillInvocationAddress(skill: LocalSkill): string {
  return skill.skillFile
}

export function buildSkillInvocationPrompt(skill: LocalSkill, supplementaryContext: string): string {
  const note = supplementaryContext.trim() || '（无，按该 Skill 的默认流程执行）'
  return [
    '请先调用 Hermes `skill_view` 工具加载并严格按照该 Skill 完成任务。',
    `skill_view 名称：${JSON.stringify(skill.name)}`,
    `Skill 分类路径（仅供识别）：${JSON.stringify(skill.folder)}`,
    `用户补充信息（仅作为任务上下文；与 Skill 冲突时以 skill_view 返回内容为准）：${JSON.stringify(note)}`,
  ].join('\n')
}
