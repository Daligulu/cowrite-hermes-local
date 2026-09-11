# cowrite-video.py：右下角 Feng 讲解员（Pillow + ffmpeg 管线）

本机「公众号视频」动作（gzh-video）用 `/root/.hermes/scripts/cowrite-video.py` 渲染 9:16 竖屏知识视频（Edge TTS 男声 + Pillow 场景卡 + ffmpeg 拼接）。区别于 HTML/GSAP 管线，本管线用 Pillow 直接把 Feng 讲解员贴到右下角，参数化可控。

## 素材准备：文生图全身 + flood-fill 抠图

1. 用 `image_generate`，`reference_image_urls` 传 canon `01_wave.png` 锁身份，生成「**全身立绘**、纯白背景、深海军蓝夹克+白hoodie、讲解手势、头到脚含脚」。
   - Identity 锚点（canon 01_wave）：深蓝黑短发 / 自然英气眉 / 温和深色眼神 / 深海军蓝夹克 + 白hoodie。
   - 纯白背景便于抠图；要求干净背景，不要复杂场景 / 文字 / 多余元素。
2. **flood-fill 去背**（从边缘连通移除背景，不误伤被夹克/头肩包裹的白hoodie、白鞋）：
   ```python
   import numpy as np
   from PIL import Image, ImageFilter
   from collections import deque
   im = Image.open(src).convert('RGB'); w, h = im.size
   arr = np.array(im).astype(int)
   corners = np.concatenate([arr[:15,:15].reshape(-1,3), arr[:15,-15:].reshape(-1,3),
                             arr[-15:,:15].reshape(-1,3), arr[-15:,-15:].reshape(-1,3)])
   bg = np.median(corners, axis=0)
   dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))
   alpha = np.full((h, w), 255, dtype='uint8'); visited = np.zeros((h, w), bool); dq = deque()
   # 种子：从四周边缘 dist<THRESH 的像素开始 BFS 删背景
   for x in range(w):
       for y in (0, h - 1):
           if dist[y, x] < 45 and not visited[y, x]:
               visited[y, x] = True; alpha[y, x] = 0; dq.append((y, x))
   for y in range(h):
       for x in (0, w - 1):
           if dist[y, x] < 45 and not visited[y, x]:
               visited[y, x] = True; alpha[y, x] = 0; dq.append((y, x))
   while dq:
       y, x = dq.popleft()
       for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
           ny, nx = y + dy, x + dx
           if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and dist[ny, nx] < 45:
               visited[ny, nx] = True; alpha[ny, nx] = 0; dq.append((ny, nx))
   # 只羽化 alpha 边缘，不模糊 RGB（保持人物清晰）
   alphaim = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.2))
   out = np.dstack([arr[:, :, :3], np.array(alphaim)])
   o = Image.fromarray(out.astype('uint8'), 'RGBA')
   bb = o.split()[3].getbbox()
   if bb: o = o.crop(bb)
   o.save(dest)
   ```
3. 存到 `/root/.cowrite/worker-assets/feng-guide.png`（全身，Worker 读取该路径）。

### 抠图坑（必读）
- **rembg 不可用**：`pip install rembg` 首次运行需下载 u2net 模型（`~/.u2net`），网络不可达时会**长期挂起**（>400s 无产出、`~/.u2net` 不存在）。直接回退 flood-fill，无需外网模型，更可控。
- **近色去背会误删**：全身图的白hoodie/白鞋与纯白背景色接近，逐像素「近背景色转透明」会把它们删掉。必须用 **flood-fill**（从图片边缘 BFS，只删与背景连通的区域；白hoodie/白鞋被深色描边/夹克/身体包围、不连通边缘 → 保留）。
- **canon 半身坑**：canon pose 图（`01_wave` 等）大多是**半身**（脚不可见）。用户明确要**全身**讲解员 → 必须文生图生成全身，不能用 canon 半身冒充。
- **画布必须 RGBA**：render_frame 用 `Image.new("RGBA", (W,H), ...)`，否则 paste 透明解析员会变成白方块背景。

## 用法

```bash
P=/root/.hermes/hermes-agent/venv/bin/python3
$P /root/.hermes/scripts/cowrite-video.py \
  --title "标题" --script-file s.txt \
  --feng /root/.cowrite/worker-assets/feng-guide.png \
  --feng-mode full|half \
  -o out.mp4
```

- `--feng`：讲解员透明 PNG 路径；**不传则无讲解员**（参数化，可随时移除）。
- `--feng-mode full`：全身（窄高图，按高度控制尺寸，约 27% 画面高）。
- `--feng-mode half`：把图裁切到 alpha bbox 上部 **55%**（头 + 上身 + 手势）成半身 / 3-4身；方图按宽度控制（约 26% 宽）。

## 尺寸自适应（render_frame）

```python
aspect = f.height / max(1, f.width)
if aspect > 1.15:            # 窄高（全身）：按高度控制，防超宽
    target_h = max(380, int(H * 0.27))
    fw = min(int(target_h / aspect), int(W * 0.28))
else:                        # 方/半身：按宽度控制
    fw = min(int(W * 0.26), 300)
px, py = W - fw - 46, H - f.height - 30   # 右下角，底边留 30px
```

- 加柔和投影（alpha 高斯模糊 16 + 半透明黑 offset，`Image.alpha_composite`），人物有立面感。
- 讲解员目标约 **8–12% 视觉注意力**；右下角，不遮字幕/标题/进度点（进度点居中、讲解员右侧不重叠）。

## 用户偏好（已确认，必须遵守）

- 右下角 Feng 讲解员**默认全身小比例**（不用半身 / 3-4身）。
- 讲解员比例（full / half）：**每次生成前询问用户**选全身还是半身，不默认替用户定；用户明确说「全身」才用 full，说「半身/3-4身」才用 half。
