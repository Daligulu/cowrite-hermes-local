#!/usr/bin/env python3
from __future__ import annotations
import os,re,signal,subprocess,sys
from pathlib import Path
URL_RE=re.compile(r'https://[a-z0-9-]+\.trycloudflare\.com')
PUBLIC_PATH=Path('/root/.cowrite/public-path').read_text().strip()
URL_FILE=Path('/root/.cowrite/current-public-url')
child=None
def stop(signum,_frame):
    if child and child.poll() is None: child.send_signal(signum)
def main():
    global child
    signal.signal(signal.SIGTERM,stop); signal.signal(signal.SIGINT,stop)
    child=subprocess.Popen(['/usr/local/bin/cloudflared','tunnel','--no-autoupdate','--url','http://127.0.0.1:80','--http-host-header','107.150.109.152','--loglevel','info'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
    assert child.stdout
    for line in child.stdout:
        sys.stdout.write(line); sys.stdout.flush()
        m=URL_RE.search(line)
        if m:
            url=f'{m.group(0)}/{PUBLIC_PATH}/'
            tmp=URL_FILE.with_suffix('.tmp'); tmp.write_text(url+'\n'); os.chmod(tmp,0o600); os.replace(tmp,URL_FILE)
            print(f'Cowrite HTTPS URL configured: {url}',flush=True)
    return child.wait()
if __name__=='__main__': raise SystemExit(main())
