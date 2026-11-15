// 第 55 批 G3 · 816748103193817088「I'm flowing right on the nav mesh, so it depends」。
// 第 53 批遗留：顶点距离场的鞍点把纯连续流的人困住（24 人 22–23 到）。guardedFlowAt 只在「连续流向要出的边是墙 /
// 树距离不下降」时改走面级树出口。量：双网格 × 3 个种子，24 人群体全部到达；被守卫接管的步数占比小（其余保持连续流）。
import assert from 'node:assert/strict';
import { makeIsland, Battle } from './fixtures/g5-battle.mjs';
import { navMeshFromLayeredGraph, buildVertexField, buildFaceDirs, buildPolyField, stepCrowd, guardedFlowAt, flowAt } from '../src/world/navmesh-flow.js';
const out = {};
let totalBare = 0, totalGuard = 0;
for (const kind of ['quad', 'mixed']) for (const seed of [7, 11, 23]) {
  const { world, view } = makeIsland(kind, seed);
  const b = new Battle(view); b.start(world); b.nextWave = 1e9;
  const nav = b.navigation; nav.refresh(); const g = nav.graph, mesh = navMeshFromLayeredGraph(g);
  const comp = g.stats().componentOf;
  const sizes = new Map(); for (const n of g.nodes) sizes.set(comp(n.id), (sizes.get(comp(n.id)) ?? 0) + 1);
  const main = [...sizes.entries()].sort((a, c) => c[1] - a[1])[0][0];
  const pool = g.nodes.filter((n) => comp(n.id) === main && n.floor === world.top(n.cell));
  // 目标：最大连通块里离岛心最远的地面节点（路径最长、最容易遇到鞍点）
  const goal = pool.reduce((a, c) => (Math.hypot(c.cell.cx, c.cell.cz) > Math.hypot(a.cell.cx, a.cell.cz) ? c : a));
  const field = buildVertexField(mesh, { goalPolys: [goal.id] }), fd = buildFaceDirs(mesh, field), pf = buildPolyField(mesh, goal.id);
  const cands = pool.filter((n) => n.id !== goal.id && Number.isFinite(pf.dist[n.id]) && mesh.polys[n.id].vs.every((v) => Number.isFinite(field.dist[v])));
  const crowd = (usePf) => {
    const agents = []; for (let i = 0; i < 24; i++) { const n = cands[(i * 37 + seed) % cands.length]; agents.push({ x: n.cell.cx, z: n.cell.cz, y: n.floor * .5, poly: n.id }); }
    const gx = goal.cell.cx, gz = goal.cell.cz; let left = 0, guarded = 0, steps = 0, t = 0;
    for (; t < 2400; t++) { const r = stepCrowd(mesh, { ...field, goal: { x: gx, z: gz, r: .6 } }, agents, 1 / 30, { speed: 1, radius: .06, faceDirs: fd, polyField: usePf ? pf : null }); left += r.left; guarded += r.guarded; steps += agents.length; if (agents.every((a) => Math.hypot(a.x - gx, a.z - gz) < 1.2)) break; }
    return { left, seconds: +(t / 30).toFixed(1), arrived: agents.filter((a) => Math.hypot(a.x - gx, a.z - gz) < 1.2).length, guardedShare: +(guarded / steps).toFixed(4) };
  };
  const bare = crowd(false), guard = crowd(true);
  out[kind + '/' + seed] = { bare, guard };
  console.log(kind, seed, JSON.stringify({ bare, guard }));
  assert.equal(guard.left, 0, '没人走出导航面');
  assert.equal(guard.arrived, 24, `${kind}/${seed}: 鞍点守卫后 24 人全部到达 ${JSON.stringify(guard)}（无守卫 ${JSON.stringify(bare)}）`);
  assert.ok(guard.guardedShare < .35, `${kind}/${seed}: 守卫只接管少数步（${guard.guardedShare}），其余仍是连续流`);
  totalBare += bare.arrived; totalGuard += guard.arrived;
}
assert.ok(totalGuard >= totalBare, '守卫不比无守卫差');
// 守卫的定义性质：被接管时一定朝树距离严格更小的面走（单调下降 → 不会在鞍点上来回）；没接管时与 flowAt 逐位相同
{
  const { world, view } = makeIsland('quad', 7); const b = new Battle(view); b.start(world); const nav = b.navigation; nav.refresh();
  const mesh = navMeshFromLayeredGraph(nav.graph), goal = nav.graph.nodes[0], field = buildVertexField(mesh, { goalPolys: [goal.id] }), fd = buildFaceDirs(mesh, field), pf = buildPolyField(mesh, goal.id);
  let checked = 0, same = 0, total = 0;
  for (const p of mesh.polys) { if (!Number.isFinite(pf.dist[p.id]) || p.id === goal.id) continue; const [dx, dz, gd] = guardedFlowAt(mesh, field, p.id, p.cx, p.cz, fd, pf); total++;
    if (!gd) { const f = flowAt(mesh, field, p.id, p.cx, p.cz, fd); if (Math.abs(f[0] - dx) < 1e-12 && Math.abs(f[1] - dz) < 1e-12) same++; continue; }
    const k = pf.exitEdge[p.id], q = p.nb[k]; assert.ok(pf.dist[q] < pf.dist[p.id], '树出口严格下降'); checked++; }
  assert.ok(same + checked === total && same > total * .6, `面心处 ${same}/${total} 保持连续流原值，${checked} 个被守卫接管`);
  out.centroids = { total, continuous: same, guarded: checked };
}
console.log('flow-saddle-guard: PASS', JSON.stringify(out.centroids));
