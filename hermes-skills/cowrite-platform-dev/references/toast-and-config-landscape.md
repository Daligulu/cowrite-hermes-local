# Cowrite 通知/提示 与 配置存储 现状（2026-08-27 调研）

做「任务完成提醒」「任意全局可配置 UI 参数」类功能前必读，避免重复踩现状。

## 前端 toast 体系（src/App.tsx）
- 底部小 toast：`App.tsx` L553-554 `toast`/`toastLeaving` state；L578-582 `useEffect` 2.2s 后 `setToastLeaving(true)`；L584 `notify()` 触发；L792 渲染 `<div className={`toast ${toastLeaving?'is-leaving':''}`} ...>✓ {toast}</div>`，`onAnimationEnd` 卸载。
- 样式 `App.css` L171-174：`.toast` fixed `left:50%; bottom:28px`、12px、`toast-in`/`toast-out`、`.is-leaving` 两段式退场。
- **关键事实**：该 toast 只在 `notify()` 被调用时弹（保存成功/提交成功/报错），**任务完成不弹任何 toast**——任务完成只由 `CommandBar.tsx` 任务条（3s 轮询当前页任务）静态更新状态，无提醒。
- 现有 toast **不可点击关闭**，仅定时自动消失。

## 任务完成检测入口（CommandBar.tsx）
- `EditorCommandBar` L75-87：`refresh()` 每 3s 拉 `/api/tasks`，`setTasks(all.filter(t => t.pageId === page.id).slice(0,5))`。
- 若要在任务完成时自动弹提示，检测逻辑需上移到 App 层做**全局轮询** `/api/tasks`，用上一次 status 快照对比，仅在 `running→succeeded/failed` 跳变时触发一次；同一任务同一次完成只弹一次，防轮询重复触发；多任务同轮只取最新状态一条。
- `/api/tasks` 返回**数组**（非 `{tasks:[...]}`）；成功状态名为 `succeeded`（非 completed/failed/cancelled）。

## 配置存储 landscape（server/）
现有配置 store（均 zod schema + 损坏文件自动改名备份 + 写操作在 token 校验 middleware 之后注册）：
- `actionConfig.ts` → `/api/action-config`（动作配置）
- `styleConfig.ts` → `/api/style-config`（写作/排版/配图预设）
- `channelConfig.ts` → `/api/channel-config`（选题渠道）
- `wechatAccounts.ts` → `/api/wechat-accounts`（公众号账号）
- `skilldeck.ts` / `skilldeckPreferences.ts`（技能库）

**重要：目前没有通用 UI 设置 / appConfig 存储。** 要加任何全局可配置的 UI 参数（如 toast 自动消失时长），需**新增** `server/appConfig.ts` + `/api/app-config`（GET 免 token / PUT 需 token、zod 校验），并在配置页加字段；不要塞进动作配置（action-config）——两者职责不同。

## 2026-08-27 已确认需求（grill 锁定）→ **已落地（commit 5e2756c）**
- 新增「任务完成居中弹屏」，与底部小 toast **并存**（底部管操作反馈：保存/提交/报错；居中管任务结果）。
- 触发：全局任意任务 `running→succeeded/failed` 跳变（App.tsx 全局轮询）。
- 样式：成功绿「任务已完成」/ 失败红「任务失败」/ 取消不弹；多任务同轮只显示最新一条。
- 交互：点击弹屏立即消失；auto-hide 时长走**新增 appConfig**（默认 30s）可调；刷新后不重弹（不持久化）。
- 验收：CDP 造任务改状态断言弹屏出现/文案/颜色/超时消失/点击消失/刷新不重弹/配置生效；390px 无溢出；测试基线 133/133 + build。
- **已落地**：`server/appConfig.ts` + `/api/app-config`、`App.tsx` 全局轮询 + `task-complete` 弹屏、`ActionConfigManager`「任务提示」区块。实现细节与坑见 SKILL.md「任务完成居中弹屏 + appConfig」。
