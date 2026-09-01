# 公众号视频动作 + 9:16 知识视频引擎（P2-4，2026-08-31 实证）

把公众号文章做成 9:16 竖屏知识 B-roll 视频的 Cowrite 动作，真实验收通过（`gzh-video` 动作，生产 27→28 动作）。

## 动作接入（走 external-skill-action-integration 四步）
- id `gzh-video`，label「公众号视频」，skill `broll-hyperframes`，放 CommandBar「演示视频」组
- prompt 要点：①压缩页面正文为 ≤60s 中文脚本（保留 hook/冲突/例子/结论/CTA，删重复铺垫，短句，不编造）写到 `/root/.cowrite/worker-assets/script.txt`；②调 `cowrite-video.py` 生成；③`mcp_cowrite_cowrite_upload_asset` 上传 mp4；④写回页面附 ffprobe 时长/分辨率
- 红线（写进 prompt）：先压缩再生成；中文必须正确（脚本字即画面字）；ffprobe 验证后才写回；失败如实 fail_task 不伪造

## 引擎 cowrite-video.py（/root/.hermes/scripts/cowrite-video.py）
确定性管线，无需浏览器（broll「方案B 压缩男声」的落地实现）：
`edge-tts 配音+SRT → 解析 SRT cue → Pillow 逐 cue 渲染 9:16 场景卡 → ffmpeg 逐段 loop+concat → 叠配音 → mp4`
- 输出 1080×1920；版式：顶部深蓝圆角标题条、左上「第 N 幕 · N/M」、中央白卡片逐句文本（即字幕）、底部进度圆点
- 依赖：`edge-tts`(venv)、`PIL`(venv 12.x)、`ffmpeg`、google-chrome（未用/可选）
- **中文字体**（Pillow 渲染必用，否则乱码）：
  - 标题：`/usr/share/fonts/google-noto-cjk/NotoSansCJK-Black.ttc`
  - 正文：`/usr/local/share/fonts/MiSans/MiSans-Medium.otf`（Semibold: `MiSans-Semibold.ttf`）
- 可选 `--feng <feng.png>` 放右下角 Feng 讲解员（broll 方案B 可选，需透明底成品图）

## 坑（实战踩过，复现必看）
1. **SRT 解析不能只看 lines[0]**：SRT 首行是序号（`1`），时间戳在第 2 行。必须 `next(l for l in lines if "-->" in l)` 定位时间戳行，否则 cue 全空 → `NO_CUES`。
2. **ffmpeg concat 的 `-c copy` 必须放 `-i` 之后**：写成 `-f concat -safe 0 -c copy -i list.txt out.mp4` 会报 `Unknown decoder 'copy'`（`-c` 被当输入解码器）。正确：`-f concat -safe 0 -i list.txt -c copy out.mp4`。
3. **别双重烧字幕**：Pillow 已在卡片里渲染 cue 文本（作为逐句字幕），ffmpeg 若再 `-vf subtitles=` 会叠加重复文本，且 `force_style` 在部分场景渲染成巨大溢出字。删掉 ffmpeg 字幕 filter，只 `-c:v copy -c:a aac -shortest` 叠配音。
4. **输出落 `/root/.cowrite/worker-assets/` 而非 /tmp**：生产 Cowrite（systemd）开 PrivateTmp，/tmp 与宿主不同 mount namespace，`cowrite_upload_asset` 会报「Asset file not found」。Worker 写盘与上传都走共享路径 `worker-assets/`。
5. **场景编号 1 基**：render_frame 的 idx 是 0 基，显示要 `第 {idx+1} 幕 · {idx+1}/{total}`。
6. **耗时长**：压缩+edge-tts+Pillow 渲染+ffmpeg 约 3–6 分钟，端到端验收用后台 terminal + notify_on_complete，别同步等。

## 端到端验收（gzh-video）
创建页面（给一篇有 hook/例子/冲突/结论/CTA 的短文，方便压成 ≤60s 脚本）→ POST /api/tasks `action=gzh-video` → 轮询到 succeeded → 断言页面含 `/assets/*.mp4` + mp4 + 说明，ffprobe 确认 1080×1920、时长>0、含音轨。
