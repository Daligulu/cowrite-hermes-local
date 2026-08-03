import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Vditor from 'vditor'
import type { LocalProject, LocalSkill, LocalSkillCatalog, LocalSkillSource, ProjectFileNode, ProjectMarkdownFile } from '../shared/types'
import { cowriteFetch } from './apiClient'
import {
  addProjectSkill,
  buildProjectSkillPrompt,
  loadProjectSkills,
  PROJECT_SKILLS_CHANGED_EVENT,
  removeProjectSkill,
  type ProjectSkill,
} from './projectModel'
import './ProjectWorkspace.css'

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await cowriteFetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `请求失败：${response.status}`)
  return result as T
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const fallback = document.createElement('textarea')
  fallback.value = text
  fallback.setAttribute('readonly', '')
  fallback.style.position = 'fixed'
  fallback.style.opacity = '0'
  document.body.appendChild(fallback)
  fallback.select()
  const copied = document.execCommand('copy')
  fallback.remove()
  if (!copied) throw new Error('浏览器拒绝了剪贴板访问')
}

function FileTree({ nodes, activePath, onOpen }: {
  nodes: ProjectFileNode[]
  activePath: string | null
  onOpen: (path: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const renderNodes = (items: ProjectFileNode[], depth = 0) => items.map((node) => {
    if (node.type === 'directory') {
      const isCollapsed = collapsed.has(node.path)
      return <div key={node.path}>
        <button
          className="project-tree-row folder"
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={() => setCollapsed((current) => {
            const next = new Set(current)
            if (next.has(node.path)) next.delete(node.path)
            else next.add(node.path)
            return next
          })}
        >
          <span className={`tree-chevron ${isCollapsed ? '' : 'open'}`}>›</span>
          <span className="tree-folder-icon" />
          <span>{node.name}</span>
        </button>
        {!isCollapsed && node.children ? renderNodes(node.children, depth + 1) : null}
      </div>
    }
    return <button
      key={node.path}
      className={`project-tree-row file ${activePath === node.path ? 'active' : ''}`}
      style={{ paddingLeft: 25 + depth * 14 }}
      title={node.path}
      onClick={() => onOpen(node.path)}
    >
      <span className="tree-file-icon">M</span>
      <span>{node.name}</span>
    </button>
  })

  return <div className="project-tree">{renderNodes(nodes)}</div>
}

function ProjectEditor({ projectId, file, onDirty, onContentChange, onSaved, notify }: {
  projectId: string
  file: ProjectMarkdownFile
  onDirty: () => void
  onContentChange: (content: string) => void
  onSaved: (file: ProjectMarkdownFile) => void
  notify: (text: string) => void
}) {
  const holderRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Vditor | null>(null)
  const versionRef = useRef(file.version)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const save = useCallback(async () => {
    const editor = editorRef.current
    if (!editor || !dirtyRef.current || savingRef.current) return
    const content = editor.getValue()
    const expectedVersion = versionRef.current
    dirtyRef.current = false
    savingRef.current = true
    let failed = false
    try {
      const updated = await requestJson<ProjectMarkdownFile>(`/api/projects/${projectId}/file`, {
        method: 'PATCH',
        body: JSON.stringify({ path: file.path, content, expectedVersion }),
      })
      versionRef.current = updated.version
      onSaved(updated)
    } catch (error) {
      dirtyRef.current = true
      failed = true
      notify(error instanceof Error ? error.message : '项目文件保存失败')
    } finally {
      savingRef.current = false
      if (dirtyRef.current && !failed) timerRef.current = setTimeout(save, 900)
    }
  }, [file.path, notify, onSaved, projectId])

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    onDirty()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(save, 700)
  }, [onDirty, save])

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    let disposed = false
    const editor = new Vditor(holder, {
      mode: 'ir',
      value: file.content,
      placeholder: '开始编辑这个 Markdown 文件……',
      cache: { enable: false },
      toolbar: [],
      counter: { enable: false },
      after: () => { if (disposed) editor.destroy() },
      input: (value) => {
        onContentChange(value)
        scheduleSave()
      },
    })
    editorRef.current = editor
    return () => {
      disposed = true
      clearTimeout(timerRef.current)
      if (dirtyRef.current) void save()
      try { editor.destroy() } catch { /* 未完成初始化时忽略 */ }
      editorRef.current = null
    }
  }, [file.path, onContentChange, scheduleSave, save])

  return <div className="editor-holder project-editor-holder" ref={holderRef} />
}

function ProjectSkillPickerModal({ projectPath, currentSkills, onClose, onAdd }: {
  projectPath: string
  currentSkills: ProjectSkill[]
  onClose: () => void
  onAdd: (skill: LocalSkill) => void
}) {
  type SkillSourceId = LocalSkillSource['id'] | 'custom'
  type SelectableSkill = LocalSkill & { sourceId: SkillSourceId; sourceLabel: string }

  const [availableSkills, setAvailableSkills] = useState<SelectableSkill[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | SkillSourceId>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const config = await requestJson<{ sources: LocalSkillSource[] }>('/api/skilldeck/config')
        const sources: Array<{ id: SkillSourceId; label: string; directory: string }> = config.sources
          .filter((source) => source.available)
        try {
          const customDirectory = localStorage.getItem('cowrite.skill-manager.directory')?.trim()
          if (customDirectory && !sources.some((source) => source.directory === customDirectory)) {
            sources.push({ id: 'custom', label: '自定义目录', directory: customDirectory })
          }
        } catch { /* 浏览器存储不可用时仍加载默认来源 */ }
        const catalogs = await Promise.allSettled(sources.map(async (source) => ({
          source,
          catalog: await requestJson<LocalSkillCatalog>(
            `/api/skilldeck/catalog?directory=${encodeURIComponent(source.directory)}`,
          ),
        })))
        if (disposed) return
        const uniqueSkills = new Map<string, SelectableSkill>()
        for (const result of catalogs) {
          if (result.status !== 'fulfilled') continue
          const { source, catalog } = result.value
          for (const skill of catalog.skills) {
            uniqueSkills.set(skill.skillFile, {
              ...skill,
              sourceId: source.id,
              sourceLabel: source.label,
            })
          }
        }
        const next = [...uniqueSkills.values()].sort((left, right) => (
          left.category.localeCompare(right.category, 'zh-CN')
          || left.name.localeCompare(right.name, 'zh-CN')
        ))
        setAvailableSkills(next)
        const firstUnadded = next.find((skill) => !currentSkills.some((item) => item.skillFile === skill.skillFile)) ?? next[0]
        setSelectedFile(firstUnadded?.skillFile ?? '')
        if (!next.length) setError('没有读取到可用的本地 Skill')
      } catch (loadError) {
        if (!disposed) setError(loadError instanceof Error ? loadError.message : '本地 Skill 加载失败')
      } finally {
        if (!disposed) setLoading(false)
      }
    }
    void load()
    return () => { disposed = true }
  }, [currentSkills])

  const categories = useMemo(() => [...new Set(availableSkills.map((skill) => skill.category))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN')), [availableSkills])
  const availableSourceIds = useMemo(() => new Set(availableSkills.map((skill) => skill.sourceId)), [availableSkills])
  const filteredSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return availableSkills.filter((skill) => (
      (sourceFilter === 'all' || skill.sourceId === sourceFilter)
      && (categoryFilter === 'all' || skill.category === categoryFilter)
      && (!normalizedQuery || `${skill.name} ${skill.oneLine} ${skill.folder}`.toLocaleLowerCase().includes(normalizedQuery))
    ))
  }, [availableSkills, categoryFilter, query, sourceFilter])

  useEffect(() => {
    if (filteredSkills.some((skill) => skill.skillFile === selectedFile)) return
    const firstUnadded = filteredSkills.find((skill) => !currentSkills.some((item) => item.skillFile === skill.skillFile))
      ?? filteredSkills[0]
    setSelectedFile(firstUnadded?.skillFile ?? '')
  }, [currentSkills, filteredSkills, selectedFile])

  const selected = filteredSkills.find((skill) => skill.skillFile === selectedFile)
  const alreadyAdded = Boolean(selected && currentSkills.some((skill) => skill.skillFile === selected.skillFile))

  return <div className="modal-mask" onClick={onClose}>
    <div className="modal project-skill-picker-modal" role="dialog" aria-modal="true" aria-labelledby="project-skill-picker-title" onClick={(event) => event.stopPropagation()}>
      <div className="project-skill-modal-head">
        <div><span>PROJECT SKILL</span><h2 id="project-skill-picker-title">添加到项目</h2></div>
        <button className="modal-close" aria-label="关闭 Skill 选择窗口" onClick={onClose}>×</button>
      </div>
      <p className="project-skill-modal-intro">选择一个本地 Skill，关联到当前项目右栏。</p>

      <div className="project-skill-filter-panel">
        <label className="project-skill-search-field">
          <span>筛选 Skill</span>
          <input
            type="search"
            aria-label="筛选 Skill"
            placeholder="输入名称、说明或文件夹…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="project-skill-filter-row">
          <label>
            <span>来源</span>
            <select aria-label="按 Skill 来源筛选" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'all' | SkillSourceId)}>
              <option value="all">全部来源</option>
              <option value="hermes" disabled={!availableSourceIds.has('hermes')}>Hermes</option>
              <option value="codex" disabled={!availableSourceIds.has('codex')}>Codex</option>
              <option value="claude" disabled={!availableSourceIds.has('claude')}>Claude Code</option>
              {availableSourceIds.has('custom') && <option value="custom">自定义目录</option>}
            </select>
          </label>
          <label>
            <span>分类</span>
            <select aria-label="按 Skill 分类筛选" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">全部分类</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <span className="project-skill-filter-count">{filteredSkills.length} / {availableSkills.length}</span>
        </div>
      </div>

      <div className="project-skill-context-strip">
        <div className="wide"><span>Skill 所属文件夹</span><code>{selected?.path || '选择后显示'}</code></div>
        <div><span>来源 · 分类</span><b>{selected ? `${selected.sourceLabel} · ${selected.category}` : '—'}</b></div>
      </div>

      <label className="project-skill-select-field">
        <span>选择 Skill</span>
        <select
          aria-label="选择要添加的 Skill"
          value={selectedFile}
          disabled={loading || !filteredSkills.length}
          onChange={(event) => setSelectedFile(event.target.value)}
        >
          {!filteredSkills.length && <option value="">没有匹配的 Skill</option>}
          {filteredSkills.map((skill) => <option key={skill.skillFile} value={skill.skillFile}>
            {skill.name}{currentSkills.some((item) => item.skillFile === skill.skillFile) ? '（已添加）' : ''}
          </option>)}
        </select>
      </label>

      <div className="project-skill-selection-note">
        {loading ? <><span className="skill-loader" />正在扫描本地 Skill…</>
          : error ? <span className="error">{error}</span>
            : !filteredSkills.length ? <span>没有符合当前筛选条件的 Skill</span>
              : <><b>{selected?.name}</b><span>{selected?.oneLine}</span></>}
      </div>
      <div className="project-skill-project-path"><span>关联项目</span><code>{projectPath}</code></div>
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary" disabled={!selected || alreadyAdded} onClick={() => selected && onAdd(selected)}>
          {alreadyAdded ? '已在当前项目' : '添加 Skill'}
        </button>
      </div>
    </div>
  </div>
}

function ProjectSkillUseModal({ skill, project, file, onClose, onRemove, notify }: {
  skill: ProjectSkill
  project: LocalProject
  file: ProjectMarkdownFile | null
  onClose: () => void
  onRemove: () => void
  notify: (text: string) => void
}) {
  const [requirement, setRequirement] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const prompt = file ? buildProjectSkillPrompt({ skill, project, file, requirement }) : ''

  const copyPrompt = async () => {
    if (!prompt) return
    try {
      await copyText(prompt)
      setCopyState('copied')
      notify('项目提示词已复制，可以发送给 Hermes')
    } catch {
      setCopyState('error')
      notify('复制失败，请检查浏览器剪贴板权限')
    }
  }

  return <div className="modal-mask" onClick={onClose}>
    <div className="modal project-skill-use-modal" role="dialog" aria-modal="true" aria-labelledby="project-skill-use-title" onClick={(event) => event.stopPropagation()}>
      <div className="project-skill-modal-head">
        <div><span>{skill.category}</span><h2 id="project-skill-use-title">使用 {skill.name}</h2></div>
        <button className="modal-close" aria-label="关闭 Skill 使用窗口" onClick={onClose}>×</button>
      </div>
      <p className="project-skill-modal-intro">{skill.oneLine}</p>
      <div className="project-skill-context-strip use-context">
        <div className="wide"><span>Skill 所属文件夹</span><code>{skill.path}</code></div>
        <div><span>当前项目</span><b>{project.name}</b></div>
      </div>
      <label className="project-skill-task-field">
        <span>告诉 Hermes 要完成什么 <i>选填</i></span>
        <textarea
          maxLength={5_000}
          value={requirement}
          onChange={(event) => { setRequirement(event.target.value); setCopyState('idle') }}
          placeholder="留空则结合当前 Markdown 和项目上下文，按 Skill 默认流程执行。"
        />
      </label>
      {file ? <details className="project-skill-prompt-preview">
        <summary>查看可复制提示词</summary>
        <pre>{prompt}</pre>
      </details> : <div className="project-skill-no-file">请先从左侧打开一个 Markdown 文件，再生成项目提示词。</div>}
      <div className="project-skill-copy-state" aria-live="polite">
        {copyState === 'copied' && '已复制：包含 Skill 调用地址、所属文件夹和当前项目上下文。'}
        {copyState === 'error' && '剪贴板不可用，请检查浏览器权限。'}
      </div>
      <div className="project-skill-modal-actions">
        <button className="remove" onClick={onRemove}>从此项目移除</button>
        <span />
        <button onClick={onClose}>取消</button>
        <button className="copy" disabled={!file} onClick={() => void copyPrompt()}>{copyState === 'copied' ? '✓ 已复制提示词' : '复制提示词'}</button>
      </div>
    </div>
  </div>
}

export function ProjectWorkspace({ active, sidebarOpen, onOpenSidebar, notify }: {
  active: boolean
  sidebarOpen: boolean
  onOpenSidebar: () => void
  notify: (text: string) => void
}) {
  const [project, setProject] = useState<LocalProject | null>(null)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [file, setFile] = useState<ProjectMarkdownFile | null>(null)
  const [opening, setOpening] = useState(false)
  const [manualPathOpen, setManualPathOpen] = useState(false)
  const [manualPath, setManualPath] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'dirty'>('saved')
  const [skills, setSkills] = useState<ProjectSkill[]>([])
  const [selectedSkill, setSelectedSkill] = useState<ProjectSkill | null>(null)
  const [skillPickerOpen, setSkillPickerOpen] = useState(false)
  const [skillsCollapsed, setSkillsCollapsed] = useState(() => {
    try { return localStorage.getItem('cowrite.project.skills-collapsed') === 'true' }
    catch { return false }
  })
  const attemptedOpen = useRef(false)

  const openFile = useCallback(async (filePath: string, targetProject = project) => {
    if (!targetProject) return
    setActivePath(filePath)
    setLoadingFile(true)
    setSaveState('saved')
    try {
      const next = await requestJson<ProjectMarkdownFile>(
        `/api/projects/${targetProject.id}/file?path=${encodeURIComponent(filePath)}`,
      )
      setFile(next)
    } catch (error) {
      setFile(null)
      notify(error instanceof Error ? error.message : 'Markdown 文件加载失败')
    } finally {
      setLoadingFile(false)
    }
  }, [notify, project])

  const chooseFolder = useCallback(async (directory?: string) => {
    if (opening) return
    setOpening(true)
    try {
      const next = await requestJson<LocalProject>('/api/projects/open', {
        method: 'POST',
        body: JSON.stringify(directory?.trim() ? { directory: directory.trim() } : {}),
      })
      setProject(next)
      setFile(null)
      setActivePath(null)
      setSelectedSkill(null)
      setManualPathOpen(false)
      const firstFile = next.markdownFiles[0]
      if (firstFile) await openFile(firstFile, next)
      notify(`已加载 ${next.name} · ${next.markdownFiles.length} 个 Markdown 文件`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '文件夹加载失败'
      if (!message.includes('取消')) notify(message)
    } finally {
      setOpening(false)
    }
  }, [notify, openFile, opening])

  const refreshProject = useCallback(async () => {
    if (!project) return
    try {
      const next = await requestJson<LocalProject>(`/api/projects/${project.id}`)
      setProject(next)
      if (activePath && !next.markdownFiles.includes(activePath)) {
        setActivePath(null)
        setFile(null)
      }
      notify(`目录已刷新 · ${next.markdownFiles.length} 个 Markdown 文件`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '目录刷新失败')
    }
  }, [activePath, notify, project])

  useEffect(() => {
    const syncSkills = () => {
      if (!project) return
      const next = loadProjectSkills(project.path)
      setSkills(next)
      setSelectedSkill((current) => current && next.some((item) => item.skillFile === current.skillFile) ? current : null)
    }
    syncSkills()
    window.addEventListener(PROJECT_SKILLS_CHANGED_EVENT, syncSkills)
    window.addEventListener('storage', syncSkills)
    return () => {
      window.removeEventListener(PROJECT_SKILLS_CHANGED_EVENT, syncSkills)
      window.removeEventListener('storage', syncSkills)
    }
  }, [project])

  useEffect(() => {
    if (!active || project || attemptedOpen.current) return
    attemptedOpen.current = true
    void chooseFolder()
  }, [active, chooseFolder, project])

  useEffect(() => {
    try { localStorage.setItem('cowrite.project.skills-collapsed', String(skillsCollapsed)) }
    catch { /* 浏览器存储不可用时仍保留本次会话状态 */ }
  }, [skillsCollapsed])

  const markProjectDirty = useCallback(() => setSaveState('dirty'), [])
  const updateCurrentContent = useCallback((content: string) => {
    setFile((current) => current?.path === activePath ? { ...current, content } : current)
  }, [activePath])
  const acceptSavedFile = useCallback((updated: ProjectMarkdownFile) => {
    setFile((current) => current?.path === updated.path ? updated : current)
    if (activePath === updated.path) setSaveState('saved')
  }, [activePath])

  const addSkillToProject = (skill: LocalSkill) => {
    if (!project) return
    const next = addProjectSkill(project.path, skill)
    setSkills(next)
    setSkillPickerOpen(false)
    notify(`已把 ${skill.name} 添加到当前项目`)
  }

  const removeSkillFromProject = (skill: ProjectSkill) => {
    if (!project) return
    const next = removeProjectSkill(project.path, skill.skillFile)
    setSkills(next)
    setSelectedSkill(null)
    notify(`已从当前项目移除 ${skill.name}`)
  }

  return <><section className={`project-workspace ${active ? '' : 'inactive'}`} aria-hidden={!active}>
    <header className="project-topbar">
      {!sidebarOpen && <button className="icon-button" title="展开目录" onClick={onOpenSidebar}>☰</button>}
      <div className="project-heading">
        <span className="project-mark">P</span>
        <div><b>{project?.name || '项目'}</b><small>{project?.path || '连接本地 Markdown 文件夹'}</small></div>
      </div>
      <span className="project-local-badge"><i />本地读写</span>
      <button className="project-switch" disabled={opening} onClick={() => void chooseFolder()}>{opening ? '选择中…' : project ? '切换文件夹' : '选择文件夹'}</button>
    </header>

    {!project ? <div className="project-empty">
      <div className="project-empty-graphic"><span /><span /><span /></div>
      <p className="project-kicker">LOCAL MARKDOWN WORKSPACE</p>
      <h1>把一个文件夹，变成写作现场</h1>
      <p>选择本地项目后，Cowrite 会组织其中的 Markdown、提供实时编辑，并把当前上下文交给你指定的 Skill。</p>
      <button className="primary" disabled={opening} onClick={() => void chooseFolder()}>{opening ? '等待系统选择…' : '选择本地文件夹'}</button>
      {manualPathOpen ? <form className="project-manual-path" onSubmit={(event) => { event.preventDefault(); void chooseFolder(manualPath) }}>
        <input
          autoFocus
          value={manualPath}
          onChange={(event) => setManualPath(event.target.value)}
          placeholder="/Users/me/Documents/project"
          aria-label="项目文件夹绝对路径"
          spellCheck={false}
        />
        <button disabled={opening || !manualPath.trim()} type="submit">加载</button>
      </form> : <button className="project-manual-toggle" onClick={() => setManualPathOpen(true)}>系统选择器不可用？输入绝对路径</button>}
      <small>文件只在本机读取与保存</small>
    </div> : <div className={`project-grid ${skillsCollapsed ? 'skills-collapsed' : ''}`}>
      <aside className="project-files-panel">
        <div className="project-panel-title"><div><b>文件</b><span>{project.markdownFiles.length}</span></div><button title="刷新目录" onClick={() => void refreshProject()}>↻</button></div>
        {project.tree.length
          ? <FileTree nodes={project.tree} activePath={activePath} onOpen={(path) => void openFile(path)} />
          : <div className="project-panel-empty"><b>没有 Markdown</b><span>这个文件夹里还没有 .md 文件</span></div>}
        {project.warnings.length > 0 && <div className="project-warning" title={project.warnings.join('\n')}>{project.warnings.length} 个目录未能读取</div>}
      </aside>

      <main className="project-document">
        <div className="project-document-head">
          <div><b>{file?.name || '选择一个文件'}</b><span>{activePath || '从左侧目录树打开 Markdown'}</span></div>
          {file && <span className={`save-state ${saveState}`}>{saveState === 'saved' ? '已保存到本地' : '保存中…'}</span>}
        </div>
        {loadingFile
          ? <div className="project-document-state"><span className="skill-loader" /><p>正在读取 Markdown…</p></div>
          : file && project
            ? <ProjectEditor
              key={`${project.id}:${file.path}`}
              projectId={project.id}
              file={file}
              onDirty={markProjectDirty}
              onContentChange={updateCurrentContent}
              onSaved={acceptSavedFile}
              notify={notify}
            />
            : <div className="project-document-state"><span className="document-glyph">M↓</span><p>选择左侧文件开始预览与编辑</p></div>}
      </main>

      <aside className={`project-skills-panel ${skillsCollapsed ? 'collapsed' : ''}`}>
        {skillsCollapsed ? <button
          className="project-skills-expand"
          title="展开 Skills 面板"
          aria-label="展开 Skills 面板"
          aria-expanded="false"
          onClick={() => setSkillsCollapsed(false)}
        >
          <span>‹</span><b>S</b><small>{skills.length}</small>
        </button> : <>
          <div className="project-panel-title">
            <div><b>Skills</b><span>{skills.length}</span></div>
            <div className="project-panel-actions">
              <button title="添加项目 Skill" aria-label="添加项目 Skill" onClick={() => setSkillPickerOpen(true)}>＋</button>
              <button
                className="project-skills-collapse"
                title="收起 Skills 面板"
                aria-label="收起 Skills 面板"
                aria-expanded="true"
                onClick={() => setSkillsCollapsed(true)}
              >›</button>
            </div>
          </div>
          {skills.length ? <div className="project-skill-list">
            {skills.map((skill) => <button
              key={skill.skillFile}
              className={selectedSkill?.skillFile === skill.skillFile ? 'active' : ''}
              title={skill.oneLine}
              onClick={() => setSelectedSkill(skill)}
            >{skill.name}</button>)}
          </div> : <div className="project-panel-empty skills-empty">
            <b>这个项目还没有 Skill</b>
            <span>从本机 Skill 目录中选择并关联</span>
            <button onClick={() => setSkillPickerOpen(true)}>选择 Skill</button>
          </div>}
          <div className="project-skills-footnote">点击 Skill 打开使用提示词</div>
        </>}
      </aside>
    </div>}
  </section>
  {skillPickerOpen && project && <ProjectSkillPickerModal
    projectPath={project.path}
    currentSkills={skills}
    onClose={() => setSkillPickerOpen(false)}
    onAdd={addSkillToProject}
  />}
  {selectedSkill && project && <ProjectSkillUseModal
    skill={selectedSkill}
    project={project}
    file={file}
    onClose={() => setSelectedSkill(null)}
    onRemove={() => removeSkillFromProject(selectedSkill)}
    notify={notify}
  />}
  </>
}
