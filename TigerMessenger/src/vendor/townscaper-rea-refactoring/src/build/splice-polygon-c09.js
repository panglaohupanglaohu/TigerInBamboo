/**
 * splice-polygon-c09.js — 第 56 批 C09-C · 1584623053061099520
 * 「I wrote a thing to splice houses into the terrain. Mostly, the houses are part of pre-build tiles, but would be useful
 *   insert them at will too. You can kinda see the structure of my mesh system and mesh algoritms by how the yellow lines
 *   are rotating around the verts.」
 *
 * 片子（453 帧；原尺寸 5/65/155/235/300/303/392/452 复看）：深色地形三角网 + 白色房屋占地轮廓（带凹口的多边形，
 * 横跨好几个地形三角），黄色线段绕着一个个顶点转（半边沿顶点扇遍历）；300 后切到实体：黄屋顶房子坐在台地上。
 * 已有 build/splice.js 只在**单格内**切凸占地（splicePolygon，环带拉链）。这里补「任意轮廓插入 + 周边重网格」：
 *
 *   spliceFootprint(mesh, poly)：mesh = { verts:[[x,z]], tris:[[i,j,k]] }（共享顶点索引的共形三角网），poly 任意简单多边形（可凹）
 *     ① 受影响三角 = 与 poly 有重叠的三角；向外扩一圈直到它们的并 R 的边界是一条简单环（保证 poly 严格在 R 内）；
 *     ② R \ poly 是带一个洞的环形域：洞（poly）桥接到外环可见顶点，耳切（不丢共线点 → 外环上原顶点全部保留，
 *        R 外的三角不出现 T 形接点）；
 *     ③ 约束 Lawson 翻边（外环边、poly 边不翻）让新三角接近 Delaunay；
 *   结果：R 外的原三角原样保留 + 新三角；新三角的边界 = R 外环 + poly 洞（半边结构 boundaryLoops = 2、Euler = 0）。
 *
 *   prepareFootprintSplices(world, {L, at})：把 world.spliceFootprintsC09（[{poly,stories}]）落到实际地形顶面扇形上
 *     （与 terrainmesh 同一 at(p, 切面) 笼形变端点、同层平顶），供 terrainmesh 三处挂钩：跳过 R 内原扇形三角、写新三角、写房子。
 *   默认无 spliceFootprintsC09 → prepare 返回 null，terrainmesh 输出逐位不变。
 */
import { skeletonRoof } from '../core/hip-roof.js';
const EPS = 1e-9;
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
export const ringArea2 = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const triArea = (a, b, c) => cross(a, b, c) / 2;
function segCross(p1, p2, q1, q2) {   // 真相交（不含端点接触）
  const d1 = cross(q1, q2, p1), d2 = cross(q1, q2, p2), d3 = cross(p1, p2, q1), d4 = cross(p1, p2, q2);
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}
function segTouch(p1, p2, q1, q2) {   // 相交或接触（含共线重叠）
  const o = (a, b, c) => { const v = cross(a, b, c); return Math.abs(v) < EPS ? 0 : v > 0 ? 1 : -1; };
  const on = (a, b, c) => Math.min(a[0], b[0]) - EPS <= c[0] && c[0] <= Math.max(a[0], b[0]) + EPS && Math.min(a[1], b[1]) - EPS <= c[1] && c[1] <= Math.max(a[1], b[1]) + EPS;
  const a = o(p1, p2, q1), b = o(p1, p2, q2), c = o(q1, q2, p1), d = o(q1, q2, p2);
  if (a !== b && c !== d) return true;
  return (a === 0 && on(p1, p2, q1)) || (b === 0 && on(p1, p2, q2)) || (c === 0 && on(q1, q2, p1)) || (d === 0 && on(q1, q2, p2));
}
export function pointInPoly(p, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const inTriStrict = (p, a, b, c) => cross(a, b, p) > EPS && cross(b, c, p) > EPS && cross(c, a, p) > EPS;
const inTriClosed = (p, a, b, c) => cross(a, b, p) >= -EPS && cross(b, c, p) >= -EPS && cross(c, a, p) >= -EPS;
function triOverlapsPoly(T, P) {
  for (const p of P) if (inTriClosed(p, ...T)) return true;
  for (const q of T) if (pointInPoly(q, P)) return true;
  for (let i = 0; i < 3; i++) for (let j = 0; j < P.length; j++) if (segTouch(T[i], T[(i + 1) % 3], P[j], P[(j + 1) % P.length])) return true;
  const c = [(T[0][0] + T[1][0] + T[2][0]) / 3, (T[0][1] + T[1][1] + T[2][1]) / 3];
  return pointInPoly(c, P);
}
/** 一组三角（同向 CCW）的边界有向边：key 'a>b'；返回 Map(a → [b...]) 与边列表。 */
function boundaryOf(tris, set) {
  const dir = new Set();
  for (const t of set) { const [a, b, c] = tris[t]; dir.add(a + '>' + b); dir.add(b + '>' + c); dir.add(c + '>' + a); }
  const edges = [];
  for (const t of set) { const [a, b, c] = tris[t]; for (const [u, v] of [[a, b], [b, c], [c, a]]) if (!dir.has(v + '>' + u)) edges.push([u, v]); }
  return edges;
}
function singleLoop(edges) {
  const next = new Map();
  for (const [u, v] of edges) { if (next.has(u)) return null; next.set(u, v); }   // 夹点（一个顶点两条出边）
  if (!edges.length) return null;
  const loop = [edges[0][0]]; let cur = next.get(edges[0][0]);
  while (cur !== edges[0][0]) { if (cur === undefined || loop.length > edges.length) return null; loop.push(cur); cur = next.get(cur); }
  return loop.length === edges.length ? loop : null;   // 多个环 → null
}

/** 耳切带重复索引的简单多边形（桥接后），不丢共线点：只切严格凸、不含其它点的耳。 */
function earClipKeep(verts, idx) {
  const out = [], L = idx.slice();
  let guard = 0;
  while (L.length > 3 && guard++ < 20000) {
    let cut = false;
    for (let k = 0; k < L.length; k++) {
      const i0 = L[(k + L.length - 1) % L.length], i1 = L[k], i2 = L[(k + 1) % L.length];
      const a = verts[i0], b = verts[i1], c = verts[i2];
      if (cross(a, b, c) <= EPS) continue;
      let ok = true;
      for (const j of L) { if (j === i0 || j === i1 || j === i2) continue; const p = verts[j]; if (inTriClosed(p, a, b, c) && !(Math.hypot(p[0] - a[0], p[1] - a[1]) < EPS || Math.hypot(p[0] - b[0], p[1] - b[1]) < EPS || Math.hypot(p[0] - c[0], p[1] - c[1]) < EPS)) { ok = false; break; } }
      if (!ok) continue;
      out.push([i0, i1, i2]); L.splice(k, 1); cut = true; break;
    }
    if (!cut) throw new Error('earClipKeep stuck (' + L.length + ' left)');
  }
  if (L.length === 3) { if (cross(verts[L[0]], verts[L[1]], verts[L[2]]) <= EPS) throw new Error('degenerate last ear'); out.push(L.slice()); }
  return out;
}
/** 洞桥接到外环：洞的最右顶点 → 最近的、连线不穿外环 / 洞任何边的外环顶点。outer CCW，hole CW。 */
function bridge(verts, outer, hole) {
  let m = 0; for (let i = 1; i < hole.length; i++) if (verts[hole[i]][0] > verts[hole[m]][0]) m = i;
  const M = verts[hole[m]];
  const cand = outer.map((v, i) => ({ v, i, d: Math.hypot(verts[v][0] - M[0], verts[v][1] - M[1]) })).sort((a, b) => a.d - b.d);
  const segs = [...outer.map((v, i) => [v, outer[(i + 1) % outer.length]]), ...hole.map((v, i) => [v, hole[(i + 1) % hole.length]])];
  for (const { v, i } of cand) {
    const V = verts[v]; let ok = true;
    for (const [a, b] of segs) { if (a === v || b === v || a === hole[m] || b === hole[m]) continue; if (segTouch(M, V, verts[a], verts[b])) { ok = false; break; } }
    if (!ok) continue;
    // 线段中点必须在 R \ poly 里（在外环内、洞外）
    const mid = [(M[0] + V[0]) / 2, (M[1] + V[1]) / 2];
    if (!pointInPoly(mid, outer.map((k) => verts[k])) || pointInPoly(mid, hole.map((k) => verts[k]))) continue;
    const hr = [...hole.slice(m), ...hole.slice(0, m)];
    return [...outer.slice(0, i + 1), ...hr, hole[m], ...outer.slice(i)];
  }
  throw new Error('no visible bridge');
}
/** 约束 Lawson 翻边：fixed 里的无向边不翻。 */
function lawson(verts, tris, fixed) {
  const key = (a, b) => a < b ? a + ',' + b : b + ',' + a;
  let flips = 0;
  for (let pass = 0; pass < 4000; pass++) {
    const owner = new Map(); tris.forEach((t, ti) => { for (let e = 0; e < 3; e++) { const k = key(t[e], t[(e + 1) % 3]); if (!owner.has(k)) owner.set(k, []); owner.get(k).push([ti, e]); } });
    let any = false;
    for (const [k, own] of owner) {
      if (own.length !== 2 || fixed.has(k)) continue;
      const [[t0, e0], [t1, e1]] = own, A = tris[t0], B = tris[t1];
      const a = A[e0], b = A[(e0 + 1) % 3], c = A[(e0 + 2) % 3], d = B[(e1 + 2) % 3];
      const pa = verts[a], pb = verts[b], pc = verts[c], pd = verts[d];
      // d 在三角 abc 外接圆内 → 翻（且四边形凸）
      const ax = pa[0] - pd[0], ay = pa[1] - pd[1], bx = pb[0] - pd[0], by = pb[1] - pd[1], cx = pc[0] - pd[0], cy = pc[1] - pd[1];
      const det = (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay);
      if (det <= 1e-12) continue;
      if (cross(pc, pa, pd) <= EPS || cross(pd, pb, pc) <= EPS) continue;
      tris[t0] = [c, a, d]; tris[t1] = [d, b, c]; flips++; any = true; break;
    }
    if (!any) break;
  }
  return flips;
}

export function spliceFootprint(mesh, polyIn, { maxGrow = 6 } = {}) {
  const verts = mesh.verts.map((v) => v.slice()), tris = mesh.tris.map((t) => (cross(verts[t[0]], verts[t[1]], verts[t[2]]) < 0 ? [t[0], t[2], t[1]] : t.slice()));
  if (!Array.isArray(polyIn) || polyIn.length < 3) throw new RangeError('footprint polygon needs ≥3 points');
  const poly = ringArea2(polyIn) < 0 ? polyIn.slice().reverse() : polyIn.slice();
  for (let i = 0; i < poly.length; i++) for (let j = i + 2; j < poly.length; j++) { if (i === 0 && j === poly.length - 1) continue; if (segTouch(poly[i], poly[(i + 1) % poly.length], poly[j], poly[(j + 1) % poly.length])) throw new RangeError('footprint polygon self-intersects'); }
  const T = (t) => tris[t].map((k) => verts[k]);
  let set = new Set(); tris.forEach((_, t) => { if (triOverlapsPoly(T(t), poly)) set.add(t); });
  if (!set.size) throw new RangeError('footprint off mesh');
  const byVert = new Map(); tris.forEach((t, ti) => { for (const k of t) { if (!byVert.has(k)) byVert.set(k, []); byVert.get(k).push(ti); } });
  let loop = null, grown = 0;
  const ok = () => {
    loop = singleLoop(boundaryOf(tris, set)); if (!loop) return false;
    const R = loop.map((k) => verts[k]);
    for (let i = 0; i < loop.length; i++) for (let j = 0; j < poly.length; j++) if (segTouch(R[i], R[(i + 1) % R.length], poly[j], poly[(j + 1) % poly.length])) return false;   // poly 要严格在 R 内
    return poly.every((p) => pointInPoly(p, R));
  };
  while (!ok()) {
    if (grown++ >= maxGrow) throw new RangeError('footprint not enclosed by mesh (off plateau / mesh hole)');
    const add = new Set(set); for (const t of set) for (const k of tris[t]) for (const u of byVert.get(k)) add.add(u); set = add;
  }
  const outer = loop, base = verts.length;
  for (const p of poly) verts.push(p.slice());
  const hole = poly.map((_, i) => base + i).reverse();   // CW
  const merged = bridge(verts, outer, hole);
  const fresh = earClipKeep(verts, merged);
  const key = (a, b) => a < b ? a + ',' + b : b + ',' + a, fixed = new Set();
  for (let i = 0; i < outer.length; i++) fixed.add(key(outer[i], outer[(i + 1) % outer.length]));
  for (let i = 0; i < hole.length; i++) fixed.add(key(hole[i], hole[(i + 1) % hole.length]));
  const flips = lawson(verts, fresh, fixed);
  const kept = tris.filter((_, t) => !set.has(t));
  const areaR = [...set].reduce((s, t) => s + triArea(...T(t)), 0), areaNew = fresh.reduce((s, t) => s + triArea(verts[t[0]], verts[t[1]], verts[t[2]]), 0);
  let minAngle = Infinity;
  for (const t of fresh) for (let e = 0; e < 3; e++) { const a = verts[t[e]], b = verts[t[(e + 1) % 3]], c = verts[t[(e + 2) % 3]]; const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - a[0], c[1] - a[1]]; minAngle = Math.min(minAngle, Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v)))))); }
  return { source: mesh, verts, tris: [...kept, ...fresh], kept, fresh, removed: [...set], outer, hole, poly, flips, grown: grown, areaR, areaNew, areaPoly: ringArea2(poly), minAngleDeg: minAngle * 180 / Math.PI };
}

/** 半边检查用：把三角转成 core/halfedge.js 的格式。 */
export const trisAsCells = (verts, tris) => tris.map((t, i) => ({ id: i, pts: t.map((k) => ({ id: k, x: verts[k][0], z: verts[k][1] })) }));

/**
 * 把 world.spliceFootprintsC09 落到实际地形顶面上（terrainmesh 用）。
 * 每个占地：取多边形形心所在格的地面层 g；收集附近同层、裸露、非河、无旧 splice 的格的顶面扇形（同 terrainmesh：
 * 环角 at(p,g)、格心 = 环角均值、y = g·L），按共享角点 id 合成共形网格，跑 spliceFootprint。
 * 返回 { skip:Set(cellId*64+i), items:[{y, res, g, stories}] }；没有占地 / 开了软顶 → null。
 */
export function prepareFootprintSplices(world, { L, at }) {
  const list = world.spliceFootprintsC09;
  if (!Array.isArray(list) || !list.length || world.softTops) return null;
  const skip = new Set(), items = [], errors = [];
  for (const fp of list) {
    try {
      const P = fp.poly, cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length;
      let home = null, g = 0;
      for (const c of world.cells) { const gg = world.ground(c); if (!gg) continue; if (pointInPoly([cx, cz], c.pts.map((p) => at(p, gg)))) { home = c; g = gg; break; } }
      if (!home) throw new RangeError('footprint centre not on land');
      const R = Math.max(...P.map((p) => Math.hypot(p[0] - cx, p[1] - cz))) + 3;
      const verts = [], tris = [], vid = new Map(), owner = [];
      for (const c of world.cells) {
        if (world.ground(c) !== g || world.isSolid(c, g + 1) || world.river?.[c.id] || world.splicedHouses?.has(c.id)) continue;
        if (Math.hypot(c.cx - cx, c.cz - cz) > R) continue;
        const ring = c.pts.map((p) => { if (!vid.has(p.id)) { vid.set(p.id, verts.length); verts.push(at(p, g)); } return vid.get(p.id); });
        const ci = verts.length; verts.push([c.pts.reduce((s, p, i) => s + verts[ring[i]][0], 0) / c.n, c.pts.reduce((s, p, i) => s + verts[ring[i]][1], 0) / c.n]);
        for (let i = 0; i < c.n; i++) { tris.push([ci, ring[i], ring[(i + 1) % c.n]]); owner.push(c.id * 64 + i); }
      }
      const res = spliceFootprint({ verts, tris }, P);
      for (const t of res.removed) skip.add(owner[t]);
      items.push({ home: home.id, y: g * L, g, res, stories: fp.stories ?? 1, roof: fp.roof ?? 0.55 });
    } catch (e) { errors.push(String(e.message || e)); }
  }
  return { skip, items, errors, cells: new Set([...skip].map((k) => Math.floor(k / 64))) };
}

/** terrainmesh 挂钩 ③：写 R 内的新三角（本层顶面色）和房子（墙 + 直骨架四坡顶，黄屋顶）。 */
export function emitFootprintSplices(w, spl, { cells, colorOf, wallColor, roofColor, L, UP }) {
  const out = [];
  for (const it of spl.items) {
    w.at?.(cells[it.home]);
    const { res, y } = it, V = res.verts, col = colorOf(it.home);
    for (const t of res.fresh) w.tri(...t.map((k) => [V[k][0], y, V[k][1]]), UP, col, 1);
    const P = res.poly, y0 = y - 0.08, y1 = y + it.stories * L * 0.8;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], nx = b[1] - a[1], nz = -(b[0] - a[0]), l = Math.hypot(nx, nz) || 1;   // CCW 外法线
      w.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [nx / l, 0, nz / l], wallColor, 0.97);
    }
    let roofTris = 0;
    try { const r = skeletonRoof([P.map((p) => ({ x: p[0], z: p[1] }))], { base: y1, slope: it.roof, overhang: 0.06 }); for (const q of r.tris) { w.tri(q[0], q[1], q[2], UP, roofColor, 1); roofTris++; } }
    catch { /* 骨架失败：平顶 */ }
    out.push({ home: it.home, fresh: res.fresh.length, removed: res.removed.length, roofTris });
  }
  return out;
}
