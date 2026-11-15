#!/usr/bin/env python3
"""r55 splice 编辑器浏览器验收（1584623053061099520）：index.html?scene=terrain&tool=splice，
真实鼠标点裸露岩顶嵌入房子 → 截图；Z 撤销全部 → 截图；Y 重做 → 地址栏存档 → 新页面读档 → 截图。
用法: python3 tests/splice-editor-browser.py <port> <outdir>"""
import sys, json, os
os.environ['LD_LIBRARY_PATH'] = os.path.expanduser('~/deblib/usr/lib/aarch64-linux-gnu') + ':' + os.environ.get('LD_LIBRARY_PATH', '')
from playwright.sync_api import sync_playwright
port, out = sys.argv[1], sys.argv[2]
base = f'http://localhost:{port}/index.html?scene=terrain&tool=splice'
FIND = """() => { const v = rea.view, w = rea.world, c = document.getElementById('view'), r = c.getBoundingClientRect(), seen = new Set(), pts = [];
  for (let y = 0.30; y <= 0.75; y += 0.03) for (let x = 0.25; x <= 0.70; x += 0.025) {
    const hit = v.pick(x * 2 - 1, -(y * 2 - 1)); if (!hit) continue; const cell = hit.cell, g = w.ground(cell);
    if (seen.has(cell.id) || g < 2 || w.river[cell.id] || !w.isRock(cell, g) || w.isSolid(cell, g + 1)) continue;
    if (hit.level && hit.level !== g + 1 && hit.level !== g) continue;
    if ([...seen].some(id => { const o = w.cells[id]; return Math.hypot(o.cx - cell.cx, o.cz - cell.cz) < 1.6; })) continue;
    seen.add(cell.id); pts.push([r.left + x * r.width, r.top + y * r.height, cell.id]); }
  return pts.slice(0, 14); }"""
STATE = "() => ({ houses: rea.world.splicedHouses ? [...rea.world.splicedHouses.keys()].sort((a,b)=>a-b) : [], hash: location.hash.length, verts: rea.view.worldMesh?.geometry?.attributes?.position?.count ?? null, undoDisabled: document.getElementById('undo').disabled })"
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    logs = []
    def page():
        pg = b.new_page(viewport={'width': 1280, 'height': 800})
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'[:300]))
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'[:500]))
        return pg
    pg = page(); pg.goto(base, wait_until='load', timeout=90000); pg.wait_for_timeout(9000)
    pg.evaluate("() => { rea.view.distance *= 0.62; rea.view.updateCamera(); }"); pg.wait_for_timeout(2500)
    res['off'] = pg.evaluate(STATE)
    pg.screenshot(path=f'{out}/g4b-splice-before.png')
    pts = pg.evaluate(FIND); res['targets'] = [p_[2] for p_ in pts]
    for x, y, _ in pts:
        pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(250)
    pg.mouse.move(5, 790); pg.wait_for_timeout(6000)
    res['on'] = pg.evaluate(STATE)
    pg.screenshot(path=f'{out}/g4b-splice-on.png')
    for _ in pts: pg.keyboard.press('z'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(5000); res['undone'] = pg.evaluate(STATE)
    pg.screenshot(path=f'{out}/g4b-splice-undo.png')
    for _ in pts: pg.keyboard.press('y'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(5000); res['redone'] = pg.evaluate(STATE)
    url = pg.evaluate('location.href'); pg.close()
    pg2 = page(); pg2.goto(url, wait_until='load', timeout=90000); pg2.wait_for_timeout(9000)
    pg2.evaluate("() => { rea.view.distance *= 0.62; rea.view.updateCamera(); }"); pg2.wait_for_timeout(2500)
    res['reloaded'] = pg2.evaluate(STATE)
    pg2.screenshot(path=f'{out}/g4b-splice-reload.png')
    b.close()
res['logs'] = [l for l in logs if 'error' in l.lower() or 'warn' in l.lower()]
res['errors'] = [l for l in logs if l.startswith('[error]') or l.startswith('[pageerror]')]
print(json.dumps(res, ensure_ascii=False)[:5000])
