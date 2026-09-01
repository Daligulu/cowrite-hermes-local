# 外部 Skill 接入为新动作（配置化 runbook，2026-08 实证）

把第三方 Skill（如 `SpaceZephyr/creator-buddy` 的 gzh/space 系列）接成 Cowrite 新动作，
走「**配置化**」路径即可，**通常不必改 worker.py**。本文是 2026-08 把 baokuan-title / gzh-short-post /
space-gzh-cover 三个动作接进去并全部端到端验收通过的完整可复现流程。

## 关键架构事实（先记住，别走弯路）

- Worker 用 `skill_view(name)`（**bare name**）从 **Hermes 全局 skill 库 `~/.hermes/skills/<category>/<name>/`** 解析 skill。
- 项目里的 `hermes-skills/` 目录是**归档副本**（README 里明确：重建/复刻时把内容放回 Hermes skills 目录即可恢复整套能力），
  它是**打包用途、随 git 部署带到生产**，**不是 Worker 运行时的解析依赖**。
- 因此：**新 skill 必须两处都放** —— `~/.hermes/skills/`（Worker skill_view 能解析到）+ `hermes-skills/`（归档/交付，随部署到生产）。缺一不可，否则生产动作会找不到 skill。

## 四步接入（每步都要真实验证）

1. **skill 落地 `~/.hermes/skills/creative/<name>/`**
   - 从第一方源码取完整目录（SKILL.md + references/ + scripts/ + assets/），`cp -r` 过去，补 `.source_url`/`.source_commit`。
   - 验证：`skill_view(name='<name>')` 能返回完整 frontmatter + 正文（说明 Hermes 已注册、可解析）。`skills_list(category='creative')` 里应能看到它。
   - 分类惯例：gzh/space 创作系放 `creative/`（与 gzh-design 同族）。

2. **`server/actionConfig.ts` DEFAULT_ACTIONS 加动作对象**
   ```ts
   { id: '<action-id>', label: '中文名', enabled: true, chip: boolean,
     keywords: ['触发词','...'],        // 避开过宽单字（如「标题」），用具体词，避免正则误吞
     skills: ['<skill-name>', 可选依赖如 'apiyi-image-generation'],
     prompts: [{ id:'main', role:'system',
       text: '把该 skill 的执行流程写清楚：①…②…③…。红线：…' }],
     workflow: [] }                      // 空即可，Worker 默认流程 = 加载 skills→用 prompts→写回
   ```
   - prompt 要把**执行步骤 + 校验命令 + 红线**写全（Worker 是 LLM，靠 prompt 驱动；生图类要指明用哪个出图模型、上传用 mcp_cowrite_cowrite_upload_asset、跑哪个校验脚本）。

3. **`src/CommandBar.tsx` ACTION_GROUPS 加 action id**
   - `ACTION_GROUPS` 是硬编码的 6 组（写作加工/配图/内容分发/演示视频/公众号贴图/选题投稿），每组 `actionIds` 数组引 id。
   - 把新动作 id 加进**对应分组**（如标题/短文 → `write` 组；封面/图表 → `image` 组）。label 运行时从 `/api/action-config` 动态读。

4. **`hermes-skills/` 归档 + README + 测试断言**
   - `cp -r ~/.hermes/skills/creative/<name> hermes-skills/<name>`；确认 `git check-ignore` 不忽略它。
   - 更新 `hermes-skills/README.md` 的「A. 动作执行层（N 个）」表格：加一行，N 同步 +1。
   - `tests/action-config.test.ts`（**2 处**）+ `tests/action-config-api.test.ts`（**1 处**）的 `toHaveLength(N)` 全部 +N。

## 测试三连（必跑）
```bash
npm test && npx tsc -b && npm run build      # 133/133 基线
git add -A && git commit -m '...' && git push origin hermes-local-impl
cd /opt/cowrite-hermes && git fetch origin hermes-local-impl -q && git reset --hard origin/hermes-local-impl -q
npm run build && systemctl restart cowrite-hermes.service && sleep 2 && curl -fsS http://127.0.0.1:4320/api/health
```

## 生产 action-config 合并（关键：改代码**不会**自动带新动作到生产）
生产读的是独立文件 `/root/.cowrite/action-config.json`。新增动作必须 API merge（幂等，先查后并）：
```python
token = GET /api/session -> {token}
cfg   = GET /api/action-config        # {config:{version,updatedAt,actions}}
actions = cfg.config.actions           # 解析 config.actions！误读 cfg.actions 会拿到空
for new in NEW_ACTIONS:
    if new.id not in {a.id for a in actions}: actions.append(new)   # 幂等去重
PUT /api/action-config  body={version:cfg.config.version, actions}  # 无 config 包装
                          headers: x-cowrite-token + content-type:application/json
# 重新 GET 断言：动作数 == 旧数+新增, 且每个新 id 存在
```

## 端到端验收（真实验证，反对只查 status）
```python
page = POST /api/pages {title, content}          # 带真实正文
task = POST /api/tasks {action, pageId, requirements, delivery:'cowrite'}
轮询 GET /api/tasks（Worker 约 1 分钟领取，容忍 queued→running→succeeded 间隔）
     status 名是 `succeeded`（不是 completed/failed）
GET /api/pages/:id 读回 -> 确认 revision 递增 + 关键标记存在（如「候选标题」/「安全区」/「封面」）
生图类再单独视觉/机器校验产物（如 check_cover.py --safe-zone --share-preview 的分享预览可读性）
```

## 坑
- **动作数断言别口算**：`toHaveLength(N)` 的 N 以实际 `store.load()` / GET 结果为准。本批实为
  19（原始）→ +baokuan-title =20 → +gzh-short-post +space-gzh-cover =22；容易误写成 23。
- 测试标题「exposes the N default actions」常**滞后**于真实计数（写 18 实为 19），属陈旧文案，不影响断言，不必顺手改标题。
- 加动作前先确认当前默认动作数（`npm test` 失败会提示 got vs expected，直接看报错数字最准）。
- 推荐位分组 actionIds 里若引用了生产 action-config 中不存在的 id，前端 label 只会回退显示 id 本身，不会崩——所以分组加 id 前要确保动作已在 config 落地。
