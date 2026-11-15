#!/usr/bin/env python3
"""r55 propanim 浏览器验收（1246074663546916873）：index.html?scene=town&propanim=1 vs 关闭；
编辑 World（抹掉一个后院格 + 码头外加一圈新码头）后冻结时钟在 +0.07 s 截图：新桩子错峰长出、旧木箱在缩没。
用法: python3 tests/prop-anim-browser.py <port> <outdir>"""
import sys, json, os
os.environ['LD_LIBRARY_PATH'] = os.path.expanduser('~/deblib/usr/lib/aarch64-linux-gnu') + ':' + os.environ.get('LD_LIBRARY_PATH', '')
from playwright.sync_api import sync_playwright
port, out = sys.argv[1], sys.argv[2]
FOCUS = """async () => { const m = await import('/src/world/prop-anim-layer.js'); const props = m.collectWorldProps(rea.world, { L: rea.view.levelHeight });
  const crates = props.filter(p => p.kind === 'crate'); const c = crates[0] ?? props[0];
  rea.view.target.set(c.x, 0.4, c.z); rea.view.distance = 7; rea.view.updateCamera(); window.__focus = c.key; return { crates: crates.length, props: props.length, at: c.key }; }"""
STATE = """() => { const L = rea.propAnim; if (!L) return { layer: false, meshInScene: !!rea.view.scene.getObjectByName('propAnim') };
  const sc = [...L.life.byKey.values()].map(e => L.life.records[e.slot * 4 + 3]);
  return { layer: true, compiled: !!L.compiled, ...L.stats, minScale: Math.min(...sc), maxScale: Math.max(...sc), growing: sc.filter(s => s > 0.02 && s < 0.9).length }; }"""
EDIT = """() => { const L = rea.propAnim, w = rea.world, cells = w.cells, T0 = performance.now() / 1000; L.clock = () => T0;
  // 1) 抹掉一个有木箱的后院格（整个后院打开 → 这批木箱缩没）
  const crate = window.__focus?.startsWith('yard:') ? window.__focus : [...L.life.byKey.keys()].find(k => k.startsWith('yard:')); let erased = -1;
  if (crate) { erased = +crate.split(':')[1]; w.fill(cells[erased], 0); }
  // 2) 码头外面一圈水格补成码头（新系缆桩错峰长出）
  const add = new Set(); for (const c of cells) if (w.top(c) === 1 && w.isBuilt(c, 1)) for (const id of c.edgeNeighbors) if (id >= 0 && id !== erased && !w.isSolid(cells[id], 1) && Math.hypot(cells[id].cx - rea.view.target.x, cells[id].cz - rea.view.target.z) < 4.5) add.add(id);
  for (const id of add) { w.setSolid(cells[id], 1, true); w.color[id] = 2; }
  rea.view.changed(); window.__T0 = T0; return { erased, added: add.size }; }"""
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    logs = []
    def page(url):
        pg = b.new_page(viewport={'width': 1280, 'height': 800})
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'[:300]))
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'[:500]))
        pg.goto(url, wait_until='load', timeout=90000); pg.wait_for_timeout(9000); return pg
    pg = page(f'http://localhost:{port}/index.html?scene=town')
    res['focusOff'] = pg.evaluate(FOCUS); pg.wait_for_timeout(3000); res['off'] = pg.evaluate(STATE)
    pg.screenshot(path=f'{out}/g4b-propanim-off.png'); pg.close()
    pg = page(f'http://localhost:{port}/index.html?scene=town&propanim=1')
    res['focusOn'] = pg.evaluate(FOCUS); pg.wait_for_timeout(4000); res['settled'] = pg.evaluate(STATE)
    pg.screenshot(path=f'{out}/g4b-propanim-on.png')
    res['edit'] = pg.evaluate(EDIT); pg.wait_for_timeout(4000)
    pg.evaluate("() => { rea.propAnim.clock = () => window.__T0 + 0.07; }"); pg.wait_for_timeout(2500)
    res['mid'] = pg.evaluate(STATE); pg.screenshot(path=f'{out}/g4b-propanim-mid.png')
    pg.evaluate("() => { rea.propAnim.clock = () => window.__T0 + 3; }"); pg.wait_for_timeout(2500)
    res['after'] = pg.evaluate(STATE); pg.screenshot(path=f'{out}/g4b-propanim-after.png')
    b.close()
res['errors'] = [l for l in logs if l.startswith('[error]') or l.startswith('[pageerror]')]
res['warnings'] = sorted(set(l for l in logs if l.startswith('[warning]')))
print(json.dumps(res, ensure_ascii=False)[:5000])
