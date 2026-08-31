# hermes-skills — Cowrite 平台关键 Skills 归档

> 归档时间：2026-08-21
> 目的：Cowrite 平台（本地 Hermes 适配版）所有关键功能依赖的 Hermes Skills 完整副本。
> 重建时把本目录内容放回 Hermes skills 目录即可恢复平台全套创作能力。

## 目录

- [A. 动作执行层（14 个）](#a-动作执行层14-个)
- [B. 平台开发/运维层（3 个）](#b-平台开发运维层3-个)
- [C. 上游内置示例层（8 个，仓库原有，未改动）](#c-上游内置示例层8-个仓库原有未改动)
- [恢复方法](#恢复方法)
- [运行时外部依赖](#运行时外部依赖)
- [同步机制](#同步机制)

## A. 动作执行层（18 个）

Cowrite 动作配置（`server/actionConfig.ts` / `/root/.cowrite/action-config.json`）action 直接引用的 skills：

| Skill | 对应 action | 功能 |
|---|---|---|
| `wewrite` | wechat-layout | 公众号写作+排版+发布引擎 |
| `humanizer-zh` | polish / wechat-sticker / topic-create | 中文去 AI 味润色 |
| `gzh-design` | wechat-layout（wewrite 依赖） | 石墨极简公众号排版引擎 |
| `apiyi-image-generation` | illustrate / xiaohongshu / wechat-sticker / topic-create | ApiYi 文生图/图生图 |
| `feng-ip` | feng-ip | 峰峰个人 IP 怪诞手绘配图（21 张身份素材 + 门禁脚本） |
| `dashiai-ppt` | slides | PPT 演示生成（149MB 模板资源） |
| `xiaohongshu` | xiaohongshu | 小红书内容与图组 |
| `lark-doc` | feishu-doc | 飞书云文档读写 |
| `feng-knowledge-base` | knowledge-base | 峰的知识库（LLM Wiki + wikilinks） |
| `feng-video` | video | 16:9 知识分享视频 |
| `wechat-sticker-publisher` | wechat-sticker / publish-sticker | 微信贴图发布到草稿箱 |
| `obsidian` | topic-collect（渠道） | Obsidian 笔记库检索 |
| `ima` | topic-collect（渠道） | IMA 知识库检索 |
| `aihot` | topic-collect（渠道） | AI HOT 热点检索 |
| `baokuan-title-generator` | baokuan-title | 爆款标题批量生成+评分+按用途分角色推荐 |
| `gzh-short-post` | gzh-short-post | 公众号短文 ≤1000 字纯文字，风格纪律+12 项检查 |
| `space-gzh-cover` | space-gzh-cover | 2.35:1 公众号头图，分享安全区校验（check_cover.py） |
| `baokuan-article-analysis` / `gzh-explosive-content-detector` | baokuan-research | 赛道爆款数据分析，脚本出 report.html，含泛化词治理 |

## B. 平台开发/运维层（3 个）

| Skill | 用途 |
|---|---|
| `cowrite-platform-dev` | Cowrite 平台开发/部署/验收全流程知识（项目地图、部署流水线、CDP 验收） |
| `byted-web-search` | Worker 中文时效/政策/金融检索路由（豆包搜索） |
| `agent-reach` | Worker 平台站内内容检索路由（小红书/知乎/公众号等） |

## C. 上游内置示例层（8 个，仓库原有，未改动）

`../skills/` 下的 8 个上游自带示例 skill（ai-writing-assistant、space-wechat-layout、baoyu-xhs-images、image-studio 等），保持原样。

## 恢复方法

把本目录下各 skill 放回 Hermes 的 skills 根目录，保持目录名不变即可被 Hermes 自动发现：

```bash
# 以本机为例（恢复路径）
HERMES_SKILLS=/root/.hermes/skills
for d in hermes-skills/*/; do
  name=$(basename "$d")
  cp -r "$d" "$HERMES_SKILLS/$name"
done
```

> 注意：本机实际是分散在分类子目录下的（如 `creative/feng-ip`、`productivity/wewrite`、`research/aihot`）。Hermes 支持扁平与分类两种存放；如需完全还原原分类结构，按下表放置：
> - `creative/`：humanizer-zh、gzh-design、apiyi-image-generation、feng-ip
> - `productivity/`：wewrite、wechat-sticker-publisher、ima、wechat-article-publishing
> - `social-media/`：xiaohongshu
> - `note-taking/`：feng-knowledge-base、obsidian
> - `media/`：feng-video
> - `research/`：aihot、byted-web-search、agent-reach
> - `software-development/`：cowrite-platform-dev
> - 顶层：dashiai-ppt、lark-doc

## 运行时外部依赖

以下不在本仓库（属运行环境/凭据，重建时需另行配置）：

| 依赖 | 说明 |
|---|---|
| `lark-cli` + `lark-shared` | lark-doc 前置依赖（飞书认证与 CLI），lark-shared 在 Hermes 顶层 skills 目录 |
| `~/.cowrite/wechat-accounts.json` | wechat-sticker-publisher 的公众号凭据（AppID/AppSecret），**不随仓库分发** |
| `APIYI_API_KEY` | feng-ip / apiyi-image-generation 生图密钥（环境变量或 `.env`） |
| `CONSISTENCY_VISION_API_KEY` | feng-ip 一致性门禁用视觉模型密钥（可选） |
| `/etc/cowrite-hermes.env` | Cowrite 平台环境变量（含 MCP token 等） |
| Hermes venv 解释器 | feng-ip 脚本需 Python 3.11+（`/root/.hermes/hermes-agent/venv/bin/python3`），系统 python3.9 会报 TypeError |
| tesseract OCR | 视觉识别（chi_sim+eng），本地看图兜底 |

## 同步机制

- **策略**：一次性归档 + 手动同步（2026-08-21 确认）
- 本地 skill 后续更新不会自动进仓库；需要更新时重新 `cp -r` 对应目录并 push
- 更新后请在本文档标注归档时间/变更说明
