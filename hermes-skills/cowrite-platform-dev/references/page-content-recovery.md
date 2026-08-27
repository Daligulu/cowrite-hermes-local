# Cowrite 页面内容/配图丢失的恢复配方（2026-08-27 实测）

## 触发场景
用户报「Cowrite 平台某文章内容和配图找不到了」。**先别急着重建，先分层确认「后端到底丢没丢」**——多数情况是「产物有、写回漏」或「前端缓存」。

## 定位三步（只读，不改任何数据）

### 1. 确认页面/内容还在不在（API 直读）
```bash
# 页面列表里找标题
curl -fsS http://127.0.0.1:4320/api/pages | python3 -c "import sys,json; [print(p['id'],'|',p.get('title','')[:40]) for p in json.load(sys.stdin) if isinstance(json.load(sys.stdin),list)]"
# 单页读回，看 content 长度 + revision + 是否有 img / 占位符
curl -fsS http://127.0.0.1:4320/api/pages/<page_id> | python3 -c "import sys,json;d=json.load(sys.stdin);c=d.get('content','');print('rev',d.get('revision'),'len',len(c),'img',c.count('<img'),'占位',('{{' in c))"
```
- 页面 id / title / revision 正常 + content 长度正常 → **正文没丢**，问题在「配图」或「前端缓存」
- `cowrite.json` 顶层只有 `pages`（页面持久存储），无独立 assets 字段；页面对象字段：id/title/prompt/content/revision/createdAt/updatedAt

### 2. 确认配图在不在（assets 目录 + HTTP 可达）
```bash
ls -lat /root/.cowrite/assets/          # 找最近生成的图
# 任意入口 HTTP 可达（期望 200 + image/png + 真实字节）
curl -sI http://127.0.0.1:4320/assets/<hash>.png | head -6
```
- assets 目录图片在 + HTTP 200 → 配图资源**没丢**
- 但**页面 content 里没有 `/assets/` 引用** → 这就是核心 bug：图生成了、也上传了，但**没写回页面 content**

### 3. 查任务产物（配图 / 排版任务的真实产出地）
```bash
python3 -c "import json;t=json.load(open('/root/.cowrite/tasks.json'));print(json.dumps(t if isinstance(t,list) else t.get('tasks',[]),ensure_ascii=False)[:4000])"
ls -lat /root/.cowrite/workspace/       # 排版/gzh-layout 产物常落这里
```

## 根因（gzh-layout / 排版任务「产物有图但写回漏图」）
`gzh-layout`（或任何生成完整 HTML 的排版任务）真实流程是：
1. worker 生成完整 HTML 产物 → 存 `deploy/scripts/cowrite-hermes-worker.py` 的 `/root/.cowrite/workspace/gzh_<theme>_layout.html`（**含全部 `<img src="/assets/...">`**，44KB 级）
2. 写回页面 content 时，**只落了正文 `<section>`，把图片 `<img>` 丢了**（或只写了纯文本排版版）
3. 结果：页面 content 长度正常、无占位符、无报错，但**没有图** → 用户「配图不见了」

**判断信号**：`/root/.cowrite/workspace/gzh_zen_layout.html` 里 `img` 数 = 5，但页面读回 content `img` 数 = 0。

## 恢复配方（权威最终版 = 完整产物 + 占位符替换 + 全量写回）
```python
# 1. 读完整产物（含图）
html = open('/root/.cowrite/workspace/gzh_zen_layout.html', encoding='utf-8').read()
# 2. 替换占位符为作者（峰AI路），杜绝 {{...}} 残留
html2 = html.replace('{{作者名}}', '峰AI路').replace('{{一句话简介，如：热衷于分享 AI 观察与干货}}', '一个喜欢拆解 AI 前沿事件的公众号')
# 3. 校验合规
#    python3 scripts/validate_gzh_html.py <file>  → 期望「完全合规」+ 记录 span leaf 数
open('/tmp/gzh_final.html','w',encoding='utf-8').write(html2)
# 4. 全量写回（MCP cowrite_update_page，带 expected_revision=当前 rev）
#    content=html2 完整版，page_id，title 保留原样
```
写回后**必读回**验证：
```bash
curl -fsS http://127.0.0.1:4320/api/pages/<id> | python3 -c "import sys,json;d=json.load(sys.stdin);c=d.get('content','');print('rev',d.get('revision'),'img',c.count('<img'),'占位',('{{' in c),'峰AI路',('峰AI路' in c),'END',('END</span>' in c))"
```
期望：rev +1、img=5、占位="False"、含峰AI路、含 END。

## 验收注意
- **放弃 browser 截图做最终判定**：Cowrite 编辑器是**源码视图**（把 HTML 以 `<code>` 块呈现，非所见即所得），browser_vision 会把它判成「正文空白/排版异常」——这是渲染方式，不是内容丢失。**以 DOM 快照 / API 读回 / 390px wrap_preview 为准。**
- 399px 验收：`gzh-design/scripts/wrap_preview.py <file>` → headless chrome 390px 截图（用 `--window-size=390,<实际高度>`，别用过大的 8000px，会截出空白）；本地 file:// 打不开相对 `/assets/` 图，需经 server 端口或忽略图只看排版。
- 配图相对路径 `/assets/xxx.png` 在本地 file:// 不渲染（需 server `127.0.0.1:4320` 提供），视觉验收图要用 server 侧或接受「排版 OK、图走 server」的判断。

## 教训
- **排版/配图任务成功后要交叉验证「产物有、写回也有」**：不能只看 `status=succeeded`，要读回页面 content 断言 `img` 数 > 0。worker 契约的「真实验证→写回」要落到**读回页面**这一步。
- 曾误把 `gzh_zen_layout.html`（含图权威版）当「只有正文」，其实它是**完整含图版**——恢复时应以工作区产物为准，而非页面当前 content。
- 恢复后建议在任务 result 里把「完整产物路径」写进 assets（本 bug 里 task_JjpHqJkNhbST/3Igv9eUbHS_N 的 result 都记录了产物路径，是恢复的关键线索）。
