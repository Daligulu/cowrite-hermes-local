// Cowrite 各视图当前状态基线截图（桌面视口）
// 连本地生产 http://127.0.0.1:4320/ ，点击侧边栏导航逐视图截图
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = process.argv[2] || 'http://127.0.0.1:4320/';
const width = Number(process.argv[3] || 1280);
const height = Number(process.argv[4] || 900);
const outdir = process.argv[5] || '/tmp/cowrite-audit';
const port = 9500 + Math.floor(Math.random() * 100);
const chromePath = '/usr/bin/google-chrome';

if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

(async () => {
  const chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + port,
    '--user-data-dir=/tmp/chrome-cdp-' + Date.now(), 'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json');
      const list = await res.json();
      target = list.find((t) => t.type === 'page') || list[0];
      if (target) break;
    } catch { }
    await sleep(250);
  }
  if (!target) { chrome.kill(); throw new Error('no CDP target'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id; pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  await new Promise((r) => { ws.onopen = r; });

  await send('Page.enable');
  // 桌面视口，非移动
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url });
  await sleep(6000);

  const ev = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

  const shot = async (file) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const p = outdir + '/' + file;
    fs.writeFileSync(p, Buffer.from(s.data, 'base64'));
    console.log('SHOT=' + p);
  };

  // 视图列表：index -> 名称。sidebar-tool 顺序 (home,project,skill-manager,action-config,tasks)
  const shotLabel = async (file) => {
    const info = await ev(`(() => {
      const tools = [...document.querySelectorAll('.sidebar-tool')];
      const active = tools.find(t => t.getAttribute('aria-current') === 'page');
      const activeText = active ? active.textContent.trim() : 'none';
      const h = document.querySelector('.home-head-text h1, .task-center-head h2, .skill-manager h2, .action-config h2, .project-workspace h2, .topic-confirm-title');
      return { activeText, heading: h ? h.textContent.trim() : '' };
    })()`);
    console.log('VIEW=' + JSON.stringify(info) + ' -> ' + file);
  };

  // 首页
  await shot('01-home.png');
  await shotLabel('01-home.png');

  const clickTool = async (idx, wait = 2500) => {
    const ok = await ev(`(() => {
      const t = document.querySelectorAll('.sidebar-tool')[${idx}];
      if (!t) return false; t.click(); return true;
    })()`);
    if (!ok) console.log('tool index ' + idx + ' not found');
    await sleep(wait);
  };

  // 2=skill-manager, 3=action-config, 4=tasks
  await clickTool(2); await shot('02-skill-manager.png'); await shotLabel('02-skill-manager.png');
  await clickTool(3); await shot('03-action-config.png'); await shotLabel('03-action-config.png');
  await clickTool(4); await shot('04-tasks.png'); await shotLabel('04-tasks.png');

  // 打开一个页面（点第一个 home-row 进入编辑页）；先回首页
  await clickTool(0, 1500);
  const opened = await ev(`(() => {
    const row = document.querySelector('.home-row');
    if (!row) return false; row.click(); return true;
  })()`);
  await sleep(3500);
  await shot('05-editor.png');
  await shotLabel('05-editor.png');

  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
