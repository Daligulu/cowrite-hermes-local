type FollowUpMessage = {
  prompt: string
  content: Array<{ type: 'text'; text: string }>
}

type FollowUpSender = (message: FollowUpMessage) => Promise<unknown>

type CowriteHostWindow = Window & {
  cowriteMcp?: { sendFollowUpMessage?: FollowUpSender }
  openai?: { sendFollowUpMessage?: FollowUpSender }
}

const SEND_REQUEST = 'cowrite:send-task'
const SEND_RESULT = 'cowrite:send-task-result'
const BRIDGE_READY = 'cowrite:bridge-ready'
const HOST_READY = 'cowrite:host-ready'

type TrustedParent = {
  origin: string
  token: string
}

let trustedParentPromise: Promise<TrustedParent> | undefined

export function isTrustedTaskResult(
  event: Pick<MessageEvent, 'data' | 'origin' | 'source'>,
  expectedSource: Window,
  expectedOrigin: string,
  requestId: string,
  token: string,
): boolean {
  const result = event.data
  return event.source === expectedSource
    && event.origin === expectedOrigin
    && result?.type === SEND_RESULT
    && result.requestId === requestId
    && result.bridgeToken === token
}

async function trustedParent(): Promise<TrustedParent> {
  trustedParentPromise ??= (async () => {
    const sessionResponse = await fetch('/api/bridge-session')
    const session = await sessionResponse.json() as { token?: string; error?: string }
    if (!sessionResponse.ok || !session.token) {
      throw new Error(session.error || '无法验证 Cowrite 画布宿主')
    }

    return new Promise<TrustedParent>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', onHandshake)
        reject(new Error('无法验证 Cowrite 画布宿主'))
      }, 10_000)
      function onHandshake(event: MessageEvent) {
        if (event.source !== window.parent
          || event.data?.type !== HOST_READY
          || event.data?.bridgeToken !== session.token) return
        window.clearTimeout(timeout)
        window.removeEventListener('message', onHandshake)
        resolve({ origin: event.origin, token: session.token! })
      }
      window.addEventListener('message', onHandshake)
      window.parent.postMessage({ type: BRIDGE_READY }, '*')
    })
  })().catch((error) => {
    trustedParentPromise = undefined
    throw error
  })
  return trustedParentPromise
}

function directSender(): FollowUpSender | null {
  const host = window as CowriteHostWindow
  if (typeof host.cowriteMcp?.sendFollowUpMessage === 'function') {
    return (message) => host.cowriteMcp!.sendFollowUpMessage!(message)
  }
  if (typeof host.openai?.sendFollowUpMessage === 'function') {
    return (message) => host.openai!.sendFollowUpMessage!(message)
  }
  return null
}

function framedSender(): FollowUpSender | null {
  if (window.parent === window) return null

  return async (message) => {
    const parent = await trustedParent()
    return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error('Codex 没有响应发送请求，请重新打开 Cowrite 画布后重试'))
    }, 120_000)

    function onMessage(event: MessageEvent) {
      if (!isTrustedTaskResult(
        event,
        window.parent,
        parent.origin,
        requestId,
        parent.token,
      )) return
      const result = event.data
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      if (result.ok) resolve(result.value)
      else reject(new Error(result.error || 'Codex 拒绝了发送请求'))
    }

    window.addEventListener('message', onMessage)
      window.parent.postMessage({
        type: SEND_REQUEST,
        requestId,
        message,
        bridgeToken: parent.token,
      }, parent.origin)
    })
  }
}

export type AgentTaskResult = 'sent' | 'copied'

/**
 * Ask the Codex host to show its native follow-up confirmation dialog.
 * A standalone browser cannot reach a Codex task, so it offers an explicit
 * clipboard fallback instead of pretending that the task was sent.
 */
export async function sendAgentTask(command: string): Promise<AgentTaskResult> {
  const prompt = command.trim()
  if (!prompt) throw new Error('任务内容为空，无法发送')

  const sender = directSender() || framedSender()
  if (sender) {
    await sender({ prompt, content: [{ type: 'text', text: prompt }] })
    return 'sent'
  }

  const shouldCopy = window.confirm('当前 Cowrite 在普通浏览器中运行，无法直接连接 Codex。是否复制任务，回到 Codex 后粘贴发送？')
  if (!shouldCopy) throw new DOMException('用户取消发送', 'AbortError')
  await navigator.clipboard.writeText(prompt)
  return 'copied'
}

export function isTaskCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
