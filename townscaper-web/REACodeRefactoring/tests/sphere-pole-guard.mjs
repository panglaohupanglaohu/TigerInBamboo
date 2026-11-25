// 第 118 轮 [052]：球极投影的极点鲁棒性（1338829205157646336 / 1338825080844021760 的「投影往返」口径）。
// 三问：① 极点上有重合点时旧路径会怎样；② 有夹角 ~1e-3 rad 的「次北点」时半径与超级三角会炸到多大；
//       ③ 守卫打开后两者是否都收敛到有限半径、仍闭合球网、投影往返仍 < 1e-9；良态点集必须零影响。
import assert from 'node:assert/strict';
import { buildSphere, sphereTopologyReport } from '../src/sphere/planet.js';
import { createInsertionReplay, liftToSphere, projectionOrder, poleGuard, relaxRetriangulate } from '../src/sphere/stereo-insert-c06.js';

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// 把最北点转到 +Y（真旋转 det=+1），这样立体投影的极点病态才出现（原片的极点就在点集自己的最北点上）
function toNorth(points) {
  const P = points.map(norm);
  let top = 0; for (let i = 1; i < P.length; i++) if (P[i][1] > P[top][1]) top = i;
  const a = P[top], h = Math.abs(a[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
  const x = norm(cross3(h, a)), z = cross3(x, a), R = [x, a, z];
  const Q = P.map((p) => [dot3(R[0], p), dot3(R[1], p), dot3(R[2], p)]);
  const second = Q.map((p, i) => [p, i]).filter(([, i]) => i !== top).sort((u, v) => v[0][1] - u[0][1])[0][1];
  return { Q, top, second };
}
const N = 120;
const base = buildSphere({ n: N, seed: 7, spacing: 0, relax: 0 }).pts;

// ---- ① 极点重合：把「次北点」搬到最北点上（最北点此时正好在 +Y）----
{
  const { Q, top, second } = toNorth(base);
  assert.ok(Math.abs(Q[top][1] - 1) < 1e-12, '夹具：最北点已在 +Y');
  const P = Q.map((p) => p.slice()); P[second] = P[top].slice();       // 完全重合（sinθ = 0）
  assert.throws(() => projectionOrder(P, { guard: false }), RangeError, '旧路径遇到极点重合点必须抛 RangeError');
  const r = createInsertionReplay(P);
  assert.equal(r.guard.merged.length, 1, '重合点被合并 1 个：' + JSON.stringify(r.guard.merged));
  assert.ok(['pole', 'dup'].includes(r.guard.merged[0].why));
  assert.equal(r.items.length, N - 2, '合并后参与三角化的点数 = n−2');
  assert.ok(Number.isFinite(r.maxR), '合并后最大半径有限 ' + r.maxR);
  const L = liftToSphere(P, r), topo = sphereTopologyReport(P, L.tris);
  // 被合并的重合点是「唯一的孤点」：它不参与三角化，所以闭球网指的是其余点
  assert.ok(topo.euler === 2 && topo.boundaryEdges === 0 && topo.nonManifoldEdges === 0, '合并后仍是闭球网 Euler=2 / 边界边 0');
  assert.equal(topo.orphanVertices, r.guard.merged.length, '孤点 == 被合并的重合点数');
  assert.equal(L.tris.length, 2 * (N - 1) - 4, `面数 F=2·neff−4 = ${2 * (N - 1) - 4}`);
  assert.ok(L.roundTrip < 1e-9, '投影往返误差 ' + L.roundTrip.toExponential(2));
  assert.ok(r.frame(r.items.length).realTris > 0);
}

// ---- ② 次北点离极点 ~1e-3 rad：旧路径半径/超级三角爆炸 ----
{
  const { Q, top, second } = toNorth(base);
  const P2 = Q.map((p) => p.slice()), eps = 1e-4;
  P2[second] = norm([eps, Math.sqrt(1 - eps * eps), 0]);                // 离 +Y 仅 1e-4 rad（r=cot(θ/2)≈2/θ）
  const legacy = projectionOrder(P2, { guard: false });
  const legacyMaxR = legacy.items[legacy.items.length - 1].r;
  assert.ok(legacyMaxR > 1e4, '旧路径次北点半径爆炸到 ' + legacyMaxR.toExponential(2));
  const g = createInsertionReplay(P2);
  assert.equal(g.guard.merged.length, 0, '1e-3 rad 的次北点不算重合（> mergeSin）');
  assert.ok(g.guard.rotated, '极点被换到角距更大的候选点（rotated=true）');
  assert.ok(g.maxR < 10, '换极点后最大半径 ' + g.maxR.toFixed(2));
  assert.ok(legacyMaxR / g.maxR > 1e3, `半径收敛 ${(legacyMaxR / g.maxR).toExponential(2)}×`);
  assert.ok(g.guard.minSin > 1e-3, '守卫后的最小 sinθ ' + g.guard.minSin.toExponential(2));
  const L = liftToSphere(P2, g), topo = sphereTopologyReport(P2, L.tris);
  assert.ok(topo.closed && topo.euler === 2, '换极点后仍闭合');
  assert.equal(L.tris.length, 2 * N - 4, '面数 F=2n−4 = ' + (2 * N - 4));
  assert.ok(L.roundTrip < 1e-9, '换极点后投影往返误差 ' + L.roundTrip.toExponential(2));
  // 坐标架是**真旋转**（det=+1，不镜像），否则三角朝向会翻、Bowyer–Watson 的外接圆判据会反
  const R = g.guard.R;
  const det = R[0][0] * (R[1][1] * R[2][2] - R[1][2] * R[2][1]) - R[0][1] * (R[1][0] * R[2][2] - R[1][2] * R[2][0]) + R[0][2] * (R[1][0] * R[2][1] - R[1][1] * R[2][0]);
  assert.ok(Math.abs(det - 1) < 1e-12, 'R 行列式 = +1（旋转而非镜像）' + det);
  const q = [dot3(R[0], g.guard.axis), dot3(R[1], g.guard.axis), dot3(R[2], g.guard.axis)];
  assert.ok(Math.abs(q[0]) < 1e-12 && Math.abs(q[1] - 1) < 1e-12 && Math.abs(q[2]) < 1e-12, 'R·极点 = (0,1,0)');
}

// ---- ③ 良态球面：守卫必须「零影响」（不旋转、不合并，逐位与旧路径一致）----
{
  const g = poleGuard(base);
  assert.equal(g.rotated, false, '良态点集不旋转'); assert.equal(g.merged.length, 0, '良态点集不合并');
  assert.deepEqual(g.R, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], '良态点集坐标架 = 单位阵');
  const a = projectionOrder(base, { guard: false }), b = projectionOrder(base, { guard: true });
  assert.equal(a.pole, b.pole);
  assert.equal(JSON.stringify(a.items), JSON.stringify(b.items), '逐位一致（旧账不受影响）');
  assert.ok(g.minSin > 1e-2, '良态点集最小 sinθ ' + g.minSin.toFixed(3));
  // 松弛 + 每轮重三角化在守卫下仍收敛（第二片的「4. relax using the triangles」口径）
  const rr = relaxRetriangulate(buildSphere({ n: 300, seed: 5, spacing: 0, relax: 0 }).steps.random, { iters: 10 });
  assert.ok(rr.changed.slice(-3).reduce((s, x) => s + x, 0) <= 2, '重三角化收敛 ' + rr.changed.join(','));
  assert.ok(sphereTopologyReport(rr.points, rr.tris).closed);
}
console.log('PASS sphere-pole-guard');
