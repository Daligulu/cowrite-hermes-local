import { useCallback, useEffect, useRef, useState } from 'react'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import type { CowriteTask, Page, TaskAction } from '../shared/types'
import { cowriteFetch } from './apiClient'
import { SkillManager } from './SkillManager'
import { ProjectWorkspace } from './ProjectWorkspace'
import { TaskCenter } from './TaskCenter'
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

const HERMES_ACTIONS: Array<{ value: TaskAction; label: string }> = [
  { value: 'polish', label: '润色文章' },
  { value: 'illustrate', label: '文章配图' },
  { value: 'feng-ip', label: '峰峰 IP 配图' },
  { value: 'slides', label: '制作 PPT' },
  { value: 'wechat-layout', label: '公众号排版' },
  { value: 'xiaohongshu', label: '小红书图组' },
  { value: 'feishu-doc', label: '发布飞书文档' },
  { value: 'knowledge-base', label: '存入峰峰知识库' },
  { value: 'video', label: '制作视频' },
]

function HermesTaskPanel({ page, notify }: { page: Page; notify: (message: string) => void }) {
  const [action, setAction] = useState<TaskAction>('polish')
  const [requirements, setRequirements] = useState('')
  const [tasks, setTasks] = useState<CowriteTask[]>([])
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    const all = await api<CowriteTask[]>('/api/tasks')
    setTasks(all.filter((task) => task.pageId === page.id).slice(0, 5))
  }, [page.id])

  useEffect(() => {
    refresh().catch(() => undefined)
    const timer = setInterval(() => refresh().catch(() => undefined), 3000)
    return () => clearInterval(timer)
  }, [refresh])

  const submit = async () => {
    setSubmitting(true)
    try {
      const created = await api<CowriteTask>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action, pageId: page.id, requirements: requirements.trim() || undefined, delivery: 'cowrite' }),
      })
      setTasks((current) => [created, ...current].slice(0, 5))
      setRequirements('')
      notify(`Hermes 任务已入队：${created.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="hermes-task-panel" aria-label="Hermes 内容生产">
    <div className="hermes-task-controls">
      <b><span className="mcp-dot" /> Hermes 内容生产</b>
      <select value={action} onChange={(event) => setAction(event.target.value as TaskAction)}>
        {HERMES_ACTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <input value={requirements} placeholder="补充要求（可选）" onChange={(event) => setRequirements(event.target.value)} />
      <button className="primary" disabled={submitting} onClick={submit}>{submitting ? '提交中…' : '交给 Hermes'}</button>
    </div>
    {tasks.length > 0 && <div className="hermes-task-list">
      {tasks.map((task) => <span key={task.id} className={`task-${task.status}`} title={task.result?.message || task.error || task.id}>
        {HERMES_ACTIONS.find((option) => option.value === task.action)?.label || task.action} · {{ queued: '排队中', running: '执行中', succeeded: '已完成', failed: '失败', cancelled: '已取消' }[task.status]}
      </span>)}
    </div>}
  </section>
}

function NewPageModal({ onClose, onCreated, notify }: {
  onClose: () => void
  onCreated: (page: Page) => void
  notify: (text: string) => void
}) {
  const [mode, setMode] = useState<'write' | 'import'>('write')
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

function LayoutModal({ onClose, onChoose }: {
  onClose: () => void
  onChoose: (format: 'wechat' | 'xhs') => void
}) {
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal slide-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <h2>选择排版</h2>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      <div className="slide-options">
        <button className="slide-option" onClick={() => onChoose('wechat')}>
          <b>公众号排版</b><small>可复制富 HTML</small>
        </button>
        <button className="slide-option" onClick={() => onChoose('xhs')}>
          <b>小红书排版</b><small>ApiYi 生图</small>
        </button>
      </div>
      <p className="slide-footnote">选择后由 Hermes 弹窗确认，再发送任务。</p>
    </div>
  </div>
}

function ArticleIllustrationModal({ page, onClose, onConfirm }: {
  page: Page
  onClose: () => void
  onConfirm: () => void
}) {
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal illustration-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <h2>整篇配图</h2>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      <div className="illustration-page"><span>当前页面</span><b>{page.title}</b></div>
      <div className="illustration-specs">
        <div><span>规划</span><b>自动选择 2-6 处</b></div>
        <div><span>模型</span><b>Hermes · ApiYi</b></div>
        <div><span>画幅</span><b>16:9 · 高清</b></div>
        <div><span>风格</span><b>全文统一匹配</b></div>
      </div>
      <p className="slide-footnote">Agent 会按文章结构生成配图，并分别插入对应段落，不改动正文。</p>
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary" onClick={onConfirm}>发送配图任务</button>
      </div>
    </div>
  </div>
}

function CowriteModal({ page, onClose, onUsePage, onSubmit }: {
  page: Page
  onClose: () => void
  onUsePage: () => void
  onSubmit: (requirement: string) => void
}) {
  const [mode, setMode] = useState<'choose' | 'page'>('choose')
  const [requirement, setRequirement] = useState('')
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal cowrite-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <h2>Cowrite</h2>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      {mode === 'choose' ? <>
        <div className="cowrite-options">
          <button className="cowrite-mode" onClick={onUsePage}>
            <b>按页面内容为要求创作</b>
            <small>直接复制当前页面全文</small>
          </button>
          <button className="cowrite-mode" onClick={() => setMode('page')}>
            <b>输入自定义创作要求</b>
            <small>填写你的具体创作任务</small>
          </button>
        </div>
        <p className="slide-footnote">二选一，任务会交给 Hermes 确认后发送。</p>
      </> : <>
        <div className="cowrite-current-page">
          <span>当前页面</span>
          <b>{page.title}</b>
        </div>
        <textarea autoFocus value={requirement} placeholder="请输入创作要求" onChange={(event) => setRequirement(event.target.value)} />
        <div className="modal-actions cowrite-actions">
          <button onClick={() => setMode('choose')}>返回</button>
          <span />
          <button onClick={onClose}>取消</button>
          <button className="primary" disabled={!requirement.trim()} onClick={() => onSubmit(requirement.trim())}>发送到 Hermes</button>
        </div>
      </>}
    </div>
  </div>
}

function SlideModal({ onClose, onChoose }: {
  onClose: () => void
  onChoose: (format: 'pptx' | 'html') => void
}) {
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal slide-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <h2>生成 Slides</h2>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      <div className="slide-options">
        <button className="slide-option" onClick={() => onChoose('pptx')}>
          <b>PPTX</b><small>可编辑文件 + 浏览器预览</small>
        </button>
        <button className="slide-option" onClick={() => onChoose('html')}>
          <b>HTML</b><small>网页幻灯片</small>
        </button>
      </div>
      <p className="slide-footnote">选择格式后由 Hermes 弹窗确认，完成后自动回写链接。</p>
    </div>
  </div>
}

function SendModal({ page, onClose, onSendLark }: {
  page: Page
  onClose: () => void
  onSendLark: () => void
}) {
  const [target, setTarget] = useState<'choose' | 'lark'>('choose')
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal send-modal" onClick={(event) => event.stopPropagation()}>
      <div className="slide-modal-head">
        <h2>发送</h2>
        <button className="modal-close" title="关闭" onClick={onClose}>×</button>
      </div>
      {target === 'choose' ? <>
        <div className="send-options">
          <button className="slide-option" onClick={() => setTarget('lark')}>
            <b>飞书</b><small>通过 lark-cli 创建云文档</small>
          </button>
          <button className="slide-option pending" disabled>
            <b>公众号 <em>待完善</em></b><small>暂未开放</small>
          </button>
          <button className="slide-option pending" disabled>
            <b>知乎 <em>待完善</em></b><small>暂未开放</small>
          </button>
        </div>
        <p className="slide-footnote">选择要发送的社交媒体。</p>
      </> : <>
        <div className="send-confirm">
          <b>发送到飞书？</b>
          <p>将当前页面“{page.title}”作为一篇新的飞书云文档推送。</p>
        </div>
        <div className="modal-actions cowrite-actions">
          <button onClick={() => setTarget('choose')}>返回</button>
          <span />
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={onSendLark}>发送任务到 Hermes</button>
        </div>
      </>}
    </div>
  </div>
}

function DeletePageModal({ page, onClose, onConfirm }: {
  page: PageMeta
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
      <div className="modal-actions">
        <button disabled={deleting} onClick={onClose}>取消</button>
        <button className="delete-confirm" disabled={deleting} onClick={confirm}>{deleting ? '删除中…' : '确定删除'}</button>
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
    const editor = new Vditor(holder, {
      mode: 'ir',
      value: page.content,
      placeholder: '开始写作，或把口令粘贴给 Hermes 让它来写……',
      cache: { enable: false },
      toolbar: [],
      counter: { enable: false },
      after: () => { if (disposed) editor.destroy() },
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
          vditorRef.current?.setValue(latest.content)
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
  const [workspaceView, setWorkspaceView] = useState<'page' | 'project' | 'skill-manager' | 'tasks'>('page')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [cowriteOpen, setCowriteOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [illustrationOpen, setIllustrationOpen] = useState(false)
  const [slideOpen, setSlideOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PageMeta | null>(null)
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
    await api(`/api/pages/${page.id}`, { method: 'DELETE' })
    const list = await refreshList()
    if (activeId === page.id) setActiveId(list[0]?.id ?? null)
    setDeleteTarget(null)
    notify('页面已删除')
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

  const sendPageCreationCommand = async (requirement: string) => {
    const sent = await enqueuePageTask('polish', requirement)
    if (sent) setCowriteOpen(false)
  }

  const sendCurrentPageCreationCommand = async () => {
    await sendPageCreationCommand('以当前页面全文作为创作要求，围绕其中的主题、信息和结构进行创作。')
  }

  const sendSlideCommand = async (format: 'pptx' | 'html') => {
    const sent = await enqueuePageTask('slides', `输出格式：${format}`)
    if (sent) setSlideOpen(false)
  }

  const sendWechatLayoutCommand = async () => {
    const sent = await enqueuePageTask('wechat-layout')
    if (sent) setLayoutOpen(false)
  }

  const sendLayoutCommand = async (format: 'wechat' | 'xhs') => {
    if (format === 'wechat') return sendWechatLayoutCommand()
    const sent = await enqueuePageTask('xiaohongshu')
    if (sent) setLayoutOpen(false)
  }

  const sendArticleIllustrationCommand = async () => {
    const sent = await enqueuePageTask('illustrate')
    if (sent) setIllustrationOpen(false)
  }

  const sendLarkCommand = async () => {
    const sent = await enqueuePageTask('feishu-doc')
    if (sent) setSendOpen(false)
  }

  if (!pages) return <div className="loading"><span>C</span><p>正在打开 Cowrite…</p></div>

  return <div className={`shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="logo">C</span><b>Cowrite</b>
        <button title="收起目录" onClick={() => setSidebarOpen(false)}>«</button>
      </div>
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
        className={`sidebar-tool ${workspaceView === 'tasks' ? 'active' : ''}`}
        aria-current={workspaceView === 'tasks' ? 'page' : undefined}
        onClick={() => setWorkspaceView('tasks')}
      >
        <span className="task-tool-icon" aria-hidden="true">☰</span>
        任务中心
      </button>
      <button className="new-page" onClick={() => { setWorkspaceView('page'); setModalOpen(true) }}>＋ 新建页面</button>
      <nav>
        {pages.map((page) => <div key={page.id} className={`sidebar-page ${workspaceView === 'page' && page.id === activeId ? 'active' : ''}`}>
          <button className="sidebar-page-select" onClick={() => { setWorkspaceView('page'); setActiveId(page.id) }}>
            <span className="doc-icon">▤</span>
            <span className="doc-title">{page.title}</span>
            {page.prompt && page.revision === 1 && <span className="pending-dot" title="等待 Agent 创作" />}
          </button>
          <button className="sidebar-delete" title={`删除 ${page.title}`} aria-label={`删除 ${page.title}`} onClick={() => setDeleteTarget(page)}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 6.5v8m3.5-8v8m3.5-8v8M4 4.5h12M7 4.5V2.8h6v1.7m-7.5 0 .7 12.7h7.6l.7-12.7" /></svg>
          </button>
        </div>)}
      </nav>
      <footer><span className="mcp-dot" />Cowrite MCP · 本地</footer>
    </aside>

    <main className="workspace">
      {workspaceView === 'skill-manager' && <SkillManager
        sidebarOpen={sidebarOpen}
        onOpenSidebar={() => setSidebarOpen(true)}
      />}
      {workspaceView === 'tasks' && <TaskCenter notify={notify} />}
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
            <div className="topbar-right">
              <span className={`save-state ${saveState}`}>{saveState === 'saved' ? '已保存' : '保存中…'}</span>
              <button onClick={() => setIllustrationOpen(true)} title="使用 Hermes 内置模型为整篇文章配图">配图</button>
              <button onClick={() => setLayoutOpen(true)} title="把当前 Page 排版为公众号或小红书内容">排版</button>
              <button onClick={() => setSlideOpen(true)} title="把当前 Page 转换为 PPT 或 HTML">Slide</button>
              <button onClick={() => setCowriteOpen(true)} title="根据当前 Page 内容继续创作">Cowrite</button>
              <button onClick={() => setSendOpen(true)} title="把当前 Page 发送到社交媒体">发送</button>
            </div>
          </>}
        </div>
        {activePage && <HermesTaskPanel page={activePage} notify={notify} />}
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
      onClose={() => setModalOpen(false)}
      onCreated={async (page) => { setModalOpen(false); setWorkspaceView('page'); await refreshList(); setActiveId(page.id) }}
      notify={notify}
    />}
    {slideOpen && activePage && <SlideModal
      onClose={() => setSlideOpen(false)}
      onChoose={sendSlideCommand}
    />}
    {layoutOpen && activePage && <LayoutModal
      onClose={() => setLayoutOpen(false)}
      onChoose={sendLayoutCommand}
    />}
    {illustrationOpen && activePage && <ArticleIllustrationModal
      page={activePage}
      onClose={() => setIllustrationOpen(false)}
      onConfirm={sendArticleIllustrationCommand}
    />}
    {cowriteOpen && activePage && <CowriteModal
      page={activePage}
      onClose={() => setCowriteOpen(false)}
      onUsePage={sendCurrentPageCreationCommand}
      onSubmit={sendPageCreationCommand}
    />}
    {sendOpen && activePage && <SendModal
      page={activePage}
      onClose={() => setSendOpen(false)}
      onSendLark={sendLarkCommand}
    />}
    {deleteTarget && <DeletePageModal
      page={deleteTarget}
      onClose={() => setDeleteTarget(null)}
      onConfirm={() => removePage(deleteTarget)}
    />}
    {toast && <div className="toast">✓ {toast}</div>}
  </div>
}

export default App
