# Byted Web Search — Hermes 双版本配置

## 1. API Key 获取

打开：<https://console.volcengine.com/search-infinity/api-key>

分别创建：

- **Custom**：订阅套餐或按量后付费 Key
- **Global**：只能使用按量后付费 Key，不支持订阅套餐

两者免费额度共用，但 API Key 计费模式不能混用。

## 2. 写入 Hermes

当前用户偏好直接在对话中发送 Key。Hermes 收到后立即写入本地 `.env`，不在回复、日志、Git 或 Obsidian 中回显完整值。

本机交互方式：

```bash
python3 scripts/configure_key.py --version custom --set
python3 scripts/configure_key.py --version global --set
```

保存位置与变量：

```text
$HERMES_HOME/.env
WEB_SEARCH_CUSTOM_API_KEY=...
WEB_SEARCH_GLOBAL_API_KEY=...
```

文件权限强制为 `0600`。

## 3. 状态与验证

```bash
python3 scripts/configure_key.py --version custom --status
python3 scripts/configure_key.py --version global --status
python3 scripts/web_search.py "中国人工智能最新政策" --version custom --auth-level 1
python3 scripts/web_search.py "Hermes Agent official docs" --version global --count 5
```

## 4. 4 QPS 队列

Custom 与 Global 服务端限流独立，本地也分别使用独立队列：

```text
$HERMES_HOME/state/byted-web-search/rate-limit-custom.state
$HERMES_HOME/state/byted-web-search/rate-limit-global.state
```

每个版本请求间隔至少 250ms，最高 4 QPS。

## 5. 删除凭据

```bash
python3 scripts/configure_key.py --version custom --remove
python3 scripts/configure_key.py --version global --remove
```

## 6. 故障

- `10409`：订阅套餐 Key 被用于 Global；创建按量后付费 Global Key
- `invalid_api_key` / `10403`：Key 无效或版本/计费模式不匹配
- `700429` / `429`：等待后重试，检查外部并发
- `10406` / `10412`：额度不足
- `10408`：欠费
- `10500`：等待 2–3 秒后重试一次
