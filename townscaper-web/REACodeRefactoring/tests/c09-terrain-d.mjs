// 第 56 批 C09-D：1654401054828638214 / 1579478470098243584 / 1579474420749725696 / 1448039167057879048 / 1447483550257799171
// 判据：
//  A. stroke-reveal-c09：3D 逐笔（排期复用共享 createStrokeReveal）单调、收尾=全长；线段串笔不丢长度；多层时间轴可逆；每轮换种子。
//  B. island-viz-c09：Bowyer–Watson 步骤里有超级三角形「帐篷」边、最终与 pipeline-stages.delaunay 一致且无违例；
//     等高线端点高度=等值；台地 AO 崖脚暗、高台亮；软阴影随太阳变低而变多。
//  C. 真实地形管线：terrain-strokes 来自 terrainSurface 的墙/顶；格笼线段弯曲；
//     cage-c09.cageWallPoint 与 terrainmesh 实际墙面同一张面（terrain-collide 切墙距离≈0）；
//     cageCollider 的 3D 包含/推出与 terrain-collide 互证。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));

const SR = await import('../src/core/stroke-reveal-c09.js');
const IV = await import('../src/terrain/island-viz-c09.js');
const PS = await import('../src/terrain/pipeline-stages.js');
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { terrainCollider } = await import('../src/terrain/terrain-collide.js');
const TS = await import('../src/terrain/terrain-strokes-c09.js');
const CG = await import('../src/terrain/cage-c09.js');

const out = {};

/* ---------- A. 3D 逐笔 + 时间轴 ---------- */
{
  const helix = Array.from({ length: 30 }, (_, i) => [Math.cos(i / 4), i * 0.1, Math.sin(i / 4)]);
  const strokes = [helix, [[0, 0, 0], [0, 2, 0]], [[1, 0, 0], [1, 0, 3], [4, 0, 3]]];
  const rv = SR.createStrokeReveal3D({ strokes, duration: 3, stagger: 0.5, seed: 3 });
  const total = strokes.reduce((s, k) => s + SR.polylineLengthN(k), 0);
  assert.ok(Math.abs(rv.totalLength - total) < 1e-9, '摊平后排期长度 = 3D 弧长');
  let prev = -1;
  for (let i = 0; i <= 30; i++) {
    const t = (i / 30) * 3, drawn = rv.sampleAt(t).reduce((s, k) => s + SR.polylineLengthN(k.points), 0);
    assert.ok(drawn >= prev - 1e-9, '3D 已描长度单调');
    assert.ok(Math.abs(drawn - rv.statsAt(t).drawnLength) < 1e-6, '3D 裁剪长度 = 共享排期器的已画长度');
    prev = drawn;
  }
  assert.ok(Math.abs(prev - total) < 1e-9 && rv.statsAt(3).done, '收尾全画完');
  const mid = rv.sampleAt(1.4).find((s) => s.progress > 0 && s.progress < 1);
  assert.ok(mid && mid.points[0].length === 3, '画到一半的笔是 3D 点、末端插值');
  // 串笔
  const segs = [[[0, 0, 0], [1, 0, 0]], [[1, 0, 0], [1, 1, 0]], [[1, 1, 0], [0, 1, 0]], [[5, 5, 5], [6, 5, 5]], [[1, 0, 0], [0, 0, 0]]];
  const dd = SR.dedupeSegments(segs);
  assert.equal(dd.length, 4, '反向重复边去重');
  const ch = SR.chainSegments(dd);
  assert.equal(ch.length, 2, '连通的三段串成一笔，孤立段一笔');
  assert.ok(Math.abs(ch.reduce((s, k) => s + SR.polylineLengthN(k), 0) - 4) < 1e-12, '串笔不丢长度');
  // 时间轴
  const TL = SR.createLayerTimeline([{ name: 'tent', duration: 1.6 }, { name: 'lattice', duration: 2.4 }, { name: 'strokes', duration: 5 }, { name: 'net', duration: 3 }, { name: 'contour', duration: 2 }, { name: 'color', duration: 3.5 }], { rounds: 4 });
  assert.equal(TL.roundLength, 17.5); assert.equal(TL.total, 70);
  for (const [r, l, n] of [[0, 'tent', 0.2], [1, 'strokes', 0.5], [3, 'color', 0.9], [2, 'net', 0]]) {
    const st = TL.at(TL.timeOf(r, l, n));
    assert.equal(st.round, r); assert.equal(st.layer, l); assert.ok(Math.abs(st.norm - n) < 1e-9, 'timeOf / at 可逆');
  }
  assert.equal(TL.at(70.5).round, 0, '循环播放');
  const seeds = [0, 1, 2, 3].map((r) => SR.roundSeed(7, r));
  assert.equal(new Set(seeds).size, 4, '每轮一座新岛');
  out.A = { strokes3D: rv.strokeCount, total: +total.toFixed(3), roundLength: TL.roundLength, seeds };
}

/* ---------- B. 三角网岛 ---------- */
{
  const pts = PS.islandPoints({ count: 170, radius: 10, seed: 1337 }).sort((a, b) => a.x - b.x).map((p, i) => ({ ...p, index: i }));
  const D = IV.delaunaySteps(pts, { span: 2.2 });
  const n = pts.length;
  const early = IV.edgesOf(D.steps[20]);
  assert.ok(early.some(([a, b]) => a >= n || b >= n), '插点过程中有连向超级三角形的「帐篷」边');
  assert.equal(IV.edgesOf(D.final).filter(([a, b]) => a >= n || b >= n).length, 0, '插完后超级三角形删干净');
  const ref = PS.delaunay(pts);
  const key = (t) => t.slice().sort((a, b) => a - b).join(',');
  const refSet = new Set(ref.map(key));
  // 超级三角形放远（span 40，与 pipeline-stages 相同）→ 结果完全一致；页面用近的超级三角形（帐篷看得见），只丢凸包边上的细长三角
  assert.deepEqual(new Set(IV.delaunaySteps(pts, { span: 40 }).final.map(key)), refSet, '远超级三角形：最终三角化 = pipeline-stages.delaunay');
  const inRef = D.final.filter((t) => refSet.has(key(t))).length;
  assert.ok(inRef / D.final.length > 0.97 && D.final.length / ref.length > 0.9, `近超级三角形：${inRef}/${D.final.length} 在参考三角化里`);
  const rep = PS.meshReport(pts, D.final);
  assert.equal(rep.violations, 0); assert.equal(rep.nonManifold, 0);
  assert.equal(D.steps.length, n + 1, '每插一个点一份快照');
  const heights = PS.liftHeights(pts, { seed: 1337, radius: 10 });
  // 等高线
  const cont = IV.contourSegments(pts, D.final, heights, [0.5, 1.5, 2.5]);
  assert.ok(cont.length > 20, '有等高线');
  const hAt = IV.heightSampler(pts, D.final, heights);
  for (const [a, b, iso] of cont.slice(0, 200)) for (const p of [a, b]) { const h = hAt(p[0], p[1]); if (h !== null) assert.ok(Math.abs(h - iso) < 1e-6, '等高线端点高度 = 等值'); }
  // 台地 + AO + 软阴影
  const levels = IV.triLevels(D.final, heights), adj = IV.triAdjacency(D.final);
  const ao = IV.faceAO(pts, D.final, levels, { L: 0.8 });
  assert.ok(ao.every((v) => v >= 0 && v <= 1));
  const top = Math.max(...levels), topAO = ao.filter((_, k) => levels[k] === top);
  const footAO = ao.filter((_, k) => adj[k].some((o) => o >= 0 && levels[o] >= levels[k] + 2));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(footAO.length > 3 && mean(footAO) < mean(topAO) - 0.15, `崖脚比高台暗（foot ${mean(footAO).toFixed(2)} / top ${mean(topAO).toFixed(2)}）`);
  const low = IV.faceShadow(pts, D.final, levels, { x: -0.7, y: 0.4, z: -0.45 }, { L: 0.8 });
  const high = IV.faceShadow(pts, D.final, levels, { x: -0.7, y: 2.5, z: -0.45 }, { L: 0.8 });
  const dark = (a) => a.filter((v) => v < 0.98).length;
  assert.ok(dark(low) > dark(high) && dark(low) > 10, `太阳越低阴影越多（${dark(low)} > ${dark(high)}）`);
  assert.ok(low.some((v) => v > 0.05 && v < 0.95), '有半影（软阴影不是 0/1）');
  const cliffs = IV.cliffEdges(D.final, levels, adj);
  assert.ok(cliffs.every((c) => c.hi > c.lo || c.o < 0));
  const pr = IV.orbitProject(1, 2, 0, { yaw: Math.PI / 2, S: 1 });
  const pr0 = IV.orbitProject(-2, 1, 0, { yaw: 0, S: 1 });
  assert.ok(Math.abs(pr[0] - pr0[0]) < 1e-9 && Math.abs(pr[1] - pr0[1]) < 1e-9, '转镜 = 绕 y 轴转点');
  out.B = { tris: rep.tris, superEdgesAt20: early.filter(([a, b]) => a >= n || b >= n).length, contours: cont.length, footAO: +mean(footAO).toFixed(3), topAO: +mean(topAO).toFixed(3), shadowedLow: dark(low), shadowedHigh: dark(high), cliffs: cliffs.length };
}

/* ---------- C. 真实地形管线：线稿 / 格笼 / 3D 碰撞 ---------- */
const L = 0.5;
const GRIDS = { quad: () => buildQuadGrid({ radius: 14, hexSize: 1 }), mixed: () => buildMixedGrid({ radius: 22, hexSize: 0.62 }) };
out.C = {};
for (const kind of ['quad', 'mixed']) {
  const w = new World(decorateCells(GRIDS[kind]()));
  generateTerrain(w, { seed: 7 });
  const shape = shapeTerrain(w, {});
  w.terrainCollide = true;
  const m = new MeshWriter(); buildTerrain(m, w, { L, shape });
  const surf = w.terrainSurface;
  // 线稿来自真实墙/顶
  const segs = TS.surfaceSegments(surf);
  assert.ok(segs.length > surf.walls.length, '墙四边形 + 顶面外边 → 线段');
  const corner = new Set();
  const k3 = (p) => p.map((v) => Math.round(v * 1e4)).join(',');
  for (const q of surf.walls) for (const p of q.q) corner.add(k3(p));
  for (const t of surf.tops) for (const p of t.t) corner.add(k3(p));
  assert.ok(segs.every((s) => corner.has(k3(s[0])) && corner.has(k3(s[1]))), '每条线端点都是 terrainmesh 实际发出的顶点');
  const strokes = TS.terrainStrokes(segs, { maxPoints: 18 });
  const lenS = segs.reduce((s, k) => s + SR.polylineLengthN(k), 0), lenK = strokes.reduce((s, k) => s + SR.polylineLengthN(k), 0);
  assert.ok(Math.abs(lenS - lenK) < 1e-6 * lenS, '串笔后总长不变');
  assert.ok(strokes.length < segs.length / 2, '笔画是连续折线（远少于线段数）');
  // 格笼：竖向笼边是弯的（分数层采样不在一条直线上）
  const cage = TS.cageSegments(w, shape, { L, sub: 3 });
  let bent = 0;
  for (const c of w.cells) { const g = w.ground(c); if (g < 2) continue; for (const p of c.pts) { const a = shape.at(p, 0), b = shape.at(p, g / 2), d = shape.at(p, g); const mx = (a[0] + d[0]) / 2, mz = (a[1] + d[1]) / 2; if (Math.hypot(b[0] - mx, b[1] - mz) > 0.02) bent++; } }
  assert.ok(cage.length > 1000 && bent > 20, `格笼线段 ${cage.length}，竖边弯曲角点 ${bent}`);
  // cageWallPoint 与实际墙面同一张面
  const col = terrainCollider(w);
  const cc = CG.cageCollider(shape, w, L);
  let checked = 0, worst = 0, matchCage = 0;
  const walls = surf.walls.filter((_, i) => i % 7 === 0).slice(0, 120);
  for (const wq of walls) {
    const c = w.cells[wq.cell], a = c.pts[wq.edge], b = c.pts[(wq.edge + 1) % c.n];
    for (const [u, v] of [[0.5, 0.5], [0.2, 0.3], [0.8, 0.9]]) {
      const P = CG.cageWallPoint(shape, a, b, wq.lv, u, v, L);
      const seg = col.wallSegmentsAt(P[1], P[0], P[2], 0.5).find((s) => s.k === surf.walls.indexOf(wq));
      if (!seg) continue;
      const dx = seg.q[0] - seg.p[0], dz = seg.q[1] - seg.p[1], l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((P[0] - seg.p[0]) * dx + (P[2] - seg.p[1]) * dz) / l2));
      const d = Math.hypot(P[0] - (seg.p[0] + dx * t), P[2] - (seg.p[1] + dz * t));
      worst = Math.max(worst, d); checked++;
      // 我的格笼碰撞在同一高度也生成这面墙
      if (cc.wallsAt(P[1], P[0], P[2], 0.3).some((s) => s.cell === wq.cell && s.edge === wq.edge)) matchCage++;
    }
  }
  assert.ok(checked > 100, 'enough wall samples');
  assert.ok(worst < 1e-9, `笼面内部点落在实际墙面上（最大偏差 ${worst}）`);
  assert.ok(matchCage / checked > 0.97, `格笼碰撞墙与 terrainmesh 墙一致 ${matchCage}/${checked}`);
  // 3D 包含 + 推出：探针放进岩石 0.08，推出后离墙 ≥ r，且不在岩石里；terrain-collide 也认同
  const r = 0.15;
  let probes = 0, ok = 0, agree = 0;
  for (const wq of walls.slice(0, 60)) {
    const c = w.cells[wq.cell], a = c.pts[wq.edge], b = c.pts[(wq.edge + 1) % c.n];
    const P = CG.cageWallPoint(shape, a, b, wq.lv, 0.5, 0.5, L);
    const [nx, , nz] = wq.out;
    const x0 = P[0] - nx * 0.08, z0 = P[2] - nz * 0.08;
    if (!cc.solid(x0, P[1], z0)) continue;          // 法线近似：只取确实进了岩石的探针
    probes++;
    assert.ok(CG.insideCage(shape, c, x0, P[1], z0, L) || cc.cellAt(x0, P[1], z0), '探针在某个形变格笼里');
    const res = cc.pushOut(x0, P[1], z0, r);
    if (!res.inside && res.clearance >= r - 1e-6) ok++;
    const d2 = col.wallDistance(res.x, P[1], res.z, r);
    if (!d2.inside && d2.d >= r - 1e-3) agree++;
  }
  assert.ok(probes > 20, `probes ${probes}`);
  assert.ok(ok / probes > 0.9, `推出成功 ${ok}/${probes}`);
  assert.ok(agree / probes > 0.85, `terrain-collide 认同推出位置 ${agree}/${probes}`);
  out.C[kind] = { walls: surf.walls.length, lineSegs: segs.length, strokes: strokes.length, cageSegs: cage.length, bentCorners: bent, wallSamples: checked, maxDev: worst, cageWallMatch: `${matchCage}/${checked}`, pushOut: `${ok}/${probes}`, agree: `${agree}/${probes}` };
}

console.log('c09-terrain-d PASS', JSON.stringify(out));
