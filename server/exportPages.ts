import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from '../shared/types.js'

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g

export function sanitizeTitle(value: string): string {
  const cleaned = value
    .replace(INVALID_FILENAME_CHARS, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
  const result = cleaned || '未命名页面'
  return result.slice(0, 80)
}

/**
 * 一次性初始化导出：把 Cowrite 页面写为 .md 文件到草稿目录。
 * 返回导出的文件数。同名标题自动追加序号避免覆盖。
 */
export async function exportPagesToDrafts(pages: Page[], draftsDir: string): Promise<number> {
  await mkdir(draftsDir, { recursive: true })
  const usedNames = new Set<string>()
  let count = 0
  for (const page of pages) {
    let baseName = sanitizeTitle(page.title)
    let fileName = `${baseName}.md`
    let suffix = 2
    while (usedNames.has(fileName) || await fileExists(path.join(draftsDir, fileName))) {
      fileName = `${baseName}-${suffix}.md`
      suffix += 1
    }
    usedNames.add(fileName)
    const body = page.content || ''
    const meta = `<!-- cowrite-page: ${page.id} -->\n\n`
    await writeFile(path.join(draftsDir, fileName), meta + body, { encoding: 'utf8' })
    count += 1
  }
  return count
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}
