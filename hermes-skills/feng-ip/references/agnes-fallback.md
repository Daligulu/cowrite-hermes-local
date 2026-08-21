# Agnes 应急回退

## 使用边界

ApiYi Nano Banana 是 `feng-ip` 的唯一默认人物一致性主链路。只有以下情况之一成立时，才考虑 Agnes：

- ApiYi Nano Banana 暂时不可用；
- 用户明确允许改用 Agnes；
- 当前任务只需要低风险草图，不要求与参考图高度一致。

Agnes 没有 Nano Banana 同等级的人物锁定能力。不得把 Agnes 结果声称为已经达到参考图一致性；正式人物定稿仍应回到 Nano Banana 2/Pro。

## 配置

脚本：`scripts/generate_feng_with_agnes.py`  
依赖 Skill：`agnes-ai-generation`  
凭据：`AGNES_API_KEY`、`AGNES_API_TOKEN` 或 `APIHUB_AGNES_API_KEY` 三者之一。

缺少凭据时只报告缺失，不要求用户在聊天中粘贴密钥；应写入 `~/.hermes/.env` 或环境变量。

## 调用

```bash
SKILL_DIR="$HOME/.hermes/skills/creative/feng-ip"
python3 "$SKILL_DIR/scripts/generate_feng_with_agnes.py" \
  --prompt-file /absolute/path/prompt.md \
  --reference-image "$SKILL_DIR/assets/reference/personal-ip/03_working.png" \
  --slug <article-slug> \
  --name 01-topic \
  --size 1536x864
```

需要精确中文时，优先在生成后运行独立的 `scripts/add_labels.py`；Agnes 包装脚本内置的 `--labels-json` 只作为兼容旧流程的备用能力。

## 验证

- 输出 JSON 的 `ok` 为 `true`。
- `reference_image_mode` 为 `true` 且数量正确。
- 本地文件存在并可打开。
- 必须进行人物身份和动作 QA。
- 交付时明确标注这是 Agnes 回退结果，而不是 Nano Banana 定稿。
