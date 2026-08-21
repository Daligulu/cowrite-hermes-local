# Skills 盘点与多端同步

当 `byted-web-search` 被安装、升级、补充版本、改变路由或完成新的真实验收时，除了代码和测试，还要同步能力目录。此流程只保存用途、路由、状态和非敏感验收结果；绝不保存 API Key、Token、Cookie 或原始搜索全文。

## 单一事实源

以 Obsidian 的短用途盘点为可编辑主稿：

```text
/root/Documents/Obsidian Vault/20-Library/Skills/Agent/Hermes Skills 盘点（短用途版）.md
```

条目保持一句话：

```text
byted-web-search — 豆包 Custom/Global 中文实时搜索、政策/金融/国内权威来源核查及全球长摘要
```

状态应区分：代码已适配、凭据已配置、真实 API 已验收。不要把“测试通过”写成“线上可用”，也不要把 Skill 路由写成 Hermes 核心 `web_search` provider 已配置。

## 飞书文档同步

1. 优先定位已有同名文档，不直接新建，避免重复。
2. 使用用户身份搜索标题；缺少 `search:docs:read` 时按 lark-shared 的 split-flow 发起最小 scope 授权，并在用户确认后由 Agent 完成 device-code 流程。
3. 读取现有文档后再更新：小改用精准替换，大版本重建才 overwrite。
4. 更新后重新 fetch，核验标题、豆包条目、Custom/Global 状态、搜索路由和触发示例。
5. 最终返回可点击飞书链接。

## Memos 同步

Memos 单篇正文上限为 **8192 字符**。完整盘点超过上限时：

1. 按稳定章节拆成“上 / 下”或多篇，不做字符级硬切割。
2. 每篇保留相同标题前缀、更新时间和标签：`#Hermes #Skills #能力索引`。
3. 用 reference relation 双向关联各分篇，便于从任一篇跳转。
4. 保存后读取返回的 `memos/<id>`，确认创建成功；不要只凭请求已发送就宣称完成。
5. 若需要更新已有 Memos，先按标题搜索并 update，避免每次产生重复副本。

## 安全边界

同步内容只允许：

- Skill 名称与短用途
- Custom / Global 的 configured、tested、blocked 状态
- 推荐路由和自然语言触发例句
- 测试数量、非敏感错误码和报告路径

禁止同步：

- API Key / Token / Cookie
- `.env` 内容
- 搜索 API 返回的大段正文
- 临时授权 URL、device_code、user_code

## 验收清单

- [ ] Obsidian 主稿已更新并可读
- [ ] 飞书定位的是现有同名文档，或已明确确认需要新建
- [ ] 飞书更新后已 fetch 回读并拿到可点击链接
- [ ] Memos 未超过 8192 字符；超限内容已按章节拆分
- [ ] Memos 分篇已建立双向 reference relation
- [ ] 三端内容均不含凭据
