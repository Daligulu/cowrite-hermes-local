# Cowrite 侧边栏与移动端导航图标/文字统一（2026-08-27）

本文件记录 Cowrite 前后端图标与导航文字统一的完整坑与方案（commit d932330 / da237c6 / d79ebb0 / 3918001）。核心已入 SKILL.md 正文，此处为会话细节备份。

## 一、侧边栏导航图标统一（commit d932330）
- **根因**：首页 `⌂`(13×13)/项目(14×11)/Skill(13×13) 用定位 span 固定尺寸；但动作配置 `⚙`、任务中心 `☰` 是**纯字符内联**，按文本基线渲染成 ~11.7×19px 且不垂直居中。导航文字是**裸文本节点**，`.sidebar-tool > * + *` 的 `margin-left` 对裸文本不生效 → 间距不均。
- **修复**：
  - `App.tsx`：5 个 `.sidebar-tool` 图标加基类 `sidebar-tool-icon`；文字包 `<span className="sidebar-tool-label">`
  - `App.css`：`.sidebar-tool-icon { flex:0 0 16px; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; line-height:1 }`；`.sidebar-tool` 用 `gap:7px` 替代 `.sidebar-tool > * + *`；`.label { ellipsis 防溢出 }`；`.skill-tool-icon` 去固定宽高改盒内 grid 居中；`.project-tool-icon` 高 11→12px
- **验证**：CDP getBoundingClientRect 5 图标全 16×16（此前 ⚙/☰ 11.7×19）、gap 7px。

## 二、字符字形宽度差异（commit d79ebb0，用户反馈「首页 ⌂ 偏小」）
- 即使盒统一 16×16，字符字形宽度差异仍致视觉大小不一：`⌂` 窄三角顶字形（14px 时 glyphW≈9px），`⚙`/`☰` 13px。
- **方案**：对窄字形单独放大 font-size（`⌂` 14→17px，glyphW 9→11px）；再放大 glyphH 会溢出盒，17px 是折中上限。更彻底方案 = 改用绘制图标（position+border 画法）可控性最好。
- 测量字符可视尺寸用 `document.createRange().getBoundingClientRect()`（比 getBoundingClientRect 准，能测 glyph 实际占用）。

## 三、移动端底部 Tab 图标统一（commit da237c6）
- **根因**：5 Tab 图标 4 个单色字符（`⌂`/`◫`/`✎`），但「技能」用彩色 emoji `🧩`、「配置」用 `⚙`（部分系统渲染彩色 emoji）→ 彩色单色混用、大小不一。
- **修复**：`🧩`→`▤`；`⚙`→`\u2699\uFE0E`（追加 U+FE0E 强制文本变体，防渲染成彩色 emoji）；`.mobile-tabbar .tab-ico` 加 `display:inline-flex; width:24px; height:24px; align-items:center; justify-content:center`。
- **验证**：CDP 390px 实测 5 个 tab-ico 全 24×24 居中、getComputedStyle color 全单色（未选中 #8A94A6 / 激活 #1E4D7C）。

## 四、移动端导航文字可读性（commit 3918001，用户反馈「首页的标签还是太小，放大到13px」）
- **方案**：`.sidebar-tool`/`.new-page` 桌面维持 13px，在 `@media (max-width:760px)` 内放大到 **14px**（`.sidebar-tool, .new-page { font-size: 14px; }`）。
- **验证**：CDP `getComputedStyle().fontSize` 实测首页 13px→14px（fontWeight 600 因 active）。**移动端侧边栏默认抽屉收起，cdp 截图必须先 `.shell.classList.add('sidebar-open')` 展开才见得到导航文字，否则截到工作台首页。**

## 五、「太小」类反馈的解读原则（本会话关键教训）
- 用户说的具体数值可能与实际不符：本会话实测导航标签**已是 13px**，用户仍说「放大到 13px」。**核心诉求是「不够醒目、要更大更清晰」，不是字面数字**。
- **正确做法**：先 CDP 实测当前值 → 再放大一档（13→14px）→ 明确告诉用户「实测已是 13px，已放大到 14px，要 15/16px 随时可调」，给确认空间，别在数值字面纠结。
- 别误解成「用户要求维持原值」。

## 通用教训
1. 图标用固定尺寸居中盒，别用内联字符当图标（字符按文本基线渲染，大小/居中不可控）。
2. 要用相邻兄弟选择器控制间距，文本必须包成元素节点（裸文本不匹配 `* + *`）。
3. 字符类/彩色 emoji 图标统一 font-size + `\uFE0E` 文本变体 + 固定尺寸居中盒，才与绘制图标观感一致、跨端（飞书 WebView）稳定。
4. 移动端 UI 视觉验收必须 CDP 390px 手把手截图，且要先展开抽屉、页面状态符合才算数。
