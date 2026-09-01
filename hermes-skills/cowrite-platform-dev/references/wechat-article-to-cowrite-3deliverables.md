# 微信文章 → 贴图 / 微头条 / 头条文章 三件套直建 Cowrite 草稿页

用户经常给一篇微信文章（mp.weixin.qq.com/s/...）或 X 推文，要求「分析 → 搜索文中相关内容 → 生成 公众号贴图 + 微头条 + 头条文章 → 放到 cowrite 平台」。本文是完整可复现链路（2026-09-01 实操验证）。

## 触发判断：怎么「放到 cowrite 平台」
用户说「放到 cowrite 平台」且三样都要可编辑草稿时，**优先直接建页**，而不是依赖 Worker 任务：

- **wechat-sticker / toutiao-micro-draft / toutiao-article-draft** 这些 Worker 动作会把微头条/头条**投递到 Memos 信箱 `@openminis`**（手机端 OpenMinis 建草稿），且贴图还要弹风格窗/账号——中间环节多、用户要的是「在 Cowrite 里能看到并改」。
- 如果用户明确要「发到公众号草稿箱 / 手机建草稿」，才走 Worker 动作队列。
- **本会话选型**：`mcp__cowrite__cowrite_create_page` 直接建 3 页 + `cowrite_upload_asset` 传图，revision 1 草稿，用户直接在 Cowrite 编辑页改。这也符合用户「先审后写、只写草稿」的长期偏好。

## 完整链路
1. **抓文章**：`web_extract` 直抓 mp.weixin.qq.com/s/...（可出标题+正文，无需 browser）。正文`content`字段就是纯文本素材。
2. **建 todo**：分析 → 搜事实 → 生贴图 → 微头条 → 头条 → 放平台，6 步，每步可验证。
3. **搜事实**：中文金融/公司动态（股价/ARR/市值）+ 海外技术（fal/Pieter Levels）分开查。`web_search` 复用，一次并行发 4 个 query。
4. **生贴图**：`image_generate` aspect_ratio=`portrait`（3:4 竖版），默认风格「日系清新」（低饱和、奶白背景、淡蓝淡绿点缀、留白充足供排版）。prompt 明确「画面不要出现任何文字，顶部/底部留大片空白」。产出后 `vision_analyze` 检查有无意外文字/瑕疵、是否贴图气质。本会话主题意象：发光河流/光带 + 视频播放按钮 + 秒表（速度跑赢播放）。
5. **传图到 Cowrite**：先复制到**服务可达路径** `/root/.cowrite/worker-assets/`（生产 systemd 开 PrivateTmp，`/tmp` 宿主与服务不同 namespace，见主 SKILL Pitfalls），再 `cowrite_upload_asset` → 返回 `/assets/<hash>.jpg`。
6. **建 3 页**：`cowrite_create_page(title, content, prompt=brief)` 一次写完整 Markdown。贴图页 content 开头 `![说明](/assets/<hash>.jpg)`。prompt 里塞创作 brief + 已核实事实清单（见下）。
7. **验证**：`curl -sI http://127.0.0.1:4320/assets/<hash>.jpg` 期望 200（非 text/html）；`curl -s -o /dev/null -w "%{http_code}" <主入口>` 期望 200。create_page 返回即含完整 content + revision，工具已自证写回。

## 事实核实：多来源口径去重（强烈建议做）
文中一句话常跨「官方/第三方/媒体」三种口径，**别照抄一个数字**，同事实多来源比对后写最稳妥表述：

- 吞吐倍数：fal 官方博客称约 **35x**（对 MiniMax 官方 H3 端点）；Design Arena 独立测评称 **>50x** → 正文写「fal 官方 35x（第三方称 50x）」，两口径并列，不混用。
- 股价涨幅：8/31 盘中**涨超 19%**（多方一致）；收盘口径不同源 = 15.58%（21财经，347.20 港元）/ 16.18%（新浪，349 港元，市值1219亿）→ 写「盘中涨超 19%、收盘约 16%」即可，别硬凑精确值。
- 15 秒时长：早前口径「15秒约9秒」vs 财联社「15秒约需15秒」——取官方/多来源共识的「5秒768P<3秒」为主，15 秒带模糊量词。
- 来源链：MiniMax 官方 / fal blog / Design Arena / Artificial Analysis / 新浪财经 / 21财经 / 财联社，写进 prompt 与页尾参考。

## 交付（飞书）
- 结论优先短要点；三个页标题 + Cowrite 主入口用 **markdown 链接**直接可点（用户要求链接必须能点开，勿放代码块/反引号）。
- 贴图给 `MEDIA:/root/.cowrite/worker-assets/<file>.jpg` 内联预览。
- 明确写「三页均为 revision 1 草稿、未发布、未群发；确认后我可再排版进公众号/投递草稿箱」。
- Cowrite 主入口：`http://107.150.109.152/cowrite-005b18defa8ef912057110b7fea94a266345918514fa1a4a/`（固定高熵子路径；隧道备用 URL 重启会变）。

## 坑
- 贴图若直接以 `/root/.hermes/cache/images/...` 上传会报 `Asset file was not found`，必须先 cp 到 `/root/.cowrite/worker-assets/`。
- `vision_analyze` 检查贴图后再进页面，避免「图里有乱文字/跑偏」返工。
- 建页前 `cowrite_list_pages` 看有无同标题，避免重名（本会话 36 页无冲突）。
