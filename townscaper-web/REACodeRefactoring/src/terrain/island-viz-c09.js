/**
 * island-viz-c09.js — 第 56 批 C09-D：三角网岛的分阶段可视化所需的几何/光照计算（纯函数）。
 *
 * 1654401054828638214「An quaint island being procedurally generated」
 *   三角网逐条长出 → 抬起 → 灰底线稿（崖线/台地线）→ 一帧黑剪影 → 上色（带 AO 软阴影）→ 转镜。
 *   → vertexAO()（水平角遮蔽）、softShadow()（朝太阳步进的软阴影）、featureSegments()（折痕/边界线）。
 * 1448039167057879048「nice timing and visualization」
 *   第一层「帐篷」= Bowyer–Watson 增量插点时连向超级三角形三个远点的边（帧 0001–0015 的放射线），
 *   插完删掉超级三角形 → 扁平点阵（0016–0084）。→ delaunaySteps()。
 *   等高线层 → contourSegments()（marching triangles，真实等值线，不是环状近似）。
 */

/** Bowyer–Watson，记录每插入一个点后的三角形集合（含超级三角形顶点 n..n+2）。 */
export function delaunaySteps(points, { span = 3 } = {}) {
  const n = points.length;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, s = Math.max(maxX - minX, maxZ - minZ, 1) * span;
  const sup = [{ x: cx - s, z: cz - s }, { x: cx + s, z: cz - s }, { x: cx, z: cz + s }];
  const all = points.concat(sup);
  const cc = (t) => {
    const a = all[t[0]], b = all[t[1]], c = all[t[2]];
    const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = a.x * a.x + a.z * a.z, b2 = b.x * b.x + b.z * b.z, c2 = c.x * c.x + c.z * c.z;
    const ux = (a2 * (b.z - c.z) + b2 * (c.z - a.z) + c2 * (a.z - b.z)) / d;
    const uz = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
    return { x: ux, z: uz, r2: (a.x - ux) ** 2 + (a.z - uz) ** 2 };
  };
  let tris = [[n, n + 1, n + 2]];
  const steps = [tris.map((t) => t.slice())];
  for (let i = 0; i < n; i++) {
    const p = all[i], bad = new Set(), cnt = new Map();
    for (const t of tris) { const c = cc(t); if (c && (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < c.r2 * (1 - 1e-9)) bad.add(t); }
    for (const t of bad) for (let e = 0; e < 3; e++) {
      const a = t[e], b = t[(e + 1) % 3], k = a < b ? a + '_' + b : b + '_' + a;
      const r = cnt.get(k); if (r) r.n++; else cnt.set(k, { a, b, n: 1 });
    }
    tris = tris.filter((t) => !bad.has(t));
    for (const e of cnt.values()) if (e.n === 1) tris.push([e.a, e.b, i]);
    steps.push(tris.map((t) => t.slice()));
  }
  const final = tris.filter((t) => t.every((v) => v < n));
  return { all, sup, steps, final, n };
}

/** 三角形集合 → 无向边（[i,j]，i<j）。 */
export function edgesOf(tris) {
  const seen = new Set(), out = [];
  for (const t of tris) for (let e = 0; e < 3; e++) {
    const a = Math.min(t[e], t[(e + 1) % 3]), b = Math.max(t[e], t[(e + 1) % 3]), k = a * 100003 + b;
    if (!seen.has(k)) { seen.add(k); out.push([a, b]); }
  }
  return out;
}

/** 三角高度场取样器：heightAt(x,z) 按重心插值（网格外 → null）；给 faceLevels 时取所在三角的平台高（台地/崖）。 */
export function heightSampler(points, tris, heights, { cell = 1, faceLevels = null } = {}) {
  const bins = new Map();
  const key = (i, j) => i * 92821 + j;
  tris.forEach((t, k) => {
    const xs = t.map((i) => points[i].x), zs = t.map((i) => points[i].z);
    for (let i = Math.floor(Math.min(...xs) / cell); i <= Math.floor(Math.max(...xs) / cell); i++)
      for (let j = Math.floor(Math.min(...zs) / cell); j <= Math.floor(Math.max(...zs) / cell); j++) {
        const kk = key(i, j); let a = bins.get(kk); if (!a) bins.set(kk, a = []); a.push(k);
      }
  });
  return (x, z) => {
    for (const k of bins.get(key(Math.floor(x / cell), Math.floor(z / cell))) ?? []) {
      const [A, B, C] = tris[k].map((i) => points[i]);
      const d = (B.z - C.z) * (A.x - C.x) + (C.x - B.x) * (A.z - C.z);
      if (Math.abs(d) < 1e-14) continue;
      const u = ((B.z - C.z) * (x - C.x) + (C.x - B.x) * (z - C.z)) / d;
      const v = ((C.z - A.z) * (x - C.x) + (A.x - C.x) * (z - C.z)) / d;
      const w = 1 - u - v;
      if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
      if (faceLevels) return faceLevels[k];
      const t = tris[k];
      return u * heights[t[0]] + v * heights[t[1]] + w * heights[t[2]];
    }
    return null;
  };
}

/**
 * 逐顶点水平角 AO：每个方向沿地面步进，取最大仰角；AO = 1 - mean(sin(horizon)) * strength。
 * 高度单位 = 层 × L（与画面里抬起的高度同比例）。
 */
export function vertexAO(points, tris, heights, { L = 0.52, dirs = 12, steps = 10, reach = 3.2, strength = 1 } = {}) {
  const hAt = heightSampler(points, tris, heights);
  return points.map((p, i) => {
    const h0 = heights[i] * L;
    let occ = 0;
    for (let d = 0; d < dirs; d++) {
      const a = (d / dirs) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      let best = 0;
      for (let s = 1; s <= steps; s++) {
        const r = (s / steps) * reach, h = hAt(p.x + dx * r, p.z + dz * r);
        if (h === null) break;
        const el = (h * L - h0) / r;
        if (el > best) best = el;
      }
      occ += best / Math.sqrt(1 + best * best);     // sin(atan(el))
    }
    return Math.max(0, Math.min(1, 1 - (occ / dirs) * strength));
  });
}

/**
 * 软阴影：从顶点朝太阳方向步进，按「光线离地高度 / 距离」取最小值（SDF 式半影），0 = 全影，1 = 全亮。
 * sun = {x, y, z}（指向太阳，y>0）。
 */
export function softShadow(points, tris, heights, sun, { L = 0.52, steps = 24, reach = 9, k = 6 } = {}) {
  const hAt = heightSampler(points, tris, heights);
  const len = Math.hypot(sun.x, sun.z) || 1;
  const dx = sun.x / len, dz = sun.z / len, rise = sun.y / len;      // 水平每走 1，光线升高 rise
  return points.map((p, i) => {
    const y0 = heights[i] * L + 1e-3;
    let lit = 1;
    for (let s = 1; s <= steps; s++) {
      const r = (s / steps) * reach, h = hAt(p.x + dx * r, p.z + dz * r);
      if (h === null) break;
      const clear = y0 + r * rise - h * L;
      lit = Math.min(lit, Math.max(0, (k * clear) / r));
      if (lit <= 0) break;
    }
    return Math.max(0, Math.min(1, lit));
  });
}

/** 折痕 / 边界线：相邻两三角形面法线夹角 > angle 的边，加上外边界。返回顶点对。 */export function featureSegments(points, tris, heights, { L = 0.52, angle = 28 } = {}) {
  const P = (i) => [points[i].x, heights[i] * L, points[i].z];
  const normal = (t) => {
    const [a, b, c] = t.map(P);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; return n.map((x) => x / l);
  };
  const adj = new Map();
  tris.forEach((t, k) => { for (let e = 0; e < 3; e++) { const a = Math.min(t[e], t[(e + 1) % 3]), b = Math.max(t[e], t[(e + 1) % 3]), kk = a * 100003 + b; const r = adj.get(kk); if (r) r.f.push(k); else adj.set(kk, { a, b, f: [k] }); } });
  const N = tris.map(normal), cosT = Math.cos((angle * Math.PI) / 180), out = [];
  for (const e of adj.values()) {
    if (e.f.length === 1) { out.push([e.a, e.b, 'rim']); continue; }
    const [n0, n1] = [N[e.f[0]], N[e.f[1]]];
    if (Math.abs(n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) < cosT) out.push([e.a, e.b, 'crease']);
  }
  return out;
}

/** marching triangles 等值线：levels 每一档一组线段（[[x,z],[x,z], level]）。 */
export function contourSegments(points, tris, heights, levels) {
  const out = [];
  for (const iso of levels) for (const t of tris) {
    const v = t.map((i) => heights[i] - iso);
    const cut = [];
    for (let e = 0; e < 3; e++) {
      const i = e, j = (e + 1) % 3;
      if ((v[i] < 0) !== (v[j] < 0)) {
        const f = v[i] / (v[i] - v[j]), a = points[t[i]], b = points[t[j]];
        cut.push([a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f]);
      }
    }
    if (cut.length === 2) out.push([cut[0], cut[1], iso]);
  }
  return out;
}

/** 转镜等距投影：先绕 y 轴转 yaw，再按等距（2:1）投到屏幕。 */export function orbitProject(x, z, y, { yaw = 0, S = 10, ox = 0, oy = 0, lift = 1 } = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const rx = x * c - z * s, rz = x * s + z * c;
  return [ox + (rx - rz) * S, oy + (rx + rz) * S * 0.5 - y * lift * S, rx + rz];
}

/* ---------- 台地（每个三角一个平台高）：1654 片里的高台、凹槽、矮台与崖壁 ---------- */

/** 每个三角的平台层：三顶点层高的中位数；碰到水面（任一顶点 0）的三角归 0 = 沙滩一圈。 */
export function triLevels(tris, heights, { beach = true } = {}) {
  return tris.map((t) => { const h = t.map((i) => heights[i]).sort((a, b) => a - b); return beach && h[0] === 0 ? 0 : h[1]; });
}

/** 三角邻接：adj[k][e] = 共享边 e（t[e]→t[e+1]）的另一个三角，-1 = 外边界。 */
export function triAdjacency(tris) {
  const m = new Map();
  tris.forEach((t, k) => { for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3]; m.set(a + '_' + b, k); } });
  return tris.map((t) => [0, 1, 2].map((e) => m.get(t[(e + 1) % 3] + '_' + t[e]) ?? -1));
}

const centroid = (points, t) => ({ x: (points[t[0]].x + points[t[1]].x + points[t[2]].x) / 3, z: (points[t[0]].z + points[t[1]].z + points[t[2]].z) / 3 });

/** 平台面 AO：从三角形心按 dirs 个方向步进，取台地高度的最大仰角（崖脚变暗 = 片子着色阶段的软 AO）。 */
export function faceAO(points, tris, levels, { L = 0.8, dirs = 12, steps = 10, reach = 3.5, strength = 1.15 } = {}) {
  const hAt = heightSampler(points, tris, null, { faceLevels: levels });
  return tris.map((t, k) => {
    const c = centroid(points, t), h0 = levels[k] * L;
    let occ = 0;
    for (let d = 0; d < dirs; d++) {
      const a = (d / dirs) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      let best = 0;
      for (let s = 1; s <= steps; s++) {
        const r = (s / steps) * reach, h = hAt(c.x + dx * r, c.z + dz * r);
        if (h === null) break;
        const el = (h * L - h0) / r;
        if (el > best) best = el;
      }
      occ += best / Math.sqrt(1 + best * best);
    }
    return Math.max(0, Math.min(1, 1 - (occ / dirs) * strength));
  });
}

/** 平台面软阴影：从形心朝太阳步进，半影 = min(k·离地高度/距离)。 */
export function faceShadow(points, tris, levels, sun, { L = 0.8, steps = 28, reach = 10, k = 2.5 } = {}) {
  const hAt = heightSampler(points, tris, null, { faceLevels: levels });
  const len = Math.hypot(sun.x, sun.z) || 1, dx = sun.x / len, dz = sun.z / len, rise = sun.y / len;
  return tris.map((t, kk) => {
    const c = centroid(points, t), y0 = levels[kk] * L + 1e-3;
    let lit = 1;
    for (let s = 1; s <= steps; s++) {
      const r = (s / steps) * reach, h = hAt(c.x + dx * r, c.z + dz * r);
      if (h === null) break;
      lit = Math.min(lit, Math.max(0, (k * (y0 + r * rise - h * L)) / r));
      if (lit <= 0) break;
    }
    return lit;
  });
}

/** 台地边线：相邻三角平台层不同的边（崖顶线 / 崖脚线）+ 外边界。返回 {a,b,hi,lo,k}。 */
export function cliffEdges(tris, levels, adj) {
  const out = [];
  tris.forEach((t, k) => {
    for (let e = 0; e < 3; e++) {
      const o = adj[k][e], lo = o < 0 ? 0 : levels[o];
      if (levels[k] > lo || (o < 0 && levels[k] === 0)) out.push({ a: t[e], b: t[(e + 1) % 3], hi: levels[k], lo, k, o });
    }
  });
  return out;
}
