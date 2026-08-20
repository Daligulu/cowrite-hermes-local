import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { nanoid } from 'nanoid'
import type { LocalProject, ProjectFileNode, ProjectMarkdownFile } from '../shared/types.js'

const execFileAsync = promisify(execFile)
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown'])
const IGNORED_DIRECTORIES = new Set(['.git', '.cowrite-trash', 'node_modules', 'dist'])
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024

export type DirectoryPicker = () => Promise<string>

function isCancelledPickerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /cancel|canceled|cancelled|user canceled|用户取消/i.test(message)
}

export async function pickLocalDirectory(): Promise<string> {
  try {
    if (process.platform === 'darwin') {
      const { stdout } = await execFileAsync('osascript', [
        '-e', 'set selectedFolder to choose folder with prompt "选择 Cowrite 项目文件夹"',
        '-e', 'POSIX path of selectedFolder',
      ])
      return stdout.trim()
    }

    if (process.platform === 'win32') {
      const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dialog.Description = "选择 Cowrite 项目文件夹"',
        'if ($dialog.ShowDialog() -eq "OK") { Write-Output $dialog.SelectedPath } else { exit 2 }',
      ].join('; ')
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script])
      return stdout.trim()
    }

    try {
      const { stdout } = await execFileAsync('zenity', ['--file-selection', '--directory', '--title=选择 Cowrite 项目文件夹'])
      return stdout.trim()
    } catch (zenityError) {
      if (isCancelledPickerError(zenityError)) throw zenityError
      const { stdout } = await execFileAsync('kdialog', ['--getexistingdirectory', '.', '--title', '选择 Cowrite 项目文件夹'])
      return stdout.trim()
    }
  } catch (error) {
    if (isCancelledPickerError(error)) throw new Error('已取消选择文件夹')
    throw new Error(`无法打开系统文件夹选择器：${error instanceof Error ? error.message : String(error)}`)
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

function fileVersion(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 20)
}

function sortNodes(nodes: ProjectFileNode[]): ProjectFileNode[] {
  return nodes.sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
    return left.name.localeCompare(right.name, 'zh-CN', { numeric: true })
  })
}

export function resolveDefaultProjectsRoot(): string {
  return process.env.COWRITE_PROJECTS_ROOT
    || path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'projects')
}

interface RegisteredProject {
  id: string
  name: string
  root: string
}

export class LocalProjectService {
  private readonly projects = new Map<string, RegisteredProject>()
  private readonly allowedRoots: string[]
  private readonly defaultRoot: string

  constructor(
    private readonly directoryPicker: DirectoryPicker = pickLocalDirectory,
    allowedRoots = (process.env.COWRITE_ALLOWED_PROJECT_ROOTS || '')
      .split(path.delimiter).map((value) => value.trim()).filter(Boolean),
    defaultRoot = resolveDefaultProjectsRoot(),
  ) {
    this.defaultRoot = path.resolve(defaultRoot)
    this.allowedRoots = allowedRoots.map((root) => path.resolve(root))
  }

  async openProject(selectedDirectory?: string): Promise<LocalProject> {
    const explicit = (selectedDirectory?.trim() || '').length > 0
    const selected = (selectedDirectory?.trim() || this.defaultRoot).trim()
    if (!selected) throw new Error('已取消选择文件夹')
    await mkdir(selected, { recursive: true })
    const root = await realpath(selected).catch(() => undefined)
    if (!root || !(await stat(root).catch(() => undefined))?.isDirectory()) {
      throw new Error('选择的项目文件夹不存在或不可读取')
    }
    // 显式传入的目录按配置的 allowed roots 校验；默认项目根目录始终允许打开
    if (explicit && this.allowedRoots.length) {
      const allowed = await Promise.all(this.allowedRoots.map(async (candidate) => realpath(candidate).catch(() => candidate)))
      if (!allowed.some((candidate) => root === candidate || isWithin(candidate, root))) {
        throw new Error('Project is outside COWRITE_ALLOWED_PROJECT_ROOTS allowed root')
      }
    }
    const project: RegisteredProject = {
      id: `project_${nanoid(10)}`,
      name: path.basename(root),
      root,
    }
    this.projects.set(project.id, project)
    return this.scanProject(project)
  }

  async getProject(id: string): Promise<LocalProject> {
    return this.scanProject(this.requireProject(id))
  }

  async getMarkdown(id: string, relativePath: string): Promise<ProjectMarkdownFile> {
    const project = this.requireProject(id)
    const filePath = await this.resolveMarkdown(project, relativePath)
    const fileInfo = await stat(filePath)
    if (fileInfo.size > MAX_MARKDOWN_BYTES) throw new Error('Markdown 文件超过 2 MB，暂时无法在项目编辑器中打开')
    const content = await readFile(filePath, 'utf8')
    return {
      path: this.normalizeRelativePath(relativePath),
      name: path.basename(filePath),
      content,
      version: fileVersion(content),
    }
  }

  async updateMarkdown(id: string, relativePath: string, content: string, expectedVersion: string): Promise<ProjectMarkdownFile> {
    if (Buffer.byteLength(content, 'utf8') > MAX_MARKDOWN_BYTES) {
      throw new Error('Markdown 内容超过 2 MB，无法保存')
    }
    const project = this.requireProject(id)
    const filePath = await this.resolveMarkdown(project, relativePath)
    const fileInfo = await stat(filePath)
    const current = await readFile(filePath, 'utf8')
    if (fileVersion(current) !== expectedVersion) {
      throw new Error('Version conflict: 文件已被其他程序修改，请重新打开后再编辑')
    }
    const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.cowrite-${nanoid(6)}.tmp`)
    await mkdir(path.dirname(filePath), { recursive: true })
    try {
      await writeFile(tempPath, content, { encoding: 'utf8', mode: fileInfo.mode })
      await rename(tempPath, filePath)
    } catch (error) {
      await unlink(tempPath).catch(() => undefined)
      throw error
    }
    return {
      path: this.normalizeRelativePath(relativePath),
      name: path.basename(filePath),
      content,
      version: fileVersion(content),
    }
  }

  private requireProject(id: string): RegisteredProject {
    const project = this.projects.get(id)
    if (!project) throw new Error(`Project '${id}' was not found. Please choose the folder again.`)
    return project
  }

  private normalizeRelativePath(value: string): string {
    const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '')
    if (!normalized || normalized.includes('\0') || path.posix.isAbsolute(normalized)) {
      throw new Error('Markdown 文件路径无效')
    }
    const safe = path.posix.normalize(normalized)
    if (safe === '..' || safe.startsWith('../')) throw new Error('Markdown 文件必须位于已选择的项目文件夹内')
    if (!MARKDOWN_EXTENSIONS.has(path.posix.extname(safe).toLowerCase())) throw new Error('项目编辑器只支持 Markdown 文件')
    return safe
  }

  private async resolveMarkdown(project: RegisteredProject, relativePath: string): Promise<string> {
    const normalized = this.normalizeRelativePath(relativePath)
    const candidate = path.resolve(project.root, ...normalized.split('/'))
    const resolved = await realpath(candidate).catch(() => undefined)
    if (!resolved || !isWithin(project.root, resolved)) throw new Error(`Markdown file '${normalized}' was not found in this project.`)
    const info = await stat(resolved)
    if (!info.isFile()) throw new Error(`Markdown file '${normalized}' was not found in this project.`)
    return resolved
  }

  private async scanProject(project: RegisteredProject): Promise<LocalProject> {
    const warnings: string[] = []
    const markdownFiles: string[] = []

    const visit = async (directory: string, relativeDirectory = ''): Promise<ProjectFileNode[]> => {
      let entries
      try {
        entries = await readdir(directory, { withFileTypes: true })
      } catch (error) {
        warnings.push(`${relativeDirectory || '.'}: ${error instanceof Error ? error.message : '无法读取'}`)
        return []
      }

      const nodes: ProjectFileNode[] = []
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue
        const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
        const absolutePath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (IGNORED_DIRECTORIES.has(entry.name)) continue
          const children = await visit(absolutePath, relativePath)
          if (children.length) nodes.push({ name: entry.name, path: relativePath, type: 'directory', children })
          continue
        }
        if (!entry.isFile() || !MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue
        markdownFiles.push(relativePath)
        nodes.push({ name: entry.name, path: relativePath, type: 'markdown' })
      }
      return sortNodes(nodes)
    }

    const tree = await visit(project.root)
    markdownFiles.sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }))
    return {
      id: project.id,
      name: project.name,
      path: project.root,
      tree,
      markdownFiles,
      warnings,
    }
  }
}
