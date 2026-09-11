你正在执行 Hermes 本地技能 `wechat-sticker-publisher`：为「狗狗生活小百科」公众号生成每日贴图，并发布到草稿箱。

必须遵守：
1. 称呼用户为峰峰；时间统一用北京时间。
2. 目标账号固定为狗狗生活小百科；API 发布用的开发者 appid 必须是 `wx27855f8407f2c81c`。没有明确 appid/secret 时禁止发布。
3. 本机 cron 是 PDT；本任务被调度为 PDT 16:15，对应北京时间 07:15。
4. 本次运行必须尽量完成：选题 → 调研 → 生成竖版信息图 → HumanizerZH 润色文案 → WeChat newspic 草稿发布 → 记录选题 → Feishu 通知。
5. 如果 WeChat 凭据缺失或 API 失败，仍然保存图片，并在通知中明确说明"未发布，仅本地生成"，附错误。

执行步骤：

1. 加载技能 `wechat-sticker-publisher`、`humanizer-zh` 与 `knowledge-base`。
2. 初始化主题池（如尚未初始化）：
   `python3 /root/.hermes/skills/social-media/dog-wechat-daily-writer/scripts/topic_pool.py init`
3. 查看近 30 天选题：
   `python3 /root/.hermes/skills/social-media/dog-wechat-daily-writer/scripts/topic_pool.py recent --days 30`
4. 查看 90 天分类平衡：
   `python3 /root/.hermes/skills/social-media/dog-wechat-daily-writer/scripts/topic_pool.py category_balance --days 90`
   从 `suggested_rotation` 最前面选类别，再从该类别里挑一个近 30 天未写过、不重复的具体角度。
5. 调研：优先 IMA/knowledge-base（10 秒内不可用立即降级）；中文可靠源依次用 `byted-web-search`（豆包）→ `zhihu-search`（知乎）→ 直接 web research 抓取 VCA/AKC/PetMD。医疗结论必须谨慎表达。
5.5 【配图风格按日轮播｜峰峰指定 2026-09-10】本任务（贴图）与写文任务的配图风格不再按内容自选，改为固定 4 风格按星期几轮播：周一1 morandi-journal（暖调手账手绘）／周二2 craft-handmade（手作纸艺剪贴）／周三3 storybook-watercolor（水彩绘本）／周四4 hand-drawn-edu（马卡龙手绘教育）／周五回到1，周六2，周日3。唯一权威取法（禁止手算星期、禁止改选）：
   `python3 /root/.hermes/skills/social-media/dog-wechat-daily-writer/scripts/daily_style.py`
   记下 `本次风格 = N ｜ <style-id>` 与 `PROMPT-FRAGMENT:` 行（北京时间口径，脚本默认取北京当天；与同日写文必须同风格），步骤 6 的生图 prompt 逐字使用该片段。
6. 用 ApiYi `gpt-image-2-vip` 直出 3:4 竖版信息图（**必须显式传 `--size 1536x2048`，禁止依赖全局 config 或让它输出横版**），保存到：
   `/root/.hermes/workspace/workflows/stickers/outputs/YYYYMMDD-<topic-slug>.png`
   ```bash
   python3 /root/.hermes/skills/creative/apiyi-image-generation/scripts/apiyi_image.py \
     --model gpt-image-2-vip \
     --size 1536x2048 \
     --prompt "<完整提示词>" \
     --output /root/.hermes/workspace/workflows/stickers/outputs/YYYYMMDD-<topic-slug>.png
   ```
   （纯文本生图用 `--prompt`；若需参考图用 `--reference-image`。若 ApiYi 返回 HTTP 402 余额不足，降级到 Agnes：`generate_image.py --source agnes --aspect portrait`。）
   提示词必须包含：
   - 比例：**严格 3:4 竖版**，推荐 1080×1440 px，最低 720×960 px
   - **语言：所有文字一律使用简体中文（Simplified Chinese）**——在生图 prompt 中显式写入「所有文字使用简体中文 / all text in Simplified Chinese (简体中文)」，图片上的标题/卡片/正文都必须是简体，严禁繁体中文（2026-09-08 曾整张产出繁体）
   - 风格：**用步骤 5.5 取到的当日轮播风格**（禁止再按内容自选），其 `PROMPT-FRAGMENT:` 英文视觉片段逐字写入 prompt
   - 布局：按内容结构选 dense-modules/bento-grid/hub-spoke
   - 元素：纯中文编号 ①②③、标题不贴顶、关键文字离四边 ≥80px、预留顶部/底部约 10% 安全区防微信裁剪、萌宠健康狗狗、无水印、无乱码英文
   - 禁选：不用旧池 kawaii/ikea-manual/corporate-memphis，也不用 cyberpunk-neon/pixel-art/ui-wireframe/technical-schematic/subway-map/chalkboard/lego-brick/origami/claymation/pop-laboratory/retro-pop-grid/retro-popup-pop/aged-academia/knolling/bold-graphic
   生成后强制尺寸验证：
   ```bash
   python3 -c "from PIL import Image; i=Image.open('<path>'); w,h=i.size; print(w,h,'ratio=',w/h)"
   ```
   必须为 3:4（宽/高 = 0.75 ±0.02）且宽 < 高；否则用 `--size 1536x2048` 重新生成。报告「本次选用：布局=xxx + 风格=<no>-<style-id>（当日轮播固定）+ 尺寸=xxx」。
      ⚠️ **图片 prompt 落盘硬规则（2026-09-10 新增）**：调用生图后端之前，必须先把该图完整最终 prompt 写入磁盘，再出图（生图后端不记日志、图片无 EXIF，落盘是唯一可复现凭据）：
      - prompt 文件：`/root/.hermes/workspace/workflows/stickers/outputs/prompts/<日期>-<主题>-sticker.md`（先 `mkdir -p`）
      - 同时写 JSON：`/root/.hermes/workspace/workflows/stickers/outputs/<slug>-sticker-req.json`，字段 `prompt`/`size`/`aspect_ratio`/`model`/`source`/`style`/`layout`
      - 优先用 `apiyi_image.py --prompt-file <该文件>`，让 prompt 文件直接成为出图输入，避免二者不一致
      - 禁止“先出图、后补写”；最终回复报告 prompt 文件路径
7. 写 280-320 字**简体中文**文案，结构为：
   - 1 句开场白
   - 2-3 个短重点段落，用 `① ② ③` 或 `•` 标记
   - 1 句收尾行动提醒
   **全文/标题必须简体中文，严禁繁体**（模型可能漂移到繁体，见步骤 8.5 校验）。
   禁止单段密集型文案。
8. 对文案做 HumanizerZH 去 AI 味编辑：删掉空泛金句、模板化连接词、机械三段式、宣传腔；保留医学谨慎表述和行动提醒，让文案温暖、具体、自然。
8.5 【简体中文强制校验】发布前对标题和正文各跑一次繁→简转换，杜绝繁体进入草稿：
   ```bash
   python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/zh_simplify.py --detect-text '<标题>'
   python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/zh_simplify.py --detect-text '<正文>'
   ```
   两条必须都输出 `OK all-simplified`；任一输出 `TRAD_FOUND` 就先 `--convert-text` 转简体，用转换结果作为最终 `--title` / `--text`。若 opencc 不可用，zi_simplify.py 会回退到内置映射表。
9. 调用发布脚本：
   ```bash
   python3 /root/.hermes/skills/productivity/wechat-sticker-publisher/scripts/publish_sticker.py \
     --mode newspic \
     --account dog \
     --image /root/.hermes/workspace/workflows/stickers/outputs/YYYYMMDD-<topic-slug>.png \
     --title '狗狗<主题>' \
     --text '<润色后的文案>'
   ```
10. 验证返回 JSON 包含 `ok: true`、`draft_type: newspic`、`draft_media_id`、图片尺寸、格式化文案。
11. 发布成功后记录选题（写入贴图池 `dog-shared`）：
    `python3 /root/.hermes/skills/social-media/dog-wechat-daily-writer/scripts/topic_pool.py record '<topic>' --source 'IMA+WebSearch' --notes '<来源和要点>' --status 'published-draft' --category '<类别>' --target sticker`
    如果发布失败但本地生成成功，记录 status 为 `generated-not-published`。
12. 最终回复/通知峰峰，包含状态表：标题、选题、账号 appid、是否发布、draft media_id（如有）、本地图片路径、图片尺寸、**本次选用风格（<no>-<style-id>，来自 daily_style.py）**、布局、crop/check 结果、文案润色结果、错误信息（如有）。

不要凭空编造 API 成功结果；必须以工具真实输出为准。
