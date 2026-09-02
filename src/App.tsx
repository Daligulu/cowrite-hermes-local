import { useCallback, useEffect, useRef, useState } from 'react'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import type { CowriteTask, Page, TaskAction, TaskStatus } from '../shared/types'
import { cowriteFetch } from './apiClient'
import { SkillManager } from './SkillManager'
import { ActionConfigManager } from './ActionConfigManager'
import { ProjectWorkspace } from './ProjectWorkspace'
import { TaskCenter } from './TaskCenter'
import { EditorCommandBar } from './CommandBar'
import { TopicConfirmPanel } from './TopicConfirmPanel'
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

function Editor({ page, onDirty, onSaved, notify, imageStyles, imageStyle, onImageStyleChange }: {
  page: Page
  onDirty: () => void
  onSaved: (page: Page) => void
  notify: (text: string) => void
  imageStyles: Array<{ id: string; label: string; description?: string }>
  imageStyle: string
  onImageStyleChange: (id: string) => void
}) {
  const holderRef = useRef<HTMLDivElement>(null)
  const vditorRef = useRef<Vditor | null>(null)
  const revisionRef = useRef(page.revision)
  const assetBase = `${window.location.origin}${window.location.pathname.replace(/\/+$/, '/')}`
  // 方案A(根治)：把 content 里指向本平台 assets 的链接统一重写为「当前入口」的绝对地址。
  // 1) markdown 图片/链接相对路径 ](/assets/xxx) → 当前入口绝对地址
  // 2) 已被污染的绝对 URL（http://107.150.109.152/cowrite-xxx/assets/ 或 https://<tunnel>/cowrite-xxx/assets/）
  //    → 用 assetBase 重写成当前入口（修复旧数据，且隧道换域名/换入口都能加载）
  const createFixAssetLinks = (markdown: string) => {
    const originPattern = /(?:https?:\/\/[^\/\s]+)\/[^/\s]*\/assets\//g
    let out = markdown.replace(originPattern, `${assetBase}assets/`)
    out = out.replace(/(\]\()\/assets\//g, `](${assetBase}assets/`)
    return out
  }
  const fixAssetLinks = createFixAssetLinks
  const dirtyRef = useRef(false)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const prevValueRef = useRef(page.content)
  const lastPushRef = useRef(0)
  const restoringRef = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectionBar, setSelectionBar] = useState<{ x: number; y: number; text: string } | null>(null)
  const pageId = page.id

  // 公众号排版产物「只读 + 复制」预览（模态 iframe 渲染）
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const openPreview = async () => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewError('')
    try {
      const response = await cowriteFetch(`/api/pages/${pageId}/gzh-preview`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: '预览生成失败' }))
        throw new Error(body.error || '预览生成失败')
      }
      setPreviewHtml(await response.text())
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : '预览加载失败')
      setPreviewHtml('')
    } finally {
      setPreviewLoading(false)
    }
  }

  // 公众号排版主题：优先从 /api/style-config 的 layout 预设读取，失败用兜底列表
  const [gzhThemes, setGzhThemes] = useState<Array<{ id: string; label: string; description?: string }>>([])
  const [gzhTheme, setGzhTheme] = useState('graphite-minimal')
  const [gzhThemesState, setGzhThemesState] = useState<'loading' | 'ready'>('loading')
  useEffect(() => {
    let mounted = true
    api<{ config: { styles: { layout?: Array<{ id: string; label: string; description?: string }> } } }>('/api/style-config')
      .then((data) => {
        const layout = data?.config?.styles?.layout ?? []
        if (mounted && layout.length) { setGzhThemes(layout); setGzhThemesState('ready') }
      })
      .catch(() => { if (mounted) setGzhThemesState('ready') })
    return () => { mounted = false }
  }, [])

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
    if (!editor) return
    setSaving(true)
    const content = editor.getValue()
    try {
      const updated = await api<Page>(`/api/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content, expectedRevision: revisionRef.current }),
      })
      revisionRef.current = updated.revision
      dirtyRef.current = false
      onSaved(updated)
      notify('已保存')
    } catch (reason) {
      notify(String(reason instanceof Error ? reason.message : reason))
    } finally {
      setSaving(false)
    }
  }, [pageId, onSaved, notify])

  // 手动编辑历史栈：每次输入只记一步（合并 600ms 内的连续输入），可撤销/恢复
  const pushHistory = useCallback(() => {
    const editor = vditorRef.current
    if (!editor || restoringRef.current) return
    const current = editor.getValue()
    const now = Date.now()
    if (undoStackRef.current.length === 0 || now - lastPushRef.current >= 600) {
      // 新的一步：记录“本次输入前”的快照
      undoStackRef.current.push(prevValueRef.current)
      if (undoStackRef.current.length > 100) undoStackRef.current.shift()
      redoStackRef.current = []
      setCanUndo(true)
      setCanRedo(false)
    }
    // 无论是否合并，都推进基准与时间戳，保证下一步快照是“当前值”
    prevValueRef.current = current
    lastPushRef.current = now
  }, [])

  const markDirty = useCallback(() => {
    dirtyRef.current = true
    onDirty()
  }, [onDirty])

  const undo = useCallback(() => {
    const editor = vditorRef.current
    if (!editor || !undoStackRef.current.length) return
    const current = editor.getValue()
    redoStackRef.current.push(current)
    const previous = undoStackRef.current.pop()!
    prevValueRef.current = previous
    restoringRef.current = true
    editor.setValue(previous)
    restoringRef.current = false
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
    markDirty()
    notify('已回退')
  }, [markDirty, notify])

  const redo = useCallback(() => {
    const editor = vditorRef.current
    if (!editor || !redoStackRef.current.length) return
    const current = editor.getValue()
    undoStackRef.current.push(current)
    const next = redoStackRef.current.pop()!
    prevValueRef.current = next
    restoringRef.current = true
    editor.setValue(next)
    restoringRef.current = false
    setCanUndo(true)
    setCanRedo(redoStackRef.current.length > 0)
    markDirty()
    notify('已恢复')
  }, [markDirty, notify])

  // 编辑内容变化：只标记未保存 + 记录历史，不再自动保存
  const handleInput = useCallback(() => {
    pushHistory()
    markDirty()
  }, [pushHistory, markDirty])

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    let disposed = false
    const rewriteAssetLinks = () => {
      try {
        // 匹配「指向本平台 assets 的链接」：要么 /assets/ 开头的相对路径，要么指向本平台任何入口的绝对 URL
        const isCowriteAsset = (url: string) => {
          const u = url.trim()
          return u.startsWith('/assets/') || /^https?:\/\/[^/\s]+\/[^/\s]*\/assets\//.test(u)
        }
        holder.querySelectorAll('a').forEach((anchor) => {
          const href = anchor.getAttribute('href')
          if (!href || !isCowriteAsset(href)) return
          const rel = href.startsWith('/assets/')
            ? assetBase + href.slice(1)
            : assetBase + href.substring(href.search(/\/assets\//) + 1)
          anchor.setAttribute('href', rel)
          anchor.setAttribute('target', '_blank')
          anchor.setAttribute('rel', 'noopener')
        })
        holder.querySelectorAll('img').forEach((image) => {
          const src = image.getAttribute('src')
          if (!src || !isCowriteAsset(src)) return
          const rel = src.startsWith('/assets/')
            ? assetBase + src.slice(1)
            : assetBase + src.substring(src.search(/\/assets\//) + 1)
          image.setAttribute('src', rel)
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
      input: () => handleInput(),
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
        handleInput()
        notify(files.length > 1 ? `${files.length} 张图片已插入` : '图片已插入')
      } catch (reason) {
        notify(String(reason instanceof Error ? reason.message : reason))
      }
    }
    holder.addEventListener('paste', pasteImages, true)
    return () => {
      disposed = true
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
          restoringRef.current = true
          vditorRef.current?.setValue(fixAssetLinks(latest.content))
          restoringRef.current = false
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

  // 撤销/恢复快捷键：Ctrl+Z 回退，Ctrl+Y / Ctrl+Shift+Z 恢复
  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (key === 'y') {
        event.preventDefault()
        redo()
      }
    }
    holder.addEventListener('keydown', onKeyDown)
    return () => holder.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo])

  // 刷新/关闭页面时，若有未保存修改则提示
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

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
    handleInput()
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

  const applyGzhTheme = () => {
    const theme = gzhThemes.find((t) => t.id === gzhTheme)
    const name = theme?.label ?? '石墨极简'
    void sendAi('gzh-layout', `主题：${gzhTheme}（${name}）；请把当前页面内容按该主题排版成公众号 HTML 初稿并写回页面。`, `已发送「${name}」排版任务，结果将写回当前页面`)
  }

  const applyImageStyle = () => {
    const style = imageStyles.find((s) => s.id === imageStyle)
    if (!style) {
      notify('请先为当前文章/贴图选择配图风格')
      return
    }
    void sendAi('illustrate', `配图风格：${style.label}（${style.id}）；请按此风格为当前页面内容整篇自动配图，按内容自动决定张数并插入合适位置。`, `已发送「${style.label}」整篇自动配图任务，结果将写回当前页面`)
  }

  return <>
    <div className="editor-toolbar">
      <div className="theme-select">
        <span className="theme-label">主题</span>
        <select value={gzhTheme} onChange={(event) => setGzhTheme(event.target.value)} disabled={gzhThemesState === 'loading'}>
          {gzhThemes.length === 0
            ? <option value="graphite-minimal">石墨极简</option>
            : gzhThemes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button type="button" className="editor-theme-apply" onClick={applyGzhTheme}>排版</button>
      </div>
      <div className="image-style-select">
        <span className="image-style-label">配图</span>
        <select value={imageStyle} onChange={(event) => onImageStyleChange(event.target.value)}>
          <option value="">请选择配图风格</option>
          {imageStyles.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button type="button" className="editor-image-apply" onClick={applyImageStyle}>配图</button>
      </div>
      <button type="button" className="editor-toolbar-preview" onClick={openPreview} title="预览当前页 gzh 排版产物（只读+复制）">预览</button>
      <button type="button" className="editor-tool" onClick={undo} disabled={!canUndo} title="回退（Ctrl+Z）">↶ 回退</button>
      <button type="button" className="editor-tool" onClick={redo} disabled={!canRedo} title="恢复（Ctrl+Y）">↷ 恢复</button>
      <span className="editor-toolbar-spacer" />
      <button type="button" className="editor-save" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
    </div>
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
    {previewOpen && (
      <div className="modal-mask gzh-preview-mask" onClick={() => setPreviewOpen(false)}>
        <div className="gzh-preview-modal" onClick={(event) => event.stopPropagation()}>
          <div className="gzh-preview-head">
            <span className="gzh-preview-title">公众号排版预览 <span className="gzh-preview-sub">（只读，点右上角「复制到公众号」可直接粘贴）</span></span>
            <button type="button" className="gzh-preview-close" onClick={() => setPreviewOpen(false)}>✕</button>
          </div>
          {previewLoading
            ? <div className="gzh-preview-empty">正在生成预览…</div>
            : previewError
              ? <div className="gzh-preview-empty">{previewError}</div>
              : <div className="gzh-preview-body"><iframe title="gzh-preview" srcDoc={previewHtml} sandbox="allow-same-origin allow-scripts allow-clipboard-write" /></div>}
        </div>
      </div>
    )}
  </>
}

type WorkspaceView = 'home' | 'page' | 'project' | 'skill-manager' | 'action-config' | 'tasks'

function MobileTabBar({ view, onNavigate }: {
  view: WorkspaceView
  onNavigate: (view: WorkspaceView) => void
}) {
  const tabs: Array<{ id: WorkspaceView; icon: React.ReactNode; label: string }> = [
    { id: 'home', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.8C6.6 3 4.8 3 3 3.8v8.6c1.8-.7 3.6-.7 5 0Z"/><path d="M8 3.8c1.4-.8 3.2-.8 5 0v8.6c-1.8-.7-3.6-.7-5 0Z"/><path d="M3 6.5c1.8-.6 3.6-.6 5 0M8 6.5c1.4-.6 3.2-.6 5 0M3 9c1.8-.6 3.6-.6 5 0M8 9c1.4-.6 3.2-.6 5 0"/></svg>, label: '工作台' },
    { id: 'tasks', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h10M3 8h10M3 11h10"/></svg>, label: '任务' },
    { id: 'page', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M11.2 2.8 13.2 4.8 6 12 3 13l1-3Z"/></svg>, label: '编辑' },
    { id: 'skill-manager', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 11.5 10.2 6.8M7.2 3 13 8.3l-2 1.6L5.2 4.6Z"/></svg>, label: '技能' },
    { id: 'action-config', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.4"/><path d="M8 2.2v2M8 11.8v2M13.8 8h-2M4.2 8h-2M12 4l-1.4 1.4M5.4 10.6 4 12M12 12l-1.4-1.4M5.4 5.4 4 4"/></svg>, label: '配置' },
  ]
  return (
    <nav className="mobile-tabbar" aria-label="移动端导航">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${view === tab.id ? 'active' : ''}`}
          aria-current={view === tab.id ? 'page' : undefined}
          onClick={() => onNavigate(tab.id)}
        >
          <span className="tab-ico" aria-hidden="true">{tab.icon}</span>
          <span className="tab-txt">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

function App() {
  const [pages, setPages] = useState<PageMeta[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<Page | null>(null)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [newPageMode, setNewPageMode] = useState<'write' | 'import'>('write')
  const [deleteTarget, setDeleteTarget] = useState<PageMeta | null>(null)
  const [deletePendingTasks, setDeletePendingTasks] = useState(0)
  const [saveState, setSaveState] = useState<'saved' | 'dirty'>('saved')
  const [toast, setToast] = useState('')
  const [toastLeaving, setToastLeaving] = useState(false)
  // 任务完成居中弹屏（与底部小 toast 独立并存）
  const [completion, setCompletion] = useState<{ kind: 'success' | 'fail'; text: string } | null>(null)
  // 编辑页「配图」风格：从 /api/style-config 的 image 预设读取；不设默认，必须显式选一次
  const [imageStyles, setImageStyles] = useState<Array<{ id: string; label: string; description?: string }>>([])
  const [imageStyle, setImageStyle] = useState('')
  useEffect(() => {
    let mounted = true
    api<{ config: { styles: { image?: Array<{ id: string; label: string; description?: string }> } } }>('/api/style-config')
      .then((data) => { if (mounted) setImageStyles(data?.config?.styles?.image ?? []) })
      .catch(() => { if (mounted) setImageStyles([]) })
    return () => { mounted = false }
  }, [])
  const imageStyleLabel = imageStyles.find((s) => s.id === imageStyle)?.label ?? ''
  const [completionLeaving, setCompletionLeaving] = useState(false)
  const [autoHideSeconds, setAutoHideSeconds] = useState(30)
  const lastTaskStatusRef = useRef<Record<string, TaskStatus>>({})

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

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToastLeaving(true), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  // 读取应用配置：任务完成提示自动消失时长（默认 30 秒）
  useEffect(() => {
    api<{ config: { autoHideSeconds: number } }>('/api/app-config')
      .then((data) => setAutoHideSeconds(data.config.autoHideSeconds))
      .catch(() => undefined)
  }, [])

  // 全局任务轮询（挂载一次，3s）：检测 running/queued → succeeded/failed 跳变，弹出居中完成提示
  useEffect(() => {
    let timer: number
    const poll = async () => {
      try {
        const tasks = await api<CowriteTask[]>('/api/tasks')
        const newStatuses: Record<string, TaskStatus> = {}
        let latest: CowriteTask | null = null
        for (const task of tasks) {
          newStatuses[task.id] = task.status
          const prev = lastTaskStatusRef.current[task.id]
          if ((prev === 'running' || prev === 'queued') && (task.status === 'succeeded' || task.status === 'failed')) {
            // 同一轮回合多个任务完成时，取更新时间最晚（最新完成）的一条
            if (!latest || new Date(task.updatedAt) > new Date(latest.updatedAt)) latest = task
          }
        }
        lastTaskStatusRef.current = newStatuses
        if (latest) {
          setCompletionLeaving(false)
          setCompletion(latest.status === 'succeeded' ? { kind: 'success', text: '任务已完成' } : { kind: 'fail', text: '任务失败' })
        }
      } catch { /* 忽略网络抖动 */ }
    }
    poll()
    timer = setInterval(poll, 3000)
    return () => clearInterval(timer)
  }, [])

  // 任务完成弹屏到达 autoHideSeconds 后自动退场
  useEffect(() => {
    if (!completion) return
    const timer = setTimeout(() => setCompletionLeaving(true), autoHideSeconds * 1000)
    return () => clearTimeout(timer)
  }, [completion, autoHideSeconds])

  // 兜底：退场后 300ms 强制卸载（防止 WebView/节流下 animationend 不触发导致残留）
  useEffect(() => {
    if (!completionLeaving || !completion) return
    const timer = setTimeout(() => { setCompletion(null); setCompletionLeaving(false) }, 300)
    return () => clearTimeout(timer)
  }, [completionLeaving, completion])

  const notify = useCallback((text: string) => { setToastLeaving(false); setToast(text) }, [])
  const onSaved = useCallback((updated: Page) => {
    setSaveState('saved')
    setActivePage((current) => current?.id === updated.id ? { ...current, ...updated } : current)
    setPages((current) => current?.map((item) => item.id === updated.id ? { ...item, title: updated.title, revision: updated.revision, updatedAt: updated.updatedAt } : item) ?? null)
  }, [])
  const onDirty = useCallback(() => setSaveState('dirty'), [])

  // 切换页面会卸载编辑器，若当前页有未保存修改需先确认
  const openPageGuarded = useCallback((pageId: string) => {
    if (saveState === 'dirty' && !window.confirm('当前页面有未保存的修改，切换后将丢失，确定继续吗？')) return
    setWorkspaceView('page')
    setActiveId(pageId)
    setSidebarOpen(false)
  }, [saveState])

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
        <span className="sidebar-tool-icon home-tool-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.8C6.6 3 4.8 3 3 3.8v8.6c1.8-.7 3.6-.7 5 0Z"/><path d="M8 3.8c1.4-.8 3.2-.8 5 0v8.6c-1.8-.7-3.6-.7-5 0Z"/><path d="M3 6.5c1.8-.6 3.6-.6 5 0M8 6.5c1.4-.6 3.2-.6 5 0M3 9c1.8-.6 3.6-.6 5 0M8 9c1.4-.6 3.2-.6 5 0"/></svg></span>
        <span className="sidebar-tool-label">首页</span>
      </button>
      <button
        className={`sidebar-tool ${workspaceView === 'project' ? 'active' : ''}`}
        aria-current={workspaceView === 'project' ? 'page' : undefined}
        onClick={() => { setWorkspaceView('project'); setSidebarOpen(false) }}
      >
        <span className="sidebar-tool-icon project-tool-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5v7a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H8.5l-1.3-1.6a1 1 0 0 0-.8-.4H3.5a1 1 0 0 0-1 1Z"/></svg></span>
        <span className="sidebar-tool-label">项目</span>
      </button>
      <button
        className={`sidebar-tool ${workspaceView === 'skill-manager' ? 'active' : ''}`}
        aria-current={workspaceView === 'skill-manager' ? 'page' : undefined}
        onClick={() => setWorkspaceView('skill-manager')}
      >
        <span className="sidebar-tool-icon skill-tool-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 11.5 10.2 6.8M7.2 3 13 8.3l-2 1.6L5.2 4.6Z"/></svg></span>
        <span className="sidebar-tool-label">Skill 管理</span>
      </button>
      <button
        className={`sidebar-tool ${workspaceView === 'action-config' ? 'active' : ''}`}
        aria-current={workspaceView === 'action-config' ? 'page' : undefined}
        onClick={() => { setWorkspaceView('action-config'); setSidebarOpen(false) }}
      >
        <span className="sidebar-tool-icon action-tool-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.4"/><path d="M8 2.2v2M8 11.8v2M13.8 8h-2M4.2 8h-2M12 4l-1.4 1.4M5.4 10.6 4 12M12 12l-1.4-1.4M5.4 5.4 4 4"/></svg></span>
        <span className="sidebar-tool-label">动作配置</span>
      </button>
      <button
        className={`sidebar-tool ${workspaceView === 'tasks' ? 'active' : ''}`}
        aria-current={workspaceView === 'tasks' ? 'page' : undefined}
        onClick={() => setWorkspaceView('tasks')}
      >
        <span className="sidebar-tool-icon task-tool-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h10M3 8h10M3 11h10"/></svg></span>
        <span className="sidebar-tool-label">任务中心</span>
      </button>
      <button className="new-page" onClick={() => { setWorkspaceView('page'); setNewPageMode('write'); setModalOpen(true) }}>＋ 新建页面</button>
      <nav>
        {pages.map((page) => <div key={page.id} className={`sidebar-page ${workspaceView === 'page' && page.id === activeId ? 'active' : ''}`}>
          <button className="sidebar-page-select" onClick={() => openPageGuarded(page.id)}>
            <span className="doc-icon">▤</span>
            <span className="doc-title">{page.title}</span>
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
        onOpenPage={(pageId) => openPageGuarded(pageId)}
        onNewPage={() => { setWorkspaceView('page'); setNewPageMode('write'); setModalOpen(true) }}
        onImportPage={() => { setWorkspaceView('page'); setNewPageMode('import'); setModalOpen(true) }}
        onOpenProject={() => { setWorkspaceView('project'); setSidebarOpen(false) }}
        onOpenTasks={() => { setWorkspaceView('tasks'); setSidebarOpen(false) }}
        onOpenSkills={() => { setWorkspaceView('skill-manager'); setSidebarOpen(false) }}
        notify={notify}
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
            <span className={`save-state ${saveState}`}>{saveState === 'saved' ? '已保存' : '未保存'}</span>
          </>}
        </div>
        {activePage && <EditorCommandBar page={activePage} notify={notify} imageStyleLabel={imageStyleLabel} />}
        {activePage && activePage.title.startsWith('选题·') && <TopicConfirmPanel page={activePage} notify={notify} />}
        {activePage
          ? <Editor key={activePage.id} page={activePage} onDirty={onDirty} onSaved={onSaved} notify={notify} imageStyles={imageStyles} imageStyle={imageStyle} onImageStyleChange={setImageStyle} />
          : <div className="empty-state"><p>没有页面。</p><button className="primary" onClick={() => setModalOpen(true)}>＋ 新建页面</button></div>}
      </div>

      <MobileTabBar view={workspaceView} onNavigate={(view) => {
        if (view === 'page') {
          // 编辑 tab：有活动页直接打开，否则先保证有页面可编辑
          if (activeId) { setWorkspaceView('page'); return }
          setNewPageMode('write'); setModalOpen(true)
          return
        }
        setWorkspaceView(view)
        setSidebarOpen(false)
      }} />
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
    {toast && <div className={`toast ${toastLeaving ? 'is-leaving' : ''}`} onAnimationEnd={() => { if (toastLeaving) { setToast(''); setToastLeaving(false) } }}>✓ {toast}</div>}
    {completion && (
      <div
        className={`task-complete ${completion.kind} ${completionLeaving ? 'is-leaving' : ''}`}
        role="status"
        onClick={() => setCompletionLeaving(true)}
        onAnimationEnd={() => { if (completionLeaving) { setCompletion(null); setCompletionLeaving(false) } }}
      >
        <span className="task-complete-icon" aria-hidden="true">{completion.kind === 'success' ? '✓' : '✕'}</span>
        <span className="task-complete-text">{completion.text}</span>
      </div>
    )}
  </div>
}

export default App