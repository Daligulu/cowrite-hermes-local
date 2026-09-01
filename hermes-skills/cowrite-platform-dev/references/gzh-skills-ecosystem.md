# 外部 gzh-Skills 生态与 Cowrite 结合（2026-08 分析）

## 来源与生态关系
- 仓库：`github.com/SpaceZephyr/creator-buddy`，目录 `gzh-Skills/`。作者「空格.space」（X @kongge_space，公众号三年三万余粉）。
- **关键事实**：`SpaceZephyr` 与 Cowrite 上游仓库 `SpaceZephyr/cowrite` **同一作者生态**——`creator-buddy` 是该作者独立的内容创作 skill 库，可信度与契合度高，是外部 skill 适配 Cowrite 的高优先级候选源。
- 文章《10 个 Skill 搭建日更爆文的公众号写作系统》核心结论：**50% 选题、30% 标题封面、20% 行文**；方法论=把「想」和「写」分开、人定骨架 AI 填肉（完形填空 xxx 占位）、一套内容多次使用。

## 下载原始 SKILL.md（免 token）
```bash
BASE="https://raw.githubusercontent.com/SpaceZephyr/creator-buddy/main/gzh-Skills"
for s in gzh-positioning baokuan-article-analysis gzh-explosive-content-detector \
         gzh-longform-writer gzh-short-post baokuan-title-generator \
         space-gzh-cover space-chart-image space-text-logic-diagram space-wechat-layout; do
  curl -s -o "$s/SKILL.md" --create-dirs "$BASE/$s/SKILL.md"
done
```
仓库根目录结构：树接口 `https://api.github.com/repos/SpaceZephyr/creator-buddy/git/trees/main?recursive=1`。

## 10 个 Skill 简表与 Cowrite 现状
| Skill | 做什么 | Cowrite 现状 / 差距 |
|---|---|---|
| gzh-positioning | 定位三件套（简介/关注回复/菜单），一句话定位派生 | 无此环节，新号冷启动入口 |
| baokuan-article-analysis | 赛道爆款分析，脚本出 data.json + report.html | 选题只走私有渠道（obsidian/ima/aihot），缺全网爆款数据 |
| gzh-explosive-content-detector | 每日低粉高阅读探测，泛化词先问再查 | 同上；其「泛化词治理」值得借鉴 |
| gzh-longform-writer | 长文 1500-4000 字，素材诊断→六写法路由 | polish 是泛泛去AI腔润色，缺进攻式写作 |
| gzh-short-post | 短文 ≤1000 字纯文字，风格纪律+12项检查清单 | 无此赛道 |
| baokuan-title-generator | 批量标题+评分+按用途分角色+AB | **本地已有适配版**，但没接成 Cowrite action |
| space-gzh-cover | 2.35:1 头图，分享安全区校验 check_cover.py | 配图只有正文插图，缺封面 |
| space-chart-image | 10 类图表 + 6 风格 | illustrate 是意境插图，缺精确图表 |
| space-text-logic-diagram | 文本→逻辑关系图（SVG/HTML） | 同上；HTML/SVG 输出更贴近 gzh 排版链路 |
| space-wechat-layout | 整篇排版，Claude/OpenAI/Google 三风格 | **已被 gzh-design 超越**，不引入 |

## 结合优先级（依据「50/30/20」权重 + Cowrite 接入成本）
- **P0（低成本高价值）**：① baokuan-title-generator 接成「起标题」action（东西现成）；② 新增 gzh-short-post「短文写作」；③ 新增 space-gzh-cover「头图封面」（补发布链路真缺口）。
- **P1（补管道）**：① baokuan-article-analysis / gzh-explosive-content-detector 作为新选题渠道或独立 action（填「50%选题」数据源）；② gzh-longform-writer 长文六写法；③ space-chart-image / space-text-logic-diagram 图表/逻辑图配图。
- **P2（待确认）**：gzh-positioning 定位三件套；完形填空 xxx 占位；灵感捕获/草稿冷却提醒；视频化+多平台分发。
- **不引入**：space-wechat-layout（gzh-design 已超配）。其值得借鉴仅「内容不改写仅排版轻调整」「复制 HTML 交互」，但已做得更好。

## 纪律备注
与用户既定规则一致：外部 skill 从第一方源码适配；改 Cowrite 前先出方案+飞书文档、待确认再开发；每批先完整备份、再合并、真实验收、观察后删。本分析只产出方案，不开发代码。
