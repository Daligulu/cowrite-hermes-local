// 遍历 Cowrite 各视图截图（现状基线 / 全页面 UI 体检用）
// cdp-verify.js 只能截一页；本脚本点击侧边栏 .sidebar-tool 按 label 切换全部视图后逐张截图。
// 用法: node shot-all-views.js <entry-url> <outdir> [width] [height]
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const entry = process.argv[2] || 'http://127.0.0.1:4320/';
const outdir = process.argv[3] || '/tmp/cowrite-shots';
fs.mkdirSync(outdir, { recursive: true });
const width = Number(process.argv[4] || 1280);
const height = Number(process.argv[5] || 900);
const port = 9600 + Math.floor(Math.random() * 200);
const chromePath = '/usr/bin/google-chrome';

(async () => {
  const chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + port,
    '--user-data-dir=/tmp/chrome-shot-' + Date.now(), 'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json');
      const list = await res.json();
      target = list.find((t) => t.type === 'page') || list[0];
      if (target) break;
    } catch {}
    await sleep(250);
  }
  if (!target) { chrome.kill(); throw new Error('no CDP target'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id; pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  await new Promise((r) => { ws.onopen = r; });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: entry });
  await sleep(6000);

  const ev = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(outdir, name + '.png');
    fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
    console.log('SHOT=' + file);
  };

  for (let i = 0; i < 20; i++) {
    const ok = await ev(`!!document.querySelector('.home-workspace') || !!document.querySelector('.sidebar')`);
    if (ok) break; await sleep(400);
  }
  await shot('00-current');

  const nav = [
    ['01-home', '首页'],
    ['02-project', '项目'],
    ['03-skill', 'Skill 管理'],
    ['04-action-config', '动作配置'],
    ['05-tasks', '任务中心'],
  ];
  for (const [name, label] of nav) {
    const clicked = await ev(`(() => {
      const btns = [...document.querySelectorAll('.sidebar-tool')];
      const b = btns.find(x => x.querySelector('.sidebar-tool-label')?.textContent.trim() === ${JSON.stringify(label)});
      if (b) { b.click(); return true; }
      return false;
    })()`);
    await sleep(2500);
    await shot(name);
  }

  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
