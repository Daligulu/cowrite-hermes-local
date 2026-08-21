// CDP 验收脚手架：headless Chrome + DevTools Protocol
// 用途：browser_vision 不可用 / browser_click 坐标漂移时，对本地 Web 应用做真实验收
// 用法：node cdp-verify.js <url> [width] [height] [mobile]
// 已内置：移动端视口模拟、DOM 断言、截图、多步 async IIFE 交互（内联字符串）
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = process.argv[2] || 'http://127.0.0.1:4320/';
const width = Number(process.argv[3] || 390);
const height = Number(process.argv[4] || 844);
const mobile = (process.argv[5] || '1') === '1';
const port = 9400 + Math.floor(Math.random() * 100);
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
  await sleep(5500);

  // 注意：多步交互脚本必须用内联 async IIFE 字符串（awaitPromise:true）。
  // 不要用模板字符串变量传脚本——会偶发返回空对象 {}。
  const ev = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

  // 示例断言：改写成你的用例
  const out = await ev(`(() => ({
    home: !!document.querySelector('.home-workspace'),
    overflowX: document.body.scrollWidth > document.body.clientWidth,
    viewport: innerWidth,
  }))()`);
  console.log('CHECK=' + JSON.stringify(out));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = '/tmp/cdp-shot-' + Date.now() + '.png';
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('SHOT=' + file);

  ws.close(); chrome.kill(); process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });

// 常用技巧备忘（写进脚本时直接用）：
// 1. React 受控 input 注入：
//    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
//    setter.call(input, '文字'); input.dispatchEvent(new Event('input', { bubbles: true }));
// 2. 状态轮询断言：await new Promise(r => setTimeout(r, N)) 后在 async IIFE 内继续
// 3. 每条用例独立 chrome 实例 + 独立 debug port，跑完 kill，避免端口冲突
