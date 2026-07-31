import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const require = createRequire(import.meta.url)

export const COWRITE_WIDGET_URI = 'ui://widget/cowrite/canvas.html'

function widgetMetadata(frameOrigin: string) {
  return {
    ui: {
      prefersBorder: false,
      csp: {
        connectDomains: [frameOrigin],
        resourceDomains: [frameOrigin],
        frameDomains: [frameOrigin],
      },
    },
    'openai/widgetDescription': 'Cowrite 本地写作画布，可直接把页面任务发送到当前 Codex 对话。',
    'openai/widgetPrefersBorder': false,
    'openai/widgetCSP': {
      connect_domains: [frameOrigin],
      resource_domains: [frameOrigin],
      frame_domains: [frameOrigin],
    },
  }
}

function parseExportMap(body: string) {
  const result = new Map<string, string>()
  for (const rawEntry of body.split(',')) {
    const parts = rawEntry.trim().split(/\s+as\s+/)
    const local = parts[0]?.trim()
    const exported = (parts[1] || parts[0])?.trim()
    if (local && exported) result.set(exported, local)
  }
  return result
}

function mcpAppsBundle() {
  const sourcePath = require.resolve('@modelcontextprotocol/ext-apps/app-with-deps')
  const source = readFileSync(sourcePath, 'utf8')
  const exportStart = source.lastIndexOf('export{')
  if (exportStart === -1) throw new Error('无法读取 MCP Apps 浏览器运行时')
  const exportBlock = source.slice(exportStart).match(/^export\{([^}]+)\};?\s*$/s)
  if (!exportBlock) throw new Error('无法解析 MCP Apps 浏览器运行时')
  const exports = parseExportMap(exportBlock[1])
  const app = exports.get('App')
  if (!app) throw new Error('MCP Apps 浏览器运行时缺少 App 导出')
  return `${source.slice(0, exportStart)};globalThis.__COWRITE_MCP_APPS__={App:${app}};`
}

function escapeInlineScript(source: string) {
  return source.replaceAll('</script', '<\\/script').replaceAll('</SCRIPT', '<\\/SCRIPT')
}

async function widgetHtml(baseUrl: string) {
  const origin = new URL(baseUrl).origin
  const canvasUrl = new URL('/', baseUrl).toString()
  const sessionResponse = await fetch(new URL('/api/bridge-session', baseUrl))
  const session = await sessionResponse.json() as { token?: string; error?: string }
  if (!sessionResponse.ok || !session.token) {
    throw new Error(session.error || '无法建立 Cowrite 画布桥接会话')
  }
  const bridge = `(() => {
  "use strict";
  const App = globalThis.__COWRITE_MCP_APPS__?.App;
  if (typeof App !== "function") return;

  const frameOrigin = ${JSON.stringify(origin)};
  const bridgeToken = ${JSON.stringify(session.token)};
  const app = new App(
    { name: "cowrite", version: "0.13.0" },
    { availableDisplayModes: ["inline", "fullscreen"] },
    { autoResize: false },
  );

  async function sendResult(target, requestId, payload) {
    target?.postMessage({
      type: "cowrite:send-task-result",
      requestId,
      bridgeToken,
      ...payload,
    }, frameOrigin);
  }

  window.addEventListener("message", async (event) => {
    const request = event.data;
    const canvasFrame = document.querySelector("iframe");
    if (event.origin !== frameOrigin || event.source !== canvasFrame?.contentWindow) return;
    if (request?.type === "cowrite:bridge-ready") {
      event.source?.postMessage({ type: "cowrite:host-ready", bridgeToken }, frameOrigin);
      return;
    }
    if (request?.type !== "cowrite:send-task"
      || request.bridgeToken !== bridgeToken
      || !request.requestId) return;
    try {
      await app.ready;
      const prompt = String(request.message?.prompt || "").trim();
      if (!prompt) throw new Error("任务内容为空，无法发送");
      const content = Array.isArray(request.message?.content)
        ? request.message.content
        : [{ type: "text", text: prompt }];
      const value = await app.sendMessage({ role: "user", content });
      if (value?.isError) throw new Error("Codex 拒绝了发送请求");
      await sendResult(event.source, request.requestId, { ok: true, value: value || {} });
    } catch (error) {
      await sendResult(event.source, request.requestId, {
        ok: false,
        error: error instanceof Error ? error.message : String(error || "任务发送失败"),
      });
    }
  });

  app.ready = app.connect().then(async () => {
    if (typeof app.requestDisplayMode === "function") {
      await app.requestDisplayMode({ mode: "fullscreen" }).catch(() => {});
    }
  });
  globalThis.__COWRITE_MCP_APP__ = app;
})();`

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cowrite</title>
    <style>
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #fff; }
      iframe { width: 100%; height: 100%; border: 0; display: block; background: #fff; }
    </style>
    <script>${escapeInlineScript(mcpAppsBundle())}</script>
    <script>${escapeInlineScript(bridge)}</script>
  </head>
  <body><iframe src=${JSON.stringify(canvasUrl)} title="Cowrite 写作画布"></iframe></body>
</html>`
}

export function registerCowriteWidget(server: McpServer, baseUrl: string) {
  const frameOrigin = new URL(baseUrl).origin
  const metadata = widgetMetadata(frameOrigin)

  registerAppResource(
    server,
    'cowrite-canvas-widget',
    COWRITE_WIDGET_URI,
    {
      title: 'Cowrite Canvas',
      description: '在 Codex 内打开 Cowrite 本地写作画布。',
      _meta: metadata,
    },
    async () => ({
      contents: [{
        uri: COWRITE_WIDGET_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await widgetHtml(baseUrl),
        _meta: metadata,
      }],
    }),
  )

  registerAppTool(
    server,
    'cowrite_open_canvas',
    {
      title: 'Open Cowrite canvas in Codex',
      description: 'Open Cowrite as a native Codex canvas. Use this when the user asks to start, open, show, or use Cowrite; task buttons can then send prompts to the current Codex conversation after native confirmation.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: COWRITE_WIDGET_URI, visibility: ['model', 'app'] },
        'ui/resourceUri': COWRITE_WIDGET_URI,
        'openai/outputTemplate': COWRITE_WIDGET_URI,
        'openai/widgetAccessible': true,
        'openai/toolInvocation/invoking': '正在打开 Cowrite…',
        'openai/toolInvocation/invoked': 'Cowrite 已打开',
      },
    },
    async () => ({
      content: [{ type: 'text', text: 'Cowrite canvas opened inside Codex.' }],
      structuredContent: { canvasUrl: baseUrl, rendering: 'native-widget' },
      _meta: {
        'openai/outputTemplate': COWRITE_WIDGET_URI,
        widgetData: { canvasUrl: baseUrl, rendering: 'native-widget' },
      },
    }),
  )
}
