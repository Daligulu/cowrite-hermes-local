# Voice Adapter扩展接口

## 目标

视频主流程只读取最终的旁白、字幕与QA文件，不感知Edge、ElevenLabs、MiniMax、xAI或本地模型。新增音色时优先新增Profile；只有新增供应商时才新增Adapter。

## 新增同一供应商音色

在 `templates/VOICE_PRESETS.json` 的 `profiles` 中增加一项，至少包含：

- `profile_id`
- `display_name`
- `provider`
- `adapter`
- `voice_id`
- `language`
- `speed`
- `pitch_hz`
- `authorization`
- `output`
- `fallback_profile_id`

项目的 `VOICE_PROFILE.json` 只需要把 `profile_id` 改为新ID。若只想调整语速或音调，写入 `overrides`，不要复制整份Profile。

## 新增供应商Adapter

在 `scripts/voice_adapters/<adapter>.py` 新建模块并实现：

```python
def render(text_path: Path, work_dir: Path, profile: dict) -> dict:
    return {
        "audio": Path("供应商生成的音频"),
        "subtitles": Path("供应商时间戳") or None,
    }
```

约束：

1. Adapter只能从安全环境读取凭据，不能把Key、Token或Cookie写进Profile、日志或输出。
2. 供应商没有字幕时返回 `None`，统一生成器将把状态标为需要本地对齐。
3. 音频格式可以不同，统一生成器负责转换为48kHz WAV和MP3。
4. Adapter错误必须显式失败；不能伪造音频或静默改用其他真人音色。
5. 回退行为由 `fallback_profile_id` 声明。

## 默认音色

全局默认Profile为 `feng-yunxi`：

- Edge TTS
- `zh-CN-YunxiNeural`
- 语速 `1.08`（约 `+8%`）
- 供应商预置音色，不是本人克隆声音

## 项目级覆盖

```json
{
  "schema_version": "2.0",
  "profile_id": "feng-yunxi",
  "registry_file": "VOICE_PRESETS.json",
  "overrides": {
    "speed": 1.05
  }
}
```

允许覆盖非敏感表现参数；禁止在 `overrides` 中写入任何凭据。
