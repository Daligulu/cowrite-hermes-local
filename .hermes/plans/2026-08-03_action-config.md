# Cowrite 动作配置化（Action Config）优化方案

> 状态：**待用户确认**（确认后按此方案执行开发）

**Goal:** 把 Cowrite 平台「润色文章」等动作按钮的 Skill 映射从硬编码改为可配置化，支持一个动作配置多个 Skills、多个 Prompts、多步骤工作流组合，并提供网页配置菜单。

**Architecture:** 新增服务端 JSON 配置存储（zod schema 校验）+ 配置 CRUD API + 前端「动作配置」管理页；任务创建与 Worker 执行均从配置读取，配置保存后热生效；默认配置与现有硬编码完全一致（零迁移成本）。

**Tech Stack:** TypeScript（server/前端共用 schema）、zod、React（复用现有 SkillManager 页面模式）、JSON 文件存储（复用 skilldeckPreferences 模式）

---

## 一、现状与问题

| 位置 | 现状 | 问题 |
|---|---|---|
| `server/taskStore.ts:6-16` | `ACTION_SKILLS` 硬编码：`polish → ['humanizer-zh']` 等 9 个 action | 改 skill 需改代码重新部署 |
| `src/CommandBar.tsx` | `ACTION_LABELS` / `ACTIONS` / `ACTION_KEYWORDS` 前端硬编码 | 增删按钮、改关键词需改代码 |
| `deploy/scripts/cowrite-hermes-worker.py` PROMPT | action 分支说明写死在提示词里 | 无法按用户配置执行多 skill/多步骤 |

已有可复用先例：`server/skilldeckPreferences.ts`（JSON + zod 校验 + `~/.cowrite` 目录）、前端 `SkillManager` 页面（配置 UI 模式）。

## 二、目标能力

1. **多 Skills**：一个动作（如润色）可配置多个 skill（如 `humanizer-zh` + `wewrite`），Worker 依次加载执行
2. **多 Prompts**：每个动作可配多条提示词（主提示 + 分步提示），Worker 按序使用
3. **工作流组合**：动作可配置多步骤工作流（如 读页面 → skill A 处理 → skill B 复核 → 写回），每步指定 skill/prompt/输入/输出
4. **配置菜单**：网页端可视化编辑（增删动作、选 skill、编辑 prompt、编排工作流），保存即热生效
5. **兼容**：默认配置 = 现有 9 个动作全部行为，升级后无需手动迁移

## 三、配置模型设计

配置文件：`/root/.cowrite/action-config.json`（与 tasks.json 同目录，COWRITE_HOME 下）

```jsonc
{
  "version": 1,
  "updatedAt": "2026-08-03T00:00:00Z",
  "actions": [
    {
      "id": "polish",                        // 唯一标识（TaskAction 扩展）
      "label": "润色文章",                    // 按钮显示名
      "enabled": true,                       // 是否启用（禁用后不显示、不可提交）
      "chip": true,                          // 是否显示在快捷 chips（false 进「更多」）
      "keywords": ["润色", "改写", "优化", "修改", "口语化", "通顺"],  // 自然语言识别关键词
      "skills": ["humanizer-zh"],            // 支持多个 skill，按序加载执行
      "prompts": [                           // 支持多个 prompt
        { "id": "main", "role": "system", "text": "你是文章润色专家，去除 AI 痕迹…" }
      ],
      "workflow": [                          // 工作流组合（可选；不配则单步：加载 skills + 用 prompts 处理 + 写回）
        { "step": "load",   "skill": "humanizer-zh", "prompt": "main",   "input": "page",        "output": "text" },
        { "step": "verify", "skill": null,             "prompt": "verify","input": "text",        "output": "text" },
        { "step": "write",  "skill": null,             "prompt": null,    "input": "text",        "output": "page" }
      ]
    }
  ]
}
```

**字段说明**
- `skills`：Hermes 已安装 skill 名（前端从 `/api/skills` 拉取列表供多选；保存时校验存在性，允许提示不存在但需警告）
- `prompts`：多提示词列表，`role` 支持 `system`/`user`，Worker 按 `workflow` 引用
- `workflow`：步骤数组，每步 `step` 类型：`load`（加载 skill）、`process`（用指定 prompt+skill 处理）、`verify`（校验产物）、`write`（写回页面/资产）；`input`/`output` 定义数据衔接（`page`=页面内容、`text`=上一步输出、`assets`=资产列表）
- 不配置 `workflow` 的动作走默认流程：加载全部 skills → 用全部 prompts 处理 → 写回页面（等价现状）

## 四、后端改造

**新增 `server/actionConfig.ts`**（复用 skilldeckPreferences 模式）
- zod schema 校验（`version`、`actions[]`、`skills` 数组、`prompts` 数组、`workflow` 步骤）
- 默认配置：内置 `DEFAULT_ACTIONS` = 现有 9 个动作（从现 ACTION_SKILLS/CommandBar 提取）
- `load()`：读文件；不存在/损坏 → 返回默认配置并落盘备份
- `save(actions)`：校验 + 写文件 + 更新 `updatedAt`
- `reset()`：恢复默认

**修改 `server/taskStore.ts`**
- 删除硬编码 `ACTION_SKILLS`
- `create()` 时从 `actionConfig.get(id)` 读取 `skills`（支持多个）写入 `recommendedSkills`

**新增 API（`server/app.ts`）**
- `GET /api/action-config` → 当前配置 + 可用 skills 列表（供前端选择器）
- `PUT /api/action-config` → 保存（需 session token，同现有写操作保护）
- `POST /api/action-config/reset` → 恢复默认

## 五、前端改造

**新增 `src/ActionConfigManager.tsx`**（复用 SkillManager 页面模式）
- 入口：侧边栏新增「动作配置」工具项（或 SkillManager 同层）
- 左侧：动作列表（显示 label/chip 标记，可增删、启停、拖动排序）
- 右侧编辑面板：
  - 基本信息：label、chip 开关、enabled、keywords（逗号分隔编辑）
  - **Skills 多选**：从 `/api/skills` 加载已装 skill 列表，checkbox 多选
  - **Prompts 编辑**：prompt 列表增删，每项可编辑 role/id/text
  - **Workflow 编排**：步骤列表增删/排序，每步选择 step 类型 + skill + prompt + input/output
- 操作：保存（PUT）、恢复默认（reset，二次确认）、「测试」按钮（可选：用当前页面内容试跑一步）
- 保存成功后 toast 提示，命令栏立即刷新

**修改 `src/CommandBar.tsx`**
- `ACTION_LABELS` / `ACTIONS` / `ACTION_KEYWORDS` 不再硬编码
- 挂载时 `GET /api/action-config` 拉取配置，渲染 `enabled && chip` 的 actions
- `detectAction()` 用配置的 `keywords` 做正则识别
- `submit()` 仍提交 `action`，服务端按配置补 skills

**扩展 `shared/types.ts`**
- `TaskAction` 保持字符串（由配置 id 扩展，不再限定字面量联合）；新增 `ActionConfig` / `ActionPrompt` / `WorkflowStep` 类型

## 六、Worker 执行改造

**修改 `deploy/scripts/cowrite-hermes-worker.py` PROMPT**（替换硬编码分支）
- 新增指令：领取任务后先 `GET /api/action-config` 读取该 action 配置
- 按 `skills` 数组依次 `skill_view` 加载（不再只看单个 recommendedSkills）
- 按 `prompts` / `workflow` 组合执行：load → process（每步用指定 skill+prompt）→ verify（真实校验产物）→ write（expected_revision 写回）
- 无 workflow 配置时走默认流程
- 保留既有约束：冲突重读合并、产物真实验证、fail 不标成功、不记录凭据

## 七、测试与验收（TDD）

**服务端测试（`tests/`）**
1. `action-config` schema：合法配置通过、非法（skills 非数组、缺 id、workflow step 缺类型）拒绝
2. 默认配置：首次 load 返回 9 个动作，与现 ACTION_SKILLS 一致
3. CRUD：save 后 load 返回新值；reset 恢复默认
4. 任务创建：配置某 action skills 为 2 个 → 新任务 `recommendedSkills` 含 2 个

**前端测试（vitest 现有 73 个基线）**
5. 配置拉取：mock GET 返回配置 → chips 渲染按配置（chip=true 显示、false 进更多）
6. 保存流程：编辑 → PUT → toast

**端到端验收（CDP + 真实任务）**
7. 配置菜单打开、编辑 polish 的 skills 增加 `wewrite` → 保存 → 提交润色任务 → 任务 recommendedSkills = `['humanizer-zh','wewrite']` → Worker 执行成功写回
8. 移动端（390px）配置菜单可滚动、无横向溢出
9. 恢复默认 → 行为与改造前一致

## 八、实施步骤（任务清单）

1. **T1** 新建 `server/actionConfig.ts`：schema + 默认配置 + load/save/reset（先写失败测试）
2. **T2** 修改 `server/taskStore.ts`：create 从配置读 skills（测试：多 skill 入 recommendedSkills）
3. **T3** 新增 API：GET/PUT/reset `/api/action-config`（测试：token 校验、CRUD）
4. **T4** 新建 `src/ActionConfigManager.tsx`：配置菜单 UI（skills 多选、prompts 编辑、workflow 编排）
5. **T5** 修改 `src/App.tsx`：侧边栏入口 + 视图接入
6. **T6** 修改 `src/CommandBar.tsx`：从配置加载 actions/keywords/labels（测试：mock 配置渲染）
7. **T7** 修改 `shared/types.ts`：新类型 + TaskAction 放宽
8. **T8** 修改 Worker PROMPT：按配置执行多 skill/prompt/workflow
9. **T9** 全量测试 + 构建 + 部署 + 端到端验收（含移动端）
10. **T10** 提交 git（hermes-local-impl 分支）、部署 /opt、health 验证

## 九、涉及文件

| 文件 | 变更 |
|---|---|
| `server/actionConfig.ts` | **新增** |
| `server/taskStore.ts` | 删 ACTION_SKILLS，create 读配置 |
| `server/app.ts` | 新增 3 个 API |
| `shared/types.ts` | 新增 ActionConfig 等类型，TaskAction 放宽 |
| `src/ActionConfigManager.tsx` | **新增** 配置菜单 |
| `src/CommandBar.tsx` | 从配置加载 |
| `src/App.tsx` | 侧边栏入口 + 视图 |
| `src/App.css` | 配置页样式 |
| `deploy/scripts/cowrite-hermes-worker.py` | PROMPT 按配置执行 |
| `tests/` | 服务端/前端测试 |
| `/root/.cowrite/action-config.json` | 运行时配置（gitignore） |

## 十、风险与权衡

- **配置错误导致 Worker 失败** → 保存时 zod 校验 + skill 存在性检查（缺失仅警告不拦截）；Worker 执行失败会 fail_task 并显示真实错误，可回滚
- **热生效范围**：配置保存后新任务立即生效；已排队任务不受影响（沿用创建时快照）
- **Skill 只读保护**：配置只引用已装 skill 名，不修改/删除 Hermes Skills（遵守 Skill 库只读约束）
- **兼容性**：默认配置完全等价现状；`/root/.cowrite/action-config.json` 不存在时自动用默认，无需迁移脚本
- **安全**：配置写操作沿用 session token + 同源保护；配置不存任何凭据

## 十一、待确认问题

1. 配置菜单入口位置：侧边栏「动作配置」单独项，还是合并进现有 SkillManager 页？
2. 是否需要「测试运行」按钮（保存前用当前页面试跑一步）？首版可只做保存+立即生效
3. 动作排序是否可拖拽，还是固定顺序即可？
