import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CowriteTask, Page, TaskStatus } from '../shared/types'
import { cowriteFetch } from './apiClient'
import { ACTION_LABELS } from './CommandBar'

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

export function HomeWorkspace({
  onOpenPage,
  onNewPage,
  onImportPage,
  onOpenProject,
  onOpenTasks,
}: {
  onOpenPage: (pageId: string) => void
  onNewPage: () => void
  onImportPage: () => void
  onOpenProject: () => void
  onOpenTasks: () => void
}) {
  const [pages, setPages] = useState<Page[] | null>(null)
  const [tasks, setTasks] = useState<CowriteTask[] | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [pageList, taskList] = await Promise.all([
        api<Page[]>('/api/pages'),
        api<CowriteTask[]>('/api/tasks'),
      ])
      setPages(pageList)
      setTasks(taskList)
    } catch {
      // Keep last known state.
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => undefined)
    const timer = setInterval(() => refresh().catch(() => undefined), 5000)
    return () => clearInterval(timer)
  }, [refresh])

  const recentPages = useMemo(() => {
    if (!pages) return []
    return [...pages].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5)
  }, [pages])

  const recentTasks = useMemo(() => {
    if (!tasks) return []
    return [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
  }, [tasks])

  const queuedCount = tasks?.filter((t) => t.status === 'queued' || t.status === 'running').length ?? 0

  if (!pages || !tasks) return <div className="loading"><span>C</span><p>正在打开工作台…</p></div>

  return (
    <div className="home-workspace" aria-label="工作台">
      <header className="home-head">
        <div className="home-head-text">
          <h1>Cowrite 工作台</h1>
          <p>把想法交给 Hermes，把内容留在本地。</p>
        </div>
        {queuedCount > 0 && (
          <button className="home-queue-chip" onClick={onOpenTasks}>
            <span className="home-queue-dot" /> {queuedCount} 个任务处理中
          </button>
        )}
      </header>

      <section className="home-start" aria-label="快捷开始">
        <button className="home-card home-card-primary" onClick={onNewPage}>
          <span className="home-card-icon">✍️</span>
          <span><b>从想法创作</b><small>输入标题和要求，Hermes 帮你写初稿</small></span>
        </button>
        <button className="home-card" onClick={onImportPage}>
          <span className="home-card-icon">📥</span>
          <span><b>导入文章</b><small>把已有 Markdown 带进工作台</small></span>
        </button>
        <button className="home-card" onClick={onOpenProject}>
          <span className="home-card-icon">🗂</span>
          <span><b>打开项目</b><small>连接本地文件夹批量编辑</small></span>
        </button>
      </section>

      <section className="home-section" aria-label="最近页面">
        <div className="home-section-head">
          <h2>最近页面</h2>
          {pages.length > 0 && <button className="home-link" onClick={onOpenProject}>全部 →</button>}
        </div>
        {recentPages.length === 0 ? (
          <div className="home-empty">
            <p>还没有页面。</p>
            <button className="primary" onClick={onNewPage}>＋ 创建第一个页面</button>
          </div>
        ) : (
          <ul className="home-list">
            {recentPages.map((page) => (
              <li key={page.id}>
                <button className="home-row" onClick={() => onOpenPage(page.id)}>
                  <span className="doc-icon">▤</span>
                  <span className="home-row-title">
                    <b>{page.title || '未命名页面'}</b>
                    <small>{formatTime(page.updatedAt)} · 更新于 {new Date(page.updatedAt).toLocaleDateString('zh-CN')}</small>
                  </span>
                  <span className="home-chevron">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="home-section" aria-label="最近任务">
        <div className="home-section-head">
          <h2>最近任务</h2>
          <button className="home-link" onClick={onOpenTasks}>任务中心 →</button>
        </div>
        {recentTasks.length === 0 ? (
          <div className="home-empty"><p>还没有任务。打开一个页面，在底部告诉 Hermes 你想做什么。</p></div>
        ) : (
          <ul className="home-list">
            {recentTasks.map((task) => (
              <li key={task.id}>
                <button className="home-row" onClick={onOpenTasks}>
                  <span className={`home-task-dot home-task-dot-${task.status}`} />
                  <span className="home-row-title">
                    <b>{ACTION_LABELS[task.action] ?? task.action}</b>
                    <small>{STATUS_LABELS[task.status]} · {formatTime(task.createdAt)}</small>
                  </span>
                  <span className="home-chevron">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
