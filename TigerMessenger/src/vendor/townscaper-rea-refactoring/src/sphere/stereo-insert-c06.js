/**
 * stereo-insert-c06.js — 第 56 批 C06：球极投影平面上的逐点 Delaunay 插入回放 + 松弛中的动态重三角化。
 *
 * 1338829205157646336 "one way to do Delaunay Triangulation on a sphere is to do it on a Stereographic Projection …
 *   My points are sorted vertically, which means radially, which makes the algorithm faster. Here's what it looks like:"
 *   画面（全 316 帧）：灰底，0–40 中心一小撮白点；41 出现一个包住点云的超级大三角和几条内部连线；
 *   之后点按半径由内向外一个个插进来，中心是密集小三角、外圈是连到超级三角的长三角，视图逐渐拉远。
 * 1338825080844021760 "1. Random points 2. Space out 3. Triangulate 4. Relax using the triangles"
 *   → relaxRetriangulate：每轮按三角形重心松弛后，在投影平面上重新三角化（连接关系随点移动更新），
 *     统计每轮改了多少条边，直到连接稳定（REACode engine/sphere.js 的 relax + 重三角化做法）。
 */
import { TriGraph } from '../core/trigraph.js';
import { stereoProject, stereoUnproject } from './planet-town.js';

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/* ---------------- 极点鲁棒性（第 118 轮）----------------
 * 立体投影在极点附近病态：sinθ→0 时 r=tan(θ/2)→0 尚可，但 **θ→0 的第二个点** r=1/(1-cosθ) 会炸到 1e9，
 * 超级三角跟着放大，Bowyer–Watson 的「坏三角」判定就退化成巨型薄三角；两点重合时直接 RangeError。
 * 做法：① 极点优先取「最北点」；② 最北点与其余点角距过小（< minSin）时，在次北的几个点里挑角距最大的那个当极点，
 * 并把坐标架转到极点朝 +Y（真旋转，行列式 +1，不镜像所以三角朝向不变）；③ 落在极点上的重合点合并、不参与三角化。
 * 返回的 R 在 liftToSphere 里反着用（Rᵀ），投影往返误差因此仍是同一个量。
 */
const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** R 的三行 = 新坐标架 {x, axis, z}，其中 z = x×axis ⇒ 右手、det=+1、R·axis=(0,1,0)。 */
function basisFor(axis) {
  const a = norm(axis);
  const h = Math.abs(a[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
  const x = norm(cross3(h, a)), z = cross3(x, a);
  return [x, a, z];
}
const applyR = (R, p) => [dot3(R[0], p), dot3(R[1], p), dot3(R[2], p)];
const applyRT = (R, q) => [R[0][0] * q[0] + R[1][0] * q[1] + R[2][0] * q[2], R[0][1] * q[0] + R[1][1] * q[1] + R[2][1] * q[2], R[0][2] * q[0] + R[1][2] * q[1] + R[2][2] * q[2]];

/** 极点选点 + 重合点合并。返回 { pole, merged, rotated, axis, minSin, R, points }。 */
export function poleGuard(points, { minSin = 1e-3, topK = 12, mergeSin = 1e-9, maxTilt = .7 } = {}) {
  const P = points.map(norm), n = P.length;
  if (!n) throw new RangeError('poleGuard needs points');
  const byY = P.map((_, i) => i).sort((a, b) => P[b][1] - P[a][1] || a - b);
  const ax = P[byY[0]];
  const clearance = (c) => { // 其余点到方向 P[c] 的最小 sinθ（= xz 半径下限）
    let m = Infinity;
    for (let i = 0; i < n; i++) if (i !== c) { const c2 = dot3(P[i], P[c]); m = Math.min(m, Math.sqrt(Math.max(0, 1 - c2 * c2))); }
    return m;
  };
  let pole = byY[0], rotated = false, R = IDENTITY, base = clearance(pole);
  if (base < minSin) {
    for (const c of byY.slice(0, Math.max(1, topK))) {
      if (Math.acos(Math.max(-1, Math.min(1, dot3(P[c], ax)))) > maxTilt) break;
      const s = clearance(c);
      if (s > base * 1.5) { pole = c; base = s; rotated = true; R = basisFor(P[c]); }
    }
  }
  // 重合点：落在极点方向上的、以及互相重合的，逐一合并（不参与三角化，否则退化成零面积三角）
  const merged = [], keep = [];
  for (let i = 0; i < n; i++) {
    if (i === pole) continue;
    if (1 - dot3(P[i], P[pole]) < mergeSin) { merged.push({ i, into: pole, why: 'pole' }); continue; }
    const hit = keep.find((j) => Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1], P[i][2] - P[j][2]) < mergeSin);
    if (hit !== undefined) { merged.push({ i, into: hit, why: 'dup' }); continue; }
    keep.push(i);
  }
  let minSinNow = Infinity; for (const i of keep) { const q = applyR(R, P[i]); minSinNow = Math.min(minSinNow, Math.hypot(q[0], q[2])); }
  return { pole, merged, rotated, axis: P[pole], minSin: minSinNow, R, points: P, keep };
}

/** 投影（极点 = 最"北"的点，排除）→ 按半径排序的插入序。guard:false 走第 56 批的旧路径（不旋转、不合并）。 */
export function projectionOrder(points, { guard = true, minSin = 1e-3 } = {}) {
  let pole = 0; for (let i = 1; i < points.length; i++) if (points[i][1] > points[pole][1]) pole = i;
  if (!guard) {
    const items = [];
    for (let i = 0; i < points.length; i++) if (i !== pole) { const [u, v] = stereoProject(norm(points[i])); items.push({ i, u, v, r: Math.hypot(u, v) }); }
    items.sort((a, b) => a.r - b.r);
    return { pole, items, guard: null };
  }
  const g = poleGuard(points, { minSin });
  const items = [];
  for (const i of g.keep) { const q = applyR(g.R, g.points[i]); const [u, v] = stereoProject(q); items.push({ i, u, v, r: Math.hypot(u, v) }); }
  items.sort((a, b) => a.r - b.r || a.i - b.i);
  return { pole: g.pole, items, guard: g };
}

/**
 * 回放器：可视的超级三角（bound 取最大半径的 1.15 倍，原片的超级三角就在画面里），按半径逐点插入。
 * frame(k) → { k, tris:[[x,y]×3]…（含超级三角顶点）, superTris, maxR, inserted }；k 往回走时从头重放。
 */
export function createInsertionReplay(points, { boundScale = 1.15, minSin = 1e-3 } = {}) {
  const { pole, items, guard } = projectionOrder(points, { minSin });
  const maxR = items.length ? items[items.length - 1].r : 1, bound = maxR * boundScale;
  let T = new TriGraph(bound), k = 0, cavities = 0;
  const frame = (target) => {
    target = Math.max(0, Math.min(items.length, Math.round(target)));
    if (target < k) { T = new TriGraph(bound); k = 0; cavities = 0; }
    while (k < target) { const before = T.tris.length; T.add(items[k].u, items[k].v); cavities += T.tris.length - before + 2; k++; }
    const P = (id) => [T.x[id], T.y[id]];
    const tris = T.tris.map((t) => t.map(P)), superTris = T.tris.filter((t) => t[0] < 3 || t[1] < 3 || t[2] < 3).length;
    return { k, total: items.length, tris, superTris, realTris: T.tris.length - superTris, lastR: k ? items[k - 1].r : 0, maxR, bound, pole, graph: T };
  };
  return { frame, items, pole, bound, maxR, guard, R: guard ? guard.R : IDENTITY };
}

/** 平面三角化抬回球面 + 凸包边连极点 → 闭合球面三角网（与 buildSphere 同一做法）。 */
export function liftToSphere(points, replay) {
  const f = replay.frame(replay.items.length);
  const ids = replay.items.map((o) => o.i);
  const tris = f.graph.triangles().map((t) => t.map((j) => ids[j]));
  const cnt = new Map();
  for (const [a, b, c] of tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) cnt.set(u + ',' + v, [u, v]);
  for (const [u, v] of [...cnt.values()]) if (!cnt.has(v + ',' + u)) tris.push([v, u, replay.pole]);
  // 投影往返误差：平面点抬回球面（先按坐标架反旋 Rᵀ）与原点的距离
  let roundTrip = 0; for (const o of replay.items) { const p = applyRT(replay.R || IDENTITY, stereoUnproject([o.u, o.v])), q = norm(points[o.i]); roundTrip = Math.max(roundTrip, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); }
  return { tris, roundTrip };
}

/** 一次完整的投影三角化（给重三角化用）。 */
export function triangulateSphere(points) {
  const r = createInsertionReplay(points, { boundScale: 1e3 });
  return liftToSphere(points, r).tris;
}

/**
 * 松弛 + 动态重三角化：每轮先按当前三角形重心把点往邻三角重心均值拉，再整体重新三角化。
 * 返回 { points, tris, changed:[每轮变动边数] }；changed 最终应收敛到 0（连接稳定）。
 */
export function relaxRetriangulate(points, { iters = 12, amount = .6 } = {}) {
  let P = points.map(norm), tris = triangulateSphere(P);
  const key = (a, b) => a < b ? a + ',' + b : b + ',' + a, edges = (T) => { const s = new Set(); for (const [a, b, c] of T) { s.add(key(a, b)); s.add(key(b, c)); s.add(key(c, a)); } return s; };
  const changed = [];
  for (let it = 0; it < iters; it++) {
    const C = tris.map(([a, b, c]) => norm([P[a][0] + P[b][0] + P[c][0], P[a][1] + P[b][1] + P[c][1], P[a][2] + P[b][2] + P[c][2]]));
    const acc = P.map(() => [0, 0, 0]);
    tris.forEach((t, ti) => { for (const v of t) { acc[v][0] += C[ti][0]; acc[v][1] += C[ti][1]; acc[v][2] += C[ti][2]; } });
    P = P.map((p, i) => { const s = norm(acc[i]); return norm([p[0] + (s[0] - p[0]) * amount, p[1] + (s[1] - p[1]) * amount, p[2] + (s[2] - p[2]) * amount]); });
    const next = triangulateSphere(P), before = edges(tris), after = edges(next);
    let diff = 0; for (const e of after) if (!before.has(e)) diff++;
    changed.push(diff); tris = next;
  }
  return { points: P, tris, changed };
}
