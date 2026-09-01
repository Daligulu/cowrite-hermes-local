# Cowrite 入口链接：实时核对与给用户可点链接

用户要「可在飞书对话打开的 Cowrite 平台链接」时，**不能凭记忆/旧值直接回复**——隧道 URL 每次重启都变（旧域名为 `trycloudflare.com` 随机子域），且旧隧道会失效。`journalctl | grep trycloudflare` 会返回**多次重启的历史 URL 混在一起**，其中大部分已死。**唯一可靠做法：逐条 curl 验证，只给返回真实 Cowrite 页面的那一条。**

## 快速核对命令（实测模板）

```bash
SUB="cowrite-005b18defa8ef912057110b7fea94a266345918514fa1a4a"   # 高熵子路径，固定

echo "=== 服务状态 ==="
systemctl is-active cowrite-hermes-tunnel.service   # 期望 active
systemctl is-active cowrite-hermes.service          # 期望 active
curl -fsS -m 5 http://127.0.0.1:4320/api/health     # 期望 {"ok":true,...} —— 本地服务活着

echo "=== 候选隧道 URL（含历史，需逐个验证）==="
journalctl -u cowrite-hermes-tunnel.service -n 200 --no-pager 2>/dev/null \
  | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -5

echo "=== 逐个验证（HTTP 200 + 标题= Cowrite 才算真页面）==="
for url in $(journalctl -u cowrite-hermes-tunnel.service -n 200 --no-pager 2>/dev/null \
  | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | sort -u); do
  code=$(curl -sk -m 8 -o /dev/null -w "%{http_code}" "$url/$SUB/")
  title=$(curl -sk -m 8 "$url/$SUB/" 2>/dev/null | grep -oiE '<title>[^<]*</title>' | head -1)
  echo "$code  $title  $url"
done
```

## 判定标准（务必三条全满足才算「可点开」）

1. **HTTP 200**（非 000/404；`000` = 隧道已失效）。`curl -sk -m 8 -o /dev/null -w "%{http_code}" "<url>/<SUB>/"`
2. **标题是 `Cowrite`**，即返回真实 SPA 页面（含 `id="root"` + `index-*.js`）。**注意**：不带子路径的根路径会返回 nginx 默认页（`HTTP Server Test Page`），所以**必须拼上高熵子路径** `<SUB>/`。
3. 本地健康 `{"ok":true}`（保证后端活着）。

## 主入口 vs 隧道

- **主入口** `http://107.150.109.152/cowrite-<SUB>/`：2026-08 起实测返回 200 真实页面（此前被云安全组拦 80 端口，现已放行）。**是 HTTP 明文 + 裸 IP**——飞书内置 WebView 可能提示「不安全/不是私密连接」，需用户点「继续访问」才能进。适合做「备用」。
- **隧道入口** `https://<域>.trycloudflare.com/cowrite-<SUB>/`：HTTPS，飞书内打开最稳，**选为首选**。但每次重启域名变、旧域名 000 失效。
- 给用户时**给两条**：首选 HTTPS 隧道 + 备用主入口，并提醒「旧链接不用了，隧道域名重启会变」。

## 经验与坑

- 旧隧道（如本会话 `session-passion-connection-physically`）会返回 HTTP 000，直接判「失效」，**不要给用户**。当前存活的那条才是对的。
- 曾出现两个 cloudflared 进程（`--url http://localhost:3788` 旧进程 vs `cowrite-cloudflared.py` 新进程）并存的情况：以 `systemctl` 的 tunnel.service 为准，`journalctl` 的 URL 列表里同域名的旧条目忽略。
- 飞书 WebView 可能缓存旧版 JS（`index-<老hash>.js`），表现为「看起来还是旧 UI」——这是缓存不是部署失败，先 `curl` 核对 nginx 返回的新 JS hash 与 `/opt/cowrite-hermes/dist` 一致，再让用户关页面重开/用手机自带浏览器。
