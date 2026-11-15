// 1120036868966502401 · 格集合 → 沿格边的区域边界环（闭环 / 开放端 / 捏点支线）
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { regionBoundary } from '../src/core/region-boundary.js';

const report = {};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 8 })], ['mixed', buildMixedGrid({ radius: 10 })]]) {
  const cells = grid.cells;
  const R = Math.max(...cells.map((c) => Math.hypot(c.cx, c.cz)));
  // ① 一块圆形区域 + 一块分离的小区域：两个闭环，所有段恰好用一次，环首尾相同
  const inA = (c) => Math.hypot(c.cx - R * .2, c.cz) < R * .35 || Math.hypot(c.cx + R * .55, c.cz + R * .4) < R * .12;
  const r1 = regionBoundary(cells, inA);
  const len = (r) => [...r.loops, ...r.open, ...r.pinched].reduce((n, l) => n + l.length - 1, 0), used = len(r1);
  assert.equal(used, r1.segments.length, '每条边界段恰好走一次');
  assert.ok(r1.loops.length >= 2 && r1.open.length === 0, `两块区域 → 闭环（${r1.loops.length}）`);
  for (const l of r1.loops) assert.equal(l[0], l[l.length - 1], '闭环首尾相接');
  // 段都在格边上：端点是该格相邻两个格点
  for (const s of r1.segments) { const c = cells[s.cell]; assert.equal(c.pts[s.edge].id, s.a); assert.equal(c.pts[(s.edge + 1) % c.n].id, s.b); }
  // ② 区域碰到网格外沿、不画外沿 → 开放端
  const inB = (c) => c.cx > R * .45;
  const r2 = regionBoundary(cells, inB, { includeBorder: false });
  assert.ok(r2.open.length >= 1, `碰外沿 → 开放链（${r2.open.length}）`);
  const r2b = regionBoundary(cells, inB, { includeBorder: true });
  assert.ok(r2b.open.length === 0 && r2b.loops.length >= 1, '画外沿 → 闭合');
  // ③ 捏点：找两个只共享一个格点、不共享边的格，各自成区域 → 那个格点度 4（支线）
  let pinch = null;
  outer: for (const a of cells) for (const p of a.pts) for (const b of cells) { if (b.id <= a.id || a.edgeNeighbors.includes(b.id)) continue; if (b.pts.some((q) => q.id === p.id)) { pinch = [a.id, b.id, p.id]; break outer; } }
  assert.ok(pinch, '找到只在角上相接的两格');
  const r3 = regionBoundary(cells, (c) => c.id === pinch[0] || c.id === pinch[1]);
  assert.ok(r3.branch.includes(pinch[2]), '角上相接 → 捏点（度 4）');
  assert.equal(len(r3), r3.segments.length);
  assert.equal(r3.open.length, 0, '捏点不是开放端');
  report[name] = { cells: cells.length, segA: r1.segments.length, loopsA: r1.loops.length, openB: r2.open.length, branch: r3.branch.length };
}
console.log('PASS 格集合区域边界：沿格边、每段走一次、闭环 / 碰外沿开放端 / 角接捏点', JSON.stringify(report));
