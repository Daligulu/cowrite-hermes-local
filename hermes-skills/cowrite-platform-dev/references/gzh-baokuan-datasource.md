# gzh 爆款数据源（baokuan-article-analysis / gzh-explosive-content-detector）

两个 skill 共用一个公开数据源，2026-08 实测可用，无需鉴权，但有几个坑要记住（`scripts/` 里已内置处理逻辑，
改脚本/自建调用时别踩）：

## 端点与鉴权
- URL：`https://onetotenvip.com/skill/cozeSkill/getWxCozeSkillData`
- 参数：`keyword`（赛道词，空 = 全站）+ `source=公众号爆款文章洞察-SkillHub`
- **无 token / 无 API key**，只要 `User-Agent`（如 Mozilla Chrome）即可。
- 返回 `gzip + chunked`，必须按 chunked 读再按 `content-encoding`（gzip）解压，拿到的才是真 body；
  否则直接看原始字节是 `\x1f\x8b\x08...`（gzip magic）+ 十六进制 chunk 长度。
- 该服务器需要 **no-SNI 握手**（python `ssl` 用 `server_hostname=None` + `check_hostname=False`）
  普通 curl / urllib 默认 SNI 可能连接失败（表现为 HTTP 000 / 握手被拒）。脚本内 `fetch_via_no_sni` 已处理。

## 两个 skill 的字段（口径不同）
- `explosive`（每日爆款，`gzh-explosive-content-detector`）：`fetch_gzh_trends(keyword)`
  → 4 个榜各 50 条：`low_fan_explosive`(低粉高阅读) / `top_read`(阅读靠前) /
  `trending`(数据增长) / `original`(原创靠前)；条目字段 `title / userName / clicksCount / oriUrl / fans / publicTime`。
- `baokuan`（赛道分析，`baokuan-article-analysis`）：`fetch_keyword(keyword, startDate, timeout)`
  → 每赛道 ~200 条；字段 `title / summary / accountName / fans / publicTime / noteLink / photoId / interactiveCount / likeCount`；
  阅读/粉丝常是带单位字符串（`10w+`/`100w+`），脚本用 `parse_count` 归一。`noteLink` 为空时用 `photoId` 拼 mp.weixin.qq.com 链接。

## 可用性核查
- 数据源连通：数据源确认阶段先用「脚本原版的 no-SNI 函数」直接调 `fetch_gzh_trends('')`，
  拿到 4 榜×50 真实条目即证明可用；不要用普通 curl 判断（curl 可能因 SNI 连不上而误判不可用）。
- Hermes 环境脚本路径：`~/.hermes/skills/creative/<skill>/scripts/<...>.py`（注意 SKILL.md 原文写的
  `~/.codex/skills/...` 是 Codex 环境路径，在 Hermes 要换成 `~/.hermes/skills/creative/...`）。
- 边界：`today` 数据可能未更新（有固定话术），>30 天不支持；`clicksCount` 是快照非实时。

## 泛化词治理（只会用 explosive skill 时）
- `职场/情感/AI` 这类大类宽泛词 **禁止直接跑脚本**，必须先给细分词推荐并等用户选「拓展/不拓展」；
  只有带场景/属性的具体词（如「职场沟通技巧」「亲子教育」）才可直接查。
- 在 Worker 无人值守场景落地时，这条「先问再查」要转成「在结果/回复里给出细分推荐 + 提示用户选择」，
  不能在同一轮直接跑脚本（见 external-skill-action-integration.md 的设计约束）。
