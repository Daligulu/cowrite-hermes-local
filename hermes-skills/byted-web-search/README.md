# Byted Web Search — Hermes 双版本适配

火山引擎第一方 `byted-web-search` Skill 的 Hermes 本地适配，并按官方文档补充 Global API；不依赖社区 MCP 或 AI 交叉核查层。

## 特性

- Custom：时间范围、权威来源、Query 改写、网页与图片搜索
- Global：全球网页、摘要长度、每文档图片数与 Token 元数据
- 独立本地凭据：`WEB_SEARCH_CUSTOM_API_KEY` / `WEB_SEARCH_GLOBAL_API_KEY`
- Custom、Global 分别使用跨进程 4 QPS 文件队列

## 来源

- 第一方 Skill：<https://github.com/bytedance/agentkit-samples/tree/main/skills/byted-web-search>
- 官方 Global API：<https://www.volcengine.com/docs/87772/2548026>
- 源码镜像：`~/.hermes/workspace/external-skills/agentkit-samples/`
- 锁定提交：见 `.source_commit`

## 凭据

当前用户可直接在对话中发送两个 Key；Hermes 收到后立即安全写入本地且不回显。

```bash
python3 scripts/configure_key.py --version custom --status
python3 scripts/configure_key.py --version global --status
```

注意：**订阅套餐 Key 仅支持 Custom；Global 必须单独创建按量后付费 Key。**

## 验证

```bash
python3 scripts/web_search.py "中国人工智能最新政策" --version custom --auth-level 1
python3 scripts/web_search.py "Hermes Agent official docs" --version global --count 5
```
