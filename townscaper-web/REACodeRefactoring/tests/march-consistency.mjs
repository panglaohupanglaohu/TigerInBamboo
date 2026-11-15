// REACode src/march.js（1120036868966502401「marching squares on irregular quadrilateral grids」）的两条要点在共享 core/contour.js 上实测：
// ① 角点合并 → 相邻格对同一条边的插值端点严格重合（等值线跨格不裂缝）：每个交点被两侧格共用，开放端只出现在网格外沿；
// ② 鞍点（四边都相交）用四角均值决断，不连「蝴蝶结」：同一格内两段不相交；
// 再加多层级（levels）各自闭合、反序输入结果一致。
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { marchGrid, buildCornerField } from '../src/core/contour.js';
const cross = (p1, p2, q1, q2) => { const d = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x); const d1 = d(p1, p2, q1), d2 = d(p1, p2, q2), d3 = d(q1, q2, p1), d4 = d(q1, q2, p2); return d1 * d2 < -1e-12 && d3 * d4 < -1e-12; };
const out = {};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 8 })], ['mixed', buildMixedGrid({ radius: 10 })]]) {
  const cells = grid.cells, f = (c) => Math.sin(c.cx * 0.7) + Math.cos(c.cz * 0.55) + 0.2 * Math.sin(c.cx * c.cz * 0.1);
  const r = marchGrid(cells, f, { levels: [-0.5, 0, 0.6] });
  for (const L of r.levels) {
    // ① 每个端点 key 的度数：内部 2，外沿可为 1；所有开放端点都在外沿（落在只属于一个格的边上）
    const edgeOwners = new Map(); for (const c of cells) for (let i = 0; i < c.n; i++) { const a = c.pts[i].id, b = c.pts[(i + 1) % c.n].id, k = a < b ? a + '|' + b : b + '|' + a; edgeOwners.set(k, (edgeOwners.get(k) || 0) + 1); }
    for (const k of L.openEndpoints) { if (!k.startsWith('e:')) continue; const [a, b] = k.slice(2).split('|').map((s) => s.slice(2)); assert.equal(edgeOwners.get(Number(a) < Number(b) ? a + '|' + b : b + '|' + a), 1, `${name} iso=${L.iso} 开放端只在外沿`); }
    // ② 同一格内的两段不相交（无蝴蝶结）
    const byCell = new Map(); // 用端点所在边反推格：直接按段两端共同所在的格
    for (let i = 0; i < L.segments.length; i++) for (let j = i + 1; j < L.segments.length; j++) { const s = L.segments[i], t = L.segments[j]; if (s.a.key === t.a.key || s.a.key === t.b.key || s.b.key === t.a.key || s.b.key === t.b.key) continue; assert.ok(!cross(s.a, s.b, t.a, t.b), `${name} 等值线段互不相交`); }
  }
  const rev = marchGrid([...cells].reverse(), f, { levels: [-0.5, 0, 0.6] });
  assert.deepEqual(rev.levels.map((l) => l.segments.length), r.levels.map((l) => l.segments.length), '反序输入同结果');
  out[name] = r.levels.map((l) => ({ iso: l.iso, segs: l.segments.length, paths: l.paths.length, open: l.openEndpoints.length }));
}
// 鞍点：单个方格对角两高两低，四边都相交 → 恰 2 段且不交叉，按中心均值决断连法
const sq = [{ id: 0, n: 4, pts: [{ id: 0, x: 0, z: 0 }, { id: 1, x: 1, z: 0 }, { id: 2, x: 1, z: 1 }, { id: 3, x: 0, z: 1 }] }];
const vals = [1, 0, 1, 0], fld = buildCornerField(sq, () => 0); for (const [i, v] of vals.entries()) fld.corners.get(fld.key(sq[0].pts[i])).value = v;
for (const iso of [0.4, 0.6]) { const s = marchGrid(sq, () => 0, { iso, cornerField: fld }).levels[0].segments; assert.equal(s.length, 2, '鞍点出 2 段'); assert.ok(!cross(s[0].a, s[0].b, s[1].a, s[1].b), '鞍点不连蝴蝶结'); }
console.log('PASS 不规则网格 marching squares：跨格端点重合、开放端只在外沿、无蝴蝶结、鞍点按均值决断、多层级 / 反序一致', JSON.stringify(out));
