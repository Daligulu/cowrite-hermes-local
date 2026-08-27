// Cowrite 动效优化验收脚本（headless Chrome + CDP）
// 用途：动效优化落地后，复验侧边栏 transform、模态/选择器进场、reduced-motion、
//       强 ease-out 曲线、无横向溢出。可对本地(4320)或公网子路径入口跑。
// 用法：node motion-verify.js <url> [width] [height] [mobile]
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = process.argv[2] || 'http://127.0.0.1:4320/';
const width = Number(process.argv[3] || 390);
const height = Number(process.argv[4] || 844);
const mobile = (process.argv[5] || '1') === '1';
const port = 9500 + Math.floor(Math.random() * 100);
const chromePath = '/usr/bin/google-chrome';

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
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 3 : 2, mobile });
  await send('Page.navigate', { url });
  await sleep(6000);

  const ev = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

  // 1. 总览：无溢出 + 侧边栏 fixed/transform + reduced-motion + 强 ease-out 规则数
  const base = await ev(`(() => {
    const sb = document.querySelector('.sidebar');
    const cs = sb ? getComputedStyle(sb) : null;
    const reduce = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return [] } })
      .filter(r => r.conditionText && r.conditionText.includes('prefers-reduced-motion'));
    const bez = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return [] } })
      .filter(r => r.cssText && r.cssText.includes('0.23, 1, 0.32, 1'));
    return {
      loaded: !!document.querySelector('.shell'),
      overflowX: document.body.scrollWidth > document.body.clientWidth,
      sidebarExists: !!sb,
      sidebarPosition: cs ? cs.position : null,
      sidebarTransform: cs ? cs.transform : null,
      sidebarW: cs ? cs.width : null,
      reducedMotionBlocks: reduce.length,
      strongEaseOutRules: bez.length,
    };
  })()`);
  console.log('BASE=' + JSON.stringify(base));

  // 2. 桌面视口展开侧边栏 → 断言 transform 而非 width
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url });
  await sleep(5000);
  const sbOpen = await ev(`(async () => {
    const hamburger = document.querySelector('.icon-button');
    if (hamburger) hamburger.click();
    await new Promise(r => setTimeout(r, 400));
    const sb = document.querySelector('.sidebar');
    const cs = getComputedStyle(sb);
    return { sidebarTransform: cs.transform, sidebarW: cs.width, sidebarTransition: cs.transitionProperty };
  })()`);
  console.log('SIDEBAR_OPEN=' + JSON.stringify(sbOpen));

  // 3. 触发新建页 modal → 断言 modal-in 轻缩放进场
  const modal = await ev(`(async () => {
    const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.trim().includes('新建'));
    if (btns.length) btns[0].click();
    await new Promise(r => setTimeout(r, 300));
    const m = document.querySelector('.modal');
    const mask = document.querySelector('.modal-mask');
    return { modalExists: !!m, modalAnim: m ? getComputedStyle(m).animationName : null, maskAnim: mask ? getComputedStyle(mask).animationName : null };
  })()`);
  console.log('MODAL=' + JSON.stringify(modal));

  // 4. 首页 home-card 按压过渡（transition 含 transform）
  const card = await ev(`(() => {
    // 桌面视口回到首页再查：关闭 modal 后打开首页
    const c = document.querySelector('.home-card');
    if (!c) return { exists: false, cardCount: document.querySelectorAll('.home-card').length };
    return { exists: true, transition: getComputedStyle(c).transitionProperty, transform: getComputedStyle(c).transform };
  })()`);
  console.log('CARD=' + JSON.stringify(card));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = '/tmp/cowrite-motion-shot-' + Date.now() + '.png';
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('SHOT=' + file);

  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
