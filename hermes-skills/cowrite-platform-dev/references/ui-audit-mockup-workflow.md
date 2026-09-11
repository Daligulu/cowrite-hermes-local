# 全页面 UI 体检 + 优化后样例图工作流（方案先行）

用户在需要「全面评估 Cowrite 各页面有无优化空间，先出优化方案 + 各页优化后样例图，确认后再开发」时走本工作流。**延续「AI 仅提供方案示例、确认后才动码」纪律——本类任务不可直接改代码，交付物是方案 + 样例图。**

## 触发词
- 全面评估 / 体检 Cowrite 各页面 / 有无优化空间
- 先做个优化方案 + 各页优化后样例图 / 预览图
- 延续此前多轮 UI 优化的系统性版本（单点改动 → 全分页体检）

## 四步流程

### 1) 现状基线：逐视图截图
`scripts/cdp-verify.js` 只能截一页（单 URL）。此处需用 `scripts/shot-all-views.js`：

```bash
node scripts/shot-all-views.js 'http://127.0.0.1:4320/<public-path>/' /tmp/cowrite-shots 1280 900
```

- 点击侧边栏 `.sidebar-tool`（按 `.sidebar-tool-label` 文本匹配「首页/项目/Skill 管理/动作配置/任务中心」）切换视图 → `Page.captureScreenshot`。
- 桌面视口 1280×900（评估/演示更清晰）；**真实验收才用 390×844 移动端**。
- 视图清单：`workspaceView: 'home' | 'project' | 'skill-manager' | 'action-config' | 'tasks' | 'page'`。
- 编辑页（`page`）需单独点开 `.home-row`（避开「贴图草稿」前缀，用标题匹配点纯文章页）；「新建页面」弹窗是 `.new-page` 按钮触发，分步脚本见 `scripts/shot-all-views.js` 同目录套路。

### 2) 体检共性问题清单（逐页核对）
- **图标规范**：卡片/导航/任务图标若用 emoji（📥🗂🧩🎯⚙），在 headless Chrome / 飞书 WebView 上渲染成 broken 灰框（带 X 的占位）或空白。修复方向 = 统一同规格内联 SVG（见 `references/nav-icon-svg.md`、`references/sidebar-icon-unification.md`）。
- **状态/情绪色统一**：动作配置等页的「保存」是否用了该页面孤立的颜色，与全站渐变主按钮不一致。
- **元素裁切**：侧边栏 fixed 覆盖 + 左侧内容未预留缩进时，左侧列表标题会被裁（如动作配置列表「调色文章」被切一半）。
- **工具栏层次**：编辑页回退/恢复/主题/配图/排版/预览是否平铺无分组。
- **空态强弱**：面板（如项目工作区 SKILLS）空态只有一行说明、无主导航。

### 3) 优化后样例图：方案C token 高保真 mockup
- token 来源 `src/index.css :root`：`--primary #2F5BEA`、`--accent-end #6E56CF`、`--canvas #FCFCFD`、`--success #30A46C`、`--error #E5484D`、`--warning #F0A92B`。
- 设计系统骨架：`templates/cowrite-mockup-base.css`（已含首页/编辑页/任务中心/动作配置/Skill 管理五大组件类）。
- 每页一个自包含 HTML，头部 `<link rel="stylesheet" href="base.css">`，只写该页 body。
- 渲染成 PNG：
  ```bash
  node scripts/mockup-render.js /tmp/cowrite-mockups /tmp/cowrite-mockups-png
  ```
  （file:// 渲染；脚本自动按 `.frame` 高度设置视口截图。）

### 4) 交付：飞书文档（方案正文 + 各页样例图）
能用 `lark-cli docs +create --as user`（XML）建正文，再 `+media-insert` 逐张插图。**关键心法**：样例图是 mockup（file:// 渲染），不是真实页面改动——交付时明确「未改代码，确认后再落地」，并把每页验收点列出。

## 飞书 media-insert 坑（实操踩过，2026-09-02）
1. **循环插入重复**：`+media-insert` 循环里若把输出 pipe 给 python 解析校验，底层命令可能已成功（`"ok": true`），python 报错只影响你看到的结果，图实际已插入 → 6 张图被插成 12 张。正确做法：**裸跑**命令看原始输出；插入后 `docs +fetch --detail full` 数 `<img>` 块数核对。
2. **`--scope` 合法值**：`full/outline/range/keyword/section`，**没有 `with-ids`**（`with-ids` 是 `--detail` 的参数值）。要拿 block_id 用 `--detail full`（content 内 `<img id="...">` 带块 id）。
3. **删重复块**：`docs +update --command block_delete --block-id "id1,id2,..."`（逗号分隔批量，`--revision-id -1` 最新版）。
4. **图片尺寸**：`+media-insert ... --width 1000 --align center` 明确指定；否则高度较大的图（竖图/长图）会被压成 `height=100` 小图。

## 验收（确认后落地代码时）
- 133/133 vitest + tsc + build 三连（仅动 CSS 不影响单测，仍跑齐）。
- CDP 断言：首页 5 卡片图标全部 SVG 无 broken 框；动作配置左侧标题完整不裁切；编辑页工具栏 390px 无横向溢出。
- 飞书 WebView 打开正常（无 emoji broken、无缓存旧 UI）。
