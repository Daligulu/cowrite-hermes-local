import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { registerCowriteWidget } from './widget.js'

const baseUrl = process.env.COWRITE_URL || 'http://127.0.0.1:4320'
let sessionTokenPromise: Promise<string> | undefined

async function sessionToken(): Promise<string> {
  sessionTokenPromise ??= fetch(`${baseUrl}/api/session`)
    .then(async (response) => {
      const data = await response.json() as { token?: string; error?: string }
      if (!response.ok || !data.token) {
        throw new Error(data.error || 'Cowrite session is unavailable')
      }
      return data.token
    })
    .catch((error) => {
      sessionTokenPromise = undefined
      throw error
    })
  return sessionTokenPromise
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const isMutation = options?.method
    && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())
  const send = async () => fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(isMutation ? { 'X-Cowrite-Token': await sessionToken() } : {}),
      ...(options?.headers ?? {}),
    },
  })
  let response = await send()
  if (isMutation && response.status === 403) {
    sessionTokenPromise = undefined
    response = await send()
  }
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || `Cowrite returned HTTP ${response.status}`)
  return data
}

function toolResult<T extends object>(value: T) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  }
}

export function createCowriteMcpServer() {
  const server = new McpServer(
    { name: 'cowrite-mcp-server', version: '0.14.0-hermes.1' },
    {
      instructions: 'Use Cowrite page tools for revision-safe reads and writes. For queued content-production jobs, atomically claim a task, load each recommended Hermes Skill with skill_view, perform and verify the real work, then complete or fail the task honestly. cowrite_open_canvas is optional because Hermes users normally open the browser workspace URL.',
    },
  )

  registerCowriteWidget(server, baseUrl)

  server.registerTool(
    'cowrite_get_status',
    {
      title: 'Get Cowrite status and canvas URL',
      description: 'Check that the local Cowrite service is ready and return the browser canvas URL. Use when the user asks to start, open, or locate Cowrite.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => toolResult({ ...(await api<Record<string, unknown>>('/api/health')), canvasUrl: baseUrl }),
  )

  server.registerTool(
    'cowrite_list_pages',
    {
      title: 'List Cowrite pages',
      description: 'List all pages in the local Cowrite writing canvas (id, title, optional creation prompt, revision, timestamps; content omitted). Pages with a prompt and low revision are usually waiting for the agent to write them. Use this to find valid page IDs before reading or editing.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const pages = await api<Record<string, unknown>[]>('/api/pages')
      return toolResult({ total: pages.length, pages })
    },
  )

  server.registerTool(
    'cowrite_get_page',
    {
      title: 'Get one Cowrite page',
      description: 'Read a page including its full Markdown content, creation prompt, and current revision. Always call this immediately before cowrite_update_page: the returned revision is required to write safely.',
      inputSchema: { page_id: z.string().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ page_id }) => toolResult(await api<Record<string, unknown>>(`/api/pages/${encodeURIComponent(page_id)}`)),
  )

  server.registerTool(
    'cowrite_create_page',
    {
      title: 'Create a Cowrite page',
      description: 'Create a new page in the Cowrite canvas. Use when the user asks to create an article or document in Cowrite. Write the finished Markdown into content directly; the user sees it in the browser editor immediately.',
      inputSchema: {
        title: z.string().min(1).max(300),
        content: z.string().max(500_000).default('').describe('Markdown content'),
        prompt: z.string().max(5000).optional().describe('Optional: the creation brief this page was written from'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => toolResult(await api<Record<string, unknown>>('/api/pages', { method: 'POST', body: JSON.stringify(input) })),
  )

  server.registerTool(
    'cowrite_update_page',
    {
      title: 'Update a Cowrite page',
      description: 'Update a page title or Markdown content. Content updates use optimistic concurrency: pass the revision from cowrite_get_page as expected_revision. On a revision conflict, read the page again and merge with the latest content instead of overwriting human edits.',
      inputSchema: {
        page_id: z.string().min(1),
        title: z.string().max(300).optional(),
        content: z.string().max(500_000).optional().describe('Complete replacement Markdown content'),
        expected_revision: z.number().int().positive().optional().describe('Required when content is provided'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ page_id, expected_revision, ...patch }) => toolResult(await api<Record<string, unknown>>(`/api/pages/${encodeURIComponent(page_id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...patch, ...(expected_revision !== undefined ? { expectedRevision: expected_revision } : {}) }),
    })),
  )

  server.registerTool(
    'cowrite_upload_asset',
    {
      title: 'Upload a local asset to Cowrite',
      description: 'Copy a local image, self-contained HTML, PPTX, or PDF into Cowrite\'s asset store. Returns a /assets/... url that can be embedded or linked in page content. Use after generating an illustration, explainer, or slide deck locally.',
      inputSchema: { path: z.string().min(1).describe('Absolute path to the local file') },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ path }) => toolResult(await api<Record<string, unknown>>('/api/assets', { method: 'POST', body: JSON.stringify({ path }) })),
  )

  server.registerTool(
    'cowrite_insert_after',
    {
      title: 'Insert a block after anchor text',
      description: 'Insert a Markdown block (e.g. an image ![..](/assets/x.png) or an <iframe> for an HTML explainer) right after the paragraph that contains the anchor text. The anchor must be an exact substring of the current page content; read the page first. Requires expected_revision. Use this to place illustrations at the position the user selected, without touching the rest of the page.',
      inputSchema: {
        page_id: z.string().min(1),
        anchor: z.string().min(1).max(2000).describe('Exact substring of the current content marking the insertion point'),
        markdown: z.string().min(1).max(100_000).describe('The block to insert (Markdown or a single HTML block)'),
        expected_revision: z.number().int().positive(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ page_id, anchor, markdown, expected_revision }) => toolResult(await api<Record<string, unknown>>(`/api/pages/${encodeURIComponent(page_id)}/insert`, {
      method: 'POST',
      body: JSON.stringify({ anchor, markdown, expectedRevision: expected_revision }),
    })),
  )

  server.registerTool(
    'cowrite_list_tasks',
    {
      title: 'List Cowrite Hermes tasks',
      description: 'List queued/running/completed Cowrite content-production tasks. Task records contain references, not full page content; read the referenced page only after claiming.',
      inputSchema: { status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']).optional() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ status }) => {
      const query = status ? `?status=${encodeURIComponent(status)}` : ''
      const tasks = await api<Record<string, unknown>[]>(`/api/tasks${query}`)
      return toolResult({ total: tasks.length, tasks })
    },
  )

  server.registerTool(
    'cowrite_get_task',
    {
      title: 'Get a Cowrite Hermes task',
      description: 'Read one task by ID. Then load every recommended skill with skill_view(name) before executing it.',
      inputSchema: { task_id: z.string().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ task_id }) => toolResult(await api<Record<string, unknown>>(`/api/tasks/${encodeURIComponent(task_id)}`)),
  )

  server.registerTool(
    'cowrite_claim_task',
    {
      title: 'Atomically claim a Cowrite task',
      description: 'Atomically claim a queued task. Pass task_id, or omit it to claim the oldest queued task. A null task means no work is available.',
      inputSchema: { task_id: z.string().min(1).optional(), worker_id: z.string().min(1).max(200).default('hermes-agent') },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ task_id, worker_id }) => {
      if (task_id) return toolResult(await api<Record<string, unknown>>(`/api/tasks/${encodeURIComponent(task_id)}/claim`, { method: 'POST', body: JSON.stringify({ workerId: worker_id }) }))
      return toolResult(await api<Record<string, unknown>>('/api/tasks/claim-next', { method: 'POST', body: JSON.stringify({ workerId: worker_id }) }))
    },
  )

  server.registerTool(
    'cowrite_complete_task',
    {
      title: 'Complete a Cowrite task',
      description: 'Mark a claimed task succeeded after all requested artifacts were really created and verified.',
      inputSchema: { task_id: z.string().min(1), message: z.string().min(1).max(20_000), assets: z.array(z.string().max(4000)).max(100).optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ task_id, message, assets }) => toolResult(await api<Record<string, unknown>>(`/api/tasks/${encodeURIComponent(task_id)}/complete`, { method: 'POST', body: JSON.stringify({ message, assets }) })),
  )

  server.registerTool(
    'cowrite_fail_task',
    {
      title: 'Fail a Cowrite task',
      description: 'Mark a claimed task failed with the real error or blocker. Never fabricate success.',
      inputSchema: { task_id: z.string().min(1), error: z.string().min(1).max(20_000) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ task_id, error }) => toolResult(await api<Record<string, unknown>>(`/api/tasks/${encodeURIComponent(task_id)}/fail`, { method: 'POST', body: JSON.stringify({ error }) })),
  )

  server.registerTool(
    'cowrite_cancel_task',
    {
      title: 'Cancel a Cowrite task',
      description: 'Cancel a queued or running task. Queued tasks stop immediately; running tasks are marked cancelled so their worker must stop and must not write results back.',
      inputSchema: { task_id: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ task_id }) => toolResult(await api<Record<string, unknown>>(`/api/tasks/${encodeURIComponent(task_id)}/cancel`, { method: 'POST' })),
  )

  server.registerTool(
    'cowrite_retry_task',
    {
      title: 'Retry a failed or cancelled Cowrite task',
      description: 'Re-queue a failed or cancelled task so the worker executes it again.',
      inputSchema: { task_id: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ task_id }) => toolResult(await api<Record<string, unknown>>(`/api/tasks/${encodeURIComponent(task_id)}/retry`, { method: 'POST' })),
  )

  server.registerTool(
    'cowrite_move_task_to_front',
    {
      title: 'Move a queued Cowrite task to the front of the queue',
      description: 'Prioritize a queued task so it is claimed before other normal/low tasks. Only queued tasks can be moved.',
      inputSchema: { task_id: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ task_id }) => toolResult(await api<Record<string, unknown>>(`/api/tasks/${encodeURIComponent(task_id)}/move-to-front`, { method: 'POST' })),
  )

  server.registerTool(
    'cowrite_set_task_priority',
    {
      title: 'Set a queued Cowrite task priority',
      description: "Set a queued task's priority to high, normal, or low. High priority tasks are claimed first.",
      inputSchema: { task_id: z.string().min(1), priority: z.enum(['high', 'normal', 'low']) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ task_id, priority }) => toolResult(await api<Record<string, unknown>>(`/api/tasks/${encodeURIComponent(task_id)}/priority`, { method: 'POST', body: JSON.stringify({ priority }) })),
  )

  server.registerTool(
    'cowrite_recover_tasks',
    {
      title: 'Recover expired Cowrite task leases',
      description: 'Re-queue running tasks whose lease expired (worker died or timed out). Returns counts of recovered and failed tasks.',
      inputSchema: {},
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => toolResult(await api<Record<string, unknown>>('/api/tasks/recover', { method: 'POST' })),
  )

  server.registerTool(
    'cowrite_worker_status',
    {
      title: 'Cowrite worker health status',
      description: 'Read the latest Cowrite worker run result, including last error and whether the backend is healthy. Use this before claiming tasks when the queue seems stuck.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => toolResult(await api<Record<string, unknown>>('/api/worker/status')),
  )

  return server
}

async function main() {
  const server = createCowriteMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
