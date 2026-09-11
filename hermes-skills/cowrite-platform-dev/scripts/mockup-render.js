// 渲染 mockup HTML -> PNG（优化后样例图）
// 用法: node mockup-render.js <mockup-dir> <outdir>
// mockup-dir 内每个 .html 均 <link rel="stylesheet" href="base.css">，浏览器 file:// 打开渲染成 PNG。
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = process.argv[2] || '/tmp/cowrite-mockups';
const outdir = process.argv[3] || '/tmp/cowrite-mockups-png';
fs.mkdirSync(outdir, { recursive: true });
const port = 10200 + Math.floor(Math.random() * 150);
const chromePath = '/usr/bin/google-chrome';

(async () => {
  const chrome = spawn(chromePath, ['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir=/tmp/chrome-ren-'+Date.now(),'about:blank'], { stdio:'ignore' });
  let target=null;
  for (let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/json');const l=await r.json();target=l.find(t=>t.type==='page')||l[0];if(target)break;}catch{}await sleep(250);}
  if(!target){chrome.kill();throw new Error('no target');}
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  let id=0;const p=new Map();
  const send=(m,pa={})=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:pa}))});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m.result);p.delete(m.id)}};
  await new Promise(r=>{ws.onopen=r;});
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1320,height:900,deviceScaleFactor:2,mobile:false});

  const htmls = fs.readdirSync(dir).filter(f=>f.endsWith('.html')).sort();
  for (const f of htmls){
    const url = 'file://' + path.join(dir, f);
    await send('Page.navigate',{url}); await sleep(1300);
    const h = await (await send('Runtime.evaluate',{expression:'Math.min(2000, Math.max(document.querySelector(".frame")?.offsetHeight||900, 900))',returnByValue:true})).result?.value;
    await send('Emulation.setDeviceMetricsOverride',{width:1320,height:Math.max(parseInt(h),900),deviceScaleFactor:2,mobile:false});
    await sleep(400);
    const s=await send('Page.captureScreenshot',{format:'png'});
    const name=f.replace('.html','.png');
    fs.writeFileSync(path.join(outdir,name),Buffer.from(s.data,'base64'));
    console.log('RENDER='+path.join(outdir,name));
  }
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
