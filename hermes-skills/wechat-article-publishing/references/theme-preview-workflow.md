# Theme Preview Workflow（主题可视化对比预览）

> 场景：用户给出一个公众号排版主题清单，要求「看效果对比/出预览图」，再决定用哪套。
> 2026-09-05 用 wewrite 渲染器验证通过（graphite-minimal / fresh-green / zen-whitespace 三套对比）。

## 核心原则

- **预览 ≠ 发布**。用户只要求看效果时，走 `--dry-run`（渲染 HTML + 校验账号/token，但
  不会上传封面、不会建草稿），渲染完用无头浏览器截屏即可，不要为对比而发布真草稿。
- 用**最近一篇真实文章**（`output/YYYYMMDD-topic.md` + 它的 `-cover.jpg`）当素材，预览
  才反映生产内容质感；别用合成样章。

## 步骤（verified 2026-09-05）

```bash
# 1) 每套候选主题 dry-run 渲染成独立 HTML
cd <output_dir>
for t in graphite-minimal fresh-green zen-whitespace; do
  python3 <pub>/wewrite_publish.py article.md cover.jpg --account dog \
    --theme "$t" --dry-run --html-out "PREVIEW-${t}.html"
done

# 2) 无头 Chrome 截屏（≈430px 手机视口）
for t in graphite-minimal fresh-green zen-whitespace; do
  google-chrome --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size=430,1600 --screenshot="PREVIEW-${t}.png" \
    --virtual-time-budget=6000 "file://$(pwd)/PREVIEW-${t}.html"
done

# 3) 逐张 vision 核验（标题/主题色/章节条/是否衬线）后再呈现给用户
```

以 `MEDIA:` 内联交付 PNG，并给每套一句判断 + 一条推荐。

## 坑

1. **无衬线网页字体在无头 Chrome 里不加载** → `zen-whitespace` / `elegant-serif` /
   `academic-paper` 这类依赖 serif `font-family` 的主题，在 430px 截屏上会渲染得跟无衬线
   主题（如 `graphite-minimal`）几乎一模一样。**别对着截图说「这俩看起来不同」**——要明确
   标注衬线字体 headless 下不显示、需在真实微信客户端才可见；判断风格差异应看 CSS 变量
   （留白/字号/颜色），不能只看截图。
2. **截图宽度只是近似**。真实读者视口是手机，430px 接近但不精确；说明时注明所用视口。
3. **不要为预览而发布**。用户只要预览就停在做 dry-run + 截屏；真发草稿需另行确认。
