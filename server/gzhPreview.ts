// gzh 公众号产物预览：从页面 content 提取顶层 <section> 产物，用 wrap_preview.py（只读+复制）生成预览 HTML。
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, unlink, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// 生产部署机与开发机一致：python3 在 Hermes venv；wrap_preview 在 gzh-design skill，可用环境变量覆盖。
const PYTHON = process.env.COWRITE_PYTHON || '/root/.hermes/hermes-agent/venv/bin/python3'
const WRAP_PREVIEW = process.env.COWRITE_WRAP_PREVIEW || '/root/.hermes/skills/creative/gzh-design/scripts/wrap_preview.py'

/** 从页面 content 提取顶层第一个 <section> 产物（平衡计数，含嵌套 section）。找不到返回 null。 */
export function extractTopSection(content: string): string | null {
  if (!content) return null
  const idx = content.indexOf('<section')
  if (idx === -1) return null
  let depth = 0
  const re = /<\/?section\b[^>]*>/g
  re.lastIndex = idx
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    if (content[match.index + 1] === '/') depth--
    else depth++
    if (depth === 0) return content.slice(idx, re.lastIndex)
  }
  return null
}

/** 用 wrap_preview.py（--readonly）把顶层 section 包成只读+复制预览 HTML，返回完整 HTML 字符串。 */
export async function renderGzhPreview(content: string, title: string): Promise<string> {
  const section = extractTopSection(content)
  if (!section) throw new Error('当前页面还没有公众号 HTML 排版产物，请先运行「公众号主题排版」')

  const dir = await mkdtemp(path.join(os.tmpdir(), 'gzh-preview-'))
  const src = path.join(dir, 'section.html')
  const out = path.join(dir, 'preview.html')
  await writeFile(src, section, 'utf-8')
  try {
    await execFileAsync(PYTHON, [WRAP_PREVIEW, src, out, '--title', title, '--readonly'], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    })
    return await readFile(out, 'utf-8')
  } finally {
    for (const file of [src, out]) await unlink(file).catch(() => {})
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
