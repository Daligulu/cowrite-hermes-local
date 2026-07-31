let sessionTokenPromise: Promise<string> | undefined

async function loadSessionToken(): Promise<string> {
  const response = await fetch('/api/session')
  const result = await response.json() as { token?: string; error?: string }
  if (!response.ok || !result.token) {
    throw new Error(result.error || '无法建立 Cowrite 本地会话')
  }
  return result.token
}

async function sessionToken(): Promise<string> {
  sessionTokenPromise ??= loadSessionToken().catch((error) => {
    sessionTokenPromise = undefined
    throw error
  })
  return sessionTokenPromise
}

function isMutation(method = 'GET'): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}

export async function cowriteFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (!isMutation(init.method)) return fetch(input, init)

  const send = async () => {
    const headers = new Headers(init.headers)
    headers.set('X-Cowrite-Token', await sessionToken())
    return fetch(input, { ...init, headers })
  }

  let response = await send()
  if (response.status === 403) {
    sessionTokenPromise = undefined
    response = await send()
  }
  return response
}
