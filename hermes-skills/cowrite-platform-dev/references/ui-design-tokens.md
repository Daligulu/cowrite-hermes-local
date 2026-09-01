# Cowrite UI 设计 token 定稿（方案 C，2026-08-28）

> 依 `ios-design-md` 定价位标杆（内容创作工作台 → `productivity/craft | notion | things-3` 的
> DESIGN.md），按用户确认的方向（C 方案：渐变主按钮 + 纯蓝功能）生成本项目的 token 定稿表。
> **仅作方案基准，用户确认后才落码**（见 SKILL.md「UI 设计改动前置流程」）。

## 主色（C 方案）
| 变量 | 值 | 说明 |
|---|---|---|
| `--primary` | `#2F5BEA` | 主蓝：链接/选中/复选/激活 |
| `--primary-press` | `#2347C9` | 按压态 |
| `--primary-strong` | `#2F5BEA→#6E56CF` 渐变 | 主按钮（替换旧 `#16324f→#1e4d7c`）|
| `--accent-end` | `#6E56CF` | 渐变终点紫/装饰 chip |
| `--accent-soft` | `#8B73E8` | 暗色用浅紫（光色不用）|
| `--accent-bg` | `#EEF2FF` | 选中浅底 |
| `--link` | `#2F5BEA` | 任务/资产链接 |
| `--focus-ring` | `#2F5BEA` | focus outline |

## 画布与文本（暖白，对标 Craft）
| 变量 | 值 | 旧散落值 |
|---|---|---|
| `--canvas` | `#FCFCFD` | #fff |
| `--surface` | `#F4F4F6` | #fbfcfe / #eef2f7 |
| `--surface-2` | `#ECECEF` | #ecf0f5 系 |
| `--divider` | `#E6E6EA` | #e6eaf0 |
| `--text` | `#1C1C22` | #1c2b3a |
| `--muted` | `#6A6A78` | #64748b |
| `--faint` | `#9B9BA6` | #8a94a0 |
| `--hover` | `#F0F0F3` | #eef2f7 |
| `--carbon` | `#37352F` | 深色控制面 |

## 语义状态色（三套归一为一套）
| 变量 | 值 | 旧散落 |
|---|---|---|
| `--success` | `#30A46C` | #2fa96b / #1d7a4f / #1d6f45 |
| `--error` | `#E5484D` | #d54343 / #a22525 / #b02a2a |
| `--info` | `#2F5BEA` | #2f7de1 |
| `--warning` | `#F0A92B` | #e9b949 / #a26817 |

## 排版 Type Scale
| 角色 | 字号/行高 |
|---|---|
| 页面标题 | 22px / 700 |
| H1 | 20px / 600 |
| H2 | 17px / 600 |
| 正文（编辑器） | 16px / 1.7（旧 15.5px，略小）|
| 卡片标题 | 14px / 600 |
| 辅助/元信息 | 12px / 400 |

## 间距网格（4/8pt）与圆角
- 间距：`--space-1:4 / 2:8 / 3:12 / 4:16 / 6:24 / 8:32`（替换散落 margin）
- 圆角：`--radius-sm:6 / md:10 / lg:14`（现有 8-14 归三档）
- 按钮高度：`--btn-h-sm:28 / md:36 / lg:44`（移动端触控 ≥44px）
- **字体**：保留 Noto Sans SC（中文正文不换 Inter），补 fallback 栈
  `-apple-system,'PingFang SC','Noto Sans SC',sans-serif`

## dark mode 预案（独立后续批次，P0 只做光色）
| 变量 | 光值 | 暗值 |
|---|---|---|
| `--canvas` | `#FCFCFD` | `#1A1A1E` |
| `--surface` | `#F4F4F6` | `#232328` |
| `--surface-2` | `#ECECEF` | `#2C2C32` |
| `--divider` | `#E6E6EA` | `#34343C` |
| `--text` | `#1C1C22` | `#ECECEF` |
| `--muted` | `#6A6A78` | `#9B9BA6` |
| `--faint` | `#9B9BA6` | `#67677A` |
| `--primary` | `#2F5BEA` | `#2F5BEA`（两模可读）|
| 渐变终点紫 | `#6E56CF` | `#8B73E8`（更亮紫）|
| `--success/error/warning` | 不变 | 不变（两模可读）|

> 实现：色值全部走 CSS 变量，顶部 `[data-theme="dark"]` 覆盖一套，或 `prefers-color-scheme`
> 自动 + 手动开关。dark 会放大改动面近一倍（每组件双态核对），建议独立批次。
