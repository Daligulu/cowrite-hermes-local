# hermes-skills — Cowrite 平台关键 Skills 归档

> 首次归档：2026-08-21　|　最近全量同步：2026-09-11（北京时间）
> 目的：Cowrite 平台（本地 Hermes 适配版）所有关键功能依赖的 Hermes Skills 完整副本。
> 重建时把本目录内容放回 Hermes skills 目录即可恢复平台全套创作能力。

## 目录

- [A. 动作执行层（26 个）](#a-动作执行层26-个)
- [B. 平台开发/运维层（3 个）](#b-平台开发运维层3-个)
- [C. 上游内置示例层（8 个，仓库原有，未改动）](#c-上游内置示例层8-个仓库原有未改动)
- [恢复方法](#恢复方法)
- [运行时外部依赖](#运行时外部依赖)
- [同步机制](#同步机制)
- [同步记录](#同步记录)

## A. 动作执行层（26 个）

Cowrite 动作配置（`server/actionConfig.ts` / `/root/.cowrite/action-config.json`）action 直接引用的 skills：

| Skill | 对应 action | 功能 |
|---|---|---|
| `wewrite` | wechat-layout | 公众号写作+排版+发布引擎 |
| `humanizer-zh` | polish / wechat-sticker / topic-create | 中文去 AI 味润色 |
| `gzh-design` | wechat-layout（wewrite 依赖） | 石墨极简公众号排版引擎（含 serif-green / serif-navy 衬线双配色） |
| `wechat-article-publishing` | wechat-layout / gzh-layout | 公众号 HTML 排版发布工程知识（主题从参考文章迁移、跨主题排版同步、草稿读回） |
| `apiyi-image-generation` | illustrate / xiaohongshu / wechat-sticker / topic-create | ApiYi 文生图/图生图（支持 `--size` 显式像素尺寸） |
| `agnes-ai-generation` | illustrate / topic-create（免费备选） | 免费备选图源，主接口失败时兜底（agnes_api.py） |
| `baoyu-infographic` | wechat-sticker（配图引擎） | 信息图生成引擎（bento-grid / dense-modules 等版式×风格，3:4 竖版中文信息图） |
| `feng-ip` | feng-ip | 峰峰个人 IP 怪诞手绘配图（身份素材 + 门禁脚本） |
| `dashiai-ppt` | slides | PPT 演示生成（149MB 模板资源） |
| `xiaohongshu` | xiaohongshu | 小红书内容与图组 |
| `lark-doc` | feishu-doc | 飞书云文档读写（符号链接 → `~/.agents/skills/lark-doc`） |
| `feng-knowledge-base` | knowledge-base | 峰的知识库（LLM Wiki + wikilinks） |
| `feng-video` | video | 16:9 知识分享视频 |
| `wechat-sticker-publisher` | wechat-sticker / publish-sticker | 微信贴图发布到草稿箱 |
| `obsidian` | topic-collect（渠道） | Obsidian 笔记库检索 |
| `ima` | topic-collect（渠道） | IMA 知识库检索 |
| `aihot` | topic-collect（渠道） | AI HOT 热点检索 |
| `baokuan-title-generator` | baokuan-title | 爆款标题批量生成+评分+按用途分角色推荐 |
| `gzh-short-post` | gzh-short-post | 公众号短文 ≤1000 字纯文字，风格纪律+12 项检查 |
| `gzh-longform-writer` | gzh-longform | 公众号长文 1500–4000 字，素材诊断→六写法路由 |
| `baokuan-article-analysis` | baokuan-research | 赛道爆款数据分析，脚本出 report.html，含泛化词治理 |
| `gzh-explosive-content-detector` | baokuan-research | 爆款内容数据源与检测 |
| `space-gzh-cover` | space-gzh-cover | 2.35:1 公众号头图，分享安全区校验（check_cover.py） |
| `space-chart-image` | space-chart | 公众号图表配图，10 类图表×6 风格，出图 PNG |
| `space-text-logic-diagram` | space-logic | 正文拆逻辑关系图，自包含 HTML 含 SVG，6 种关系 |
| `broll-hyperframes` | gzh-video | 公众号 9:16 竖屏知识 B-roll 视频，方案B 压缩男声 + Pillow/ffmpeg |

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

> 注意：本机实际是分散在分类子目录下的，Hermes 支持扁平与分类两种存放；如需完全还原原分类结构，按下表放置：
> - `creative/`：humanizer-zh、gzh-design、apiyi-image-generation、agnes-ai-generation、baoyu-infographic、feng-ip、gzh-explosive-content-detector、gzh-longform-writer、gzh-short-post、baokuan-article-analysis、space-chart-image、space-gzh-cover、space-text-logic-diagram
> - `productivity/`：wewrite、wechat-sticker-publisher、wechat-article-publishing、ima
> - `social-media/`：xiaohongshu、baokuan-title-generator
> - `note-taking/`：feng-knowledge-base、obsidian
> - `media/`：broll-hyperframes、feng-video
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
| `~/.cowrite/action-config.json` | 动作配置（Worker 执行规则、skills/prompts/workflow），**独立于本仓库** |
| `~/.cowrite/channel-config.json` / `style-config.json` | 选题渠道与风格预设（同上，独立文件） |
| Hermes venv 解释器 | feng-ip 脚本需 Python 3.11+（`/root/.hermes/hermes-agent/venv/bin/python3`），系统 python3.9 会报 TypeError |
| tesseract OCR | 视觉识别（chi_sim+eng），本地看图兜底 |

## 同步机制

- **策略**：一次性归档 + 手动同步（2026-08-21 确认）
- 本地 skill 后续更新不会自动进仓库；需要更新时用 rsync 同步对应目录并 push：
  ```bash
  cd /root/.hermes/workspace/cowrite-hermes-local
  rsync -a -c --exclude='__pycache__/' --exclude='.git/' \
        --exclude='*.bak-*' --exclude='*.corrupt-*' \
        /root/.hermes/skills/<分类>/<skill>/ hermes-skills/<skill>/
  git add -A && git commit -m 'chore(hermes-skills): 镜像同步 <skill>' && git push origin hermes-local-impl
  ```
- **排除项**：`__pycache__/`、`.git/`、`*.bak-*`（历史备份）、`*.corrupt-*`（损坏配置备份）——已在仓库 `.gitignore` 登记
- 用 `rsync -a -c`（校验和比较）而非默认大小+时间比较，避免只改 mtime 的文件被误判为变更
- 更新后请在本文档「同步记录」标注时间与变更说明
- **完整性自检**（同步后跑一次）：把镜像与本地逐个比对，并核对 `action-config` 引用的每个 skill 是否都在镜像内
  ```bash
  cd /root/.hermes/workspace/cowrite-hermes-local
  for d in hermes-skills/*/; do n=$(basename "$d"); src=$(find -L /root/.hermes/skills -maxdepth 3 -type d -name "$n" | head -1);
    [ -z "$src" ] && { echo "本地无: $n"; continue; }; diff -rq --exclude='__pycache__' --exclude='.git' --exclude='*.bak-*' "$src" "$d" | head -3; done
  ```

## 同步记录

| 日期（北京） | 变更 |
|---|---|
| 2026-08-21 | 首次归档（A/B 层 24 个 skill） |
| 2026-08-27 ~ 2026-09-04 | 增量同步：cowrite-platform-dev（黄底横幅移除、衬线双配色主题、配图修复）、gzh-design（serif-green/serif-navy）、agnes-ai-generation（免费备选图源） |
| 2026-09-11 | 全量同步（29 个 skill）：wewrite（勾号排版修复/DRAFT_UPDATE_URL/默认主题 fresh-green）、wechat-sticker-publisher（T2I 直出+尺寸校验）、apiyi-image-generation（`--size`）、wechat-article-publishing（references 整目录）、broll-hyperframes、feng-ip、agnes-ai-generation 内容补齐；新增 `baoyu-infographic`（微信贴图配图引擎，此前遗漏）；补齐 cowrite-platform-dev 5 个 references + 2 个脚本 + 模板；新增 `scripts/cdp-audit-shots.js`；清理仓库内 2 个 `.bak` 文件并登记 `.gitignore` |
