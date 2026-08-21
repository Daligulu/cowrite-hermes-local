# Action Config：默认动作与 API 契约

来源：`server/actionConfig.ts`（DEFAULT_ACTIONS）、`server/app.ts`（路由）。2026-08-03 动作配置化落地时整理。

## 配置文件
- 路径：`$COWRITE_ACTION_CONFIG` 或 `$COWRITE_HOME/action-config.json`（无 COWRITE_HOME 时 `~/.cowrite/action-config.json`）
- 不存在 → `load()` 返回内置默认（不写盘）；损坏 JSON/zod 校验失败 → 原文件改名 `action-config.json.corrupt-<ts>-<uuid>` 备份，返回默认
- 保存：`save()` 串行写（writeChain），`updatedAt` 自动更新；`reset()` = 写回默认

## 动作模型（zod）
```
{ version: 1, updatedAt?: string, actions: ActionConfig[] }   // min 1 action
ActionConfig = {
  id: string(1-80), label: string(1-100),
  enabled: boolean=true, chip: boolean=true,
  keywords: string[](1-50 each),        // 支持正则，如 '配\\d+张图'
  skills: string[](1-200 each),         // 纯 skill 名（basename），非 catalog folder
  prompts: { id, role:'system'|'user', text }[],
  workflow: { step:'load'|'process'|'verify'|'write', skill?, prompt?, input?, output? }[],
}
```
workflow 为空时 Worker 默认流程：加载全部 skills → 用全部 prompts 处理 → 写回页面。

## 默认 9 动作（旧硬编码 ACTION_SKILLS 一致）
| id | label | chip | skills | 关键 keywords |
|---|---|---|---|---|
| polish | 润色文章 | ✓ | humanizer-zh | 润色 改写 优化 修改 口语化 通顺 |
| illustrate | 文章配图 | ✓ | apiyi-image-generation | 配图 插图 插画 配\d+张图 生成图 图片 |
| feng-ip | 峰峰 IP 配图 | – | feng-ip | 峰峰配图 IP配图 峰峰形象 |
| slides | 制作 PPT | ✓ | dashiai-ppt | ppt 幻灯片 演示文稿 slides 做\d+页 |
| wechat-layout | 公众号排版 | ✓ | wewrite | 排版 公众号 微信文章 草稿箱 |
| xiaohongshu | 小红书图组 | – | xiaohongshu, apiyi-image-generation | 小红书 |
| feishu-doc | 发布飞书文档 | ✓ | lark-doc | 飞书 云文档 发布文档 |
| knowledge-base | 存入峰峰知识库 | – | feng-knowledge-base | 知识库 归档 KB |
| video | 制作视频 | – | feng-video | 视频 video |

## API 契约
- `GET /api/action-config` → `{ config: ActionConfigFile }`（免 token，注册在 token middleware 之前）
- `PUT /api/action-config` → body=ActionConfigFile（zod 校验，400 报路径错误）；成功返回 `{ config }`（**必须在 token middleware 之后注册**；前端 requestJson 需带 `content-type: application/json`）
- `POST /api/action-config/reset` → `{ config }`（同上鉴权）
- `POST /api/tasks`：action 已放宽为 `z.string().trim().min(1).max(80)`，自定义 id 可直接提交；`recommendedSkills` 由 TaskStore 从配置 `skillsFor(action)` 读取（未知 action → []）

## Worker 消费
Worker PROMPT 第 2 步先 `GET http://127.0.0.1:4320/api/action-config` 读 action 配置：skills 逐个 skill_view（缺则就近替代并说明）、prompts 作为处理提示词、workflow 按步骤执行（load/process/verify/write）；自定义 action 按配置处理并写回页面。

## 前端要点
- CommandBar/HomeWorkspace 不再 import `ACTION_LABELS`（已删）；动作名回显用 `actions.find(a=>a.id===id)?.label ?? id`
- ActionConfigManager 的 skill 勾选：catalog 返回 folder（带分类前缀），存配置用 basename；自定义 skill 输入框可加任意名
- 试运行 = 用当前页面 POST /api/tasks（requirements 前缀「（动作配置试运行）」），验收后记得取消清理
