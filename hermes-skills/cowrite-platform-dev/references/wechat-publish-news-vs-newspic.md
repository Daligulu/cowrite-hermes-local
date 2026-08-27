# 微信公众号发布：news（图文草稿）vs newspic（贴图）两通道

> 2026-08-26 实测固化。Cowrite 有两个互不相同的微信发布通道，**切勿混淆**；选错会导致发布形态错误或直接被微信拒绝。

## 通道对照表

| | 贴图（图片消息） | 排版文章（图文草稿） |
|---|---|---|
| 动作 id | `publish-sticker` | `gzh-publish` |
| 发布脚本 | `wechat-sticker-publisher/scripts/publish_sticker.py` | `gzh-design/scripts/publish_gzh_html.py` |
| `article_type` | `newspic` | `news` |
| 内容形态 | 图片 + 280-320 字短文案 | 封面 + HTML 正文（含版式组件） |
| 触发场景 | 一张 3:4 主视觉 + 简短观点 | 石墨极简排好版的完整文章 |
| 标题校验 | 页面标题必须带「贴图草稿·」前缀，否则拒发 | 直接用页面标题 |

## gzh-publish 动作（action-config 新增，17→18）

```json
{
  "id": "gzh-publish",
  "label": "公众号排版发布",
  "enabled": true,
  "chip": false,
  "keywords": ["公众号发布", "排版发布", "发公众号", "gzh发布"],
  "skills": ["gzh-design", "wechat-article-publishing"],
  "prompts": [{
    "id": "main", "role": "system",
    "text": "把当前页面的公众号排版内容发布到微信公众号草稿箱（article_type=news，不群发）。..."
  }],
  "workflow": []
}
```

Worker 执行规则（写入动作 prompt）：
1. `cowrite_get_page` 读页面最新内容与 `revision`。
2. 页面是 HTML 正文（含 `<section>`）→ 直接作正文；是 Markdown → 用 gzh-design 石墨极简排版成纯 `<section>` 正文章节（**禁** style/div/class）。
3. 调 `publish_gzh_html.py`：账号取 requirements「账号：xxx」（`default`=峰AI路 appid `wx42b46ea46863a720`；`dog`=狗狗生活小百科）；封面取页面第一张图或 requirements「封面：图片路径」；先 `--dry-run` 验证 token 与正文，再正式发布。
4. **只有返回 JSON 含 `draft_media_id` 才算成功**；用 `cgi-bin/draft/get`（**必须 POST**，GET 会报 43002）读回 `content` 核对 STEP/指令框/点评卡等组件是否完整、样式未变。
5. 成功 → 写回 `media_id` 与草稿链接到页面末尾；失败 → `fail_task` 写真实错误（禁止把未调用微信 API 的结果标成成功）。

## 核心坑：不要经 wewrite 重渲

`wewrite_publish.py` 的 `graphite-minimal` 是**融合版**——只保留颜色变量，**没有 gzh 组件库的完整版式**（大号水印编号 / STEP 标签 / 指令框 / 点评卡）。若把已排好版的 HTML 丢回 wewrite 重渲，会丢失全部组件样式。

**正确做法**：发表排好版的文章，用 `publish_gzh_html.py` **直接提交 gzh 已渲染好的 HTML 作为 `content`**——该脚本内部复用 `wewrite_publish.py` 的 `get_access_token`/`upload_thumb`/`add_draft`，仅替换 content，不走 wewrite 的 Markdown→HTML 流水线。

## 合并新动作到生产配置（幂等，不 reset 不覆盖）

```bash
# 1. GET 现有配置（返回 {config:{version,updatedAt,actions}}）
curl -fsS http://127.0.0.1:4320/api/action-config
# 2. 取 token（GET /api/session 返回 {token}）
curl -fsS http://127.0.0.1:4320/api/session
# 3. 读 cfg["config"]["actions"] 追加新动作
# 4. PUT —— body 直接传 {version:1, actions:[...]}（无 config 包装，否则 zod 400）
curl -X PUT http://127.0.0.1:4320/api/action-config \
  -H 'Content-Type: application/json' -H "x-cowrite-token: <token>" \
  -d '{"version":1,"actions":[...]}'
# 5. 重新 GET 断言改动已落地（动作数 +1）
```

- 服务**热加载**，无需重启（GET/PUT 即生效）。
- 误读 `cfg["actions"]`（而非 `cfg["config"]["actions"]`）会拿到空数组 → PUT 空 actions → 400。
- 复用脚本：`/root/.hermes/skills/creative/gzh-design/scripts/publish_gzh_html.py`（实测可执行，dry-run 通过峰AI路 token）。
