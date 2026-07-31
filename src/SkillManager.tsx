import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { LocalSkill, LocalSkillCatalog, LocalSkillExpert, LocalSkillSource } from '../shared/types'
import {
  buildSkillInvocationPrompt,
  canScanSkillSource,
  createLatestRequestGate,
  filterLocalSkills,
  getSkillInvocationAddress,
  resolveExpertSkills,
  selectInitialSkillSource,
} from './skillManagerModel'
import { cowriteFetch } from './apiClient'
import './SkillManager.css'

const DIRECTORY_KEY = 'cowrite.skill-manager.directory'
const DIRECTORY_HISTORY_KEY = 'cowrite.skill-manager.history'
type SourceId = 'codex' | 'claude' | 'custom'
type DeleteTarget =
  | { kind: 'skill'; skill: LocalSkill; directory: string; sourceId: SourceId }
  | { kind: 'expert'; expert: LocalSkillExpert; skillCount: number; directory: string; sourceId: SourceId }

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await cowriteFetch(url, init)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `请求失败：${response.status}`)
  return result as T
}

function getJson<T>(url: string): Promise<T> {
  return requestJson<T>(url)
}

function getDirectoryHistory(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(DIRECTORY_HISTORY_KEY) || '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

function rememberDirectory(directory: string): string[] {
  const history = [directory, ...getDirectoryHistory().filter((item) => item !== directory)].slice(0, 8)
  try {
    localStorage.setItem(DIRECTORY_KEY, directory)
    localStorage.setItem(DIRECTORY_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // The catalog remains usable when storage is disabled by the browser.
  }
  return history
}

function getRememberedDirectory(): string {
  try {
    return localStorage.getItem(DIRECTORY_KEY) || ''
  } catch {
    return ''
  }
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

function SkillUseModal({ skill, onClose }: { skill: LocalSkill; onClose: () => void }) {
  const [supplementaryContext, setSupplementaryContext] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'address' | 'prompt' | 'error'>('idle')
  const invocationAddress = getSkillInvocationAddress(skill)
  const invocationPrompt = buildSkillInvocationPrompt(skill, supplementaryContext)

  const copy = async (kind: 'address' | 'prompt') => {
    try {
      await copyText(kind === 'address' ? invocationAddress : invocationPrompt)
      setCopyState(kind)
    } catch {
      setCopyState('error')
    }
  }

  return <div className="modal-mask" onClick={onClose}>
    <div className="modal skill-use-modal" role="dialog" aria-modal="true" aria-labelledby="skill-use-title" onClick={(event) => event.stopPropagation()}>
      <div className="skill-detail-head">
        <div>
          <span>{skill.category}</span>
          <h2 id="skill-use-title">使用 {skill.name}</h2>
        </div>
        <button className="modal-close" aria-label="关闭 Skill 使用窗口" onClick={onClose}>×</button>
      </div>
      <p className="skill-use-description">{skill.description}</p>

      <div className="skill-use-field">
        <div className="skill-use-label">
          <label>Skill 调用地址</label>
          <span>Agent 会从本机读取这份 SKILL.md</span>
        </div>
        <div className="skill-use-address">
          <code>{invocationAddress}</code>
          <button onClick={() => void copy('address')}>
            {copyState === 'address' ? '已复制' : '复制地址'}
          </button>
        </div>
      </div>

      <div className="skill-use-field">
        <div className="skill-use-label">
          <label htmlFor="skill-supplementary-context">补充信息 <i>选填</i></label>
          <span>可以写文档地址、参考链接、目标、输出格式或其他上下文</span>
        </div>
        <textarea
          id="skill-supplementary-context"
          maxLength={5_000}
          value={supplementaryContext}
          onChange={(event) => { setSupplementaryContext(event.target.value); setCopyState('idle') }}
          placeholder={'例如：\n文档地址：/Users/me/Documents/brief.md\n请整理为一份适合管理层阅读的中文摘要。'}
        />
      </div>

      <details className="skill-prompt-preview">
        <summary>查看调用口令</summary>
        <pre>{invocationPrompt}</pre>
      </details>

      <div className="skill-copy-status" aria-live="polite">
        {copyState === 'prompt' && '调用口令已复制，可以直接粘贴给 Agent。'}
        {copyState === 'error' && '复制失败，请检查浏览器剪贴板权限后重试。'}
      </div>
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button className="primary" onClick={() => void copy('prompt')}>
          {copyState === 'prompt' ? '已复制调用口令' : '复制调用口令'}
        </button>
      </div>
    </div>
  </div>
}

function ExpertDetail({ expert, skills, onClose }: {
  expert: LocalSkillExpert
  skills: LocalSkill[]
  onClose: () => void
}) {
  const expertSkills = resolveExpertSkills(expert, skills)
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal skill-detail-modal expert-detail-modal" onClick={(event) => event.stopPropagation()}>
      <div className="skill-detail-head">
        <div>
          <span>{expertSkills.length} 个本地 Skill</span>
          <h2>{expert.emoji} {expert.name}</h2>
        </div>
        <button className="modal-close" aria-label="关闭专家详情" onClick={onClose}>×</button>
      </div>
      <p>{expert.description}</p>
      <div className="expert-skill-list">
        {expertSkills.map((skill) => <div key={skill.id}>
          <b>{skill.name}</b>
          <span>{skill.oneLine}</span>
        </div>)}
      </div>
      <p className="skill-phase-note">当前阶段用于检查专家包含的能力；在创作页面调用专家将在下一阶段接入。</p>
      <div className="modal-actions">
        <button className="primary" onClick={onClose}>完成</button>
      </div>
    </div>
  </div>
}

function DeleteConfirmation({ target, deleting, error, onClose, onConfirm }: {
  target: DeleteTarget
  deleting: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}) {
  const isSkill = target.kind === 'skill'
  const name = isSkill ? target.skill.name : target.expert.name
  return <div className="modal-mask" onClick={deleting ? undefined : onClose}>
    <div
      className="modal skill-delete-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="skill-delete-title"
      aria-describedby="skill-delete-description"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="skill-delete-symbol" aria-hidden="true">!</div>
      <div className="skill-delete-copy">
        <h2 id="skill-delete-title">{isSkill ? '删除这个 Skill？' : '删除这个专家？'}</h2>
        <p id="skill-delete-description">
          {isSkill
            ? <>“{name}”对应的文件夹将移入当前 Skill 目录下的 <code>.cowrite-trash</code>，不会立即永久清除。</>
            : <>“{name}”将从当前目录的专家视图移除，不会删除其 Skill 文件。该专家当前包含 {target.skillCount} 个 Skill。</>}
        </p>
      </div>
      {isSkill && <div className="skill-delete-target">
        <span>将移动</span>
        <code>{target.skill.path}</code>
      </div>}
      {error && <p className="skill-delete-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button disabled={deleting} onClick={onClose}>取消</button>
        <button
          className="delete-confirm"
          disabled={deleting}
          onClick={onConfirm}
        >
          {deleting ? '正在删除…' : isSkill ? '确认删除 Skill' : '确认删除专家'}
        </button>
      </div>
    </div>
  </div>
}

export function SkillManager({ sidebarOpen, onOpenSidebar }: {
  sidebarOpen: boolean
  onOpenSidebar: () => void
}) {
  const [sources, setSources] = useState<LocalSkillSource[]>([])
  const [sourceId, setSourceId] = useState<SourceId>('codex')
  const [catalogs, setCatalogs] = useState<Partial<Record<SourceId, LocalSkillCatalog>>>({})
  const [customDirectory, setCustomDirectory] = useState('')
  const [directoryHistory, setDirectoryHistory] = useState<string[]>([])
  const [view, setView] = useState<'skills' | 'experts'>('skills')
  const [category, setCategory] = useState('全部')
  const [query, setQuery] = useState('')
  const [loadingSources, setLoadingSources] = useState<Set<SourceId>>(new Set())
  const [errors, setErrors] = useState<Partial<Record<SourceId, string>>>({})
  const [selectedSkill, setSelectedSkill] = useState<LocalSkill | null>(null)
  const [selectedExpert, setSelectedExpert] = useState<LocalSkillExpert | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [operationNotice, setOperationNotice] = useState('')
  const requestGates = useRef<Record<SourceId, ReturnType<typeof createLatestRequestGate>>>({
    codex: createLatestRequestGate(),
    claude: createLatestRequestGate(),
    custom: createLatestRequestGate(),
  })

  const loadCatalog = useCallback(async (requestedSource: SourceId, requestedDirectory: string) => {
    const trimmedDirectory = requestedDirectory.trim()
    if (!trimmedDirectory) return
    const gate = requestGates.current[requestedSource]
    const request = gate.next()
    setLoadingSources((current) => new Set([...current, requestedSource]))
    setErrors((current) => ({ ...current, [requestedSource]: undefined }))
    try {
      const result = await getJson<LocalSkillCatalog>(
        `/api/skilldeck/catalog?directory=${encodeURIComponent(trimmedDirectory)}`,
      )
      if (!gate.isLatest(request)) return
      setCatalogs((current) => ({ ...current, [requestedSource]: result }))
      if (requestedSource === 'custom') {
        setCustomDirectory(result.directory)
        setDirectoryHistory(rememberDirectory(result.directory))
      } else {
        setSources((current) => current.map((source) => (
          source.id === requestedSource ? { ...source, available: true } : source
        )))
      }
      setCategory('全部')
    } catch (loadError) {
      if (!gate.isLatest(request)) return
      setCatalogs((current) => ({ ...current, [requestedSource]: undefined }))
      setErrors((current) => ({
        ...current,
        [requestedSource]: loadError instanceof Error ? loadError.message : '无法加载这个 Skill 目录',
      }))
    } finally {
      if (gate.isLatest(request)) {
        setLoadingSources((current) => {
          const next = new Set(current)
          next.delete(requestedSource)
          return next
        })
      }
    }
  }, [])

  useEffect(() => {
    let disposed = false
    setDirectoryHistory(getDirectoryHistory())
    getJson<{ defaultDirectory: string; sources: LocalSkillSource[] }>('/api/skilldeck/config')
      .then((config) => {
        if (disposed) return
        setSources(config.sources)
        const rememberedDirectory = getRememberedDirectory()
        setCustomDirectory(rememberedDirectory)
        setSourceId(selectInitialSkillSource(config.sources))
        for (const source of config.sources) {
          if (source.available) void loadCatalog(source.id, source.directory)
        }
        if (rememberedDirectory) void loadCatalog('custom', rememberedDirectory)
      })
      .catch((loadError) => {
        if (disposed) return
        setErrors({ codex: loadError instanceof Error ? loadError.message : '无法连接本地 Skill 服务' })
      })
    return () => {
      disposed = true
      Object.values(requestGates.current).forEach((gate) => gate.invalidate())
    }
  }, [loadCatalog])

  const catalog = catalogs[sourceId] ?? null
  const error = errors[sourceId] ?? ''
  const loading = loadingSources.has(sourceId)
  const currentSource = sources.find((source) => source.id === sourceId)
  const filteredSkills = useMemo(
    () => filterLocalSkills(catalog?.skills ?? [], category, query),
    [catalog, category, query],
  )

  const submitDirectory = (event: FormEvent) => {
    event.preventDefault()
    void loadCatalog('custom', customDirectory)
  }

  const openDeleteConfirmation = (target: DeleteTarget) => {
    setDeleteError('')
    setDeleteTarget(target)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleting(true)
    setDeleteError('')
    try {
      const endpoint = target.kind === 'skill'
        ? '/api/skilldeck/skills'
        : '/api/skilldeck/experts'
      const body = target.kind === 'skill'
        ? {
          directory: target.directory,
          folder: target.skill.folder,
          confirmation: 'move-to-trash',
        }
        : {
          directory: target.directory,
          expertId: target.expert.id,
          confirmation: 'delete-expert',
        }
      const result = await requestJson<LocalSkillCatalog>(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setCatalogs((current) => ({ ...current, [target.sourceId]: result }))
      if (category !== '全部' && !result.categories.includes(category)) setCategory('全部')
      if (target.kind === 'skill') {
        setSelectedSkill(null)
        setOperationNotice(`“${target.skill.name}”已移入 .cowrite-trash，可在本地恢复。`)
      } else {
        setSelectedExpert(null)
        setOperationNotice(`“${target.expert.name}”专家分组已删除，成员 Skill 保持不变。`)
      }
      setDeleteTarget(null)
    } catch (deleteFailure) {
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : '删除失败，请重新扫描后再试')
    } finally {
      setDeleting(false)
    }
  }

  return <section className="skill-manager">
    <header className="skill-manager-topbar">
      {!sidebarOpen && <button className="icon-button" title="展开目录" onClick={onOpenSidebar}>☰</button>}
      <div className="skill-manager-heading">
        <h1>Skill 管理</h1>
        <span>本地 Skill Deck</span>
      </div>
      <span className="local-only"><i />只读取本机文件</span>
    </header>

    <div className="skill-manager-body">
      <div className="skill-source-tabs" role="tablist" aria-label="Skill 来源">
        {[...sources, { id: 'custom' as const, label: '自定义目录', directory: customDirectory, available: Boolean(customDirectory) }].map((source) => {
          const sourceCatalog = catalogs[source.id]
          return <button
            key={source.id}
            role="tab"
            aria-label={source.label}
            aria-selected={sourceId === source.id}
            className={sourceId === source.id ? 'active' : ''}
            onClick={() => { setSourceId(source.id); setCategory('全部'); setQuery('') }}
          >
            <span className={`source-dot ${source.available ? 'available' : ''}`} />
            {source.label}
            {sourceCatalog && <small aria-hidden="true">{sourceCatalog.skills.length}</small>}
          </button>
        })}
      </div>

      {sourceId === 'custom'
        ? <form className="skill-directory-bar compact" onSubmit={submitDirectory}>
          <input
            id="skill-directory"
            aria-label="本地 Skill 目录"
            list="skill-directory-history"
            value={customDirectory}
            onChange={(event) => setCustomDirectory(event.target.value)}
            placeholder="输入本地 Skill 目录的绝对路径"
            spellCheck={false}
          />
          <datalist id="skill-directory-history">
            {directoryHistory.map((item) => <option key={item} value={item} />)}
          </datalist>
          <button className="primary" disabled={loading || !customDirectory.trim()} type="submit">
            {loading ? '读取中…' : catalog ? '刷新' : '加载'}
          </button>
        </form>
        : <div className="skill-source-path">
          <span>{currentSource?.directory}</span>
          <button
            disabled={!canScanSkillSource(currentSource) || loading}
            onClick={() => currentSource && void loadCatalog(currentSource.id, currentSource.directory)}
          >
            {loading ? '扫描中…' : '重新扫描'}
          </button>
        </div>}

      <div className="skill-manager-controls">
        <div className="skill-view-tabs" role="tablist" aria-label="Skill 管理视图">
          <button role="tab" aria-selected={view === 'skills'} className={view === 'skills' ? 'active' : ''} onClick={() => setView('skills')}>
            Skill
          </button>
          <button role="tab" aria-selected={view === 'experts'} className={view === 'experts' ? 'active' : ''} onClick={() => setView('experts')}>
            专家
          </button>
        </div>
        {view === 'skills' && <input
          className="skill-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索名称或能力…"
          aria-label="搜索 Skill"
        />}
      </div>

      {operationNotice && <div className="skill-operation-notice" role="status">
        <span>{operationNotice}</span>
        <button aria-label="关闭删除结果提示" onClick={() => setOperationNotice('')}>×</button>
      </div>}

      {error && <div className="skill-load-state error">
        <b>这个目录暂时读不到</b>
        <p>{error}</p>
      </div>}

      {!error && loading && <div className="skill-load-state">
        <span className="skill-loader" />
        <p>正在整理本地 Skill…</p>
      </div>}

      {!error && !loading && catalog && view === 'skills' && <>
        <div className="skill-categories" aria-label="Skill 分类">
          {['全部', ...catalog.categories].map((item) => <button
            key={item}
            className={category === item ? 'active' : ''}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>)}
          <span>{filteredSkills.length} / {catalog.skills.length}</span>
        </div>
        {filteredSkills.length
          ? <div className="skill-card-grid">
            {filteredSkills.map((skill) => <article className="skill-card" key={skill.id}>
              <span className="skill-card-category">{skill.category}</span>
              <h3>{skill.name}</h3>
              <p>{skill.oneLine}</p>
              <div className="skill-card-actions">
                <span className="skill-card-path">{skill.folder}/SKILL.md</span>
                <button
                  className="skill-use-button"
                  aria-label={`使用 ${skill.name}`}
                  onClick={() => setSelectedSkill(skill)}
                >
                  使用
                </button>
                <button
                  className="skill-delete-button"
                  aria-label={`删除 Skill ${skill.name}`}
                  onClick={() => openDeleteConfirmation({
                    kind: 'skill',
                    skill,
                    directory: catalog.directory,
                    sourceId,
                  })}
                >
                  删除
                </button>
              </div>
            </article>)}
          </div>
          : <div className="skill-load-state"><b>没有匹配的 Skill</b><p>换一个关键词或分类试试。</p></div>}
      </>}

      {!error && !loading && catalog && view === 'experts' && <>
        <div className="expert-view-note">
          <div><b>本地专家</b><span>按 Skill 用途自动聚合，不调用外部模型</span></div>
          <span>{catalog.experts.length} 个</span>
        </div>
        {catalog.experts.length
          ? <div className="skill-card-grid expert-card-grid">
            {catalog.experts.map((expert) => {
              const expertSkills = resolveExpertSkills(expert, catalog.skills)
              return <article className="skill-card expert-card" key={expert.id}>
                <span className="expert-mark">{expert.emoji}</span>
                <h3>{expert.name}</h3>
                <p>{expert.description}</p>
                <div className="expert-skill-tags">{expertSkills.slice(0, 3).map((skill) => <span key={skill.id}>{skill.name}</span>)}</div>
                <div className="skill-card-actions expert-card-actions">
                  <span className="skill-card-path">{expertSkills.length} 个本地 Skill</span>
                  <button
                    className="skill-use-button"
                    aria-label={`查看专家 ${expert.name}`}
                    onClick={() => setSelectedExpert(expert)}
                  >
                    查看
                  </button>
                  <button
                    className="skill-delete-button"
                    aria-label={`删除专家 ${expert.name}`}
                    onClick={() => openDeleteConfirmation({
                      kind: 'expert',
                      expert,
                      skillCount: expertSkills.length,
                      directory: catalog.directory,
                      sourceId,
                    })}
                  >
                    删除
                  </button>
                </div>
              </article>
            })}
          </div>
          : <div className="skill-load-state"><b>还没有专家</b><p>目录中出现可分类的 Skill 后，专家会自动显示在这里。</p></div>}
      </>}

      {!error && !loading && !catalog && <div className="skill-load-state">
        <b>{sourceId === 'custom' ? '还没有加载自定义目录' : `未发现 ${currentSource?.label ?? ''} Skill`}</b>
        <p>{sourceId === 'custom'
          ? '输入一个包含 Skill 子目录的本地路径，然后点击加载。'
          : `默认扫描位置：${currentSource?.directory ?? ''}`}</p>
      </div>}

      {catalog?.warnings.length ? <details className="skill-warnings">
        <summary>{catalog.warnings.length} 个文件未加载</summary>
        {catalog.warnings.map((warning) => <p key={warning}>{warning}</p>)}
      </details> : null}
    </div>

    {selectedSkill && <SkillUseModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />}
    {selectedExpert && catalog && <ExpertDetail expert={selectedExpert} skills={catalog.skills} onClose={() => setSelectedExpert(null)} />}
    {deleteTarget && <DeleteConfirmation
      target={deleteTarget}
      deleting={deleting}
      error={deleteError}
      onClose={() => { setDeleteTarget(null); setDeleteError('') }}
      onConfirm={() => void confirmDelete()}
    />}
  </section>
}
