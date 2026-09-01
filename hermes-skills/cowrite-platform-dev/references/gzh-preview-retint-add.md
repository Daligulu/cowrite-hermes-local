# 编辑页「预览」按钮 + gzh-retint 按主题换色（2026-08-29 落地，commit 00aab7f）

## 需求
① 编辑页顶部加「预览」按钮，直开当前页 gzh HTML 产物预览（**只读+复制，无微调面板**），不单独生成预览页文件。
② 把 retint 换色接进动作配置（「按主题换色」动作，Worker 排版后按指定新主色 retint 一次）。

## 实现链路
- `server/gzhPreview.ts`（新文件）：
  - `extractTopSection(content)`：从页面 content 提取**顶层第一个 `<section>`**（平衡计数 `</?section\b[^>]*>` 含嵌套，depth 归零即止）。页面 content 直接存完整 gzh `<section>` 产物（无 markdown 包裹），所以预览 = 取顶层 section + 只读模板包壳。
  - `renderGzhPreview(content, title)`：顶层 section 写临时文件 → spawn `wrap_preview.py --readonly` → 读回完整 HTML 字符串；临时目录用 `mkdtemp` + finally 清理。
- `server/app.ts`：`GET /api/pages/:id/gzh-preview` 返回 `text/html`；无 section 时 422 `{error}`。GET 免 token，可放 token middleware 前。
- `src/App.tsx` Editor：工具栏加「预览」按钮（`.editor-toolbar-preview`）→ `openPreview()` fetch 端点 → 模态 iframe `srcDoc={html}`（`sandbox="allow-same-origin allow-scripts allow-clipboard-write"`）；loading/error/body 三态。
- `gzh-design`（skill 侧）：`wrap_preview.py` 加 `--readonly`；`preview-template.html` 加 `{{READONLY}}` 开关 —— READONLY=1 时 JS 隐藏「微调」按钮+面板、跳过微调初始化，**只保留「复制到公众号」按钮**（粘贴加固双格式逻辑仍在）。
- `server/actionConfig.ts` DEFAULT_ACTIONS +1 **`gzh-retint`「按主题换色」**（skills=[gzh-design]）；默认动作 19→20。
- 生产 action-config.json **API merge**：GET `/api/session` 取 token → GET `/api/action-config` → 幂等 append → PUT `{version,actions}`（无 config 包装）→ 读回断言。

## 验收（全部实测通过）
- npm test 133/133、`tsc -b`、`npm run build`。
- CDP 生产 UI 端到端：点 `.home-row` 进编辑页 → 点「预览」→ 模态 `modal=true`、iframe `srcDocReadonly=true`、`tuneHidden=true`、复制按钮在。
- retint 真实产物：摸鱼绿 `#059669`→蓝 `#2F5BEA`（green 族残留 0、新蓝 15 处、validate_gzh_html 完全合规）。

## 坑
- **`extractTopSection` 正则必须吃进 `>`**：用 `/<\/?section\b[^>]*>/g`（开/闭都带 `[^>]*>`）。若用 `/<\/?section\b/g`，闭标签匹配到 `</section` 不含最后 `>`，切出的 section 末尾是 `</section`（不闭合）→ 平衡计数 87 开/86 闭、产物被截断。加 `[^>]*>` 后 87/87 正确。
- **预览按钮禁止用 emoji**：初始 `👁 预览` 违反用户「禁 emoji、飞书 WebView 渲染空白」的既有约定 → 改纯文字「预览」，与「排版」「配图」按钮风格一致。
- **CDP 验收点 `.home-row` 而非任意含标题元素**：首页最近页面列表项是 `.home-row` 按钮（`onClick=onOpenPage(id)`）。点任意标题字符串可能命中别的 DOM 而**不触发视图切换**，导致 `.editor-toolbar` 与模态 `getBoundingClientRect` 全为 0（`workspaceView !== 'page'` 时 `.page-workspace` 带 `.inactive` 隐藏态，DOM 在但 rect=0）。必须用 `.home-row` 精确选择并断言 `.page-workspace` className 不含 `inactive`。
- **后端 spawn python 需绝对路径**：`process.env.COWRITE_PYTHON || '/root/.hermes/hermes-agent/venv/bin/python3'`（服务以 root 运行，python3 在 Hermes venv）。`execFile` 自带数组参数、shell 不会吞 `#`（`--accent #2F5BEA` 的 `#` 在 python CLI 安全）；但**shell 命令行里必须 enquote `#` 或转义**。
- **patch TS 数组对象锚点易吞掉下一块的头部**：用 `},` 当锚点新增动作时，若 `old_string` 只到 `},` 不含下一块 `{ id:`，patch 会把下一块（如 xiaohongshu）的 `{ id/label/enabled/chip` 一起替换掉 → 该块语法残缺、tsc 大面积报 `',' expected`。**锚点必须带下一块的 `{ id: 'xxx'` 开头**，patch 后立即 `read_file` 回读确认相邻块头部完好。LSP/tsc 报的语法错若 `npm run build` 却通过，是编辑器缓存误报，以 `tsc -b` 为准。

## 相关
- git tag/branch：`pre-retint-preview-backup` / `backup/pre-retint-preview-20260829`；回滚点 commit `d8a5c42`。
- 一键回滚备份：`/root/.cowrite/backups/pre-retint-preview-20260828_204511/`（rollback.sh + prod-full.tar.gz + data-json.tar.gz + env）。
