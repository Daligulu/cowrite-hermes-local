# Cowrite 配图图源封装：ApiYi 主源 + Agnes 免费降级

> 2026-09-04 落地并端到端验收。解决：illustrate / topic-create 配图默认 ApiYi，失败/限流/HTTP 451 自动降级到 Agnes 免费端点；同时支持用户显式指定走免费源。

## 目标
- 默认用 ApiYi（Hermes `image_generate` 工具，profile 默认后端）
- ApiYi 报错 / 限流 / 被拒 / HTTP 451 时，自动降级到 Agnes 免费端点（`agnes-2.5-flash`，Flash 系列免费）
- 用户在 requirements 里可**显式指定**「图源：Agnes」走免费源，或「图源：ApiYi」走付费主源
- 出图后照常走 Cowrite 资产上传 + 插入页面 + 配图验证契约

## 统一封装脚本
位于 `~/.hermes/skills/creative/agnes-ai-generation/scripts/generate_image.py`。

```bash
python3 ~/.hermes/skills/creative/agnes-ai-generation/scripts/generate_image.py \
  --prompt "<prompt>" --out /tmp/out.png \
  --source auto|apiyi|agnes \
  --aspect portrait|square|landscape
```

| 参数 | 说明 |
|---|---|
| `--source auto` | 默认。ApiYi 优先，失败自动降级 Agnes（stdout `used_fallback=true` 表示走了 Agnes） |
| `--source agnes` | 只用 Agnes（显式免费源，不降级） |
| `--source apiyi` | 只用 ApiYi（不降级） |
| `--aspect` | portrait=1080×1440 / square=1024×1024 / landscape=1344×768 |

**stdout**：`{ok, source, path, used_fallback}`；全失败时 **exit 2** 并把错误写 stderr。

**依赖**：本机同时有 `apiyi-image-generation` 与 `agnes-ai-generation` 两个 skill 目录；密钥读 `~/.hermes/.env` 的 `AGNES_API_KEY`（也兼容 `AGNES_API_TOKEN` / `APIHUB_AGNES_API_KEY`）。脚本不打印密钥。

## action-config 接入
`/root/.cowrite/action-config.json` 是运行时数据，不在 git 仓库。修改后 API `GET /api/action-config → 改 → PUT` 落地（写操作带 `x-cowrite-token`），或直接改文件（`load()` 每次读盘即时生效）。

`illustrate` / `topic-create` 两动作：
- `skills` 追加 `agnes-ai-generation`
- `prompts[].text` 追加图源规则：
  > 配图图源规则：默认用 ApiYi（image_generate 工具，profile 默认）；若 ApiYi 报错/限流/被拒/HTTP 451 或明确想用免费源，改用 agnes-ai-generation 免费出图——调用本机封装脚本 `python3 ~/.hermes/skills/creative/agnes-ai-generation/scripts/generate_image.py --prompt "<prompt>" --out <本地png路径> --source <auto|apiyi|agnes> --aspect <portrait|square|landscape>`。若 requirements 含「图源：Agnes」或「沿用免费图源」则 `--source agnes` 显式指定；否则 `--source auto`（ApiYi 优先、失败自动降级 Agnes）。出图后统一上传 Cowrite 资产库并插入页面合适位置，按既有配图验证契约校验。

**要点**：worker.py 契约里写死「用 ApiYi」的句子是给 Worker agent 的兜底说明文本，实际行为由 action-config 的 prompt 主导（POST /api/tasks 时 Worker GET `/api/action-config` 读提示再执行）。所以**不必**强制改 worker 脚本，只需动 action-config 即可让降级链路生效。

## 端到端验收记录
任务 `task_oZICQ4Ldxzva`：requirements 显式写「图源：Agnes（显式指定免费图源，验证显式选择链路）」。

Worker 完成信息（succeeded）：
> 显式指定图源=Agnes（--source agnes，未走 ApiYi，验证显式选择链路）。Agnes 生成真实 PNG 1312x736 约1MB → 上传 Cowrite 资产库 /assets/I7ObwDa7Ct.png → 插入页面。已按配图验证契约三条全部通过：① 读回页面含 1 张配图；② 图片 src 为 /assets/ 相对路径（无公网绝对 URL 污染）；③ 图片 HEAD 请求返回 HTTP 200、content-type image/png、1071844 字节。页面 revision 1→2。

图片核验：
```
curl -sI http://127.0.0.1:4320/assets/I7ObwDa7Ct.png   # HTTP 200, Content-Type: image/png, Content-Length: 1071844
```

## 快速端到端验收（跳过 1 分钟 timer 等待）
Worker 由 `cowrite-hermes-worker.timer` 驱动，`systemctl is-active cowrite-hermes-worker` 常为 **inactive**（timer 到点才拉起、跑完即退）。

要**立即**处理一条任务：
1. 建任务：`GET /api/session` 取 `x-cowrite-token` → `POST /api/tasks`（illustrate/topic-create 需 pageId）
2. `systemctl start cowrite-hermes-worker` 触发一次性运行（跑完自动回 inactive）
3. 轮询 `GET /api/tasks/<id>` 到 `status=succeeded`（状态名是 `succeeded`，不是 completed）
4. 读 `result.message` / `result.assets` 拿页面与资产链接，再核验图片与页面 revision

## 清理验收产物
- 测试页：`DELETE /api/pages/<id>`（带 token）
- worker 资产生成目录：`rm -rf /root/.cowrite/worker-assets/illustrate-<task>_*/`

## 本机实测补充（2026-09-10，illustrate 5 图真实任务）

**ApiYi 走 CLI 必失败（本机 python3.9）**：`apiyi_image.py --model gpt-image-2-vip` 返回 `{"success":false,"error":"unsupported operand type(s) for |: 'type' and 'type'","error_type":"TypeError"}`——插件代码用了 PEP 604 运行时类型联合（`X | Y`），宿主 `python3` 是 **3.9**（`/usr/bin/python3.9`，无 3.10+ 解释器）。该失败是**每次必现**、与限流/451 无关，所以在本机跑 illustrate 直接按 `--source agnes` 更省时间；Hermes 原生 `image_generate` 工具走 runtime 自带 py3.11（`~/.hermes/.../cpython-3.11.*`）不受影响，是 ApiYi 的可用入口。彻底修需让插件兼容 3.9 或改用 runtime 解释器。

**上传前必须换目录（PrivateTmp 复现确认）**：生成产物若在 `/tmp`（含 worker 自己的 `/tmp/cowrite-illustrate`），`cowrite_upload_asset` 报 `Asset file was not found at '/tmp/...'`——`cowrite-hermes.service` 有 `PrivateTmp=true`，其 namespace 看不到宿主 `/tmp`。先 `cp` 到 `/root/.cowrite/<任意子目录>/`（ReadWritePaths 已含 `/root/.cowrite`）再上传即可，5/5 成功。

**MCP 写入工具不可用时的等价路径（同服务、同乐观并发）**：`insert_after` 的 HTTP 端点是 `POST /api/pages/:id/insert`（body `{anchor, markdown, expectedRevision}`，`anchor` 必须是当前 content 的精确子串，插入点 = anchor 之后**首个 `\n\n`**，因此锚在 h2 文本里就落在该标题块之后；每插一次 revision +1）。写操作需 `x-cowrite-token`（`GET /api/session` 取），漏了是 **403**（不是 401）。写回后可 `GET /api/pages/:id` 只打印 `revision`/`<img` 计数，避免把整页内容反复灌进上下文。

**验证契约的可加载性证据链（比只看 HTTP 200 更硬）**：① `GET /api/pages/:id` 读回断言 `<img` 计数；② 正则抽所有 `src` 断言全部 `/assets/` 开头、`http` 污染数 0；③ 图片下载字节数与本地文件一致——公网入口 `https://<隧道>/cowrite-.../assets/<f>.png` 返回 200/`image/png` 且 `size_download` 等于原图字节（本次 1026445 / 1149239 完全一致），证明不是 SPA fallback 的 HTML。

## 坑
- heredoc 里写含多层反斜杠的命令（如 `--prompt \"<prompt>\"`）会被 shell 转义破坏；改用 write_file 写 .py 再执行，或避免在 prompt 里嵌套转义。
- `POST /api/tasks` 的 `.refine(...)` 只豁免 `topic-collect`；illustrate/topic-create 必须带 pageId（无页面发起时用 projectPath 占位）。
- action-config prompt 项 schema 必须含 `id`（如 `'main'`），否则 zod 判 corrupt、文件被自动改名备份、改动「不生效」。
