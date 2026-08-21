# xiaohongshu-skills 架构分析

> 分析日期：2026-06-02 | 版本：v1.0.0 | 仓库：autoclaw-cc/xiaohongshu-skills

## 整体架构

```
┌──────────────┐    WebSocket     ┌────────────────┐    WebSocket    ┌──────────────────┐
│   cli.py     │ ──────────────→  │ bridge_server   │ ──────────────→ │  Chrome 扩展      │
│  (Python)    │  ws://:9333     │   .py (Python)  │  ws://:9333    │  (MV3 JS)        │
└──────────────┘                 └────────────────┘                └──────────────────┘
                                                                          │
                                                                   chrome.debugger
                                                                   chrome.scripting
                                                                          │
                                                                   ┌──────▼──────────┐
                                                                   │  Google Chrome   │
                                                                   │  xiaohongshu.com │
                                                                   └─────────────────┘
```

## 关键组件

### 1. Bridge Server (`scripts/bridge_server.py`)
- 端口：9333（WebSocket）
- 职责：路由 CLI 命令到 Chrome 扩展，支持两个 role：
  - `role=extension`：长连接，扩展注册为持久连接
  - `role=cli`：短连接，发命令→收结果→断开
- 自动唤醒等待中的 CLI 请求（扩展断开时）
- 命令超时：90s

### 2. BridgePage (`scripts/xhs/bridge.py`)
- 实现与 CDP Page 接口兼容的 Bridge 实现
- 所有 DOM 操作通过 `_call(method, params)` 发送到 Bridge Server
- 支持的操作：导航、JS 执行、元素查询/点击/输入、滚动、截图、文件上传、风控分析
- 扩展断连时抛出 `CDPError`

### 3. Chrome 扩展 (`extension/`)
- MV3 清单
- `background.js`：WebSocket 连接管理 + 命令路由 + 风控诊断
- `content.js`：页面注入（`world: MAIN`），访问 `__INITIAL_STATE__`
- `interceptor.js`：在 `document_start` 注入，拦截 fetch/XHR 请求用于风控分析
- 权限：`tabs`, `cookies`, `scripting`, `debugger`, `webRequest`
- 域名：`*.xiaohongshu.com`, `creator.xiaohongshu.com`

### 4. CLI 入口 (`scripts/cli.py`)
- 统一入口，子命令分派
- JSON 输出，`ensure_ascii=False`
- 退出码：0=成功, 1=未登录, 2=错误
- 自动检查 bridge server 状态，未启动则自动启动
- 自动打开 Chrome（扩展未连接时）

## 子技能模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 认证 | `xhs/login.py` | 二维码生成、扫码等待、手机验证码、退出 |
| 搜索 | `xhs/search.py` | 关键词搜索、筛选（排序/类型/时间/范围） |
| Feed | `xhs/feeds.py` | 首页推荐流 |
| 详情 | `xhs/feed_detail.py` | 笔记详情 + 评论加载 |
| 用户 | `xhs/user_profile.py` | 用户主页 |
| 评论 | `xhs/comment.py` | 评论、回复 |
| 互动 | `xhs/like_favorite.py` | 点赞、收藏 |
| 发布 | `xhs/publish.py` | 图文发布 |
| 发布 | `xhs/publish_video.py` | 视频发布 |
| 发布 | `xhs/publish_long_article.py` | 长文发布 |
| 行为 | `xhs/human.py` | 人工行为模拟 |

## 依赖

```toml
# pyproject.toml
dependencies = [
    "python-socks>=2.8.1",
    "requests>=2.28.0",
    "websockets>=12.0",
]
```

## 本地环境适配

### CentOS Stream 9 服务端部署记录

**已满足条件**（2026-06-02）：
- Python 3.11.15 ✅
- uv 0.11.6 ✅
- websockets 15.0.1 ✅
- python-socks 2.8.1 ✅
- requests 2.33.0 ✅
- Xvfb 已安装 ✅
- Google Chrome 149.0.7827.53 ✅（手动 RPM 安装）
- 系统资源：3.6GB RAM, 80GB 磁盘 (66GB 空闲), 2 CPUs

**Chrome 安装步骤**（CentOS Stream 9）：
```bash
# 安装依赖字体
yum install -y liberation-fonts libXScrnSaver

# 下载 + 安装 Chrome
wget -O /tmp/google-chrome.rpm \
  https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
yum install -y /tmp/google-chrome.rpm
```

## 404 / 风控诊断机制

扩展内置了详细的 404 诊断系统：

1. **导航级检测**：页面加载完成后立即检测是否为 404/风控拦截页
2. **fetch/XHR 拦截**：`interceptor.js` 拦截带 404/461/403 状态的 API 请求
3. **根因分类**：
   - `session`：web_session 失效
   - `token`：xsec_token 缺失/过期/绑定失败
   - `captcha`：人机验证
   - `content_unavailable`：内容被删除/下架
   - `risk_control`：IP/账号级风控
4. **置信度**：high（服务端 302 重定向模式最确定）/ medium

## 注意事项

1. **无 GUI 环境**：必须使用 Xvfb 提供虚拟 X11 显示
2. **Chrome sandbox**：root 下需 `--no-sandbox`
3. **扩展加载**：必须用 `--load-extension=` 参数，不能用打包的 crx
4. **首次登录**：二维码方式需人工扫码，cookies 持久化后可跳过
5. **小内存环境**：3.6GB RAM 建 Chrome 占 ~1GB，操作时注意内存余量
