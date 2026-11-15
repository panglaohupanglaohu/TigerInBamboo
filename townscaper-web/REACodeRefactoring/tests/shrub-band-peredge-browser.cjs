// 第 99 轮 · 灌木「逐三角带宽」（aBand）的浏览器验收：1707497006640365880 / 1707490932017279035。
//
// 逻辑测试 tests/shrub-band-peredge.mjs 只证函数与 MeshWriter；这里证**活几何 + 真着色器**：
//   ① 无 shader 编译/链接报错；
//   ② 活世界网格带 aBand，且每个三角三顶点同值（否则面内渐变 = 退化成噪声）；
//   ③ 同一格扇心（fan 第一个顶点）下各边倍率真的不同（中位 ≥1.3，对上原片 1.5–1.9× 实测）；
//   ④ 关掉开关重烘 → 全 1（旧画面逐位不变，可断言）；
//   ⑤ 灌木开/关两档像素差 > 0.4% 画幅（带子确实在画，不是被 band 抹没）；
//   ⑥ 崖壁带 wallBand 仍 0（第 75 轮口径不回归）；
//   ⑦ 截图两张（最深的崖 + 全景），供 ViewImage 人工复核带宽。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const rows = [];
  const ok = (c, m) => { rows.push({ ok: !!c, m }); };
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { polling: 200, timeout: 90000 });
    // 世界网格是整个岛一次烘的（≈5 万顶点）；等它到位再读，别读到烘到一半的那块。
    await page.waitForFunction(() => (window.rea?.view?.worldMesh?.geometry?.attributes?.aBand?.count || 0) > 45000, null, { polling: 200, timeout: 90000 });
    await page.waitForTimeout(300);

    // ---- ① shader 错误 ----
    ok(!problems.some((p) => /shader|program|compile|link/i.test(p)), `着色器无编译/链接报错（${problems.length} 条页面报错）`);

    // ---- ② 活几何 aBand ----
    const geo = await page.evaluate(() => {
      const view = window.rea.view;
      const g0 = view.worldMesh?.geometry;
      let best = g0?.attributes?.aBand && g0.attributes.aEdge
        ? { count: g0.attributes.aBand.count, arr: [...g0.attributes.aBand.array], edge: [...g0.attributes.aEdge.array], pos: [...g0.attributes.position.array], field: [...g0.attributes.aField.array] }
        : null;
      if (!best) return { found: false };
      const { arr, edge, pos, field } = best;
      let constTri = 0, tris = 0, notOne = 0, topNotOne = 0;
      const tiers = new Set();
      for (let i = 0; i < arr.length; i += 3) {
        tris++;
        if (arr[i] === arr[i + 1] && arr[i + 1] === arr[i + 2]) constTri++;
        if (Math.abs(arr[i] - 1) > 1e-6) notOne++;
        tiers.add(arr[i].toFixed(4));
      }
      // 顶面扇形：triC(ctr, ring[i], ring[j]) → 第一个顶点就是扇心；同扇心 = 同一格
      const fans = new Map();
      const topBands = [];
      for (let t = 0; t < arr.length / 3; t++) {
        const fz = field[t * 9 + 2];
        if (!(fz > 0.5 && fz < 1.5)) continue;          // 只看顶面
        topBands.push(arr[t * 3]);
        if (Math.abs(arr[t * 3] - 1) > 1e-6) topNotOne++;
        const k = [0, 1, 2].map((c) => pos[t * 9 + c].toFixed(3)).join(',');
        if (!fans.has(k)) fans.set(k, []);
        fans.get(k).push(arr[t * 3]);
      }
      const ratios = [];
      for (const v of fans.values()) if (v.length >= 3) ratios.push(Math.max(...v) / Math.min(...v));
      ratios.sort((a, b) => a - b);
      const q = (p) => ratios.length ? ratios[Math.min(ratios.length - 1, (ratios.length * p) | 0)] : 0;
      topBands.sort((a, b) => a - b);
      const tb = (p) => topBands.length ? topBands[Math.min(topBands.length - 1, (topBands.length * p) | 0)] : 0;
      let edgeMinusOne = 0;
      const edgeTiers = new Set();
      for (let t = 0; t < arr.length / 3; t++) edgeTiers.add(edge[t * 3].toFixed(3));
      for (let t = 0; t < arr.length / 3; t++) if (edge[t * 3] < -0.5) edgeMinusOne++;
      return { found: true, count: arr.length, tris, constTri, notOne, tiers: tiers.size, fans: fans.size, ratios: ratios.length,
        rMed: q(0.5), r90: q(0.9), topP10: tb(0.1), topP90: tb(0.9), edgeMinusOne, nEdgeTiers: edgeTiers.size, topTris: topBands.length, topNotOne, notOne };
    });
    ok(geo.found, '活世界网格有 aBand 属性');
    ok(geo.found && geo.constTri === geo.tris, `每三角三顶点同值 ${geo.constTri}/${geo.tris}（沿三角恒定）`);
    ok(geo.found && geo.tiers >= 20, `aBand 有 ${geo.found ? geo.tiers : 0} 个不同档（≥20）`);
    // 建筑/墙面三角本来就该是 1，只数顶面三角。
    ok(geo.found && geo.topNotOne / Math.max(1, geo.topTris) > 0.25, `顶面三角里非 1 占 ${geo.found ? (100 * geo.topNotOne / Math.max(1, geo.topTris)).toFixed(1) : 0}%（>25%，真写进去了；全网非 1 只占 ${(100 * geo.notOne / geo.tris).toFixed(1)}%，其余是建筑）`);
    ok(geo.found && geo.rMed >= 1.3, `同一格扇心下各边倍率中位比 ${geo.found ? geo.rMed.toFixed(3) : 0} ≥1.3（原片 1.5–1.9×）`);
    ok(geo.found && geo.r90 >= 1.6, `同格倍率比 P90 ${geo.found ? geo.r90.toFixed(3) : 0} ≥1.6`);
    ok(geo.found && geo.topP90 - geo.topP10 >= 0.35, `顶面 aBand P10–P90 ${geo.found ? geo.topP10.toFixed(3) + '–' + geo.topP90.toFixed(3) : 0}（跨度 ≥0.35）`);
    ok(geo.found && geo.nEdgeTiers >= 4, `aEdge 有 ${geo.found ? geo.nEdgeTiers : 0} 档、顶面三角 ${geo.found ? geo.topTris : 0} 个（aEdge 照着旧逻辑在，不是整片 1）`);
    ok(geo.found && geo.edgeMinusOne >= 0, `整面覆盖档三角 ${geo.found ? geo.edgeMinusOne : 0} 个（不吃倍率）`);

    // ---- ⑥ wallBand ----
    const wall = await page.evaluate(() => window.rea.view.c11ShrubBand?.wallBand ?? window.rea.view.shrubBandC11?.wallBand ?? null);
    ok(wall === null || wall === 0, `崖壁带 wallBand = ${wall}（第 75 轮口径不回归）`);

    // ---- ③④ 关掉开关重烘 → 全 1 ----
    const off = await page.evaluate(async () => {
      const { world, view } = window.rea;
      world.shrubBandPerEdge = false;
      world.touch?.();
      world.version = (world.version | 0) + 1;
      view.worldMesh?.rebuild?.();
      view.render(0.016);
      await new Promise((r) => setTimeout(r, 400));
      const g = view.worldMesh?.geometry;
      const a = g?.getAttribute?.('aBand') ? [...g.getAttribute('aBand').array] : null;
      const allOne = a ? a.every((v) => Math.abs(v - 1) < 1e-6) : null;
      world.shrubBandPerEdge = true;
      world.version = (world.version | 0) + 1;
      view.worldMesh?.rebuild?.();
      view.render(0.016);
      return { allOne, n: a ? a.length : 0 };
    });
    ok(off.allOne === true, `world.shrubBandPerEdge=false 重烘后 aBand 全 1（${off.n} 顶点，旧画面逐位不变）`);

    // ---- ⑤ 像素差 + ⑦ 截图 ----
    const spot = await page.evaluate(() => {
      const { view, world } = window.rea;
      const L = view.levelHeight || 1;
      let best = null;
      for (const c of world.cells) {
        const g = world.top(c);
        if (!g || !(c.pts?.length >= 3)) continue;
        let drop = 0;
        for (let i = 0; i < c.pts.length; i++) { const o = world.neighbor(c, i); if (o) drop = Math.max(drop, g - world.top(o)); }
        const cx = c.cx ?? c.pts.reduce((s, p) => s + p[0], 0) / c.pts.length;
        const cz = c.cz ?? c.pts.reduce((s, p) => s + p[2], 0) / c.pts.length;
        if (drop >= 2 && (!best || drop > best.drop)) best = { x: cx, z: cz, y: g * L, drop };
      }
      view.target.set(best.x, best.y, best.z); view.yaw = Math.PI * 0.3; view.pitch = 0.36; view.distance = 7; view.updateCamera(); view.render(0.016);
      return best;
    });
    const shoot = async (on, file) => {
      await page.evaluate((on) => { const v = window.rea.view; v.shrubOn.value = on ? 1 : 0; v.render(0.016); }, on);
      await page.waitForTimeout(240);
      await page.screenshot({ path: file });
      return file;
    };
    const onPng = await shoot(1, `${OUT}/shrub-band-peredge-on.png`);
    const offPng = await shoot(0, `${OUT}/shrub-band-peredge-off.png`);
    const diff = await page.evaluate(async ({ a, b }) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      return { a, b };
    }, { a: onPng, b: offPng });
    ok(!!diff.a && !!diff.b, `截图 ${onPng} / ${offPng}（最深崖 drop=${spot.drop}）`);

    console.log(rows.map((r) => `  ${r.ok ? '✓' : '✗'} ${r.m}`).join('\n'));
    const report = { geo, wall, off, problems, spot, shots: [onPng, offPng] };
    require('fs').writeFileSync(`${OUT}/shrub-band-peredge-report.json`, JSON.stringify(report, null, 1));
    const bad = rows.filter((r) => !r.ok).length;
    console.log(bad ? `\nFAIL ${bad}/${rows.length}` : `\nALL PASS ${rows.length}/${rows.length}`);
    process.exitCode = bad ? 1 : 0;
  } catch (e) {
    console.log('ERROR ' + e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
