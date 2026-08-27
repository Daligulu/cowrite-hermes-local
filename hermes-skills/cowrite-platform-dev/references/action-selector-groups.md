# 命令栏动作选择器：6 组分类下拉（2026-08-27 落地，commit cd5a8d2）

## 需求
用户提供 18 个动作的清单，要求「按 6 组分类做下拉菜单，6 个分组按钮放推荐位，去掉目前在推荐位的『选择动作』按钮」。

## 结论（用户拍板，经 clarify）
**推荐位放 6 个分组按钮，点某分组弹出该组动作下拉（组名 → 组内动作）。** 不是「推荐位放 6 个代表快捷动作」，也不是「点分组直接触发默认动作」。

## 分组映射（18 动作全部分配，无遗漏，与 action-config.json 一一对应）
| 分组按钮 | 组内动作（action id） |
|---|---|
| 写作加工 ✍️ | polish(润色文章)、wechat-layout(公众号排版) |
| 配图 🖼️ | illustrate(文章配图)、feng-ip(峰峰IP配图)、xiaohongshu(小红书图组) |
| 内容分发 📄 | feishu-doc(发布飞书文档)、knowledge-base(存入峰峰知识库) |
| 演示视频 📊 | slides(制作PPT)、video(制作视频) |
| 公众号贴图 🏷️ | wechat-sticker(微信贴图)、publish-sticker(发布贴图)、gzh-layout(主题排版)、gzh-publish(排版发布) |
| 选题投稿 📝 | topic-collect(选题)、topic-create(选题创作)、toutiao-micro-draft(微头条)、toutiao-article-draft(头条文章)、zhihu-article-draft(知乎文章)、zhihu-idea-draft(知乎想法) |

## 实现（CommandBar.tsx + App.css）
- **组件常量 ACTIONS_GROUPS**（文件顶部，`ACTION_GROUPS: {id,label,actionIds}[]`），把 group 定义从组件内提为模块级常量，便于复用与维护。分组只按 `actionIds` 列表映射，**不复制动作 label**（label 从 action-config 的 `selectableActions.find(a => a.id === id)?.label` 读，保证与配置一致）。
- **state**：`selectorOpen:boolean` → 改为 `openGroup:string|null`（存当前打开的分组 id）；`toggleSelector` → `toggleGroup(groupId, event)`（openGroup 相同则关闭，否则定位并打开）。
- **渲染（command-chips 内）**：`ACTION_GROUPS.map` 渲染 6 个 `.selector-toggle` 分组按钮，按钮里 `{group.label} ▾`；`openGroup === group.id` 时渲染 `.selector-list` 下拉，`group.actionIds.map` 遍历该组 enabled 动作 → `chip(option.id)`（填入输入框并收起）。
- **CSS**：`.selector-toggle.open { background:#2383e2; border-color:#2383e2; color:#fff }`（当前打开的分组按钮高亮）。
- **注意**：chip 点击仍只把动作名填入输入框（可继续追加要求），必须「交给 Hermes」才提交（原有行为不变）。

## 坑
- **下拉挂在 overflow:auto 祖先下会被裁剪**：`.command-chips` 有 `overflow-x:auto`，`.selector-list` 必须用 `position:fixed` + JS 取按钮 rect 定位（`setSelectorPos({ left:rect.left, bottom:window.innerHeight - rect.top + 6 })`），**不能**只查 DOM 存在——验收必须断言 `getBoundingClientRect` 在视口内且 height>0（2026-08-23 踩过，见 SKILL「快捷键选择器」节）。
- **去掉 `selectorOpen` 时同步删干净的旧 state**：改 `openGroup` 后，`selectorOpen/setSelectorOpen` 若无其他引用必须一起删（否则 tsc 报 TS6133 未使用）。搜 `setSelectorOpen` 确认无残留。
- **打开的分组按钮会变色**：CSS 要补 `.selector-toggle.open` 高亮态，否则用户看不出当前点了哪组。
- **分组按钮很多（6 个）时 command-chips 横向滚动**：`.command-chips { overflow-x:auto }` 已能滚，按钮各自 `flex:0 0 auto`，移动端 OK。
- **下拉弹出方向（最终方案，commit f70824f）——决定性判断，别用按钮位置/空间估算**：命令栏下拉向上还是向下，**直接检测 `.editor-command` 的 computed `position`**：`getComputedStyle(document.querySelector('.editor-command')).position === 'fixed'`（移动端 `@media≤760px` 时命令栏固定底部）→ **向上弹**（`bottom: innerHeight - rect.top + 6`）；否则（桌面命令栏在页面顶部，static）→ **向下弹**（`top: rect.bottom + 6`）。同时水平 clamp `left = Math.max(0, Math.min(rect.left, innerWidth - menuWidth - 20))`。state 类型 `{left, top?: number, bottom?: number}`，渲染 style 按 `top !== undefined ? {top} : {bottom}` 动态给。桌面+移动两端都须 CDP 断言 `inViewport === true`。
  - **为什么不能用按钮位置/空间估算（踩过 3 种方案，全有边界误判）**：① 最初固定 `bottom`（向上）只在移动端对，桌面顶部命令栏会顶出视口上方（`top=-5`）；② 改 `rect.top < innerHeight*0.5` 位置阈值——真实 iPhone 命令栏按钮可能落在视口垂直中点附近导致误判；③ 改「下方空间 ≥ 预估高度」空间判断——**命令栏下方还有 fixed 底部 tabbar(58px) 占位**，按钮下方看似够放（如 `spaceBelow=126 ≥ estHeight=92`），实际可用只有 `126-58=68px` 放不下 72px 的下拉，掉进 tabbar 被遮挡；且桌面顶部小按钮（`btnTop=108 ≥ estHeight=92`）又被误判向上弹顶出视口顶。**只有检测命令栏是否 fixed 才无歧义**。
  - **CDP 复现要点**：进入编辑页（点 `.sidebar-page-select` 而非父 `.sidebar-page`，否则 `.page-workspace` 仍 `inactive`(`display:none`) → 下拉 `getBoundingClientRect` 全 0，模拟不到真实场景）；不同分组动作数不同下拉高度不同，2项(写作加工)/3项(配图)/6项(选题投稿)都要测；`inViewport` 只判视口不含遮挡，要看 `inlineStyle` 用 top(向下)还是 bottom(向上) 才能确认方向。
- **iOS Safari 下拉被裁剪（最终修复，commit 4319615）——必须用 React Portal 脱离 overflow 祖先**：f70824f 的 `position:fixed` 方案在桌面/安卓/普通 iPhone OK，但在 **iOS Safari（含飞书内置 WebView）** 上，`.selector-list` 仍嵌套在 `.command-chips`（`overflow-x:auto`）容器内，触发 iOS 已知 bug：**fixed 元素若是 overflow 滚动容器的后代，会被裁剪/错位** → 用户真机点分组（尤其「配图」「内容分发」）无下拉或错位。**解法：`createPortal(<selector-list/>, document.body)` 把下拉渲染到 `document.body`，彻底脱离 `.command-chips` 的 overflow 祖先，保留 fixed 视口定位**（水平 clamp 依旧生效）。改动需 `import { createPortal } from 'react-dom'`。
  - **为何旧「选择动作」能显示、6 组不行**：7c16d91「选择动作」结构与现在完全相同（selector-list 在 command-chips 内、fixed+bottom），唯一差别是**单按钮不触发横向溢出、6 组必然横向溢出** → iOS Safari bug 只在 overflow 滚动容器有滚动内容时触发。
  - **排障教训：不能只凭用户截图判断缓存**——用户截图某分组「灰色无▾」表面像旧版缓存，深挖后发现是 iOS fixed-in-overflow 裁剪（或新版已加载但该组仍异常）。必须三层交叉定根因：① CDP 实测（本地 4320 / 隧道 / 目标视口）；② 用户**自有浏览器**对照（排除飞书 WebView 缓存）；③ vision 逐张按钮态分析（白色带▾=新版已加载，灰色=旧版或异常）。
  - **隧道链接会变（重要）**：Cowrite 对外访问靠 Cloudflare 临时隧道（`*.trycloudflare.com`），**服务器重启 URL 会变**，旧 URL 报 Cloudflare **Error 1033**（隧道断）。访问方式：`<新隧道URL>/cowrite-005b18defa8ef912057110b7fea94a266345918514fa1a4a/`。主入口裸 IP（`107.150.109.152`）http 被云安全组拦 80、https 裸 IP 无受信证书（微信 -1202），均不可用。**诊断隧道是否断**：`curl -sk -o /dev/null -w "%{http_code}" --max-time 8 "<url>/cowrite-005b.../"` —— 返回 530=隧道断（需从 `journalctl -u cowrite-hermes-tunnel.service | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1` 取新 URL），200=正常。
  - **经验沉淀**：iOS Safari/飞书 WebView 实测始终是此类 fixed/overflow 定位 bug 的最后一关——桌面+CDP 全绿不代表真机通过，必须用户真机确认。

## 验收（CDP）
- CDP `Runtime.evaluate` 抓 `.command-chips .selector-toggle` 的 innerText 数组 → 断言 = 6 个分组 label，且 `document.querySelector('.command-chips').innerText.includes('选择动作') === false`。
- 点某分组（find 包含「配图」的 toggle 并 click）→ 等 ~600ms → 抓 `.selector-list button` innerText，断言 = 该组动作（配图 → 文章配图/峰峰 IP 配图/小红书图组）。
- **命令栏可视截图技巧**：命令栏在页面底部，编辑器 `.page-workspace` 默认 `inactive`（`display:none`）。进入编辑页后若截图总是工作台首页（命令栏不在可视区），改用 `Page.captureScreenshot` 的 **`clip` 参数**精确截 `.command-bar` 的 `getBoundingClientRect` 区域（`clip:{x,y,width,height,scale:1}`），不要依赖整页截图。DOM 断言与 clip 截图是两回事——DOM 查出 6 个 toggle ≠ 截到图，clip 才能稳定截命令栏。
- 133/133 测试全绿 + build 通过 + 已部署生产。
