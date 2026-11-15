/**
 * infinite-c06.js — 第 56 批 C06：无限网格的「按焦点流式」窗口、面积回拉松弛、翻折 bug 复现对照。
 *
 * 1151137783785771008 "an aperiodic infinite deterministic irregular relaxed quadrilateral grid"
 *   画面：拖动 gizmo，焦点附近的六边形块一块块冒出来并松弛好，镜头走到哪长到哪。
 * 1151770831619534848 "relaxation clusters of 3 instead of 7 … the black and the white grid are *dual* to each other"
 *   画面：圆形范围内是松弛好的白网，圈外是未松弛的暗网；黑白两张网互为对偶。
 * 1302686201401442309 "inverted patches collapse into a mess, but are stretched out when interpolating …
 *   the poor non-inverted patches need to stretch real far to pick up the slack"
 *   → buildInfinite({bugPatches}) 复现 bug；restoreArea 把块内格子面积往原始点阵回拉（块边界钉住，不破坏无缝）。
 */
import { createInfiniteStream, quadDual } from './infinite.js';
import { signedArea } from './grid.js';

/** 块中心点阵：任意块中心 = a·step(0) + b·step(1)（step 是相邻块中心差）。返回世界坐标换算。 */
export function patchLattice(stream) {
  const s0 = stream.step(0), s1 = stream.step(1);
  const c00 = stream.patch(0, 0).center, c10 = stream.patch(s0[0], s0[1]).center, c01 = stream.patch(s1[0], s1[1]).center;
  const e0 = [c10[0] - c00[0], c10[1] - c00[1]], e1 = [c01[0] - c00[0], c01[1] - c00[1]];
  const det = e0[0] * e1[1] - e0[1] * e1[0];
  return {
    center: (a, b) => [c00[0] + a * e0[0] + b * e1[0], c00[1] + a * e0[1] + b * e1[1]],
    qr: (a, b) => [a * s0[0] + b * s1[0], a * s0[1] + b * s1[1]],
    /** 世界点 → 最近的 (a,b)（实数） */
    ab: (x, z) => { const dx = x - c00[0], dz = z - c00[1]; return [(dx * e1[1] - dz * e1[0]) / det, (e0[0] * dz - e0[1] * dx) / det]; },
    spacing: Math.hypot(...e0),
  };
}

/**
 * 焦点窗口：半径 radius 内的块全部「最终化」（块 + 6 个三块簇松弛 + 插值），
 * 半径 + ring 内的块只生成未松弛拓扑（片中圈外的暗网），其余缓存丢弃（evict）→ 内存不随走过的路程增长。
 */
export function streamWindow(stream, { focus = [0, 0], radius = 6, ring = 1.6, lattice = patchLattice(stream), evict = true, areaFix = false } = {}) {
  const [fa, fb] = lattice.ab(...focus), span = Math.ceil((radius + ring * lattice.spacing) / lattice.spacing) + 2;
  const finals = [], raws = [], keep = new Set();
  for (let a = Math.floor(fa) - span; a <= Math.ceil(fa) + span; a++) for (let b = Math.floor(fb) - span; b <= Math.ceil(fb) + span; b++) {
    const c = lattice.center(a, b), d = Math.hypot(c[0] - focus[0], c[1] - focus[1]);
    if (d > radius + ring * lattice.spacing) continue;
    const [q, r] = lattice.qr(a, b);
    if (d <= radius) { const quads = stream.patch(q, r).quads; let pos = stream.finalPatch(q, r); if (areaFix) { const rim = patchRim(quads); pos = restoreArea(quads, (v) => pos.get(v.id), { pinned: (v) => rim.has(v.id) }); } finals.push({ q, r, d, quads, pos }); keep.add(q + ',' + r); for (let k = 0; k < 6; k++) { const s = stream.step(k); keep.add((q + s[0]) + ',' + (r + s[1])); } }
    else { raws.push({ q, r, d, quads: stream.patch(q, r).quads }); keep.add(q + ',' + r); }
  }
  const evicted = evict ? stream.evict((q, r) => keep.has(q + ',' + r)) : 0;
  return { finals, raws, evicted, cached: stream.cached(), counters: { ...stream.counters } };
}

/** 块外圈点（只被一个格用到的边的端点）：面积回拉时钉住 → 块与块之间仍无缝。 */
export function patchRim(quads) {
  const use = new Map();
  for (const q of quads) for (let i = 0; i < 4; i++) { const a = q[i].id, b = q[(i + 1) % 4].id, k = a < b ? a + ',' + b : b + ',' + a; use.set(k, (use.get(k) || 0) + 1); }
  const rim = new Set(); for (const [k, n] of use) if (n === 1) for (const id of k.split(',')) rim.add(+id);
  return rim;
}

/** 一批最终化块的对偶（黑网）：直接用共享 quadDual。 */
export function windowDual(win) {
  const pos = new Map(); for (const P of win.finals) for (const [id, p] of P.pos) pos.set(id, p);
  return quadDual(win.finals.flatMap((P) => P.quads), (v) => pos.get(v.id));
}

/** 每格面积 / 原始点阵面积 的统计（以本格 x0,z0 为基准）。 */
export function areaStats(quads, posOf) {
  let min = Infinity, max = 0, flipped = 0, under = 0;
  for (const q of quads) {
    const a = signedArea(q.map((v) => { const p = posOf(v); return { x: p[0], z: p[1] }; })), a0 = Math.abs(signedArea(q.map((v) => ({ x: v.x0, z: v.z0 }))));
    const r = a / a0; if (r <= 0) flipped++; if (r < .6) under++; min = Math.min(min, r); max = Math.max(max, r);
  }
  return { quads: quads.length, min, max, flipped, under };
}

/**
 * 面积回拉：每格按 sqrt(原始面积/当前面积) 绕自己形心缩放一点，共享点取平均；块边界点（rim）钉住 →
 * 两侧块各自处理也不会出缝，流式最终化结果仍与顺序无关。返回新的位置 Map，不改输入。
 */
export function restoreArea(quads, posOf, { iters = 30, rate = .35, clamp = [.7, 1.4], pinned = (v) => v.rim } = {}) {
  const P = new Map(); for (const q of quads) for (const v of q) if (!P.has(v.id)) P.set(v.id, posOf(v).slice());
  for (let it = 0; it < iters; it++) {
    const acc = new Map();
    for (const q of quads) {
      const pts = q.map((v) => P.get(v.id)), a = signedArea(pts.map((p) => ({ x: p[0], z: p[1] }))), a0 = Math.abs(signedArea(q.map((v) => ({ x: v.x0, z: v.z0 }))));
      if (!(a > 0)) continue;
      const s = Math.min(clamp[1], Math.max(clamp[0], Math.sqrt(a0 / a))), cx = pts.reduce((t, p) => t + p[0], 0) / 4, cz = pts.reduce((t, p) => t + p[1], 0) / 4;
      q.forEach((v, i) => { if (pinned(v)) return; const t = [cx + (pts[i][0] - cx) * s, cz + (pts[i][1] - cz) * s]; const o = acc.get(v.id) || [0, 0, 0]; o[0] += t[0]; o[1] += t[1]; o[2]++; acc.set(v.id, o); });
    }
    for (const [id, [x, z, n]] of acc) { const p = P.get(id); p[0] += (x / n - p[0]) * rate; p[1] += (z / n - p[1]) * rate; }
  }
  return P;
}

export { createInfiniteStream };
