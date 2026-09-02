# 配图「运行成功但排版后看不到」的诊断与根因（2026-09-01 实测）

触发：用户报「Cowrite 编辑页排版后无法插入配图，虽然配图运行成功了」。这是**页面 content 里图片以错误链接形态存在 + Worker 拔高验证标准**的结构性问题，与「图片完全丢失」（见 page-content-recovery.md）不同——图其实在 content 里，只是加载不出来 / 没被真实验证。

## 三层根因（用真实证据交叉验证，非猜测）

### ① 图片链接被固化成公网绝对 URL（最致命）
读页面 content 发现，三张图存的是**完整公网绝对 URL**：
```
http://107.150.109.152/cowrite-005b…/assets/dFX2CGwCqJ.jpg
```
而**正确存储形态是相对路径** `/assets/xxx.jpg`。
- 前端 `fixAssetLinks` 只改写 `/assets/` 开头的相对路径；已是绝对 URL 它不动。
- 后果：Cloudflare 隧道**每次重启换域名**、或用户从 **https 隧道**打开而图写的是 **http 主入口** → 图片立即加载失败 =「排版后图出不来」。
- **判断信号**：`curl -fsS /api/pages/<id>` 读 content，`grep -o 'assets/[^"]*'` 若命中 `http://…/cowrite-…/assets/…` 完整 URL 而非 `/assets/…`，即中招。

### ② Worker 拔高了「成功」的判定（假成功）
illustrate 任务 `task_knGskQW9y7Mo`（requirements="之前排版任务覆盖了配图，把配图插入"）status=succeeded，但它**没做真实插入**——检测到页面里已有 3 张图就判定「已正确保留，无需重新生成」。它只验证了「页面有 `<img>` + 资源 HTTP 200」。
- 没验证「图以可加载的相对路径写入」「`naturalWidth>0`（真渲染出来）」「是否用户选定风格」。
- **教训**：配图成功 ≠ 图可见。worker 契约的「真实验证→写回」对图片类必须落到「读回 content 断言 src 形态 + 真加载」这一步，不能只看 `status=succeeded` 和资源 HTTP 200。

### ③ gzh-layout 排版重打包配图
排版动作（gzh-layout）把图片重新组织成 `<section><span leaf><img/></span></section>` 嵌套，且链接被固化成排版那一刻的公网地址。图与正文都在，但**链接形态、位置、风格**都可能是排版产物而非用户期望。

## 可复用诊断脚本（只读，改任何数据之前先跑）
```bash
# 1. 读页面 content，看图片 src 形态（相对 vs 绝对 URL）
curl -fsS http://127.0.0.1:4320/api/pages/<page_id> | python3 -c \
  "import sys,json;d=json.load(sys.stdin);c=d.get('content','');print('rev',d.get('revision'),'len',len(c));import re;[print('SRC',m) for m in re.findall(r'src=\"([^\"]+)\"',c) if 'assets' in m]"
# 期望 src 全是 /assets/xxx（相对路径）；若含 http://107.150.109.152/… 或隧道域名 → 罪魁①
# 2. 资产本身健不健康（区分「图丢了」vs「链接错了」）
for f in <hash1> <hash2> <hash3>; do curl -sI http://127.0.0.1:4320/assets/$f.jpg | head -3; done
# 期望 200 + image/jpeg + 真实字节；若全 200 → 资源没丢，问题在链接形态
# 3. 查配图任务真实产物（判「真插入」还是「伪成功」）
python3 -c "import json;t=json.load(open('/root/.cowrite/tasks.json'));ts=t if isinstance(t,list) else t.get('tasks',[]);\
[print(json.dumps({k:x.get(k) for k in ['id','action','status','result']},ensure_ascii=False)[:1500]) for x in ts if x.get('id')=='<task_id>']"
```

## 优化方向（已向用户提案，执行前须确认）
- **A｜根治链接形态**：排版/配图写回一律存相对路径 `/assets/…`；前端 `fixAssetLinks` 增强——对已是绝对 URL 但指向本域的，重写为当前入口的绝对 URL（兼容历史脏数据 + 隧道换域名）。
- **B｜Worker 配图增强验证**：illustrate 完成时除「有 img」外，再验 src 相对路径 + 资源 200 + 至少一张 `naturalWidth>0`；不满足 `fail_task` 写真实错误。
- **C｜排版不覆盖配图**：gzh-layout 遇已有 `<img>` 原样保留对应节，不重排、不固化公网 URL。
- **D｜历史脏数据清洗（一次性）**：扫描全部页面，把 content 中 `http://107.150.109.152/cowrite-…/assets/` 与隧道域名绝对 URL 统一改回 `/assets/…`，用 MCP `cowrite_update_page` 带 expected_revision 逐个改。

推荐组合 **A+B+D**（C 视「是否要排版保留原图精确位置」再定）。涉及生产改动须先完整备份+回滚脚本，确认后再走三连+部署+验收。
