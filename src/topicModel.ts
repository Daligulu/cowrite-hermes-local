export interface TopicCandidate {
  index: number
  title: string
  highlight: string
  channel: string
  styleHint: string
  raw: string
}

/**
 * 解析选题页候选清单。
 * 约定格式（Worker topic-collect 按此写入）：
 * ```
 * # 候选选题清单
 *
 * > 渠道：obsidian,ima · 要求：xxx
 *
 * ## 候选 1：标题
 * - 亮点：一句话亮点
 * - 渠道：obsidian
 * - 推荐风格：写作=干货教程；排版=科技蓝；配图=日系清新
 * ```
 */
export function parseTopicCandidates(content: string): TopicCandidate[] {
  const headerRe = /^##\s+候选\s*(\d+)\s*[:：]\s*(.+)$/gm
  const matches: { index: number; title: string; start: number }[] = []
  let match: RegExpExecArray | null
  while ((match = headerRe.exec(content)) !== null) {
    matches.push({ index: parseInt(match[1], 10), title: match[2].trim(), start: match.index })
  }
  return matches.map((item, position) => {
    const end = position + 1 < matches.length ? matches[position + 1].start : content.length
    const block = content.slice(item.start, end)
    const grab = (pattern: RegExp) => {
      const found = block.match(pattern)
      return found ? found[1].trim() : ''
    }
    return {
      index: item.index,
      title: item.title,
      highlight: grab(/^\s*[-*]\s*亮点\s*[:：]\s*(.+)$/m),
      channel: grab(/^\s*[-*]\s*渠道\s*[:：]\s*(.+)$/m),
      styleHint: grab(/^\s*[-*]\s*推荐风格\s*[:：]\s*(.+)$/m),
      raw: block.trim(),
    }
  })
}
