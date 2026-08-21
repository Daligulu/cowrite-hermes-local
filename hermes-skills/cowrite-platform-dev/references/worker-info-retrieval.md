# Worker 信息检索路由 — 完整规则与验收

## 背景
用户要求：在 Cowrite 发布任务提到「搜索/收集/寻找」等意图时，直接调用 Hermes 现有的 Web 路由，路由逻辑同 Hermes。**Hermes 实际有两套搜索后端**，路由规则必须两块都写，否则漏豆包（本会话被用户纠正）。

## Hermes 搜索能力盘点（环境事实）
| 后端 | 凭据（~/.hermes/.env） | 工具 / Skill | 用途 |
|---|---|---|---|
| Tavily | `TAVILY_API_KEY` | `web_search` / `web_extract`（config `web.backend: tavily`） | 通用搜索、抓正文 |
| 豆包 (Doubao) | `WEB_SEARCH_CUSTOM_API_KEY` + `WEB_SEARCH_GLOBAL_API_KEY` | skill `research/byted-web-search` | 中文时效/政策/金融/国内公司/事实核查 |
| Agent Reach | 无额外凭据 | skill `research/agent-reach` | 平台站内内容路由 |
| Browser | 无头 Chrome | `browser` 工具 | 动态页面/需交互登录 |

## Worker PROMPT 内嵌路由（deploy/scripts/cowrite-hermes-worker.py，步骤 3 内）
触发词：搜索 / 收集 / 寻找 / 调研 / 查资料 / 找资料 / 了解 / 汇总 / 整理信息

- a. 普通网页/通用知识/海外技术/英文资料 → `web_search` + `web_extract`（Tavily；优先 web_search 而非直接猜 URL）
- b. 中文时效/政策/金融/汇率/国内公司产品动态/中文事实核查/「豆包搜索」→ `research/byted-web-search`（默认 Custom；明确全球网页/跨语言长摘要用 Global；只看权威来源用 `--auth-level 1`；近一天/周/月/年用 `--time-range`）
- c. 平台站内（小红书/知乎/微博/公众号/X/Twitter/B站/YouTube/Reddit/V2EX/GitHub）→ `research/agent-reach`
- d. 动态页面（JS 渲染/需交互登录/抓不到正文）→ `browser`
- e. 已知 URL → 优先 `web_extract`，失败再 `browser`
- f. 检索资料写回页面时附来源链接；无法核实标「不确定」

## 端到端验收配方（真实验收，两次实测通过）
1. 建临时页面：`POST /api/pages {title:'路由测试', content:'（测试页面）'}`（带 session token）
2. 发任务：`POST /api/tasks {action:'polish', pageId, requirements:'<含搜索意图，如"用豆包搜索…"/"搜索并收集…">'}`（token 同上；POST 需带 `X-Cowrite-Token` + `Origin` + `Sec-Fetch-Site: same-origin`）
3. 轮询 `GET /api/tasks/:id` 直到 succeeded/failed（约 1–3 分钟；前几轮 queued→running）
4. 断言：`result.message` 应**明示走了哪条路由**（如「信息检索路由：普通网页/通用知识 → web_search + web_extract」或「用豆包搜索（Custom + auth-level 1 + OneWeek）」）；`result.assets` 应有真实来源链接
5. `GET /api/pages/:id` 检查写回内容含来源链接
6. 清理：`DELETE /api/pages/:id`（临时页面）；succeeded 任务记录可留任务中心展示

## 实测样本
- 通用路由任务：「搜索并收集 Hermes Agent 基本介绍」→ 明确走 `web_search + web_extract`，写回 170 字 + 2 来源（官方文档/GitHub）
- 豆包路由任务：「用豆包搜索 2026 年 8 月中国 AI 政策动态」→ 走 `byted-web-search Custom + auth-level 1 + OneWeek`，写回 130 字 + 4 条权威来源（中国经营网/中国政协网/数字中国峰会/高校官网）

## 备注
- Worker PROMPT 改动部署：py_compile 校验 → git commit → /opt reset --hard → `systemctl restart cowrite-hermes-worker.timer`（timer 每分钟触发，脚本每次新进程读新代码）
- 若动作配置里想强制某动作搜索，在动作 Skills 里加 `research/agent-reach` 或 `research/byted-web-search` 即可；否则 Agent 按路由自主决策
