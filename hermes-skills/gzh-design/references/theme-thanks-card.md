# 通用组件库 —— 文末感谢卡（Thanks Card）

> **定位**：通用**文末组件**，所有主题共用同一形制（作者签名 + 圆角感谢卡 + 点赞高亮三连 + THANKS FOR READING），**配色按主题变量化**。与「组件 16 尾部签名区」不同——它是更丰富的**卡片式**收尾，把签名、三连引导、图标、K 端英文整合成一张卡，视觉更聚焦、更有记忆点。适合所有文章类型的文末收尾。
>
> **使用**：排版到文末时，把下表对应主题的完整 HTML 复制到「END 分割线 / 尾部签名区」位置（替换或紧随内置签名区，二选一，**不要两处同时堆三连**）。作者签名占位 `{{作者名}}` `{{简介}}` 由用户替换。

## 平台红线（所有主题统一）

- 样式全部内联；文字节点用 `<span leaf="">` 包裹（本组件全部已按要求写好）
- 无 `<style>`/`<script>`/`<div>`/`class`/`id`；`display:flex`（有限）用于图标横排
- 三个图标用 Unicode 符号（♥ 点赞 / ◎ 在看 / ↗ 转发），**不依赖 emoji 字体**，跨端稳定显示
- 图标横排用 `display:flex;justify-content:center`，每个图标块定宽 `width:60px` 防挤压

## 设计变量速查表（按主题配色）

| 主题 | 主色(点赞高亮) | 卡片底 | 卡片描边 | 正文色 | 标题色 | 常规图标色 | 常规图标描边 | 次要文字 | 辅助英文 |
|------|--------------|--------|---------|--------|--------|-----------|-------------|---------|---------|
| 石墨极简 | `#F97316` 暖橙 | `#FAFAFA` | `#E4E4E7` | `#3F3F46` | `#27272A` | `#52525B` | `#E4E4E7` | `#71717A` | `#A1A1AA` |
| 摸鱼绿 | `#059669` emerald | `#F0FDF4` | `#BBF7D0` | `#374151` | `#111827` | `#6B7280` | `#E5E7EB` | `#4B5563` | `#9CA3AF` |
| 红白色系 | `#DC2626` 正红 | `#FEF2F2` | `#FECACA` | `#374151` | `#1C1917` | `#9CA3AF` | `#E5E7EB` | `#9CA3AF` | `#9CA3AF` |
| 留白禅意 | `#4A5D52` 墨绿 | `#FFFFFF` | `#E8E8E8` | `#525252` | `#2B2B2B` | `#A3A3A3` | `#E8E8E8` | `#A3A3A3` | `#A3A3A3` |
| 摸鱼票据 | `#059669` emerald | `#fffef8` | `#1a1a1a` | `#555` | `#1a1a1a` | `#888` | `#D1D5DB` | `#888` | `#999` |
| 橄榄手记 | `#ed7b2f` 橙 | `#eeefe9` | `#bfc1b7` | `#4d4f46` | `#23251d` | `#65675e` | `#bfc1b7` | `#65675e` | `#9ea096` |
| 衬线绿色方格纸 | `#28a745` 强调绿 | `#F0FDF4` | `#BBF7D0` | `#344054` | `#3e3e3e` | `#6b7280` | `#E5E7EB` | `#6b7280` | `#9CA3AF` |
| 衬线深蓝方格纸 | `#1E5AA8` 深蓝 | `#EFF6FF` | `#BFDBFE` | `#344054` | `#3e3e3e` | `#6b7280` | `#E5E7EB` | `#6b7280` | `#9CA3AF` |

> 通用规则：**点赞用主色高亮**（主色字 + 主色描边 + 主题浅底），**在看/转发常规**（常规图标色 + 浅描边）。「THANKS FOR READING」用辅助英文色、大写 + 字距 4px。

## 完整 HTML（组件 20 · 文末感谢卡）

### 〇、通用骨架（作者签名 + 圆角卡）

```html
<!-- ① 作者签名（正文结尾，浅灰，占位待替换） -->
<section style="padding:0 10px;">
  <p style="margin:0 0 8px;font-size:16px;line-height:1.75;color:{次要文字};text-align:justify;">
    <span leaf="">我是 {{作者名}}，</span>
  </p>
  <p style="margin:0 0 44px;font-size:16px;line-height:1.75;color:{次要文字};text-align:justify;">
    <span leaf="">更多 AI 应用 / 我们下期再见 👋</span>
  </p>
</section>

<!-- ② 圆角感谢卡 -->
<section style="padding:0 10px;">
  <section style="background:{卡片底};border:1px solid {卡片描边};border-radius:16px;padding:44px 22px 40px;text-align:center;">
    <p style="margin:0 0 30px;font-size:16px;line-height:1.75;color:{正文色};text-align:center;">
      <span leaf="">如果你觉得今天这篇有收获，欢迎</span>
      <strong style="color:{标题色};"><span leaf="">点赞、在看、转发</span></strong>
      <span leaf="">三连，我们下篇见</span>
    </p>
    <section style="display:flex;justify-content:center;align-items:flex-start;">
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:{卡片底};border:1px solid {主色};border-radius:14px;font-size:24px;font-weight:600;color:{主色};"><span leaf="">♥</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:{主色};"><span leaf="">点赞</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid {常规图标描边};border-radius:14px;font-size:24px;font-weight:600;color:{常规图标色};"><span leaf="">◎</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:{常规图标色};"><span leaf="">在看</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid {常规图标描边};border-radius:14px;font-size:24px;font-weight:600;color:{常规图标色};"><span leaf="">↗</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:{常规图标色};"><span leaf="">转发</span></p>
      </section>
    </section>
    <p style="margin:32px 0 0;font-size:11px;color:{辅助英文};letter-spacing:4px;">
      <span leaf="">THANKS FOR READING</span>
    </p>
  </section>
</section>
```

### 一、石墨极简（`{{主色}}=#F97316`）

```html
<section style="padding:0 10px;">
  <p style="margin:0 0 8px;font-size:16px;line-height:1.75;color:#71717A;text-align:justify;">
    <span leaf="">我是 {{作者名}}，</span>
  </p>
  <p style="margin:0 0 44px;font-size:16px;line-height:1.75;color:#71717A;text-align:justify;">
    <span leaf="">更多 AI 应用 / 我们下期再见 👋</span>
  </p>
</section>
<section style="padding:0 10px;">
  <section style="background:#FAFAFA;border:1px solid #E4E4E7;border-radius:16px;padding:44px 22px 40px;text-align:center;">
    <p style="margin:0 0 30px;font-size:16px;line-height:1.75;color:#3F3F46;text-align:center;">
      <span leaf="">如果你觉得今天这篇有收获，欢迎</span>
      <strong style="color:#27272A;"><span leaf="">点赞、在看、转发</span></strong>
      <span leaf="">三连，我们下篇见</span>
    </p>
    <section style="display:flex;justify-content:center;align-items:flex-start;">
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFF7ED;border:1px solid #F97316;border-radius:14px;font-size:24px;font-weight:600;color:#F97316;"><span leaf="">♥</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#F97316;"><span leaf="">点赞</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E4E4E7;border-radius:14px;font-size:24px;font-weight:600;color:#52525B;"><span leaf="">◎</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#71717A;"><span leaf="">在看</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E4E4E7;border-radius:14px;font-size:24px;font-weight:600;color:#52525B;"><span leaf="">↗</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#71717A;"><span leaf="">转发</span></p>
      </section>
    </section>
    <p style="margin:32px 0 0;font-size:11px;color:#A1A1AA;letter-spacing:4px;">
      <span leaf="">THANKS FOR READING</span>
    </p>
  </section>
</section>
```

### 二、摸鱼绿（`{{主色}}=#059669`）

```html
<section style="padding:0 10px;">
  <p style="margin:0 0 8px;font-size:16px;line-height:1.75;color:#4B5563;text-align:justify;">
    <span leaf="">我是 {{作者名}}，</span>
  </p>
  <p style="margin:0 0 44px;font-size:16px;line-height:1.75;color:#4B5563;text-align:justify;">
    <span leaf="">更多 AI 应用 / 我们下期再见 👋</span>
  </p>
</section>
<section style="padding:0 10px;">
  <section style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:16px;padding:44px 22px 40px;text-align:center;">
    <p style="margin:0 0 30px;font-size:16px;line-height:1.75;color:#374151;text-align:center;">
      <span leaf="">如果你觉得今天这篇有收获，欢迎</span>
      <strong style="color:#111827;"><span leaf="">点赞、在看、转发</span></strong>
      <span leaf="">三连，我们下篇见</span>
    </p>
    <section style="display:flex;justify-content:center;align-items:flex-start;">
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#ECFDF5;border:1px solid #059669;border-radius:14px;font-size:24px;font-weight:600;color:#059669;"><span leaf="">♥</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#059669;"><span leaf="">点赞</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;font-size:24px;font-weight:600;color:#6B7280;"><span leaf="">◎</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#4B5563;"><span leaf="">在看</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;font-size:24px;font-weight:600;color:#6B7280;"><span leaf="">↗</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#4B5563;"><span leaf="">转发</span></p>
      </section>
    </section>
    <p style="margin:32px 0 0;font-size:11px;color:#9CA3AF;letter-spacing:4px;">
      <span leaf="">THANKS FOR READING</span>
    </p>
  </section>
</section>
```

### 三、红白色系（`{{主色}}=#DC2626`）

```html
<section style="padding:0 10px;">
  <p style="margin:0 0 8px;font-size:16px;line-height:1.75;color:#9CA3AF;text-align:justify;">
    <span leaf="">我是 {{作者名}}，</span>
  </p>
  <p style="margin:0 0 44px;font-size:16px;line-height:1.75;color:#9CA3AF;text-align:justify;">
    <span leaf="">更多 AI 应用 / 我们下期再见 👋</span>
  </p>
</section>
<section style="padding:0 10px;">
  <section style="background:#FEF2F2;border:1px solid #FECACA;border-radius:16px;padding:44px 22px 40px;text-align:center;">
    <p style="margin:0 0 30px;font-size:16px;line-height:1.75;color:#374151;text-align:center;">
      <span leaf="">如果你觉得今天这篇有收获，欢迎</span>
      <strong style="color:#1C1917;"><span leaf="">点赞、在看、转发</span></strong>
      <span leaf="">三连，我们下篇见</span>
    </p>
    <section style="display:flex;justify-content:center;align-items:flex-start;">
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FEE2E2;border:1px solid #DC2626;border-radius:14px;font-size:24px;font-weight:600;color:#DC2626;"><span leaf="">♥</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#DC2626;"><span leaf="">点赞</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;font-size:24px;font-weight:600;color:#9CA3AF;"><span leaf="">◎</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#9CA3AF;"><span leaf="">在看</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;font-size:24px;font-weight:600;color:#9CA3AF;"><span leaf="">↗</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#9CA3AF;"><span leaf="">转发</span></p>
      </section>
    </section>
    <p style="margin:32px 0 0;font-size:11px;color:#9CA3AF;letter-spacing:4px;">
      <span leaf="">THANKS FOR READING</span>
    </p>
  </section>
</section>
```

### 四、留白禅意（`{{主色}}=#4A5D52`）

```html
<section style="padding:0 16px;">
  <p style="margin:0 0 8px;font-size:16px;line-height:1.75;color:#A3A3A3;text-align:justify;">
    <span leaf="">我是 {{作者名}}，</span>
  </p>
  <p style="margin:0 0 44px;font-size:16px;line-height:1.75;color:#A3A3A3;text-align:justify;">
    <span leaf="">更多 AI 应用 / 我们下期再见 👋</span>
  </p>
</section>
<section style="padding:0 16px;">
  <section style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:16px;padding:44px 22px 40px;text-align:center;">
    <p style="margin:0 0 30px;font-size:16px;line-height:1.75;color:#525252;text-align:center;">
      <span leaf="">如果你觉得今天这篇有收获，欢迎</span>
      <strong style="color:#2B2B2B;"><span leaf="">点赞、在看、转发</span></strong>
      <span leaf="">三连，我们下篇见</span>
    </p>
    <section style="display:flex;justify-content:center;align-items:flex-start;">
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#EEF3F0;border:1px solid #4A5D52;border-radius:14px;font-size:24px;font-weight:600;color:#4A5D52;"><span leaf="">♥</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#4A5D52;"><span leaf="">点赞</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E8E8E8;border-radius:14px;font-size:24px;font-weight:600;color:#A3A3A3;"><span leaf="">◎</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#A3A3A3;"><span leaf="">在看</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E8E8E8;border-radius:14px;font-size:24px;font-weight:600;color:#A3A3A3;"><span leaf="">↗</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#A3A3A3;"><span leaf="">转发</span></p>
      </section>
    </section>
    <p style="margin:32px 0 0;font-size:11px;color:#A3A3A3;letter-spacing:4px;">
      <span leaf="">THANKS FOR READING</span>
    </p>
  </section>
</section>
```

### 五、摸鱼票据（`{{主色}}=#059669`）

```html
<section style="padding:0 20px;">
  <p style="margin:0 0 8px;font-size:16px;line-height:1.75;color:#888;text-align:justify;">
    <span leaf="">我是 {{作者名}}，</span>
  </p>
  <p style="margin:0 0 44px;font-size:16px;line-height:1.75;color:#888;text-align:justify;">
    <span leaf="">更多 AI 应用 / 我们下期再见 👋</span>
  </p>
</section>
<section style="padding:0 20px;">
  <section style="background:#fffef8;border:1px solid #1a1a1a;border-radius:16px;padding:44px 22px 40px;text-align:center;">
    <p style="margin:0 0 30px;font-size:16px;line-height:1.75;color:#555;text-align:center;">
      <span leaf="">如果你觉得今天这篇有收获，欢迎</span>
      <strong style="color:#1a1a1a;"><span leaf="">点赞、在看、转发</span></strong>
      <span leaf="">三连，我们下篇见</span>
    </p>
    <section style="display:flex;justify-content:center;align-items:flex-start;">
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#F0FDF4;border:1px solid #059669;border-radius:14px;font-size:24px;font-weight:600;color:#059669;"><span leaf="">♥</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#059669;"><span leaf="">点赞</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #D1D5DB;border-radius:14px;font-size:24px;font-weight:600;color:#888;"><span leaf="">◎</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#888;"><span leaf="">在看</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #D1D5DB;border-radius:14px;font-size:24px;font-weight:600;color:#888;"><span leaf="">↗</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#888;"><span leaf="">转发</span></p>
      </section>
    </section>
    <p style="margin:32px 0 0;font-size:11px;color:#999;letter-spacing:4px;">
      <span leaf="">THANKS FOR READING</span>
    </p>
  </section>
</section>
```

### 六、橄榄手记（`{{主色}}=#ed7b2f`）

```html
<section style="padding:0 10px;">
  <p style="margin:0 0 8px;font-size:16px;line-height:1.75;color:#65675e;text-align:justify;">
    <span leaf="">我是 {{作者名}}，</span>
  </p>
  <p style="margin:0 0 44px;font-size:16px;line-height:1.75;color:#65675e;text-align:justify;">
    <span leaf="">更多 AI 应用 / 我们下期再见 👋</span>
  </p>
</section>
<section style="padding:0 10px;">
  <section style="background:#eeefe9;border:1px solid #bfc1b7;border-radius:6px;padding:44px 22px 40px;text-align:center;">
    <p style="margin:0 0 30px;font-size:16px;line-height:1.75;color:#4d4f46;text-align:center;">
      <span leaf="">如果你觉得今天这篇有收获，欢迎</span>
      <strong style="color:#23251d;"><span leaf="">点赞、在看、转发</span></strong>
      <span leaf="">三连，我们下篇见</span>
    </p>
    <section style="display:flex;justify-content:center;align-items:flex-start;">
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#e5e7e0;border:1px solid #ed7b2f;border-radius:6px;font-size:24px;font-weight:600;color:#ed7b2f;"><span leaf="">♥</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#ed7b2f;"><span leaf="">点赞</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#fdfdf8;border:1px solid #bfc1b7;border-radius:6px;font-size:24px;font-weight:600;color:#65675e;"><span leaf="">◎</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#65675e;"><span leaf="">在看</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#fdfdf8;border:1px solid #bfc1b7;border-radius:6px;font-size:24px;font-weight:600;color:#65675e;"><span leaf="">↗</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#65675e;"><span leaf="">转发</span></p>
      </section>
    </section>
    <p style="margin:32px 0 0;font-size:11px;color:#9ea096;letter-spacing:4px;">
      <span leaf="">THANKS FOR READING</span>
    </p>
  </section>
</section>
```

### 七、衬线绿色方格纸（`{{主色}}=#28a745`）

```html
<section style="padding:0 10px;">
  <p style="margin:0 0 8px;font-size:15px;line-height:1.82;color:#6b7280;text-align:justify;">
    <span leaf="">我是 {{作者名}}，</span>
  </p>
  <p style="margin:0 0 44px;font-size:15px;line-height:1.82;color:#6b7280;text-align:justify;">
    <span leaf="">更多 AI 应用 / 我们下期再见 👋</span>
  </p>
</section>
<section style="padding:0 11px;">
  <section style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:16px;padding:40px 22px 36px;text-align:center;">
    <p style="margin:0 0 28px;font-size:15px;line-height:1.82;color:#344054;text-align:center;">
      <span leaf="">如果你觉得今天这篇有收获，欢迎</span>
      <strong style="color:#3e3e3e;"><span leaf="">点赞、在看、转发</span></strong>
      <span leaf="">三连，我们下篇见</span>
    </p>
    <section style="display:flex;justify-content:center;align-items:flex-start;">
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#ECFDF5;border:1px solid #28a745;border-radius:14px;font-size:24px;font-weight:600;color:#28a745;"><span leaf="">♥</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#28a745;"><span leaf="">点赞</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;font-size:24px;font-weight:600;color:#6b7280;"><span leaf="">◎</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#6b7280;"><span leaf="">在看</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;font-size:24px;font-weight:600;color:#6b7280;"><span leaf="">↗</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#6b7280;"><span leaf="">转发</span></p>
      </section>
    </section>
    <p style="margin:32px 0 0;font-size:11px;color:#9CA3AF;letter-spacing:4px;">
      <span leaf="">THANKS FOR READING</span>
    </p>
  </section>
</section>
```

### 八、衬线深蓝方格纸（`{{主色}}=#1E5AA8`）

```html
<section style="padding:0 10px;">
  <p style="margin:0 0 8px;font-size:15px;line-height:1.82;color:#6b7280;text-align:justify;">
    <span leaf="">我是 {{作者名}}，</span>
  </p>
  <p style="margin:0 0 44px;font-size:15px;line-height:1.82;color:#6b7280;text-align:justify;">
    <span leaf="">更多 AI 应用 / 我们下期再见 👋</span>
  </p>
</section>
<section style="padding:0 11px;">
  <section style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:16px;padding:40px 22px 36px;text-align:center;">
    <p style="margin:0 0 28px;font-size:15px;line-height:1.82;color:#344054;text-align:center;">
      <span leaf="">如果你觉得今天这篇有收获，欢迎</span>
      <strong style="color:#3e3e3e;"><span leaf="">点赞、在看、转发</span></strong>
      <span leaf="">三连，我们下篇见</span>
    </p>
    <section style="display:flex;justify-content:center;align-items:flex-start;">
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#EAF2FB;border:1px solid #1E5AA8;border-radius:14px;font-size:24px;font-weight:600;color:#1E5AA8;"><span leaf="">♥</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#1E5AA8;"><span leaf="">点赞</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;font-size:24px;font-weight:600;color:#6b7280;"><span leaf="">◎</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#6b7280;"><span leaf="">在看</span></p>
      </section>
      <section style="text-align:center;margin:0 22px;width:60px;">
        <span style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;font-size:24px;font-weight:600;color:#6b7280;"><span leaf="">↗</span></span>
        <p style="margin:12px 0 0;font-size:13px;color:#6b7280;"><span leaf="">转发</span></p>
      </section>
    </section>
    <p style="margin:32px 0 0;font-size:11px;color:#9CA3AF;letter-spacing:4px;">
      <span leaf="">THANKS FOR READING</span>
    </p>
  </section>
</section>
```

## 融入现有主题的规则（重要）

- **替换/紧随，二选一**：本感谢卡**替代**主题内置的纯文字签名区，或紧随其后；**不要和内置签名区同时展示两句「三连」**。
- **作者签名**：上半部分签名（「我是 {{作者名}}…」）是可选——若文章已有作者介绍段，可只保留圆角卡，或把签名并入卡片顶部。
- **图标**：固定 ♥/◎/↗，点赞始终主色高亮。
- **位置**：全文最末尾（END 分割线之后；无可选时直接作为最后一块）。

## 合规性

本组件所有 HTML 均已通过 `validate_gzh_html.py`（span leaf 全部包裹、无禁项）。改配色时把下表变量替换进通用骨架即可。
