# 本地 Web 搜索 / MCP 后端评估方法

用于评估 Wigolo、SearXNG 封装、本地 RAG 搜索层等候选项目。不要只复述 README；必须把“能安装”与“适合接入现有搜索栈”分开判断。

## 评估顺序

1. **核验第一方来源**
   - 仓库、发布版本、许可证、最后提交、Issue、贡献者集中度。
   - 检查项目处于 beta / stable，以及声明的 benchmark 是否由项目方自行完成。
2. **检查宿主与现有搜索栈**
   - Node/Python、架构、glibc、磁盘、内存、Swap、已有常驻进程。
   - 先跑 `agent-reach doctor --json`，列出当前已覆盖的平台与后端；新项目必须说明“补缺、重叠还是替代”。
3. **检查依赖和攻击面**
   - 阅读 package/lock、安装脚本、隐私与安全文档；运行生产依赖审计。
   - 搜索开放的 SSRF、路径穿越、远程绑定、认证、浏览器会话与缓存权限问题。
   - 本地 stdio MCP 与公网 HTTP 服务的风险等级必须分开评价。
4. **隔离试跑**
   - 使用临时 HOME / DATA_DIR / npm cache，不写正式 Hermes 配置。
   - 至少真实跑：doctor、英文搜索、中文搜索、已知 URL fetch、cache stats/search。
   - 同时记录内部耗时与进程启动墙钟耗时；一次性 CLI 的启动成本不应误判为长连接 MCP 的查询延迟。
5. **验证搜索质量而非只验证退出码**
   - 检查品牌词、歧义词、中文/CJK、官方域名定向、失败引擎告警。
   - 若关闭 reranker/embedding，明确标注测试是“降级模式”；不要把降级结果代表成完整能力。
6. **形成路由建议**
   - 明确适合：通用 Web、技术文档、整站 crawl、缓存、结构化提取、变化监控等。
   - 明确不替代：登录态社交平台、字幕、GitHub 写操作、中文平台专用检索等。
   - 对 Hermes MCP 默认先白名单 3–6 个只读工具；避免把候选项目的 research/agent/browser/watch 全部开放，造成与 Hermes 推理、browser、cron、delegation 重叠。
7. **清理和恢复环境**
   - 删除临时 clone、缓存、模型和测试数据。
   - 若测试中 export 过 `HOME`、`npm_config_cache` 或项目变量，结束前恢复并验证 GitHub/CLI 认证仍可见。
   - 不要删除当前 shell 的工作目录；若临时 workdir 将被删，先切回安全目录。

## 2026-07 Wigolo v0.2.1 评估摘要

- 第一方：<https://github.com/KnockOutEZ/wigolo>，AGPL-3.0-only，Node >=20，Public Beta。
- 核心增益：无 Key 多引擎搜索、fetch/crawl/extract、SQLite FTS/向量缓存、diff/watch、MCP/REST/CLI。
- Hermes 适配：stdio MCP 协议直接兼容；适合先暴露 `search`、`fetch`、`cache`，必要时再加 `crawl`、`extract`、`diff`；建议关闭 server sampling，避免与 Hermes 自身推理重叠。
- 实测方法：隔离 HOME，关闭 reranker，完成 doctor、中文/英文 search、Hermes 官方文档 fetch 和 cache 回查；中文通用网页召回可用，英文品牌歧义在无 reranker 的 fast 模式下排序较差。
- 资源：模型约 250 MB、浏览器约 0.5–1 GB；npm 依赖缓存可能明显大于包体。小内存 VPS 应 `MAX_BROWSERS=1`，优先复用 Hermes Browser 处理 JS/登录态页面。
- 不替代 Agent Reach：缺少 B 站/YouTube 字幕、X/小红书/Reddit 登录态、GitHub 写操作等平台专用能力；中文搜索仍缺百度/搜狗等成熟后端。
- 安全：当次 `npm audit --omit=dev` 检出多项生产依赖告警，且仓库仍有 SSRF/CJK 相关开放 Issue；正式采用前必须重新审计当前版本。只建议本地 stdio 或隔离试用，不根据这份历史摘要永久判定未来版本。
