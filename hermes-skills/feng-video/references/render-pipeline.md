# 渲染流水线

## 推荐技术栈

- 画面：HTML + SVG + GSAP。
- 人物：`feng-ip` Nano Banana双参考图生成，后处理为透明/干净白底素材。
- 准确文字：HTML/SVG/Canvas。
- 录屏：真实浏览器/终端/编辑器采集。
- 配音：Edge TTS。
- 时间轴：SRT/VTT → `BEAT_MAP.json`。
- 渲染：HyperFrames或Puppeteer/Chrome逐帧 + FFmpeg。
- QA：ffprobe、关键帧、联系表、视觉检查。

## 1. 配音

```bash
edge-tts --voice zh-CN-YunxiNeural --rate +10% \
  --file script-final.md \
  --write-media audio/voiceover.mp3 \
  --write-subtitles captions/voiceover.srt
ffprobe -v error -show_entries format=duration -of default=nw=1 audio/voiceover.mp3
```

Markdown标题不要读入配音；`script-final.md`应只包含可朗读正文，或先导出纯文本。

## 2. 时间轴

从SRT/VTT生成实际节拍：

- 句义变化决定场景边界；
- 章节卡插在真实停顿或段落转折；
- 动画关键动作对齐关键词开始时刻；
- 场景结束不得早于该场最后一句字幕结束。

## 3. HTML/GSAP

可调用 `html-video` 和 `broll-hyperframes` 的已验证模式。每场应有一个独立 `scene` 容器，按照 `BEAT_MAP.json` 控制显隐和对象状态。

建议对象属性：

```js
{
  id: 'scene-03-vector-metaphor',
  start: 78.2,
  end: 88.0,
  template: 'metaphor',
  actions: [
    {at: 78.3, type: 'reveal', target: '#input'},
    {at: 80.1, type: 'connect', target: '#path'},
    {at: 83.0, type: 'transform', target: '#vector'},
    {at: 86.0, type: 'hold', target: '#result'}
  ]
}
```

## 4. 录屏

- 使用原始分辨率采集，最终裁切至1920×1080安全区。
- 录制前关闭通知、隐藏密钥和个人信息。
- 每段保留操作前状态、动作和结果状态。
- 后期用CSS/FFmpeg叠加高亮，不在原素材里烧死所有标注。

## 5. 字幕

- 使用SRT/VTT原时间。
- 展示文本可按语义压缩，但不得改变事实；保留一份完整SRT。
- 底部字幕必须在所有场景共享同一基线与最大宽度。

## 6. 混音

推荐：

```bash
ffmpeg -y -i video-noaudio.mp4 -i audio/voiceover.mp3 -i audio/bgm.mp3 \
  -filter_complex "[1:a]loudnorm=I=-16:TP=-1:LRA=7[vo];[2:a]volume=0.10[bg];[vo][bg]amix=inputs=2:duration=first[a]" \
  -map 0:v -map '[a]' -c:v copy -c:a aac -b:a 192k -movflags +faststart renders/final.mp4
```

没有BGM时只混旁白；不要为了模仿参考视频而强行添加未经授权音乐。

## 7. 联系表

```bash
ffmpeg -y -i renders/draft.mp4 -vf "fps=1/15,scale=480:-1,tile=4x4" -frames:v 1 renders/contact-sheet.jpg
```

长视频应按章节分别生成联系表，确保每个主要场景都被检查。

## 8. 验证

```bash
python3 scripts/validate_package.py <project> --strict
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_type,width,height,r_frame_rate -of json renders/final.mp4
```

通过后填写 `REVIEW_REPORT.md`，记录真实结果、检查时间点和剩余偏差。
