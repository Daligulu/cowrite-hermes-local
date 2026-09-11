# gzh-design 组件化排版 → 公众号草稿箱（直接提交，不重渲）

> 来源：2026-08-26 实机端到端验证（峰AI路 `default`，appid `wx42b46ea46863a720`）。
> 本文是会话级复现配方，是对 SKILL.md「Direct-submit of pre-rendered component HTML」一节的落地细节。

## 核心结论（一句话）

组件库排好版的文章要**直接提交 gzh HTML 作为 `content`**，`article_type=news`，**绝不**经 wewrite 重渲 Markdown——重渲只保留配色变量，会丢光组件版式（水印编号 / STEP 标签 / 指令块 / 点评卡）。

## 为什么不能用 `wewrite_publish.py` 直接发组件文章

- `wewrite_publish.py --theme graphite-minimal` 的 graphite 是**融合版**（THEMES dict，只有颜色/字号变量），`render_article()` 从 Markdown 重排，产出**没有**组件级版式。
- 它还有**硬校验**：`if appid != EXPECTED_DOG_APPID and not args.allow_non_dog_appid: die(...)`。默认 `EXPECTED_DOG_APPID = wx27855f8407f2c81c`（狗号）。发峰AI路必须 `--allow-non-dog-appid` 或走能自行解析目标账号的脚本。

## 正确做法：`gzh-design/scripts/publish_gzh_html.py`

路径：`/root/.hermes/skills/creative/gzh-design/scripts/publish_gzh_html.py`

复用 `wewrite_publish.py` 的函数（`load_default_env` / `get_access_token` / `upload_thumb` / `add_draft`），只把 `add_draft(content_html=...)` 换成 gzh 已排版 HTML。账号别名：`dog`=狗狗生活小百科，`default`=峰AI路（`WECHAT_APP_ID_DEFAULT`/`WECHAT_APP_SECRET_DEFAULT` 或 `WECHAT_APP_ID`/`WECHAT_APP_SECRET`）。

```bash
# dry-run（只验证 token/账号，不上传、不建草稿）
python3 scripts/publish_gzh_html.py --account default --dry-run draft.html cover.jpg

# 真发布
python3 scripts/publish_gzh_html.py --account default \
  --title '标题' --author '峰AI路' --digest '摘要' \
  draft.html cover.jpg
```

注意：dry-run 分支在 `get_access_token` 之后提前 return，但 argparse 仍强制 `cover` 位置参数——dry-run 也须传一个存在的 cover 路径（不会真的上传）。

## 发布前必须：提取「纯正文片段」

`wrap_preview.py` 产出的预览页 / 手写的完整 demo HTML 带有 `<html>`/`<head>`/`<style>`/`<body>`/`.shell`/`.note` 外壳——**整份不能粘，粘贴后外壳被公众号剥掉只剩样式残缺**。

正确做法：
1. 从第一个布局容器 `<section style="max-width:677px...">` 开始，截到对应 `</section>`（含），得到纯 `<section>…</section>` 片段。
2. 去掉 document/head/body/style/class/id 包装。
3. 跑 `scripts/validate_gzh_html.py <片段>`，输出 `✅ 完全合规，可直接粘贴到公众号编辑器` 才安全。

## 读回验收（唯一可靠「样式没丢」证据）

`draft/add` 返回 `media_id` 只说明 API 接收，**不代表样式存活**。必须读回：

- **`cgi-bin/draft/get` 是 POST**：GET 会返回 `errcode 43002 require POST method`。用 `method="POST"`、body=`json.dumps({"media_id": id}, ensure_ascii=False).encode('utf-8')`、header `Content-Type: application/json; charset=utf-8`。
- 读回 `news_item[0].content`，断言组件标记存在：如 `STEP 01` / `直接复制` / `值不值得` / 水印编号 / `END`。
- 可选：把读回的 content 再渲染一次（本地 file:// + headless chrome），视觉确认无丢失。

## 2026-08-26 实机验收记录

- 发布：`draft/add` 返回 `draft_media_id=DMlKHYynIFEHDvfyTiEfh8rrWb_dkk_4xjrKVZba-HKBWo1O7UKxc3TSyUmCWj1t`，`ok:true`，`article_type=news`。
- 读回：`draft/get`(POST) 得 `news_item[0].content` 长度 9614 字节，STEP/直接复制/值不值得/END 全命中，作者「峰AI路」、封面 `thumb_media_id` 正确。
- 视觉终判：渲染读回 content，引言卡橙下划线 / 导读三列 / 水印编号 / STEP 深炭标签 / 浅灰指令框 / 点评卡橙竖条 / END / 签名全保留——**落到公众号不变样**。

## 平台铁律复核（本用例踩过的）

- ❌ 预览外壳 `<style>`/`.shell`/`.note` 会丢，只能粘 `<section>` 片段。
- ❌ `draft/get` 用 GET → 43002；必须 POST。
- ✅ 组件 HTML 全内联 + `<span leaf="">` 包裹 → validate 通过，粘贴不倒。
- 正文有无图片 src 视文章而异；本示范文纯排版无正文图，仅封面图。
