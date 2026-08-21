# WeChat image style tuning: Shinkai-inspired but fresh-natural

Session learning: 峰峰 rejected two extremes in公众号配图 workflows:

1. **Too saturated / too dense** — earlier 新海诚系 prompts used “高饱和天空 / saturated skies / strong blue-orange contrast”, producing overly浓烈 colors.
2. **Too gray / too dark** — simply lowering saturation made samples feel灰暗, not suitable for warm公众号 visuals.

Current preferred target for writing covers/body illustrations and sticker infographics:

- 新海诚系空气感 and cinematic light are still desired.
- Use **清新自然、明亮通透、中等偏低饱和但不灰暗**.
- Palette: 浅天空蓝、嫩绿、奶油白、淡暖阳光; keep colors soft but lively.
- Avoid: 霓虹感、高纯度蓝橙强对比、颜色过浓、阴天灰调、低饱和灰蒙蒙、过曝.
- Lighting: 晴朗清晨/窗边自然光/柔和体积光/轻微镜头光晕; enough brightness and life.
- For sticker infographics, preserve high text contrast with white/semi-transparent cards and black/deep-gray Chinese text.

Reusable prompt phrase (for writing covers/body illustrations):

```text
清新自然、明亮通透、颜色柔和不过浓；中等偏低饱和但不要灰暗，浅天空蓝、嫩绿、奶油白、淡暖阳光，空气感清澈，轻微体积光，低对比但有阳光活力；避免霓虹感、高纯度蓝橙强对比、阴天灰调和过暗。
```

Reusable prompt phrase (for sticker/infographic):

```text
清新自然、明亮通透、颜色柔和不过浓；中等偏低饱和但不要灰暗，浅天空蓝、嫩绿、奶油白、淡暖阳光；背景：晴朗清晨公园、通透天空、柔和白云、绿树草地、轻微体积光、水面淡淡反射，整体清爽有活力。版式：白色半透明圆角卡片，黑色/深灰中文大字，高对比、清晰可读。
```

For sticker/infographic prompts add:

```text
白色/半透明圆角卡片，黑色或深灰中文大字，高对比、清晰可读；背景清爽但不要影响文字阅读。
```

Operational rule: when user asks to tune samples, generate real ApiYi `gpt-image-2-vip` samples and visually inspect before finalizing the style wording.