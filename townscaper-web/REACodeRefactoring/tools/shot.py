#!/usr/bin/env python3
"""headless Chromium(SwiftShader WebGL) 截图 + 控制台错误 + 可选 JS 求值。
用法: python3 shot.py <url> <out.png> [--wait ms] [--eval 'js expr'] [--size 1280x800]
先: export LD_LIBRARY_PATH=~/deblib/usr/lib/aarch64-linux-gnu ; 服务器: cd REACodeRefactoring && python3 -m http.server 8790 &(同一条 bash 内)"""
import sys, json, argparse, os
os.environ['LD_LIBRARY_PATH'] = os.path.expanduser('~/deblib/usr/lib/aarch64-linux-gnu') + ':' + os.environ.get('LD_LIBRARY_PATH', '')
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('url'); ap.add_argument('out'); ap.add_argument('--wait', type=int, default=4000)
ap.add_argument('--eval', default=None); ap.add_argument('--size', default='1280x800'); a = ap.parse_args()
W, H = map(int, a.size.split('x'))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H}); logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'[:400]))
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'[:600]))
    pg.goto(a.url, wait_until='load', timeout=90000); pg.wait_for_timeout(a.wait)
    res = None
    if a.eval:
        try: res = pg.evaluate(a.eval)
        except Exception as e: res = f'EVAL ERROR {e}'
        pg.wait_for_timeout(500)
    pg.screenshot(path=a.out)
    print(json.dumps({'eval': res, 'logs': [l for l in logs if 'error' in l.lower() or 'warn' in l.lower()][:40], 'nlogs': len(logs)}, ensure_ascii=False, default=str)[:6000])
    b.close()
