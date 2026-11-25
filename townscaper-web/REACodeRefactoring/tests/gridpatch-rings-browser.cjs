// r142/r143 · 1301816247479345152（324 帧·"random patches of hand crafted grid … little gems to build your temples upon"）
// 口径：patch 的「环数 / 辐条数 / 中心格长宽比 / 洞内原格」四项全部从真实页面读数取，不用 node 结果代替浏览器。
// 覆盖三件事：① gridpatch.html 的 ?rings/?radius/?hole 入口（原片 5 环 + 中心留小片原格）；
// ② 主场景 ?gems=4（多补丁撒进生成网格）真页面像素 A/B；③ 补丁上能建、World 能刷新。
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8769';
const OUT = 'artifacts/coverage';
let fails = 0;
const ok = (cond, msg, extra) => { if (cond) console.log('  PASS ' + msg); else { fails++; console.log('  FAIL ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  p.on('pageerror', (e) => { errors.push(e.message); console.log('  PAGEERR ' + e.message); });

  // ---------- A. 四种模板的几何口径（真实页面 #report 读数 + 页面内重算） ----------
  const CFG = [
    ['radial-3', 'grid=quad&template=radial', { rings: 3, tris: 0 }],
    ['radial-5', 'grid=quad&template=radial&rings=5&radius=1.9', { rings: 5, tris: 0 }],
    ['courtyard-5', 'grid=quad&template=courtyard&rings=5&radius=2.6&hole=.6', { rings: 5, tris: 0 }],
    ['block', 'grid=quad&template=block', { rings: 3 }],
    ['rhombus', 'grid=quad&template=rhombus', { rings: 3 }],
  ];
  const reps = {};
  for (const [name, q, want] of CFG) {
    console.log('\n[' + name + ']');
    await p.goto(BASE + '/gridpatch.html?' + q + '&plan=1', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.patchRuntime?.view?.mesh?.geometry?.attributes?.position?.count > 0, null, { polling: 100, timeout: 90000 });
    const rep = await p.evaluate(() => JSON.parse(document.querySelector('#report').textContent));
    const geo = await p.evaluate(async () => {
      const { grid, world, view } = window.patchRuntime;
      const { signedArea, isConvex, buildQuadGrid } = await import('/src/core/grid.js');
      const { selfCheck } = await import('/src/core/adjacency.js');
      const { World } = await import('/src/core/world.js');
      const area = (g) => g.cells.reduce((s, c) => s + Math.abs(signedArea(c.pts)), 0);
      const base = buildQuadGrid({ radius: 10, hexSize: 1, seed: 7 });
      const patch = new Set(grid.patch.cellIds);
      let bad = 0, openEdge = 0, seamTwin = 0, seam = 0;
      for (const c of grid.cells) { if (!isConvex(c.pts) || Math.abs(signedArea(c.pts)) < 1e-8) bad++; for (let i = 0; i < c.n; i++) { const o = c.edgeNeighbors[i]; if (o < 0) { if (patch.has(c.id)) openEdge++; continue; } if (grid.cells[o].edgeNeighbors[c.edgeTwins[i]] !== c.id) seamTwin++; if (patch.has(c.id) && !patch.has(o)) seam++; } }
      const holeUntouched = (grid.patch.holeCellIds || []).every((id) => { const c = grid.cells[id]; const src = base.cells[grid.sourceCellOf[id]]; return Math.hypot(c.cx - src.cx, c.cz - src.cz) < 1e-9 && c.pts.length === src.pts.length; });
      // 环带半径：把补丁格按到补丁中心的距离分箱，带边界数 = 环数
      const d = (c) => Math.hypot(c.cx - grid.patch.x, c.cz - grid.patch.z);
      const radii = grid.patch.cellIds.map((id) => d(grid.cells[id])).sort((a, b) => a - b);
      return {
        areaBase: +area(base).toFixed(6), areaPatched: +area(grid).toFixed(6),
        badConvex: bad, openEdge, seamTwin, seam, holeUntouched, mismatch: selfCheck(grid, new World(grid)).mismatched,
        rMin: +radii[0].toFixed(3), rMax: +radii[radii.length - 1].toFixed(3),
        meshVerts: view.mesh.geometry.attributes.position.count, worldVersion: world.version,
      };
    });
    reps[name] = { ...rep, ...geo };
    ok(rep.rings === want.rings, '环数 = ' + want.rings, rep.rings);
    if (want.tris !== undefined) ok(rep.patchTriangles === want.tris, '补丁全四边格（三角 ' + want.tris + '）', rep.patchTriangles);
    ok(geo.badConvex === 0, '无翻折/退化格', geo.badConvex);
    ok(geo.openEdge === 0 && geo.seamTwin === 0, '半边全互逆、无开边', [geo.openEdge, geo.seamTwin]);
    ok(Math.abs(geo.areaPatched - geo.areaBase) < 1e-6, '总面积守恒', +(geo.areaPatched - geo.areaBase).toExponential(2));
    ok(geo.mismatch === 0, '邻接自检 0 违例', geo.mismatch);
    ok(geo.seam === rep.boundaryN + rep.holeBoundary, '接缝边数 == 外边界+洞边界顶点数（原边界顶点对象共用）', [geo.seam, rep.boundaryN, rep.holeBoundary]);
    ok(rep.edgeRatioP50 > (name.startsWith('courtyard') ? 0.55 : 0.3), '补丁格长宽比中位 ' + rep.edgeRatioP50 + (name.startsWith('courtyard') ? ' > 0.55（r143：环带厚度均分后 0.257 → ' + rep.edgeRatioP50 + '）' : ' > 0.3'));
    if (name.startsWith('courtyard')) {
      // r143 结构断言：环带厚度 s=(minR−holeR)/(rings+2)、最内规则环 R=holeR+2s —— 两条都能从页面读数复算
      ok(Math.abs(rep.ringInner - (rep.ringHole + 2 * rep.ringSpacing)) < 2e-3, '环带厚度均分：R = holeR + 2s', [rep.ringHole, rep.ringSpacing, rep.ringInner]);
      ok(rep.ringSpacing * (rep.rings + 2) > rep.ringMin - rep.ringHole - 1e-3 && rep.ringSpacing * (rep.rings + 2) < rep.ringMin - rep.ringHole + 1e-3, 'rings+2 条带铺满 boundary→hole', [rep.ringSpacing, rep.rings, rep.ringMin, rep.ringHole]);
      ok(rep.outerEdgeRatioP50 > 0.55 && rep.outerSlivers <= 12, '外环带（r > 内环）细楔 ' + rep.outerSlivers + '/' + rep.outerCells + '，eP50 ' + rep.outerEdgeRatioP50, [rep.outerSlivers, rep.outerCells]);
    }
    if (name === 'courtyard-5') {
      ok(rep.holeCells >= 5 && geo.holeUntouched, '中心洞内原格原样保留（不是单点扇形）', [rep.holeCells, geo.holeUntouched]);
    }
    await p.evaluate(() => { const v = window.patchRuntime.view; v.distance = 8.5; v.pitch = 1.5; v.target.set(0, 0, 0); v.updateCamera(); });
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${OUT}/gridpatch-r143-${name}.png`, fullPage: true });
    console.log('  report ' + JSON.stringify({ rings: rep.rings, N: rep.boundaryN, cells: rep.patchCells, eP50: rep.edgeRatioP50, slivers: rep.slivers, outerSlivers: rep.outerSlivers, s: rep.ringSpacing, hole: rep.holeCells }));
  }

  // ---------- B. 主场景 ?gems=4：多补丁撒进真生成网格 + 补丁上能建 + 像素 A/B ----------
  console.log('\n[main ?gems=4]');
  const shots = {};
  for (const gems of ['0', '4']) {
    await p.goto(`${BASE}/index.html?scene=town&grid=quad&still=1${gems === '0' ? '' : '&gems=4&gemSeed=11'}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => globalThis.reaView?.town?.grid?.cells?.length > 0, null, { polling: 100, timeout: 120000 });
    await p.waitForTimeout(1200);
    const info = await p.evaluate(() => {
      const v = globalThis.reaView, g = v.town.grid;
      const { signedArea, isConvex } = { signedArea: null, isConvex: null }; // 只用已可用字段
      return { cells: g.cells.length, gems: (g.gems || []).map((x) => ({ t: x.template, x: +x.x.toFixed(2), z: +x.z.toFixed(2), cells: x.cells })), rejected: (g.gemRejected || []).length, version: v.town.version, verts: v.worldMesh?.geometry?.attributes?.position?.count ?? v.mesh?.geometry?.attributes?.position?.count ?? -1 };
    });
    shots[gems] = await p.locator('#view').screenshot();
    await p.screenshot({ path: `${OUT}/gridpatch-r143-gems${gems}.png`, fullPage: false });
    reps['gems' + gems] = info;
    if (gems === '0') ok(info.gems.length === 0, '默认（?gems 缺省）不撒补丁', info.gems.length);
    else {
      ok(info.gems.length === 4, '撒满 4 块补丁', info.gems.length);
      ok(new Set(info.gems.map((g) => g.t)).size === 4, '四种模板各一（courtyard/radial/block/rhombus）', info.gems.map((g) => g.t));
      let minD = Infinity; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) minD = Math.min(minD, Math.hypot(info.gems[i].x - info.gems[j].x, info.gems[i].z - info.gems[j].z));
      ok(minD > 5, '补丁互不重叠（最近间距 ' + minD.toFixed(2) + '）', minD);
      // 补丁上能建：找 courtyard 补丁中心最近的格，抬 2 层
      const built = await p.evaluate(() => {
        const v = globalThis.reaView, g = v.town.grid, gem = g.gems[0];
        const c = g.cells.reduce((best, x) => Math.hypot(x.cx - gem.x, x.cz - gem.z) < Math.hypot(best.cx - gem.x, best.cz - gem.z) ? x : best, g.cells[0]);
        const before = v.town.version; v.town.setSolid(c, 1, true); v.town.setSolid(c, 2, true); v.town.touch(); v.changed?.(); v.render(0);
        return { cell: c.id, top: v.town.top(c), n: c.n, versionBefore: before, versionAfter: v.town.version };
      });
      ok(built.top === 2 && built.versionAfter > built.versionBefore, '补丁格上能叠层（top=2，World 版本前进）', built);
    }
  }
  const diff = await p.evaluate(async ([a, b64]) => {
    const dec = async (s) => { const r = await fetch('data:image/png;base64,' + s); return createImageBitmap(await r.blob()); };
    const [i1, i2] = await Promise.all([dec(a), dec(b64)]);
    if (i1.width !== i2.width || i1.height !== i2.height) return { size: [i1.width, i1.height, i2.width, i2.height] };
    const c1 = new OffscreenCanvas(i1.width, i1.height), x1 = c1.getContext('2d'); x1.drawImage(i1, 0, 0);
    const c2 = new OffscreenCanvas(i2.width, i2.height), x2 = c2.getContext('2d'); x2.drawImage(i2, 0, 0);
    const d1 = x1.getImageData(0, 0, i1.width, i1.height).data, d2 = x2.getImageData(0, 0, i2.width, i2.height).data;
    let n = 0, sum = 0; for (let i = 0; i < d1.length; i += 4) { const dd = Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]); if (dd > 24) { n++; sum += dd / 3; } }
    return { pixels: n, total: d1.length / 4, mean: +(sum / Math.max(1, n)).toFixed(2) };
  }, [shots['0'].toString('base64'), shots['4'].toString('base64')]);
  ok(diff.pixels > 3000, '?gems=4 A/B 像素差 ' + (diff.pixels || 0) + 'px（均值 ' + (diff.mean || 0) + ' 级）', diff);

  // ---------- C. 回归：node 逻辑测试照旧 ----------
  const { execFileSync } = require('child_process');
  for (const t of ['tests/gridpatch-templates.mjs', 'tests/gridpatch-multi.mjs', 'tests/grid-gems-c06.mjs', 'tests/radial-dual.mjs']) {
    try { execFileSync('node', [t], { stdio: 'pipe' }); ok(true, 'node 回归 ' + t); } catch (e) { ok(false, 'node 回归 ' + t, String(e.stdout || e.message).slice(-300)); }
  }

  ok(errors.length === 0, '0 console/page error', errors);
  fs.writeFileSync(`${OUT}/gridpatch-rings-r143.json`, JSON.stringify({ reps, diff, errors }, null, 2));
  await b.close();
  console.log('\n' + (fails ? 'FAIL ' + fails : 'ALL PASS'));
  if (fails) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
