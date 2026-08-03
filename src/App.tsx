import { useCallback, useEffect, useRef, useState } from 'react'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import type { CowriteTask, Page, TaskAction } from '../shared/types'
import { cowriteFetch } from './apiClient'
import { SkillManager } from './SkillManager'
import { ActionConfigManager } from './ActionConfigManager'
import { ProjectWorkspace } from './ProjectWorkspace'
import { TaskCenter } from './TaskCenter'
import { EditorCommandBar } from './CommandBar'
import { HomeWorkspace } from './HomeWorkspace'
import './App.css'

type PageMeta = Omit<Page, 'content'>

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await cowriteFetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `请求失败：${response.status}`)
  return result as T
}


function NewPageModal({ onClose, onCreated, notify, initialMode = 'write' }: {
  onClose: () => void
  onCreated: (page: Page) => void
  notify: (text: string) => void
  initialMode?: 'write' | 'import'
}) {
  const [mode, setMode] = useState<'write' | 'import'>(initialMode)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [importedContent, setImportedContent] = useState('')
  const [importedFileName, setImportedFileName] = useState('')
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chooseImport = () => {
    setMode('import')
    fileInputRef.current?.click()
  }

  const loadMarkdown = async (file?: File) => {
    if (!file) return
    if (!/\.(md|markdown)$/i.test(file.name)) {
      notify('请选择 .md 或 .markdown 文件')
      return
    }
    const content = await file.text()
    if (!content.trim()) {
      notify('这个 Markdown 文件是空的')
      return
    }
    if (content.length > 500_000) {
      notify('Markdown 内容超过 500,000 个字符，暂时无法导入')
      return
    }
    const heading = content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
    setImportedContent(content)
    setImportedFileName(file.name)
    setTitle(heading || file.name.replace(/\.(md|markdown)$/i, ''))
  }

  const create = async () => {
    setCreating(true)
    try {
      const input = mode === 'import' ? { title, content: importedContent } : { title, prompt }
      const page = await api<Page>('/api/pages', { method: 'POST', body: JSON.stringify(input) })
      if (mode === 'write' && prompt.trim()) {
        await api<CowriteTask>('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({ action: 'polish', pageId: page.id, requirements: `根据页面创作要求完成初稿：${prompt.trim()}`, delivery: 'cowrite' }),
        })
        notify('页面已创建，创作任务已发送到 Hermes')
      } else if (mode === 'import') {
        notify(`已导入 ${importedFileName}`)
      }
      onCreated(page)
    } catch (error) {
      notify(error instanceof Error ? error.message : '创建页面失败')
    } finally {
      setCreating(false)
    }
  }

  return <div className="modal-mask" onClick={onClose}>
    <div className="modal new-page-modal" onClick={(event) => event.stopPropagation()}>
      <h2>新建页面</h2>
      <div className="new-page-modes" role="tablist" aria-label="新建页面方式">
        <button className={mode === 'write' ? 'active' : ''} role="tab" aria-selected={mode === 'write'} onClick={() => setMode('write')}>输入内容</button>
        <button className={mode === 'import' ? 'active' : ''} role="tab" aria-selected={mode === 'import'} onClick={chooseImport}>导入 Markdown</button>
      </div>
      <input ref={fileInputRef} className="markdown-file-input" type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={(event) => loadMarkdown(event.target.files?.[0])} />
      {mode === 'write' ? <>
        <input autoFocus value={title} placeholder="页面标题" onChange={(event) => setTitle(event.target.value)} />
        <textarea value={prompt} placeholder="想让 Agent 创作什么？（可选）&#10;例如：写一篇 1500 字的文章，讲清楚 Skill 生态的三个层次……&#10;&#10;留空则创建空白页面，自己动手写。" onChange={(event) => setPrompt(event.target.value)} />
      </> : <>
        <button className={`markdown-picker ${importedFileName ? 'selected' : ''}`} onClick={() => fileInputRef.current?.click()}>
          <b>{importedFileName || '选择 Markdown 文件'}</b>
          <small>{importedFileName ? '点击可重新选择' : '支持 .md 和 .markdown'}</small>
        </button>
        <input value={title} placeholder="导入后的页面标题" onChange={(event) => setTitle(event.target.value)} />
      </>}
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary" disabled={creating || !title.trim() || (mode === 'import' && !importedContent)} onClick={create}>
          {mode === 'import' ? '导入页面' : prompt.trim() ? '创建并发送任务' : '创建空白页'}
        </button>
      </div>
    </div>
  </div>
}

function DeletePageModal({ page, pendingTasks, onClose, onConfirm }: {
  page: PageMeta
  pendingTasks: number
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const confirm = async () => {
    setDeleting(true)
    try { await onConfirm() } finally { setDeleting(false) }
  }
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal delete-modal" role="alertdialog" aria-labelledby="delete-page-title" aria-describedby="delete-page-description" onClick={(event) => event.stopPropagation()}>
      <h2 id="delete-page-title">确定要删除吗？</h2>
      <p id="delete-page-description">页面“{page.title}”删除后无法恢复。</p>
      {pendingTasks > 0 && <p className="delete-pending-tasks">该页面还有 <b>{pendingTasks}</b> 个排队或执行中的任务，删除页面会一并取消这些任务。</p>}
      <div className="modal-actions">
        <button disabled={deleting} onClick={onClose}>取消</button>
        <button className="delete-confirm" disabled={deleting} onClick={confirm}>{deleting ? '删除中…' : pendingTasks > 0 ? '删除并取消任务' : '确定删除'}</button>
      </div>
    </div>
  </div>
}

function Editor({ page, onDirty, onSaved, notify }: {
  page: Page
  onDirty: () => void
  onSaved: (page: Page) => void
  notify: (text: string) => void
}) {
  const holderRef = useRef<HTMLDivElement>(null)
  const vditorRef = useRef<Vditor | null>(null)
  const revisionRef = useRef(page.revision)
  const assetBase = `${window.location.origin}${window.location.pathname.replace(/\/+$/, '/')}`
  const fixAssetLinks = (markdown: string) => markdown.replace(/(\]\()\/assets\//g, `](${assetBase}assets/`)
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [selectionBar, setSelectionBar] = useState<{ x: number; y: number; text: string } | null>(null)
  const pageId = page.id

  const uploadClipboardImage = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      throw new Error('仅支持粘贴 PNG、JPEG、GIF 或 WebP 图片')
    }
    if (file.size > 10 * 1024 * 1024) throw new Error('粘贴图片不能超过 10 MB')
    const response = await cowriteFetch('/api/assets/upload', {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    const result = await response.json() as { url?: string; error?: string }
    if (!response.ok || !result.url) throw new Error(result.error || '图片上传失败')
    return result.url
  }

  const save = useCallback(async () => {
    const editor = vditorRef.current
    if (!editor || !dirtyRef.current) return
    const content = editor.getValue()
    try {
      const updated = await api<Page>(`/api/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content, expectedRevision: revisionRef.current }),
      })
      revisionRef.current = updated.revision
      dirtyRef.current = false
      onSaved(updated)
    } catch (reason) {
      notify(String(reason instanceof Error ? reason.message : reason))
    }
  }, [pageId, onSaved, notify])

  const scheduleSave = useCallback((delay = 800) => {
    dirtyRef.current = true
    onDirty()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(save, delay)
  }, [onDirty, save])

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    let disposed = false
    const rewriteAssetLinks = () => {
      try {
        holder.querySelectorAll('a[href^="/assets/"]').forEach((anchor) => {
          const href = anchor.getAttribute('href')
          if (!href) return
          anchor.setAttribute('href', assetBase + href.slice(1))
          anchor.setAttribute('target', '_blank')
          anchor.setAttribute('rel', 'noopener')
        })
        holder.querySelectorAll('img[src^="/assets/"]').forEach((image) => {
          const src = image.getAttribute('src')
          if (!src) return
          image.setAttribute('src', assetBase + src.slice(1))
        })
      } catch { /* 忽略渲染期 DOM 变化 */ }
    }
    const observer = new MutationObserver(rewriteAssetLinks)
    const editor = new Vditor(holder, {
      mode: 'ir',
      value: fixAssetLinks(page.content),
      placeholder: '开始写作，或把口令粘贴给 Hermes 让它来写……',
      cache: { enable: false },
      toolbar: [],
      counter: { enable: false },
      after: () => {
        if (disposed) { editor.destroy(); return }
        observer.observe(holder, { childList: true, subtree: true })
        rewriteAssetLinks()
      },
      input: () => scheduleSave(),
    })
    vditorRef.current = editor
    const pasteImages = async (event: ClipboardEvent) => {
      const clipboard = event.clipboardData
      if (!clipboard) return
      const files = Array.from(clipboard.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null)
      let dataUrls: string[] = []
      if (!files.length) {
        const html = clipboard.getData('text/html')
        if (html.includes('data:image/')) {
          const document = new DOMParser().parseFromString(html, 'text/html')
          dataUrls = Array.from(document.querySelectorAll('img'))
            .map((image) => image.getAttribute('src') || '')
            .filter((source) => /^data:image\/(png|jpeg|gif|webp);base64,/i.test(source))
        }
      }
      if (!files.length && !dataUrls.length) return
      event.preventDefault()
      event.stopPropagation()
      notify(files.length > 1 ? `正在上传 ${files.length} 张图片…` : '正在上传图片…')
      try {
        for (const [index, source] of [...new Set(dataUrls)].entries()) {
          const blob = await fetch(source).then((response) => response.blob())
          files.push(new File([blob], `clipboard-image-${index + 1}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1]}`, { type: blob.type }))
        }
        const markdown: string[] = []
        for (const file of files) {
          const url = await uploadClipboardImage(file)
          const alt = (file.name.replace(/\.[^.]+$/, '') || '粘贴图片').replace(/[\[\]\r\n]/g, '')
          markdown.push(`![${alt}](${url})`)
        }
        editor.focus()
        editor.insertValue(`${markdown.join('\n')}\n`)
        scheduleSave(200)
        notify(files.length > 1 ? `${files.length} 张图片已插入` : '图片已插入')
      } catch (reason) {
        notify(String(reason instanceof Error ? reason.message : reason))
      }
    }
    holder.addEventListener('paste', pasteImages, true)
    return () => {
      disposed = true
      clearTimeout(timerRef.current)
      try { observer.disconnect() } catch { /* 忽略 */ }
      holder.removeEventListener('paste', pasteImages, true)
      try { editor.destroy() } catch { /* 未完成初始化时忽略 */ }
      vditorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId])

  // Agent 在后台写回时（revision 变化且本地无未保存修改），刷新编辑器
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const latest = await api<Page>(`/api/pages/${pageId}`)
        if (latest.revision !== revisionRef.current && !dirtyRef.current) {
          revisionRef.current = latest.revision
          vditorRef.current?.setValue(fixAssetLinks(latest.content))
          onSaved(latest)
          notify('Agent 已更新这个页面')
        }
      } catch { /* 服务重启间隙忽略 */ }
    }, 4000)
    return () => clearInterval(poll)
  }, [pageId, onSaved, notify])

  // 选中文字时显示浮动工具栏
  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const update = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) { setSelectionBar(null); return }
      const text = selection.toString().trim()
      if (!text || !holder.contains(selection.anchorNode)) { setSelectionBar(null); return }
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      setSelectionBar({ x: rect.left + rect.width / 2, y: rect.top, text })
    }
    const onMouseUp = () => setTimeout(update, 0)
    const onKeyUp = (event: KeyboardEvent) => { if (event.key.startsWith('Arrow') || event.shiftKey) setTimeout(update, 0) }
    const onDown = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest('.selection-bar')) setSelectionBar(null) }
    holder.addEventListener('mouseup', onMouseUp)
    holder.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousedown', onDown)
    return () => {
      holder.removeEventListener('mouseup', onMouseUp)
      holder.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousedown', onDown)
    }
  }, [pageId])

  // 在 Markdown 原文中定位选中文字并包裹格式（避免操作 DOM 选区带来的段落错位）
  const wrapSelection = (before: string, after: string) => {
    const editor = vditorRef.current
    if (!editor || !selectionBar) return
    const markdown = editor.getValue()
    const text = selectionBar.text
    const index = markdown.indexOf(text)
    setSelectionBar(null)
    if (index === -1) { notify('没有在正文中找到选中文字，请重新选择'); return }
    const wrapped = markdown.slice(0, index) + before + text + after + markdown.slice(index + text.length)
    editor.setValue(wrapped)
    scheduleSave(400)
  }

  const sendAi = async (action: TaskAction, requirements: string, sentHint: string) => {
    try {
      await api<CowriteTask>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action, pageId, requirements, delivery: 'cowrite' }),
      })
      setSelectionBar(null)
      notify(sentHint)
    } catch (error) {
      notify(error instanceof Error ? error.message : '任务发送失败')
    }
  }

  return <>
    <div className="editor-holder" ref={holderRef} />
    {selectionBar && <div className="selection-bar" style={{ left: selectionBar.x, top: selectionBar.y }}>
      <>
            <button title="加粗" onMouseDown={(event) => { event.preventDefault(); wrapSelection('**', '**') }}><b>B</b></button>
            <button title="斜体" onMouseDown={(event) => { event.preventDefault(); wrapSelection('*', '*') }}><i>I</i></button>
            <button title="删除线" onMouseDown={(event) => { event.preventDefault(); wrapSelection('~~', '~~') }}><s>S</s></button>
            <button title="行内代码" onMouseDown={(event) => { event.preventDefault(); wrapSelection('`', '`') }}>{'<>'}</button>
            <button title="引用" onMouseDown={(event) => { event.preventDefault(); wrapSelection('\n> ', '\n') }}>&gt;</button>
            <span className="bar-divider" />
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); sendAi('illustrate', `只为以下选中文段配图，并插入其后：\n${selectionBar.text}`, '配图任务已发送，结果会插入选中段落下方') }}>配图</button>
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); sendAi('illustrate', `为以下选中文字制作 HTML 解释图并插入其后：\n${selectionBar.text}`, 'HTML 解释图任务已发送') }}>HTML</button>
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); sendAi('polish', `只优化以下选中文字，保持原意和上下文：\n${selectionBar.text}`, '优化任务已发送，Hermes 只会改写这段文字') }}>优化</button>
            <button className="ai" onMouseDown={(event) => { event.preventDefault(); sendAi('polish', `根据上下文改进以下选中文字，如需求不明确请在任务结果中说明：\n${selectionBar.text}`, '修改任务已发送到 Hermes') }}>对话</button>
          </>
    </div>}
  </>
}

function App() {
  const [pages, setPages] = useState<PageMeta[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<Page | null>(null)
  const [workspaceView, setWorkspaceView] = useState<'home' | 'page' | 'project' | 'skill-manager' | 'action-config' | 'tasks'>('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [newPageMode, setNewPageMode] = useState<'write' | 'import'>('write')
  const [deleteTarget, setDeleteTarget] = useState<PageMeta | null>(null)
  const [deletePendingTasks, setDeletePendingTasks] = useState(0)
  const [saveState, setSaveState] = useState<'saved' | 'dirty'>('saved')
  const [toast, setToast] = useState('')

  const refreshList = useCallback(async () => {
    const list = await api<PageMeta[]>('/api/pages')
    setPages(list)
    return list
  }, [])

  useEffect(() => {
    refreshList().then((list) => {
      if (list.length > 0) setActiveId((current) => current ?? list[0].id)
    }).catch(() => setToast('无法连接本地服务，请先运行 npm run dev'))
  }, [refreshList])

  useEffect(() => {
    const timer = setInterval(() => { refreshList().catch(() => {}) }, 5000)
    return () => clearInterval(timer)
  }, [refreshList])

  useEffect(() => {
    if (!activeId) { setActivePage(null); return }
    api<Page>(`/api/pages/${activeId}`).then(setActivePage).catch(() => setActivePage(null))
  }, [activeId])

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer) }, [toast])

  const notify = useCallback((text: string) => setToast(text), [])
  const onSaved = useCallback((updated: Page) => {
    setSaveState('saved')
    setActivePage((current) => current?.id === updated.id ? { ...current, ...updated } : current)
    setPages((current) => current?.map((item) => item.id === updated.id ? { ...item, title: updated.title, revision: updated.revision, updatedAt: updated.updatedAt } : item) ?? null)
  }, [])
  const onDirty = useCallback(() => setSaveState('dirty'), [])

  const renameTitle = async (title: string) => {
    if (!activePage || title === activePage.title) return
    const updated = await api<Page>(`/api/pages/${activePage.id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
    onSaved(updated)
    await refreshList()
  }

  const removePage = async (page: PageMeta) => {
    // Cancel queued/running tasks attached to this page so they cannot write back into a deleted page.
    const all = await api<CowriteTask[]>('/api/tasks')
    const attached = all.filter((task) => task.pageId === page.id && (task.status === 'queued' || task.status === 'running'))
    for (const task of attached) {
      await api(`/api/tasks/${task.id}/cancel`, { method: 'POST' }).catch(() => undefined)
    }
    await api(`/api/pages/${page.id}`, { method: 'DELETE' })
    const list = await refreshList()
    if (activeId === page.id) setActiveId(list[0]?.id ?? null)
    setDeleteTarget(null)
    setDeletePendingTasks(0)
    notify(attached.length > 0 ? `页面已删除，${attached.length} 个关联任务已取消` : '页面已删除')
  }

  const enqueuePageTask = async (action: TaskAction, requirements?: string) => {
    if (!activePage) return false
    try {
      const task = await api<CowriteTask>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action, pageId: activePage.id, requirements, delivery: 'cowrite' }),
      })
      notify(`Hermes 任务已入队：${task.id}`)
      return true
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Hermes 任务提交失败')
      return false
    }
  }

  const sendPendingCommand = async () => {
    await enqueuePageTask('polish', activePage?.prompt || '根据当前页面的创作要求完成初稿')
  }

  if (!pages) return <div className="loading"><span>C</span><p>正在打开 Cowrite…</p></div>

  return <div className={`shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
    <aside className="sidebar">
      <div className="sidebar-head">
        <button className="sidebar-home-link" title="返回首页" onClick={() => { setWorkspaceView('home'); setSidebarOpen(false) }}>
          <span className="logo">C</span><b>Cowrite</b>
        </button>
        <button title="返回首页" onClick={() => { setSidebarOpen(false); if (workspaceView !== 'page') setWorkspaceView('home') }}>«</button>
      </div>
      <button
        className={`sidebar-tool ${workspaceView === 'home' ? 'active' : ''}`}
        aria-current={workspaceView === 'home' ? 'page' : undefined}
        onClick={() => { setWorkspaceView('home'); setSidebarOpen(false) }}
      >
        <span className="home-tool-icon" aria-hidden="true">⌂</span>
        首页
      </button>
      <button
        className={`sidebar-tool ${workspaceView === 'project' ? 'active' : ''}`}
        aria-current={workspaceView === 'project' ? 'page' : undefined}
        onClick={() => { setWorkspaceView('project'); setSidebarOpen(false) }}
      >
        <span className="project-tool-icon" aria-hidden="true" />
        项目
      </button>
      <button
        className={`sidebar-tool ${workspaceView === 'skill-manager' ? 'active' : ''}`}
        aria-current={workspaceView === 'skill-manager' ? 'page' : undefined}
        onClick={() => setWorkspaceView('skill-manager')}
      >
        <span className="skill-tool-icon" aria-hidden="true"><i /><i /><i /><i /></span>
        Skill 管理
      </button>
      <button
        className={`sidebar-tool ${workspaceView === 'action-config' ? 'active' : ''}`}
        aria-current={workspaceView === 'action-config' ? 'page' : undefined}
        onClick={() => { setWorkspaceView('action-config'); setSidebarOpen(false) }}
      >
        <span className="action-tool-icon" aria-hidden="true">⚙</span>
        动作配置
      </button>
      <button
        className={`sidebar-tool ${workspaceView === 'tasks' ? 'active' : ''}`}
        aria-current={workspaceView === 'tasks' ? 'page' : undefined}
        onClick={() => setWorkspaceView('tasks')}
      >
        <span className="task-tool-icon" aria-hidden="true">☰</span>
        任务中心
      </button>
      <button className="new-page" onClick={() => { setWorkspaceView('page'); setNewPageMode('write'); setModalOpen(true) }}>＋ 新建页面</button>
      <nav>
        {pages.map((page) => <div key={page.id} className={`sidebar-page ${workspaceView === 'page' && page.id === activeId ? 'active' : ''}`}>
          <button className="sidebar-page-select" onClick={() => { setWorkspaceView('page'); setActiveId(page.id) }}>
            <span className="doc-icon">▤</span>
            <span className="doc-title">{page.title}</span>
            {page.prompt && page.revision === 1 && <span className="pending-dot" title="等待 Agent 创作" />}
          </button>
          <button className="sidebar-delete" title={`删除 ${page.title}`} aria-label={`删除 ${page.title}`} onClick={async () => {
            setDeletePendingTasks(0)
            setDeleteTarget(page)
            try {
              const all = await api<CowriteTask[]>('/api/tasks')
              setDeletePendingTasks(all.filter((task) => task.pageId === page.id && (task.status === 'queued' || task.status === 'running')).length)
            } catch { /* keep 0 */ }
          }}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 6.5v8m3.5-8v8m3.5-8v8M4 4.5h12M7 4.5V2.8h6v1.7m-7.5 0 .7 12.7h7.6l.7-12.7" /></svg>
          </button>
        </div>)}
      </nav>
      <footer><span className="mcp-dot" />Cowrite MCP · 本地</footer>
    </aside>

    <main className="workspace">
      {workspaceView === 'home' && <HomeWorkspace
        onOpenPage={(pageId) => { setWorkspaceView('page'); setActiveId(pageId); setSidebarOpen(false) }}
        onNewPage={() => { setWorkspaceView('page'); setNewPageMode('write'); setModalOpen(true) }}
        onImportPage={() => { setWorkspaceView('page'); setNewPageMode('import'); setModalOpen(true) }}
        onOpenProject={() => { setWorkspaceView('project'); setSidebarOpen(false) }}
        onOpenTasks={() => { setWorkspaceView('tasks'); setSidebarOpen(false) }}
      />}
      {workspaceView === 'skill-manager' && <SkillManager
        sidebarOpen={sidebarOpen}
        onOpenSidebar={() => setSidebarOpen(true)}
      />}
      {workspaceView === 'action-config' && <ActionConfigManager
        page={activePage}
        notify={notify}
      />}
      {workspaceView === 'tasks' && <TaskCenter
        notify={notify}
        sidebarOpen={sidebarOpen}
        onOpenSidebar={() => setSidebarOpen(true)}
      />}
      <ProjectWorkspace
        active={workspaceView === 'project'}
        sidebarOpen={sidebarOpen}
        onOpenSidebar={() => setSidebarOpen(true)}
        notify={notify}
      />
      <div className={`page-workspace ${workspaceView === 'page' ? '' : 'inactive'}`} aria-hidden={workspaceView !== 'page'}>
        <div className="topbar">
          {!sidebarOpen && <button className="icon-button" title="展开目录" onClick={() => setSidebarOpen(true)}>☰</button>}
          {activePage && <>
            <input
              className="title-input"
              key={activePage.id}
              defaultValue={activePage.title}
              placeholder="未命名页面"
              onBlur={(event) => { if (event.target.value.trim()) renameTitle(event.target.value.trim()) }}
            />
            <span className={`save-state ${saveState}`}>{saveState === 'saved' ? '已保存' : '保存中…'}</span>
          </>}
        </div>
        {activePage && <EditorCommandBar page={activePage} notify={notify} />}
        {activePage?.prompt && activePage.revision === 1 && <div className="prompt-banner">
          <div><b>等待 Agent 创作</b><p>{activePage.prompt}</p></div>
          <button onClick={sendPendingCommand}>发送到 Hermes</button>
        </div>}
        {activePage
          ? <Editor key={activePage.id} page={activePage} onDirty={onDirty} onSaved={onSaved} notify={notify} />
          : <div className="empty-state"><p>没有页面。</p><button className="primary" onClick={() => setModalOpen(true)}>＋ 新建页面</button></div>}
      </div>
    </main>

    {modalOpen && <NewPageModal
      initialMode={newPageMode}
      onClose={() => setModalOpen(false)}
      onCreated={async (page) => { setModalOpen(false); setWorkspaceView('page'); await refreshList(); setActiveId(page.id) }}
      notify={notify}
    />}
    {deleteTarget && <DeletePageModal
      page={deleteTarget}
      pendingTasks={deletePendingTasks}
      onClose={() => { setDeleteTarget(null); setDeletePendingTasks(0) }}
      onConfirm={() => removePage(deleteTarget)}
    />}
    {toast && <div className="toast">✓ {toast}</div>}
  </div>
}

export default App