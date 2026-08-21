# Cowrite 移动端 UI 落地（2026-08-17）

按用户确认的独立 HTML 样例（`/root/.hermes/workspace/cowrite-mobile-ui-prototype.html`，线上 `/cowrite-mobile-proto/`）落地到生产。**关键流程：先出独立样例 → 用户确认 → 再改平台**，不要直接改生产代码做探索。

## 落地改动（commit 7e2dfcf + 后续 fix）

### App.tsx
- 新增 `WorkspaceView` 类型别名 + `MobileTabBar` 组件（5 Tab：⌂工作台/◫任务/✎编辑/🧩技能/⚙配置），仅 ≤760px 显示（CSS 控制）
- `MobileTabBar` 渲染在 `<main>` 末尾，`onNavigate` 处理编辑 Tab 特例：有 `activeId` 直接切 page 视图，无页面则弹新建窗
- `HomeWorkspace` 增加 `onOpenSkills` prop（技能卡片跳 skill-manager）

### HomeWorkspace.tsx
- 新增 `.home-card-skill` 卡片：「🧩 技能管理 · 查看和使用 223 个本地技能」

### App.css（移动端 @media max-width:760px）
- `.mobile-tabbar`：fixed bottom、5 等分、白底 + 上边框 + safe-area、active 深蓝 #1e4d7c
- `.workspace { padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px)) }` 防 tabbar 遮挡
- `.home-start`：移动端 1fr 1fr 两列；`.home-card` 竖排（icon 在上文字在下）
- `.editor-command { bottom: calc(58px + env(safe-area-inset-bottom, 0px)) }` 命令栏上移避开 tabbar
- `.command-more`：移动端改 **fixed 底部弹层**（3 列 grid、圆角 18px、底部 58px 避让、max-height 45vh 可滚）
- `.task-filters`：nowrap + overflow-x auto 横滑（含 `::-webkit-scrollbar{display:none}`）
- `.command-box .primary { min-height: 44px }`（样例规范 ≥44px 触控，原 40px 被 CDP 抓到后修正）

## 验收（生产 URL，CDP 390×844，deviceScaleFactor 2）

脚本：`/tmp/cowrite-prod-mobile-verify.js`（已固化为 `scripts/mobile-verify.js`）。断言要点：
- 5 视图全部 `document.documentElement.scrollWidth <= clientWidth`（无横向溢出）
- tabbar 可见、5 Tab、active 文本随视图切换（工作台/技能/编辑/任务）
- 首页 2 列宫格、4 卡片、技能卡片存在
- 编辑器：命令栏 visible 且 `cmdRect.bottom <= tabbarRect.top + 2`（不重叠）、提交按钮高 44、chips ≥5
- 更多动作：`.command-more` position=fixed、3 列、`bottomGap ≈ 58`
- 任务中心：`.task-filters` overflowX=auto、任务行正常

## 后续注意事项
- 编辑器页同时有命令栏 + tabbar：命令栏 z-index 40、tabbar z-index 45、`.command-more` z-index 46，层级关系不能乱
- 修改移动端布局后**必须**跑 `scripts/mobile-verify.js` 复验，不能只看桌面截图
- 用户确认样例时用的是 4 宫格 2×2；桌面端仍是 3 卡横排（`.home-start` grid-template-columns 3 列只在桌面生效）
