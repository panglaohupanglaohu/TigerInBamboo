// 第 55 批 G2：REACode edgesmooth.js "regularity() … should drop a lot" —— 未松弛网格上的方格目标松弛 + 边类层级。
// none / dumb / hierarchical 三块面板（1670725072540106755）：分层平滑让自由格规整度大降、硬线不动、陆地面积不漂；普通平滑把硬线拖走。
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { squareRelax, relaxMetrics, classifyWorldEdges, EDGE_ORDER } from '../src/terrain/edge-square-relax.js';
function island(kind, seed) {   // 与 edge-smooth.html 同一套：两级岩台 + 同高"房子"（tile 边）+ 两种墙色（material 边）
  const g = (kind === 'quad' ? buildQuadGrid : buildMixedGrid)({ radius: 8, seed, relaxPasses: 0 }), w = new World(g);
  for (const c of g.cells) { const r = Math.hypot(c.cx, c.cz); if (r < 6.6 + Math.sin(c.cz * 1.3 + seed) * .8) w.fill(c, r < 3.2 + Math.cos(c.cx * 1.1 + seed) ? 2 : 1, { rock: true }); }
  for (const c of g.cells) if (w.top(c) === 1 && Math.sin(c.cx * 1.6 + seed) * Math.cos(c.cz * 1.25 - seed) > .42) { w.fill(c, 1, {}); w.color[c.id] = c.cx > 0 ? 1 : 2; }
  return w;
}
const rows = {};
for (const kind of ['quad', 'mixed']) for (const seed of [3, 7]) {
  const w = island(kind, seed), cls = classifyWorldEdges(w), snap = JSON.stringify(w.grid.verts.map((v) => [v.x, v.z]));
  const counts = [0, 0, 0, 0]; for (const r of cls.vrank) counts[r]++;
  assert.ok(counts[EDGE_ORDER.HARD] > 0 && counts[EDGE_ORDER.FREE] > 0);
  const M = {}; for (const mode of ['none', 'dumb', 'hierarchical']) { const r = squareRelax(w, { mode, passes: 60, classification: cls }); M[mode] = relaxMetrics(w, r); M[mode].r = r; }
  assert.equal(JSON.stringify(w.grid.verts.map((v) => [v.x, v.z])), snap, '不改共享网格');
  assert.equal(M.none.hardShift, 0); assert.equal(M.none.landAreaDrift, 0);
  // 普通平滑：规整度降得最多，但硬线（台阶 / 海岸）被拖走、陆地面积漂
  assert.ok(M.dumb.regularity < M.none.regularity * .8); assert.ok(M.dumb.hardShift > .05, 'dumb moves hard lines ' + M.dumb.hardShift);
  // 分层平滑：硬线几乎不动（只沿自身滑）、面积不漂；自由格规整度接近普通平滑
  assert.ok(M.hierarchical.hardShift < M.dumb.hardShift * .4, 'hier keeps hard lines (only slides along them)');
  assert.ok(M.hierarchical.landAreaDrift < 1e-6, 'land area kept');
  assert.ok(M.hierarchical.regularity < M.none.regularity, 'overall regularity drops');
  assert.ok(M.hierarchical.regularityFree - M.dumb.regularityFree < 2.5, 'free cells nearly as square as dumb');
  // tile / material 点只沿自己的线走：每个滑动点到原折线（两邻居连线）的距离 ≈ 0
  const { X, Z } = M.hierarchical.r; let off = 0;
  const along = new Map(); for (const e of cls.edges) if (e.order === EDGE_ORDER.TILE && cls.vrank[e.a] === 1 && cls.vrank[e.b] === 1) { for (const [a, b] of [[e.a, e.b], [e.b, e.a]]) { if (!along.has(a)) along.set(a, []); along.get(a).push(b); } }
  for (const [v, nb] of along) { if (nb.length !== 2) continue; const p = w.grid.verts; const ax = p[nb[0]].x, az = p[nb[0]].z, bx = p[nb[1]].x, bz = p[nb[1]].z; const l = Math.hypot(bx - ax, bz - az); const d0 = Math.abs((bx - ax) * (p[v].z - az) - (bz - az) * (p[v].x - ax)) / l; const d1 = Math.abs((bx - ax) * (Z[v] - az) - (bz - az) * (X[v] - ax)) / l; off = Math.max(off, d1 - d0); }
  assert.ok(off < .08, 'tile verts slide along their border ' + off);
  rows[kind + seed] = { vrank: counts.join('/'), regularity: ['none', 'dumb', 'hierarchical'].map((m) => +M[m].regularity.toFixed(1)), free: ['none', 'dumb', 'hierarchical'].map((m) => +M[m].regularityFree.toFixed(1)), hardShift: [0, +M.dumb.hardShift.toFixed(3), +M.hierarchical.hardShift.toFixed(3)] };
}
// "大降"：未松弛四边形网格上，分层平滑的自由格规整度降 > 40%，全格 > 20%
for (const k of ['quad3', 'quad7']) { const r = rows[k]; assert.ok(r.free[2] < r.free[0] * .6, k + ' free ' + r.free); assert.ok(r.regularity[2] < r.regularity[0] * .8, k + ' all ' + r.regularity); }
// 有生成地形时同样成立（硬边很多：整体降得少，但自由格仍大降）
{ const g = buildQuadGrid({ radius: 8, seed: 5, relaxPasses: 0 }), w = new World(g); generateTerrain(w, { seed: 5 });
  const h = relaxMetrics(w, squareRelax(w, { mode: 'hierarchical', passes: 60 })), n = relaxMetrics(w, squareRelax(w, { mode: 'none' }));
  assert.ok(h.regularityFree < n.regularityFree * .6 && h.hardShift < .03); rows.terrain5 = { free: [+n.regularityFree.toFixed(1), +h.regularityFree.toFixed(1)], all: [+n.regularity.toFixed(1), +h.regularity.toFixed(1)] }; }
assert.throws(() => squareRelax(island('quad', 3), { mode: 'clever' }));
console.log(JSON.stringify(rows));
console.log('PASS edge-square-relax: regularity drops a lot on janky grids (hierarchical keeps hard lines/land area; dumb drags them)');
