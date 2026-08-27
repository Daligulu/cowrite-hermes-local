# 技能自身同步约定（本 skill 的维护工作流）

**唯一事实源**：`/root/.hermes/skills/software-development/cowrite-platform-dev/`
（SKILL.md + references/ + scripts/ 都以这里为准）。

但有**两处镜像副本会静默落后**——每次大改本技能的文件（SKILL.md / references / scripts），
必须主动同步，否则下次从镜像读到的是旧版。**不要等用户催**（教训：2026-08-27 用户要求
「更新 GitHub 对应项目」时才暴露镜像已落后）。

## 镜像①：GitHub 归档（仓库 `cowrite-hermes-local` 内 `hermes-skills/cowrite-platform-dev/`）
在仓库根跑（本地目录是仓库超集，`--delete` 不会误删仓库原有 references）：
```bash
cd /root/.hermes/workspace/cowrite-hermes-local
rsync -a --delete /root/.hermes/skills/software-development/cowrite-platform-dev/ hermes-skills/cowrite-platform-dev/
git add -A
git commit -m 'hermes-skills(cowrite-platform-dev): 同步本地最新版'
git push origin hermes-local-impl
```
push 后核对远端 HEAD：`git log origin/hermes-local-impl --oneline -1`。

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
