import { useCallback, useEffect, useRef, useState } from 'react'
import type { CowriteTask, Page, TaskAction, TaskPriority, TaskStatus } from '../shared/types'
import { cowriteFetch } from './apiClient'

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await cowriteFetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `请求失败：${response.status}`)
  return result as T
}

export const ACTION_LABELS: Record<string, string> = {
  polish: '润色文章',
  illustrate: '文章配图',
  'feng-ip': '峰峰 IP 配图',
  slides: '制作 PPT',
  'wechat-layout': '公众号排版',
  xiaohongshu: '小红书图组',
  'feishu-doc': '发布飞书文档',
  'knowledge-base': '存入峰峰知识库',
  video: '制作视频',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: '排队中',
  running: '执行中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

const ACTIONS: Array<{ value: TaskAction; label: string; chip?: boolean }> = [
  { value: 'polish', label: '润色文章', chip: true },
  { value: 'illustrate', label: '文章配图', chip: true },
  { value: 'slides', label: '制作 PPT', chip: true },
  { value: 'wechat-layout', label: '公众号排版', chip: true },
  { value: 'feishu-doc', label: '发布飞书文档', chip: true },
  { value: 'feng-ip', label: '峰峰 IP 配图' },
  { value: 'xiaohongshu', label: '小红书图组' },
  { value: 'knowledge-base', label: '存入峰峰知识库' },
  { value: 'video', label: '制作视频' },
]

const ACTION_KEYWORDS: Array<[RegExp, TaskAction]> = [
  [/峰峰.*配图|IP\s*配图|峰峰形象/i, 'feng-ip'],
  [/配图|插图|插画|配\s*\d+\s*张图|生成.*图|图片/i, 'illustrate'],
  [/ppt|幻灯片|演示文稿|slides|做\s*\d+\s*页/i, 'slides'],
  [/排版|公众号|微信文章|草稿箱/i, 'wechat-layout'],
  [/小红书/i, 'xiaohongshu'],
  [/飞书|云文档|发布文档/i, 'feishu-doc'],
  [/知识库|归档|KB/i, 'knowledge-base'],
  [/视频|video/i, 'video'],
  [/润色|改写|优化|修改|口语化|通顺/i, 'polish'],
]

function detectAction(text: string): { action: TaskAction; requirements?: string } {
  for (const [re, action] of ACTION_KEYWORDS) {
    if (re.test(text)) return { action }
  }
  return { action: 'polish', requirements: text.trim() || undefined }
}

export function EditorCommandBar({ page, notify }: { page: Page; notify: (message: string) => void }) {
  const [text, setText] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tasks, setTasks] = useState<CowriteTask[]>([])
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const all = await api<CowriteTask[]>('/api/tasks')
    setTasks(all.filter((task) => task.pageId === page.id).slice(0, 5))
  }, [page.id])

  useEffect(() => {
    refresh().catch(() => undefined)
    const timer = setInterval(() => refresh().catch(() => undefined), 3000)
    return () => clearInterval(timer)
  }, [refresh])

  const latest = tasks[0]

  const submit = async (action?: TaskAction, requirements?: string) => {
    const trimmed = text.trim()
    if (!trimmed && !action) return
    const detected = detectAction(trimmed)
    const chosen = action ?? detected.action
    const req = requirements !== undefined
      ? requirements
      : (action ? (trimmed || undefined) : (detected.requirements ?? (trimmed || undefined)))
    setSubmitting(true)
    try {
      const created = await api<CowriteTask>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: chosen, pageId: page.id, requirements: req, delivery: 'cowrite' }),
      })
      setTasks((current) => [created, ...current.filter((t) => t.id !== created.id)].slice(0, 5))
      setText('')
      setExpanded(true)
      notify(`已提交：${ACTION_LABELS[chosen] ?? chosen}`)
      inputRef.current?.focus()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Hermes 任务提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const chip = (value: TaskAction) => {
    setText(ACTION_LABELS[value] ?? value)
    inputRef.current?.focus()
  }

  const actOn = async (taskId: string, path: string, body?: unknown) => {
    try {
      await api(`/api/tasks/${taskId}${path}`, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      await refresh()
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作失败')
    }
  }

  const statusDot = (status: TaskStatus) => `dot ${status}`
  const statusLabel = (status: TaskStatus) => STATUS_LABELS[status] ?? status

  return (
    <div className="editor-command">
      <div className="command-bar">
        <div className="command-box">
          <input
            ref={inputRef}
            value={text}
            placeholder="告诉 Hermes 你想怎么处理这篇内容…"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') submit() }}
          />
          <button className="primary" disabled={submitting || !text.trim()} onClick={() => submit()} aria-busy={submitting}>
            {submitting ? <span className="btn-spinner" aria-hidden="true" /> : <span className="btn-spark" aria-hidden="true">✦</span>}
            {submitting ? '提交中…' : '交给 Hermes'}
          </button>
        </div>
        <div className="command-chips">
          {ACTIONS.filter((option) => option.chip).map((option) => (
            <button key={option.value} disabled={submitting} onClick={() => chip(option.value)}>
              {option.label}
            </button>
          ))}
          <button className="more-chip" onClick={() => setMoreOpen((open) => !open)}>更多 ▾</button>
        </div>
        {moreOpen && (
          <div className="command-more">
            {ACTIONS.filter((option) => !option.chip).map((option) => (
              <button key={option.value} disabled={submitting} onClick={() => { setMoreOpen(false); chip(option.value) }}>
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {latest && (
        <div className={`task-strip ${expanded ? 'expanded' : ''}`}>
          <div className="task-strip-row" role="button" tabIndex={0} onClick={() => setExpanded((open) => !open)}>
            <span className={statusDot(latest.status)} />
            <span className="task-strip-label">{ACTION_LABELS[latest.action] ?? latest.action}</span>
            <span className={`task-strip-state state-${latest.status}`}>{statusLabel(latest.status)}</span>
            <span className="chev">{expanded ? '▾' : '▸'}</span>
          </div>
          {expanded && (
            <div className="task-strip-detail">
              {latest.requirements && <p className="detail-line">要求：{latest.requirements}</p>}
              {latest.result?.message && <p className="detail-line detail-ok">结果：{latest.result.message}</p>}
              {latest.error && <p className="detail-line detail-err">错误：{latest.error}</p>}
              <div className="task-strip-actions">
                {latest.status === 'queued' && (
                  <button onClick={() => actOn(latest.id, '/move-to-front')}>移到队首</button>
                )}
                {(latest.status === 'queued' || latest.status === 'running') && (
                  <button onClick={() => actOn(latest.id, '/cancel')}>取消</button>
                )}
                {(latest.status === 'failed' || latest.status === 'cancelled') && (
                  <button onClick={() => actOn(latest.id, '/retry')}>重新执行</button>
                )}
                {latest.status === 'queued' && (
                  <select value={latest.priority ?? 'normal'} onChange={(event) => actOn(latest.id, '/priority', { priority: event.target.value as TaskPriority })}>
                    <option value="high">优先级：高</option>
                    <option value="normal">优先级：普通</option>
                    <option value="low">优先级：低</option>
                  </select>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
