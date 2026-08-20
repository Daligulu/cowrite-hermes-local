import { describe, expect, it } from 'vitest'
import { parseTopicCandidates } from '../src/topicModel.js'

const SAMPLE = `# 候选选题清单

> 渠道：obsidian,ima,aihot · 要求：AI 工具效率

## 候选 1：AI 写作工具效率对比
- 亮点：实测 5 款工具的输出速度与质量
- 渠道：aihot
- 推荐风格：写作=干货教程；排版=科技蓝；配图=扁平插画
- 来源：https://example.com/1

## 候选 2：用 Obsidian 建个人知识库
- 亮点：从零搭建到日常维护的完整路径
- 渠道：obsidian
- 推荐风格：写作=轻松口语；排版=石墨极简；配图=日系清新
`

describe('parseTopicCandidates', () => {
  it('parses all candidate blocks with title and metadata', () => {
    const candidates = parseTopicCandidates(SAMPLE)
    expect(candidates).toHaveLength(2)
    expect(candidates[0]?.index).toBe(1)
    expect(candidates[0]?.title).toBe('AI 写作工具效率对比')
    expect(candidates[0]?.highlight).toContain('实测 5 款工具')
    expect(candidates[0]?.channel).toBe('aihot')
    expect(candidates[0]?.styleHint).toContain('写作=干货教程')
  })

  it('parses a candidate with full-width colon separator', () => {
    const candidates = parseTopicCandidates('## 候选 1：全角标题\n- 亮点：x')
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.title).toBe('全角标题')
  })

  it('returns empty array for content without candidates', () => {
    expect(parseTopicCandidates('# 普通文档\n\n一些内容')).toHaveLength(0)
    expect(parseTopicCandidates('')).toHaveLength(0)
  })

  it('handles missing optional fields gracefully', () => {
    const candidates = parseTopicCandidates('## 候选 1：只有标题')
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.highlight).toBe('')
    expect(candidates[0]?.channel).toBe('')
    expect(candidates[0]?.styleHint).toBe('')
  })
})
