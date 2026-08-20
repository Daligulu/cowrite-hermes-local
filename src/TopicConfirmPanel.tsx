import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Page, StyleConfig, StylePreset } from '../shared/types'
import { cowriteFetch } from './apiClient'
import { parseTopicCandidates } from './topicModel'

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await cowriteFetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `请求失败：${response.status}`)
  return result as T
}

type CreateType = 'article' | 'sticker'
type StyleKey = 'writing' | 'layout' | 'image'

interface StyleGroup {
  key: StyleKey
  label: string
  presets: StylePreset[]
}

export function TopicConfirmPanel({ page, notify }: { page: Page; notify: (message: string) => void }) {
  const [styles, setStyles] = useState<StyleConfig>({ writing: [], layout: [], image: [] })
  const [selected, setSelected] = useState<number[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [createType, setCreateType] = useState<CreateType>('article')
  const [stylePicks, setStylePicks] = useState<Partial<Record<StyleKey, string>>>({})
  const [customStyles, setCustomStyles] = useState<Partial<Record<StyleKey, string>>>({})
  const [extraReq, setExtraReq] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api<{ config: { styles: StyleConfig } }>('/api/style-config')
      .then((data) => setStyles(data.config.styles))
      .catch(() => undefined)
  }, [])

  const candidates = useMemo(() => parseTopicCandidates(page.content), [page.content])
  const selectedCandidates = useMemo(() => candidates.filter((candidate) => selected.includes(candidate.index)), [candidates, selected])

  const toggleCandidate = (index: number) => {
    setSelected((current) => current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index])
  }

  const styleGroups: StyleGroup[] = createType === 'article'
    ? [
        { key: 'writing', label: '写作风格', presets: styles.writing },
        { key: 'layout', label: '排版风格', presets: styles.layout },
        { key: 'image', label: '配图风格', presets: styles.image },
      ]
    : [
        { key: 'writing', label: '文案风格', presets: styles.writing },
        { key: 'image', label: '视觉风格', presets: styles.image },
      ]

  const pickStyle = (key: StyleKey, presetId: string) => {
    setStylePicks((current) => ({ ...current, [key]: presetId }))
    setCustomStyles((current) => ({ ...current, [key]: '' }))
  }

  const effectiveStyle = (key: StyleKey) => (customStyles[key] ?? '').trim() || stylePicks[key] || ''

  const createTasks = useCallback(async () => {
    if (selectedCandidates.length === 0) return
    setSubmitting(true)
    try {
      const writing = effectiveStyle('writing')
      const layout = effectiveStyle('layout')
      const image = effectiveStyle('image')
      const typeLabel = createType === 'sticker' ? '贴图' : '文章'
      const extra = extraReq.trim()
      let created = 0
      for (const candidate of selectedCandidates) {
        const parts = [
          `选题：${candidate.title}`,
          `类型：${typeLabel}`,
          writing ? `写作风格：${writing}` : '',
          createType === 'article' && layout ? `排版风格：${layout}` : '',
          image ? `配图风格：${image}` : '',
          extra ? `补充要求：${extra}` : '',
        ]
        await api<unknown>('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            action: 'topic-create',
            pageId: page.id,
            requirements: parts.filter(Boolean).join('；'),
            delivery: 'cowrite',
          }),
        })
        created += 1
      }
      notify(`已创建 ${created} 个创作任务，可在任务中心查看进度`)
      setPanelOpen(false)
      setSelected([])
    } catch (error) {
      notify(error instanceof Error ? error.message : '创作任务创建失败')
    } finally {
      setSubmitting(false)
    }
  }, [selectedCandidates, createType, customStyles, stylePicks, extraReq, page.id, notify])

  if (candidates.length === 0) return null

  return (
    <div className="topic-confirm">
      <div className="topic-confirm-head">
        <span className="topic-confirm-title">⚡ 选题确认</span>
        <span className="topic-confirm-hint">点选候选（可多选）后确认，一个选题创建一个创作任务</span>
      </div>
      <div className="topic-candidate-list">
        {candidates.map((candidate) => (
          <button
            key={candidate.index}
            className={`topic-candidate ${selected.includes(candidate.index) ? 'on' : ''}`}
            onClick={() => toggleCandidate(candidate.index)}
          >
            <span className="topic-candidate-check">{selected.includes(candidate.index) ? '✓' : ''}</span>
            <span className="topic-candidate-body">
              <span className="topic-candidate-title">{candidate.title}</span>
              {candidate.highlight && <span className="topic-candidate-highlight">{candidate.highlight}</span>}
              {(candidate.channel || candidate.styleHint) && (
                <span className="topic-candidate-meta">
                  {candidate.channel && <span className="topic-meta-chip">{candidate.channel}</span>}
                  {candidate.styleHint && <span className="topic-meta-chip">{candidate.styleHint}</span>}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      <button
        className="primary topic-confirm-btn"
        disabled={selected.length === 0}
        onClick={() => setPanelOpen(true)}
      >
        确认选题（已选 {selected.length}）
      </button>

      {panelOpen && (
        <div className="modal-mask" onClick={() => setPanelOpen(false)}>
          <div className="modal topic-create-modal" onClick={(event) => event.stopPropagation()}>
            <h2>确认创作设置</h2>
            <p className="modal-hint">已选 {selectedCandidates.length} 个选题，确认风格与补充要求后将逐一创作。</p>
            <div className="topic-selected-titles">
              {selectedCandidates.map((candidate) => (
                <span key={candidate.index} className="topic-selected-chip">{candidate.title}</span>
              ))}
            </div>
            <label className="field">
              <span>创作类型</span>
              <div className="topic-type-options">
                <button
                  type="button"
                  className={`topic-type-option ${createType === 'article' ? 'on' : ''}`}
                  onClick={() => setCreateType('article')}
                >文章创作</button>
                <button
                  type="button"
                  className={`topic-type-option ${createType === 'sticker' ? 'on' : ''}`}
                  onClick={() => setCreateType('sticker')}
                >贴图创作</button>
              </div>
            </label>
            {styleGroups.map((group) => (
              <label className="field" key={group.key}>
                <span>{group.label}</span>
                <div className="topic-style-options">
                  {group.presets.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      className={`topic-style-option ${stylePicks[group.key] === preset.id && !(customStyles[group.key] ?? '') ? 'on' : ''}`}
                      onClick={() => pickStyle(group.key, preset.id)}
                      title={preset.description}
                    >{preset.label}</button>
                  ))}
                </div>
                <input
                  className="topic-style-custom"
                  placeholder="或手动输入风格描述…"
                  value={customStyles[group.key] ?? ''}
                  onChange={(event) => {
                    setCustomStyles((current) => ({ ...current, [group.key]: event.target.value }))
                    setStylePicks((current) => ({ ...current, [group.key]: '' }))
                  }}
                />
              </label>
            ))}
            <label className="field">
              <span>补充要求（可选）</span>
              <textarea
                rows={3}
                value={extraReq}
                placeholder="如：标题自拟、引用权威数据、语气更克制、重点加粗…"
                onChange={(event) => setExtraReq(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setPanelOpen(false)}>取消</button>
              <button className="primary" onClick={() => void createTasks()} disabled={submitting}>
                {submitting ? '创建中…' : `创建 ${selectedCandidates.length} 个创作任务`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
