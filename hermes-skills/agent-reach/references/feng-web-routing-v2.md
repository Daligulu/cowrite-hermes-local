# 峰峰 Web 路由 v2

## 目标

把联网任务按原始数据源、平台、发现、提取和浏览器分层。优先使用可验证的专用渠道；Browser 只做最后兜底；私有数据不发送给公共搜索服务。

## 决策顺序

```text
本地/私有数据源
→ 平台专用 Skill 或 Agent Reach 对应 channel
→ 通用搜索
→ 正文提取
→ Browser 兜底
```

用户明确点名工具或后端时，该指令优先。

## 第 0 层：本地与私有数据

- 飞书文档、Wiki、Drive、Sheets、消息、日历、任务：对应 Lark Skill。
- Obsidian、Memos、Hermes Wiki、IMA、本地文件、历史会话：对应本地工具或 Skill。
- 有原始数据源时，不从公网重新搜索；不得把私有 URL、查询或未公开正文提交给 Tavily、豆包、Exa、Jina 等云服务。

## 第 1 层：平台专用路由

| 平台 | 首选 | 回退 |
|---|---|---|
| GitHub | `gh` / GitHub Skill | Browser 仅用于视觉页面 |
| 微信公众号 | `wechat-query` 缓存/接口 | `wechat-article-camofox-local` → Browser DOM |
| 抖音 | `douyin-creator-transcriber` / JZSub | Browser 只辅助识别或登录 |
| YouTube | Agent Reach `yt-dlp` | Browser |
| B站 | Agent Reach `bili-cli` | Browser/登录后端 |
| V2EX、RSS | Agent Reach 对应公开后端 | 原始 URL |
| 小红书 | `xiaohongshu` 专用 Skill | Agent Reach 仅在 doctor 显示可用时 |
| X/Twitter | Agent Reach doctor 后使用认证后端，或用户明确指定 `xitter`/`xurl` | 未认证则报告，不伪装成功 |
| 飞书 | Lark 原生 Skill | 不用公网 Web 读取可直连资源 |

平台 URL 不先走通用 `web_extract`。

## 第 2 层：网页发现

```text
中文时效/政策/金融/国内公司 → 豆包 Custom
要求官方/权威               → 豆包 Custom --auth-level 1，并打开原始 URL
跨语言长摘要                 → 豆包 Global（仅在独立 Global Key 已配置时）
普通网页                     → Hermes 原生 Tavily
英文技术/海外语义深研         → Tavily 首轮，Exa 补充
```

复杂研究按主题拆成 2–3 个互补查询，不把单一后端当作最终证据。

## 第 3 层：已知普通 URL

```text
web_extract
→ Jina Reader
→ Browser
```

只对普通公开网页使用。若 `web_extract` 已返回非空完整正文，不再启动 Browser。

## 第 4 层：Browser 触发条件

只有出现下列情况才启动 Browser：

- 正文提取为空、明显截断或结构错乱；
- 必须执行 JavaScript；
- 需要登录态、点击、翻页、表单或视觉布局；
- 平台专用 Skill 明确要求浏览器；
- 出现验证页，需要读取 DOM/截图判断。

## 失败回退

```text
中文时效：豆包 Custom → Tavily → 官方原始 URL
普通发现：Tavily → Exa → 站内搜索/Browser
英文技术：Tavily → Exa → GitHub/官方文档
普通提取：web_extract → Jina → Browser
平台内容：专用 Skill → 可用的 Agent Reach channel → Browser/明确认证缺口
```

每个任务最多两次后端回退。连续失败后报告阻塞点，不循环重试，不把“未认证”写成“没有内容”。

## 高风险事实核验

政策、医疗、金融、安全和付费决策：

1. 搜索结果只作候选证据；
2. 打开官方或第一方原始 URL；
3. 至少用第二条独立来源交叉核验；
4. 回复中区分事实、推断和未验证信息。

## 当前主机策略

- 保持原生 Web 为 Tavily 搜索 + Tavily 提取。
- 暂不部署 SearXNG：主机资源与维护收益不匹配。
- 暂不增加 Firecrawl：只有普通网页提取失败率持续超过 10%–15%、PDF/动态页需求明显上升或 Browser 兜底过高时再评估 `Tavily search + Firecrawl extract`。
- Browser 使用本机 Camofox；私有服务默认仅监听 loopback。

## 验收标准

- 平台 URL 专用路由命中率 ≥95%。
- 普通网页首次成功率 ≥90%。
- 路由误判 ≤5%。
- 私有数据误发公共 Provider 为 0。
- 未认证平台误报成功为 0。
- 不出现无限重试；Browser 只在触发条件满足时使用。
