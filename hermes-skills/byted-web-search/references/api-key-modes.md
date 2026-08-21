# API Key 模式与安全注入

## Key 模式矩阵

| 版本 | 可用 Key | 环境变量 | API |
|---|---|---|---|
| Custom | 订阅套餐或按量后付费 | `WEB_SEARCH_CUSTOM_API_KEY` | `/search_api/web_search` |
| Global | 仅按量后付费 | `WEB_SEARCH_GLOBAL_API_KEY` | `/search_api/global_search` |

Global 与 Custom 免费额度共用，但 Key 的计费模式不能混用。将订阅套餐 Key 调用 Global 时，真实接口会返回：

```text
10409 The package mode does not support this SearchType.
```

遇到该错误不要重试、不要把同一个 Key 复制到 Global；应请求用户创建独立的按量后付费 Key。

## 对话内接收 Key

当前用户偏好直接在对话中发送凭据，不使用 noVNC。处理步骤：

1. 不复述、不引用完整 Key。
2. 启动 `configure_key.py --version <custom|global> --set` 的交互式进程。
3. 通过进程 stdin 提交 Key，避免进入 shell 参数和进程列表。
4. 等待进程退出，只检查变量状态与 `.env` 的 `0600` 权限。
5. 扫描 Skill、测试、Git 和 Obsidian 副本，确认没有凭据泄漏。
6. 用不输出请求头的最小真实查询验证对应版本。

## 双版本验收

- Custom 和 Global 必须分别显示 configured。
- 两个版本分别发起真实请求；不能只根据写入成功宣称 API 可用。
- 两条 4 QPS 队列状态文件必须独立。
- Custom 订阅 Key 验证成功不代表 Global 可用。
- 对照测试使用相同查询、相同结果数量和相邻时间窗口。

## 搜索路由经验

一轮 10 题中文对照中：

- Exa 更擅长精确官网、GitHub、技术文档和海外资料。
- 豆包 Custom 的中文域名覆盖更广，发布时间字段更完整，国内媒体与字节生态召回更强。
- 政策、医疗、金融等高风险查询应使用 Custom `--auth-level 1`，并打开原始 URL；必要时再用 Exa 交叉核对。

原始 API 正文不长期归档；只保存聚合指标、自己的判断和原始来源链接。