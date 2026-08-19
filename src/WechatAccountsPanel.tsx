import { useCallback, useEffect, useState } from 'react'
import type { WechatAccountView } from '../shared/types'
import { cowriteFetch } from './apiClient'

interface WechatAccountInput {
  id: string
  label: string
  appId: string
  secret?: string
}

interface AccountForm {
  id: string
  label: string
  appId: string
  secret: string
}

const emptyForm = (): AccountForm => ({ id: '', label: '', appId: '', secret: '' })

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await cowriteFetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `请求失败：${response.status}`)
  return result as T
}

export function WechatAccountsPanel({ notify }: { notify: (message: string) => void }) {
  const [accounts, setAccounts] = useState<WechatAccountView[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState<AccountForm | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await requestJson<{ accounts: WechatAccountView[] }>('/api/wechat-accounts')
      setAccounts(data.accounts)
    } catch (error) {
      notify(error instanceof Error ? error.message : '公众号账号加载失败')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    refresh().catch(() => undefined)
  }, [refresh])

  const startEdit = (account: WechatAccountView) => {
    setEditing({ id: account.id, label: account.label, appId: account.appId, secret: '' })
  }

  const remove = async (account: WechatAccountView) => {
    if (!window.confirm(`删除公众号账号「${account.label}」（${account.id}）？`)) return
    try {
      const inputs = accounts
        .filter((item) => item.id !== account.id)
        .map((item) => ({ id: item.id, label: item.label, appId: item.appId }))
      const data = await requestJson<{ accounts: WechatAccountView[] }>('/api/wechat-accounts', {
        method: 'PUT',
        body: JSON.stringify({ accounts: inputs }),
      })
      setAccounts(data.accounts)
      setDirty(false)
      notify(`已删除账号「${account.label}」`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '删除失败')
    }
  }

  const saveForm = async () => {
    if (!editing) return
    const id = editing.id.trim()
    const label = editing.label.trim()
    const appId = editing.appId.trim()
    if (!id || !label || !appId) {
      notify('请填写账号 ID、名称与 AppID')
      return
    }
    const exists = accounts.some((account) => account.id === id)
    if (!exists && !editing.secret.trim()) {
      notify('新账号必须填写 Secret')
      return
    }
    setSaving(true)
    try {
      const current = accounts.map((account) => ({ id: account.id, label: account.label, appId: account.appId }))
      const inputs: WechatAccountInput[] = exists
        ? current.map((account) => (account.id === id ? { ...account, label, appId, secret: editing.secret.trim() || undefined } : account))
        : [...current, { id, label, appId, secret: editing.secret.trim() }]
      const data = await requestJson<{ accounts: WechatAccountView[] }>('/api/wechat-accounts', {
        method: 'PUT',
        body: JSON.stringify({ accounts: inputs }),
      })
      setAccounts(data.accounts)
      setEditing(null)
      setDirty(false)
      notify(exists ? `已更新账号「${label}」` : `已新增账号「${label}」`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="wechat-accounts-panel">
      <header className="wechat-accounts-head">
        <div>
          <h3>公众号账号</h3>
          <p>微信贴图/排版发布使用的公众号；Secret 只存本机配置，前端不回显明文。</p>
        </div>
        <button className="ghost small" onClick={() => { setEditing(emptyForm()); }}>＋ 新增账号</button>
      </header>

      {loading && <div className="wechat-accounts-empty">账号加载中…</div>}

      {!loading && (
        <div className="wechat-accounts-list">
          {accounts.length === 0 && (
            <div className="wechat-accounts-empty">还没有配置公众号账号，点「新增账号」添加。</div>
          )}
          {accounts.map((account) => (
            <div className="wechat-account-row" key={account.id}>
              <span className="wechat-account-main">
                <span className="wechat-account-label">{account.label}</span>
                <span className="wechat-account-meta">
                  {account.id} · {account.appId} · {account.secretSet ? 'Secret 已配置' : 'Secret 未配置'}
                </span>
              </span>
              <span className="wechat-account-buttons">
                <button className="ghost small" onClick={() => startEdit(account)}>编辑</button>
                <button className="ghost small danger-text" onClick={() => remove(account)}>删除</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="wechat-account-form">
          <div className="wechat-account-form-row">
            <label className="field">
              <span>账号 ID（发布时使用，如 dog / default）</span>
              <input
                value={editing.id}
                placeholder="dog"
                onChange={(event) => setEditing({ ...editing, id: event.target.value })}
              />
            </label>
            <label className="field">
              <span>账号名称</span>
              <input
                value={editing.label}
                placeholder="狗狗生活小百科"
                onChange={(event) => setEditing({ ...editing, label: event.target.value })}
              />
            </label>
          </div>
          <div className="wechat-account-form-row">
            <label className="field">
              <span>AppID</span>
              <input
                value={editing.appId}
                placeholder="wx..."
                onChange={(event) => setEditing({ ...editing, appId: event.target.value })}
              />
            </label>
            <label className="field">
              <span>AppSecret{accounts.some((account) => account.id === editing.id) ? '（留空则不修改）' : ''}</span>
              <input
                type="password"
                value={editing.secret}
                placeholder={accounts.some((account) => account.id === editing.id) ? '••••••' : '必填'}
                onChange={(event) => setEditing({ ...editing, secret: event.target.value })}
              />
            </label>
          </div>
          <div className="wechat-account-form-actions">
            <button className="ghost small" onClick={() => setEditing(null)} disabled={saving}>取消</button>
            <button className="primary small" onClick={saveForm} disabled={saving}>
              {saving ? '保存中…' : '保存账号'}
            </button>
          </div>
        </div>
      )}

      {!editing && dirty && (
        <div className="wechat-accounts-dirty">有未保存的账号改动</div>
      )}
    </section>
  )
}
