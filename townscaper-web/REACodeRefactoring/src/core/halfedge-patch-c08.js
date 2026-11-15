// r56 C08 · 1458921394855718917「exploring the Half Edge data structure ... lightweight, powerful and versatile」
// 片中流程（全帧）：圆内随机撒下一组组旋转的小方格块（彩色）→ 用半边追出「剩余区域」的各条边界环（彩色描线）
// → 用三角网填满间隙 → 重置再来。这里全部落在共享结构上：方格块 + 间隙三角 → core/halfedge.js buildHalfEdge
// 的 next/prev/twin、boundaryLoops、vertexFan；间隙三角用共享 core/trigraph.js（增量 Delaunay），
// 再按 Sloan 方式强制翻边把块的外边插成约束边（不引入 T 形接头）。
import { TriGraph } from './trigraph.js';
import { buildHalfEdge, checkHalfEdge } from './halfedge.js';

function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const corners = (g) => { const { cx, cz, a, b, s, th } = g, c = Math.cos(th), n = Math.sin(th), hw = a * s / 2, hh = b * s / 2; return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [cx + u * c - v * n, cz + u * n + v * c]); };
function sepRect(P, Q, gap) {
  for (const poly of [P, Q]) for (let i = 0; i < 4; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % 4], nx = z2 - z1, nz = x1 - x2, l = Math.hypot(nx, nz);
    const pr = (R) => R.map(([x, z]) => (x * nx + z * nz) / l);
    const a = pr(P), b = pr(Q);
    if (Math.max(...a) + gap < Math.min(...b) || Math.max(...b) + gap < Math.min(...a)) return true;
  }
  return false;
}
function inRect(g, x, z, pad = 0) { const c = Math.cos(-g.th), n = Math.sin(-g.th), dx = x - g.cx, dz = z - g.cz, u = dx * c - dz * n, v = dx * n + dz * c; return Math.abs(u) < g.a * g.s / 2 + pad && Math.abs(v) < g.b * g.s / 2 + pad; }

/** 第 1 步：圆内撒方格块组（互不重叠，留缝） */
export function scatterGroups({ seed = 1, R = 10, count = 14, s = 1, gap = .9, tries = 400 } = {}) {
  const r = rng(seed), groups = [];
  for (let t = 0; t < tries && groups.length < count; t++) {
    const g = { a: 1 + Math.floor(r() * 3), b: 1 + Math.floor(r() * 4), s, th: r() * Math.PI, cx: (r() * 2 - 1) * R, cz: (r() * 2 - 1) * R };
    const P = corners(g);
    if (P.some(([x, z]) => Math.hypot(x, z) > R - 1.1)) continue;
    if (groups.some((h) => !sepRect(P, corners(h), gap))) continue;
    g.id = groups.length; groups.push(g);
  }
  return groups;
}

/** 第 2–3 步：顶点表 + 方格块的四边形格 + 间隙点 → Delaunay → 约束边 → 去掉块内三角 */
export function fillGaps(groups, { seed = 1, R = 10, spacing = .95, ring = 72 } = {}) {
  const r = rng(seed * 7 + 3), V = [], quads = [], outline = [];
  for (const g of groups) {
    const c = Math.cos(g.th), n = Math.sin(g.th), base = V.length;
    for (let j = 0; j <= g.b; j++) for (let i = 0; i <= g.a; i++) { const u = (i - g.a / 2) * g.s, v = (j - g.b / 2) * g.s; V.push({ x: g.cx + u * c - v * n, z: g.cz + u * n + v * c, group: g.id }); }
    const id = (i, j) => base + j * (g.a + 1) + i;
    for (let j = 0; j < g.b; j++) for (let i = 0; i < g.a; i++) quads.push({ group: g.id, v: [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)] });
    for (let i = 0; i < g.a; i++) { outline.push([id(i, 0), id(i + 1, 0)], [id(i + 1, g.b), id(i, g.b)]); }
    for (let j = 0; j < g.b; j++) { outline.push([id(g.a, j), id(g.a, j + 1)], [id(0, j + 1), id(0, j)]); }
  }
  const nGroupV = V.length;
  for (let k = 0; k < ring; k++) { const a = k / ring * Math.PI * 2; V.push({ x: R * Math.cos(a), z: R * Math.sin(a), group: -1 }); }
  for (let k = 0; k < ring; k++) outline.push([nGroupV + k, nGroupV + (k + 1) % ring]);
  // gap points: dart throwing, away from groups and existing points
  for (let t = 0; t < 4000; t++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (R - spacing * .6), x = d * Math.cos(a), z = d * Math.sin(a);
    if (groups.some((g) => inRect(g, x, z, spacing * .45))) continue;
    if (V.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < spacing * spacing)) continue;
    V.push({ x, z, group: -2 });
  }
  const T = new TriGraph(R * 4);
  for (const p of V) T.add(p.x, p.z);
  // Sloan-style constraint recovery: force-flip edges crossing each outline segment
  const o = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  let forced = 0, missing = 0;
  for (const [a0, b0] of outline) {
    const a = a0 + 3, b = b0 + 3;
    for (let pass = 0; pass < 60; pass++) {
      const em = T.edgeMap(); if (em.has(a < b ? a + ',' + b : b + ',' + a)) break;
      const ax = T.x[a], az = T.y[a], bx = T.x[b], bz = T.y[b]; let flipped = false, crossing = 0;
      for (const k of em.keys()) {
        const [u, v] = k.split(',').map(Number); if (u === a || u === b || v === a || v === b) continue;
        const s1 = o(ax, az, bx, bz, T.x[u], T.y[u]), s2 = o(ax, az, bx, bz, T.x[v], T.y[v]);
        if (s1 * s2 >= 0) continue;
        const s3 = o(T.x[u], T.y[u], T.x[v], T.y[v], ax, az), s4 = o(T.x[u], T.y[u], T.x[v], T.y[v], bx, bz);
        if (s3 * s4 >= 0) continue;
        crossing++; if (T.flip(u, v, { force: true })) { forced++; flipped = true; break; }
      }
      if (!crossing) break; if (!flipped) { missing++; break; }
    }
  }
  const em = T.edgeMap(); missing = outline.filter(([a, b]) => { const u = a + 3, v = b + 3; return !em.has(u < v ? u + ',' + v : v + ',' + u); }).length;
  const tris = T.triangles().filter((t) => {
    const cx = (V[t[0]].x + V[t[1]].x + V[t[2]].x) / 3, cz = (V[t[0]].z + V[t[1]].z + V[t[2]].z) / 3;
    return !groups.some((g) => inRect(g, cx, cz)) && Math.hypot(cx, cz) < R;
  });
  return { V, quads, tris, outline, forced, missingConstraints: missing, nGroupV };
}

const cellOf = (V, id, vs, kind, group) => ({ id, kind, group, n: vs.length, pts: vs.map((i) => ({ id: i, x: V[i].x, z: V[i].z })) });
/** 第 2 步的半边：只拿间隙三角建半边 → 剩余区域的边界环（圆 + 每个块的外轮廓，相邻块会并成一环） */
export function gapLoops(fill) {
  const H = buildHalfEdge(fill.tris.map((t, i) => cellOf(fill.V, i, t, 'tri', -1)));
  return { H, loops: H.boundaryLoops.map((l) => l.map((h) => [H.he[h].origin, H.he[h].dest])), errors: checkHalfEdge(H) };
}
/** 合成整张网格（方格 + 三角）后的半边：应是单一边界环、Euler = 1、无错误 */
export function fullMesh(fill) {
  const cells = [...fill.quads.map((q, i) => cellOf(fill.V, i, q.v, 'quad', q.group)), ...fill.tris.map((t, i) => cellOf(fill.V, fill.quads.length + i, t, 'tri', -1))];
  const H = buildHalfEdge(cells);
  return { H, cells, errors: checkHalfEdge(H) };
}
