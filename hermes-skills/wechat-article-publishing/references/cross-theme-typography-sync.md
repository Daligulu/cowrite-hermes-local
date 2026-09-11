# 跨主题排版基线同步（2026-08-26 实证）

把某一主题的移动端最优参数**同步到整个多主题库**时，只统一「可读性基线」，**不复制配色**（每个主题保留自己的正文色/点缀色）。

## 统一的三项可读性基线

```text
正文 font-size: 16px
正文 line-height: 1.75
正文段落 margin-bottom: 24px
段落长度 ≤150 字（超长自动拆段，防手机"文字墙"）
```

2026-08-26 已在 6 个主题同步验证：moyu-green 14→16 / red-white 15→16 / zen-whitespace 15→16 / moyu-ticket 14→16 / olive-journal 14→16。

## 只改「正文段落」的识别规则

一个 `<p>` 需**同时满足三项**才算正文段落，才改字号/行高/段距：

```text
font-size:14px 或 15px
且 line-height:1.8 或 1.9
且 (text-align:justify) 或 (flex:1)
```

> 列表项正文的 `flex:1` 变体也属于正文；`line-height:1.8` 的卡片内正文同样算。

## 绝不动（误改会破坏版式）

- 小标签/辅助文字：`10/11/12/13px`（STEP 徽标、日期、英文小标签、code/pill）。
- 标题：`15/17px` 章节标题、加粗强调标题。
- **有意强调段**（即使字号是 14/15px 也留着）：`color:#991B1B`（红白加粗）、`#ed7b2f`（橄榄橙）、`#059669`（摸鱼绿）。
- 布局容器：`<ul>` / `<section>` / `writing-mode:vertical-rl`（票据竖排）。

## 边界豁免

- zen-whitespace 保留 **26px** 段距（大留白签名，≥24px 一律不动）。
- olive-journal 深色结语卡 `color:#fafafa;font-weight:700` 结尾金句：字号已到 16px，行高也统一到 1.75。
- 变量速查表改成 `16px（移动端阅读优化；旧版 Xpx 已弃用）`——**不要保留**旧的 `不可改 / 铁律` 注释（那是主题身份描述，与统一规范矛盾）。

## 验证

1. `component_lint.py .` → ERROR×0。
2. 取 1–2 个主题在 390px 视口渲染，确认正文 16px 清晰、行高舒适、配色完整、无溢出/乱码。

## 坑（本次教训）

**不要做全局 `replace font-size`**——各主题在 10–17px 混着标签/标题/强调段，盲替换会把标签标题也放大。
只有 `font-size + line-height + justify/flex` 三元匹配是安全过滤器。每次子编辑后，grep 残留的
`line-height:1.8/1.9`，确认每一条剩余命中都是辅助元素（代码说明/加粗强调/列表容器/章节编号），
而不是漏改的正文段。

## 上游维护规则（本地定制版勿覆盖）

当本地 skill 是某上游库的「定制超集」（实证：本地 gzh-design 含 `publish_gzh_html.py`、
组件 17/18/19、端到端模板、16px/1.75 基线；上游已是弃用的 15px/1.8）：

- **绝不 `git pull` / 覆盖**——会丢全部定制并回退参数。
- 上游新功能用 **cherry-pick 逐 commit 合并，永远本地优先**：clone 到临时目录，
  `git log origin/main..origin/<branch>` + `git diff --name-only` 找增量，再手工应用。
- 纯新增文件（scripts/upload_image.py、references/image-host.md）→ 直接复制；
  共享文件（SKILL.md）→ 手工补 3 处插入点（description、workflow 段、pitfalls 段）。
  不要用会覆盖定制的合并工具。
- 合并的功能可能「待配置」而非 bug：如 本地图上传图床 增量需 Qiniu/OSS AK-SK
  （环境变量或 `~/.gzh-design/image-host.json`）；`upload_image.py --check` 退出码 2 = 未配置，
  是等待状态，不是工具坏了——这是可配置增量，不是「工具不可用」。
