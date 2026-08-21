---
name: agent-reach
description: Use when researching/searching the internet or reading URLs across web,
  social, GitHub, YouTube/Bilibili, RSS, V2EX, X/Twitter, Reddit, Xiaohongshu, LinkedIn,
  Xueqiu, or podcast sources. Local Hermes adaptation for Agent Reach routing and
  doctor checks.
version: 1.5.1
author: Panniantong / adapted for Hermes Agent
license: MIT
metadata:
  hermes:
    tags:
    - research
    - search
    - web
    - social-media
    - github
    - youtube
    - rss
    related_skills:
    - ocr-and-documents
    - youtube-content
    - github-repo-management
---

# Agent Reach — 互联网能力路由器

## Hermes 本地适配

- Agent Reach 源码克隆在 `/root/.hermes/workspace/external-skills/Agent-Reach`。
- CLI 安装在 `/root/.agent-reach-venv`，命令已链接到 `/usr/local/bin/agent-reach`。
- 本 Hermes skill 安装在 `/root/.hermes/skills/research/agent-reach`。
- 运行前优先执行 `agent-reach doctor --json`，按各 channel 的 `status` 和 `active_backend` 选择命令。
- 临时输出放 `/tmp/`，持久配置和 cookie/token 放 `~/.agent-reach/`。不要把平台 Cookie 写进 skill 文件或聊天回复。
- 本机已安装/配置基础能力：Jina Reader 网页读取、yt-dlp YouTube、mcporter+Exa 搜索、feedparser RSS、V2EX API、bili-cli、gh CLI。
- GitHub/Twitter/雪球等登录态能力需要用户授权或 Cookie；需要时再引导用户配置。


13 平台、多后端。**本 skill 存在时必须用它访问这些平台，不要自己发明方案。**

## 常驻规则（全程适用）

1. **动手前先体检**：多后端平台（小红书/Reddit/B站/Twitter）先跑
   `agent-reach doctor --json`，按各平台 `active_backend` 字段选命令组。
2. **声明你在用什么**：开始干活前说一句「使用 agent-reach 的 X 平台 / Y 后端」。
3. **失败按 references 里的重试链处理**，不要瞎猜命令。
4. **全网调研类任务**：组合多平台（Exa 搜索 + Twitter/Reddit 看讨论 + 小红书/B站看中文场景），并行收集再汇总。
5. **替用户盯版本**：完成一次较大的调研/多平台任务后，顺手跑
   `agent-reach check-update`（很快，一个 API 调用）。有新版就在收尾汇报里附一句：
   「Agent Reach 有新版 vX.Y.Z，复制这句话给我即可更新：帮我更新 Agent Reach：
   https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/update.md」。
   不要中断当前任务去更新，也不要重复提醒同一个版本。

## 峰峰 Web 路由 v2

联网任务默认遵循：

```text
本地/私有原始数据源
→ 平台专用 Skill 或 Agent Reach 对应 channel
→ 通用搜索
→ 正文提取
→ Browser 兜底
```

关键规则：

- 飞书、Obsidian、Memos、本地知识库和本地文件直接读取原始数据源，不提交给公共 Web Provider。
- GitHub、微信公众号、抖音、飞书、小红书等平台优先走对应专用 Skill；YouTube、B站、V2EX、RSS 等走 Agent Reach 已验证 channel。
- 中文时效、政策、金融、国内公司优先豆包 Custom；普通网页默认 Hermes 原生 Tavily；英文技术和海外语义研究用 Tavily 首轮、Exa 补充。
- 普通已知 URL 按 `web_extract → Jina → Browser`；平台 URL 不先走通用提取。
- Browser 只在提取为空/残缺、必须执行 JavaScript、需要登录态/交互/视觉判断，或平台 Skill 明确要求时使用。
- 每个任务最多两次后端回退；未认证必须明确报告，不得伪装成“没有内容”。
- 用户明确点名后端时，以用户指令为最高优先级。

完整平台矩阵、回退链、安全边界和验收标准见 [references/feng-web-routing-v2.md](references/feng-web-routing-v2.md)。

## 路由表

| 用户意图 | 分类 | 详细文档 |
|---------|------|---------|
| 峰峰 Web 总路由 | routing | [references/feng-web-routing-v2.md](references/feng-web-routing-v2.md) |
| 网页搜索/代码搜索 | search | [references/search.md](references/search.md) |
| 小红书/推特/B站/V2EX/Reddit | social | [references/social.md](references/social.md) |
| 招聘/职位/LinkedIn | career | [references/career.md](references/career.md) |
| GitHub/代码 | dev | [references/dev.md](references/dev.md) |
| 网页/文章/RSS | web | [references/web.md](references/web.md) |
| YouTube/B站/播客字幕 | video | [references/video.md](references/video.md) |

## 零配置快速命令

```bash
# Exa 网页搜索
mcporter call 'exa.web_search_exa(query: "query", numResults: 5)'

# 通用网页阅读
curl -s "https://r.jina.ai/URL"

# GitHub 搜索
gh search repos "query" --sort stars --limit 10

# YouTube 字幕（注意：B站不要用 yt-dlp，见 video.md）
yt-dlp --write-sub --skip-download -o "/tmp/%(id)s" "URL"

# V2EX 热门
curl -s "https://www.v2ex.com/api/topics/hot.json" -H "User-Agent: agent-reach/1.0"

# B站搜索（bili-cli，无需登录）
bili search "query" --type video -n 5
```

## 需登录态的平台（按 doctor 的 active_backend 选命令）

```bash
# Twitter 搜索（twitter-cli 首选；失败重试链见 social.md）
twitter search "query" -n 10

# Reddit（无零配置路径：OpenCLI 或 rdt-cli，必须登录态）
opencli reddit search "query" -f yaml   # 桌面
rdt search "query" --limit 10            # 存量/服务器

# 小红书（桌面首选 OpenCLI）
opencli xiaohongshu search "query" -f yaml
```

## 环境检查

```bash
# 检查可用 channel 与每个平台当前激活的后端
agent-reach doctor --json
```

## 工作区规则

**不要在 agent workspace 创建文件。** 使用 `/tmp/` 存放临时输出，`~/.agent-reach/` 存放持久数据。

## 评估新的搜索后端 / MCP 项目

当用户要求分析一个候选 Web 搜索、爬取、研究或本地缓存项目时，不要只总结 README：

1. 先用 `agent-reach doctor --json` 画出现有能力矩阵，判断候选项目是补缺、重叠还是替代。
2. 核验第一方仓库、版本、许可证、Issue、依赖审计、资源需求和维护者集中度。
3. 用临时 HOME / DATA_DIR 隔离试跑，至少验证英文搜索、中文搜索、已知 URL 抓取和缓存回查；区分内部查询耗时与一次性进程启动耗时。
4. 单独评价本地 stdio MCP 与公网 HTTP 服务的安全性；不要因本地模式可用就推导公网部署安全。
5. 对 Hermes 接入先白名单少量只读工具，避免与现有 browser、cron、delegation、research 推理重复。
6. 清理临时文件并恢复测试时修改的 HOME、缓存和环境变量；删除临时 workdir 前先切回安全目录。

详细清单与一次 Wigolo 评估样例见 [references/local-search-backend-evaluation.md](references/local-search-backend-evaluation.md)。样例中的版本与漏洞结论只作历史证据，采用前必须重新核验当前版本。

## 评估托管/云搜索 API、官方 Skill 与 MCP

当候选搜索能力由云厂商提供，而本地仅运行 Skill/MCP 客户端时：

1. 明确写成“本地客户端调用云 API”，不得称为本地搜索或离线部署。
2. 用户提供了文章/链接时先读原文，再用官方 API、计费、配额、服务条款和第一方仓库逐项核验；作者案例与可复核事实分开写。
3. 不只看功能：检查查询和结果是否出机、审查/训练政策、区域许可、内容存储归档限制和对外服务义务。
4. 按“第一方 Skill → 第一方 MCP/直接 API → 社区 MCP”的顺序评估；对 MCP 做真实 `tools/list` 握手，并检查浮动依赖是否需要 commit + lock 固定。
5. 没有真实 Key 时可以用 dummy Key 验证 DNS/TLS/鉴权错误形态，但不得据此声称搜索质量已实测。
6. 设计与 Exa、Jina、Browser、平台专用渠道、本地知识库的查询路由，不把新后端设成无差别全局替代。
7. 当前用户偏好直接在对话中发送凭据；收到后立即通过 stdin 写入 Hermes 秘密环境，不回显、不放进 shell 参数、Git、Skill 或日志。

完整清单、服务条款陷阱和一个豆包搜索的日期化案例见 [references/cloud-search-backend-evaluation.md](references/cloud-search-backend-evaluation.md)。案例事实采用前必须重新核验官方文档。

## 详细文档

根据用户需求，阅读对应的详细文档：

- [搜索工具](references/search.md) — Exa AI 搜索
- [社交媒体](references/social.md) — 小红书, Twitter, B站, V2EX, Reddit（多后端命令组）
- [职场招聘](references/career.md) — LinkedIn
- [开发工具](references/dev.md) — GitHub CLI
- [网页阅读](references/web.md) — Jina Reader, RSS
- [视频播客](references/video.md) — YouTube, B站, 小宇宙

## 配置渠道

如果某个 channel 需要配置，获取安装指南：
https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md

用户只需提供 cookies，其他配置由 agent 完成。
