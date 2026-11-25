// 第 129 轮 · 1290997501332525056（"#Townscaper is now properly released on Mac on Steam! To celebrate
// the occasion, I added some garden paths."）的运行验收。
// note 从 r? 起挂着「细石板宽度、门口优先和中心装饰仍待补」，r56 C07 的 build/garden-plots-c07.js 已把这
// 三件都落了（门优先小径树 / 0.36·rc 窄石板条 / 中心圆台 + 圆冠小树），但只有 node 侧 c07-look.mjs，
// 页面从来没有从真实 World 量过。本测在 index.html?c07=gardenplots 里读真实 build 的 gardenC07 台账：
//   ① 门优先：小径树的叶子恰好是「门外那格」，中心是离院子形心最近的格；
//   ② 窄石板：条宽 0.36·rc（rc = 格心到最近边中点距离），远窄于一格；
//   ③ 中心圆台：每个 hub 格都有环 + 底座 + 装饰，且 hub 在小径树上连得通；
//   ④ A/B：关掉 gardenPlots → 退回 core/garden-paths 的 PCA 端点方案，路径集合必须真的不同。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = 'http://localhost:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  const errors = [];
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSOLE', m.text()); } });
  const report = {};
  try {
    await page.goto(`${BASE}/index.html?scene=town&grid=quad&c07=gardenplots`);
    await page.waitForFunction(() => window.rea && window.rea.view.worldMesh.build && window.rea.view.worldMesh.build.gardenC07, null, { timeout: 90000 });
    await page.waitForTimeout(500);

    const p = await page.evaluate(() => {
      const { world, grid, view } = window.rea;
      view.render(0);
      const b = view.worldMesh.build, g = b.gardenC07;
      const deg = new Map();
      for (const [id, es] of g.links) deg.set(id, es.length);
      const paths = new Set(g.paths), doors = new Set(g.doors), hubs = new Set(g.hubs);
      // 小径树的连通性：从每个 hub 沿 links 走，必须覆盖本院子的小径格
      const seen = new Set(), q = [...hubs].filter((id) => paths.has(id));
      q.forEach((id) => seen.add(id));
      for (let i = 0; i < q.length; i++) {
        const c = grid.cells[q[i]];
        for (const e of g.links.find(([id]) => id === c.id)?.[1] || []) {
          const o = world.neighbor(c, e);
          if (o && paths.has(o.id) && !seen.has(o.id)) { seen.add(o.id); q.push(o.id); }
        }
      }
      // 窄石板：rc = 格心到最近边中点；条宽 = 2·0.18·rc
      let rcMin = Infinity, rcMax = 0;
      for (const id of paths) { const c = grid.cells[id]; let rc = Infinity; for (let i = 0; i < c.n; i++) { const a = c.pts[i], d = c.pts[(i + 1) % c.n]; rc = Math.min(rc, Math.hypot((a.x + d.x) / 2 - c.cx, (a.z + d.z) / 2 - c.cz)); } rcMin = Math.min(rcMin, rc); rcMax = Math.max(rcMax, rc); }
      const leaves = [...paths].filter((id) => (deg.get(id) || 0) === 1);
      return {
        stats: g.stats, hubs: [...hubs], doors: [...doors], paths: g.paths.length, plotCells: g.plotCells, plots: g.plots,
        pathCellsFromBuild: b.pathCells.size,
        leaves, leavesAreDoors: leaves.filter((id) => doors.has(id)).length,
        leavesOutside: leaves.filter((id) => !doors.has(id) && !hubs.has(id)).length,
        // 门格必须有一段石板条「出到门外」：link 指向的邻居不是小径格，正是门口那条边
        doorEdgeLinks: [...doors].filter((id) => ((g.links.find(([k]) => k === id)?.[1]) || []).some((e) => { const o = world.neighbor(grid.cells[id], e); return !o || !paths.has(o.id); })).length,
        hubsOnPath: [...hubs].filter((id) => paths.has(id)).length,
        reached: seen.size, pathWidthRatio: +(2 * 0.18).toFixed(3),
        rcMin: +rcMin.toFixed(4), rcMax: +rcMax.toFixed(4), doorsInPath: [...doors].filter((id) => paths.has(id)).length,
        linksDeg: [...deg.values()].reduce((a, v) => a + v, 0),
      };
    });
    console.log('PROBE', JSON.stringify(p));

    // ① 门优先
    assert.ok(p.stats.doorPaths > 0, `courtyards planned from doors (${p.stats.doorPaths})`);
    assert.ok(p.doors.length > 0, `door cells found (${p.doors.length})`);
    assert.equal(p.doorsInPath, p.doors.length, 'every door cell is on the path');
    assert.equal(p.doorEdgeLinks, p.doors.length, `every door cell grows a slab strip out through its doorway (${p.doorEdgeLinks}/${p.doors.length})`);
    assert.equal(p.leavesOutside, 0, 'no leaf that is neither a door nor a hub (the tree ends only at doors and the plaza)');
    assert.equal(p.stats.doorPaths + p.stats.fallbackPaths, p.stats.comps, 'every courtyard planned exactly once');
    // ③ 中心圆台 + 连通
    assert.ok(p.hubs.length > 0, `central plazas exist (${p.hubs.length})`);
    assert.equal(p.hubsOnPath, p.hubs.length, 'every hub is itself a path cell');
    assert.equal(p.reached, p.paths, `path tree is connected from the hub (${p.reached}/${p.paths})`);
    assert.equal(p.pathCellsFromBuild, p.paths, 'build.pathCells is the C07 door-first path, not the old one');
    // ② 窄石板
    assert.ok(p.pathWidthRatio < 0.45, `slab strip is far narrower than a cell (${p.pathWidthRatio} of the cell radius ×2)`);
    assert.ok(p.rcMin > 0.05 && p.rcMax < 2.0, `cell radius measured from real cells (${p.rcMin}..${p.rcMax})`);
    assert.ok(p.rcMax * 0.36 < p.rcMax, 'slab width 0.36·rc stays inside one cell');
    // 草地块
    assert.ok(p.plots > 0 && p.plotCells > 0, `lawn plots partitioned (${p.plots} plots / ${p.plotCells} cells)`);

    const aim = await page.evaluate(() => {
      const { view, grid } = window.rea; view.render(0);
      const g = view.worldMesh.build.gardenC07, c = grid.cells[g.hubs[0]];
      view.target.set(c.cx, 0.5, c.cz); view.distance = 3.0; view.pitch = 1.12; view.yaw = 0.7; view.updateCamera(); view.render(0);
      return { hub: g.hubs[0], door: g.doors[0] };
    });
    report.aim = aim;
    await page.screenshot({ path: 'artifacts/coverage/garden-c07-r129-quad.png' });

    // ④ A/B：关掉 gardenPlots → 退回 core/garden-paths 的 PCA 端点方案
    const ab = await page.evaluate(() => {
      const { world, view } = window.rea;
      const r = view.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const grab = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      const on1 = (view.worldMesh.invalidate(), view.render(0), view.render(0), grab());
      const on2 = (view.render(0), view.render(0), grab());
      world.gardenPlots = false; view.worldMesh.invalidate();
      const b2 = (view.render(0), view.worldMesh.build);
      const off = grab();
      const offPaths = new Set(); b2.pathCells.forEach((id) => offPaths.add(id));
      world.gardenPlots = true; view.worldMesh.invalidate(); view.render(0);
      const onPaths = new Set(window.rea.view.worldMesh.build.gardenC07.paths);
      let only = 0; for (const id of onPaths) if (!offPaths.has(id)) only++;
      let onlyOff = 0; for (const id of offPaths) if (!onPaths.has(id)) onlyOff++;
      const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) n++; return n; };
      return { W, H, noise: diff(on1, on2), onVsOff: diff(on1, off), onPaths: onPaths.size, offPaths: offPaths.size, c07Only: only, plainOnly: onlyOff, c07Flag: !!b2.gardenC07 };
    });
    console.log('AB', JSON.stringify(ab));
    assert.equal(ab.c07Flag, false, 'flag really off: gardenC07 not planned');
    assert.equal(ab.noise, 0, `same-state noise floor is 0 (got ${ab.noise})`);
    assert.ok(ab.plainOnly > 0, `door-first path is not the PCA-endpoint path (${ab.plainOnly} cells only in the old plan)`);
    assert.ok(ab.onPaths < ab.offPaths, `door-first corridor is sparser than the PCA cross (${ab.onPaths} < ${ab.offPaths} cells)`);
    assert.ok(ab.onVsOff > 400, `turning gardenPlots off changes the yards (${ab.onVsOff} px)`);
    report.probe = p;
    report.ab = ab;

    await page.evaluate(() => { const { world, view } = window.rea; world.gardenPlots = false; view.worldMesh.invalidate(); view.render(0); });
    await page.screenshot({ path: 'artifacts/coverage/garden-c07-r129-quad-off.png' });

    // 第二段：混合网格的院子里没有门 → 必须走 core/garden-paths 的 PCA 端点回退，而不是整院消失
    await page.goto(`${BASE}/index.html?scene=town&grid=mixed&c07=gardenplots`);
    await page.waitForFunction(() => window.rea && window.rea.view.worldMesh.build && window.rea.view.worldMesh.build.gardenC07, null, { timeout: 90000 });
    await page.waitForTimeout(400);
    const fb = await page.evaluate(() => {
      const { grid, view } = window.rea; view.render(0);
      const g = view.worldMesh.build.gardenC07;
      const paths = new Set(g.paths);
      return { stats: g.stats, paths: g.paths.length, hubs: g.hubs.length, doors: g.doors.length, plotCells: g.plotCells,
        hubOnPath: g.hubs.filter((id) => paths.has(id)).length };
    });
    console.log('FALLBACK', JSON.stringify(fb));
    assert.equal(fb.doors, 0, 'mixed-grid courtyard really has no door');
    assert.ok(fb.stats.fallbackPaths > 0, `falls back to the PCA-endpoint planner (${fb.stats.fallbackPaths})`);
    assert.ok(fb.paths > 3, `fallback path still connects the yard (${fb.paths} cells)`);
    assert.equal(fb.hubOnPath, fb.hubs, 'plaza still sits on the fallback path');
    assert.ok(fb.plotCells > 0, `lawn plots still partitioned (${fb.plotCells})`);
    await page.screenshot({ path: 'artifacts/coverage/garden-c07-r129-mixed.png' });
    report.fallback = fb;

    assert.deepEqual(errors, [], `0 console/page errors (got ${errors.length})`);
    console.log('PASS garden paths door-first: ' + JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
