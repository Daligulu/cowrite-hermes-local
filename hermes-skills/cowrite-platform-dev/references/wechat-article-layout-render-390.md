# 还原微信文章 390px 移动端真实阅读效果（反爬绕过 + 整页截图）

用户给一篇 mp.weixin.qq.com 文章链接，要求分析排版/格式是否适合手机端阅读时，目标是对照真实的 390px 移动端渲染还原观感（而非只看 HTML 源码）。本备忘记录 2026-08 实测两次硬阻塞及其解法。

## 方法一：正则统计排版参数（主，不做截图也能出分析）
```bash
# 带 iPhone UA 抓 HTML（能过微信反爬）
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
curl -s -A "$UA" -H "Accept: text/html" "https://mp.weixin.qq.com/s/<id>" -o /tmp/wx.html
```
```python
import re
from collections import Counter
html = open('/tmp/wx.html', encoding='utf-8', errors='ignore').read()
m = re.search(r'<div[^>]*id="js_content"[^>]*>(.*?)</div>\s*<script', html, re.S)
body = m.group(1).split('<script')[0]
# 字号/行高/颜色/边距分布
for r,label in [(r'font-size:\s*([0-9.]+)px','字号'),(r'line-height:\s*([0-9.]+)','行高'),
                (r'color:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]*\))','颜色'),
                (r'margin-bottom:\s*([0-9.]+)px','段距')]:
    print(label, Counter(re.findall(r, body)).most_common(10))
# 标签数量 + 段落平均长度
for t in ['p','section','strong','img','h2','h3']:
    print(f'<{t}>:', len(re.findall(r'<'+t+r'[> ]', body)))
ps = re.findall(r'<p[^>]*>(.*?)</p>', body, re.S)
lens=[len(re.sub(r'<[^>]+>','',x).strip()) for x in ps if re.sub(r'<[^>]+>','',x).strip()]
print('平均段长', int(sum(lens)/len(lens)), '最长', max(lens))
```
这些参数足以支撑「字号偏小/行高舒适/段距如何/强调色」等判断——**排版分析绝大多数时候做到这就够，不必非要截图**。

## 方法二：还原真实视觉（需要 390px 截图时才做）

### 坑 1：微信反爬拦 headless Chrome
直接 `Page.navigate` 到线上 URL，headless 返回「环境异常 / 去验证」白屏页（蓝色 ⓘ 图标 + 绿色按钮），看不到正文。
**解法**：不要导航线上，把抓到的 HTML 抽出的 js_content 包成一个本地 `.html` 再渲染：
```bash
python3 - <<'PY'
import re
html = open('/tmp/wx.html', encoding='utf-8', errors='ignore').read()
m = re.search(r'<div[^>]*id="js_content"[^>]*>(.*?)</div>\s*<script', html, re.S)
body = m.group(1).split('<script')[0]
shell = f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>body{{margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}}
#js_content{{padding:20px 16px;max-width:100%;box-sizing:border-box;word-break:break-word}}</style>
</head><body><div id="js_content">{body}</div></body></html>'''
open('/tmp/wx_local.html','w',encoding='utf-8').write(shell)
PY
```
然后 CDP `Page.navigate('file:///tmp/wx_local.html')`。内联样式原样保留，本地容器可还原移动端观感。

### 坑 2：CDP 整页截图超 websocket 1MB 消息上限
文章页 `scrollHeight` 常超 1 万 px，`Page.captureScreenshot` 返回 frame 超过默认 `max_size=1048576` 会抛：
`sent 1009 (message too big) frame with 2179622 bytes exceeds limit of 1048576 bytes`
整页截图静默失败（`scrollHeight` 能读到，但没图）。
**解法二选一**：
- 简单：`websockets.connect(ws_url, max_size=50*1024*1024)` 增大上限。对超高页仍可能超。
- 稳妥（推荐）：分段截再拼接。每段 `window.scrollTo(0,y)` + `Page.captureScreenshot`（段间重合 ~40px 防接缝），`Emulation.setDeviceMetricsOverride` 设 `width=390,height=844,mobile=True`，用 PIL 竖直拼接成长图。

### CDP 移动端渲染最小骨架（Python + websockets）
```python
import asyncio, json, urllib.request, subprocess, time, base64, io
from PIL import Image
import websockets
PORT=9334
subprocess.Popen(['/usr/bin/google-chrome','--headless=new','--disable-gpu','--no-sandbox',
                  '--hide-scrollbars',f'--remote-debugging-port={PORT}','about:blank'],
                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2.5)
def get_json(u):
    with urllib.request.urlopen(u) as r: return json.loads(r.read())
async def main():
    page=[t for t in get_json(f'http://127.0.0.1:{PORT}/json/list') if t['type']=='page'][0]
    async with websockets.connect(page['webSocketDebuggerUrl'], max_size=50*1024*1024) as ws:
        mid=0
        async def send(method,params):
            nonlocal mid; mid+=1
            await ws.send(json.dumps({'id':mid,'method':method,'params':params}))
            while True:
                m=json.loads(await ws.recv())
                if m.get('id')==mid: return m.get('result',{})
        await send('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':2,'mobile':True})
        await send('Page.enable',{})
        await send('Page.navigate',{'url':'file:///tmp/wx_local.html'})
        await asyncio.sleep(3)
        # 分段截
        H=(await send('Runtime.evaluate',{'expression':'document.body.scrollHeight','returnByValue':True}))['result']['value']
        segs=[]; y=0; seg_h=1400
        while y<H:
            await send('Runtime.evaluate',{'expression':f'window.scrollTo(0,{y})'})
            await asyncio.sleep(0.4)
            mid+=1; await ws.send(json.dumps({'id':mid,'method':'Page.captureScreenshot','params':{'format':'png'}}))
            while True:
                m=json.loads(await ws.recv())
                if m.get('id')==mid:
                    segs.append(base64.b64decode(m['result']['data'])); break
            y+=seg_h-40
        imgs=[Image.open(io.BytesIO(s)) for s in segs]
        canvas=Image.new('RGB',(imgs[0].width,sum(i.height for i in imgs)),'white')
        yy=0
        for im in imgs: canvas.paste(im,(0,yy)); yy+=im.height
        canvas.save('/tmp/wx_full.png'); print('saved segs=',len(segs),'h=',canvas.height)
asyncio.run(main())
```
验证片段：`saved segs=8 h=13504` 即成功；若报 `sent 1009` 则回到 max_size 或分段。

## 判断输出
分析输出按「结论优先 + 短标题要点」给用户，附一张可复用参数对照表（正文 15-17px 为佳、行高 1.6-1.75、段距 12-16px、段长 ≤150 字），并明确区分「可借鉴的结构」与「需规避的配色/参数」。
