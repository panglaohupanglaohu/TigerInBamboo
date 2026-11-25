// r201 · 807256278154301441 平顶平台档（world.flatRoofs）
// 片内：五层砖塔每层顶面都是**平台**（同一暖橙面、无脊线、无两面明暗差），临空边一圈矮护墙 + 浅色压顶，
// 护墙下一道白腰线，平台上直接坐烟囱，没有一处坡顶/山墙。
// 本测从 buildings.js 的真管线上量三件事：
//   ① 默认档（不设 flatRoofs）与设 false 逐字节同几何、无 flatTerraces 账 → 零回归；
//   ② 开档后每格「恰好落在 h*L 高度上的水平面」面积 == 该格多边形面积（平台板），而默认档该量 ≈ 0；
//   ③ 沿临空边的护墙段数/长度与独立重算的「露边」逐条相同（不多算内部相邻边，不漏算外圈边）。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';

const { L } = F;
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.z - q.x * p.z; } return Math.abs(a) / 2; };

/** 用真 MeshWriter 走一遍 buildBuildings，按「当前格」归集三角形 → 每格的顶面水平面积 / 最高点。 */
function perCell(w, flags) {
  const old = {}; for (const [k, v] of Object.entries(flags)) { old[k] = w[k]; w[k] = v; }
  const m = new F.MeshWriter();
  let cur = null;
  m.at = (c) => { cur = c; };
  const tris = [];
  const tri = m.tri.bind(m);
  m.tri = (a, b, c, dir, color, ...rest) => { if (cur) tris.push({ id: cur.id, a, b, c, color }); return tri(a, b, c, dir, color, ...rest); };
  const r = F.buildBuildings(m, w, { L });
  for (const k of Object.keys(flags)) w[k] = old[k];
  const byCell = new Map();
  for (const t of tris) {
    let rec = byCell.get(t.id); if (!rec) byCell.set(t.id, (rec = { maxY: -Infinity, minY: Infinity, upByY: new Map() }));
    const ys = [t.a[1], t.b[1], t.c[1]];
    rec.maxY = Math.max(rec.maxY, ...ys); rec.minY = Math.min(rec.minY, ...ys);
    const ax = t.b[0] - t.a[0], az = t.b[2] - t.a[2], bx = t.c[0] - t.a[0], bz = t.c[2] - t.a[2];
    const ar = Math.abs(ax * bz - az * bx) / 2;
    if (ys.every((y) => Math.abs(y - ys[0]) < 1e-9)) {                                  // 按高度归集水平面
      const key = ys[0].toFixed(6); rec.upByY.set(key, (rec.upByY.get(key) ?? 0) + ar);
    }
    rec.tris = (rec.tris ?? 0) + 1;
  }
  return { r, verts: m.pos.length / 3, byCell, tris };
}

/** 独立重算：region 的每一格有几条「露边」（邻格不在本 region 且不更高）。 */
function exposedEdges(w, region) {
  const ids = new Set(region.cells.map((c) => c.id));
  let segs = 0, len = 0;
  for (const c of region.cells) for (let i = 0; i < c.n; i++) {
    const nb = w.neighbor(c, i);
    if (nb && ids.has(nb.id)) continue;
    if (nb && w.top(nb) > region.h) continue;
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l < 1e-4) continue;
    segs++; len += l;
  }
  return { segs, len };
}

let regions = 0, cells = 0, rimSegs = 0, chimneys = 0, checkedDeck = 0;
for (const kind of ['quad', 'mixed']) {
  for (const [scene, seed] of [['town', 7], ['town', 11], ['fusion', 7]]) {
    const w = F.world(kind, scene, seed);
    const before = F.voxels(w);
    const off = perCell(w, {});
    const off2 = perCell(w, { flatRoofs: false });
    assert.deepEqual(F.voxels(w), before, 'build must not touch the world');
    // ① 默认档零变化
    assert.equal(off.verts, off2.verts, 'flatRoofs:false 与未设逐顶点相同');
    assert.equal(off.r.roofStats.flatTerraces, undefined, '默认档不得出 flatTerraces 账');
    assert.equal(off2.r.roofStats.flatTerraces, undefined);

    const flat = perCell(w, { flatRoofs: true });
    const st = flat.r.roofStats;
    assert.ok(st.flatRegions > 0, `${kind}/${scene}: 平台区数 > 0`);
    assert.ok(st.flatRimSegments > 0, `${kind}/${scene}: 护墙段 > 0`);
    assert.equal(st.flatRegions, st.flatTerraces.length);
    assert.equal(st.flatCells, st.flatTerraces.reduce((s, r) => s + r.cells, 0));
    assert.equal(st.flatRimSegments, st.flatTerraces.reduce((s, r) => s + r.rimSegments, 0));
    assert.ok(Math.abs(st.flatDeckArea - st.flatTerraces.reduce((s, r) => s + r.deckArea, 0)) < 1e-9);
    assert.ok(flat.verts > off.verts, `${kind}/${scene}: 平台档多了护墙/腰线几何（${off.verts} → ${flat.verts}）`);
    assert.equal(off.r.roofStats.flatChimneys, undefined);

    // ②③ 逐区核对
    const { regions: regs } = w.regions();
    const flatRegions = regs.filter((r) => r.h >= 2);
    for (const reg of flatRegions) {
      const minId = Math.min(...reg.cells.map((c) => c.id));
      const rec = st.flatTerraces.find((x) => x.minId === minId);
      assert.ok(rec, '每个 h>=2 的 region 都有平台账');
      const exp = exposedEdges(w, reg);
      assert.equal(rec.rimSegments, exp.segs, `${kind}/${scene}: 护墙段 == 独立重算露边数（h=${reg.h}）`);
      assert.ok(Math.abs(rec.rimLength - exp.len) < 1e-9, '护墙长度 == 露边长度');
      assert.equal(rec.gables, 0, '平台档不出山墙');
      assert.ok(rec.maxY <= reg.h * L + 0.34, '平台档不超 base+0.34（护墙 0.062 + 烟囱 ≤0.25）');
      // 平台板：该区每格在 base 高度上的水平面积 == 格面积
      for (const c of reg.cells) {
        const cell = flat.byCell.get(c.id);
        assert.ok(cell, 'flat: cell visited');
        const want = area(c.pts), got = cell.upByY.get((reg.h * L).toFixed(6)) ?? 0;
        assert.ok(Math.abs(got - want) < 1e-6, `${kind}/${scene}: 格 ${c.id} 平台面积 ${got} vs ${want}`);
        checkedDeck++;
      }
      regions++; cells += reg.cells.length; rimSegs += exp.segs; chimneys += rec.chimneys;
    }
    // 默认档：h>=2 的建筑格没有「整片水平顶面」（坡顶中心高、檐口只有竖面）
    let defaultDeck = 0;
    for (const reg of flatRegions) for (const c of reg.cells) defaultDeck += off.byCell.get(c.id)?.upByY.get((reg.h * L).toFixed(6)) ?? 0;
    assert.ok(defaultDeck < 0.5, `${kind}/${scene}: 默认档屋顶无水平整板（实测 ${defaultDeck.toFixed(4)}）`);
  }
}
assert.ok(regions > 10 && checkedDeck > 40, `覆盖面（区 ${regions} / 格 ${checkedDeck}）`);
assert.ok(rimSegs > 20 && chimneys > 0, `护墙段 ${rimSegs} / 烟囱 ${chimneys}`);
console.log(JSON.stringify({ regions, cells: checkedDeck, rimSegs, chimneys }, null, 2));
console.log('PASS flat-terraces');
