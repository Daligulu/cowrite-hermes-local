# 从参考文章逆向排版 → 新增主题（可复用配方）

> 场景：用户给一篇微信公众号文章（URL），要求分析其排版（含文末点赞组件）并沉淀为 gzh-design 新主题。
> 2026-09 验证通过（新增「衬线绿色方格纸」主题，id=`serif-green`）。本文是**跨工具**配方：既涉及
> gzh-design 主题库登记，也涉及 Cowrite 平台动作配置同步——漏掉后者 Worker 就选不到新主题。

## 1. 抓取文章真实排版（不要只看文字）

公众号正文在一个 `id="js_content"` 的 div 里，样式是**内联 style**。web_extract 只给文字拿不到样式，
必须抓原始 HTML：

```bash
curl -sL -A "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1" \
  "https://mp.weixin.qq.com/s/<ID>" -o /tmp/art.html
```

Python 提取 `js_content` 段（cut 到 `js_pc_qr_code` / `rich_media_tool` 等尾部标记），
采集所有 `style="..."` 去重（`from collections import Counter` 看各类出现次数），识别
正文段落 / H2 / 强调 / 引言块 / 列表 / 分割线各用哪套样式。

**风格判定（命名沿用该气质）**：
- 衬线字体栈 `'Times New Roman',Georgia,'SimSun',serif` → editorial 纸感（如 衬线绿色方格纸）。
- 无衬线栈 `-apple-system,BlinkMacSystemFont,'PingFang SC',... sans-serif` → 现代卡片杂志。

**注意**：原文文末「点赞/在看/转发」常是**微信平台原生组件**（在 `rich_media_tool`，正文 HTML 外，
作者不可自定义），js_content 里没有。此时用 gzh-design 通用文末感谢卡（theme-thanks-card.md：
点赞♥/在看◎/转发↗ + THANKS FOR READING）补齐，而非从原文复制。

## 2. 四步登记（一个主题要跑 4 处，别漏）

1. `gzh-design/references/theme-{标识}.md`：组件库全文（全局容器/组件/骨架/视觉层级/配方表/映射规则）。
2. `gzh-design/references/theme-index.md`：登记一行（主题/主色/适用场景/组件库文件/正文下划线 CSS）。
3. `gzh-design/assets/theme-vars.json`：`themes` 下新增 `{标识}`，含 `accent/hue_range/sat_min/underline`
   + `vars[]` 角色变量（供 retint 换色、前端加载）。**id 必须与 theme-index、文件名一致**。
4. `gzh-design/references/theme-thanks-card.md`：加一整套该主题配色的文末感谢卡 HTML。

## 3. ⚠️ Cowrite 生产端同步（最容易漏，漏了 Worker 选不到新主题）

gzh-design 只是 skill 层。Cowrite 平台「公众号主题排版」动作（`gzh-layout`）的提示词里
**写死了主题对照表**（`石墨极简=graphite-minimal/…`）。新增主题必须同步改，否则 Worker 排版时无法选这套：

- 文件：`$HOME/.cowrite/action-config.json`（`ActionConfigStore` 每次 API 调用时 `load()`，
  **改文件即生效，无需重启服务**）。
- 用 Python 精准替换 `gzh-layout` 的 `prompts[0].text` 里**两处**映射（开头内联枚举 + 末尾对照表），
  各加 `<id>=<中文名>`。
- 先备份再去改：`cp -p action-config.json action-config.json.bak-$(date +%Y%m%d-%H%M%S)`。
- 验证：`curl -s http://127.0.0.1:4320/api/action-config` 读回，断言 `gzh-layout` 提示词含新 id、
  动作总数不减少。前端打开动作配置页会重新 GET，也能看到。

## 4. 校验与验收

- `python3 scripts/component_lint.py .`（gzh-design 目录下）→ **0 ERROR**（存量 WARN 不计）。
- **提取"纯正文+感谢卡"再 validate**：预览外壳（`<style>`/`<div class>`/`<h1>`）会触发校验脚本
  ERROR。用 Python 从 `</style>` 后切到最后一个 `</section>` 得到纯 gzh 片段再跑
  `validate_gzh_html.py`，结果才是「完全合规」。
- 390px 手机视口 headless chrome 截图 + vision_analyze 核对（方格纸背景/H2 绿卡/强调色/三图标居中）。
- Obsidian 归档到 `20-Projects/Cowrite-for-Hermes/`（延续既有归档路径约定）。

## 5. 坑

- **备份目录别放 skills 目录下**：`cp -rp .../gzh-design .../gzh-design.bak-*` 会让
  `skill_view('gzh-design')` 报 `Ambiguous (2 matches: …/gzh-design.bak-*/SKILL.md 与
  …/gzh-design/SKILL.md)`，拒绝猜测。备份移到 `~/.hermes/workspace/gzh-backups/`
  （skill 扫描目录之外）再继续。
- **正文字号**：新主题植根原文时正文可能是 15px/1.82（衬线纸感核心），与 gzh-design 全局基线
  16px/1.75/段距24px 不同。入库时在交付说明里明确这一点并问用户是否统一，别擅自改。
