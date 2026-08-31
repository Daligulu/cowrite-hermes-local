import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

/** 动作分组：推荐位按 6 大类展示，点分组弹出该组动作下拉 */
const ACTION_GROUPS: { id: string; label: string; actionIds: string[] }[] = [
  { id: 'write', label: '写作加工', actionIds: ['baokuan-title', 'gzh-short-post', 'gzh-longform', 'polish', 'wechat-layout'] },
  { id: 'image', label: '配图', actionIds: ['illustrate', 'feng-ip', 'xiaohongshu', 'space-gzh-cover'] },
  { id: 'dispatch', label: '内容分发', actionIds: ['feishu-doc', 'knowledge-base'] },
  { id: 'media', label: '演示视频', actionIds: ['slides', 'video'] },
  { id: 'gzh', label: '公众号贴图', actionIds: ['wechat-sticker', 'publish-sticker', 'gzh-layout', 'gzh-publish'] },
  { id: 'topic', label: '选题投稿', actionIds: ['topic-collect', 'topic-create', 'toutiao-micro-draft', 'toutiao-article-draft', 'zhihu-article-draft', 'zhihu-idea-draft', 'baokuan-research'] },
]

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

export function EditorCommandBar({ page, notify, imageStyleLabel }: { page: Page; notify: (message: string) => void; imageStyleLabel: string }) {
  const [text, setText] = useState('')
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [selectorPos, setSelectorPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [tasks, setTasks] = useState<CowriteTask[]>([])
  const [expanded, setExpanded] = useState(false)
  const [actions, setActions] = useState<ActionConfig[]>([])
  const [pendingChoice, setPendingChoice] = useState<{ action: string; requirements?: string } | null>(null)
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
    if (chosen === 'publish-sticker' && !(req ?? '').includes('账号')) {
      void openAccountChoice(chosen, req)
      return
    }
    if (chosen === 'wechat-sticker') {
      if (!imageStyleLabel) {
        notify('请先在编辑页「配图」下拉选择配图风格')
        return
      }
      const reqWithStyle = [req, `风格：${imageStyleLabel}`].filter(Boolean).join('；')
      await doSubmit(chosen, reqWithStyle)
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

  const toggleGroup = (groupId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openGroup === groupId) {
      setOpenGroup(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const gap = 6
    // 水平：跟按钮左对齐，超出右边界时右对齐，避免溢出视口
    const menuWidth = Math.min(320, window.innerWidth - 20)
    const left = Math.max(0, Math.min(rect.left, window.innerWidth - menuWidth - 20))
    // 决定性判断：命令栏是否固定底部（移动端 .editor-command 是 position:fixed）；
    // 用按钮位置/空间估算会因下拉实际高度或底部 tabbar 干扰而误判（实测踩过两种边界）。
    const commandBar = document.querySelector('.editor-command')
    const dockedBottom = commandBar ? getComputedStyle(commandBar).position === 'fixed' : false
    if (dockedBottom) {
      // 命令栏固定底部（移动端）：向上展开，避免被底部 tabbar 遮挡
      setSelectorPos({ left, bottom: window.innerHeight - rect.top + gap })
    } else {
      // 命令栏在页面顶部（桌面）：向下展开，避免顶出视口上方
      setSelectorPos({ left, top: rect.bottom + gap })
    }
    setOpenGroup(groupId)
  }

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
          {ACTION_GROUPS.map((group) => (
            <div key={group.id} className="command-selector">
              <button
                className={`selector-toggle ${openGroup === group.id ? 'open' : ''}`}
                disabled={submitting}
                onClick={(event) => toggleGroup(group.id, event)}
              >
                {group.label} ▾
              </button>
              {openGroup === group.id && selectorPos && createPortal(
                <div className="selector-list" style={{ left: selectorPos.left, ...(selectorPos.top !== undefined ? { top: selectorPos.top } : { bottom: selectorPos.bottom }) }}>
                  {group.actionIds.map((id) => {
                    const option = selectableActions.find((action) => action.id === id)
                    if (!option) return null
                    return (
                      <button key={option.id} disabled={submitting} onClick={() => { setOpenGroup(null); chip(option.id) }}>
                        {option.label}
                      </button>
                    )
                  })}
                </div>,
                document.body
              )}
            </div>
          ))}
        </div>
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
