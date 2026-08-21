# 中文男声预置音色选择与公平试听

## 触发

当用户不使用本人克隆音色，或明确需要“男声、清晰、悦耳、轻松明快”等现成配音时，使用本流程。预置音色属于供应商能力，不需要上传用户声音样本。

## 先结束克隆流程

1. 立即停止样本清理、云端上传、克隆创建和授权引导。
2. 已收到的声音样本不得转作其他用途，也不得加入Skill、Git、知识库或视频项目包。
3. 如果私有目录中已有原始样本，询问用户是立即删除还是继续仅本地保留；未获得选择前不得上传云端。
4. 将Voice Profile授权类型切换为 `provider_preset` 或 `synthetic_preset`，不再填写 `self_clone`。

## Edge普通话男声候选

以下描述来自当前Edge Voice List，属于Provider细节，使用前应重新运行 `edge-tts --list-voices` 核对可用性：

- `zh-CN-YunxiNeural`：Lively、Sunshine。明快、自然、轻松，适合知识分享和个人IP内容；与“清晰、悦耳、轻松明快”最接近。
- `zh-CN-YunyangNeural`：Professional、Reliable。清晰稳定、专业可信，适合技术教程、数据和正式说明。
- `zh-CN-YunjianNeural`：Passion。推动力和激情更强，适合Hook、挑战和观点输出；长篇可能显得用力。
- `zh-CN-YunxiaNeural`：Cute。更年轻活泼、亲和，但正式度较弱。

不要只凭文字描述替用户决定。默认先试听 `Yunxi` 与 `Yunyang`，需要更强对比时再加入 `Yunjian`、`Yunxia`。

## 公平A/B试听协议

所有候选必须满足：

1. 使用同一段约12–20秒的中文知识视频文案。
2. 使用相同语速；峰峰知识视频建议先从 `+8%` 试听，不把语速差误判成音色差。
3. 文案至少包含自然陈述、一个停顿和“人工智能/方案/验证”等常用知识词。
4. 统一采样率、声道与编码；推荐48kHz单声道MP3试听。
5. 统一综合响度。先测每份LUFS，再衰减至共同目标；不得直接把更响的样本当成更悦耳。
6. True Peak保留安全余量，任何样本不得削波。
7. 文件名称用序号和音色名，发送时逐项说明“音色气质/适用场景/可能缺点”。
8. 用户明确选定后再写入默认Voice Profile；其他候选只作为场景备选。

本次已验证的公平试听参数：同文案、`+8%`、48kHz单声道、约 `-19.5 LUFS`。这是试听目标，不是最终成片响度；生产母版仍按Skill主流程处理。

## 选择建议

- 轻松明快优先：`Yunxi`。
- 清晰专业优先：`Yunyang`。
- 强Hook和推动感：`Yunjian`。
- 年轻活泼：`Yunxia`。

若用户仍拿不准，使用同一段真实项目文稿再做第二轮两两对比，不继续扩大候选池。

## 当前默认选择

用户已确认第一个试听音色为 `feng-video` 默认声音：

- Profile：`feng-yunxi`
- Provider：`edge`
- Adapter：`edge`
- Voice ID：`zh-CN-YunxiNeural`
- 语速：`1.08`（约 `+8%`）
- 授权类型：`provider_preset`
- 声明：供应商预置音色，不是峰峰本人声音，也不是克隆声音

除非用户明确要求重新选声，后续项目直接使用该Profile，不再重复试听。其他候选保留在 `VOICE_PRESETS.json`，可按项目切换。

## 写入Voice Profile

用户选定后记录：

- `provider: edge`
- `authorization.type: provider_preset`
- `voice_id`：完整Voice名称
- `language: zh-CN`
- `speed`：试听确认值
- `fallback`：另一个已试听的男声或Edge默认兜底

不得把预置音色描述为“峰峰本人声音”或“克隆音色”。
