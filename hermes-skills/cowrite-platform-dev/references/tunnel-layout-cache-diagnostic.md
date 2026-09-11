# 隧道层缓存诊断（区分「服务端真没改」vs「隧道/WebView 缓存」）

背景：用户报「Cowrite 页面是旧版 / 点开像没更新 / 内容空」时，先判断到底是**服务端没部署成功**，还是**用户端（隧道/飞书 WebView）缓存了旧 bundle**。两者处理完全不同。

## 核心判断：对比「主入口」与「隧道」两个 URL 的 Cache-Control
同一个资源分别 curl 两个入口，看头：
```bash
# 主入口（107 IP，直接走 nginx）——应返回纯净 no-store
curl -sI "http://107.150.109.152/cowrite-000.../index.html" | grep -i "^cache-control"
# → Cache-Control: no-store        （期望值）

# 隧道（Cloudflare 临时隧道 URL）——edge 层会追加/合并
curl -sI "https://<隧道>.trycloudflare.com/cowrite-000.../index.html" | grep -i "^cache-control"
# → cache-control: private, max-age=0, no-store, no-cache, must-revalidate, post-check=0, pre-check=0
```

## 结论怎么读
- **主入口 = `Cache-Control: no-store`（唯一）** → nginx 的 `proxy_hide_header Cache-Control;` + `add_header Cache-Control "no-store" always;` 生效，服务端确实是最新版。
- **隧道 = 多值合并头或含 `private,max-age=0`** → Cloudflare Tunnel 边缘（cloudflared 出口）会把 Express 默认缓存头与 no-store **合并**成一行多值。飞书 WebView / Safari 解析多值头时**只认第一个**（`private,max-age=0` → 允许缓存、可 304），于是**绕过了 no-store** → 用户仍看到旧 bundle。

## 推论与行动
- 隧道 URL 缓存**不归 nginx 管**：nginx 配置已经对了（主入口验证），但隧道边缘会再改写/合并。所以「主入口干净」≠「隧道也干净」。
- **不要据此断言「部署失败 / 回滚」**。要确认服务端是最新版，只用主入口 + `/api/health` + dist JS hash（与 `/opt/cowrite-hermes/dist` 一致）判断。
- 用户端处理：让用户「关掉页面彻底重开」「手机自带浏览器打开（不走飞书 WebView）」「清 WebView 缓存」；或提供主入口链接（能直连 IP 时）。

## 隧道 URL 会漂移
Cloudflare 临时隧道每次重启换域名（用户访问旧 URL 报 Error 1033）。取最新：
```bash
journalctl -u cowrite-hermes-tunnel.service | grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" | tail -1
cat /root/.cowrite/current-public-url
```
隧道 cloudflared 实际用 `--url http://127.0.0.1:80 --http-host-header 107.150.109.152`（走本机 nginx 80），但边缘仍会合并缓存头。

## 与「空态」排查的分工
- 若 `curl /api/pages/<id>` 确认正文在、主入口渲染正常 → 不是服务端问题，是隧道/WebView 缓存（本条）。
- 若正文不在 / 任务未 succeeded → 是「内容生成中 / 空态自愈」，见 SKILL.md 里「点开文章显示『没有页面。』空态」陷阱。
