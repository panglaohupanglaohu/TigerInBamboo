// 第 53 批 G5 · 816748103193817088「I'm flowing right on the nav mesh, so it depends」。REACode/src/flowfield.js 是格级反向 Dijkstra；
// 片子（479 帧）里人群在导航面内连续地流。本文件把 world/navmesh-flow.js 的顶点距离场 / 面内连续流向 / 百人群体
// 接到 Battle 实际用的分层图（navMeshFromLayeredGraph），双网格量：结构、过边连续性、群体到达、Battle 可选连续转向。
import assert from 'node:assert/strict';
import { makeIsland, Battle } from './fixtures/g5-battle.mjs';
import { navMeshFromLayeredGraph, buildVertexField, buildFaceDirs, flowAt, stepCrowd } from '../src/world/navmesh-flow.js';
const report = {};
for (const kind of ['quad', 'mixed']) {
  const { world, view } = makeIsland(kind, 7);
  const b = new Battle(view); b.start(world); b.nextWave = 1e9;
  const nav = b.navigation; nav.refresh(); const g = nav.graph;
  const mesh = navMeshFromLayeredGraph(g);
  // ① 结构：一节点一面；跨层边两端各一条 link；同层但图里没连的边断开
  assert.equal(mesh.polys.length, g.nodes.length);
  const cross = g.nodes.reduce((s, a) => s + g.adj[a.id].filter((e) => g.nodes[e.to].floor !== a.floor).length, 0);
  assert.equal(mesh.links.length, cross * 2);
  for (const p of mesh.polys) for (const q of p.nb) if (q >= 0) assert.ok(g.adj[p.id].some((e) => e.to === q) || g.adj[q].some((e) => e.to === p.id), '面邻接 ⊆ 图邻接');
  assert.ok(mesh.polys.every((p) => p.vs.every((v) => Math.abs(mesh.verts[v].y - g.nodes[p.id].floor * .5) < 1e-12)), '面高 = floor·L');
  // ② 距离场 + 过边连续：同层共享边两侧取点，流向夹角
  const goal = nav.unitNode(b.squads[0].members[0]);
  const field = buildVertexField(mesh, { goalPolys: [goal.id] }), fd = buildFaceDirs(mesh, field);
  const edgeDiffs = (dirs) => { const diffs = [];
  for (const p of mesh.polys) for (let i = 0; i < p.vs.length; i++) {
    const q = p.nb[i]; if (q < p.id || g.nodes[q].floor !== g.nodes[p.id].floor) continue;
    const A = mesh.verts[p.vs[i]], B = mesh.verts[p.vs[(i + 1) % p.vs.length]], mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
    const P = mesh.polys[p.id], Q = mesh.polys[q], toP = [P.cx - mx, P.cz - mz], toQ = [Q.cx - mx, Q.cz - mz];
    const lp = Math.hypot(...toP), lq = Math.hypot(...toQ);
    const fp = flowAt(mesh, field, p.id, mx + toP[0] / lp * 1e-4, mz + toP[1] / lp * 1e-4, dirs), fq = flowAt(mesh, field, q, mx + toQ[0] / lq * 1e-4, mz + toQ[1] / lq * 1e-4, dirs);
    if (!(fp[0] || fp[1]) || !(fq[0] || fq[1])) continue;
    diffs.push(Math.acos(Math.max(-1, Math.min(1, fp[0] * fq[0] + fp[1] * fq[1]))));
  }
  diffs.sort((a, c) => a - c); return diffs; };
  const diffs = edgeDiffs(fd), perFace = edgeDiffs(null), q = (d, k) => d[Math.floor(d.length * k)];
  const p90 = q(diffs, .9), med = q(diffs, .5);
  // 共边带混合：边中点两侧在小格（混合网格 ~0.6）里还会混进相邻边，所以不是严格 0；对照逐面常量
  assert.ok(diffs.length > 100 && med < .1 && p90 < q(perFace, .9) * .35, `${kind}: 同层共享边两侧流向近似连续（中位 ${med.toFixed(3)} / p90 ${p90.toFixed(3)} rad，逐面常量 p90 ${q(perFace, .9).toFixed(3)}）`);
  // 不加离墙偏置时（原 navmesh-flow 的顶点场）对照
  const bare = { ...mesh, vertexBias: null }, fb = buildVertexField(bare, { goalPolys: [goal.id] });
  // ③ 群体：24 人从同一连通块各处出发，在导航面内流向目标
  const comp = g.stats().componentOf;
  const cands = g.nodes.filter((n) => comp(n.id) === comp(goal.id) && n.id !== goal.id && mesh.polys[n.id].vs.every((v) => Number.isFinite(field.dist[v])));
  const crowd = (F, dirs) => {
    const agents = []; for (let i = 0; i < 24; i++) { const n = cands[(i * 37) % cands.length]; agents.push({ x: n.cell.cx, z: n.cell.cz, y: n.floor * .5, poly: n.id }); }
    const gx = goal.cell.cx, gz = goal.cell.cz; let left = 0, t = 0;
    for (; t < 1800; t++) { left += stepCrowd(mesh, { ...F, goal: { x: gx, z: gz, r: .6 } }, agents, 1 / 30, { speed: 1, radius: .06, faceDirs: dirs }).left; if (agents.every((a) => Math.hypot(a.x - gx, a.z - gz) < 1.2)) break; }
    assert.ok(agents.every((a) => Math.abs(a.y - g.nodes[a.poly].floor * .5) < 1e-9), '高度 = 所在面平面');
    return { left, seconds: +(t / 30).toFixed(1), arrived: agents.filter((a) => Math.hypot(a.x - gx, a.z - gz) < 1.2).length };
  };
  const withBias = crowd(field, fd), noBias = crowd(fb, buildFaceDirs(bare, fb));
  assert.equal(withBias.left, 0, '没人走出导航面');
  assert.ok(withBias.arrived >= 22, `${kind}: 24 人里 ≥22 人流到目标 ${JSON.stringify(withBias)}`);
  assert.ok(withBias.arrived >= noBias.arrived, '离墙偏置不比原顶点场差');
  // ④ Battle 可选连续转向：开 continuousFlow 后单位仍全部留在可站区域，流向前视确实被采用
  let used = 0; const orig = nav.flowAim.bind(nav); nav.flowAim = (...a) => { const r = orig(...a); if (r) used++; return r; };
  nav.continuousFlow = true;
  for (const sq of b.squads) { const lead = sq.members[0], here = nav.unitNode(lead); let best = null; for (const n of g.nodes) { if (n.floor !== here.floor || n.floor !== world.top(n.cell)) continue; const p = nav.plan(lead, n.cell, n.floor); if (p && (!best || p.distance > best.d)) best = { n, d: p.distance }; } sq.goal = best.n.cell; sq.goalFloor = best.n.floor; }
  for (let i = 0; i < 600; i++) b.update(1 / 30);
  assert.ok(used > 500, `连续流向被采用 ${used} 次`);
  assert.ok(b.units.filter((u) => !u.dead).every((u) => nav.unitNode(u)), '没人走出分层图');
  report[kind] = { polys: mesh.polys.length, links: mesh.links.length, edges: diffs.length, median: +med.toFixed(4), p90: +p90.toFixed(4), perFaceP90: +q(perFace, .9).toFixed(4), crowd: withBias, crowdNoBias: noBias, battleFlowSteers: used };
}
console.log('PASS 分层图→导航面、跨层 link、过边连续、24 人群体流到目标（离墙偏置）、Battle 可选连续转向', JSON.stringify(report));
