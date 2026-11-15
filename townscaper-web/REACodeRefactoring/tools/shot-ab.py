#!/usr/bin/env python3
"""一次加载页面，按顺序跑多个变体（开/关对比），每个变体截一张图 + 求值一次度量，收集控制台 error/warn。
用法: python3 shot-ab.py <url> <out-prefix> [--wait ms] [--setup 'js'] [--variant name='js'] ... [--after ms] [--eval 'js'] [--size WxH] [--clip x,y,w,h]
输出 <out-prefix>-<name>.png；stdout 一行 JSON：{variants:{name:eval}, logs:[...]}。服务器需在同一条 bash 里先起。"""
import sys, json, argparse, os
os.environ['LD_LIBRARY_PATH'] = os.path.expanduser('~/deblib/usr/lib/aarch64-linux-gnu') + ':' + os.environ.get('LD_LIBRARY_PATH', '')
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('url'); ap.add_argument('out'); ap.add_argument('--wait', type=int, default=8000)
ap.add_argument('--setup', default=None); ap.add_argument('--variant', action='append', default=[]); ap.add_argument('--after', type=int, default=3000)
ap.add_argument('--eval', default=None); ap.add_argument('--size', default='1280x800'); ap.add_argument('--clip', default=None); a = ap.parse_args()
W, H = map(int, a.size.split('x'))
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H}); logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'[:600]))
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'[:800]))
    pg.goto(a.url, wait_until='load', timeout=120000); pg.wait_for_timeout(a.wait)
    if a.setup:
        try: pg.evaluate(a.setup)
        except Exception as e: logs.append(f'[setup-error] {e}'[:600])
        pg.wait_for_timeout(1500)
    out = {}
    clip = None
    if a.clip: x, y, w, h = map(int, a.clip.split(',')); clip = {'x': x, 'y': y, 'width': w, 'height': h}
    for v in a.variant:
        name, js = v.split('=', 1)
        try: pg.evaluate(js)
        except Exception as e: logs.append(f'[variant-error {name}] {e}'[:600])
        pg.wait_for_timeout(a.after)
        res = None
        if a.eval:
            try: res = pg.evaluate(a.eval)
            except Exception as e: res = f'EVAL ERROR {e}'
        out[name] = res
        pg.screenshot(path=f'{a.out}-{name}.png', clip=clip)
    errs = [l for l in logs if ('error' in l.lower() or 'warn' in l.lower()) and 'toNonIndexed' not in l]
    print(json.dumps({'variants': out, 'logs': errs[:40], 'nlogs': len(logs)}, ensure_ascii=False, default=str)[:12000])
    b.close()
