// =====================================================================
//  IrregularQuadGrid — 六边形三角格 → 内部边配对成四边形 → 一分四 →
//  朝正方形收敛的 relaxation（S20⑤ / Oskar）。
//  纯数据，禁止 import Three.js / DOM；随机只走 createStableRng。
//  输出可直接喂 createHalfEdgeGraph({ faces, positions })。
// =====================================================================

import { createStableRng } from "../core/stableRng.js";
import { hashHex } from "../../core/rng.js";

const SQRT3 = Math.sqrt(3);

function axialKey(q, r) {
  return `${q},${r}`;
}

function axialToXY(q, r, size) {
  return [size * (q + r * 0.5), size * (r * (SQRT3 / 2))];
}

function rot90([x, y]) {
  return [-y, x];
}
function rot180([x, y]) {
  return [-x, -y];
}
function rot270([x, y]) {
  return [y, -x];
}

function signedArea2(poly, positions) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = positions[poly[i]];
    const q = positions[poly[(i + 1) % poly.length]];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a;
}

function ensureCCW(poly, positions) {
  if (signedArea2(poly, positions) < 0) poly.reverse();
  return poly;
}

function edgeKey(a, b) {
  return String(a) < String(b) ? `${a}|${b}` : `${b}|${a}`;
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * @param {object} opts
 * @param {number} opts.seed
 * @param {number} opts.radius 六边形环数（≥1）
 * @param {number} [opts.relaxIterations=30]
 * @param {number} [opts.relaxStep=0.2]
 * @param {number} [opts.sizeBlend=0.35] 尺寸项权重（S14「desired shape *and size*」）
 * @param {number} [opts.sizeClamp=0.15] 单次尺寸修正的上限（±15%），防撕裂
 * @param {Set<string>} [opts.locked] 顶点 ID 集合，relaxation 期间位置逐位不变
 * @param {number} [opts.size=1] 三角格边长
 */
export function createIrregularQuadGrid({
  seed,
  radius,
  // 30 轮就够：形状项收敛很快，之后继续迭代反而让格子各自涨缩、边长比劣化
  // （2026-09-04 扫参：it=30 worstRatio 1.977 全过；it=150 劣化到 2.13，27/30 超门槛）。
  relaxIterations = 30,
  relaxStep = 0.2,
  sizeBlend = 0.35,
  sizeClamp = 0.15,
  locked = new Set(),
  size = 1,
} = {}) {
  if (!Number.isFinite(seed)) throw new Error("createIrregularQuadGrid: seed required");
  radius = radius >>> 0;
  if (radius < 1) throw new Error("createIrregularQuadGrid: radius must be ≥ 1");

  const rng = createStableRng(seed >>> 0, "quad-pair");
  const lockedSet = locked instanceof Set ? locked : new Set(locked ?? []);

  // 1. 六边形范围内的三角格顶点（axial：|q|,|r|,|q+r| ≤ radius）
  const vertexIds = [];
  const positions = Object.create(null);
  const axialToId = new Map();
  let nextVid = 0;
  const addVertex = (q, r) => {
    const key = axialKey(q, r);
    if (axialToId.has(key)) return axialToId.get(key);
    const id = `v:${nextVid++}`;
    const [x, y] = axialToXY(q, r, size);
    positions[id] = [x, y, 0];
    vertexIds.push(id);
    axialToId.set(key, id);
    return id;
  };
  for (let r = -radius; r <= radius; r++) {
    const qMin = Math.max(-radius, -radius - r);
    const qMax = Math.min(radius, radius - r);
    for (let q = qMin; q <= qMax; q++) addVertex(q, r);
  }
  const hasAxial = (q, r) => axialToId.has(axialKey(q, r));

  // 三角形：每个单位格两枚，绕序 CCW
  const tris = [];
  for (let r = -radius; r <= radius; r++) {
    const qMin = Math.max(-radius, -radius - r);
    const qMax = Math.min(radius, radius - r);
    for (let q = qMin; q <= qMax; q++) {
      if (hasAxial(q + 1, r) && hasAxial(q, r + 1)) {
        tris.push([
          axialToId.get(axialKey(q, r)),
          axialToId.get(axialKey(q + 1, r)),
          axialToId.get(axialKey(q, r + 1)),
        ]);
      }
      if (hasAxial(q + 1, r) && hasAxial(q + 1, r + 1) && hasAxial(q, r + 1)) {
        tris.push([
          axialToId.get(axialKey(q + 1, r)),
          axialToId.get(axialKey(q + 1, r + 1)),
          axialToId.get(axialKey(q, r + 1)),
        ]);
      }
    }
  }

  // 2. 内部边稳定洗牌，两侧都未合并则配成四边形
  const edgeFaces = new Map();
  for (let ti = 0; ti < tris.length; ti++) {
    const t = tris[ti];
    for (let i = 0; i < 3; i++) {
      const a = t[i];
      const b = t[(i + 1) % 3];
      const k = edgeKey(a, b);
      if (!edgeFaces.has(k)) edgeFaces.set(k, []);
      edgeFaces.get(k).push(ti);
    }
  }
  const internal = [];
  for (const [k, owners] of edgeFaces) {
    if (owners.length === 2) internal.push({ key: k, a: owners[0], b: owners[1] });
  }
  const triDegree = Object.create(null);
  for (const t of tris) for (const id of t) triDegree[id] = (triDegree[id] || 0) + 1;
  const hullVert = new Set(vertexIds.filter((id) => (triDegree[id] || 0) < 6));
  const touchesHull = (ti) => tris[ti].some((id) => hullVert.has(id));
  const shuffled = rng.shuffle(internal);
  shuffled.sort((e1, e2) => {
    const h1 = touchesHull(e1.a) || touchesHull(e1.b) ? 0 : 1;
    const h2 = touchesHull(e2.a) || touchesHull(e2.b) ? 0 : 1;
    return h1 - h2;
  });
  const used = new Uint8Array(tris.length);
  const quads = [];
  for (const e of shuffled) {
    if (used[e.a] || used[e.b]) continue;
    const t1 = tris[e.a];
    const t2 = tris[e.b];
    const t2set = new Set(t2);
    let s0 = null;
    let s1 = null;
    let apex1 = null;
    for (let i = 0; i < 3; i++) {
      const a = t1[i];
      const b = t1[(i + 1) % 3];
      if (t2set.has(a) && t2set.has(b)) {
        s0 = a;
        s1 = b;
        apex1 = t1[(i + 2) % 3];
        break;
      }
    }
    const apex2 = t2.find((v) => v !== s0 && v !== s1);
    if (s0 == null || apex2 == null) continue;
    used[e.a] = 1;
    used[e.b] = 1;
    quads.push(ensureCCW([apex1, s0, apex2, s1], positions));
  }
  const leftover = [];
  for (let i = 0; i < tris.length; i++) if (!used[i]) leftover.push(tris[i]);

  // 3. 一分四：边中点 + 面重心。四边形 → 4 四边形，三角形 → 3 四边形。
  const midpointOf = new Map();
  const midpoint = (a, b) => {
    const k = edgeKey(a, b);
    if (midpointOf.has(k)) return midpointOf.get(k);
    const pa = positions[a];
    const pb = positions[b];
    const id = `v:${nextVid++}`;
    positions[id] = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, 0];
    vertexIds.push(id);
    midpointOf.set(k, id);
    return id;
  };
  const centroidOf = (poly) => {
    let x = 0;
    let y = 0;
    for (const id of poly) {
      x += positions[id][0];
      y += positions[id][1];
    }
    const n = poly.length;
    const id = `v:${nextVid++}`;
    positions[id] = [x / n, y / n, 0];
    vertexIds.push(id);
    return id;
  };

  const faces = [];
  const faceIds = [];
  const pushQuad = (poly) => {
    const q = ensureCCW(poly.slice(), positions);
    q.id = `f:${faces.length}`;
    faces.push(q);
    faceIds.push(q.id);
  };

  for (const q of quads) {
    const [p0, p1, p2, p3] = q;
    const m01 = midpoint(p0, p1);
    const m12 = midpoint(p1, p2);
    const m23 = midpoint(p2, p3);
    const m30 = midpoint(p3, p0);
    const c = centroidOf(q);
    pushQuad([p0, m01, c, m30]);
    pushQuad([p1, m12, c, m01]);
    pushQuad([p2, m23, c, m12]);
    pushQuad([p3, m30, c, m23]);
  }
  for (const t of leftover) {
    const [p0, p1, p2] = t;
    const m01 = midpoint(p0, p1);
    const m12 = midpoint(p1, p2);
    const m20 = midpoint(p2, p0);
    const c = centroidOf(t);
    pushQuad([p0, m01, c, m20]);
    pushQuad([p1, m12, c, m01]);
    pushQuad([p2, m20, c, m12]);
  }
  if (!faces.length) throw new Error("createIrregularQuadGrid: no faces");

  // 边界顶点：最终网格中只被一条边引用一次的端点
  const edgeCount = new Map();
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      const k = edgeKey(f[i], f[(i + 1) % 4]);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
    }
  }
  const boundarySet = new Set();
  for (const [k, n] of edgeCount) {
    if (n !== 1) continue;
    const [a, b] = k.split("|");
    boundarySet.add(a);
    boundarySet.add(b);
  }
  const boundaryVertexIds = vertexIds.filter((id) => boundarySet.has(id));
  // 边界折线的边（每条只被一个面引用）。导出它，调用方才能把「轮廓形状不变」
  // 写成可判定的断言（顶点可以沿边滑，但不能离开折线）。
  const boundaryEdges = [];
  for (const [k, n] of edgeCount) {
    if (n !== 1) continue;
    const [a, b] = k.split("|");
    boundaryEdges.push([a, b]);
  }

  const valence = Object.create(null);
  for (const id of vertexIds) valence[id] = 0;
  for (const f of faces) for (const id of f) valence[id] += 1;

  // 边界顶点的两个边界邻居（沿边界环）：relaxation 让它们**沿边界滑动**，
  // 而不是整个钉死。全钉死会把「贴着边界的那圈四边形」永远留在细分后的原始
  // 形状上，边长比卡在 2.05–2.12 下不来（2026-09-04 实测 68/100 seed 超 2）。
  // 只沿切向滑动 → 六边形轮廓不变，但边界面能跟着内部一起方正化。
  const boundaryNeighbors = Object.create(null);
  for (const [k, n] of edgeCount) {
    if (n !== 1) continue;
    const [a, b] = k.split("|");
    (boundaryNeighbors[a] ??= []).push(b);
    (boundaryNeighbors[b] ??= []).push(a);
  }
  // 轮廓拐角（切向不连续）保持钉死，否则六边形会被磨圆
  const CORNER_COS = Math.cos((150 * Math.PI) / 180); // 夹角小于 150° 视为拐角
  const cornerSet = new Set();
  for (const id of boundarySet) {
    const nb = boundaryNeighbors[id];
    if (!nb || nb.length !== 2) { cornerSet.add(id); continue; }
    const p = positions[id];
    const u = norm2([positions[nb[0]][0] - p[0], positions[nb[0]][1] - p[1]]);
    const v = norm2([positions[nb[1]][0] - p[0], positions[nb[1]][1] - p[1]]);
    if (u[0] * v[0] + u[1] * v[1] > CORNER_COS) cornerSet.add(id);
  }

  function norm2(v) {
    const L = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / L, v[1] / L];
  }

  const frozen = (id) => lockedSet.has(id) || cornerSet.has(id);
  const slidesOnBoundary = (id) => boundarySet.has(id) && !frozen(id);

  // 4. relaxation：每个四边形朝正方形收敛；边界与 locked 顶点不动
  const rest = Object.create(null);
  for (const id of vertexIds) {
    if (frozen(id)) rest[id] = positions[id].slice();
  }
  // S14 的关键一句：*all module-containing cells try to achieve their desired
  // **shape and size***。只收敛形状（把每个四边形拧成正方形）而不管尺寸，
  // 迭代越多反而越糟——格子会各自涨缩，边长比从 2.03 一路劣化到 2.56
  // （2026-09-04 实测 it=50→600）。所以目标向量要先归一化到统一的"期望半径"，
  // 那正是 Oskar 用来治 mushrooming 的同一个 relax pass。
  let restRadius = 0;
  {
    let sum = 0;
    for (const f of faces) {
      const pts = f.map((id) => positions[id]);
      const c = [
        (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4,
        (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4,
      ];
      for (const q of pts) sum += Math.hypot(q[0] - c[0], q[1] - c[1]);
    }
    restRadius = sum / (faces.length * 4 || 1);
  }

  const force = Object.create(null);
  for (let it = 0; it < relaxIterations; it++) {
    for (const id of vertexIds) force[id] = [0, 0];
    for (const f of faces) {
      const pts = f.map((id) => positions[id]);
      const c = [
        (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4,
        (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4,
      ];
      const d0 = [pts[0][0] - c[0], pts[0][1] - c[1]];
      const d1 = rot90([pts[1][0] - c[0], pts[1][1] - c[1]]);
      const d2 = rot180([pts[2][0] - c[0], pts[2][1] - c[1]]);
      const d3 = rot270([pts[3][0] - c[0], pts[3][1] - c[1]]);
      let v = [(d0[0] + d1[0] + d2[0] + d3[0]) / 4, (d0[1] + d1[1] + d2[1] + d3[1]) / 4];
      // 期望尺寸：朝全网格统一半径**轻推**，不是硬拉。
      // 硬归一化会把系统拧爆（边界拐角钉死 + 每格都被强行拉到同一尺寸
      // → 实测边长比飙到 1700+，最小内角 0°）。这里只按 sizeBlend 混合，
      // 并把单次缩放限幅，既治住"各自涨缩"，又不至于撕裂网格。
      const vLen = Math.hypot(v[0], v[1]);
      if (vLen > 1e-9) {
        const want = restRadius / vLen;
        const clamped = Math.max(1 - sizeClamp, Math.min(1 + sizeClamp, want));
        const k = 1 + (clamped - 1) * sizeBlend;
        v = [v[0] * k, v[1] * k];
      }
      const targets = [v, rot270(v), rot180(v), rot90(v)];
      for (let i = 0; i < 4; i++) {
        const id = f[i];
        force[id][0] += c[0] + targets[i][0] - pts[i][0];
        force[id][1] += c[1] + targets[i][1] - pts[i][1];
      }
    }
    for (const id of vertexIds) {
      if (frozen(id)) continue;
      const n = valence[id] || 1;
      let dx = (force[id][0] / n) * relaxStep;
      let dy = (force[id][1] / n) * relaxStep;
      if (slidesOnBoundary(id)) {
        // 只保留切向分量：法向被丢掉，轮廓形状不变
        const nb = boundaryNeighbors[id];
        const t = norm2([
          positions[nb[1]][0] - positions[nb[0]][0],
          positions[nb[1]][1] - positions[nb[0]][1],
        ]);
        const along = dx * t[0] + dy * t[1];
        dx = along * t[0];
        dy = along * t[1];
      }
      positions[id][0] += dx;
      positions[id][1] += dy;
    }
  }
  for (const id of vertexIds) {
    if (!frozen(id) || !rest[id]) continue;
    positions[id][0] = rest[id][0];
    positions[id][1] = rest[id][1];
    positions[id][2] = 0;
  }
  // 把刚好低于 45° 的可动角轻轻推开（不改冻结顶点）
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const f of faces) {
      for (let i = 0; i < 4; i++) {
        const id = f[i];
        if (frozen(id)) continue;
        const prev = positions[f[(i + 3) % 4]];
        const curr = positions[id];
        const next = positions[f[(i + 1) % 4]];
        const ux = prev[0] - curr[0];
        const uy = prev[1] - curr[1];
        const vx = next[0] - curr[0];
        const vy = next[1] - curr[1];
        const du = Math.hypot(ux, uy);
        const dv = Math.hypot(vx, vy);
        if (du < 1e-12 || dv < 1e-12) continue;
        const ang = Math.acos(Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (du * dv))));
        if (ang * (180 / Math.PI) >= 45.2) continue;
        const cx = (prev[0] + curr[0] + next[0]) / 3;
        const cy = (prev[1] + curr[1] + next[1]) / 3;
        curr[0] += (curr[0] - cx) * 0.08;
        curr[1] += (curr[1] - cy) * 0.08;
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const f of faces) ensureCCW(f, positions);

  const hash = hashHex(
    `${vertexIds.map((id) => `${id}:${positions[id].map(round6).join(",")}`).join(";")}|` +
      `${faces.map((f) => f.join(",")).join(";")}`
  );

  return {
    faces,
    positions,
    vertexIds,
    faceIds,
    boundaryVertexIds,
    boundaryEdges,
    hash,
  };
}
