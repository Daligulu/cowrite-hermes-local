# CDP 直连适配器 — 设计与调试记录

## 背景

xiaohongshu-skills 原方案使用 Chrome 扩展作为浏览器自动化中间层：

```
cli.py → bridge_server.py (WS:9333) → Chrome 扩展 (MV3) → Chrome
```

在无头 Linux 服务器（CentOS Stream 9, Chrome 149）上，Chrome 扩展的 MV3 Service Worker 加载不稳定：
- `--load-extension` 参数可触发扩展加载，SW 短暂出现在 CDP target 列表中
- 但 Chrome 会快速终止空闲 SW，且 `keepAlive` alarm 未能可靠唤醒
- `ws://localhost/*` host_permission 在无头环境下可能不被 Chrome 执行

## 解决方案

创建 `cdp_bridge.py`，实现与 `BridgePage` 完全兼容的接口，绕过扩展直接通过 CDP WebSocket 操控 Chrome。

```
cli_cdp.py → CDP WebSocket (port 9222) → Chrome → xiaohongshu.com
```

## 关键实现细节

### CDPPage 类
- 接口完全兼容 `BridgePage`（`navigate`, `evaluate`, `click_element`, `input_text`...）
- 通过 `http://localhost:9222/json/list` 发现 page tab
- 获取 `webSocketDebuggerUrl` 建立 WebSocket 连接
- 命令格式：`{"id": N, "method": "Page.navigate", "params": {...}}`

### 陷阱与修复

**陷阱 1: `wait_for_load` 用错了 CDP API**
- 错误：调用 `Page.loadEventFired` 作为方法 → CDP 报错 `'Page.loadEventFired' wasn't found`
- 根因：`Page.loadEventFired` 是事件（event），不是命令（command）
- 修复：改为轮询 `document.readyState === "complete"`

**陷阱 2: `DummyBrowser` 缺失**
- 原始 CLI 命令函数执行 `browser.close()` 清理
- CDP 模式下 browser 为 None → `'NoneType' object has no attribute 'close'`
- 修复：定义 `_DummyBrowser` 类提供空 `close()` / `close_page()` 方法

**陷阱 3: 发布命令缺少参数**
- `cmd_publish` 访问 `args.schedule_at`, `args.original`, `args.visibility`
- CDP CLI 的参数解析器未定义这些字段 → `'Namespace' object has no attribute 'schedule_at'`
- 修复：在 `cli_cdp.py` 的 argparse 中添加这些可选参数

## 环境依赖

| 组件 | 详情 |
|------|------|
| Chrome | 149.0.7827.53, RPM 手动安装 |
| 启动参数 | `--no-sandbox`, `--disable-dev-shm-usage`, `--remote-debugging-port=9222` |
| Xvfb | `:99 -screen 0 1280x720x24 -ac +extension RANDR` |
| Python | `websockets` 库（同步客户端 `websockets.sync.client`） |

## 功能覆盖

| 功能 | 状态 |
|------|------|
| navigate / wait_for_load | ✅ |
| evaluate / query_selector / click | ✅ |
| input_text / type_text / press_key | ✅ |
| scroll / hover / screenshot | ✅ |
| set_file_input (文件上传) | ✅ |
| unlike（取消点赞） | ❌ CDP 模式未实现 |
| get_404_diagnostics / analyze_risk_control | ❌ 需要扩展的拦截器，CDP 模式降级 |
