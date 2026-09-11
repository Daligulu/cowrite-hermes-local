# WeChat Sticker Draft E2E Testing Notes

来源：2026-09-04 狗狗贴图定时任务 (cron 7c7eb2ec2a6b) 端到端验收记录。

## 关键发现

### 1. Field 长度限制
- WeChat `draft/add` API 对 `title` 有长度上限（约 64 字节），超长会被拒绝。
- `description`/摘要字段也有上限，短摘要更安全。
- 正文文案长度上限约 2000 字节；超出会报错。

### 2. 3:4 尺寸验证必要
- nano-banana-2 有时返回非严格 3:4 尺寸（宽高比随机）。
- 必须用 PIL 强制验证：`python3 -c "from PIL import Image; i=Image.open('<path>'); w,h=i.size; print(w,h,'ratio=',w/h)"`。
- 若宽/高 ≠ 0.75 ±0.02 或宽 > 高，立即重新生成。
- 不要接受首次生成的非 3:4 图片作为最终图。

### 3. 首次测试草稿需手动清理
- E2E 测试过程中可能创建了一个错误比例（如正方形）的草稿。
- 发布修正后的草稿时，必须在通知中明确告诉用户忽略哪个旧的 draft_media_id。

### 4. newspic 结构要求
- 贴图必须用 `article_type="newspic"` + `publish_sticker.py --mode newspic`。
- 不要用普通 `news` 草稿结构（thumb_media_id + HTML content）。

## 验收标准
- 返回 JSON 包含 `ok: true`, `draft_type: newspic`, `draft_media_id`
- 图片尺寸严格 3:4（推荐 1080×1440，最低 720×960）
- 文案经 HumanizerZH 润色，无 AI 腔