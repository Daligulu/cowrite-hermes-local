import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ActionConfig, ActionConfigFile, ActionPrompt, CowriteTask, LocalSkill, WorkflowStep } from '../shared/types'
import { cowriteFetch } from './apiClient'
import { filterLocalSkills } from './skillManagerModel'
import './ActionConfigManager.css'

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await cowriteFetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `请求失败：${response.status}`)
  return result as T
}

const STEP_TYPES = ['load', 'process', 'verify', 'write'] as const
const STEP_LABELS: Record<WorkflowStep['step'], string> = {
  load: '加载技能',
  process: '处理',
  verify: '校验',
  write: '写回',
}

function emptyAction(index: number): ActionConfig {
  return {
    id: `action-${Date.now().toString(36)}-${index}`,
    label: '新动作',
    enabled: true,
    chip: false,
    keywords: [],
    skills: [],
    prompts: [],
    workflow: [],
  }
}

export function ActionConfigManager({ page, notify }: { page: { id: string; title: string } | null; notify: (message: string) => void }) {
  const [config, setConfig] = useState<ActionConfigFile | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<LocalSkill[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [skillCategory, setSkillCategory] = useState('全部')
  const [skillQuery, setSkillQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await requestJson<{ config: ActionConfigFile }>('/api/action-config')
      setConfig(data.config)
      if (!selectedId || !data.config.actions.some((action) => action.id === selectedId)) {
        setSelectedId(data.config.actions[0]?.id ?? null)
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : '动作配置加载失败')
    }
  }, [notify, selectedId])

  useEffect(() => {
    refresh().catch(() => undefined)
    let disposed = false
    const loadCatalog = async () => {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const data = await requestJson<{ skills: LocalSkill[] }>('/api/skilldeck/catalog')
        if (disposed) return
        setCatalog(data.skills)
      } catch (loadError) {
        if (disposed) return
        setCatalog([])
        setCatalogError(loadError instanceof Error ? loadError.message : '技能列表加载失败')
      } finally {
        if (!disposed) setCatalogLoading(false)
      }
    }
    void loadCatalog()
    return () => { disposed = true }
  }, [refresh])

  const selected = useMemo(
    () => config?.actions.find((action) => action.id === selectedId) ?? null,
    [config, selectedId],
  )

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const skill of catalog) counts.set(skill.category, (counts.get(skill.category) ?? 0) + 1)
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
    return [['全部', catalog.length] as const, ...entries]
  }, [catalog])

  const visibleSkills = useMemo(
    () => filterLocalSkills(catalog, skillCategory, skillQuery),
    [catalog, skillCategory, skillQuery],
  )

  const updateSelected = (patch: Partial<ActionConfig>) => {
    if (!config || !selected) return
    setConfig({
      ...config,
      actions: config.actions.map((action) => (action.id === selected.id ? { ...action, ...patch } : action)),
    })
    setDirty(true)
  }

  const moveAction = (from: number, to: number) => {
    if (!config) return
    if (to < 0 || to >= config.actions.length) return
    const actions = [...config.actions]
    const [moved] = actions.splice(from, 1)
    actions.splice(to, 0, moved)
    setConfig({ ...config, actions })
    setDirty(true)
  }

  const addAction = () => {
    if (!config) return
    const action = emptyAction(config.actions.length)
    setConfig({ ...config, actions: [...config.actions, action] })
    setSelectedId(action.id)
    setDirty(true)
  }

  const removeAction = (id: string) => {
    if (!config) return
    if (!window.confirm(`删除动作「${config.actions.find((action) => action.id === id)?.label ?? id}」？`)) return
    const actions = config.actions.filter((action) => action.id !== id)
    setConfig({ ...config, actions })
    if (selectedId === id) setSelectedId(actions[0]?.id ?? null)
    setDirty(true)
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      const data = await requestJson<{ config: ActionConfigFile }>('/api/action-config', {
        method: 'PUT',
        body: JSON.stringify(config),
      })
      setConfig(data.config)
      setDirty(false)
      notify('动作配置已保存，立即生效')
    } catch (error) {
      notify(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!window.confirm('恢复默认动作配置？当前自定义配置将被覆盖。')) return
    try {
      const data = await requestJson<{ config: ActionConfigFile }>('/api/action-config/reset', { method: 'POST' })
      setConfig(data.config)
      setSelectedId(data.config.actions[0]?.id ?? null)
      setDirty(false)
      notify('已恢复默认动作配置')
    } catch (error) {
      notify(error instanceof Error ? error.message : '恢复失败')
    }
  }

  const testRun = async () => {
    if (!selected) return
    if (!page) {
      notify('请先打开一个页面再试运行')
      return
    }
    if (!window.confirm(`将使用当前配置在页面「${page.title}」上执行一次「${selected.label}」任务，结果会写回页面。继续？`)) return
    setTesting(true)
    try {
      await requestJson<CowriteTask>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          action: selected.id,
          pageId: page.id,
          requirements: `（动作配置试运行）${selected.label}`,
          delivery: 'cowrite',
        }),
      })
      notify(`已提交试运行任务：${selected.label}，请到任务条查看结果`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '试运行提交失败')
    } finally {
      setTesting(false)
    }
  }

  if (!config) {
    return <div className="action-config-loading">加载动作配置…</div>
  }

  const skillName = (folder: string) => folder.split('/').pop() ?? folder

  const toggleSkill = (name: string) => {
    if (!selected) return
    const exists = selected.skills.includes(name)
    updateSelected({
      skills: exists ? selected.skills.filter((item) => item !== name) : [...selected.skills, name],
    })
  }

  const addCustomSkill = () => {
    const input = (document.getElementById('custom-skill-input') as HTMLInputElement | null)
    const value = input?.value.trim()
    if (!value || !selected || selected.skills.includes(value)) return
    updateSelected({ skills: [...selected.skills, value] })
    if (input) input.value = ''
  }

  const updatePrompt = (index: number, patch: Partial<ActionPrompt>) => {
    if (!selected) return
    const prompts = selected.prompts.map((prompt, i) => (i === index ? { ...prompt, ...patch } : prompt))
    updateSelected({ prompts })
  }

  const updateWorkflowStep = (index: number, patch: Partial<WorkflowStep>) => {
    if (!selected) return
    const workflow = selected.workflow.map((step, i) => (i === index ? { ...step, ...patch } : step))
    updateSelected({ workflow })
  }

  return (
    <div className="action-config-manager">
      <header className="action-config-head">
        <div>
          <h2>动作配置</h2>
          <p>配置「交给 Hermes」各功能按钮：多技能、多提示词、工作流组合，保存后立即生效。</p>
        </div>
        <div className="action-config-head-actions">
          <button className="ghost" onClick={reset} disabled={saving}>恢复默认</button>
          <button className="ghost" onClick={testRun} disabled={testing || !selected}>试运行</button>
          <button className="primary" onClick={save} disabled={saving || !dirty}>
            {saving ? '保存中…' : dirty ? '保存配置' : '已保存'}
          </button>
        </div>
      </header>

      <div className="action-config-body">
        <aside className="action-config-list">
          {config.actions.map((action, index) => (
            <div
              key={action.id}
              className={`action-config-item ${selectedId === action.id ? 'active' : ''} ${dragIndex === index ? 'dragging' : ''}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (dragIndex !== null && dragIndex !== index) moveAction(dragIndex, index); setDragIndex(null) }}
              onDragEnd={() => setDragIndex(null)}
              onClick={() => setSelectedId(action.id)}
            >
              <span className="drag-handle" title="拖拽排序">⠿</span>
              <span className="action-config-item-main">
                <span className="action-config-item-label">{action.label}</span>
                <span className="action-config-item-meta">
                  {action.id}
                  {action.chip ? ' · 快捷' : ' · 更多'}
                  {action.enabled ? '' : ' · 已停用'}
                  {action.skills.length ? ` · ${action.skills.length}技能` : ''}
                </span>
              </span>
              <span className="action-config-item-buttons">
                <button
                  className="icon-button" title="上移" aria-label="上移"
                  onClick={(event) => { event.stopPropagation(); moveAction(index, index - 1) }}
                >↑</button>
                <button
                  className="icon-button" title="下移" aria-label="下移"
                  onClick={(event) => { event.stopPropagation(); moveAction(index, index + 1) }}
                >↓</button>
                <button
                  className="icon-button danger" title="删除" aria-label="删除"
                  onClick={(event) => { event.stopPropagation(); removeAction(action.id) }}
                >✕</button>
              </span>
            </div>
          ))}
          <button className="action-config-add" onClick={addAction}>＋ 新建动作</button>
        </aside>

        {selected ? (
          <section className="action-config-editor">
            <div className="action-config-field-row">
              <label className="field">
                <span>动作 ID</span>
                <input value={selected.id} onChange={(event) => updateSelected({ id: event.target.value.trim() })} />
              </label>
              <label className="field">
                <span>按钮名称</span>
                <input value={selected.label} onChange={(event) => updateSelected({ label: event.target.value })} />
              </label>
            </div>
            <div className="action-config-field-row">
              <label className="check">
                <input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected({ enabled: event.target.checked })} />
                启用
              </label>
              <label className="check">
                <input type="checkbox" checked={selected.chip} onChange={(event) => updateSelected({ chip: event.target.checked })} />
                显示在快捷区
              </label>
            </div>
            <label className="field">
              <span>自然语言关键词（逗号分隔，用于输入框识别）</span>
              <input
                value={selected.keywords.join(', ')}
                placeholder="如：润色, 改写, 口语化"
                onChange={(event) => updateSelected({
                  keywords: event.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
                })}
              />
            </label>

            <div className="field">
              <span>Skills（支持多选，按顺序加载执行）</span>
              {selected.skills.length > 0 && (
                <div className="selected-skills">
                  {selected.skills.map((name) => (
                    <span key={name} className="selected-skill-tag">
                      {name}
                      <button type="button" aria-label={`移除 ${name}`} onClick={() => toggleSkill(name)}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="skill-picker">
                <input id="custom-skill-input" placeholder="输入自定义 skill 名后点添加" />
                <button onClick={addCustomSkill}>添加</button>
              </div>
              <div className="skill-filters">
                <select value={skillCategory} onChange={(event) => setSkillCategory(event.target.value)}>
                  {categories.map(([category, count]) => (
                    <option key={category} value={category}>{category}（{count}）</option>
                  ))}
                </select>
                <input
                  value={skillQuery}
                  placeholder="搜索技能名称或描述…"
                  onChange={(event) => setSkillQuery(event.target.value)}
                />
              </div>
              {catalogLoading && <div className="skill-empty">技能列表加载中…</div>}
              {!catalogLoading && catalogError && (
                <div className="skill-empty error">
                  <span>技能列表加载失败：{catalogError}</span>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => {
                      setCatalogLoading(true)
                      setCatalogError('')
                      requestJson<{ skills: LocalSkill[] }>('/api/skilldeck/catalog')
                        .then((data) => setCatalog(data.skills))
                        .catch((loadError) => setCatalogError(loadError instanceof Error ? loadError.message : '技能列表加载失败'))
                        .finally(() => setCatalogLoading(false))
                    }}
                  >重试</button>
                </div>
              )}
              {!catalogLoading && !catalogError && (
              <div className="skill-list">
                {visibleSkills.map((skill) => {
                  const name = skillName(skill.folder)
                  const on = selected.skills.includes(name)
                  return (
                    <label key={skill.id} className={`skill-row ${on ? 'on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleSkill(name)} />
                      <span className="skill-row-name">{name}</span>
                      <span className="skill-row-desc">{skill.oneLine}</span>
                    </label>
                  )
                })}
                {visibleSkills.length === 0 && (
                  <div className="skill-empty">
                    {skillQuery.trim()
                      ? <>没有匹配「{skillQuery.trim()}」的技能，试试<button type="button" className="ghost small" onClick={() => setSkillQuery('')}>清除搜索</button>或切换分类。</>
                      : <>「{skillCategory}」分类下暂无技能，试试<button type="button" className="ghost small" onClick={() => setSkillCategory('全部')}>查看全部</button>。</>}
                  </div>
                )}
              </div>
              )}
              {!catalogLoading && !catalogError && catalog.length === 0 && !visibleSkills.length && (
                <div className="skill-empty">本地未发现可用的 Skill，请检查 Hermes 技能目录。</div>
              )}
              {selected.skills.filter((skill) => !catalog.some((entry) => skillName(entry.folder) === skill)).length > 0 && (
                <div className="skill-warning">
                  自定义技能（不在已装列表）：{selected.skills.filter((skill) => !catalog.some((entry) => skillName(entry.folder) === skill)).join(', ')}
                </div>
              )}
            </div>

            <div className="field">
              <span>Prompts（支持多条）</span>
              {selected.prompts.map((prompt, index) => (
                <div className="prompt-row" key={index}>
                  <input
                    className="prompt-id" value={prompt.id} placeholder="id"
                    onChange={(event) => updatePrompt(index, { id: event.target.value })}
                  />
                  <select
                    value={prompt.role}
                    onChange={(event) => updatePrompt(index, { role: event.target.value as ActionPrompt['role'] })}
                  >
                    <option value="system">system</option>
                    <option value="user">user</option>
                  </select>
                  <textarea
                    className="prompt-text" value={prompt.text} placeholder="提示词内容"
                    onChange={(event) => updatePrompt(index, { text: event.target.value })}
                  />
                  <button className="icon-button danger" onClick={() => updateSelected({ prompts: selected.prompts.filter((_, i) => i !== index) })}>✕</button>
                </div>
              ))}
              <button
                className="ghost small"
                onClick={() => updateSelected({ prompts: [...selected.prompts, { id: `prompt-${selected.prompts.length + 1}`, role: 'system', text: '' }] })}
              >＋ 添加 Prompt</button>
            </div>

            <div className="field">
              <span>工作流（步骤组合；不配则默认：加载 skills → 处理 → 写回）</span>
              {selected.workflow.map((step, index) => (
                <div className="workflow-row" key={index}>
                  <select
                    className="step-type" value={step.step}
                    onChange={(event) => updateWorkflowStep(index, { step: event.target.value as WorkflowStep['step'] })}
                  >
                    {STEP_TYPES.map((type) => <option key={type} value={type}>{STEP_LABELS[type]}</option>)}
                  </select>
                  <input
                    className="step-skill" value={step.skill ?? ''} placeholder="skill（可空）"
                    onChange={(event) => updateWorkflowStep(index, { skill: event.target.value || null })}
                  />
                  <input
                    className="step-prompt" value={step.prompt ?? ''} placeholder="prompt id（可空）"
                    onChange={(event) => updateWorkflowStep(index, { prompt: event.target.value || null })}
                  />
                  <input
                    className="step-io" value={step.input ?? ''} placeholder="输入"
                    onChange={(event) => updateWorkflowStep(index, { input: event.target.value || undefined })}
                  />
                  <span className="step-arrow">→</span>
                  <input
                    className="step-io" value={step.output ?? ''} placeholder="输出"
                    onChange={(event) => updateWorkflowStep(index, { output: event.target.value || undefined })}
                  />
                  <button className="icon-button" title="上移" onClick={() => {
                    if (index === 0) return
                    const workflow = [...selected.workflow]
                    const [step] = workflow.splice(index, 1)
                    workflow.splice(index - 1, 0, step)
                    updateSelected({ workflow })
                  }}>↑</button>
                  <button className="icon-button" title="下移" onClick={() => {
                    if (index === selected.workflow.length - 1) return
                    const workflow = [...selected.workflow]
                    const [step] = workflow.splice(index, 1)
                    workflow.splice(index + 1, 0, step)
                    updateSelected({ workflow })
                  }}>↓</button>
                  <button className="icon-button danger" onClick={() => updateSelected({ workflow: selected.workflow.filter((_, i) => i !== index) })}>✕</button>
                </div>
              ))}
              <button
                className="ghost small"
                onClick={() => updateSelected({ workflow: [...selected.workflow, { step: 'process', skill: null, prompt: null }] })}
              >＋ 添加步骤</button>
            </div>
          </section>
        ) : (
          <section className="action-config-empty">选择左侧动作进行编辑</section>
        )}
      </div>
    </div>
  )
}
