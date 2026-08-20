import { useEffect, useState } from 'react'
import type { ChannelConfig } from '../shared/types'
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

export function TopicCollectModal({ open, initialRequirement, pageId, onClose, onSubmitted, notify }: {
  open: boolean
  initialRequirement?: string
  pageId?: string
  onClose: () => void
  onSubmitted?: () => void
  notify: (text: string) => void
}) {
  const [channels, setChannels] = useState<ChannelConfig[]>([])
  const [pendingChannels, setPendingChannels] = useState<string[]>([])
  const [pendingTopicType, setPendingTopicType] = useState<'article' | 'sticker'>('article')
  const [pendingTopicReq, setPendingTopicReq] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setPendingTopicReq((initialRequirement ?? '').replace(/选题/g, '').trim())
    setPendingTopicType('article')
    api<{ config: { channels: ChannelConfig[] } }>('/api/channel-config')
      .then((data) => {
        const enabled = data.config.channels.filter((channel) => channel.enabled)
        setChannels(enabled)
        setPendingChannels(enabled.map((channel) => channel.id))
      })
      .catch(() => {
        setChannels([])
        setPendingChannels([])
      })
  }, [initialRequirement, open])

  const togglePendingChannel = (channelId: string) => {
    setPendingChannels((current) => current.includes(channelId)
      ? current.filter((id) => id !== channelId)
      : [...current, channelId])
  }

  const submit = async () => {
    if (pendingChannels.length === 0) {
      notify('请至少选择一个选题渠道')
      return
    }
    const channelNames = pendingChannels.map((id) => channels.find((channel) => channel.id === id)?.id ?? id).join(',')
    const parts = [
      `渠道：${channelNames}`,
      `类型：${pendingTopicType === 'sticker' ? '贴图' : '文章'}`,
      pendingTopicReq.trim() ? `要求：${pendingTopicReq.trim()}` : '',
    ]
    const requirements = parts.filter(Boolean).join('；')
    setSubmitting(true)
    try {
      await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ action: 'topic-collect', pageId, requirements, delivery: 'cowrite' }),
      })
      notify('选题任务已提交，AI 正在多渠道收集候选选题')
      onClose()
      onSubmitted?.()
    } catch (error) {
      notify(error instanceof Error ? error.message : '选题任务提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal topic-modal" onClick={(event) => event.stopPropagation()}>
        <h2>收集选题</h2>
        <p className="modal-hint">选择选题来源渠道（可多选），AI 将按渠道与要求收集候选选题。</p>
        <div className="topic-channel-options">
          {channels.length === 0 && <div className="sticker-account-empty">暂无可用渠道，请先到「动作配置」添加选题渠道。</div>}
          {channels.map((channel) => (
            <button
              key={channel.id}
              className={`topic-channel-option ${pendingChannels.includes(channel.id) ? 'on' : ''}`}
              onClick={() => togglePendingChannel(channel.id)}
            >
              <span className="topic-channel-check">{pendingChannels.includes(channel.id) ? '✓' : ''}</span>
              <span className="topic-channel-label">{channel.label}</span>
              {channel.description && <span className="topic-channel-desc">{channel.description}</span>}
            </button>
          ))}
        </div>
        <label className="field">
          <span>创作类型</span>
          <div className="topic-type-options">
            <button
              type="button"
              className={`topic-type-option ${pendingTopicType === 'article' ? 'on' : ''}`}
              onClick={() => setPendingTopicType('article')}
            >文章创作</button>
            <button
              type="button"
              className={`topic-type-option ${pendingTopicType === 'sticker' ? 'on' : ''}`}
              onClick={() => setPendingTopicType('sticker')}
            >贴图创作</button>
          </div>
        </label>
        <label className="field">
          <span>文字要求（可选）</span>
          <input
            value={pendingTopicReq}
            placeholder="如：围绕 AI 工具效率、适合公众号科普…"
            onChange={(event) => setPendingTopicReq(event.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={() => void submit()} disabled={submitting}>{submitting ? '提交中…' : '开始收集'}</button>
        </div>
      </div>
    </div>
  )
}
