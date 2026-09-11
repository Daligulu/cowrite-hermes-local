# 技能自身同步约定（本 skill 的维护工作流）

**唯一事实源**：`/root/.hermes/skills/software-development/cowrite-platform-dev/`
（SKILL.md + references/ + scripts/ 都以这里为准）。

但有**两处镜像副本会静默落后**——每次大改本技能的文件（SKILL.md / references / scripts），
必须主动同步，否则下次从镜像读到的是旧版。**不要等用户催**（教训：2026-08-27 用户要求
「更新 GitHub 对应项目」时才暴露镜像已落后）。

## 镜像①：GitHub 归档（仓库 `cowrite-hermes-local` 内 `hermes-skills/`，29 个 skill）

**范围**：不止本 skill——`hermes-skills/` 是整个 Cowrite 依赖的 skill 归档（归档说明与分层清单见
仓库内 `hermes-skills/README.md`，含「同步记录」表，每次同步后追加一行）。

**同步方法（必须用 `-c` 校验和，默认大小+时间比较会把只改 mtime 的文件误判为变更）**：
```bash
cd /root/.hermes/workspace/cowrite-hermes-local
for n in <要同步的 skill 名...>; do
  src=$(find -L /root/.hermes/skills -maxdepth 3 -type d -name "$n" | head -1)
  rsync -a -c --exclude='__pycache__/' --exclude='.git/' \
        --exclude='*.bak-*' --exclude='*.corrupt-*' "$src/" "hermes-skills/$n/"
done
git add -A && git commit -m 'chore(hermes-skills): 镜像同步 <skill>' && git push origin hermes-local-impl
```
- **`find` 必须带 `-L`**：`lark-doc` 等是符号链接（→ `~/.agents/skills/lark-doc`），不带 `-L` 会被判为「本地无此 skill」而漏检
- 排除项 `__pycache__/ .git/ *.bak-* *.corrupt-*` 已在仓库 `.gitignore` 登记；镜像内不要留备份文件
- push 前扫描密钥：`git diff --cached | grep -nE '^\+.*(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|BEGIN [A-Z ]*PRIVATE KEY)'`（仓库是 **public**）
- push 后核对远端：`gh api repos/Daligulu/cowrite-hermes-local/commits/hermes-local-impl --jq .sha`（比 `git log origin/...` 更可靠，后者依赖本地 fetch 缓存）

**完整性自检（每次同步后跑，两个维度都要查）**：
1. **内容一致**：逐 skill `diff -rq --exclude=__pycache__ --exclude=.git --exclude='*.bak-*' <本地> hermes-skills/<n>` → 无输出即一致
2. **依赖覆盖**：`GET /api/action-config` 取所有 action 的 `skills` 去重，逐个确认镜像内有同名目录
   ```bash
   TOKEN=$(curl -fsS http://127.0.0.1:4320/api/session | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
   curl -fsS -H "x-cowrite-token: $TOKEN" http://127.0.0.1:4320/api/action-config | \
     python3 -c 'import sys,json;c=json.load(sys.stdin)["config"];print(sorted({s.split("/")[-1] for a in c["actions"] for s in (a.get("skills") or [])}))'
   ```
**教训两层**：① 只查「已归档目录的文件有没有改」查不出「动作引用了但从未归档的 skill」——2026-09-11 才发现 `baoyu-infographic`（2026-09-04 接入微信贴图配图）从未入镜像，按 GitHub 重建会缺该能力；② 内容同步≠可用，必须同时过依赖覆盖检查。

## 镜像②：Obsidian 归档（`/root/Documents/Obsidian Vault/20-Projects/Cowrite-for-Hermes/`）
- 命名沿既有约定 `<主题>-<YYYYMMDD>.md`，如：
  `峰峰IP配图一致性方案-20260820.md`、`推荐位分组下拉菜单修复-20260827.md`
- 内容写成**自包含记录**：背景 / 根因 / 方案演进（含被否方案）/ 验收 / 坑，
  供手机端 Obsidian 阅读，不依赖本 skill 上下文。

## 落后程度实测（2026-08-27）
GitHub 副本曾缺：
- SKILL.md 缺约 100 行（手机草稿选择器、动效优化等章节未同步）
- 缺 8 个 references（action-selector-groups / html-icon-verify / nav-icon-svg /
  sidebar-icon-unification / t2i-3x4-crop / wechat-article-layout-render-390 /
  wechat-publish-news-vs-newspic）
- 缺 1 个 script（motion-verify.js）
故任何一次涉及「新增章节 / 新增 references / 新增 scripts」的改动都值得同步一遍。
