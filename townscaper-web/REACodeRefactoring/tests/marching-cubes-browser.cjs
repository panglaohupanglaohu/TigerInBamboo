// 运行验收：1163836000688365571「Basic marching cubes on my funky grid」· marching-cubes.html
// 只读页面暴露面 window.marchReview（含 mesh() 几何探针），不读日志。
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');

const out = path.resolve(__dirname, '../artifacts/coverage');
const base = process.env.REA_TEST_URL || 'http://127.0.0.1:8769';
const results = [];

function fail(msg) { throw new Error(msg); }

// 2D 点到线段距离（型面「只在格边交点上」逐点对账用）
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  let t = L2 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t, qz = az + dz * t;
  return Math.hypot(px - qx, pz - qz);
}

function analyze(m) {
  const P = m.positions, I = m.indices, h = m.levelHeight, levelsY = m.yOfUsed;
  // ① 焊接：索引网格的顶点数应远小于「每三角三点」的非索引口径
  const verts = P.length / 3, tris = I.length / 3;
  // ② 每条表面顶点必须落在格边上：y 在某层高（水平边）或 xz 在格角（竖边）
  const corners = [];
  for (const cell of m.cells) for (const p of cell) corners.push(p);
  const edges = [];
  const seen = new Set();
  for (const cell of m.cells) for (let k = 0; k < cell.length; k++) {
    const a = cell[k], b = cell[(k + 1) % cell.length];
    const key = (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) ? a + '|' + b : b + '|' + a;
    if (seen.has(key)) continue; seen.add(key); edges.push([a, b]);
  }
  let onLevel = 0, onVertical = 0, offEdge = 0, maxOff = 0, skippedCenters = 0;
  const kinds = m.vertexKinds || [];
  for (let v = 0; v < verts; v++) {
    if (kinds[v] === 0) { skippedCenters++; continue; }   // 环扇形中心点：内部辅助点，不参与「只在格边上」的口径
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let isLevel = false;
    for (const ly of levelsY) if (Math.abs(y - ly) < 1e-6) { isLevel = true; break; }
    let d = Infinity;
    if (isLevel) for (const [a, b] of edges) { const t = segDist(x, z, a[0], a[1], b[0], b[1]); if (t < d) d = t; }
    else for (const a of corners) { const t = Math.hypot(x - a[0], z - a[1]); if (t < d) d = t; }
    if (d < 1e-6) { if (isLevel) onLevel++; else onVertical++; } else { offEdge++; maxOff = Math.max(maxOff, d); }
  }
  // ③ 拓扑：闭合网格的 Euler 示性数 → 洞（拱洞/隧道）个数 g=(2-χ)/2
  const em = new Map();
  for (let i = 0; i < I.length; i += 3) for (let k = 0; k < 3; k++) {
    const a = I[i + k], b = I[i + (k + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a;
    em.set(key, (em.get(key) || 0) + 1);
  }
  const E = em.size;
  let boundary = 0, nonManifold = 0;
  for (const [, n] of em) { if (n === 1) boundary++; if (n > 2) nonManifold++; }
  const chi = verts - E + tris, genus = (2 - chi) / 2;
  // ④ 朝下的面（底面）落在几个不同层高 → 底面阶梯化
  const downLevels = new Set();
  let downFaces = 0;
  for (let i = 0; i < I.length; i += 3) {
    const p = [0, 1, 2].map((k) => [P[I[i + k] * 3], P[I[i + k] * 3 + 1], P[I[i + k] * 3 + 2]]);
    const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
    const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const L = Math.hypot(nx, ny, nz) || 1;
    if (ny / L < -0.85) { downFaces++; downLevels.add(+p[0][1].toFixed(4)); }
  }
  // ⑤ slab 口径：挤出厚板 = 只有水平盖（顶/底，压扁层里的 marching squares 填充）+ 竖墙，不允许任何斜面
  let walls = 0, caps = 0, slanted = 0;
  for (let i = 0; i < I.length; i += 3) {
    const p = [0, 1, 2].map((k) => [P[I[i + k] * 3], P[I[i + k] * 3 + 1], P[I[i + k] * 3 + 2]]);
    const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
    const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const L = Math.hypot(nx, ny, nz) || 1;
    const up = Math.abs(ny) / L;
    if (up > 0.99) caps++; else if (up < 1e-3) walls++; else slanted++;
  }
  return {
    verts, tris, vertsPerTri: verts / tris, closed: m.closed, boundaryEdges: m.boundaryEdges, nonManifoldEdges: m.nonManifoldEdges,
    onLevel, onVertical, offEdge, maxOff, skippedCenters, fanCenters: m.fanCenters || 0, E, chi, genus, boundary, nonManifold,
    downFaces, downLevelCount: downLevels.size, downLevels: [...downLevels].sort((a, b) => a - b),
    walls, caps, slanted, minY: Math.min(...Array.from({ length: verts }, (_, v) => P[v * 3 + 1])), maxY: Math.max(...Array.from({ length: verts }, (_, v) => P[v * 3 + 1])),
  };
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // ── 1. cubes 满场：闭合 / 朝外 / 顶点全部落在格边上 / 有拱洞 / 底面阶梯
  await p.goto(base + '/marching-cubes.html?mode=cubes&t=1&still=1');
  await p.waitForFunction(() => window.marchReview && window.marchReview.triangles > 0);
  const cubesReview = await p.evaluate(() => ({ ...window.marchReview, mesh: window.marchReview.mesh() }));
  const C = analyze(cubesReview.mesh);
  if (!C.closed || C.boundaryEdges !== 0 || C.nonManifoldEdges !== 0) fail(`cubes 不闭合：${JSON.stringify(C)}`);
  if (!(cubesReview.volume > 0)) fail('cubes 体积不为正（法向朝内）');
  if (C.offEdge !== 0) fail(`有 ${C.offEdge} 个顶点不在格边上（最大偏离 ${C.maxOff}）`);
  if (C.onVertical < 1) fail('没有任何交点落在竖边（层间）上');
  if (!(C.vertsPerTri < 1)) fail(`顶点未焊接：verts/tris=${C.vertsPerTri}`);
  if (!(C.genus >= 1)) fail(`闭合壳没有隧道（genus=${C.genus}）`);
  if (!(C.downLevelCount >= 2)) fail(`底面只有 ${C.downLevelCount} 个层高，未阶梯化`);
  await p.screenshot({ path: path.join(out, 'march-cubes-cubes-t1.png') });
  results.push({ mode: 'cubes', k: cubesReview.k, total: cubesReview.total, triangles: C.tris, vertices: C.verts, volume: +cubesReview.volume.toFixed(3), cellsTouched: cubesReview.cellsTouched, closed: C.closed, euler: C.chi, genus: C.genus, onLevel: C.onLevel, onVertical: C.onVertical, downLevels: C.downLevelCount, cells: cubesReview.cells });

  // ── 2. 生长：每一档都闭合，三角/体积单调不减（片子是「从一点长成脊桥」）
  const growth = [];
  let lastTris = 0, lastVol = 0;
  for (const t of [0.02, 0.15, 0.35, 0.6, 0.85, 1]) {
    const g = await p.evaluate((x) => { window.marchReview.setProgress(x); return { k: window.marchReview.k, tris: window.marchReview.triangles, closed: window.marchReview.closed, be: window.marchReview.boundaryEdges, vol: window.marchReview.volume }; }, t);
    if (!g.closed || g.be !== 0) fail(`生长 ${t} 不闭合：${JSON.stringify(g)}`);
    if (g.tris < lastTris - 1e-9) fail(`生长 ${t} 三角数回退 ${lastTris}→${g.tris}`);
    if (g.vol < lastVol - 1e-9) fail(`生长 ${t} 体积回退 ${lastVol}→${g.vol}`);
    lastTris = g.tris; lastVol = g.vol;
    growth.push({ t, k: g.k, tris: g.tris, closed: g.closed, vol: +g.vol.toFixed(3) });
  }
  if (!(growth[0].tris > 0)) fail('生长起点没有等值面');
  await p.evaluate(() => window.marchReview.setProgress(0.35));
  await p.screenshot({ path: path.join(out, 'march-cubes-cubes-t035.png') });
  results.push({ growth });

  // ── 3. 像素 A/B：空场 vs 满场，红实体的像素量 + 同状态噪声底
  await p.goto(base + '/marching-cubes.html?mode=cubes&t=0&still=1');
  await p.waitForFunction(() => window.marchReview && window.marchReview.k === 0);
  const shotEmpty = await p.screenshot();
  fs.writeFileSync(path.join(out, 'march-cubes-empty.png'), shotEmpty);
  await p.evaluate(() => window.marchReview.setProgress(1));
  await p.waitForTimeout(120);
  const shotFull = await p.screenshot();
  const shotFull2 = await p.screenshot();
  const px = await p.evaluate(async ([a64, b64, c64]) => {
    const load = (s) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + s; });
    const [a, bb, c] = await Promise.all([load(a64), load(b64), load(c64)]);
    const cv = document.createElement('canvas'); cv.width = a.width; cv.height = a.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const grab = (im) => { ctx.clearRect(0, 0, a.width, a.height); ctx.drawImage(im, 0, 0); return ctx.getImageData(0, 0, a.width, a.height).data; };
    const da = grab(a), db = grab(bb), dc = grab(c);
    const isRed = (d, i) => d[i] > 90 && d[i] > d[i + 1] + 45 && d[i] > d[i + 2] + 45;
    let redEmpty = 0, redFull = 0, noise = 0;
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (isRed(da, i)) redEmpty++;
      if (isRed(db, i)) redFull++;
      if (Math.abs(db[i] - dc[i]) + Math.abs(db[i + 1] - dc[i + 1]) + Math.abs(db[i + 2] - dc[i + 2]) > 24) noise++;
    }
    return { redEmpty, redFull, noise };
  }, [shotEmpty.toString('base64'), shotFull.toString('base64'), shotFull2.toString('base64')]);
  if (!(px.redEmpty < 50)) fail(`空场仍有红色 ${px.redEmpty}px`);
  if (!(px.redFull > 20000)) fail(`满场红色只有 ${px.redFull}px`);
  if (!(px.noise < 500)) fail(`同状态噪声 ${px.noise}px 过大`);
  results.push({ pixels: px });

  // ── 4. slab：区域四边格 + 挤出厚板，中间层只有竖墙、顶/底平
  await p.goto(base + '/marching-cubes.html?mode=slab&t=1&still=1');
  await p.waitForFunction(() => window.marchReview && window.marchReview.triangles > 0);
  const slabReview = await p.evaluate(() => ({ ...window.marchReview, mesh: window.marchReview.mesh() }));
  const S = analyze(slabReview.mesh);
  if (!S.closed) fail(`slab 不闭合：${JSON.stringify(S)}`);
  if (!(slabReview.volume > 0)) fail('slab 体积不为正');
  if (!(S.walls > 20)) fail(`slab 竖墙三角只有 ${S.walls}`);
  if (S.slanted !== 0) fail(`slab 中间层有 ${S.slanted} 个斜面（应为纯竖墙）`);
  // 二值场 iso=.5 → 顶/底盖落在层间中点：0.02 压扁层中点 0.01、顶层 0.45→0.47 中点 0.46，板厚应等于 levelHeight
  const slabThick = S.maxY - S.minY;
  if (!(Math.abs(slabThick - 0.45) < 1e-3)) fail(`slab 板厚 ${slabThick} ≠ levelHeight 0.45（minY=${S.minY} maxY=${S.maxY}）`);
  if (!(S.caps > 20)) fail(`slab 顶/底盖三角只有 ${S.caps}`);
  if (slabReview.cells !== 72) fail(`slab 区域格数 ${slabReview.cells} ≠ 72`);
  await p.screenshot({ path: path.join(out, 'march-cubes-slab-t1.png') });
  results.push({ mode: 'slab', cells: slabReview.cells, triangles: S.tris, walls: S.walls, caps: S.caps, slanted: S.slanted, minY: +S.minY.toFixed(3), maxY: +S.maxY.toFixed(3), closed: S.closed, volume: +slabReview.volume.toFixed(3) });

  fs.writeFileSync(path.join(out, 'marching-cubes-browser.json'), JSON.stringify({ results, errors }, null, 2));
  await b.close();
  if (errors.length) fail(errors.join('\n'));
  console.log('PASS marching-cubes browser', JSON.stringify(results.map((r) => r.mode ? { mode: r.mode, tris: r.triangles } : r.growth ? { growth: r.growth.at(-1) } : r.pixels)));
})().catch((e) => { console.error(e); process.exit(1); });
