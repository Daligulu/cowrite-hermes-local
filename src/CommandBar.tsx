import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionConfig, CowriteTask, Page, TaskStatus, TaskPriority } from '../shared/types'
import { cowriteFetch } from './apiClient'
import { TopicCollectModal } from './TopicCollectModal'

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
  let best: { action: string; length: number } | null = null
  for (const action of actions) {
    if (!action.enabled) continue
    for (const keyword of action.keywords) {
      const re = safeRegex(keyword)
      if (re && re.test(text) && (!best || keyword.length > best.length)) {
        best = { action: action.id, length: keyword.length }
      }
    }
  }
  if (best) return { action: best.action }
  return { action: actions.find((action) => action.id === 'polish')?.id ?? 'polish', requirements: text.trim() || undefined }
}

export function EditorCommandBar({ page, notify }: { page: Page; notify: (message: string) => void }) {
  const [text, setText] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tasks, setTasks] = useState<CowriteTask[]>([])
  const [expanded, setExpanded] = useState(false)
  const [actions, setActions] = useState<ActionConfig[]>([])
  const [pendingChoice, setPendingChoice] = useState<{ action: string; requirements?: string } | null>(null)
  const [pendingStyle, setPendingStyle] = useState('')
  const [pendingCustomStyle, setPendingCustomStyle] = useState('')
  const [accounts, setAccounts] = useState<{ id: string; label: string }[]>([])
  const [pendingAccount, setPendingAccount] = useState('')
  const [topicModalOpen, setTopicModalOpen] = useState(false)
  const [topicModalReq, setTopicModalReq] = useState('')
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

  const openStyleChoice = (action: string, requirements?: string) => {
    setPendingChoice({ action, requirements })
    setPendingStyle('')
    setPendingCustomStyle('')
  }

  const openAccountChoice = async (action: string, requirements?: string) => {
    setPendingChoice({ action, requirements })
    setPendingAccount('')
    try {
      const data = await api<{ accounts: { id: string; label: string }[] }>('/api/wechat-accounts')
      setAccounts(data.accounts)
    } catch {
      setAccounts([])
    }
  }

  const openTopicChoice = (requirements?: string) => {
    setTopicModalReq(requirements ?? '')
    setTopicModalOpen(true)
  }

  const submit = async (action?: string, requirements?: string) => {
    const trimmed = text.trim()
    if (!trimmed && !action) return
    const detected = detectAction(trimmed, actions)
    const chosen = action ?? detected.action
    const req = requirements !== undefined
      ? requirements
      : (action ? (trimmed || undefined) : (detected.requirements ?? (trimmed || undefined)))
    if (chosen === 'wechat-sticker' && !(req ?? '').includes('风格')) {
      openStyleChoice(chosen, req)
      return
    }
    if (chosen === 'publish-sticker' && !(req ?? '').includes('账号')) {
      void openAccountChoice(chosen, req)
      return
    }
    if (chosen === 'topic-collect' && !(req ?? '').includes('渠道')) {
      void openTopicChoice(req)
      return
    }
    await doSubmit(chosen, req)
  }

  const doSubmit = async (chosen: string, requirements?: string) => {
    setSubmitting(true)
    try {
      const created = await api<CowriteTask>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: chosen, pageId: page.id, requirements, delivery: 'cowrite' }),
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

  const confirmStyle = async () => {
    if (!pendingChoice) return
    const style = pendingCustomStyle.trim() || pendingStyle
    const suffix = style ? `风格：${style}` : ''
    const req = [pendingChoice.requirements, suffix].filter(Boolean).join('；')
    const chosen = pendingChoice.action
    setPendingChoice(null)
    await doSubmit(chosen, req || undefined)
  }

  const confirmAccount = async () => {
    if (!pendingChoice) return
    const account = accounts.find((item) => item.id === pendingAccount)?.id ?? pendingAccount
    if (!account) {
      notify('请选择一个公众号账号')
      return
    }
    const suffix = `账号：${account}`
    const req = [pendingChoice.requirements, suffix].filter(Boolean).join('；')
    const chosen = pendingChoice.action
    setPendingChoice(null)
    await doSubmit(chosen, req)
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
  const selectableActions = actions.filter((action) => action.enabled)
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
          <div className="command-selector">
            <button className="selector-toggle" disabled={submitting} onClick={() => setSelectorOpen((open) => !open)}>选择动作 ▾</button>
            {selectorOpen && (
              <div className="selector-list">
                {selectableActions.map((option) => (
                  <button key={option.id} disabled={submitting} onClick={() => { setSelectorOpen(false); chip(option.id) }}>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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

      {pendingChoice?.action === 'wechat-sticker' && (
        <div className="modal-mask" onClick={() => setPendingChoice(null)}>
          <div className="modal sticker-style-modal" onClick={(event) => event.stopPropagation()}>
            <h2>选择贴图风格</h2>
            <p className="modal-hint">为「{text.trim() || '微信贴图'}」选择生成风格，或手动输入描述。</p>
            <div className="sticker-style-options">
              {[
                { id: '新海诚清新', label: '新海诚清新', desc: '清新明亮动漫感，自然光线' },
                { id: '萌系治愈', label: '萌系治愈', desc: '可爱软萌，温暖治愈' },
                { id: '科技简洁', label: '科技简洁', desc: 'AI/科技视觉，简洁高级' },
                { id: '极简扁平', label: '极简扁平', desc: '扁平插画，色块干净' },
                { id: '手绘暖色', label: '手绘暖色', desc: '暖色调手绘质感' },
              ].map((style) => (
                <button
                  key={style.id}
                  className={`sticker-style-option ${pendingStyle === style.id ? 'on' : ''}`}
                  onClick={() => { setPendingStyle(style.id); setPendingCustomStyle('') }}
                >
                  <span className="sticker-style-label">{style.label}</span>
                  <span className="sticker-style-desc">{style.desc}</span>
                </button>
              ))}
            </div>
            <label className="field">
              <span>或手动输入描述</span>
              <input
                value={pendingCustomStyle}
                placeholder="如：宫崎骏风格、插画感、深蓝色调…"
                onChange={(event) => { setPendingCustomStyle(event.target.value); setPendingStyle('') }}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setPendingChoice(null)}>取消</button>
              <button className="primary" onClick={() => void confirmStyle()} disabled={submitting}>确认并提交</button>
            </div>
          </div>
        </div>
      )}

      {pendingChoice?.action === 'publish-sticker' && (
        <div className="modal-mask" onClick={() => setPendingChoice(null)}>
          <div className="modal sticker-account-modal" onClick={(event) => event.stopPropagation()}>
            <h2>选择发布账号</h2>
            <p className="modal-hint">发布到哪个微信公众号的草稿箱？</p>
            <div className="sticker-account-options">
              {accounts.length === 0 && <div className="sticker-account-empty">暂无可用账号，请先到「动作配置」添加公众号账号。</div>}
              {accounts.map((account) => (
                <button
                  key={account.id}
                  className={`sticker-account-option ${pendingAccount === account.id ? 'on' : ''}`}
                  onClick={() => setPendingAccount(account.id)}
                >
                  <span className="sticker-account-label">{account.label}</span>
                  <span className="sticker-account-id">{account.id}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setPendingChoice(null)}>取消</button>
              <button className="primary" onClick={() => void confirmAccount()} disabled={submitting}>确认发布</button>
            </div>
          </div>
        </div>
      )}
      <TopicCollectModal
        open={topicModalOpen}
        initialRequirement={topicModalReq}
        pageId={page.id}
        onClose={() => setTopicModalOpen(false)}
        onSubmitted={() => { setText(''); setExpanded(true); void refresh() }}
        notify={notify}
      />
    </div>
  )
}
