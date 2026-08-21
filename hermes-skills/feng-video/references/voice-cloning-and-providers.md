# 定制音色、克隆与Provider架构

## 目标

`feng-video` 的画面和时间线不得绑定单一TTS供应商。项目只声明 Voice Profile，音频层负责把不同后端统一成旁白、字幕、时间戳与QA报告；HTML、分镜和 `BEAT_MAP.json` 只依赖最终音频产物。

## 支持路线

### 免费兜底

- Edge TTS：无需凭据，适合快速草稿与A/B基线。
- 不是克隆音色，不能当作本人声音。

### 云端本人克隆

- ElevenLabs：短样本快速克隆与专业克隆；Hermes可用克隆后的 `voice_id`。
- xAI Custom Voices：在控制台创建本人授权声音后使用 `voice_id`。
- MiniMax：若当前账号和区域支持创建克隆音色，可把返回的 `voice_id` 接入；先以真实账号接口验证。
- 云端方案必须在上传前取得明确同意，并记录供应商、用途和删除策略。

### 本地私有化

- 首选评估 Fun-CosyVoice 3：中文、多语言、方言、跨语言零样本克隆和情绪/语速指令能力较完整。
- 通过 Hermes `tts.providers.<name>.type: command` 或项目级Adapter接入。
- 适合重视隐私或批量生产；代价是GPU、模型部署和维护。

### 其他人物音色

只允许：

1. 供应商明确授权的预置音色；
2. AI设计的原创虚构声音；
3. 已取得书面授权的演员、品牌角色或真人声音。

不支持将未经许可的真实人物、公众人物或明星声音用于冒充式克隆。若只需要相似气质，生成原创声音，不使用具体姓名或身份暗示。

## 统一Voice Profile与注册表

- `VOICE_PRESETS.json` 是可用音色注册表，`default_profile_id` 当前为 `feng-yunxi`。
- `VOICE_PROFILE.json` 只选择 `profile_id` 并提供非敏感 `overrides`。
- 同一供应商新增音色时只新增注册项；新增供应商时实现 `scripts/voice_adapters/<adapter>.py`。
- 统一生成器 `scripts/generate_voice.py` 解析Profile并输出音频、字幕和QA。

解析后的Profile主要字段：

- `profile_id`
- `provider` / `adapter`
- `voice_id`
- `language`
- `speed` / `pitch_hz` / `style`
- `authorization`
- `output`
- `fallback_profile_id`

任何API Key、Token、Cookie或连接信息都不得进入Voice Profile、注册表、项目包、HTML、日志或公开视频，统一从安全环境读取并显示为 `[REDACTED]`。

## 统一输出契约

无论后端如何，音频层必须生成：

- `audio/voiceover.wav`：48kHz生产母版；
- `audio/voiceover.mp3`：预览或兼容副本；
- `captions/voiceover.srt` 或 `.vtt`；
- `audio/voice-qa.json`；
- `audio/pronunciation-log.json`；
- 更新后的 `BEAT_MAP.json`。

供应商没有可靠时间戳时，使用本地ASR/强制对齐生成句级或词级时间戳，不能按估算时长硬切画面。

## 本人音色引导流程

1. 在私有目录准备录音稿、录音指南、授权模板和Manifest。
2. 用户使用原生录音机录制3–5分钟自然中文；以文件附件上传，不使用聊天语音气泡。
3. 本地检查有效时长、底噪、混响、削波、爆音、音量稳定和技术词覆盖。
4. 清理错误重读和多余静音，保留未处理原始文件；生产样本转换为WAV。
5. 在任何云端上传前再次确认本人身份、供应商、用途和保留/删除策略。
6. 通过用户亲自登录的安全浏览器创建克隆；不要求用户在聊天中粘贴密码或API Key。
7. 只把返回的 `voice_id` 写入Voice Profile；原始录音和speaker embedding留在私有目录。
8. 用同一段30秒文稿生成Edge基线与克隆音色，做盲听A/B。
9. 检查身份相似度、自然度、发音、数字、英文缩写、停顿、情绪、响度和音画同步。
10. 用户确认后才设为默认主音色；失败时保留Edge回退。

## 录音建议

- 安静小房间，关闭风扇、空调、音乐和提示音。
- 麦克风位置固定，嘴距约15–20厘米。
- 开头和结尾各留3秒静音。
- 使用自然知识分享语气，不刻意模仿播音员。
- 读错时停2秒并从整句重读；由后处理剪辑。
- 首选WAV 48kHz；也接受未二次压缩的M4A或FLAC。
- 不使用微信/飞书语音气泡、转发MP3、背景音乐或美声/变声滤镜。
- 内容应覆盖陈述、疑问、强调、数字、单位、英文缩写和技术词。

## 音频QA门禁

- 试听身份与自然度；
- 检查姓名、数字、英文缩写和专有名词；
- 检查异常停顿、吞字、重复、金属音和情绪漂移；
- 检查静音、底噪、削波和响度；
- 最终约 `-16 LUFS`，峰值不高于 `-1 dBTP`；
- AAC封装显式重采样至48kHz；
- 字幕与实际音频时间戳同步；
- 对公开内容考虑标注“本人授权的合成音频”。

## 隐私与打包

原始样本、清理样本、speaker embedding、授权原件和供应商凭据不得进入：

- `feng-video` Skill资产；
- Git仓库；
- Obsidian同步目录；
- 公开视频项目包；
- HTML和浏览器端资源。

项目只保存非敏感的 `profile_id`、供应商名、授权状态和 `voice_id`。公开导出前由验证器扫描音频样本与凭据泄露。