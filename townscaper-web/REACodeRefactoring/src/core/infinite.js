/**
 * infinite.js — 无限、确定、无缝的松弛四边形网格（Townscaper 的网格是"无限"的）。
 *
 * 依据：
 *   1151137783785771008 "an aperiodic infinite deterministic irregular relaxed quadrilateral grid"
 *     画面：拖动时六边形块一块块冒出来、松弛好，接缝看不出来。
 *   1151770831619534848 "relaxation clusters of 3 instead of 7 … Note also that the black and the white grid
 *     are *dual* to each other"   画面：一圈圈六边形块；一个圆形范围内的格子在松弛。
 *   1332410042784641026 "The grid is made of Patches. Adjacent triplets form Clusters. Clusters and Patches are
 *     relaxed independently. Each Vert is a triangular interpolation of its representation in the closest 2
 *     Clusters and the Patch wherein it sits."
 *   1302686201401442309 "A smoothing and inversion bug … inverted patches collapse into a mess, but are stretched
 *     out when interpolating"   → 这里每块 / 每簇各自松弛，外圈钉住，不会翻折；verify() 检查有没有翻转的格子。
 *
 * 做法：
 *   块 = 三角点阵上的六边形（半径 N），中心在点阵 (q, r)，相邻块中心相差 (2N, -N) 等 6 个方向；
 *   每块用 hash(q, r) 当种子 → 合并 / 细分（core/grid.js quadPatchTopology），外圈点位置完全确定。
 *   簇 = 三个两两相邻的块（块中心三角形）；块、簇各自松弛（外圈钉住）。
 *   顶点最终位置 = 它在 [所在块, 最近的两个簇] 里的三个版本，按顶点在"块中心—簇中心—簇中心"三角形里的重心坐标插值。
 *   块边界上的点：两侧块的版本都 = 原位（钉住），最近的两个簇也相同 → 两侧算出来一模一样，无缝。
 */

import { quadPatchTopology, relaxPolygons, signedArea } from './grid.js';

const DIRS = (N) => [[2 * N, -N], [N, N], [-N, 2 * N], [-2 * N, N], [-N, -N], [N, -2 * N]];
const hash = (q, r) => ((Math.imul(q, 73856093) ^ Math.imul(r, 19349663)) >>> 0) % 100000 + 1;

/**
 * 生成以原点为中心、rings 圈的块，返回 { verts, quads, patches, clusters, versions }。
 * mode: 'raw' 不松弛 / 'patch' 只按块松弛（接缝明显）/ 'cluster' 只按簇松弛 / 'blend' 块 + 两簇插值（最终）
 */
export function buildInfinite({ N = 4, L = 1, rings = 2, passes = 60 } = {}) {
  const dirs = DIRS(N);
  // 块中心（点阵坐标）
  const centers = [[0, 0]];
  const seen = new Set(['0,0']);
  for (let ring = 0; ring < rings; ring++) {
    for (const [q, r] of centers.slice()) for (const [dq, dr] of dirs) {
      const k = (q + dq) + ',' + (r + dr);
      if (!seen.has(k)) { seen.add(k); centers.push([q + dq, r + dr]); }
    }
  }
  // 合并顶点：按坐标 key
  const verts = [], key = new Map();
  const vid = (x, z, pinned) => {
    const k = Math.round(x * 1000) + ',' + Math.round(z * 1000);
    let v = key.get(k);
    if (!v) { v = { id: verts.length, x, z, x0: x, z0: z, pinned: false, rim: pinned, patches: [] }; verts.push(v); key.set(k, v); }
    return v;
  };
  const patches = centers.map(([q, r], pi) => {
    const t = quadPatchTopology({ N, L, q0: q, r0: r, seed: hash(q, r) });
    const map = new Map();
    for (const v of t.verts) map.set(v.id, vid(v.x, v.z, v.pinned));
    const quads = t.quads.map((qd) => qd.map((v) => map.get(v.id)));
    const vs = new Set(quads.flat());
    for (const v of vs) v.patches.push(pi);
    return { id: pi, q, r, center: t.center, quads, verts: [...vs] };
  });
  // 簇：三个两两相邻的块
  const pIndex = new Map(centers.map(([q, r], i) => [q + ',' + r, i]));
  const clusters = [];
  for (const P of patches) for (let d = 0; d < 6; d++) {
    const a = pIndex.get((P.q + dirs[d][0]) + ',' + (P.r + dirs[d][1]));
    const b = pIndex.get((P.q + dirs[(d + 1) % 6][0]) + ',' + (P.r + dirs[(d + 1) % 6][1]));
    if (a === undefined || b === undefined) continue;
    const ids = [P.id, a, b].sort((x, y) => x - y);
    if (ids[0] !== P.id) continue;   // 每个簇只建一次（由序号最小的块建）
    const c = ids.map((i) => patches[i].center);
    clusters.push({ id: clusters.length, patches: ids, center: [(c[0][0] + c[1][0] + c[2][0]) / 3, (c[0][1] + c[1][1] + c[2][1]) / 3] });
  }
  // 松弛一组格子：外边界（只属于一个格子组的边上的点）钉住，返回 Map(vertId → [x, z])
  const relaxGroup = (quads) => {
    const vs = [...new Set(quads.flat())];
    const local = new Map(vs.map((v, i) => [v.id, { id: i, x: v.x0, z: v.z0, pinned: false }]));
    const ecount = new Map();
    for (const qd of quads) for (let i = 0; i < 4; i++) {
      const a = qd[i].id, b = qd[(i + 1) % 4].id, k = a < b ? a + ',' + b : b + ',' + a;
      ecount.set(k, (ecount.get(k) || 0) + 1);
    }
    for (const [k, n] of ecount) if (n === 1) for (const id of k.split(',')) local.get(+id).pinned = true;
    const polys = quads.map((qd) => qd.map((v) => local.get(v.id)));
    relaxPolygons(polys, [...local.values()], passes);
    const out = new Map();
    for (const v of vs) { const l = local.get(v.id); out.set(v.id, [l.x, l.z]); }
    return out;
  };
  const patchPos = patches.map((P) => relaxGroup(P.quads));
  const clusterPos = clusters.map((C) => relaxGroup(C.patches.flatMap((i) => patches[i].quads)));
  // 每个顶点：所在块（取第一个）+ 包含这个块的最近两个簇
  const quadsAll = patches.flatMap((P) => P.quads);
  const weights = new Map();
  const blendAt = (v, pi) => {
    const P = patches[pi];
    const pp = patchPos[P.id].get(v.id);
    const cands = clusters.filter((C) => C.patches.includes(P.id) && clusterPos[C.id].has(v.id))
      .map((C) => ({ C, d: Math.hypot(C.center[0] - v.x0, C.center[1] - v.z0) })).sort((a2, b2) => a2.d - b2.d);
    if (cands.length < 2) return { p: pp, w: [1, 0, 0] };
    const c1 = cands[0].C, c2 = cands[1].C;
    // 重心坐标（块中心、簇 1 中心、簇 2 中心）
    const A = P.center, B = c1.center, Cc = c2.center;
    const det = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1]);
    let wa = ((B[1] - Cc[1]) * (v.x0 - Cc[0]) + (Cc[0] - B[0]) * (v.z0 - Cc[1])) / det;
    let wb = ((Cc[1] - A[1]) * (v.x0 - Cc[0]) + (A[0] - Cc[0]) * (v.z0 - Cc[1])) / det;
    wa = Math.max(0, wa); wb = Math.max(0, wb);
    let wc = Math.max(0, 1 - wa - wb);
    const s2 = wa + wb + wc || 1; wa /= s2; wb /= s2; wc /= s2;
    const p1 = clusterPos[c1.id].get(v.id), p2 = clusterPos[c2.id].get(v.id);
    return { p: [pp[0] * wa + p1[0] * wb + p2[0] * wc, pp[1] * wa + p1[1] * wb + p2[1] * wc], w: [wa, wb, wc] };
  };
  const final = new Map();
  for (const v of verts) { const r = blendAt(v, v.patches[0]); final.set(v.id, r.p); weights.set(v.id, r.w); }
  const versions = {
    raw: (v) => [v.x0, v.z0],
    patch: (v) => patchPos[v.patches[0]].get(v.id),
    cluster: (v) => { const C = clusters.find((c) => c.patches.includes(v.patches[0]) && clusterPos[c.id].has(v.id)); return C ? clusterPos[C.id].get(v.id) : [v.x0, v.z0]; },
    blend: (v) => final.get(v.id),
  };
  return { verts, quads: quadsAll, patches, clusters, versions, weights, blendAt };
}

/** 检查：翻折的格子数（有向面积 ≤ 0）、块边界两侧是否同一个点（无缝） */
export function verify(inf, mode = 'blend') {
  const at = inf.versions[mode];
  let flipped = 0;
  for (const qd of inf.quads) if (signedArea(qd.map((v) => { const [x, z] = at(v); return { x, z }; })) <= 0) flipped++;
  // 无缝：块边界上的点，从相邻两块各自出发算一遍，应该是同一个位置
  let seam = 0, border = 0;
  for (const v of inf.verts) if (v.patches.length > 1) {
    border++;
    const a = inf.blendAt(v, v.patches[0]).p, b = inf.blendAt(v, v.patches[1]).p;
    seam = Math.max(seam, Math.hypot(a[0] - b[0], a[1] - b[1]));
  }
  return { quads: inf.quads.length, flipped, border, seam };
}
