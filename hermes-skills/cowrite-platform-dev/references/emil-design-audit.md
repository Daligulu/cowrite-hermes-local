# emil 设计工程方法论评审 Cowrite UI（2026-09-02）

## 背景
用 `emil-design-eng`（Emil Kowalski，animations.dev / Vercel/Linear 前设计师）全面评审 Cowrite 前端各视图。核心洞察：Apple 动效基础（transform-only、强 ease-out、reduced-motion、模态缩放进场）Cowrite 已在 2026-08-23 落地；emil 体系在此之上还有一批**增量**检查项，多数可用 grep 静态定位，无需运行。

## 审计检查项（按 emil-design-eng Review Checklist 落到 Cowrite）

| 检查项 | emil 要求 | 如何 grep 定位 | Cowrite 现状（2026-09-02） |
|---|---|---|---|
| 图标一致性 | 图标统一风格，跨端稳定，禁彩色 emoji | `grep -rnE "home-card-icon\|doc-icon\|↑\|↓\|✕\|🗂\|🧩\|📥\|🎯\|✍️" src/` | **缺口**：首页 5 个快捷卡是彩色 emoji（✍️🎯📥🗂🧩）、最近页面 doc-icon 字符 `▤`、动作配置列表 `↑↓✕`、编辑页「贴图」字符 |
| hover 门控 | hover 动画必须 `@media(hover:hover)` 包裹，触屏用 `:active` | `grep -rc ":hover" src/*.css` vs `grep -rn "@media (hover" src/*.css` | **缺口**：全站 ~40 处 `:hover`，**0 处** `@media(hover)` 门控 |
| 按压反馈 | 每个可点元素都有 `:active` scale(0.97) | `grep -rn ":active" src/*.css` | **部分**：仅 home-card(0.98)/skill-card(0.985)/command-primary(translateY)/mobile-tab(0.92) 有；工具栏/任务项/模态按钮/筛选 chip/主题候选等缺失 |
| `transition: all` | 禁 `all`，列具体属性 | `grep -rn "transition:\s*all" src/*.css` | **达标**：0 处 |
| popover origin | popover 从触发点缩放（`var(--transform-origin)`），模态除外 | 查 `.selector-list`/`.command-more` 的 `transform-origin` | **缺口**：`.selector-list` 固定 `transform-origin: top`，未按触发点 |
| 同入同出 | 进/退同一方向（spatial consistency） | 查 toast 的 in/out | **达标**：`.toast` in/out 均 `translate(-50%, 5px)` |
| `.scale(0)` 入场 | 禁从 scale(0) | grep `scale(0)` | **达标**：用 `scale(0.96/0.98)` |
| duration | UI 动效 <300ms | grep 各动画 duration | **达标**：0.12–0.22s |
| stub 装饰 stagger | 批量元素入场错落 30–80ms | — | **可加**（P1） |

## P0/P1/P2 优先级（给用户方案的分层）
- **P0（先落地，只动 CSS/个别 TSX，影响面小可回滚）**：①全站图标统一为同规格单色内联 SVG（`stroke=currentColor, stroke-width 1.5, viewBox 0 0 24 24`——与侧边栏/底部 Tab 已统一风格一致）；②`@media(hover:hover)` 门控所有 hover；③`:active` 按压反馈补全。
- **P1**：popover/下拉 `transform-origin` 按触发点；首页卡片入场 stagger；主按钮（保存/交给Hermes）加深渐变+投影拉开主次。
- **P2**：高频提交动效权衡（emil 主张键盘/高频交互不动画，但此处为点按可保留控制时长）；大图/媒体骨架屏 shimmer。

## 验收标准
- 首页 5 快捷卡图标全为单色 SVG、无 emoji、风格一致
- 390px 移动端无横向溢出（`documentElement.scrollWidth <= clientWidth`）
- 全站 grep 无 `@media(hover)` 门控外的裸 `:hover` 动效点
- 按压反馈覆盖所有可点元素
- 133/133 测试 + `tsc -b` + build 全绿

## 真机注入样例图技术（不写源码，只读观察，给「优化后」样图）
连本地生产实例 `http://127.0.0.1:4320/`，headless Chrome + CDP，在页面运行时：
1. `document.createElement('style')` 注入一段优化 CSS 补丁（只覆盖视觉，不动逻辑）
2. 用 JS 把目标图标元素 `.home-card-icon` / `.doc-icon` 的 innerHTML 替换为同规格 SVG（`el.style.color='var(--primary)'`）
3. `Page.captureScreenshot` 截图 → `MEDIA:/path/to.png` 交付 → 与基线图对照

样例注入脚本参考（ESM 项目须存 `.cjs`）：
```js
const INJECT = `document.querySelectorAll('.home-card-icon').forEach(el=>{
  const svg = { '✍️': '<svg ...>', '🎯': '<svg ...>' }[el.textContent.trim()];
  if (svg) { el.innerHTML = svg; el.style.color = 'var(--primary)'; }
});`;
```

**关键坑**：注入里不要放装饰性进场动画（如卡片 stagger / translateY 入场），否则截图时动画未播完，卡片呈透明/错位状态，样图失真。样例图只做「视觉成果展示」，动画细节单独在方案里说明。

## 工具坑（本会话实测）
- **ESM 项目脚本**：`cowrite-hermes-local/package.json` 是 `"type":"module"`，自写用 `require()` 的 CDP 脚本必须存成 `.cjs`（如 `/tmp/x.cjs`）或放非 ESM 目录，否则 `require is not defined in ES module scope`。
- **lark-cli docs +media-insert**：`--file` 必须为**相对路径**，且需先 `cd` 到图片所在目录；绝对路径报 `unsafe file path: --file must be a relative path within the current directory`。插完可在 `docs +fetch` 里看到 `<img ... src="..."/>` 确认成功。
- **文档写入验证**：创建文档后 `lark-cli docs +fetch --doc <id> --as user` 回读，确认表格/代码块/图片都落地；rev 号会随插入递增。
