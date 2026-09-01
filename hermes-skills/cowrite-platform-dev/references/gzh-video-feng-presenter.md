# 视频讲解员（Feng presenter）透明底抠图 + 渲染（2026-08-31 实证）

给 `cowrite-video.py` 的 9:16 知识视频加右下角讲解员的完整做法。
**用户偏好：右下角、全身/3/4身小比例、透明底融入、不带可见 label、不遮字幕/进度/标题。**

> ⚠️ **2026-08-31 更新（重要，必须遵守）**：用户明确讲解员**默认全身**（不用半身/3-4身），且**每次生成视频前询问全身还是半身**（Hermes 对话问 + Cowrite 页面选择器）。canon `01_wave` 是**半身**，不能充当全身讲解员。全身素材：用 `image_generate` 文生图生成（纯白背景，`reference_image_urls` 传 canon `01_wave` 锁身份），再 flood-fill 去背。引擎 `cowrite-video.py` 已支持 `--feng-mode full|half`（`half` 把图裁切到 alpha bbox 上部 55% 成半身/3-4身；尺寸自适应：窄高全身按高度、方半身按宽度）。完整方法见 broll-hyperframes/references/cowrite-video-feng-presenter.md。

## 渲染（cowrite-video.py 的 --feng 分支）
- **画布必须 RGBA**：`Image.new("RGBA", (W,H), (252,252,253,255))`。
  若用 RGB 画布，`paste` 透明 PNG 会**忽略 alpha → 贴成一个白方块**（本项目踩过：无 feng 时不暴露，加了才炸）。
- paste 用 alpha 作 mask：`img.paste(f, (px,py), f.split()[3])`。
- 柔和投影：取 f 的 alpha 通道 `ImageFilter.GaussianBlur(16)` 当阴影 mask，
  `shim = Image.new("RGBA",(W,H),(0,0,0,0)); shim.paste((40,40,60,70),(px+6,py+10),sh)`，再 `img = Image.alpha_composite(img, shim)`。
- 尺寸/位置（小比例、右下、留边）：`fw=330`；`px=W-fw-46`；`py=H-f.height-34`。
  - 讲解员放右下、进度圆点在画面中央 → 不重叠；卡片文字在上方 → 不被遮挡。
- 依赖：`PIL.ImageFilter`（顶部 `from PIL import Image, ImageDraw, ImageFont, ImageFilter`）。

## 透明底讲解员图（feng-guide.png）来源
- **素材**：`/root/Documents/Obsidian Vault/30-Assets/PersonalBrand/峰峰IP-Canon/`
  有 18 张 pose PNG（418×418，**RGB、无 alpha、米黄背景**）。
  择 pose：`01_wave.png`（深蓝黑短发/自然英气眉/温和深色眼神/深海军蓝夹克+白hoodie/挥手）最适合作讲解员。
- 这些图是文生图的 canon **成品**（别用代码画人物），只需做**去背**（不改变人物本身），符合「文生图、不用代码绘制」。

## 去背：为什么不用这几个、用什么
1. **别用「近色去背」（逐像素距背景<阈值→透明）**：
   米黄背景 vs 白hoodie 距离很近（dist≈44）。阈值大了白hoodie被删，阈值小了背景残留。
2. **别只依赖 rembg**：首次运行要下载 `~/.u2net/u2net.onnx`（~170MB），本会话卡在下载未完成；
   若改用，需先确保模型已就位（`~/.u2net/u2net.onnx` 存在）+ 容忍首次推理数分钟。需要 `rembg` + `onnxruntime`（pip 装）。
3. **推荐确定法 = flood-fill 边缘去背**（无外网模型、无像素级颜色二值，不误伤被包裹的白hoodie）：
   ```python
   import numpy as np; from PIL import Image, ImageFilter; from collections import deque
   im = Image.open('.../01_wave.png').convert('RGB'); w,h = im.size
   arr = np.array(im).astype(int)
   corners = np.concatenate([arr[:12,:12].reshape(-1,3), arr[:12,-12:].reshape(-1,3),
                             arr[-12:,:12].reshape(-1,3), arr[-12:,-12:].reshape(-1,3)])
   bg = np.median(corners, axis=0)                    # 采样背景色
   dist = np.sqrt(((arr-bg)**2).sum(axis=2))
   THRESH = 75
   alpha = np.full((h,w), 255, dtype='uint8'); visited = np.zeros((h,w), bool); dq = deque()
   def seed(y,x):
       if not visited[y,x] and dist[y,x] < THRESH:
           visited[y,x]=True; alpha[y,x]=0; dq.append((y,x))
   for x in range(w): seed(0,x); seed(h-1,x)
   for y in range(h): seed(y,0); seed(y,w-1)
   while dq:
       y,x = dq.popleft()
       for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
           ny,nx = y+dy, x+dx
           if 0<=ny<h and 0<=nx<w and not visited[ny,nx] and dist[ny,nx] < THRESH:
               visited[ny,nx]=True; alpha[ny,nx]=0; dq.append((ny,nx))
   out = Image.fromarray(np.dstack([arr,alpha]).astype('uint8'),'RGBA')
   out = out.filter(ImageFilter.GaussianBlur(1.5))     # 边缘羽化
   bb = out.split()[3].getbbox()
   if bb: out = out.crop(bb)
   out.save('/root/.cowrite/worker-assets/feng-guide.png')
   ```
   原理：**BFS 只从图像边缘连通地扩展到「距背景色近」的像素**。白hoodie 被深蓝夹克/头肩「包住」、
   与边缘背景**不连通** → 天然保留，不会被 flood-fill 误删。最后 alpha blur 羽化边缘。
- 产物：`/root/.cowrite/worker-assets/feng-guide.png`（透明底，白hoodie保留、边缘干净）。

## Worker 侧注意
- 生成讲解员时 Worker 会跑 feng-ip 的 contact-sheet 一致性校验（`cs_*.png` + `contact-sheet.jpg` 出现在 worker-assets）——
  这是 broll skill 的 Feng presenter 流程，属正常，别当异常。
- 视频/讲解员图都落 `/root/.cowrite/worker-assets/`（避开生产 PrivateTmp，见 gzh-video-action.md 坑 4）。

## 坑
- **`pkill -f rembg` 会自杀**：命令行本身含 "rembg" 字符串，`pkill -f` 匹配到自身 → SIGKILL（exit -9）。
  杀后台进程用更精准的 pattern，或直接不 pkill（用 process kill）。
