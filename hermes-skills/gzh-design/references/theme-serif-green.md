# 公众号排版组件库 —— 衬线绿色方格纸

> **使用说明**：本组件库为「衬线绿色方格纸（Serif Green）」主题，忠实复刻自编辑部纸感风格（原作者林大有的 WorkBuddy 入门系列排版），所有组件使用**内联样式**，可直接复制粘贴到微信公众号编辑器。
>
> **设计风格**：衬线字体 × 绿色微方格纸背景 × 绿色强调。editorial（杂志/纸感）气质，轻复古的学术书卷风，不追求现代无衬线，靠格子纸底纹 + 衬线小字 + 宽松行距建立阅读质感。适合教程、工具盘点、深度分析、知识整理、观点类长文。
>
> **公众号平台限制须知**：
> - ❌ 不支持 `<style>`/`<script>`、CSS class/id、`position:fixed/absolute/sticky`、`float`、`@media`/`@keyframes`、`display:grid`、CSS 变量 `var(--x)`
> - ✅ 支持内联 `style`、`display:flex`（有限）、`linear-gradient`、`border-radius`、`box-shadow`、`<section>/<p>/<span>/<strong>/<img>/<h2>/<ol>/<li>/<hr>` 等基础标签
>
> **WeChat 兼容铁律**（本主题组件全部已按此写好，改动时必须遵守）：
> - 所有"装饰性空元素"（分割线、图标占位）**必须在内部放 `<span leaf=""><br></span>` 占位**，否则微信会剥掉样式
> - **不要把 `font-size`/`border-bottom` 打在 `<strong>` 上**，也不要在同一个 `<p>` 里混多个不同 `font-size`——微信编辑器会自动"纠正"导致样式被重写。正确做法：拆成多个 `<p>`，每个 `<p>` 只有一个字号；高亮样式统一挂在外层 `<span>` 上
> - **绿色方格纸背景**只挂在全局容器段上（多背景线性渐变），不重复挂到每个子段落
> - 结构化区域（引言卡、图片说明）没有内容时**整块删掉**，不留空 section

---

## 设计变量速查表

```
主色（强调绿）：  #28a745（绿色加粗 / 下划线 / 左竖条 / H2卡片专用）
主色淡：         #28a7450F（H2卡浅绿底）
主色淡边框：      #28a74555（H2卡绿边框 / 引用左竖条）
主色极淡：        rgba(40,167,69,0.035)（方格纸格线）
涂色：           #059669（图标高亮点缀 / 感谢卡点赞）
正文色：         #344054（正文段落 / 列表 / 卡片正文）
标题色（深炭）：   #3e3e3e（H2 标题）
引言文字色：      #4b5565（导语卡 / 引用）
引言底色：        #f6f9fc（导语卡浅蓝灰底）
辅助文字：        #6b7280（署名 / 说明 / 编号小字）
极淡分割线：      rgba(0,0,0,0.08)（hr / 装饰短横）
边框浅色：        #E5E7EB
正文字号：        15px（衬线纸感；本文植根原文 15px/1.82，若需统一到全局 16px/1.75 可改此两值）
正文行高：        1.82（宽松行距，editorial 纸感核心）
段距：            20px（正文段落 margin-bottom）
字间距：          0（衬线体不需额外字距）
内容区边距：      0 11px（全局容器 padding:20px 11px）
最大宽度：        100%（容器 max-width 100%）
```

字体栈：`'Times New Roman', Georgia, 'SimSun', serif`（衬线是本文字体灵魂，勿改无衬线）

> **目标定位**：本主题是「衬线编辑部纸感」风格。它与摸鱼绿（现代无衬线卡片杂志）显著不同——本主题**无封面大卡、无渐变、无胶囊标签**，靠纸纹底 + 衬线字 + 绿色克制强调建立记忆点。

---

## 组件 1 全局容器（白色 + 绿色微方格纸背景）

> 方格纸格线用两层 1px 线性渐变交叉实现，格子 18×18px，极淡绿（alpha 0.035），衬线字体栈。**所有正文都放在这个容器内**，背景只在容器层挂一次。

```html
<section style="font-family:'Times New Roman',Georgia,'SimSun',serif;font-size:15px;line-height:1.82;color:#344054;padding:20px 11px;box-sizing:border-box;max-width:100%;word-wrap:break-word;word-break:normal;overflow-wrap:break-word;line-break:strict;text-align:justify;background-color:#ffffff;background-image:linear-gradient(rgba(40,167,69,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(40,167,69,0.035) 1px,transparent 1px);background-size:18px 18px;">

  <!-- 所有组件放在这里 -->

</section>
```

---

## 组件 2 开头引言 / 导语卡（浅蓝灰底 + 绿色左竖条）

> 文章开头的摘要/系列说明用。浅蓝灰底 `#f6f9fc` + 绿色左边框 `#28a74599` + 圆角 4px。这是本主题的"导语框"，与正文区分明显。

```html
<section style="font-size:15px;line-height:1.82;color:#4b5565;background:#f6f9fc;margin:16px 0 16px 8px;padding:16px;border-left:4px solid #28a74599;border-radius:4px;">
  <p style="font-size:15px;line-height:1.82;color:#4b5565;margin:0 0 0.8em 0;text-align:justify;">
    <span leaf="">{{导语第一句}}</span>
  </p>
  <p style="font-size:15px;line-height:1.82;color:#4b5565;margin:0;text-align:justify;">
    <span leaf="">{{导语第二句}}</span>
  </p>
</section>
```

> **文案策略（先读，比代码重要）**：导语卡与公众号外标题是两层，视角错开——外标题卖"为什么点开"，导语卡交待"这是什么系列 / 你将要读到什么"。可含核心观点绿色强调（用组件 4）。

---

## 组件 3 章节标题 H2（绿色浅底边框圆角卡）

> 与石墨极简的水印编号、摸鱼绿的标签章截然不同——本主题 H2 是一枚**淡淡的绿色浅底 + 绿色细边框卡片**，圆角 4px，左对齐，21px 加粗深炭字。这是本主题最具辨识度的结构标记。

```html
<h2 style="font-size:21px;font-weight:bold;margin:30px auto 20px;color:#3e3e3e;line-height:1.2;text-align:left;border:1px solid #28a74555;border-radius:4px;padding:10px 12px;background:#28a7450F;">
  <span leaf="">{{章节标题}}</span>
</h2>
```

---

## 组件 4 正文段落（含绿色强调 strong）

> 每段**主动识别 1~3 个关键短语**用绿色加粗标记——这是本主题正文的核心标记（替代传统下划线）。绿色 `#28a745`，与方格纸和 H2 卡同族。

**普通段落：**

```html
<p style="font-size:15px;line-height:1.82;color:#344054;margin:0 0 20px 0;text-align:justify;text-align-last:left;letter-spacing:0;word-break:normal;overflow-wrap:break-word;line-break:strict;">
  <span leaf="">{{正文内容}}</span>
</p>
```

**带绿色强调的段落（推荐默认，本主题标志性写法）：**

```html
<p style="font-size:15px;line-height:1.82;color:#344054;margin:0 0 20px 0;text-align:justify;text-align-last:left;letter-spacing:0;word-break:normal;overflow-wrap:break-word;line-break:strict;">
  <span leaf="">{{前半句}}</span>
  <strong style="font-weight:bold;color:#28a745;"><span leaf="">{{核心观点/关键词}}</span></strong>
  <span leaf="">{{后半句}}</span>
</p>
```

**标记原则**：每段选 1~3 个短语（4~15 字），优先标核心观点、结论判断、关键数据、专有名词；整段无要点可不标。绿色是底色强调，全篇绿色加粗**不宜过密**（20 处以上会失去焦点），控制节奏。

---

## 组件 5 正文高亮样式（变体 + 使用策略）

> **优先级**：① 绿色加粗（组件 4，默认标记）→ ② 绿色下划线（次要，5a）→ ③ 浅绿背景关键词标签（每篇 2~4 个，5b）→ ④ 荧光笔浅绿（偶尔长句，5c）→ ⑤ 删除线（对比/否定，5d）。

### 5a. 绿色下划线（次要强调，本主题标志）

```html
<span style="border-bottom:2px solid #28a745;font-weight:600;color:#344054;"><span leaf="">{{绿色下划线关键词}}</span></span>
```

### 5b. 浅绿背景关键词标签（核心概念，每篇 2~4 个）

```html
<span style="background:#28a7450F;color:#28a745;padding:2px 7px;border-radius:3px;font-weight:700;font-size:14px;"><span leaf="">{{关键词标签}}</span></span>
```

### 5c. 荧光笔浅绿（偶尔用于长句强调，底部 40% 浅绿高亮）

```html
<span style="background:linear-gradient(180deg,transparent 60%,#28a74522 60%);font-weight:700;color:#344054;"><span leaf="">{{荧光笔强调的重要长句}}</span></span>
```

### 5d. 删除线（被淘汰 / 否定的概念）

```html
<span style="text-decoration:line-through;color:#9ca3af;"><span leaf="">{{被淘汰概念}}</span></span>
```

> 行内代码/命令 → 通用库 1c（保持等宽），不用本主题样式。

---

## 组件 6 引用 / 金句块

### 6a. 绿色左竖条金句引用（视觉焦点最强，核心金句）

```html
<section style="border-left:4px solid #28a745;padding:14px 0 14px 20px;margin:0 0 24px;">
  <p style="font-size:16px;font-weight:700;color:#3e3e3e;margin:0;line-height:1.75;">
    <span leaf="">「{{核心观点或关键金句}}」</span>
  </p>
</section>
```

### 6b. 浅蓝灰底内容引用块（Prompt / 引用内容 / 较长段落）

```html
<section style="background:#f6f9fc;border:1px solid #E5E7EB;padding:18px 20px;margin:0 0 24px;border-radius:4px;">
  <p style="font-size:14px;color:#344054;margin:0;line-height:1.82;text-align:justify;">
    {{引用内容，可含绿色强调}}
  </p>
</section>
```

---

## 组件 7 有序 / 无序列表

> 数字编号列表，衬线正文色，缩进 20px，逐项 margin 4px。

```html
<ol style="font-family:'Times New Roman',Georgia,'SimSun',serif;font-size:15px;line-height:1.82;color:#344054;margin:12px 0;padding-left:20px;list-style-type:decimal;">
  <li style="font-size:15px;line-height:1.82;color:#344054;margin:4px 0;">
    <span leaf="">{{列表项1，可含绿色强调}}</span>
  </li>
  <li style="font-size:15px;line-height:1.82;color:#344054;margin:4px 0;">
    <span leaf="">{{列表项2}}</span>
  </li>
  <li style="font-size:15px;line-height:1.82;color:#344054;margin:4px 0;">
    <span leaf="">{{列表项3}}</span>
  </li>
</ol>
```

---

## 组件 8 图片 / GIF

> 居中、圆角 4px、max-width 100% 按原尺寸显示，不铺满。说明文字（有 alt 才写）用衬线小字配绿色编号。

```html
<figure style="display:block;margin:16px 0;text-align:center;">
  <span>
    <img src="{{图片URL}}" style="display:block;margin:0 auto;max-width:100%;border-radius:4px;" alt="{{说明}}">
  </span>
</figure>
```

---

## 组件 9 分割线

> 极淡横线 `rgba(0,0,0,0.08)`，前后大留白（margin 40px 0）。editorial 章节过渡。

```html
<section style="padding:0;">
  <hr style="border:0;border-top:1px solid rgba(0,0,0,0.08);margin:40px 0;">
</section>
```

---

## 组件 10 文末签名 + 三连

> 用通用文末感谢卡（theme-thanks-card.md）的 **「衬线绿色方格纸」配色套**：主色 `#28a745`，卡片浅绿底 `#F0FDF4`，点赞 ♥ 用主色 `#28a745` 高亮，在看 ◎ / 转发 ↗ 常规，THANKS FOR READING 字距 4px。作者签名默认「峰AI路」。

---

## 完整文章模板骨架

```html
<!-- ① 全局容器：白色 + 绿色微方格纸背景（组件1） -->
<section style="font-family:'Times New Roman',Georgia,'SimSun',serif;font-size:15px;line-height:1.82;color:#344054;padding:20px 11px;box-sizing:border-box;max-width:100%;word-wrap:break-word;word-break:normal;overflow-wrap:break-word;line-break:strict;text-align:justify;background-color:#ffffff;background-image:linear-gradient(rgba(40,167,69,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(40,167,69,0.035) 1px,transparent 1px);background-size:18px 18px;">

  <!-- ② 开头导语卡（组件2，原文有系列说明时生成） -->

  <!-- ③ 前言正文（组件4 段落 × N） -->

  <!-- ④ 第一章（组件3 H2 绿卡 + 组件4 正文 + 组件5 高亮 + 组件6/7/8） -->

  <!-- ⑤ 第二章…第N章（组件3，margin-top:30px） -->

  <!-- ⑥ 结语（组件3 或纯段落收尾） -->

  <!-- ⑦ 分割线（组件9） -->

  <!-- ⑧ 文末感谢卡（组件10：签名 + 绿色系点赞三连） -->

</section>
```

**骨架顺序铁律**：无封面大卡、无目录（本主题不做现代渐变大封面，属纯纸感 editorial；若需导读可把导语卡前置）。H2 绿卡是唯一的结构锚点，**不要额外加水印编号或胶囊标签**——那会破坏纸感。

---

## 视觉层级（3 层递进）

| 层级 | 样式 | 用途 | 频率 |
|------|------|------|------|
| **锚点层** | 绿色加粗 strong（组件4）/ 浅绿关键词标签 5b | 核心概念、产品名、关键结论 | 全文 ≤5 处锚点 |
| **标记层** | 绿色加粗（组件4，默认）/ 绿色下划线 5a | 正文关键词强调 | 每段 1~3 处 |
| **容器层** | 引言卡 2 / 引用 6a / 内容引用 6b | 导语、金句、引用、结构化信息 | 按需 |

**克制原则**：
- 整篇偏"纸感素雅"，绿色是唯一的色彩记忆点，**颜色不轰炸**：绿色加粗 20 处上下、浅绿标签 ≤4 个。
- 不含其它色相点缀，拒绝渐变、拒绝橙黄——保持衬线编辑部质感。

> 说明：本主题 H2 标题卡已有浅绿底 + 绿边框，本身即锚点，**不与正文绿色加粗叠加成第四层**，避免过密。

---

## 文章类型 → 组件组合配方

按 SKILL.md 第 3 步判定的文章类型选配方；核心组件构成本篇排版主旋律，点缀组件按内容出现处使用，一篇文章点缀组件种类 ≤3。

| 文章类型 | 核心组件组合 | 点缀组件 |
|---|---|---|
| 教程/操作指南 | 段落 4 + 有序列表 7 + 内容引用 6b | H2 绿卡 3、绿色下划线 5a |
| 盘点/工具清单 | 段落 4 + 有序列表 7 + H2 绿卡 3 | 绿色下划线 5a、浅绿标签 5b |
| 观点/深度分析 | 段落 4 + 金句引用 6a + H2 绿卡 3 | 绿色加粗 4、分割线 9 |
| 知识整理/系列说明 | 导语卡 2 + 段落 4 + H2 绿卡 3 | 有序列表 7、分割线 9 |
| 深度随笔 | 段落 4 + 金句引用 6a + 分割线 9 | 导语卡 2、绿色下划线 5a |
| 工具对比 | 段落 4 + 有序列表 7 + 内容引用 6b | H2 绿卡 3、浅绿标签 5b |

所有类型共用固定结构：全局容器 1 + H2 绿卡 3 + 段落 4 + 文末感谢卡 10。

---

## Markdown → 衬线绿色方格纸 映射规则

| Markdown 元素 | 对应组件 | 说明 |
|---|---|---|
| `# 标题` | 不使用 | 公众号标题在平台设置；本主题无封面大卡，标题由平台承担 |
| 文章开头 `> 引言` | 组件 2 导语卡 | 浅蓝灰底 + 绿色左竖条 |
| `## 章节标题` | 组件 3 H2 绿卡 | 绿色浅底边框圆角卡 |
| `### 子标题` | 同组件 3（字号降为 17px 加粗，无绿底） | 子层级弱化 |
| 普通段落 | 组件 4 | 每段主动标 1~3 处绿色加粗 |
| `**加粗文字**` | 组件 4 绿色加粗 | 核心概念/观点 |
| `<u>下划线</u>` / `++文字++` | 组件 5a 绿色下划线 | 次要强调 |
| `==高亮文字==` | 组件 5b 浅绿标签 | 每篇 ≤4 个 |
| `~~删除线~~` | 组件 5d 灰色删除线 | 被淘汰概念 |
| `> 引用段落`（非开头） | 组件 6a 绿色左竖条金句 | 核心金句 |
| 核心金句 | 组件 6a 金句引用 | 视觉焦点 |
| ` ``` 多行代码块 ``` ` | 通用库 1a 深色/1b 浅色 | 每行一个 `<p style="margin:0">` |
| 行内 `` `code` `` | 通用库 1c | 保持等宽 |
| `1. 2. 3.` 编号列表 | 组件 7 | 缩进 20px |
| 并列要点 | 组件 7（可转无序语义，保留衬线正文色） | |
| Markdown 表格 | 通用库表格组件 | 偶数行浅灰底 |
| 注意/警告 | 组件 6b 内容引用块 | 浅蓝灰底 |
| `![](图片)` | 组件 8 | 居中圆角 max-width 100% |
| 视频 | 通用库视频卡（2b） | 保留原视频代码 |
| `---` 分割线 | 组件 9 | 极淡横线 |
| 文末签名 | 组件 10 感谢卡 | 绿色系，作者默认峰AI路 |
