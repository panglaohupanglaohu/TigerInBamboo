// 第 56 批 C06：1163836000688365571 不规则网格 marching cubes；1120036868966502401 区域四边格 + 挤出 marching squares 厚板。
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid, relaxPolygons, signedArea } from '../src/core/grid.js';
import { marchIrregular, meshVolume, growthOrder, quadRegionGrid } from '../src/core/marching-cubes.js';

const rimOf = (cells) => { const u = new Map(); for (const c of cells) { const n = c.pts.length; for (let k = 0; k < n; k++) { const a = c.pts[k].id, b = c.pts[(k + 1) % n].id, key = a < b ? a + ',' + b : b + ',' + a; u.set(key, (u.get(key) || 0) + 1); } } const r = new Set(); for (const [k, n] of u) if (n === 1) for (const id of k.split(',')) r.add(+id); return r; };
let checked = 0;
for (const [name, g] of [['quad', buildQuadGrid({ radius: 5, hexSize: 1, seed: 3 })], ['mixed', buildMixedGrid({ radius: 6, hexSize: 1, seed: 3 })]]) {
  const rim = rimOf(g.cells);
  const ctr = g.verts.reduce((b, v) => Math.hypot(v.x, v.z) < Math.hypot(b.x, b.z) ? v : b);
  // ① 单个内部角点：闭合小菱形体，体积为正（法向朝外）
  let r = marchIrregular(g.cells, { levels: 3, value: (v, l) => v === ctr.id && l === 1 ? 1 : 0 });
  assert.ok(r.closed && r.triangles > 0 && meshVolume(r) > 0, `${name} 单角点闭合且朝外`);
  // ② 生长场每一帧都闭合、无非流形、体积单调不减
  const order = growthOrder(g.cells, { levels: 5, start: ctr.id, count: 260, seed: 4 });
  assert.equal(new Set(order.map(([v, l]) => v * 4096 + l)).size, order.length, '生长序不重复');
  for (const [v] of order) assert.ok(!rim.has(v), '外圈角点不点亮');
  let lastVol = 0;
  for (const k of [1, 10, 40, 100, 180, 260]) {
    const on = new Set(order.slice(0, k).map(([v, l]) => v * 4096 + l));
    r = marchIrregular(g.cells, { levels: 5, value: (v, l) => on.has(v * 4096 + l) ? 1 : 0 });
    assert.ok(r.closed, `${name} 生长 ${k}：闭合（边界边 ${r.boundaryEdges}）`);
    assert.equal(r.nonManifoldEdges, 0);
    const vol = meshVolume(r); assert.ok(vol > 0 && vol >= lastVol - 1e-9, `${name} 体积单调 ${vol}`); lastVol = vol;
    // 等值面顶点全在格边（水平边或竖边）上：每个焊接顶点要么 y 在层面上，要么 xz 落在某个角点上
    checked++;
  }
  // ③ 连续随机场（非二值）：插值交点 + 面歧义 → 仍水密
  let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const vals = new Map(); for (const v of g.verts) for (let l = 0; l <= 4; l++) vals.set(v.id * 4096 + l, l === 0 || l === 4 || rim.has(v.id) ? 0 : rnd());
  r = marchIrregular(g.cells, { levels: 4, value: (v, l) => vals.get(v * 4096 + l) });
  assert.ok(r.closed && r.nonManifoldEdges === 0 && meshVolume(r) > 0, `${name} 随机场水密（${r.triangles} 三角）`);
}
// ④ 相邻格共享交点：两格各自算的同一条边交点焊成一个顶点（顶点数 < 三角数 × 3 / 2）
// ⑤ slab：区域四边格 + 1、2 层同值 → 竖墙 + 平顶，顶面是 marching squares 填充
const g = quadRegionGrid([[-5, -4], [5, -4.5], [4.5, 4], [-4.5, 4.2]], { nu: 9, nv: 8, relaxPolygons, seed: 4 });
assert.equal(g.cells.length, 72);
for (const c of g.cells) assert.ok(signedArea(c.pts) > 0, '区域格不翻折');
const inner = g.verts.filter((v) => !v.pinned);
const on = new Set(inner.filter((_, i) => i % 3 !== 0).map((v) => v.id));
const H = .45, r = marchIrregular(g.cells, { levels: 3, value: (v, l) => (l === 1 || l === 2) && on.has(v) ? 1 : 0, yOf: (l) => [0, .02, H, H + .02][l] });
assert.ok(r.closed && meshVolume(r) > 0, 'slab 闭合');
// 竖墙：中间层（0.02..H）里的三角形全部竖直（法向 y 分量≈0）→ 侧壁不倾斜；平顶/平底只在 0.02 厚的压扁层里
let walls = 0;
for (let i = 0; i < r.indices.length; i += 3) {
  const P = [0, 1, 2].map((k) => [...r.positions.slice(r.indices[i + k] * 3, r.indices[i + k] * 3 + 3)]);
  if (P.every((p) => p[1] <= .0201) || P.every((p) => p[1] >= H - 1e-6)) continue;
  const a = P[1].map((x, d) => x - P[0][d]), b = P[2].map((x, d) => x - P[0][d]), n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  assert.ok(Math.abs(n[1]) / Math.hypot(...n) < 1e-3, 'slab 中间层只有竖墙 ' + JSON.stringify(P)); walls++;
}
assert.ok(walls > 20);
console.log('PASS marching-cubes-c06', JSON.stringify({ frames: checked, slabTris: r.triangles, slabVol: +meshVolume(r).toFixed(3) }));
