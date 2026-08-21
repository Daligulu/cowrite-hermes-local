# 10秒端到端样片：已验证制作模式

用于先验证新主题或新视觉系统，再扩展成长视频。目标不是做一个静态Demo，而是用最小成片检验人物、字幕、动效、音画同步和最终编码。

## 推荐结构

10秒默认三场：

1. 0–2.7秒：反常识Hook，用一个视觉冲突建立判断。
2. 2.7–6.4秒：峰峰执行核心转化动作；人物不是贴纸。
3. 6.4–10秒：结果证据链，依次完成2–3项验收并保留结尾停顿。

短样片可不放真实录屏，但不得宣称实测；`asset_mode` 应使用 `code`、`hybrid` 或 `illustrative`，而不是伪造 `real-screen`。

## 先音频、后画面

1. 先用Edge TTS生成音频和SRT。
2. 用ffprobe读取真实音频时长。
3. 如果Edge TTS只生成一条覆盖整句的SRT，按语义短语和有效字符比例拆成3–5条显示字幕；保留原始SRT用于审计。
4. 可在成片中加入0.3–0.6秒开场延迟，显示字幕和场景边界必须同步平移。
5. 结尾留1.5–3秒用于结果读完，不要用总时长计算出的低语速误判实际旁白过慢。

## 峰峰白底素材叠加HTML

纯白JPEG直接覆盖流程机或路径时，会形成不可见但真实存在的白色矩形遮挡。不要全局删除所有白色像素，否则会破坏白hoodie。

使用：

```bash
python3 scripts/remove_connected_background.py input.jpg output.png
```

该脚本只删除“与画布边缘连通”的近白背景，保留被深色轮廓包围的白hoodie。输出后必须检查：

- hoodie主体alpha仍为255；
- 头发、手指和夹克边缘无白色光圈；
- 人物覆盖机器时，机器线条不再被矩形背景截断；
- 人物动作与旋钮、卡片或路径有物理关系。

## HTML/GSAP确定性渲染

HTML必须提供：

```js
window.totalDuration = 10;
window.seekTo = t => timeline.seek(t, false);
```

不要依赖实时播放截图。先渲染4个Hero Frames，例如1.5、4.8、7.5、9.2秒，视觉通过后再渲染全部300帧：

```bash
python3 scripts/render_playwright_frames.py \
  --html project/html/index.html \
  --out project/renders/frames \
  --fps 30 --duration 10
```

Hero Frame必须覆盖：Hook完成态、峰峰核心动作、结果半完成态、结尾完成态。

## 音视频封装

Edge TTS音频在不同环境下可能被AAC编码为非目标采样率。最终明确重采样到48kHz：

```bash
ffmpeg -y -i video-noaudio.mp4 -i voiceover.mp3 \
  -filter_complex "[1:a]adelay=400:all=1,loudnorm=I=-16:TP=-1:LRA=7,aresample=48000,apad=pad_dur=10,atrim=duration=10[a]" \
  -map 0:v -map '[a]' -c:v copy -c:a aac -ar 48000 -b:a 192k \
  -t 10 -movflags +faststart final.mp4
```

`adelay`值必须来自字幕整体平移量，不要固定照抄400ms。

## 最终门禁

- ffprobe：精确时长、1920×1080、30fps、H.264、AAC 48kHz。
- 联系表：每秒1帧，确认三场顺序、峰峰身份和结尾完整。
- validator：`--strict --phase final`退出0。
- 可选反向ASR：确认最终MP4中的旁白没有丢失、截断或错文件。
- `source_span`必须是含`source/start_char/end_char/excerpt`的对象，不是纯字符串。
- `originality-plan.json`必须为每个scene提供对应项。
