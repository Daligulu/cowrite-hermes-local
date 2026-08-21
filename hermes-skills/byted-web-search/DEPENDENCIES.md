# 运行依赖与升级任务

## 运行依赖

- Linux（跨进程队列使用 `fcntl`）
- Python 3.9+
- `requests>=2.31,<3`
- Hermes `~/.hermes/.env`
- 出站 HTTPS：`open.feedcoopapi.com`

## 外部服务

- 火山引擎豆包搜索 Custom API
- 环境变量：`WEB_SEARCH_CUSTOM_API_KEY`、`WEB_SEARCH_GLOBAL_API_KEY`
- Custom 可使用订阅套餐或按量 Key；Global 仅支持按量 Key
- 默认限流：服务端各 5 QPS，本地各自固定 4 QPS

## 升级任务

1. 更新 `~/.hermes/workspace/external-skills/agentkit-samples`
2. 比较上游 `skills/byted-web-search/` 与安装副本
3. 保留 Hermes 专属凭据、队列和存储边界
4. 更新 `.source_commit`
5. 运行 `python3 -m pytest -q tests`
6. 运行无 Key 与真实 Key 烟测
7. 同步到 Obsidian `20-Library/Skills/Agent/byted-web-search/`
8. 不同步 `~/.hermes/.env`、队列状态或任何搜索结果全文
