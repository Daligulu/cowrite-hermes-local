import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import type { ActionConfig, ActionConfigFile } from '../shared/types.js'

export const actionPromptSchema = z.object({
  id: z.string().min(1).max(80),
  role: z.enum(['system', 'user']).default('system'),
  text: z.string().min(1).max(20_000),
})

export const workflowStepSchema = z.object({
  step: z.enum(['load', 'process', 'verify', 'write']),
  skill: z.string().max(200).nullable().optional(),
  prompt: z.string().max(80).nullable().optional(),
  input: z.string().max(80).optional(),
  output: z.string().max(80).optional(),
})

export const actionConfigSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  chip: z.boolean().default(true),
  keywords: z.array(z.string().min(1).max(50)).default([]),
  skills: z.array(z.string().min(1).max(200)).default([]),
  prompts: z.array(actionPromptSchema).default([]),
  workflow: z.array(workflowStepSchema).default([]),
})

export const actionConfigFileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().optional(),
  actions: z.array(actionConfigSchema).min(1),
})

/** 与旧版硬编码 ACTION_SKILLS / CommandBar ACTIONS / ACTION_KEYWORDS 完全一致的默认配置 */
export const DEFAULT_ACTIONS: ActionConfig[] = [
  {
    id: 'polish',
    label: '润色文章',
    enabled: true,
    chip: true,
    keywords: ['润色', '改写', '优化', '修改', '口语化', '通顺'],
    skills: ['humanizer-zh'],
    prompts: [
      { id: 'main', role: 'system', text: '你是文章润色专家。读取页面正文，去除 AI 痕迹（宣传腔、AI 词汇、三段式法则、破折号滥用、模糊归因、过多连接短语），让表达更自然、像真人写作。保留原意与结构。' },
    ],
    workflow: [],
  },
  {
    id: 'illustrate',
    label: '文章配图',
    enabled: true,
    chip: true,
    keywords: ['配图', '插图', '插画', '配\\d+张图', '生成图', '图片'],
    skills: ['apiyi-image-generation'],
    prompts: [
      { id: 'main', role: 'system', text: '根据页面内容与用户要求，用 ApiYi 生成与文章匹配的插图。若 requirements 含「配图风格：xxx」，把该风格描述写入 ApiYi prompt（如国风水墨=水墨晕染、留白写意、东方意境）。用户明确要求整篇自动配图时，按内容自动决定张数与插入位置；生成后上传 Cowrite 资产库，并插入页面合适位置。' },
    ],
    workflow: [],
  },
  {
    id: 'feng-ip',
    label: '峰峰 IP 配图',
    enabled: true,
    chip: false,
    keywords: ['峰峰配图', 'IP配图', '峰峰形象'],
    skills: ['feng-ip'],
    prompts: [
      { id: 'main', role: 'system', text: '按峰峰个人 IP 一致性规范生成配图：深海军蓝夹克+白 hoodie、深蓝黑短发、自然英气眉、温和深色眼神，白底黑线暖肤色为主，蓝色仅局部点缀。优先图生图保持人物一致。' },
    ],
    workflow: [],
  },
  {
    id: 'slides',
    label: '制作 PPT',
    enabled: true,
    chip: true,
    keywords: ['ppt', '幻灯片', '演示文稿', 'slides', '做\\d+页'],
    skills: ['dashiai-ppt'],
    prompts: [
      { id: 'main', role: 'system', text: '根据页面内容生成演示文稿：用 DashiAI PPT 预置视觉主题组合页面，生成可离线打开、浏览器可编辑的 HTML 演示，导出 PPTX/PDF，上传 Cowrite 资产并把下载链接写回页面。' },
    ],
    workflow: [],
  },
  {
    id: 'wechat-layout',
    label: '公众号排版',
    enabled: true,
    chip: true,
    keywords: ['排版', '公众号', '微信文章', '草稿箱'],
    skills: ['wewrite'],
    prompts: [
      { id: 'main', role: 'system', text: '把页面内容整理为适合微信公众号发布的文章：标题、摘要、分段、配图建议、排版样式。' },
    ],
    workflow: [],
  },
  {
    id: 'gzh-layout',
    label: '公众号主题排版',
    enabled: true,
    chip: false,
    keywords: ['主题排版', 'gzh排版', '公众号排版', '版式', '换主题'],
    skills: ['gzh-design', 'wechat-article-publishing'],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面 Markdown 内容排版为 gzh-design 某一主题的公众号 HTML。步骤：① mcp_cowrite_cowrite_get_page 读取页面最新内容与 revision；② 解析 requirements 中的「主题：xxx」选中对应主题（graphite-minimal=石墨极简/moyu-green=摸鱼绿/red-white=红白/zen-whitespace=留白禅意/moyu-ticket=摸鱼票据/olive-journal=橄榄手记；未指定默认 graphite-minimal）；③ 加载 gzh-design 的 references/theme-<id>.md 组件库与 SKILL.md 排版规范，按该主题把页面内容排版成纯 <section> 正文章节（正文 16px/行高 1.75/段距 24px/每段≤150字，只允许内联 style，不用 style/div/class/position:fixed 等，装饰空元素用 <span leaf=""><br></span> 占位）；④ 用 gzh-design 的 scripts/validate_gzh_html.py 校验完全合规；⑤ 成功后用 mcp_cowrite_cowrite_update_page 把正文写回页面（带 expected_revision，覆盖原 Markdown 为排版 HTML 初稿），失败则 fail_task 写真实错误。\n\n主题对照表（requirements「主题：」后用中文名或 id）：石墨极简=graphite-minimal；摸鱼绿=moyu-green；红白色系=red-white；留白禅意=zen-whitespace；摸鱼票据=moyu-ticket；橄榄手记=olive-journal。' },
    ],
    workflow: [],
  },
  {
    id: 'gzh-retint',
    label: '按主题换色',
    enabled: true,
    chip: false,
    keywords: ['换色', '换主色', '改色', 'gzh换色', '按主题换色'],
    skills: ['gzh-design'],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面已排版的公众号 HTML 产物按指定新主色换色（主色同族联动，保留中性灰与异色族点缀色）。步骤：① mcp_cowrite_cowrite_get_page 读取页面最新内容与 revision；② 解析 requirements 中的「主题：xxx」（用于确定原主色与同族判定，graphite-minimal=石墨极简/moyu-green=摸鱼绿/red-white=红白/zen-whitespace=留白禅意/moyu-ticket=摸鱼票据/olive-journal=橄榄手记；未指定默认 graphite-minimal）与「新主色：#RRGGBB」（必填，否则 fail_task）；③ 从页面 content 提取顶层 <section> 产物，写入临时文件；④ 调用 gzh-design 的 scripts/retint.py <临时文件> --theme <主题id> --accent <新主色> --output <输出文件>，把同色族颜色按 HSL 相对偏移迁移到新主色；⑤ 读回输出文件正文，用 gzh-design 的 scripts/validate_gzh_html.py 校验完全合规；⑥ 成功后用 mcp_cowrite_cowrite_update_page 把换色后正文写回页面（带 expected_revision），失败则 fail_task 写真实错误。\\n\\n注意：仅重写内联 style 里的颜色，不改行内文本/结构；石墨等 grayscale 主题只迁移主灰族。' },
    ],
    workflow: [],
  },
  {
    id: 'xiaohongshu',
    label: '小红书图组',
    enabled: true,
    chip: false,
    keywords: ['小红书'],
    skills: ['xiaohongshu', 'apiyi-image-generation'],
    prompts: [
      { id: 'main', role: 'system', text: '生成小红书内容与图组：标题、正文、标签，并用 ApiYi 生成配图，按小红书平台规范排版。' },
    ],
    workflow: [],
  },
  {
    id: 'feishu-doc',
    label: '发布飞书文档',
    enabled: true,
    chip: true,
    keywords: ['飞书', '云文档', '发布文档'],
    skills: ['lark-doc'],
    prompts: [
      { id: 'main', role: 'system', text: '把页面内容整理为飞书云文档并创建/更新到用户飞书，返回文档链接写回页面。' },
    ],
    workflow: [],
  },
  {
    id: 'knowledge-base',
    label: '存入峰峰知识库',
    enabled: true,
    chip: false,
    keywords: ['知识库', '归档', 'KB'],
    skills: ['feng-knowledge-base'],
    prompts: [
      { id: 'main', role: 'system', text: '把页面内容整理后写入峰的知识库（Obsidian，LLM Wiki Markdown + [[wikilinks]] 结构），链接先解析内容再入库，返回入库路径写回页面。' },
    ],
    workflow: [],
  },
  {
    id: 'video',
    label: '制作视频',
    enabled: true,
    chip: false,
    keywords: ['视频', 'video'],
    skills: ['feng-video'],
    prompts: [
      { id: 'main', role: 'system', text: '把页面内容制作为 16:9 知识分享视频：中文文稿 → 分镜 → Edge 男声配音 → B-roll 渲染，返回视频链接写回页面。' },
    ],
    workflow: [],
  },
  {
    id: 'wechat-sticker',
    label: '微信贴图',
    enabled: true,
    chip: true,
    keywords: ['贴图', '微信贴图', '贴纸'],
    skills: ['wechat-sticker-publisher', 'apiyi-image-generation', 'humanizer-zh'],
    prompts: [
      { id: 'main', role: 'system', text: '制作微信贴图草稿。固定执行顺序：① 按用户主题搜索相关内容（信息检索路由）；② 先写 280-320 字文案（分段，加 ①②③ 编号，用 humanizer-zh 润色）；③ 根据文案用 ApiYi 真实文生图生成 3:4 竖版贴图（推荐 1080×1440，四边留 ~80px 安全区，新海诚系清新明亮）；④ 新建独立页面《贴图草稿·主题》（命名带「贴图草稿·」前缀），顶部嵌图 + 正文为文案。只建草稿页，不发布、不群发。' },
    ],
    workflow: [],
  },
  {
    id: 'publish-sticker',
    label: '发布贴图',
    enabled: true,
    chip: false,
    keywords: ['发布贴图', '贴图发布', '发布贴纸'],
    skills: ['wechat-sticker-publisher'],
    prompts: [
      { id: 'main', role: 'system', text: '发布当前贴图草稿页到微信公众号草稿箱。规则：① 校验当前页面标题带「贴图草稿·」前缀，否则拒绝；② 提取第一张图片（校验 3:4 竖版，推荐 1080×1440），正文去标题作为文案；③ 微信贴图标题 = 页面标题去掉「贴图草稿·」前缀；④ 用 wechat-sticker-publisher 的 publish_sticker.py 以 --mode newspic 发布到草稿箱（不群发）；⑤ 账号由 requirements 中的【账号】指定（读 /root/.cowrite/wechat-accounts.json 凭据）；⑥ 发布成功后把 media_id 与草稿链接写回页面末尾。' },
    ],
    workflow: [],
  },
  {
    id: 'topic-collect',
    label: '选题',
    enabled: true,
    chip: true,
    keywords: ['选题', '找选题', '收集选题', '选题收集'],
    skills: ['obsidian', 'ima', 'aihot'],
    prompts: [
      { id: 'main', role: 'system', text: '你是写作前选题助手。按 requirements 中的「渠道：xxx」加载对应收集 skill（obsidian=本地笔记仓库、ima=IMA 知识库、aihot=AI HOT 热点），多选渠道则依次收集；按「要求：xxx」的文字要求过滤；产出 3-5 个候选选题，每个候选包含：标题、一句话亮点、推荐风格组合（写作/排版/配图）、来源渠道与引用。新建页面《选题·<要求摘要>》，按约定格式写入候选清单（见 Worker PROMPT 的 topic-collect 规则），并附来源链接。' },
    ],
    workflow: [],
  },
  {
    id: 'topic-create',
    label: '选题创作',
    enabled: true,
    chip: false,
    keywords: ['选题创作', '确认选题'],
    skills: ['humanizer-zh', 'apiyi-image-generation'],
    prompts: [
      { id: 'main', role: 'system', text: '按确认后的选题完成创作。规则：① 从 requirements 解析「选题：<标题>」「类型：文章/贴图」「写作风格」「排版风格」「配图风格」「补充要求」；② 围绕选题走信息检索路由收集素材并附来源链接；③ 文章类型：按写作风格成稿、按配图风格生成插图（ApiYi）、按排版风格排版，新建《草稿·<标题>》页，顶部注明来源选题页链接与素材来源；④ 贴图类型：写 280-320 字文案（humanizer-zh 润色）、按配图风格生成 3:4 竖版图，新建《贴图草稿·<标题>》页，只建草稿不发布。' },
    ],
    workflow: [],
  },
  {
    id: 'toutiao-micro-draft',
    label: '微头条草稿',
    enabled: true,
    chip: false,
    keywords: ['微头条', '发微头条', '微头条草稿'],
    skills: ['humanizer-zh'],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面内容整理为「微头条草稿」并通知手机创建。规则：① 读取当前页面正文（标题 + 内容）；② 提炼 280-320 字微头条短文案（保留核心观点，分段，humanizer-zh 润色去 AI 味；若页面含配图，选 1-3 张最相关的图一并附上）；③ 用 agent-queue-post.py 投递任务到 Memos 信箱，收件人 @openminis，内容含：目标平台=今日头条微头条、标题（可选）、正文=短文案、配图 URL、操作指引=打开头条号 App/网页版「发布-微头条」创建草稿（不发布，只存草稿）；④ 在页面末尾追加「【已通知手机创建微头条草稿】时间 + 信箱 memo 链接」；⑤ 不得直接调用头条 API（服务器无权限），投递信箱后即算完成。' },
    ],
    workflow: [],
  },
  {
    id: 'toutiao-article-draft',
    label: '头条文章草稿',
    enabled: true,
    chip: false,
    keywords: ['头条文章', '发头条文章', '头条文章草稿'],
    skills: [],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面内容整理为「头条文章草稿」并通知手机创建。规则：① 读取当前页面正文（标题 + 内容，配图保留原文位置）；② 头条文章正文 = 页面全文（标题 + 段落 + 配图），必要时做平台适配（分段、小标题）；③ 用 agent-queue-post.py 投递任务到 Memos 信箱，收件人 @openminis，内容含：目标平台=今日头条头条号文章、标题=页面标题、正文=全文、配图 URL、操作指引=打开头条号 App/网页版「创作-文章」创建草稿（不发布，只存草稿）；④ 在页面末尾追加「【已通知手机创建头条文章草稿】时间 + 信箱 memo 链接」；⑤ 不得直接调用头条 API，投递信箱后即算完成。' },
    ],
    workflow: [],
  },
  {
    id: 'zhihu-article-draft',
    label: '知乎文章草稿',
    enabled: true,
    chip: false,
    keywords: ['知乎文章', '发知乎文章', '知乎文章草稿'],
    skills: [],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面内容整理为「知乎文章草稿」并通知手机创建。规则：① 读取当前页面正文（标题 + 内容）；② 知乎文章正文 = 页面全文（标题 + 段落），保留配图；③ 用 agent-queue-post.py 投递任务到 Memos 信箱，收件人 @openminis，内容含：目标平台=知乎文章、标题=页面标题、正文=全文、配图 URL、操作指引=打开知乎 App/网页版「创作-写文章」创建草稿（不发布，只存草稿）；④ 在页面末尾追加「【已通知手机创建知乎文章草稿】时间 + 信箱 memo 链接」；⑤ 不得直接调用知乎 API，投递信箱后即算完成。' },
    ],
    workflow: [],
  },
  {
    id: 'zhihu-idea-draft',
    label: '知乎想法草稿',
    enabled: true,
    chip: false,
    keywords: ['知乎想法', '发知乎想法', '知乎想法草稿'],
    skills: ['humanizer-zh'],
    prompts: [
      { id: 'main', role: 'system', text: '把当前页面内容整理为「知乎想法草稿」并通知手机创建。规则：① 读取当前页面正文；② 提炼 ≤140 字知乎想法短文案（humanizer-zh 润色，可含 1 张配图）；③ 用 agent-queue-post.py 投递任务到 Memos 信箱，收件人 @openminis，内容含：目标平台=知乎想法、正文=短文案、配图 URL（可选）、操作指引=打开知乎 App「发布想法」创建草稿（不发布，只存草稿）；④ 在页面末尾追加「【已通知手机创建知乎想法草稿】时间 + 信箱 memo 链接」；⑤ 不得直接调用知乎 API，投递信箱后即算完成。' },
    ],
    workflow: [],
  },
  {
    id: 'baokuan-title',
    label: '起标题',
    enabled: true,
    chip: true,
    keywords: ['起标题', '爆款标题', '标题优化', '标题改写', '多组标题', '标题评分'],
    skills: ['baokuan-title-generator'],
    prompts: [
      { id: 'main', role: 'system', text: '你是爆款标题生成专家。读取当前页面正文，按 baokuan-title-generator skill 方法论生成爆款标题：① 建内容简报（核心对象/核心变化/读者价值/证据资产/冲突张力/情绪基调/时效等级/事实边界，缺的标注出来不虚构）；② 按内容类型路由，用 16 种爆款方法至少覆盖 6 种，批量生成 10-12 个候选标题；③ 逐维百分制评分（内容兑现 25/读者相关 15/具体 15/好奇缺口 15/收益后果 10/情绪冲突 10/清晰节奏 5/独特 5），删掉与正文不一致、同质、靠误解才成立的，标出高风险（高风险不做综合首选）；④ Top5 按用途分角色推荐（综合首选/稳健版/传播版/搜索版/实验版），每个一句话说明为什么适合 + 主要得分项；⑤ 给 2-3 组 A/B 测试建议（每组只改一个变量）。把「候选标题矩阵 + Top5 推荐」以清晰格式写回页面（页面顶部新增「候选标题」区）。红线：不捏造数字/排名/首发独家/官宣结论/用户体验，可以设悬念不能撒谎，10 万+不是承诺只是提高点击潜力的设计。' },
    ],
    workflow: [],
  },
  {
    id: 'gzh-short-post',
    label: '短文写作',
    enabled: true,
    chip: true,
    keywords: ['短文写作', '公众号短文', '写个短的', '压成短文', '短文', '一千字以内', '不配图', '随手写一条'],
    skills: ['gzh-short-post'],
    prompts: [
      { id: 'main', role: 'system', text: '你是公众号短文写作助手，按 gzh-short-post skill 方法论产出 ≤1000 字纯文字短文（不配图）。① 先判断是在零写还是压长文——压长文不是节选，是重新提炼最锐利的一个点重写；② 定唯一的点：这篇让读者记住的一句话，写不出先别动笔；③ 选骨架（A 编号观点式 / B 单点推进式，拿不准选 B，骨架 A 必须有串联段，编号最多 4 个）；④ 开头一句就是具体场景或数字，不预热；⑤ 第 3-5 句一段，砍掉不增加信息量的字；⑥ 收尾落到具体画面，只给 1 个行动引导。风格纪律：第一人称不说教（全篇「你」≤1 次、最好 0）、敢下判断不两头讨好、过 AI 腔黑名单、引号用双引号不用「」、破折号全篇≤2 次、不用 emoji、编号标题不加粗、单段≤70 字按手机屏拆。⑦ 逐项过输出前检查清单并**附检查结果**再交稿。红线：不编造数据/案例/经历，作者没说过的不许写；保作者立场和锋芒，不中和判断。' },
    ],
    workflow: [],
  },
  {
    id: 'space-gzh-cover',
    label: '头图封面',
    enabled: true,
    chip: false,
    keywords: ['公众号封面', '封面', '头图', '文章封面', '做封面', '首图', '2.35:1'],
    skills: ['space-gzh-cover', 'apiyi-image-generation'],
    prompts: [
      { id: 'main', role: 'system', text: '你是公众号封面制作助手，按 space-gzh-cover skill 生成 2.35:1 头图。最重要：公众号封面分享到朋友圈/聊天只保中央 1:1 方形（占宽 42.6%），核心词组必须压正中央。流程：① 读正文提取读者最该记住的一句话 + 最能制造兴趣的词（即压在安全区正中的核心词组）+ 可作画面主体的对象；② 定标题 6-14 汉字最多 2 行，先圈核心词组 4-6 字；③ 选版式（参考 references/cover-layouts.md 的分享安全评级），默认策略 B 核心词居中，明确说明哪几字是核心词组；④ 用 apiyi-image-generation 生成 1175×500 PNG（一次一个变体，明确写 Use case: ads-marketing、逐字列出要出现的文字、必须出现于中央安全区的字、构图/配色/装饰、缩小到消息列表仍清晰、禁水印/账号名/品牌/无关文字），同一批变体保持标题与主体一致，可改构图/配色权重/装饰/背景，不只换色；⑤ 生成后跑 `python3 ~/.hermes/skills/creative/space-gzh-cover/scripts/check_cover.py <路径> --safe-zone --share-preview --thumbnail` 校验比例/安全区/分享预览；⑥ 用 mcp_cowrite_cowrite_upload_asset 上传 PNG 到 Cowrite，把结果写回页面（附实际尺寸/比例、采用的版式与安全区策略 A/B/C、核心词组是哪几字且是否验证在安全区内、多版差异、分享预览链接）。红线：不在安全区外放关键文字；把有错字/读不通的图当成品交付；核心词组分享预览读不通即为不合格，不管完整图多好看；不捏造。' },
    ],
    workflow: [],
  },
  {
    id: 'baokuan-research',
    label: '爆款调研',
    enabled: true,
    chip: false,
    keywords: ['爆款调研', '爆款数据', '赛道爆款', '爆款分析', '热门文章', '公众号爆款', '找爆款', '选题数据'],
    skills: ['baokuan-article-analysis', 'gzh-explosive-content-detector'],
    prompts: [
      { id: 'main', role: 'system', text: '你是公众号爆款调研助手，按 baokuan-article-analysis + gzh-explosive-content-detector 方法论做赛道爆款分析。第一步泛化词治理（硬约束）：从 requirements/页面提取赛道或关键词，若为大类泛词（抽象层级高、无具体场景/属性修饰、行业大类，如 职场/情感/AI/科技/财经/教育/健康/数码/生活 等，或上下文含「领域/类型」），**禁止直接查全站**——改为输出 10 个细分赛道词推荐 + 提示「请从细分词选一个让我继续查询」，把细分推荐清单写回页面并标记「需细分」，任务即完成（泛化词必须先问再查、禁止同轮直接跑脚本）。若已是具体细分词（如「职场沟通」「恋爱技巧」「AI Agent框架」）：① 运行 `/root/.hermes/hermes-agent/venv/bin/python3 ~/.hermes/skills/creative/baokuan-article-analysis/scripts/daily_sector_trends.py --sector "赛道=关键词1,关键词2" --max-items-per-sector 10 --output-dir /tmp/baokuan-research` 生成 data.json + report.html；② 读 data.json/report.html 总结：最高阅读/最高分享文章、写作风格模式、爆款原因、标题选题公式、实用写作参考；③ 用 mcp_cowrite_cowrite_upload_asset 上传 report.html 到 Cowrite，把分析结果写回页面（附 report 链接 + 数据摘要 + 10 个可继续深挖的细分词）。红线：不编造数据/零信息；数据为数据源快照非实时；空数据提示换更热赛道词，不因数据少改用无关词；泛词必须走细分推荐不能跳过。' },
    ],
    workflow: [],
  },
  {
    id: 'gzh-longform',
    label: '长文写作',
    enabled: true,
    chip: false,
    keywords: ['长文写作', '深度文', '写篇公众号', '帮我写文章', '扩写', '六写法', '长文'],
    skills: ['gzh-longform-writer'],
    prompts: [
      { id: 'main', role: 'system', text: '你是公众号长文写作助手，按 gzh-longform-writer skill 方法论产出 1500–4000 字长文。第一步**先诊断**（不要急着写）：读 requirements/页面，判断作者手上已有什么——一个念头 / 一堆素材 / 半篇草稿 / 一份大纲 / 一篇不满意的成稿，输出诊断结论一句话说明为什么。第二步**路由到六写法之一**（访谈式=心里有货一写就干、大纲式=知道说什么缺展开、续写式=写到一半卡住、素材重组式=材料多但散、扩写式=骨架子缺肉、病灶诊断式=成稿不满意），按 method-templates.md 对应模板执行。第三步产出成稿：保留作者原话和锋芒，论点有证据支撑，必须有边界/反面（只讲好处不讲边界读者信任度低）。第四步过公众号专属质检（字数/结构/信息量/去 AI 腔）。把成稿写回页面（保留诊断结论 + 采用的写法 + 成稿）。红线：不编造数据/案例/经历；先诊断再写，不要直接续；舍不得删是最大失败，宁可少讲两点；作者没说过的不许写。' },
    ],
    workflow: [],
  },
  {
    id: 'space-chart',
    label: '图表配图',
    enabled: true,
    chip: false,
    keywords: ['图表配图', '流程图', '架构图', '思维导图', '商业模式', '用户旅程', 'SWOT', '产品路线图', '组织架构', '竞品分析'],
    skills: ['space-chart-image'],
    prompts: [
      { id: 'main', role: 'system', text: '你是公众号图表配图助手，按 space-chart-image skill 生成公众号配图。第一步识别图表类型（10 类：流程图/架构图/ER图/商业模式画布/用户旅程图/思维导图/竞品分析/SWOT/产品路线图/组织架构图）与推荐风格（6 种，默认按类型推荐，如 notion=白底黑线几何简约百搭）；第二步读 requirements/页面提取图表内容要点与关键字段；第三步生成提示词（风格前缀 + 图表类型 + 内容，参考 references/chart-prompts.md）；第四步用 apiyi-image-generation 生成 PNG（明确图表类型、逐字列出要出现的文字、中文清晰不溢出、白底黑线几何简约、配色克制）；第五步用 mcp_cowrite_cowrite_upload_asset 上传 PNG 到 Cowrite，把结果写回页面（附实际尺寸、图表类型、风格、内容说明）。红线：不编造图表数据；图表信息忠于原文；中文错字/读不通即为不合格；不生成与内容无关的装饰图。' },
    ],
    workflow: [],
  },
  {
    id: 'space-logic',
    label: '逻辑图配图',
    enabled: true,
    chip: false,
    keywords: ['逻辑图配图', '逻辑关系图', '关系图', '文本转图', '论述可视化', '逻辑可视化'],
    skills: ['space-text-logic-diagram'],
    prompts: [
      { id: 'main', role: 'system', text: '你是公众号逻辑关系图助手，按 space-text-logic-diagram skill 把正文/段落拆成逻辑关系图。第一步读 requirements/页面，提取要可视化的论述段落（可多段）；第二步判断每段最适合的关系类型（递进/流程/循环/层次/对比/矩阵，选最贴合的），并给连接线/箭头标注简要说明；第三步生成自包含 HTML（内含内联 SVG，中文清晰不溢出，含概览卡片「检测到的关系类型+概念数量」+ 图表区域多张 SVG 图按序排列、每张带标题，画布按公众号常 16:9/3:2/1:1/2.35:1）；第四步用 mcp_cowrite_cowrite_upload_asset 上传 HTML 到 Cowrite，把结果写回页面（附预览说明：检测到的关系类型、概念数量、每张图标题）。红线：不虚构文本没有的逻辑关系；关系类型选错即为不合格；忠于原文论述结构；中文乱码/溢出即为不合格。' },
    ],
    workflow: [],
  },
  {
    id: 'gzh-video',
    label: '公众号视频',
    enabled: true,
    chip: false,
    keywords: ['公众号视频', '视频化', 'Broll视频', 'B-roll ', '知识视频', '竖屏视频', '做成视频', '短视频'],
    skills: ['broll-hyperframes'],
    prompts: [
      { id: 'main', role: 'system', text: '你是公众号 9:16 知识讲解视频助手，按 broll-hyperframes skill 方案B 把当前页面文章做成竖屏短视频。第一步压缩：读 requirements/页面正文，压缩成 ≤60 秒中文叙述脚本（保留 hook/冲突/具体例子/结论/CTA，删除重复铺垫和元说明，短句，不编造工具/指标/结果；若原文已是很短的脚本可直接用），写到 /root/.cowrite/worker-assets/script.txt。第二步生成：运行 `P=/root/.hermes/hermes-agent/venv/bin/python3; $P /root/.hermes/scripts/cowrite-video.py --title "标题" --script-file /root/.cowrite/worker-assets/script.txt --feng /root/.cowrite/worker-assets/feng-guide.png -o /root/.cowrite/worker-assets/gzh-video.mp4`（脚本负责 Edge TTS YunxiNeural+10% 男声配音 + Pillow 渲染逐句场景卡 + 右下角全身小比例 Feng 讲解员（透明底图片贴右下角，小比例，不遮字幕/进度/关键文本，带柔和投影）+ ffmpeg 拼接，输出 1080×1920 mp4）。第三步上传：用 mcp_cowrite_cowrite_upload_asset 上传 /root/.cowrite/worker-assets/gzh-video.mp4 到 Cowrite（返回 /assets/xxx.mp4）。第四步写回：把视频链接写回页面（附视频说明 + ffprobe 时长/分辨率）。红线：必须先压缩成短脚本再生成，不要直接朗诵长文；脚本里的字会逐字渲染到画面，中文必须正确；视频必须真实生成并用 ffprobe 验证（时长>0、1080×1920）后才写回，失败则如实 fail_task；不伪造视频/时长/分辨率。' },
    ],
    workflow: [],
  },
]

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export function parseActionConfig(serialized: string): ActionConfigFile {
  const parsed = actionConfigFileSchema.parse(JSON.parse(serialized))
  return {
    version: 1,
    updatedAt: parsed.updatedAt,
    actions: parsed.actions,
  }
}

function defaultFile(): ActionConfigFile {
  return {
    version: 1,
    actions: structuredClone(DEFAULT_ACTIONS),
  }
}

export class ActionConfigStore {
  private readonly filePath: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor(filePath = process.env.COWRITE_ACTION_CONFIG
    || path.join(process.env.COWRITE_HOME || path.join(process.env.HOME || '.', '.cowrite'), 'action-config.json')) {
    this.filePath = filePath
  }

  async load(): Promise<ActionConfigFile> {
    let serialized: string
    try {
      serialized = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) return defaultFile()
      throw error
    }
    try {
      return parseActionConfig(serialized)
    } catch {
      const backupFile = `${this.filePath}.corrupt-${Date.now()}-${randomUUID()}`
      try {
        await rename(this.filePath, backupFile)
      } catch (error) {
        if (!isMissingFile(error)) throw error
      }
      return defaultFile()
    }
  }

  async save(config: ActionConfigFile): Promise<ActionConfigFile> {
    const validated = parseActionConfig(JSON.stringify(config))
    validated.updatedAt = new Date().toISOString()
    const operation = this.writeChain.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(validated, null, 2), 'utf8')
    })
    this.writeChain = operation
    await operation
    return validated
  }

  async reset(): Promise<ActionConfigFile> {
    const fresh = defaultFile()
    return this.save(fresh)
  }

  async skillsFor(actionId: string): Promise<string[]> {
    const config = await this.load()
    return config.actions.find((action) => action.id === actionId)?.skills ?? []
  }

  async actionById(actionId: string): Promise<ActionConfig | undefined> {
    const config = await this.load()
    return config.actions.find((action) => action.id === actionId)
  }
}
