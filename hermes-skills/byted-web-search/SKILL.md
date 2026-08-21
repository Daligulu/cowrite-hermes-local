---
name: byted-web-search
version: 1.3.4-hermes.3
author: volcengine-search-team; Hermes adaptation
license: Apache-2.0
description: >-
  Use when searching or verifying current Chinese web facts, policies, prices,
  company/product updates, finance, or authoritative domestic sources through
  Volcengine Byted Web Search Custom and Global APIs. Supports Custom time ranges,
  authority filtering and query rewrite, plus Global token-aware snippets and image metadata. Triggers include 豆包搜索、中文搜索、权威来源、最新政策、国内资讯、火山引擎联网搜索。
metadata:
  hermes:
    tags: [search, chinese-web, volcengine, doubao, fact-checking]
    related_skills: [agent-reach]
---

# Byted Web Search — Hermes Custom + Global

## Overview

本 Skill 适配自火山引擎第一方 `byted-web-search`，并按火山引擎官方文档补充 **Global 版**；不使用社区 MCP：

- Custom API：`https://open.feedcoopapi.com/search_api/web_search`
- Global API：`https://open.feedcoopapi.com/search_api/global_search`
- 凭据：当前 Hermes profile 的 `~/.hermes/.env`
- 队列：Custom、Global 分别使用跨进程 **4 QPS** 本地队列
- 输出：标题、URL、站点、权威等级、摘要、发布时间等第一方返回字段
- 本地范围：Hermes 编排与凭据在本机；检索本身在火山引擎云端完成

上游镜像：`~/.hermes/workspace/external-skills/agentkit-samples/skills/byted-web-search/`。安装目录中的 `.source_commit` 记录已适配版本。

双版本 Key 模式、安全注入与验收细节见 `references/api-key-modes.md`。

安装、升级或路由变更后的 Obsidian / 飞书 / Memos 盘点同步流程见 `references/catalog-sync.md`。

## When to Use

优先用于：

- 中文新闻、国内产品动态、政策、价格、汇率、金融和行业信息
- 用户要求“只看官方/权威来源”
- 需要近一天、周、月、年或精确日期区间
- Exa 中文召回不足，或需要字节生态及国内站点补充
- 中文事实核查、辟谣、公司/人物/事件查证

不要用它替代：

- 英文语义研究与海外技术资料：优先 Exa
- GitHub/B站/YouTube/微信公众号/小红书等平台专用检索：优先对应 Skill
- 已知 URL 正文读取：优先 `web_extract`、Jina、微信单篇抓取或 Browser
- 私有飞书、Obsidian、聊天记录检索
- 用户明确要求不联网的任务

## Trigger Contract

自然语言触发按以下硬规则解释：

- “豆包搜索 / 用豆包查 / 豆包查一下” → 默认 **Custom**。
- “豆包 Global / Global 版搜索” → 明确使用 **Global**，不得静默回落 Custom。
- “只看权威来源 / 只要官方” → Custom + `--auth-level 1`。
- “最近一天/周/月/年” → Custom + 对应 `--time-range`。
- 未指定后端的中文时效、政策、金融、国内公司问题 → 优先 Custom。
- 跨语言、全球网页、长摘要或需要 Token 元数据 → Global；精确官网、GitHub、海外技术文档仍可优先 Exa。
- 用户点名某个后端时，该明确指令覆盖自动路由。

## Routing

```text
明确“豆包/豆包 Custom”       → 豆包 Custom
明确“豆包 Global”            → 豆包 Global
中文时效/政策/金融/国内公司   → 豆包 Custom
跨语言/长摘要/Token 元数据    → 豆包 Global
英文/海外/精确官网/技术文档   → Exa
GitHub/B站/YouTube/微信       → Agent Reach 或平台 Skill
已知 URL                      → web_extract / Browser
私有本地知识                  → Obsidian / Hermes-Wiki / 飞书 Skill
```

豆包和 Exa 是互补后端。除非用户明确要求，不把豆包设为所有联网搜索的唯一来源。

### Routing Pitfall

Skill 能被发现、凭据 configured、真实 API 验收成功，只代表 **Skill 层路由可用**，不代表 Hermes 核心 `web_search` provider 已配置。回答“路由配置好了吗”时必须分开核验并说明：

1. `byted-web-search` 与 `agent-reach` 中的自然语言路由是否已写入；
2. Custom / Global 凭据与真实调用是否分别通过；
3. Hermes 核心 `web_search` backend 是否另外配置。

不要把这三件事混成一句“已配置完成”。

## Credential Safety

当前用户明确偏好直接在对话中发送 API Key，不使用 noVNC 配置。收到后应立即通过交互式标准输入或进程 stdin 写入当前 Hermes profile 的 `.env`，不要把 Key 放进 shell 命令参数、回复、日志、Git、测试夹具或 Obsidian；写入后只报告变量名、configured/not configured 和文件权限，不回显完整值。若 Key 已在对话出现，不要再要求用户改用 noVNC。

接收 Key 时必须先判断计费模式：订阅套餐 Key 只写入 `WEB_SEARCH_CUSTOM_API_KEY`；不得猜测或复制到 Global。Global 必须使用独立的按量后付费 Key，真实探测返回 `10409` 时应停止并请求正确模式的 Key。

查看状态：

```bash
python3 "$HOME/.hermes/skills/research/byted-web-search/scripts/configure_key.py" --version custom --status
python3 "$HOME/.hermes/skills/research/byted-web-search/scripts/configure_key.py" --version global --status
```

在本机交互式配置（输入不回显）：

```bash
python3 "$HOME/.hermes/skills/research/byted-web-search/scripts/configure_key.py" --version custom --set
python3 "$HOME/.hermes/skills/research/byted-web-search/scripts/configure_key.py" --version global --set
```

凭据写入：

```text
$HERMES_HOME/.env
WEB_SEARCH_CUSTOM_API_KEY=...
WEB_SEARCH_GLOBAL_API_KEY=...
```

文件权限强制为 `0600`。修改后新开 Hermes 会话；Gateway 场景执行 `hermes gateway restart`。

## Search Commands

始终使用绝对路径：

```bash
SCRIPT="$HOME/.hermes/skills/research/byted-web-search/scripts/web_search.py"
python3 "$SCRIPT" "搜索词"
```

常用参数：

```bash
# 最近一周
python3 "$SCRIPT" "国内 AI Agent 最新进展" --time-range OneWeek

# 只看非常权威来源
python3 "$SCRIPT" "人工智能相关政策" --auth-level 1

# 口语问题改写成检索词
python3 "$SCRIPT" "最近国内有哪些值得关注的AI搜索产品" --query-rewrite

# 指定日期区间
python3 "$SCRIPT" "火山引擎豆包搜索发布" --time-range 2026-07-01..2026-07-31

# 图片搜索
python3 "$SCRIPT" "火山引擎 Logo" --type image --count 3

# Global：全球网页、长摘要与 Token 元数据
python3 "$SCRIPT" "Hermes Agent official documentation" --version global --count 5 --snippet-length 800
```

参数：

- `--count`：网页 1–50；图片 1–5
- `--time-range`：`OneDay` / `OneWeek` / `OneMonth` / `OneYear` / `YYYY-MM-DD..YYYY-MM-DD`
- `--auth-level 1`：只返回非常权威来源
- `--query-rewrite`：开启服务端 Query 改写

## Search Strategy

1. **单事实问题**：一次精准查询；结果不足时只改一次关键词。
2. **争议事实**：分别搜索“事实本身”和“官方/反方说法”，至少两条独立来源。
3. **复杂研究**：拆成 2–3 个互补查询；先豆包补中文，再用 Exa 补英文与海外来源。
4. **政策/医疗/金融**：优先 `--auth-level 1`，并打开原始 URL 核对。
5. **时效查询**：显式传 `--time-range`；不要仅凭摘要里的相对时间。

每条结论都应保留可点击来源 URL。搜索返回是证据候选，不是最终事实。

## Storage Boundary

依据豆包搜索专用条款，不用 API 返回全文建立本地内容数据库，也不批量归档 API Content。

允许的工作流：

```text
豆包发现 URL → 用原始 URL 二次读取 → 保存自己的摘要、判断、引用和链接
```

Obsidian 中保存来源元数据和自己的分析，不镜像豆包返回的大段全文。

## Rate Limiting

`scripts/rate_limit.py` 自动提供 Custom、Global 两条独立跨进程队列：

- 单 Key 最高 4 QPS
- 请求均匀间隔至少 250ms
- 状态：`rate-limit-custom.state`、`rate-limit-global.state`
- 状态文件权限：`0600`

不要绕过队列或并发直接调用 API。遇到 `429` 时等待后再重试，不增加并发。

## Failure Handling

- `invalid_api_key` / `10403`：按失败版本重新运行 `configure_key.py --version custom|global --set`
- `10409`：订阅套餐 Key 只能用于 Custom；Global 需单独创建按量后付费 Key
- `429` / `700429`：降频重试；检查是否有未经过本队列的外部调用
- `10406` / `10412`：额度不足
- `10408`：欠费
- `10500`：等待 2–3 秒后重试一次
- 连续 2 次失败：回退 Exa，并明确说明豆包后端失败
- 连续 2–3 次结果不相关：缩短关键词；仍失败则承认证据不足

## Catalog Sync After Changes

安装、升级、补充 Custom/Global 能力、修改路由或完成新的线上验收后，执行 `references/catalog-sync.md`：

1. 更新 Obsidian 的《Hermes Skills 盘点（短用途版）》主稿；
2. 定位并更新已有同名飞书文档，更新后 fetch 回读；
3. 同步到 Memos；超过 8192 字符时按章节拆分并建立双向 reference relation；
4. 三端只保存用途、状态、路由和非敏感验收结果，不保存凭据或 API 全文。

不要用“完整 Skill 目录已同步到 Obsidian”代替短用途盘点更新；两者是不同交付物。

## Verification Checklist

- [ ] Custom、Global 状态检查只显示 configured/not configured，不输出 Key
- [ ] `~/.hermes/.env` 权限为 `0600`
- [ ] `web_search.py --help` 正常
- [ ] 无 Key 时返回安全的缺凭据提示，不回显任何已有 Key
- [ ] 4 个并发进程被 4 QPS 队列串行化
- [ ] 真实查询返回标题、URL 和摘要
- [ ] Global 真实查询返回 Token 元数据；订阅套餐 Key 不被错误写入 Global
- [ ] Exa 与豆包使用同一中文查询集比较
- [ ] 报告区分 API 实测、官方资料和推断
