import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionConfig, CowriteTask, Page, TaskStatus, TaskPriority } from '../shared/types'
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

const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: '排队中',
  running: '执行中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

function safeRegex(source: string): RegExp | null {
  try {
    return new RegExp(source, 'i')
  } catch {
    return null
  }
}

function detectAction(text: string, actions: ActionConfig[]): { action: string; requirements?: string } {
  for (const action of actions) {
    if (!action.enabled) continue
    for (const keyword of action.keywords) {
      const re = safeRegex(keyword)
      if (re && re.test(text)) return { action: action.id }
    }
  }
  return { action: actions.find((action) => action.id === 'polish')?.id ?? 'polish', requirements: text.trim() || undefined }
}

export function EditorCommandBar({ page, notify }: { page: Page; notify: (message: string) => void }) {
  const [text, setText] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tasks, setTasks] = useState<CowriteTask[]>([])
  const [expanded, setExpanded] = useState(false)
  const [actions, setActions] = useState<ActionConfig[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const all = await api<CowriteTask[]>('/api/tasks')
    setTasks(all.filter((task) => task.pageId === page.id).slice(0, 5))
  }, [page.id])

  useEffect(() => {
    api<{ config: { actions: ActionConfig[] } }>('/api/action-config')
      .then((data) => setActions(data.config.actions))
      .catch(() => undefined)
    refresh().catch(() => undefined)
    const timer = setInterval(() => refresh().catch(() => undefined), 3000)
    return () => clearInterval(timer)
  }, [refresh])

  const labelFor = (id: string) => actions.find((action) => action.id === id)?.label ?? id

  const latest = tasks[0]

  const submit = async (action?: string, requirements?: string) => {
    const trimmed = text.trim()
    if (!trimmed && !action) return
    const detected = detectAction(trimmed, actions)
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
      notify(`已提交：${labelFor(chosen)}`)
      inputRef.current?.focus()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Hermes 任务提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const chip = (value: string) => {
    setText(labelFor(value))
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
  const chipActions = actions.filter((action) => action.enabled && action.chip)
  const moreActions = actions.filter((action) => action.enabled && !action.chip)

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
          {chipActions.map((option) => (
            <button key={option.id} disabled={submitting} onClick={() => chip(option.id)}>
              {option.label}
            </button>
          ))}
          <button className="more-chip" onClick={() => setMoreOpen((open) => !open)}>更多 ▾</button>
        </div>
        {moreOpen && (
          <div className="command-more">
            {moreActions.map((option) => (
              <button key={option.id} disabled={submitting} onClick={() => { setMoreOpen(false); chip(option.id) }}>
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
            <span className="task-strip-label">{labelFor(latest.action)}</span>
            <span className={`task-strip-state state-${latest.status}`}>{statusLabel(latest.status)}</span>
            <span className="chev">{expanded ? '▾' : '▸'}</span>
          </div>
          {expanded && (
            <div className="task-strip-detail">
              {latest.requirements && <div className="task-strip-req">{latest.requirements}</div>}
              {latest.result?.message && <div className="task-strip-result">{latest.result.message}</div>}
              {latest.error && <div className="task-strip-error">{latest.error}</div>}
              <div className="task-strip-actions">
                {(latest.status === 'queued' || latest.status === 'running') && (
                  <button onClick={() => actOn(latest.id, '/cancel')}>取消</button>
                )}
                {(latest.status === 'failed' || latest.status === 'cancelled') && (
                  <button onClick={() => actOn(latest.id, '/retry')}>重试</button>
                )}
                {latest.status === 'queued' && (
                  <button onClick={() => actOn(latest.id, '/move-to-front', { priority: 'high' as TaskPriority })}>置顶</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
