import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCowriteMcpServer } from '../mcp/index.js'

describe('Cowrite MCP App canvas', () => {
  const server = createCowriteMcpServer()
  const client = new Client({ name: 'cowrite-widget-test', version: '1.0.0' })

  beforeEach(async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify(Object.fromEntries([['token', 'bridge-session-fixture']])),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await client.close()
    await server.close()
  })

  it('publishes a native canvas tool and self-contained widget resource', async () => {
    const tools = await client.listTools()
    const openTool = tools.tools.find((tool) => tool.name === 'cowrite_open_canvas')
    expect(openTool?._meta?.['openai/outputTemplate']).toBe('ui://widget/cowrite/canvas.html')

    const resources = await client.listResources()
    expect(resources.resources.some((resource) => resource.uri === 'ui://widget/cowrite/canvas.html')).toBe(true)

    const resource = await client.readResource({ uri: 'ui://widget/cowrite/canvas.html' })
    const html = resource.contents[0]
    expect(html).toMatchObject({ mimeType: 'text/html;profile=mcp-app' })
    expect('text' in html && html.text).toContain('cowrite:send-task')
    expect('text' in html && html.text).toContain('cowrite:bridge-ready')
    expect('text' in html && html.text).toContain('bridge-session-fixture')
    if ('text' in html && html.text) {
      expect(html.text.indexOf('window.addEventListener("message"'))
        .toBeLessThan(html.text.indexOf('const canvasFrame = document.querySelector("iframe")'))
    }
    expect('text' in html && html.text).toContain('http://127.0.0.1:4320/')
    expect('text' in html && html.text).not.toMatch(/<script[^>]+src=/)
  })
})
