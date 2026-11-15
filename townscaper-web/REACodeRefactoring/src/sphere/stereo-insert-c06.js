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

/** 投影（极点 = 最"北"的点，排除）→ 按半径排序的插入序。 */
export function projectionOrder(points) {
  let pole = 0; for (let i = 1; i < points.length; i++) if (points[i][1] > points[pole][1]) pole = i;
  const items = [];
  for (let i = 0; i < points.length; i++) if (i !== pole) { const [u, v] = stereoProject(norm(points[i])); items.push({ i, u, v, r: Math.hypot(u, v) }); }
  items.sort((a, b) => a.r - b.r);
  return { pole, items };
}

/**
 * 回放器：可视的超级三角（bound 取最大半径的 1.15 倍，原片的超级三角就在画面里），按半径逐点插入。
 * frame(k) → { k, tris:[[x,y]×3]…（含超级三角顶点）, superTris, maxR, inserted }；k 往回走时从头重放。
 */
export function createInsertionReplay(points, { boundScale = 1.15 } = {}) {
  const { pole, items } = projectionOrder(points);
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
  return { frame, items, pole, bound, maxR };
}

/** 平面三角化抬回球面 + 凸包边连极点 → 闭合球面三角网（与 buildSphere 同一做法）。 */
export function liftToSphere(points, replay) {
  const f = replay.frame(replay.items.length);
  const ids = replay.items.map((o) => o.i);
  const tris = f.graph.triangles().map((t) => t.map((j) => ids[j]));
  const cnt = new Map();
  for (const [a, b, c] of tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) cnt.set(u + ',' + v, [u, v]);
  for (const [u, v] of [...cnt.values()]) if (!cnt.has(v + ',' + u)) tris.push([v, u, replay.pole]);
  // 投影往返误差：平面点抬回球面与原点的距离
  let roundTrip = 0; for (const o of replay.items) { const p = stereoUnproject([o.u, o.v]), q = norm(points[o.i]); roundTrip = Math.max(roundTrip, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); }
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
