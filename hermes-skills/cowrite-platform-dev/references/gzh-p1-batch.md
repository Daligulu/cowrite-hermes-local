# gzh 公众号系统 P0/P1 批次接入（2026-08-31 落地，生产动作 22→27）

按 P0→P1 顺序把 10 个 gzh Skill 生态接入 Cowrite，全部走「独立接入 + 真实验收」
（每个动作各自独立、不耦合旧动作），新增 6 个动作：起标题 baokuan-title / 短文写作
gzh-short-post / 头图封面 space-gzh-cover / 爆款调研 baokuan-research / 长文写作
gzh-longform / 图表配图 space-chart / 逻辑图配图 space-logic。四步接入 runbook 见
`external-skill-action-integration.md`。本文件记录这批接入的实操经验与验收要点。

## baokuan-research「爆款调研」泛词治理契约（关键）

- **大类泛词 → 禁止直接查全站**：检测到泛词（抽象层级高、无具体场景/属性修饰、行业大类
  如 职场/情感/AI/科技，或 context 含「领域/类型」）时**不跑脚本**，改为输出 10 个细分
  赛道推荐 + 标记【需细分】，任务**仍算 succeeded**（细分推荐即交付物）。这是
  gzh-explosive-content-detector 的硬约束「泛词必须先问再查、禁止同轮直接跑脚本」。
- **具体词 → 跑脚本**：
  `/root/.hermes/hermes-agent/venv/bin/python3 ~/.hermes/skills/creative/baokuan-article-analysis/scripts/daily_sector_trends.py --sector "赛道=关键词1,关键词2" --max-items-per-sector 10 --output-dir /tmp/baokuan-research`
  读 data.json/report.html 总结 + 上传 report.html + 写回页面。

## 泛词判定比 prompt 示例更保守（踩过，必记）

prompt 里把「AI Agent框架」列为「具体词可放行」示例，但 Worker 实际把「AI Agent 智能体
赛道」判为**大类泛词**（覆盖到整个智能体行业、无更细产品/场景修饰）。要可靠触发脚本链路，
用**带具体场景/属性修饰的下位词**（如「AI 编程助手」「Claude Code」「Dify 工作流」）；
**别用「AI Agent」去测脚本路径**（得到的是细分推荐而非 report）。

泛词/具体词两种验收场景务必**分开测、分别断言**：
- 泛词场景断言：含【需细分】+ 细分推荐 + 不含 report.html
- 具体词场景断言：含 `/assets/<hash>.html`（报告上传）+ 数据分析 + 写作参考

## 数据边界诚实标注

Worker 会把「Claude Code」在数据源里宽泛匹配为「Claude」，混入无关文章（实测混入 4 条
孙宇晨/景甜八卦），须剔除并标注「数据边界」（如实说明样本净化）。验收断言 report 用
`/assets/<hash>.html`（hash 名，**不是**字面 "report.html"）。

## P1 其他验收要点

- **gzh-longform 长文写作**：给「主题+一堆素材」→ Worker 走「素材整合式」（压缩素材找共同
  主线）→ ~1540 字成稿 + 边界/反面节。断言含「写法/六写法之一」即可，不必苛求字面「诊断」。
- **space-logic 逻辑图配图**：把正文拆成流程关系（含转折点）+ 概念数，生成自包含 HTML
  （含 SVG）上传；断言语义含关系类型 + `/assets/*.html`。
- **space-chart 图表配图**：用 apiyi-image-generation 出 PNG（如流程图 7 步 / notion 白底
  黑线简约），上传插入正文 `![...](/assets/x.jpg)`；视觉效果白底黑线简约、中文逐字正确。
- 生图类（space-gzh-cover / space-chart）验收慢、可能供应商 45x/451，用后台 terminal +
  notify_on_complete；泛词治理验收快，可前台等。
- 报告/封面成品图可 `MEDIA:/path` 直接展示给用户看，视觉确认（文字正确/白底黑线简约/流程
  清晰）后再下「验收通过」结论。

## 本批动作清单（生产 27 动作，回滚点 pre-gzh-dev=00aab7f）

| 动作 id | 位置分组 | 对应 skill | 端到端产物 |
|---|---|---|---|
| baokuan-title | 写作加工 | baokuan-title-generator | 12 候选矩阵 + Top5 分角色推荐 |
| gzh-short-post | 写作加工 | gzh-short-post | 539 字短文，骨架 B |
| space-gzh-cover | 配图 | space-gzh-cover | cover-02.png 2.35:1，安全区校验 PASS |
| baokuan-research | 选题投稿 | baokuan-article-analysis + gzh-explosive-content-detector | 泛词→细分推荐 / 具体词→report.html |
| gzh-longform | 写作加工 | gzh-longform-writer | 1540 字成稿 + 边界节，素材整合式 |
| space-chart | 配图 | space-chart-image | 流程图 PNG（7 步，notion 简约） |
| space-logic | 配图 | space-text-logic-diagram | 流程关系 HTML（含 SVG），5 概念 |
