# 配色纪律 · 峰峰个人 IP 正文配图

## 用户认可基准

视觉基准：`assets/calibration/approved-color-reference.jpg`。

这张图只用于校准配色层级、白底、留白和冷暖平衡；不得默认作为 Nano Banana 参考图传入，因为其中已有文字和构图，可能诱发复制标签或布局。生成时把本文件的规则写入 Prompt，生成后再与基准图做视觉和像素统计比较。

基准图（16:9、人物约 10–20% 画宽）的实测值：

- 纯/近白背景：77.36%
- 有饱和颜色：8.39%
- 蓝色总量：7.46%
- 深蓝总量：6.72%
- 暖肤色/橙色：1.54%

## 色彩层级

1. **白色是绝对主色**：画面保持 70–85% 近白区域。
2. **深海军蓝只属于人物身份**：主要用于峰峰头发与夹克。场景物件不得重复使用深海军蓝大面积填充。
3. **人物必须保留暖肤色**：脸、耳朵、脖子和可见双手使用自然暖桃肤色，不能变成未上色白脸、灰脸或蓝色阴影脸。
4. **场景软蓝只能是浅色小点缀**：建议粉蓝/雾蓝 `#8FB9D8` 附近。故事路径默认使用黑色细线；只允许在路径上放 1–3 个浅蓝小节点或一个小机械点。禁止实心蓝色路径、宽蓝色丝带或横贯画面的蓝色背景带；场景软蓝面积建议不超过整图 2–3%。
5. **机器和卡片以白底黑线为主**：机器主体、纸张和行动卡保持白色不填充；禁止卡片蓝色角阴影、机器蓝色阴影面、蓝色排线和蓝色大色块。
6. **暖色负责平衡**：保留自然肤色，并允许 1–2 处很小的软橙点睛 `#F2A65A`；不得完全没有暖色。
7. **颜色不能连成一条蓝带**：人物夹克、路径、卡片和机器之间必须由白区或黑线隔开，避免中央深蓝向左右连续扩散。

## 默认 Prompt 色彩块

```text
Color hierarchy is strict. White is the dominant field, covering roughly 70-85% of the image. Deep navy is reserved only for Feng's short hair and jacket; do not reuse deep navy on scene objects. Feng's face, ears, neck, and visible hands must have a natural warm peach skin fill, never white/uncolored, gray, or blue-tinted. The machine body, loose notes, and action cards stay white and unfilled with black ink outlines. Draw the story path as a thin black ink line; if color is needed, add only 1-3 tiny pale powder-blue (#8FB9D8) nodes or one tiny mechanical accent. Never draw a solid blue path, a wide blue ribbon, or a horizontal blue background band. Total scene-blue area should stay below about 2-3% of the frame. Add one or two tiny soft-orange (#F2A65A) sparks or marks for warm balance. No blue cast, no blue lighting, no navy scene shadows, no blue crosshatching, no blue card-corner shadows, no blue-filled machine panels, and no continuous blue band across the composition.
```

## 生成后像素门禁

对默认 16:9 正文图运行：

```bash
python3 scripts/check_color_balance.py candidate.png \
  --reference assets/calibration/approved-color-reference.jpg \
  --strict
```

默认建议范围：

- 近白：70–88%
- 蓝色总量：不高于 8.0%
- 深蓝：不高于 7.8%
- 暖肤色/橙色：不低于 0.5%
- 蓝/暖比例：不高于 10

像素门禁只是预警，不替代视觉检查。人物尺寸明显大于 20%、封面或生活方式场景，应结合构图调整阈值；但“脸和手无暖肤色”“场景物件大面积深蓝”始终是不合格。

## 失败处理

- 蓝色过多：把机器、卡片、纸张恢复白色；路径改成更浅、更细；移除蓝色阴影和排线。
- 暖色过少：明确要求脸、耳朵、脖子、双手填自然暖桃肤色，并保留 1 个软橙点睛。
- 蓝色连续成带：在人物、路径和输出卡之间增加白色断点，不让深蓝重复出现在场景物件。
- 模型仍整体蓝化：重生成，不要用后期整体降饱和来掩盖人物肤色缺失。
