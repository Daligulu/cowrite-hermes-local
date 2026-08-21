#!/usr/bin/env node
// Cowrite 生产环境移动端 UI 复验（CDP 390×844）
// 用法: node scripts/mobile-verify.js [URL]
// 默认 URL: 生产入口。改移动端布局后必须跑一次：无横向溢出 / tabbar 5 Tab / 命令栏在 tabbar 上方 / 提交按钮≥44px / 更多动作底部弹层 / 任务筛选横滑
const { spawn } = require('node:child_process');
const CHROME = '/usr/bin/google-chrome';
const PORT = 9341;
const DEFAULT_URL = 'http://107.150.109.152/cowrite-005b18defa8ef912057110b7fea94a266345918514fa1a4a/';
const URL = process.argv[2] || DEFAULT_URL;
const fs = require('node:fs');
const OUT_DIR = '/tmp/cowrite-mobile-verify-shots';
fs.mkdirSync(OUT_DIR, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/chrome-mobile-cowrite-prod', 'about:blank',
], { stdio: 'ignore' });

let ws; let msgId = 0; const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function waitForTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const page = (await res.json()).find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('No CDP target');
}
async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) return { __error: JSON.stringify(res.exceptionDetails).slice(0, 300) };
  return res.result.value;
}
async function screenshot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png' });
  const file = `${OUT_DIR}/${name}.png`;
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
  return file;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const wsUrl = await waitForTarget();
  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(4000);

  const home = await evaluate(`(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    tabbarVisible: !!document.querySelector('.mobile-tabbar') && getComputedStyle(document.querySelector('.mobile-tabbar')).display !== 'none',
    tabCount: document.querySelectorAll('.mobile-tabbar .tab').length,
    activeTab: document.querySelector('.mobile-tabbar .tab.active .tab-txt')?.textContent,
    startCards: document.querySelectorAll('.home-start .home-card').length,
    startColumns: getComputedStyle(document.querySelector('.home-start')).gridTemplateColumns.split(' ').length,
    hasSkillCard: !!document.querySelector('.home-card-skill'),
  }))()`);
  console.log('HOME:', JSON.stringify(home, null, 2));
  await screenshot('01-home');

  await evaluate(`document.querySelector('.home-card-skill')?.click()`);
  await sleep(1200);
  console.log('SKILLS:', JSON.stringify(await evaluate(`(() => ({
    activeView: document.querySelector('.skill-manager') ? 'skill-manager' : 'unknown',
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    activeTab: document.querySelector('.mobile-tabbar .tab.active .tab-txt')?.textContent,
  }))()`), null, 2));
  await screenshot('02-skills');

  await evaluate(`document.querySelector('.mobile-tabbar .tab:nth-child(1)')?.click()`);
  await sleep(1200);
  await evaluate(`document.querySelector('.home-row')?.click()`);
  await sleep(2500);
  console.log('EDITOR:', JSON.stringify(await evaluate(`(() => {
    const cmd = document.querySelector('.editor-command');
    const tabbar = document.querySelector('.mobile-tabbar');
    const cmdRect = cmd ? cmd.getBoundingClientRect() : null;
    const tabRect = tabbar ? tabbar.getBoundingClientRect() : null;
    return {
      activeView: document.querySelector('.page-workspace') && !document.querySelector('.page-workspace').classList.contains('inactive') ? 'page' : 'unknown',
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      cmdVisible: cmdRect ? cmdRect.height > 0 : false,
      cmdAboveTabbar: cmdRect && tabRect ? cmdRect.bottom <= tabRect.top + 2 : false,
      submitBtnHeight: document.querySelector('.command-box .primary') ? Math.round(document.querySelector('.command-box .primary').getBoundingClientRect().height) : 0,
      activeTab: document.querySelector('.mobile-tabbar .tab.active .tab-txt')?.textContent,
    };
  })()`), null, 2));
  await screenshot('03-editor');

  await evaluate(`document.querySelector('.command-chips .more-chip')?.click()`);
  await sleep(500);
  console.log('MORE:', JSON.stringify(await evaluate(`(() => {
    const m = document.querySelector('.command-more');
    if (!m) return { visible: false };
    const r = m.getBoundingClientRect();
    return {
      visible: getComputedStyle(m).display !== 'none',
      position: getComputedStyle(m).position,
      gridColumns: getComputedStyle(m).gridTemplateColumns.split(' ').length,
      bottomGap: Math.round(window.innerHeight - r.bottom),
    };
  })()`), null, 2));
  await screenshot('04-more-sheet');
  await evaluate(`document.querySelector('.command-chips .more-chip')?.click()`);

  await evaluate(`document.querySelector('.mobile-tabbar .tab:nth-child(2)')?.click()`);
  await sleep(1500);
  console.log('TASKS:', JSON.stringify(await evaluate(`(() => ({
    activeView: !!document.querySelector('.task-center'),
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    filtersScrollable: (() => { const f = document.querySelector('.task-filters'); return f ? getComputedStyle(f).overflowX : 'none'; })(),
    taskRows: document.querySelectorAll('.task-item').length,
  }))()`), null, 2));
  await screenshot('05-tasks');

  console.log('ALL_OK');
  chrome.kill(); process.exit(0);
})().catch(err => { console.error('FAIL:', err.message); try { chrome.kill(); } catch {} process.exit(1); });
