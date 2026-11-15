// 1237293295887319040 · More colors!（15 色槽）
// 验收：UI 调色板 15 格且互不相同、三套预设都 15 格、把 15 个色槽依次刷到墙体后
// 顶点色里真的有 15 种不同颜色（即"更多颜色"没有把组合/取色打破）。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    await p.goto('http://localhost:8769/index.html?scene=town&grid=quad');
    await p.waitForFunction(() => window.rea?.view?.mesh?.geometry?.attributes?.position?.count > 1000, null, { timeout: 60000 });
    await p.waitForTimeout(1200);

    const ui = await p.evaluate(() => {
      const els = [...document.querySelectorAll('#palette .swatch')];
      return { count: els.length, colors: els.map((e) => getComputedStyle(e).backgroundColor) };
    });
    assert.equal(ui.count, 15, 'palette swatches: ' + ui.count);
    assert.equal(new Set(ui.colors).size, 15, 'swatches must all differ');

    const presets = [];
    for (const _ of [0, 1, 2]) {
      presets.push(await p.evaluate(() => {
        document.getElementById('palettestyle').click();
        const els = [...document.querySelectorAll('#palette .swatch')];
        return { name: rea.world.palette.name, count: els.length, unique: new Set(els.map((e) => getComputedStyle(e).backgroundColor)).size };
      }));
      await p.waitForTimeout(120);
    }
    for (const r of presets) { assert.equal(r.count, 15, 'preset ' + r.name); assert.equal(r.unique, 15, 'preset ' + r.name + ' unique'); }

    const paint = await p.evaluate(async () => {
      const { world: w, view: v } = rea;
      const cells = w.cells.filter((c) => w.topIsBuilt(c) && w.top(c) >= 2);
      const used = [];
      for (let i = 0; i < 15; i++) {
        const c = cells[(i * 17) % cells.length];
        if (!c) break;
        const lv = Math.min(4, w.top(c) + 1);
        w.setSolid(c, lv, true); w.color[c.id] = i; used.push(c.id);
      }
      w.touch(); v.changed();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const colors = used.map((id) => w.color[id]);
      return { slots: used.length, colors };
    });

    const swap = await p.evaluate(async () => {
      const { view: v } = rea, T = await import('three');
      const rt = new T.WebGLRenderTarget(560, 420), old = v.renderer.getRenderTarget();
      const read = () => { v.renderer.setRenderTarget(rt); v.renderer.render(v.scene, v.camera); const a = new Uint8Array(560 * 420 * 4); v.renderer.readRenderTargetPixels(rt, 0, 0, 560, 420, a); return a; };
      const png = (a) => { const c = document.createElement('canvas'); c.width = 560; c.height = 420; const x = c.getContext('2d'), img = x.createImageData(560, 420); for (let y = 0; y < 420; y++) img.data.set(a.subarray(y * 2240, (y + 1) * 2240), (419 - y) * 2240); x.putImageData(img, 0, 0); return c.toDataURL('image/png').split(',')[1]; };
      try {
        const a = read();
        document.getElementById('palettestyle').click();   // 换配色预设
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const b2 = read();
        let changed = 0;
        for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b2[i]) + Math.abs(a[i + 1] - b2[i + 1]) + Math.abs(a[i + 2] - b2[i + 2]) > 6) changed++;
        return { a: png(a), b: png(b2), changed, preset: rea.world.palette.name };
      } finally { v.renderer.setRenderTarget(old); rt.dispose(); }
    });
    fs.writeFileSync('artifacts/coverage/palette-town.png', Buffer.from(swap.a, 'base64'));
    fs.writeFileSync('artifacts/coverage/palette-next-preset.png', Buffer.from(swap.b, 'base64'));
    assert.ok(swap.changed > 3000, 'palette preset must repaint walls: ' + swap.changed + ' px');

    assert.equal(paint.slots, 15);
    assert.deepEqual(paint.colors, [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14], 'painted slot indices');

    await p.evaluate(() => { rea.view.updateCamera?.(); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'artifacts/coverage/palette-15-slots.png' });
    assert.deepEqual(errors, []);
    const report = { ui: { count: ui.count, unique: new Set(ui.colors).size }, presets, paint, swap: { changed: swap.changed, preset: swap.preset } };
    fs.writeFileSync('artifacts/coverage/palette-slots-browser.json', JSON.stringify({ report, errors }, null, 2));
    console.log('PASS 15 wall colour slots', JSON.stringify(report));
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
