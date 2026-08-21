---
name: xiaohongshu
description: |
  小红书自动化操作。通过 Chrome CDP 直连实现搜索、浏览、评论、点赞、收藏、内容发布。
  当用户要求操作小红书（搜索、查看笔记、评论、发布）时触发。
version: 2.0.0
---

# 小红书自动化（CDP 直连版）

通过 Chrome DevTools Protocol 直连浏览器，无需 Chrome 扩展，实现小红书全功能自动化。

## 架构

```
Python CLI (cli_cdp.py) → CDP WebSocket (port 9222) → Chrome 浏览器 → xiaohongshu.com
```

相比原版扩展方案，CDP 直连版在无头 Linux 服务器上稳定运行，不依赖 Chrome 扩展加载。

## 项目位置

```
/root/.hermes/workspace/external-skills/xiaohongshu-skills/
├── scripts/
│   ├── cli_cdp.py          # CDP 直连 CLI 入口（✅ 主要使用）
│   ├── cli.py              # 原始 CLI（需要扩展，不推荐）
│   ├── start_chrome.py     # Chrome/Xvfb 一键启动器
│   ├── xhs/
│   │   ├── cdp_bridge.py   # CDP 直连适配器（Hermes 自研）
│   │   ├── login.py        # 登录逻辑
│   │   ├── search.py       # 搜索
│   │   ├── feed_detail.py  # 笔记详情
│   │   ├── comment.py      # 评论
│   │   ├── publish.py      # 发布
│   │   └── ...
│   └── ...
```

## 启动环境

**Chrome + Xvfb 必须已启动：**

```bash
cd /root/.hermes/workspace/external-skills/xiaohongshu-skills

# 检查状态
uv run python scripts/start_chrome.py --status

# 如果未运行，启动
uv run python scripts/start_chrome.py

# 停止
uv run python scripts/start_chrome.py --stop
```

## 命令速查

**始终使用 `cli_cdp.py`，不要使用 `cli.py`。**

工作目录：`/root/.hermes/workspace/external-skills/xiaohongshu-skills`

前缀：`uv run python scripts/cli_cdp.py`

### 认证
| 命令 | 功能 |
|---|---|
| `check-login` | 检查登录，未登录生成二维码 |
| `wait-login` | 等待扫码完成 |
| `delete-cookies` | 退出登录 |

### 浏览
| 命令 | 功能 |
|---|---|
| `list-feeds` | 首页推荐 |
| `search-feeds --keyword "词"` | 搜索笔记 |
| `search-feeds --keyword "词" --sort-by "最多点赞" --note-type "图文"` | 带筛选 |
| `get-feed-detail --feed-id ID --xsec-token TOKEN` | 笔记详情 |
| `get-feed-detail --feed-id ID --xsec-token TOKEN --load-all-comments` | 含评论 |
| `user-profile --user-id ID --xsec-token TOKEN` | 用户主页 |

### 互动
| 命令 | 功能 |
|---|---|
| `post-comment --feed-id ID --xsec-token TOKEN --content "内容"` | 发表评论 |
| `reply-comment --feed-id ID --xsec-token TOKEN --content "内容" --comment-id CID` | 回复评论 |
| `like-feed --feed-id ID --xsec-token TOKEN` | 点赞 |
| `favorite-feed --feed-id ID --xsec-token TOKEN` | 收藏 |

### 发布（默认存草稿）
| 命令 | 功能 |
|---|---|
| **两步存草稿**：先 `fill-publish --title-file ... --content-file ... --images ...` 再 `save-draft` | 填写表单 → 保存草稿（**默认方式**）|
| `publish --title-file /abs/title.txt --content-file /abs/content.txt --images /abs/pic.jpg` | ⚠️ 一步直接发布（仅用户明确要求时）|
| `publish-video --title-file t.txt --content-file c.txt --video /abs/video.mp4` | 视频发布 |
| `click-publish` | 确认发布（配合 fill-publish 分步使用）|

## 执行规则

1. **先确保 Chrome 运行**：`start_chrome.py --status`
2. **如果未登录**：生成二维码 → 用户扫码 → wait-login
3. **绝对路径**：文件参数必须用绝对路径
4. **发布 = 存草稿**：所有发布操作**默认保存到草稿箱**，不直接发布。
   流程：`fill-publish` 填表单 → `save-draft` 存草稿。
   用户明确说"直接发布"时才用 `publish`。
5. **评论确认**：评论/回复前必须征得用户同意
6. **频率控制**：每次操作间隔 3-5 秒

## 登录流程
1. `check-login` → 获取二维码 PNG
2. 用户用小红书 App 扫码
3. `wait-login` → 确认成功
4. Cookies 持久化在 `~/.xhs-chrome-profile/`

## CDP 模式限制
- ❌ 404/风控诊断不可用
- ✅ 所有核心功能（搜索、浏览、评论、发布、点赞、收藏）均可用

## 参考文档
- `references/cdp-bridge.md` — CDP 直连适配器设计文档、已知陷阱与修复、环境配置详情
- `references/architecture.md` — 原始扩展方案架构分析
