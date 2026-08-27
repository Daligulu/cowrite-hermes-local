# Cowrite 导航图标「报文字符 → 内联 SVG」（commit 78b76c2）

场景：用户要求把侧边栏「首页」小屋子 `⌂` 换成**书本**、「Skill 管理」四格方块换成**小锤子**。产物见 SKILL.md「侧边栏导航图标统一」段的**进阶**子段。

## 为什么不能用字符/emoji
- 书/锤子没有合适的**单色 Unicode**：`📖`/`🔨` 是彩色 emoji，本机无 emoji 字体（`fc-list` 146 字体无 Noto Color Emoji），Headless Chrome / 飞书 WebView 渲染成空白或方框。
- `▤`/`▦` 一类符号只能表达"文档/网格"，不像"书"；`⚒` 等五金符号形状怪。字符方案无法满足"像一本书 / 一把锤子"。
- 本项目删除按钮（`sidebar-delete`）已用内联 `<svg viewBox="0 0 20 20">`，有先例——因此选内联 SVG 最稳妥。

## 方案要点
- 内联 SVG 图标，`viewBox="0 0 16 16"`，实际显示 `width/height = 14`，居中于 `16×16` 的 `.sidebar-tool-icon` 盒。
- `fill="none"` + `stroke="currentColor"` + `stroke-width="1.3"` + `stroke-linecap="round"` + `stroke-linejoin="round"` → 线条风格，颜色自动跟随父级（激活蓝/普通灰），无需额外 CSS。
- CSS 补 `.sidebar-tool-icon svg { display:block }` 去除 inline 元素底隙。
- **清掉不再需要的旧规则**：`.home-tool-icon { font-size:17px }`（原给字符 `⌂`）、`.skill-tool-icon { display:grid; grid-template… }`（原给四格 `<i>`），否则盒子布局残留冲突。

## 已验证的书 / 锤子 SVG 路径数据（直接复用）
书（打开的书·带文字横线）：
```html
<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.8C6.6 3 4.8 3 3 3.8v8.6c1.8-.7 3.6-.7 5 0Z"/><path d="M8 3.8c1.4-.8 3.2-.8 5 0v8.6c-1.8-.7-3.6-.7-5 0Z"/><path d="M3 6.5c1.8-.6 3.6-.6 5 0M8 6.5c1.4-.6 3.2-.6 5 0M3 9c1.8-.6 3.6-.6 5 0M8 9c1.4-.6 3.2-.6 5 0"/></svg>
```
锤子（斜柄+锤头）：
```html
<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 11.5 10.2 6.8M7.2 3 13 8.3l-2 1.6L5.2 4.6Z"/></svg>
```

## 「先预览选型再上码」流程（主观审美类 UI 通用）
图标选择是主观审美，别直接改完就交付。流程：
1. 写 `file:///tmp/xxx_preview.html`，摆多候选变体（如书 A/B/C、锤 A/B/C），`.box` 模拟真实 `.sidebar-tool`（`background:#eef5ff; border-left:3px solid #2383e2`）。
2. `google-chrome --headless=new --no-sandbox --disable-gpu --window-size=<W>,<H> --screenshot=/tmp/preview.png file:///tmp/xxx_preview.html`。
3. `vision_analyze` 放大对比，问"哪个像书/哪个像锤、哪些不像、推荐组合"。
4. 选观感最好的组合才上代码。本会话：书选 B（开·带横线，最"书"）、锤选 A（斜柄+头，最像工具），锤 C（镐头）不像锤被淘汰。

## 验收
CDP 390px 展开侧边栏截图（先 `.shell.classList.add('sidebar-open')`），确认「首页=书」「Skill 管理=锤子」currentColor 单色、激活/普通变色正确、其余图标不受影响。`npm test`（133/133）、`npm run build`、已部署生产。
