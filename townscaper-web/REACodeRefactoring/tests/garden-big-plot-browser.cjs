// 第 194 轮 · 1178731576982724611（"I made some grassy plots. I'm real happy with the shapes they make."）
// 缺口（r193 挂下）：地块尺度 —— 片子里是「一块 10+ 格的大田 + 若干 2–5 格小块」，本仓一律 maxPlot=5，形制偏碎。
// 本测在真实 World 上量三件事：
//   ① 默认真实小镇：最大院子草格只有 9（< 2×bigMin=18）→ 不该出大田（判据有下限，不是见院就长），地块仍 ≤5 格；
//   ② 人工铺一块「一圈 3 层楼围住、里面 25+ 格空地」的院子（片里那种被房子围住的空地）→ 必须长出 1 块 ≥9 格的大田，
//      余下仍是 ≤5 格小块，草格守恒；截图两张（大田档 / 关档）供 ViewImage 复核；
//   ③ A/B：`world.gardenRules={bigField:0}` 退回旧形制（无大田、块数变多），像素差分落在院格上，同状态噪声 0；
//      另跑 `?bigplot=0` 的 URL 档确认开关能真的关掉。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');

const BASE = 'http://localhost:8769';

async function readGarden(page) {
  return page.evaluate(() => {
    const { view } = window.rea; view.render(0);
    const b = view.worldMesh.build, g = b.gardenC07;
    const paths = new Set(g.paths), plotIds = g.paths.length;
    return {
      yards: b.yardCells.size, open: (b.yardOpenings || []).length, quaySealed: b.quaySealed,
      plots: g.plots, plotCells: g.plotCells, plotSizes: g.plotSizes, bigPlots: g.bigPlots, stats: g.stats,
      paths: plotIds, cellsOfPlot: g.cellsOfPlot,
    };
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const out = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message); });
    page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSOLE', m.text()); } });
    await page.goto(`${BASE}/index.html?scene=town&grid=quad&c07=gardenplots,quayyards`);
    await page.waitForFunction(() => window.rea && window.rea.view.worldMesh.build && window.rea.view.worldMesh.build.gardenC07, null, { timeout: 120000 });
    await page.waitForTimeout(500);

    // ---- ① 真实小镇：判据下限 ----
    const town = await readGarden(page);
    out.town = town;
    console.log('TOWN', JSON.stringify(town));
    assert.equal(town.bigPlots, 0, `真实小镇最大院子草格 9 < 18，不该出大田（实际 ${town.bigPlots}）`);
    assert.ok(Math.max(...town.plotSizes) <= 5, `真实小镇地块仍 ≤5 格（实际 ${Math.max(...town.plotSizes)}）`);
    assert.equal(town.plotCells + town.paths, town.yards, `草格 + 小径格 == 院格（${town.plotCells}+${town.paths} vs ${town.yards}）`);
    assert.equal(town.plotSizes.reduce((a, b) => a + b, 0), town.plotCells, '地块格数之和 == 草格数');

    // ---- ② 铺一块「被房子围住的大院子」（片 0095/0250 那种），量大地块 ----
    const carve = await page.evaluate(() => {
      const { world, grid, view } = window.rea;
      const nb = (c, i) => world.neighbor(c, i);
      const bfs = (seed, maxd) => {
        const dist = new Map([[seed.id, 0]]), q = [seed], outC = [seed];
        for (let i = 0; i < q.length; i++) {
          const c = q[i], d = dist.get(c.id);
          if (d >= maxd) continue;
          for (let e = 0; e < c.n; e++) { const o = nb(c, e); if (o && !dist.has(o.id)) { dist.set(o.id, d + 1); q.push(o); outC.push(o); } }
        }
        return { dist, cells: outC };
      };
      world.reset();   // 只留人工院子：真实小镇的院子会与它连成一块，量不出单值
      // 找一块四邻齐全、周围 6 环内格数够多的种子（沿网格中心往外找）
      let best = null;
      const sorted = grid.cells.slice().sort((a, b) => (a.cx * a.cx + a.cz * a.cz) - (b.cx * b.cx + b.cz * b.cz));
      for (const s of sorted.slice(0, 400)) {
        let ok = true;
        for (let e = 0; e < 4; e++) if (!nb(s, e)) { ok = false; break; }
        if (!ok) continue;
        const b6 = bfs(s, 6), inner = [...b6.dist].filter(([, d]) => d <= 4).length;
        if (inner >= 40) { best = { seed: s, inner, n: b6.cells.length }; break; }
      }
      if (!best) return { ok: false };
      const b6 = bfs(best.seed, 6);
      let inner = 0, ring = 0;
      for (const c of b6.cells) {
        const d = b6.dist.get(c.id);
        if (d <= 4) { world.fill(c, 1); inner++; }
        else { world.fill(c, 3); ring++; }
      }
      world.touch(); view.worldMesh.invalidate();
      const centre = best.seed;
      view.target.set(centre.cx, 0.5, centre.cz); view.distance = 9.5; view.pitch = 1.05; view.yaw = 0.72; view.updateCamera();
      view.render(0);
      return { ok: true, seed: centre.id, innerCells: inner, ringCells: ring, patch: b6.cells.length, cx: centre.cx, cz: centre.cz };
    });
    out.carve = carve;
    console.log('CARVE', JSON.stringify(carve));
    assert.ok(carve.ok, '人工院子铺好');
    assert.ok(carve.innerCells >= 40, `人工院子内格 >= 40（实际 ${carve.innerCells}）`);

    const onBig = await readGarden(page);
    out.onBig = onBig;
    console.log('ON', JSON.stringify(onBig));
    const big = Math.max(...onBig.plotSizes);
    assert.ok(onBig.yards >= 30, `人工院子被认成院子（院格 ${onBig.yards}）`);
    assert.equal(onBig.stats.comps, 1, `世界被清空后只剩这一个院子（实际 ${onBig.stats.comps} 个）`);
    assert.equal(onBig.bigPlots, 1, `应恰有 1 块大田（实际 ${onBig.bigPlots}）`);
    assert.ok(big >= 9 && big <= 16, `大田格数落在 [9,16]（实际 ${big}）`);
    const smalls = onBig.plotSizes.filter((s) => s !== big);
    assert.ok(smalls.length >= 2, `大田之外还有小块（${smalls.length} 块）`);
    assert.ok(Math.max(...smalls) <= 5, `小块仍 ≤5 格（实际 ${Math.max(...smalls)}）`);
    assert.equal(onBig.plotSizes.reduce((a, b) => a + b, 0), onBig.plotCells, '地块格数之和 == 草格数');
    assert.equal(onBig.plotCells + onBig.paths, onBig.yards, `草格 + 小径格 == 院格（${onBig.plotCells}+${onBig.paths} vs ${onBig.yards}）`);
    assert.ok(onBig.stats.bigCells === big, `stats.bigCells 与大地块格数一致（${onBig.stats.bigCells} vs ${big}）`);
    // 证据图：抬高机位俯视整院，并临时藏掉悬浮面板（只影响这张截图，不改页面行为）
    const shot = async (file, bigField) => {
      await page.evaluate((bigField) => {
        const { view, world } = window.rea;
        for (const el of document.body.children) if (el.tagName === 'DIV' && getComputedStyle(el).position === 'fixed') el.style.display = 'none';
        const c = window.rea.grid.cells[1923];
        view.target.set(c.cx, 0.5, c.cz); view.distance = 17; view.pitch = 1.32; view.yaw = 0.78; view.updateCamera();
        world.gardenRules = bigField === null ? null : { bigField };
        view.worldMesh.invalidate(); view.render(0); view.render(0);
      }, bigField);
      await page.screenshot({ path: file });
    };
    await shot('artifacts/coverage/garden-bigplot-on.png', null);
    // 近景（只看院子内部形制：大田 vs 碎块）——机位压到院子上方、近乎俯视
    await page.evaluate(() => { const { view } = window.rea; const c = window.rea.grid.cells[1923]; view.target.set(c.cx, 0.5, c.cz); view.distance = 6.2; view.pitch = 1.42; view.yaw = 0.78; view.updateCamera(); view.render(0); view.render(0); });
    await page.screenshot({ path: 'artifacts/coverage/garden-bigplot-on-close.png', clip: { x: 200, y: 90, width: 640, height: 520 } });
    await page.evaluate(() => { const { view, world } = window.rea; world.gardenRules = { bigField: 0 }; view.worldMesh.invalidate(); view.render(0); view.render(0); });
    await page.screenshot({ path: 'artifacts/coverage/garden-bigplot-off-close.png', clip: { x: 200, y: 90, width: 640, height: 520 } });
    await page.evaluate(() => { const { view, world } = window.rea; world.gardenRules = null; view.worldMesh.invalidate(); view.render(0); });

    // ---- ③ A/B：关掉大田 → 旧形制；像素差分 + 噪声 ----
    const ab = await page.evaluate(() => {
      const { view, world } = window.rea;
      const r = view.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const grab = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) n++; return n; };
      view.worldMesh.invalidate(); view.render(0); view.render(0);
      const gOn1 = grab(), pOn = JSON.parse(JSON.stringify(view.worldMesh.build.gardenC07.plotSizes));
      view.render(0); view.render(0);
      const gOn2 = grab();
      world.gardenRules = { bigField: 0 }; view.worldMesh.invalidate(); view.render(0); view.render(0);
      const gOff = grab(), pOff = JSON.parse(JSON.stringify(view.worldMesh.build.gardenC07.plotSizes)), bigOff = view.worldMesh.build.gardenC07.bigPlots;
      world.gardenRules = null; view.worldMesh.invalidate(); view.render(0);
      return { W, H, noise: diff(gOn1, gOn2), onVsOff: diff(gOn1, gOff), pOn, pOff, bigOff };
    });
    out.ab = ab;
    console.log('AB', JSON.stringify(ab));
    assert.equal(ab.noise, 0, `同状态噪声 0（实际 ${ab.noise}）`);
    assert.equal(ab.bigOff, 0, '关档后没有大田');
    assert.ok(Math.max(...ab.pOff) <= 5, `关档后所有地块 ≤5（实际 ${Math.max(...ab.pOff)}）`);
    assert.ok(ab.pOff.length > ab.pOn.length, `关档更碎（${ab.pOff.length} 块 vs ${ab.pOn.length} 块）`);
    assert.ok(ab.onVsOff > 1500, `开/关大田的像素差分足够大（${ab.onVsOff} px）`);
    await shot('artifacts/coverage/garden-bigplot-off.png', 0);

    // ---- ④ URL 档 `?bigplot=0` 也能关 ----
    await page.goto(`${BASE}/index.html?scene=town&grid=quad&c07=gardenplots,quayyards&bigplot=0`);
    await page.waitForFunction(() => window.rea && window.rea.view.worldMesh.build && window.rea.view.worldMesh.build.gardenC07, null, { timeout: 120000 });
    await page.waitForTimeout(400);
    const urlOff = await readGarden(page);
    out.urlOff = urlOff;
    console.log('URLOFF', JSON.stringify(urlOff));
    assert.equal(urlOff.bigPlots, 0, '?bigplot=0 时不出大田（真实小镇本来也不够大，开关须确认真被读到）');
    const rules = await page.evaluate(() => window.rea.world.gardenRules || null);
    out.rules = rules;
    assert.deepEqual(rules, { bigField: 0 }, `?bigplot=0 应写进 world.gardenRules（实际 ${JSON.stringify(rules)}）`);

    assert.equal(errors.length, 0, `0 pageerror / 0 console error（实际 ${errors.join(' | ')}）`);
    fs.writeFileSync('artifacts/coverage/garden-bigplot-browser.json', JSON.stringify({ out, errors }, null, 2));
    console.log('PASS garden big plot browser', JSON.stringify({
      town: { yards: town.yards, plots: town.plots, sizes: town.plotSizes, big: town.bigPlots },
      fixture: { yards: onBig.yards, plots: onBig.plots, sizes: onBig.plotSizes, big: onBig.bigPlots },
      off: { plots: ab.pOff.length, sizes: ab.pOff, diff: ab.onVsOff, noise: ab.noise },
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
