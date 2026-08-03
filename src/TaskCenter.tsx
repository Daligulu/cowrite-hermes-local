import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CowriteTask, TaskPriority, TaskStatus } from '../shared/types'
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

const ACTION_LABELS: Record<string, string> = {
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

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: '高',
  normal: '普通',
  low: '低',
}

const FILTERS: Array<{ value: 'all' | TaskStatus; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '执行中' },
  { value: 'succeeded', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
]

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const diff = Math.round((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface WorkerStatus {
  lastRunAt: string | null
  lastResult: string | null
  lastError: string | null
  lastErrorAt: string | null
  lastDurationSec?: number
  lastRetries?: number
}

export function TaskCenter({ notify, sidebarOpen, onOpenSidebar }: { notify: (message: string) => void; sidebarOpen?: boolean; onOpenSidebar?: () => void }) {
  const [tasks, setTasks] = useState<CowriteTask[] | null>(null)
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null)
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pageTitles, setPageTitles] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [taskList, status, pages] = await Promise.all([
        api<CowriteTask[]>('/api/tasks'),
        api<WorkerStatus>('/api/worker/status'),
        api<Array<{ id: string; title: string }>>('/api/pages'),
      ])
      setTasks(taskList)
      setWorkerStatus(status)
      setPageTitles(Object.fromEntries(pages.map((page) => [page.id, page.title])))
    } catch {
      // Keep last known state; the page-level panel shows connection errors.
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => undefined)
    const timer = setInterval(() => refresh().catch(() => undefined), 4000)
    return () => clearInterval(timer)
  }, [refresh])

  const runAction = async (path: string, successMessage: string) => {
    setBusy(path)
    try {
      await api(`/api/tasks/${path}`, { method: 'POST' })
      notify(successMessage)
      await refresh()
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(null)
    }
  }

  const setPriority = async (taskId: string, priority: TaskPriority) => {
    setBusy(`priority-${taskId}`)
    try {
      await api(`/api/tasks/${taskId}/priority`, { method: 'POST', body: JSON.stringify({ priority }) })
      notify(`已设为${PRIORITY_LABELS[priority]}优先级`)
      await refresh()
    } catch (error) {
      notify(error instanceof Error ? error.message : '设置优先级失败')
    } finally {
      setBusy(null)
    }
  }

  const filtered = useMemo(() => {
    if (!tasks) return null
    return filter === 'all' ? tasks : tasks.filter((task) => task.status === filter)
  }, [tasks, filter])

  const showWorkerAlert = workerStatus?.lastResult === 'error' && workerStatus.lastErrorAt

  if (!tasks) return <div className="loading"><span>C</span><p>正在加载任务中心…</p></div>

  return (
    <div className="task-center" aria-label="任务中心">
      <div className="task-center-head">
        {!sidebarOpen && <button className="icon-button" title="打开目录" onClick={() => onOpenSidebar?.()}>☰</button>}
        <h2>任务中心</h2>
        <button className="icon-button" title="刷新" onClick={() => refresh().catch(() => undefined)}>↻</button>
      </div>

      {showWorkerAlert && (
        <div className="worker-alert">
          <b>后台执行器最近异常</b>
          <p>{workerStatus?.lastError}</p>
          <small>发生于 {workerStatus?.lastErrorAt ? formatTime(workerStatus.lastErrorAt) : '未知时间'} · 任务会保留在队列中，可在下方重试或调整优先级</small>
        </div>
      )}
      {workerStatus?.lastResult === 'ok' && (
        <div className="worker-ok">后台执行器运行正常 · 最近运行 {workerStatus.lastDurationSec ? `${workerStatus.lastDurationSec}s` : ''}{workerStatus.lastRetries ? ` · 重试 ${workerStatus.lastRetries} 次` : ''}</div>
      )}

      <div className="task-filters" role="tablist" aria-label="任务状态筛选">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            role="tab"
            aria-selected={filter === item.value}
            className={filter === item.value ? 'active' : ''}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
            {tasks && <em>{item.value === 'all' ? tasks.length : tasks.filter((task) => task.status === item.value).length}</em>}
          </button>
        ))}
      </div>

      {filtered && filtered.length === 0 ? (
        <div className="task-empty"><p>没有{filter === 'all' ? '' : STATUS_LABELS[filter]}任务。</p></div>
      ) : (
        <ul className="task-list">
          {(filtered ?? []).map((task) => {
            const isOpen = expanded === task.id
            return (
              <li key={task.id} className={`task-item task-item-${task.status}`}>
                <button className="task-item-main" onClick={() => setExpanded(isOpen ? null : task.id)} aria-expanded={isOpen}>
                  <span className="task-status-dot" />
                  <span className="task-title">
                    <b>{ACTION_LABELS[task.action] || task.action}</b>
                    <small>{pageTitles[task.pageId || ''] ? `页面：${pageTitles[task.pageId || '']}` : task.pageId ? `页面：${task.pageId}` : task.projectPath ? `项目：${task.projectPath}` : '无关联页面'}</small>
                  </span>
                  <span className={`task-badge task-badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
                  {task.priority && task.priority !== 'normal' && <span className={`task-priority task-priority-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>}
                  <span className="task-time">{formatTime(task.updatedAt)}</span>
                  <span className="task-chevron">{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="task-detail">
                    {task.requirements && <p><b>要求：</b>{task.requirements}</p>}
                    {task.result?.message && <p className="task-result"><b>结果：</b>{task.result.message}</p>}
                    {task.error && <p className="task-error"><b>错误：</b>{task.error}</p>}
                    {task.result?.assets && task.result.assets.length > 0 && (
                      <div className="task-assets"><b>产物：</b>
                        {task.result.assets.map((asset) => <a key={asset} href={asset} target="_blank" rel="noreferrer">{asset.split('/').pop()}</a>)}
                      </div>
                    )}
                    {task.recommendedSkills.length > 0 && <p><b>推荐 Skill：</b>{task.recommendedSkills.join('、')}</p>}
                    {task.workerId && <p><b>Worker：</b>{task.workerId}</p>}
                    {task.attempts !== undefined && task.attempts > 0 && <p><b>尝试次数：</b>{task.attempts}</p>}
                    <p className="task-meta"><b>创建：</b>{formatTime(task.createdAt)} · <b>ID：</b>{task.id}</p>

                    <div className="task-actions">
                      {task.status === 'queued' && (
                        <>
                          <button onClick={() => runAction(`${task.id}/move-to-front`, '已移到队首')}>移到队首</button>
                          <button onClick={() => runAction(`${task.id}/cancel`, '任务已取消')}>取消</button>
                          <select value={task.priority || 'normal'} disabled={busy === `priority-${task.id}`} onChange={(event) => setPriority(task.id, event.target.value as TaskPriority)} aria-label="优先级">
                            <option value="high">优先级：高</option>
                            <option value="normal">优先级：普通</option>
                            <option value="low">优先级：低</option>
                          </select>
                        </>
                      )}
                      {task.status === 'running' && (
                        <button onClick={() => runAction(`${task.id}/cancel`, '已请求取消，Worker 将停止并保留已有结果')}>取消</button>
                      )}
                      {(task.status === 'failed' || task.status === 'cancelled') && (
                        <button onClick={() => runAction(`${task.id}/retry`, '已重新入队')}>重新执行</button>
                      )}
                      <button onClick={() => setExpanded(null)}>收起</button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
