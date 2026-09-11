# Cowrite 页面 → 公众号草稿箱（wechat-layout 动作实操）

> 来源：2026-09-10 Cowrite 定时任务 task_ubo6BtjSY1Bc（页面 page_JL5CZBL7，峰AI路）。

## 场景

Cowrite 页面 content 已经是 gzh-design 排好版的纯 `<section>` 片段（含 5 张
`<img src="/assets/xxx.png">`）。动作 `wechat-layout` + requirements「发布到微信公众号草稿箱」
= 直接提交这段 HTML 建草稿，**不要**经 wewrite 从 Markdown 重渲。

## 关键缺口：`publish_gzh_html.py` 不管正文图

`gzh-design/scripts/publish_gzh_html.py` 只做「封面 upload_thumb + draft/add」，
正文里的 `<img src="/assets/...">` 不会自动上传——直接发会得到图片挂掉的草稿。
必须自己补一步：对每个 `/assets/X` → 本地文件（`/root/.cowrite/assets/X`）
调 `wewrite_publish.upload_article_image(token, jpg)`（走 `media/uploadimg`），
把 src 替换成返回的 mmbiz URL，再 add_draft。

## 硬性坑

- `media/uploadimg` 图片 **必须 < 1MB**；Cowrite 资产常是 1.0–1.2MB PNG。
  统一 `PIL` 转 JPEG（quality 90 → 100–160KB，1312×736 保有分辨率）。
- 封面用首图居中裁 2.35:1（如 1312×558）再 `upload_thumb`，比原图 16:9 好看且合规。
- 页面里的 **Cowrite 内部状态备注**（`<section style="margin:32px 0 0;padding:14px 16px;border:1px dashed…">`
  包着的「【已通知手机创建头条草稿】…」等）**不能**进公众号草稿，用正则剔除只影响发布副本；
  页面内容原样保留。
- 读回验收：`draft/get` 必须 POST。断言 `<img` 数 == 正文图数、`mmbiz.qpic.cn` 数 >= 图数、
  残留 `/assets/` == 0、各节标题与「出处」命中、内部备注不在正文里。
- 页面写回：用 `cowrite_insert_after`（anchor=页面最后一段的唯一子串，expected_revision=最新）
  追加发布记录，**不要**用整页 update——插入点是 anchor 之后第一个 `\n\n`，末段无 `\n\n` 时落到文末，正好是追加。
  页面里的图必须保持 `/assets/` 相对路径。

## 账号

峰AI路 = `--account default` / `resolve_account("default")`（appid `wx42b46ea46863a720`，
env `WECHAT_APP_ID_DEFAULT`/`WECHAT_APP_SECRET_DEFAULT`）；狗狗号 = `dog`。
