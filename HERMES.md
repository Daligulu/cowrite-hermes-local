# Cowrite for Hermes

This fork turns Cowrite into a Hermes-native local content workspace.

## Adaptation

- Hermes Skill source scans `COWRITE_HERMES_HOME/skills` recursively, including categorized and symlinked Skills.
- Hermes Skills are read-only in the UI and API.
- UI actions create durable tasks instead of invoking the Codex browser bridge.
- Task routing: `humanizer-zh`, `apiyi-image-generation`/`feng-ip`, `dashiai-ppt`, `wewrite`, `baoyu-xhs-images`, `lark-doc`, `feng-knowledge-base`, `feng-video`.
- MCP exposes task list/get/claim/complete/fail tools.
- Production project access requires `COWRITE_ALLOWED_PROJECT_ROOTS`.
- Vite output and API calls support a reverse-proxy subpath.

## Production environment

`/etc/cowrite-hermes.env` (mode 0600):

```ini
PORT=4320
COWRITE_HERMES_HOME=/root/.hermes
COWRITE_ALLOWED_PROJECT_ROOTS=/root/Documents/Obsidian Vault
COWRITE_PUBLIC_BASE_PATH=/replace-with-random-path/
```

Keep Cowrite bound to `127.0.0.1`; publish only through the Nginx high-entropy path. Do not commit the real path.

## Hermes task worker

Configure this MCP server and restart the Hermes gateway:

```yaml
mcp_servers:
  cowrite:
    command: node
    args: [/opt/cowrite-hermes/dist-mcp/index.js]
    env:
      COWRITE_BASE_URL: http://127.0.0.1:4320
```

A Hermes cron worker can atomically claim the oldest queued task, load every `recommendedSkills` entry with `skill_view`, execute the real workflow, verify artifacts, and call `cowrite_complete_task` or `cowrite_fail_task`.

## Verification

```bash
npm ci
npm test -- --run
npm run build
curl -fsS http://127.0.0.1:4320/api/status
```
