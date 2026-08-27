---
name: cowrite-platform-dev
description: 使用当开发/调试/验收本地 Cowrite 内容工作台（SPA+Worker）。含部署、UI 约定、CDP 验收。
---

# Cowrite Platform Development

本地 Cowrite（上游 SpaceZephyr/cowrite 私有适配分支）是用户的内容工作台：页面编辑 + Hermes 任务队列（Worker 执行润色/配图/PPT/排版/发布）+ 项目工作区 + Skill 管理。本技能覆盖开发、部署、验收全过程。

## 项目地图
- 代码：`/root/.hermes/workspace/cowrite-hermes-local`（分支 hermes-local-impl；上游固定 commit `1f571c347a77de75a6db79451399792f6a9e2f28`，不跟 main）
- **GitHub 私有仓库**：`Daligulu/cowrite-hermes-local`（origin 可推，默认分支 hermes-local-impl，含 main=上游基线 / hermes-adaptation）
- **项目是 git worktree**：`.git` 是 gitfile（内容 `gitdir: /root/.hermes/workspace/cowrite-hermes/.git/worktrees/cowrite-hermes-local`），主仓库在 `cowrite-hermes`——影响 gh 仓库操作，见 Pitfalls
- 生产：`/opt/cowrite-hermes`（从 workspace fetch + reset 部署）
- 数据：`/root/.cowrite`（tasks.json 队列、assets/ 资产 0700）；环境变量 `/etc/cowrite-hermes.env`（需 sudo）
- 服务：`cowrite-hermes.service`（Web）、`cowrite-hermes-tunnel.service`（Cloudflare 隧道）、`cowrite-hermes-worker.timer`（每分钟 Worker）、`hermes-gateway.service`（cowrite MCP 19 工具）
- 入口：`http://107.150.109.152/cowrite-005b18defa8ef912057110b7fea94a266345918514fa1a4a/`（高熵子路径固定）；隧道备用 URL 重启会变，用 `journalctl -u cowrite-hermes-tunnel.service | grep trycloudflare` 提取；根路径不带子路径返回 nginx 默认页

## 前端结构（界面已按草图A重构 + 动作配置化）
- `src/App.tsx`：主组件；视图 `workspaceView: 'home' | 'page' | 'project' | 'skill-manager' | 'action-config' | 'tasks'`，默认 `'home'`（工作台首页）；侧边栏「⚙ 动作配置」入口单独成项
- `src/CommandBar.tsx`：唯一操作入口 = 命令栏（输入框 + 5 常用 chips + 更多展开 9 动作）+ 任务条（3s 轮询当前页面最新任务，可展开：移到队首/取消/重试/优先级）。**chips 点击只把动作名填入输入框（可继续追加要求），点「交给 Hermes」才提交**；chips/关键词/动作名全部从 `/api/action-config` 配置加载，不再导出 `ACTION_LABELS`（有依赖者须同步改，如 HomeWorkspace）
- `src/ActionConfigManager.tsx`：动作配置页（左侧动作列表可拖拽排序 + ↑↓ 兜底；右侧编辑 label/启停/chip/关键词/多 skills/多 prompts/工作流步骤；保存即热生效、恢复默认、试运行按钮）
- `src/HomeWorkspace.tsx`：工作台首页（快捷开始卡片 + 最近页面 + 最近任务，5s 轮询）
- `src/TaskCenter.tsx`：任务中心（状态筛选/详情/取消/重试/优先级/worker 状态；头部 ☰ 展开侧边栏）
- `src/SkillManager.tsx`、`src/ProjectWorkspace.tsx`；`shared/types.ts`（TaskAction=string 已放宽支持自定义动作、ActionConfig/ActionConfigFile/ActionPrompt/WorkflowStep、TaskStatus/CowriteTask/Page）
- 服务端：`server/app.ts`（pages CRUD、tasks 队列控制 API、projects/open、action-config API）、`server/taskStore.ts`（租约/取消/重试；**不再硬编码 ACTION_SKILLS**，create 时从 ActionConfigStore 读多 skills）、`server/actionConfig.ts`（zod schema + DEFAULT_ACTIONS + load/save/reset，损坏文件自动改名备份）、`deploy/scripts/cowrite-hermes-worker.py`（Worker：429 退避 30→480s×5、30 分钟租约、异常退出恢复上限 3 次；执行时先 GET /api/action-config 读 skills/prompts/workflow 再干活）

## 部署流水线（每次改完必走）
```
cd /root/.hermes/workspace/cowrite-hermes-local
npm test && npx tsc --noEmit && npm run build
git add -A && git commit -m '...' && git push origin hermes-local-impl   # origin=GitHub 私有仓库 Daligulu/cowrite-hermes-local（已配置）
cd /opt/cowrite-hermes
git fetch origin hermes-local-impl -q && git reset --hard origin/hermes-local-impl -q
npm run build && systemctl restart cowrite-hermes.service
sleep 2 && curl -fsS http://127.0.0.1:4320/api/health   # 期望 {"ok":true}
```
测试基线：125/125（vitest 17 files，含 action-config 单测 9 + API 6 + tasks 11 + channel-config 8 + style-config 7 + channel-style API 10 + topic-model 4）。改 UI 后必须跑 npm test + tsc + build 三连。

## 动作配置化（Action Config）架构
- 配置文件：`/root/.cowrite/action-config.json`（`COWRITE_ACTION_CONFIG` 或 `COWRITE_HOME` 下；不存在→返回内置默认；损坏→改名 `.corrupt-*` 备份再回默认）
- API（`/api/action-config`）：GET 读（免 token）；PUT 保存、POST /reset 恢复默认——**写操作必须在 token 校验 middleware 之后注册**，否则绕过鉴权；PUT body 由 `actionConfigFileSchema.parse` 校验（zod 400）
- 动作模型：`{id, label, enabled, chip, keywords[], skills[], prompts[{id,role,text}], workflow[{step:'load'|'process'|'verify'|'write', skill, prompt, input, output}]}`；默认 9 动作与旧硬编码映射一致（polish→humanizer-zh、slides→dashiai-ppt、feng-ip→feng-ip 等，完整默认见 references/action-config.md）
- 端到端：CommandBar 加载配置渲染 chips/关键词 → POST /api/tasks（action 任意字符串，z.string() 校验已放宽，不再 z.enum(TASK_ACTIONS)）→ taskStore.create 从配置读 skills 数组 → Worker GET /api/action-config 后按配置加载全部 skills/prompts/workflow 执行
- 用户已确认的 UI 决策：动作排序用可拖拽 + ↑↓ 兜底；「试运行」按钮用当前页面真实跑一次看效果（创建任务后记得清理/取消）

## Worker 信息检索路由（与 Hermes 现有 Web 路由一致）
Worker PROMPT（`deploy/scripts/cowrite-hermes-worker.py`）内嵌信息检索路由：任务 requirements 含 搜索/收集/寻找/调研/查资料/找资料/了解/汇总/整理信息 等意图时，必须按此路由取数再写回：
- a. 普通网页 / 通用知识 / 海外技术 / 英文资料 → `web_search` + `web_extract`（Hermes 原生 Web，**Tavily** 后端；config `web.backend: tavily`）
- b. 中文时效 / 政策 / 金融 / 汇率 / 国内公司动态 / 中文事实核查 / 用户说「豆包搜索」→ 加载 `research/byted-web-search`（**豆包**；默认 Custom，明确要全球网页/跨语言长摘要用 Global，要求只看权威用 `--auth-level 1`）
- c. 平台站内内容（小红书/知乎/微博/公众号/X/B站/YouTube/Reddit/V2EX/GitHub）→ 加载 `research/agent-reach` 按平台路由访问
- d. 动态页面（JS 渲染/需交互登录/抓不到正文）→ `browser`
- e. 已知 URL → 优先 `web_extract`，失败再 `browser`
- f. 检索资料写回页面时附来源链接；无法核实的信息标「不确定」
**关键事实：Hermes 有两套搜索后端**——Tavily（`web_search`/`web_extract` 主后端，`.env` 有 `TAVILY_API_KEY`）与豆包 byted-web-search（`.env` 有 `WEB_SEARCH_CUSTOM_API_KEY` + `WEB_SEARCH_GLOBAL_API_KEY`，已配好 key）。写路由规则/回答「Hermes 怎么搜索」时不要只写 Tavily 漏豆包（本会话用户纠正过）。完整规则、触发词与端到端验收脚本见 references/worker-info-retrieval.md

## 资产链接与飞书兼容（PPT/图片产物 404 的完整解法）
- **根因链**：Worker 任务写回页面的资产链接是相对路径 `/assets/xxx.pptx`；用户在子路径入口（`/cowrite-005b…/`）打开时相对链接解析到 nginx 根路径 → 404。叠加第二个坑：**资产可能落错目录**——服务 `COWRITE_ASSETS=/root/.cowrite/assets`，但 MCP/Worker 曾落盘到 `/opt/cowrite-hermes/data/assets`，express.static 找不到文件时走 SPA fallback 返回 index.html（HTTP 200 但 `content-type: text/html`、~544 字节）→ 用户"下载"到的是 HTML
- **修复**：①前端 markdown 层改写 `fixAssetLinks`（Editor 的 Vditor `value` 与 `setValue` 处）：`assetBase = \`${window.location.origin}${window.location.pathname.replace(/\/+$/, '/')}\``，正则 `/(\]\()\/assets\//g` → `](${assetBase}assets/`；任意入口（主站/隧道/飞书内）都正确，存储层仍保留相对路径。②文件必须落在正确 assets 目录，验证：
  ```
  curl -sI "http://107.150.109.152/cowrite-…/assets/xxx.pptx" | head -6
  # 期望：HTTP 200 + application/vnd…presentationml + 真实字节数（非 text/html）
  ```
- **Vditor/IR 模式无 DOM 锚点**：IR 渲染模式下链接以 markdown 文本渲染，`document.querySelectorAll('a')` 查不到锚点——这是「必须在 markdown 内容层断言/改写」的决定性约束；用 CDP evaluate 读 `.vditor-ir` 内文本正则断言
- **飞书内置 WebView（旧内核）兼容规范**：不用 Basic Auth；flex/grid `gap` 全量替换（flex 改相邻兄弟 margin、grid 加 `grid-gap` fallback）；`backdrop-filter` 必须套 `@supports`；按钮加 `flex: 0 0 auto` 防压缩；safe-area 双写（先普通 `padding-bottom` 再 `env(safe-area-inset-bottom)`）；`min()`/`calc()` 新语法谨慎验证。改布局后必须 390px CDP 断言无横向溢出（`documentElement.scrollWidth <= clientWidth`）

## UI 设计约定（用户确认的方向，移动端已落地 2026-08-17）
- 单一入口：内容操作只从命令栏发起，不要第二套按钮
- 任务可见：提交后任务条立即显示 排队→执行→完成/失败，可展开管理
- 移动优先（≤760px）：命令栏固定底部 + safe-area、按钮 ≥44px 触控、弹窗单列堆叠、无横向溢出
- 返回路径：非页面视图（任务/项目/Skill）点侧边栏「«」→ 回首页；页面编辑态点「«」→ 只收起侧边栏；任务中心头部 ☰ 可展开侧边栏；logo 也是首页入口
- 删除页面：DeletePageModal 展示关联排队/执行中任务数并警示，确认后先取消任务再删页
- 主按钮视觉：深蓝渐变 #16324f→#1e4d7c + ✦ 图标 + 悬停提亮/按下下沉/焦点 outline + 提交中转圈 spinner
- **移动端布局（已按确认样例实现，commit 7e2dfcf 起）**：≤760px 底部 MobileTabBar 5 Tab（工作台/任务/编辑/技能/配置，`App.tsx` 新增组件，编辑 Tab 无页面时弹新建窗）；首页 2×2 宫格（新增技能管理卡片，HomeWorkspace 增 `onOpenSkills` prop）；「更多动作」改 3 列底部弹层（`.command-more` fixed 于命令栏上方 58px）；任务筛选横滑（`.task-filters` nowrap + overflow-x auto）；命令栏上移避开 tabbar（`.editor-command` bottom calc(58px+safe-area)）；workspace 底部预留 tabbar 高度。完整改动与验收见 `references/mobile-ui-2026-08.md`；生产移动端 CDP 复验脚本 `scripts/mobile-verify.js`

## 微信贴图融入 Cowrite（2026-08-19 落地）

**需求**：命令栏「微信贴图」→ 弹窗选风格（5 预设+手动输入）→ Worker 搜主题内容 → 写 280-320 字文案 → ApiYi 3:4 出图 → 新建《贴图草稿·主题》页（可编辑）→ 「发布贴图」弹窗选账号 → publish_sticker.py --mode newspic 发微信草稿箱（不群发）→ 写回 media_id。

**实现**（commit 667f2c9）：
- server/wechatAccounts.ts：账号 CRUD store（zod schema、损坏文件备份、0600 权限、GET 打码 secretSet、PUT 留空保留旧值）
- /api/wechat-accounts：GET 免 token / PUT 需 token
- actionConfig.ts 默认动作 +2：wechat-sticker（3技能）、publish-sticker
- src/WechatAccountsPanel.tsx：动作配置页账号管理区块（新增/编辑/删除）
- CommandBar.tsx：提交拦截弹窗（style/account）；confirmStyle/confirmAccount 拼「风格：xxx」「账号：xxx」进 requirements
- **detectAction 改为按关键词长度取最长匹配**（修复「发布贴图」误命中「贴图」）
- publish_sticker.py 支持 --accounts-file（读 /root/.cowrite/wechat-accounts.json，优先于 .env）
- worker PROMPT 补 wechat-sticker/publish-sticker 执行规则

**坑**：
- detectAction 旧实现按数组顺序首个命中，短关键词会误吞长词
- publish-sticker 防误发：标题必须带「贴图草稿·」前缀，否则 fail 且不调微信 API（已实测：非贴图页发布被拒）
- 生产已有旧 action-config.json 时 reset 才带新动作；重启服务用 `systemctl restart cowrite-hermes.service`
- 验收用 browser_console 连点两个按钮会触发 React 18 批处理读到旧 state（分步点击才正常）

## 首页快捷卡片与「打开项目」现状（2026-08-20 调研，新需求开发前必读）
- 首页 `src/HomeWorkspace.tsx` 快捷开始卡片（`.home-card`）：从想法创作（primary）/ 导入文章 / 打开项目 / 技能管理；`onOpenProject` 进入 ProjectWorkspace；点击「从想法创作」= onNewPage
- `src/ProjectWorkspace.tsx` 本地项目功能完整：`chooseFolder()` → POST `/api/projects/open`（body `{directory?}`）→ LocalProject（tree + markdownFiles + warnings）→ FileTree 目录树 + ProjectEditor（Vditor，PATCH `/api/projects/:id/file` 带 expectedVersion 乐观并发保存回本地）；已有「输入绝对路径」兜底入口（manualPath）
- **「选择本地文件夹」坏因**：server/projectWorkspace.ts 用 `zenity --file-selection --directory` → kdialog → powershell 弹系统选择器；部署机是无图形界面的 headless Linux，zenity/kdialog 起不来 → 选择永远失败。修复方向 = 不再弹系统选择器，直接扫描预置默认目录
- **任务创建校验**：POST /api/tasks zod `.refine(v => v.pageId || v.projectPath, 'pageId or projectPath is required')`——无当前页面发起的任务（如首页发起选题）需放宽该校验或传占位；taskStore.create 本身不要求 pageId
- 已锁定决策（2026-08-20 grill 确认后已开发落地，见下方「首页开始选题入口 + 本地项目文件夹」）：
  - 默认项目目录 `/root/.cowrite/projects`（服务端可配置）；点击「选择本地文件夹」直接打开该目录，不再弹系统选择器；保留「输入绝对路径」入口；已有 Cowrite 页面草稿一次性导出为 .md 放入该目录（初始化，不做持续双向同步）
  - 首页新增「开始选题」卡片，放「从想法创作」右侧（顺序：从想法创作 → 开始选题 → 导入文章 → 打开项目 → 技能管理）；点击直接弹选题窗（与命令栏 topic-collect 弹窗一致，建议把选题弹窗抽为公共组件复用）
- CDP 给用户演示 UI 路径（区别于验收）：headless chrome + CDP `Runtime.evaluate` 按"用户会怎么点"分步交互（点 chip → 等弹窗 → 截图）→ `Page.captureScreenshot` 出 PNG → 回复里 `MEDIA:/tmp/xxx.png` 逐张配说明；桌面视口 1280×900 演示更清晰，验收用 390×844 移动端

## 写作前选题功能（2026-08-20 落地）

**需求**：命令栏「选题」→ 弹窗选渠道（多选，缺省全选：obsidian/ima/aihot 可配置）+ 创作类型（文章/贴图）+ 文字要求 → topic-collect 任务按渠道收集产出 3-5 候选 → 新建《选题·xxx》页（约定格式）→ 页面内 TopicConfirmPanel 候选卡片多选 → 确认弹窗按类型选风格（文章=写作/排版/配图；贴图=文案/视觉，无排版）+ 补充要求 → 每个选题创建 1 个 topic-create 任务 → Worker 检索素材→写作→配图→排版 → 新建《草稿·标题》或《贴图草稿·标题》页。

**实现**：
- `server/channelConfig.ts`（ChannelConfigStore：zod schema、损坏备份、`enabledChannels()`/`channelById()`）、`server/styleConfig.ts`（StyleConfigStore：writing/layout/image 三类预设）
- API：GET `/api/channel-config`、`/api/style-config`（免 token）；PUT + POST /reset（token 后）
- actionConfig.ts 默认动作 +2：topic-collect（skills obsidian/ima/aihot）、topic-create（humanizer-zh + apiyi-image-generation）
- `src/topicModel.ts`：parseTopicCandidates（纯函数，解析 `## 候选 N：标题` + `- 亮点：`/`- 渠道：`/`- 推荐风格：` 块）
- `src/TopicConfirmPanel.tsx`：选题页（标题以「选题·」开头）顶部确认面板，App.tsx 在 EditorCommandBar 后、Editor 前挂载
- CommandBar.tsx：`openTopicChoice` 弹窗（渠道多选、类型切换、要求输入），submit 时 `chosen === 'topic-collect' && !req.includes('渠道')` 触发
- Worker PROMPT：topic-collect（渠道收集规则 + 候选页约定格式）、topic-create（requirements 解析 + 创作流程 + 非法字符清洗）

**坑（实操踩过）**：
- **/api/style-config 响应结构是 `{config:{version, styles:{writing,layout,image}}}`**，组件读 `data.config.styles` 而不是 `data.config`；读错时 `styles.writing` undefined → 渲染时 `group.presets.map` 抛 `Cannot read properties of undefined (reading 'map')` → React 渲染崩溃 → **整个面板/页面 unmount（表现为按钮点击无响应、面板消失）**。排查：CDP `Runtime.enable` + `Runtime.exceptionThrown` 捕获 JS 异常定位
- **生产旧 action-config.json 不自动带新默认动作**：部署后 topic-collect/topic-create 需手动 merge（GET → 追加 → PUT，带 token）或 reset；本次生产配置无用户自定义，直接 API merge 成功
- Worker 领取任务有 ~1 分钟延迟（timer 每分钟 tick），验收轮询要容忍 queued→running 的间隔

## 选题渠道配置增改（2026-08-20 落地）

选题渠道存 `GET/PUT /api/channel-config`，前端弹窗自动读取，worker `topic-collect` 按 `requirements` 中「渠道：id1,id2」与渠道 `params.vaultPath` 真实调取素材。

**PUT body 格式坑**：GET 返回 `{config:{version,channels}}`，但 PUT body **直接传 `{version,channels}`**（无 config 包装），否则 400（`channelConfigFileSchema.parse(request.body)`）。

**新增渠道流程**（幂等，先查后合并不覆盖）：
1. GET `/api/channel-config`（带 token）→ 合并新渠道条目（id/label/type/enabled/description/params）
2. PUT `{version:1, channels:[...]}`（带 x-cowrite-token）
3. 端到端验证：POST `/api/tasks` 创建 `topic-collect`，requirements 写「渠道：新渠道id；类型：文章；要求：xxx」，轮询 `/api/tasks` 到 **status=succeeded**（状态名是 `succeeded` 不是 completed/failed/cancelled），读任务 `result.message`/`result.assets` 拿 pageId，抽查页面 content 中的「来源：/root/...」路径确认来自目标 vault

**发现本地 Obsidian 仓库**：
```bash
find /root /home /srv /mnt /data /media -maxdepth 6 -name ".obsidian" -type d 2>/dev/null | sed 's|/.obsidian$||'
```
再对每个目录 `find "$v" -name "*.md" -type f | wc -l` + `du -sh`。备份/verify 副本（如 ~/.hermes/verify、obsidian-backups）不建议接入。

2026-08-20 现状：5 渠道 = obsidian(主库638md) / ima / aihot / obsidian-kb(峰的知识库37md) / obsidian-suishou(随手笔记37md)。

## 首页开始选题入口 + 本地项目文件夹（2026-08-20 落地）

**需求 1**：首页新增「开始选题」卡片（与「从想法创作」并列右侧），点击直接弹出选题配置窗。
- 抽取 `src/TopicCollectModal.tsx` 公共组件（渠道加载/类型/要求/提交），CommandBar 与 HomeWorkspace 共用
- 任务校验放宽：`POST /api/tasks` refine 允许 `action === 'topic-collect'` 无 pageId/projectPath（首页发起无当前页面）
- 提交带 `delivery: 'cowrite'`

**需求 2**：修复「打开项目 → 选择本地文件夹」——headless 服务器 zenity/kdialog 起不来导致坏。
- `server/projectWorkspace.ts`：新增 `resolveDefaultProjectsRoot()`（COWRITE_PROJECTS_ROOT || COWRITE_HOME/projects）；`openProject()` 不传 directory 时用默认根目录（不再调系统选择器）；显式目录才按 COWRITE_ALLOWED_PROJECT_ROOTS 校验，默认根始终允许
- `server/exportPages.ts`：`sanitizeTitle`（清洗非法字符/截 80）+ `exportPagesToDrafts` 一次性导出页面为 md（`<!-- cowrite-page: id -->` 头 + 重名加 -2 后缀）；测试用 tsx 脚本通过 API 拉页面再导出
- 生产 .env 有 COWRITE_ALLOWED_PROJECT_ROOTS=/root/Documents/Obsidian Vault，不影响默认目录

**验收**：CDP 实测首页 5 卡顺序（从想法创作→开始选题→…）、弹窗 3 渠道、打开项目显示草稿目录 + 9 md、Vditor 编辑自动保存回写本地（execCommand insertText 触发 input 回调）、430px 无溢出。133/133 测试。

**坑**：Vditor IR 模式编辑区是 `.vditor-ir pre.vditor-reset[contenteditable]`；CDP 模拟输入用 `el.focus()` + `document.execCommand('insertText', false, text)` 才能触发 input 回调；CDP evaluate 返回在 `msg.result.result.value`（多一层嵌套）；headless 连接用 /json/list 的 page target（/json/version 是 browser target 不支持 Runtime.evaluate）；**生产一次性导出脚本用 `npx tsx /tmp/x.ts` 时，/tmp 没有 package.json 的 type:module → 走 CJS 模式不支持顶层 await（Transform failed with 7 errors），必须包 `async function main(){} void main()`**；导出脚本套路 = `/api/session` 取 token → GET /api/pages → 逐个 GET /api/pages/:id 拿 content → `exportPagesToDrafts(pages, '/root/.cowrite/projects/草稿')`

**渠道可用性核查（用户问「渠道配好没 / 能不能取数」时）**：① `curl -fsS http://127.0.0.1:4320/api/channel-config` 看 3 渠道 enabled；② 逐渠道实探——Obsidian：`find "/root/Documents/Obsidian Vault" -name '*.md' | wc -l`（638）；IMA：`node ~/.hermes/skills/productivity/ima/ima_api.cjs openapi/note/v1/list_note '{"folder_id":"","sort_type":0,"cursor":"","limit":5}' '{"clientId":"","apiKey":""}'`，**笔记列表字段是 `data.note_book_list`（不是 notes/items），is_end 表示是否有下一页**；AIHot：用 aihot skill 的 UA（`aihot-skill/0.3.6 (+https://aihot.virxact.com/aihot-skill/)`）调 `/api/public/items?mode=selected&since=<24hISO>&take=5`。三探全通 = 渠道可用。

## 公众号排版移动端优化（2026-08-20 落地）

**触发**：用户给出微信文章链接，要求分析排版是否适合手机端阅读 → 抓 HTML 解析 #js_content 内联样式（字号/行高/间距/颜色分布）→ 对照移动端标准（正文 15-17px、行高 1.6-1.75、段距 12-16px）→ 出对比截图（当前版 vs 优化版，390px 视口 headless chrome）→ 用户确认后落地。

**落地内容**：
- `gzh-design/references/theme-graphite-minimal.md`：正文 15px→**16px**、行高 1.8→**1.75**、正文色 #52525B→**#3F3F46**、H3 子标题 15px/800→**17px/600**、列表项/引用/提示条/卡片/表格/签名区同步升级；变量速查表更新并标注「段落长度上限 150 字」
- `deploy/scripts/cowrite-hermes-worker.py`：topic-create PROMPT 加「移动端阅读规范：正文 16px、行高 1.75、每段 ≤150 字自动拆段」

**分析套路（用户再给文章链接时复用）**：curl 带 iPhone UA 抓 mp.weixin.qq.com → 正则提取 `<div id="js_content">` → Counter 统计 font-size/line-height/color/margin 分布 → 逐个提取 h2/h3/p/strong/code/figure/ul 内联样式 → 用「当前版 vs 优化版」双 HTML + headless chrome 390px 截图对比交付。

**验证**：grep 旧参数残留=0、新 16px=11 处；390px 渲染无溢出；worker.py py_compile 通过；生产部署完成（worker 为 timer 每次新进程，部署后自动生效）。

## 编辑器显式保存 + 撤销/恢复（2026-08-18 落地）
- **保存模型已改**：输入不再自动 PATCH（原 scheduleSave 800ms 已移除）。Vditor `input` 回调只做 `handleInput()` = 记录历史 + 标 dirty；「保存」按钮（`.editor-save`，深蓝渐变）点击才 `save()` PATCH `/api/pages/{id}`（带 `expectedRevision: revisionRef.current`，成功后更新 revision、`notify('已保存')`、`onSaved` 同步 App 层 saveState）。**发布/Agent 后续任务以保存后的版本为准**
- **撤销/重做（自建历史栈，不依赖 Vditor 内部 API）**：`undoStackRef/redoStackRef/prevValueRef/lastPushRef/restoringRef`；`pushHistory()` 600ms 内连续输入合并为一步（快照 = 本次输入前的值），上限 100 步；`undo()/redo()` 用 `editor.setValue()` 恢复并同步 `prevValueRef`，期间置 `restoringRef=true` 防 setValue 触发 input 再入栈
- **按钮**：`.editor-toolbar`（编辑器上方，回退/恢复/保存），`.editor-tool` 初始 disabled（栈空），保存按钮始终可用；快捷键 Ctrl+Z（回退）、Ctrl+Y / Ctrl+Shift+Z（恢复）——holder keydown 监听，`event.isComposing` 跳过（中文输入法组合期不触发），`preventDefault` 阻止 Vditor/浏览器默认
- **未保存保护**：刷新/关闭走 `beforeunload`（dirtyRef 时 `preventDefault + returnValue=''`）；切换页面（sidebar-page-select / HomeWorkspace onOpenPage）走 `openPageGuarded()`（saveState==='dirty' 时 `window.confirm`）；topbar `.save-state` 文案 dirty 显示「未保存」而非「保存中…」
- **Agent 后台写回**：轮询 PATCH 时若 `dirtyRef.current` 为真则跳过刷新（本地未保存优先），刷新时同样 `restoringRef=true` 防入栈
- 注意：`tsc -b`（tsconfig.app.json 严格模式）对单行 `if (cond) a() else b()` 报 TS1005（原因未明），用花括号块形式规避；`npx tsc --noEmit` 走根 tsconfig（仅 references）不实际检查 src，验收必须 `npm run build` 或 `npx tsc -b`

## 验收工作流（browser_vision 不可用、browser_click 坐标漂移时）
环境现实：浏览器工具不支持视觉/点击不稳定。改用 headless Chrome + CDP 做真实验收，脚手架见 `scripts/cdp-verify.js`：
1. `Emulation.setDeviceMetricsOverride` 模拟移动端 390×844（window.resizeTo 无效，必须 CDP）
2. `Runtime.evaluate` + `returnByValue:true, awaitPromise:true` 做 DOM 断言（querySelector/classList/getComputedStyle/scrollWidth）
3. `Page.captureScreenshot` 出 PNG 交付
4. 多步交互（导航+点击+等待）用内联 async IIFE；**不要**用模板字符串变量传脚本（会偶发返回空对象 `{}`），直接内联字符串
5. **巨型 IIFE 易踩坑**：表达式里含中文/emoji/特殊字符（如 ⠿）或模板串嵌套时，Runtime.evaluate 会报 `SyntaxError: Invalid or unexpected token`；改为**逐步小 evaluate**（每步一行断言/一次点击），异常时先 `exceptionDetails` 排查而不是猜
6. 每条用例独立 chrome 实例 + 独立 debug port，跑完 kill
7. **弹窗确认（window.confirm）在 CDP 里会阻塞**：先 `window.confirm = () => true` 再点触发按钮；恢复默认/删除等流程验收必须这样做
8. **长列表 UI（200+ 项）别平铺**：Skill 选择器最终形态 = 分类下拉（`全部（223）│ 分类（数量）…`）+ 搜索框 + 可滚动列表（每行 checkbox + 名称 + oneLine 描述）+ 顶部已选标签（点 ✕ 移除）；复用 `skillManagerModel.filterLocalSkills(category, query)`；catalog 的 `LocalSkill.category` 来自 classifySkill（11 个分类，用数量降序排）

## 技能选择器「选了类别却看不到技能」的排查与防呆（2026-08 修复）
用户报「选择了 skills 类别后未显示具体 skills」时，先按此定位（实测过：过滤逻辑本身没问题）：
1. **CDP 实测所有入口**（ActionConfigManager 分类下拉 / SkillManager 分类按钮 / ProjectWorkspace 技能弹窗），逐一选分类断言 `rows` 数量——数据/逻辑正常不代表用户没踩坑
2. **两个真实坑**：①`/api/skilldeck/catalog` 加载失败被 `catch(() => undefined)` 静默吞掉 → catalog 空数组 → 分类下拉只剩「全部（0）」，任何分类都无技能且无提示；②搜索框残留词 + 切换分类 → `filterLocalSkills(category, query)` 组合过滤后为空，用户误以为「选类别后无技能」
3. **防呆实现（已上线 commit 6185734）**：ActionConfigManager 增加 `catalogLoading`/`catalogError` 状态 → 加载中显示「技能列表加载中…」、失败显示错误 + 重试按钮；空态按「有搜索词 → 提示清除搜索 / 无搜索词 → 提示查看全部」区分并给 `ghost small` 快捷按钮；SkillManager 空态同样加「清除搜索 / 查看全部」按钮（`.skill-empty-actions`）；ProjectWorkspace 弹窗空态加「清除筛选」按钮
4. **验收**：CDP 断言——正常态 `rows=223`、搜索+切分类后 `rows=0` 且空态含「清除搜索」按钮、点按钮后 `rows=42`（回到「图片/设计」全量）且 query 清空
教训：过滤函数正确≠体验正确；「选 X 后没有结果」类问题优先查静默失败 + 组合过滤残留，别只盯着过滤逻辑本身。

## 手机通知草稿功能 + 快捷键选择器（2026-08-23 落地）

**需求**：Cowrite 新增 4 个「通知手机创建草稿」动作（微头条/头条文章/知乎文章/知乎想法），服务器无头条/知乎权限，Worker 整理内容后投递 Memos 信箱 @openminis，手机端 OpenMinis 建草稿、写回 [DONE]；同时编辑页快捷键栏位由平铺 chips 改为选择器。

**实现**（commit 2abf942）：
- `server/actionConfig.ts` 默认动作 +4：toutiao-micro-draft（280-320字提炼+humanizer-zh）、toutiao-article-draft（全文）、zhihu-article-draft（全文）、zhihu-idea-draft（≤140字提炼）；均 chip=false
- `deploy/scripts/cowrite-hermes-worker.py` PROMPT +4 动作规则：读页 → 处理内容 → 写 /tmp/cowrite-draft-task.txt → `agent-queue-post.py --file ... --visibility PUBLIC` → 页面末尾追加「【已通知手机创建<平台>草稿】时间+信箱」→ complete（assets 填 memo uid）
- `~/.hermes/scripts/agent-queue-post.py` 支持 `--file`（长文本投递避免 shell 转义，content 与 --file 二选一）
- `src/CommandBar.tsx`：`.command-chips` 平铺 → `.command-selector` 选择器（列出全部 enabled 动作，单选 chip(id) 填入输入框，保留更多按钮）；`.selector-list` 向上弹出、行高 ≥44px
- 测试：默认动作数 13→17，133/133 通过

**坑/要点**：
- 生产旧 action-config.json 不自动带新动作，需 API merge（GET → 追加 4 动作 → PUT，带 token）
- worker.py PROMPT 里分隔符是**字面 `\n`（单反斜杠+n）**，patch 时 read_file 显示 `\\n` 是转义显示，用 Python 字节级替换最稳
- 验收：CDP 断言选择器 17 项 + 单选填入 + 无溢出；真实任务端到端（页面→worker→memo 读回→页面 revision 1→2）

**坑（2026-08-23 用户实测反馈后修复，commit 7c16d91）**：`.command-chips` 有 `overflow-x: auto`，absolute 定位的 `.selector-list` 会被**裁剪不可见**——用户点「选择动作」看不到列表（DOM 存在、CDP 查 DOM 也通过，但渲染被裁剪）；「更多」按钮的 `.command-more` 是兄弟节点不受裁剪所以能显示。**教训：下拉/弹层若挂在 overflow:auto 祖先下必须用 `position: fixed` + JS 取按钮 rect 定位，或移到 overflow 容器外；验收必须断言 `getBoundingClientRect` 在视口内（top≥0、bottom≤innerHeight、height>0），不能只查 DOM 存在**。同 commit 按用户要求去掉「更多 ▾」按钮（选择器已含全部动作）。

## 动效优化（Apple 动效方法论落地，2026-08-23）

**触发**：用户要求用 apple-design / animate 方法论评估 Cowrite 前端，并直接「落地 + 真实验收」。

**审计方法（扫一遍 CSS 即可定位问题，无需运行）**：
- `grep -rnE "transition|animation|ease|@keyframes|will-change|transform" src/*.css` 列出全部动效点
- 逐条对照 apple-design 铁律：
  ① 是否动了**昂贵布局属性**（`width`/`flex-basis`/`height`/`padding`/`margin` → 每帧重新布局并传播到兄弟节点）；② 是否有 `prefers-reduced-motion`；③ 模态/选择器/弹层是否有**轻缩放进场**（scale 0.95→1）；④ toast 是否「怎么进怎么出」（补退场）；⑤ 曲线是否**强 ease-out** `cubic-bezier(0.23,1,0.32,1)`（默认 `ease` 起步偏慢）；⑥ 按钮/卡片是否有 `:active` 按压反馈

**本次落地（commit 936ee3a）**，验证脚本见 `scripts/motion-verify.js`：
- **侧边栏：width 动画 → fixed + translateX**（唯一不触发整页重排的路径）。`.sidebar` 改 `position:fixed; width:240px 恒定; transform:translateX(-100%)`，展开 `translateX(0)` + 投影；只动画 `transform`
- **模态轻缩放进场**：`.modal` 加 `modal-in`（0.96 scale + 6px 上移），mask 保留 `fade-in`
- **选择器/底部弹层进场**：`.selector-list` 加 `list-in`（0.96 scale），`.command-more` 加 `sheet-in`（translateY 16 + 0.98 scale）
- **toast 补退场**：两段式 state——`toastLeaving`，显示 2.2s 后加 `.is-leaving`（`toast-out` forwards），`onAnimationEnd` 再清空
- **reduced-motion**：文件末尾全局块 `@media (prefers-reduced-motion: reduce){ *{animation-duration:0.01ms!important; transition-duration:0.01ms!important; ...} }`
- **强 ease-out**：18 处默认 `ease` → `cubic-bezier(0.23,1,0.32,1)`
- **卡片按压反馈**：`.home-card`/`.skill-card` 加 `:active`（scale 0.98/0.985）

**坑**：
- 侧边栏改 `fixed` 后是**覆盖式抽屉**（原推格式），会盖在 workspace 上——若用户要保留「推开内容」观感，用「定宽容器 + transform」方案，别用 width 动画
- toast 退场**必须 JS 配合**：纯 CSS 无法在退场后自动卸载 DOM，需 `toastLeaving` state + `onAnimationEnd` 两段式
- CDP 断言动效：`getComputedStyle(el).animationName`/`.transitionProperty`/`.transform`，读 CSS 规则用 `[...document.styleSheets].flatMap(s=>[...s.cssRules])` 过滤 `prefers-reduced-motion` 与曲线；`document.body.scrollWidth > clientWidth` 判横向溢出

## gzh-design 主题排版快捷键（2026-08-26 落地）

**需求**：编辑页顶部加「主题」下拉选择器，选主题一键把当前页 Markdown 排版成 gzh-design 对应主题的 HTML 初稿写回页面；发布（gzh-publish）也支持按主题排版。

**实现**（commit 54a75ac，生产动作 18→19）：
- `server/styleConfig.ts` DEFAULT_STYLES.layout 对齐 gzh 6 套真实主题（graphite-minimal/moyu-green/red-white/zen-whitespace/moyu-ticket/olive-journal），id 与 gzh-design references/theme-<id>.md 一一对应；styleConfig.load() 无文件时返回 DEFAULT_STYLES（前端可直读）
- `server/actionConfig.ts` DEFAULT_ACTIONS +1 `gzh-layout`（公众号主题排版，skills=[gzh-design,wechat-article-publishing]，chip=false）
- `src/App.tsx` Editor：编辑器顶栏（`.editor-toolbar`）新增 `.theme-select`（label+select+排版按钮）；主题列表 useEffect 内 `GET /api/style-config` 读 `config.styles.layout`；`applyGzhTheme()` → `sendAi('gzh-layout', '主题：<id>（name）；请把当前页面内容按该主题排版成公众号 HTML 初稿并写回页面。', hint)`
- `src/App.css`：`.theme-select/.theme-label/.editor-theme-apply` 样式（toolbar 是 flex-wrap，移动端自动换行不溢出）
- 生产 action-config：API merge（GET /api/session 取 token → GET /api/action-config → 幂等 append gzh-layout + 升级 gzh-publish 的 prompt 加「主题：xxx」解析 → PUT `{version,actions}` 无 config 包装）→ 19 动作

**排版链路**：worker 领取任务后自动 GET /api/action-config 读 skills/prompts 执行（配置化，worker.py 不改）；agent 按 requirements「主题：xxx」读对应 theme-<id>.md 组件库排版成纯 `<section>` 正文，validate_gzh_html.py 校验完全合规后写回页面。

**端到端验收**（真跑 gzh-layout 任务，摸鱼绿主题 → 测试页 page_LZ0FPrAQ）：status=succeeded、页面 revision 1→2、产物纯 section（无 style/class/div）16px/1.75/24px + 59 处 span leaf、validate_gzh_html 「完全合规」、390px 视觉确认摸鱼绿配色+组件齐全。

**坑**：
- 动作数断言：默认动作 17→18，`tests/action-config.test.ts` L20/L93 与 `action-config-api.test.ts` L40 三处 `toHaveLength(17)` 必须同步改 18（3 处，其中 action-config.test.ts 有 2 处相同断言需 replace_all 或补上下文）
- `applyGzhTheme` 引用 `sendAi`（后者是 const 在 464 行定义）——TDZ 风险：必须把 applyGzhTheme 放在 sendAi **之后**定义，否则 tsc 报 Block-scoped used before declaration / 运行时 undefined（实测放在 179 行 state 区会报 TS6133 未使用 + 引用问题，移到 sendAi 后解决）
- `gzhThemesState` 声明了只用 set 不读 → tsc -b 报 TS6133 未使用；必须实际用上（select disabled={gzhThemesState==='loading'}）或删除
- 生产 style-config 无独立文件（用代码 DEFAULT_STYLES），无需生产 merge；action-config 独立文件需 API merge
- 验收任务创建：POST /api/tasks body `{action:'gzh-layout', pageId, requirements, delivery:'cowrite'}`（带 x-cowrite-token）；`/api/tasks` 返回**数组非 `{tasks:[...]}`**，轮询直接遍历；worker 领取有 ~1 分钟延迟
- gzh-publish 升级要保幂等：仅当 prompt 不含「主题：」才补，避免重复 merge 破坏

## 页面内容/配图「找不到」先看恢复配方（2026-08-27 实操）
**触发词**：用户报「Cowrite 平台某文章内容和配图找不到了」。**先别重建，先分层确认后端到底丢没丢**——绝大多数情况是「产物有、写回漏」或「前端缓存」，不是真丢。
- **完整定位三步 + 根因 + 恢复配方 + 验收注意见 `references/page-content-recovery.md`**（含：① API 直读确认内容/图在不在；② assets 目录 + HTTP 可达确认配图；③ 查任务产物。根因 = `gzh-layout` 生成的完整 HTML 产物 `gzh_<theme>_layout.html` **含图**，但写回页面 content 时只落正文、把 `<img>` 丢了 → 页面无图但无报错）
- **恢复 = 完整产物（含图）+ 占位符替换峰AI路 + 全量写回**；写回后必读回断言 `img>0`、无 `{{}}` 占位、含峰AI路
- **验收坑**：Cowrite 编辑器是**源码视图**（HTML 以 `<code>` 呈现），browser_vision 会误判「正文空白/排版异常」——以 DOM 快照 / API 读回 / wrap_preview 为准，不要用 browser 截图做最终判定
- **教训**：排版/配图任务成功 ≠ 正文里有图。worker 契约的「真实验证→写回」必须落到**读回页面断言 img 数**这一步，不能只看 status=succeeded

## 移动端底部 Tab 图标统一（2026-08-27 落地，commit da237c6）

**触发**：用户看到侧边栏图标已统一后，要求顺手把底部 Tab 栏（MobileTabBar，514-540 行）图标也统一。

**根因**：5 个 Tab 图标 4 个是单色字符（`⌂`/`◫`/`✎`），但「技能」用彩色 emoji `🧩`、「配置」用 `⚙`（部分系统渲染成彩色 emoji）→ 彩色与单色混用、大小不一、悬垂。

**修复**：
- `src/App.tsx` MobileTabBar tabs：`🧩`→`▤`（技能），`⚙`→`\u2699\uFE0E`（配置，追加 U+FE0E 强制文本变体避免被渲染成彩色 emoji）
- `src/App.css` `.mobile-tabbar .tab-ico`：加 `display:inline-flex; width:24px; height:24px; align-items:center; justify-content:center`（统一 24×24 居中盒，字符图标垂直居中）

**验证**：CDP 390px 实测 5 个 tab-ico 全部 24×24 居中、`getComputedStyle` color 全部单色（未选中 `#8A94A6` / 激活 `#1E4D7C`）、截图确认无彩色 emoji、图标与文字对齐。133/133 测试全绿、build 通过、已部署生产。

**教训**：移动端 Tab / 工具栏图标同样别用彩色 emoji——统一用单色符号 + 追加 `\uFE0E` 文本变体 + 固定尺寸居中盒，才能与侧边栏图标风格一致、跨端（飞书 WebView 等）稳定渲染。

## 侧边栏导航图标统一（2026-08-27 最终落地，全链路 commits d932330→a9f599b）

**优化目标**：Cowrite 左侧边栏「首页/项目/Skill管理/动作配置/任务中心」5 个导航项，图标符号、字号、图标与文字间距，整列完全统一、干净、不标蓝。

**最终结论（导航项图标统一做法，直接照抄可复现）**：
- **图标全部用同规格内联 SVG**：统一 `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">`，`stroke=currentColor` 跟随激活/普通色。**不要用内联字符当图标**（字符按文本基线渲染、大小/居中不可控，飞书 WebView 上 emoji 还渲染空白）
- **图标盒**：`.sidebar-tool-icon { flex:0 0 16px; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; line-height:1 }`（统一固定居中盒）；`.sidebar-tool-icon svg { display:block }`
- **文字包元素**：导航项文字用 `<span class="sidebar-tool-label">` 包裹（裸文本不匹配相邻兄弟选择器，间距选择器会失效）
- **间距**：`.sidebar-tool { display:flex; align-items:center; gap:7px }`（用 `gap` 而非 `.sidebar-tool > * + *` 的 `margin-left`）
- **图标符号选型**：首页=书、项目=文件夹、Skill管理=锤子、动作配置=齿轮、任务中心=三横线——**书/锤/齿轮用 SVG 而非 emoji**（📖🔨⚙ 是彩色 emoji 或无单色 Unicode，headless/飞书 WebView 渲染空白/不稳）
- **用户反馈迭代**：
  - 「首页符号太小」→ 曾用字符 `⌂` + 放大 font-size(17px)，glyphW 仅 9→11px 仍偏窄——**根本解法是换 SVG**
  - 「首页/Skill管理加 `primary` 标蓝样式(浅蓝底+左侧竖条)》→ 用户**明确不要标蓝**：整列回归统一的普通导航样式，仅选中项保留正常高亮（`.sidebar-tool.active { color:#2383e2; font-weight:600 }` + hover 灰底），去掉覆盖性的 `.primary` 样式
  - 「动作配置/任务中心图标」→ 从字符 `⚙`/`☰` 换成同规格 SVG 齿轮/三横线，与书/锤统一
  - 「项目图标太大」→ 项目原用 CSS 绘制(`position+border` 文件夹 14×14)显得比 SVG 大，**改为同规格 SVG 文件夹**，5 项图标彻底统一

**验证**：CDP `getBoundingClientRect` 实测 5 项图标盒全部 16×16、字号全 13px、图标全部 svg；截图 OCR/vision 确认大小一致、间距均匀、无标蓝。133/133 测试全绿、build 通过、已部署生产。

**教训**：① **导航图标统一用同规格内联 SVG**（字符字形宽度差异无法用字号抹平，emoji 跨端不稳）；② 用户要"统一/干净"时，**别加特殊标蓝/底色强调**，仅保留选中态高亮；③ 测量字符可视尺寸用 `document.createRange().getBoundingClientRect()`（比 getBoundingClientRect 更准，能看到 glyphW/glyphH）；④ 用户区分的"标签字号""图标符号""图标大小"是三个独立诉求，逐个确认，别混成一次改。

## Pitfalls
- **Cowrite MCP 写页面/资产的调用约定（2026-08 OpenMinis 文章实测）**：`cowrite_create_page(title, content, prompt=brief)` 一次写入完整 Markdown，返回 `page_xxx` 与 `revision:1`；之后补图/改稿必须 `cowrite_update_page`，参数除 page_id 外**必须带 `expected_revision`（当前 revision）**，漏了会报 missing required argument。`cowrite_upload_asset` 上传本地图片返回 `/assets/<hash>.png`，页面 Markdown 里直接用相对路径 `/assets/<hash>.png`，前端 fixAssetLinks 会按当前入口子路径重写；验证用 `curl -sI` 同时过本地 `127.0.0.1:4320` 与公网子路径入口（均期望 200，非 text/html）。
- **GitHub 上传 worktree 项目**：`gh repo create --source . --push` 会报 "not a git repository"（gh 不支持 gitfile worktree，`.git` 是 83 字节 gitfile 而非目录）。解法：`gh repo create <name> --private --description ...` 先建空仓库 → `git remote add origin https://github.com/<user>/<name>.git` → `git push -u origin hermes-local-impl`（可连带 `main`/`hermes-adaptation`）→ 默认分支用 `gh repo view owner/repo --json defaultBranchRef` 验证（`gh repo edit --default-branch` 在 worktree 里可能解析错 remote 报 404，但 create 时 HEAD 通常已指向推的第一个分支）。上传前安全扫描：`git log --all --name-only | grep -iE '\.env|data/|assets/'` 查敏感文件、`git log --all -p | grep -iE 'sk-|ghp_|AIza|PRIVATE KEY'` 查密钥值；本仓库 .gitignore 已排除 node_modules/dist/data/*.json*/assets/__pycache__
- **部署后用户看到旧 UI = 飞书 WebView 缓存**：服务器已验证是最新版（index.html 新 hash + nginx 已设 `Cache-Control: no-store`），但飞书内置浏览器仍显示旧版平铺布局（用户截图 OCR 可确认）。处理：先 curl 验证 nginx 返回的新 JS hash 与 /opt dist 一致，再让用户「关掉页面重开」/手机浏览器打开/清 WebView 缓存；不要误判为部署失败或回滚。截图诊断用 tesseract OCR（vision_analyze 连续 400 时），必要时裁剪局部放大再 OCR
- **通用 input 选择器会误伤 checkbox/radio（2026-08 真实事故）**：`.field input { width: 100% }` 匹配了技能行里的 checkbox → checkbox 被拉伸到整行宽（1140px）→ 技能名被挤出容器被 `overflow:hidden` 裁剪 → 用户截图里技能列表区域「空白」但 DOM rows=223 正常。**所有 input 通配样式必须排除 checkbox/radio**：`.field input:not([type='checkbox']):not([type='radio'])`。排查套路：CDP `getBoundingClientRect` 看 checkbox width（应 ~13px）、`nameLeft > listRight` 即被挤出；验收必须截图 OCR，不能只看 DOM rows 数量
- 自然语言动作识别：关键词要覆盖中间带数字的变体，如「配 3 张图」→ `配\\\\s*\\\\d+\\\\s*张图`；submit 守卫不能用 `if (!req && !action) return`（会误拦「匹配到动作但 requirements 为空」的自然语言提交），用 `if (!text.trim() && !action) return`，且 chip 提交要显式传 `requirements: ''`
- 并行会话改同一文件时（patch 警告 "modified by sibling subagent"）：先 read_file 再 patch，避免覆盖对方改动
- React 受控 input 注入：直接赋值 value 不触发 onChange；必须 `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` + `dispatchEvent(new Event('input',{bubbles:true}))`
- Vditor 实例未暴露 window，官方 API 注入不可用；真实键盘输入与 PATCH API 链路正常（测试限制，非产品 bug）
- illustrate 等生图任务耗时长（数分钟级），Worker 30 分钟超时；验收用后台 terminal + notify_on_complete 等待，别阻塞
- 服务重启会中断 running 任务（租约机制处理），验收前先清队列或接受 cancelled 结果；测试任务用完即取消
- **Skill 目录匹配必须用 basename**：`/api/skilldeck/catalog` 的 `LocalSkill.folder` 含分类前缀（如 `creative/humanizer-zh`），而动作配置里存纯名 `humanizer-zh`；用 `includes(folder)` 永远匹配不上（表现为勾选/回显丢失），用 `folder.split('/').pop()`
- **action-config GET/PUT 结构不对称（2026-08-20 踩过）**：GET `/api/action-config` 返回 `{config:{version,updatedAt,actions}}`；PUT body 必须**直接传 `{version, actions}`**（无 config 包装），否则 zod 400。程序化修改要解析 `cfg["config"]["actions"]`——误读成 `cfg["actions"]` 会拿到空数组 → PUT 空 actions → 400。写操作带 `x-cowrite-token`（GET `/api/session` 返回 `{token}`）；PUT 后重新 GET 断言改动已落地（实例：2026-08-20 更新 feng-ip 动作 prompt 加入多图一致性规则）。
- **cowriteFetch 的 PUT/POST 必须显式带 `content-type: application/json`**：express.json() 只解析带该头的 body，漏了会 400 `expected object, received undefined`（zod parse undefined）。requestJson 封装里默认合并此头
- **app.ts 新写端点注意顺序**：PUT/POST 路由若注册在 `/api` token 校验 middleware 之前会绕过鉴权；GET 可放前（免 token），写操作放后
- 任务 API 的 action 校验已放宽：`z.string().trim().min(1).max(80)`（不再 z.enum(TASK_ACTIONS)），自定义动作 id 可直接建任务；未知动作 recommendedSkills=[] 属预期
