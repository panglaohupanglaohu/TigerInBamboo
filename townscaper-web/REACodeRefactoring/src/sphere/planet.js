/**
 * planet.js — 球面网格 + 小星球（第三个项目后期"放到球面上"）。
 *
 * 依据：
 *   1338825080844021760 "generating nice triangulated spheres 1. Random points 2. Space out the points
 *     3. Triangulate 4. Relax using the triangles"      画面：散点 → 点均匀散开 → 一圈圈三角化 → 均匀的三角球
 *   1338829205157646336 "Delaunay Triangulation on a sphere … on a Stereographic Projection … sorted vertically,
 *     which means radially, which makes the algorithm faster"   → buildSphere() 用 core/trigraph.js 在投影平面上三角化
 *   1768627849529893109 "I've gone and put this on a sphere"   画面：绿色小星球，台地、沙滩、海
 *   1769641473895432220 "a 'mushrooming' issue where tall mountains get weirdly wide. I managed to mitigate this by a
 *     relax pass where all module-containing cells try to achieve their desired shape and size"
 *     → 径向抬高时格子按 r/R 变大；relax：每层里"有东西的格子"把角点往自己的期望大小（R/r 缩回去）拉，
 *       共享角点取平均，迭代几遍。这是本地边长弹簧近似，不等同原作模块形状拟合。
 */

import { TriGraph } from '../core/trigraph.js';
import { makeRng, fbm } from '../core/noise.js';

/** 球面三角网：返回 { pts:[[x,y,z]], tris:[[a,b,c]], steps } */
export function buildSphere({ n = 900, seed = 3, spacing = 40, relax = 30 } = {}) {
  if (!Number.isInteger(n) || n < 4 || n > 5000 || !Number.isFinite(seed) ||
      !Number.isInteger(spacing) || spacing < 0 || spacing > 1000 ||
      !Number.isInteger(relax) || relax < 0 || relax > 1000) throw new RangeError('Invalid sphere generation parameters');
  const rng = makeRng(seed);
  // 1. 随机点
  let P = [];
  for (let i = 0; i < n; i++) {
    const z = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    P.push([r * Math.cos(a), z, r * Math.sin(a)]);
  }
  const steps = { random: P.map((p) => p.slice()) };
  // 2. 散开：近邻斥力（同半径球面上）
  const k = Math.sqrt((4 * Math.PI) / n);   // 平均点距
  for (let it = 0; it < spacing; it++) {
    const F = P.map(() => [0, 0, 0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], dz = P[i][2] - P[j][2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > k * k * 2.2) continue;
      const f = (k * k) / (d2 + 1e-6) * 0.012;
      F[i][0] += dx * f; F[i][1] += dy * f; F[i][2] += dz * f;
      F[j][0] -= dx * f; F[j][1] -= dy * f; F[j][2] -= dz * f;
    }
    P = P.map((p, i) => norm([p[0] + F[i][0], p[1] + F[i][1], p[2] + F[i][2]]));
  }
  steps.spaced = P.map((p) => p.slice());
  // 3. 三角化：以最"北"的点为极点做球极投影，平面上按半径排序后增量 Delaunay
  let pole = 0;
  for (let i = 1; i < n; i++) if (P[i][1] > P[pole][1]) pole = i;
  const others = [];
  for (let i = 0; i < n; i++) if (i !== pole) {
    const [x, y, z] = P[i], s = 1 / (1 - y + 1e-9);
    others.push({ i, u: x * s, v: z * s, r: (x * x + z * z) * s * s });
  }
  others.sort((a, b) => a.r - b.r);   // "sorted vertically, which means radially"
  const T = new TriGraph(1e4);
  for (const o of others) T.add(o.u, o.v);
  const proj = others.map((o) => [o.u, o.v]);
  let tris = T.triangles().map((t) => t.map((k2) => others[k2].i));
  // 投影的凸包边连到极点，球面就闭合了
  const cnt = new Map();
  for (const [a, b, c] of tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) cnt.set(u + ',' + v, [u, v]);
  for (const [u, v] of [...cnt.values()]) if (!cnt.has(v + ',' + u)) tris.push([v, u, pole]);
  // 统一朝外
  tris = tris.map(([a, b, c]) => {
    const nrm = cross(sub(P[b], P[a]), sub(P[c], P[a]));
    return dot(nrm, P[a]) < 0 ? [a, c, b] : [a, b, c];
  });
  steps.triangulated = P.map(p => p.slice());
  steps.check = T.check(60);
  steps.projection = { pts: proj, tris: T.triangles(), order: others.map(o=>o.i), pole };
  // 4. 按三角形松弛：每个点移到相邻三角形重心的平均
  const nb = P.map(() => []);
  tris.forEach((t, ti) => t.forEach((v) => nb[v].push(ti)));
  for (let it = 0; it < relax; it++) {
    const C = tris.map(([a, b, c]) => norm([(P[a][0] + P[b][0] + P[c][0]) / 3, (P[a][1] + P[b][1] + P[c][1]) / 3, (P[a][2] + P[b][2] + P[c][2]) / 3]));
    P = P.map((p, i) => {
      let s = [0, 0, 0];
      for (const ti of nb[i]) { s[0] += C[ti][0]; s[1] += C[ti][1]; s[2] += C[ti][2]; }
      return norm(lerp(p, norm(s), 0.6));
    });
  }
  steps.relaxed = P.map(p => p.slice());
  return { pts: P, tris, nb, steps };
}

/** Closed unit-sphere mesh diagnostics. Topology is distinct from planar Delaunay.
 * This checks edge incidence, connectivity, Euler and outward faces; it is not
 * a self-intersection proof or an exact spherical Delaunay predicate.
 */
export function sphereTopologyReport(points, tris) {
  const edges = new Map(), faces = new Set(), used = new Set();
  const neighbors = points.map(()=>new Set());
  let invalidFaces=0, duplicateFaces=0, degenerateFaces=0, inwardFaces=0;
  const finite = points.every(p=>Array.isArray(p) && p.length===3 && p.every(Number.isFinite));
  const maxRadiusError = finite ? points.reduce((m,p)=>Math.max(m,Math.abs(Math.hypot(...p)-1)),0) : Infinity;
  for (const t of tris) {
    if (!Array.isArray(t) || t.length!==3 || new Set(t).size!==3 || !t.every(v=>Number.isInteger(v)&&v>=0&&v<points.length)) { invalidFaces++; continue; }
    const key=[...t].sort((a,b)=>a-b).join(',');if(faces.has(key))duplicateFaces++;faces.add(key);
    const [a,b,c]=t, normal=finite?cross(sub(points[b],points[a]),sub(points[c],points[a])):[NaN,NaN,NaN];
    if (!(Math.hypot(...normal)>1e-14)) degenerateFaces++;
    if (!(dot(normal,points[a])>0)) inwardFaces++;
    for (const [u,v] of [[a,b],[b,c],[c,a]]) {
      used.add(u);used.add(v);neighbors[u].add(v);neighbors[v].add(u);
      const k=u<v?u+','+v:v+','+u,list=edges.get(k)||[];list.push([u,v]);edges.set(k,list);
    }
  }
  let boundaryEdges=0,nonManifoldEdges=0,windingConflicts=0;
  for(const list of edges.values()){
    if(list.length===1)boundaryEdges++;else if(list.length!==2)nonManifoldEdges++;
    else if(list[0][0]!==list[1][1])windingConflicts++;
  }
  const seen=new Set();let components=0;
  for(const start of used)if(!seen.has(start)){components++;const stack=[start];seen.add(start);while(stack.length){const v=stack.pop();for(const u of neighbors[v])if(!seen.has(u)){seen.add(u);stack.push(u);}}}
  const orphanVertices=points.length-used.size,euler=used.size-edges.size+tris.length;
  const closed=finite && !invalidFaces && !duplicateFaces && !degenerateFaces && !inwardFaces && !boundaryEdges && !nonManifoldEdges && !windingConflicts && !orphanVertices && components===1 && euler===2 && maxRadiusError<1e-8;
  return {closed,vertices:points.length,edges:edges.size,faces:tris.length,euler,components,orphanVertices,boundaryEdges,nonManifoldEdges,windingConflicts,invalidFaces,duplicateFaces,degenerateFaces,inwardFaces,finite,maxRadiusError};
}

/**
 * 小星球：每个三角网顶点的对偶多边形 = 一格（五边形 / 六边形），高度场 → 台阶。
 * 角点 = 三角形重心方向。返回 { cells, corners, height, mesh(relaxOn) }
 */
export function buildPlanet(sphere, { seed = 3, R = 4, L = 0.32, maxH = 6 } = {}) {
  const { pts, tris, nb } = sphere;
  const corners = tris.map(([a, b, c]) => norm([pts[a][0] + pts[b][0] + pts[c][0], pts[a][1] + pts[b][1] + pts[c][1], pts[a][2] + pts[b][2] + pts[c][2]]));
  // 每个顶点周围的三角按角度排序 → 一格的角点环
  const cells = pts.map((p, i) => {
    const ring = nb[i].slice();
    const t1 = norm(cross(p, Math.abs(p[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t2 = cross(p, t1);
    ring.sort((a, b) => Math.atan2(dot(corners[a], t2), dot(corners[a], t1)) - Math.atan2(dot(corners[b], t2), dot(corners[b], t1)));
    return { id: i, c: p, ring };
  });
  // 邻居：共享一条边（两个连续角点）
  const edgeOwner = new Map();
  for (const c of cells) for (let k = 0; k < c.ring.length; k++) edgeOwner.set(c.ring[k] + ',' + c.ring[(k + 1) % c.ring.length], c.id);
  for (const c of cells) c.nb = c.ring.map((a, k) => edgeOwner.get(c.ring[(k + 1) % c.ring.length] + ',' + a) ?? -1);
  // 高度：球面方向混合两个2D噪声切片（并非真正3D纹理） → 0 = 海，1 = 沙滩，2.. 台地（偶数层量化，像地形管线）
  const H = cells.map((c) => {
    const [x, y, z] = c.c;
    const e = fbm(x * 1.3 + 5 + z * 0.7, y * 1.3 + 9 - z * 0.4, { octaves: 4, freq: 1.4, seed }) + 0.25 * fbm(z * 2.1 + 3, x * 2.1 - y, { octaves: 2, freq: 2, seed: seed + 7 });
    const k = (e - 0.56) / 0.44;
    if (k < 0) return 0;
    if (k < 0.08) return 1;
    return Math.min(maxH, 2 + Math.floor((k - 0.08) * maxH * 1.25 / 2) * 2);
  });
  return { cells, corners, H, R, L };
}

/**
 * 每个角点在每一层的位置。relax = false：纯径向（r 越大格子越大 = "蘑菇化"）；
 * relax = true：有东西的格子把角点往"期望大小"拉（1769641473895432220）。
 * 返回 at(cornerId, level) → [x, y, z]
 */
export function cornerPositions(planet, { relax = true, iters = 40, moduleCells = null } = {}) {
  const { cells, corners, H, R, L } = planet;
  if (!Number.isFinite(R) || R <= 0 || !Number.isFinite(L) || L < 0 ||
      !Number.isInteger(iters) || iters < 0 || iters > 1000 || H.length !== cells.length ||
      !H.every(h => Number.isInteger(h) && h >= 0 && h <= 256)) throw new RangeError('Invalid planet relaxation parameters');
  // 1769641473895432220: "all module-containing cells ... desired shape and size".
  // Explicit selection is a hook for real module ownership, not another voxel field.
  // null preserves the historical all-land proxy. [] means no module constraints.
  if (moduleCells !== null && !Array.isArray(moduleCells)) throw new TypeError('moduleCells must be cell IDs');
  const selected = moduleCells === null ? null : new Set(moduleCells);
  if (selected && [...selected].some(id => !Number.isInteger(id) || !cells[id] || cells[id].id !== id)) throw new RangeError('Invalid module cell ID');
  const active = (id,l) => H[id] >= l && (!selected || selected.has(id));
  const maxH = H.reduce((a,b) => Math.max(a,b),0);
  // 边表（角点对）
  const edges = new Map();
  for (const c of cells) for (let k = 0; k < c.ring.length; k++) {
    const a = c.ring[k], b = c.ring[(k + 1) % c.ring.length];
    const key = a < b ? a + ',' + b : b + ',' + a;
    if (!edges.has(key)) edges.set(key, { a, b, cells: [] });
    edges.get(key).cells.push(c.id);
  }
  const E = [...edges.values()];
  const pos = [];
  for (let l = 0; l <= maxH; l++) {
    let D = corners.map((d) => d.slice());
    if (relax && l > 0) {
      const r = R + l * L, s = R / r;   // 期望：这一层的格子和海平面一样大 → 单位球上的边长缩 s 倍
      // 弹簧：至少一侧是"有东西的格子"的边；只碰到空格子的角点钉住不动
      const free = new Uint8Array(corners.length);
      const springs = [];
      for (const e of E) {
        if (!e.cells.some((id) => active(id, l))) continue;
        springs.push([e.a, e.b, len(sub(corners[e.a], corners[e.b])) * s]);
      }
      // A shared corner moves iff at least one selected occupied cell touches it.
      const touch = new Uint8Array(corners.length);
      for (const c of cells) if (active(c.id, l)) for (const k of c.ring) touch[k] = 1;
      for (let k = 0; k < corners.length; k++) free[k] = touch[k];
      for (let it = 0; it < iters; it++) {
        const acc = D.map(() => [0, 0, 0, 0]);
        for (const [a, b, rest] of springs) {
          const d = sub(D[b], D[a]), cur = len(d) || 1e-9, f = (cur - rest) / cur * 0.5;
          if (free[a]) { acc[a][0] += d[0] * f; acc[a][1] += d[1] * f; acc[a][2] += d[2] * f; acc[a][3]++; }
          if (free[b]) { acc[b][0] -= d[0] * f; acc[b][1] -= d[1] * f; acc[b][2] -= d[2] * f; acc[b][3]++; }
        }
        D = D.map((d, k) => (acc[k][3] ? norm([d[0] + acc[k][0] / acc[k][3] * 0.8, d[1] + acc[k][1] / acc[k][3] * 0.8, d[2] + acc[k][2] / acc[k][3] * 0.8]) : d));
      }
    }
    pos.push(D);
  }
  return (k, l) => {
    if (!Number.isInteger(k) || !corners[k] || !Number.isInteger(l) || l < 0 || l > maxH) throw new RangeError('Invalid planet corner/level');
    const d = pos[l][k], r = R + l * L; return [d[0] * r, d[1] * r, d[2] * r];
  };
}

/** 网格：顶面 + 侧壁，顶点色。返回 { position, normal, color } 数组 */
export function planetMesh(planet, at) {
  const { cells, H } = planet;
  const P = [], N = [], C = [];
  const col = (h, wall) => wall ? (h <= 1 ? [0.62, 0.55, 0.48] : [0.70, 0.68, 0.64]) : h === 1 ? [0.93, 0.84, 0.62] : h <= 3 ? [0.55, 0.74, 0.40] : h <= 5 ? [0.47, 0.66, 0.36] : [0.86, 0.88, 0.84];
  const tri = (a, b, c, k) => {
    const n = norm(cross(sub(b, a), sub(c, a)));
    for (const v of [a, b, c]) { P.push(...v); N.push(...n); C.push(...k); }
  };
  for (const c of cells) {
    const h = H[c.id];
    if (h === 0) continue;
    const ring = c.ring.map((k) => at(k, h));
    const ctr = ring.reduce((s, v) => [s[0] + v[0] / ring.length, s[1] + v[1] / ring.length, s[2] + v[2] / ring.length], [0, 0, 0]);
    const shade = 0.94 + 0.08 * ((c.id * 7919) % 13) / 13;
    const top = col(h, false).map((x) => x * shade);
    for (let k = 0; k < ring.length; k++) tri(ctr, ring[k], ring[(k + 1) % ring.length], top);
    for (let k = 0; k < c.ring.length; k++) {
      const o = c.nb[k], oh = o >= 0 ? H[o] : 0;
      if (oh >= h) continue;
      const a = c.ring[k], b = c.ring[(k + 1) % c.ring.length];
      for (let l = oh + 1; l <= h; l++) {
        const w = col(l, true).map((x) => x * (l % 2 ? 0.92 : 1));
        const a0 = at(a, l - 1), b0 = at(b, l - 1), a1 = at(a, l), b1 = at(b, l);
        tri(a0, b0, b1, w); tri(a0, b1, a1, w);
      }
    }
  }
  return { position: P, normal: N, color: C };
}

/** 1769641473895432220: per-cell desired size diagnostics. Not a proof of
 * original module fitting, global injectivity, or side-wall collision freedom. */
export function moduleSizeReport(planet, at, { moduleCells = null } = {}) {
  const ids = moduleCells === null ? planet.cells.filter(c => planet.H[c.id] > 0).map(c => c.id) : moduleCells;
  if (!Array.isArray(ids) || ids.some(id => !Number.isInteger(id) || !planet.cells[id])) throw new RangeError('Invalid module cell IDs');
  const area = ring => { let sum=0; for(let i=1;i+1<ring.length;i++) sum+=len(cross(sub(ring[i],ring[0]),sub(ring[i+1],ring[0])))/2; return sum; };
  const rows=[];
  for (const id of new Set(ids)) {
    const c=planet.cells[id],h=planet.H[id]; if(!h)continue;
    const base=c.ring.map(k=>at(k,0)),top=c.ring.map(k=>at(k,h));
    let maxEdgeError=0;
    for(let i=0;i<base.length;i++) { const j=(i+1)%base.length,rest=len(sub(base[i],base[j])); maxEdgeError=Math.max(maxEdgeError,Math.abs(len(sub(top[i],top[j]))/rest-1)); }
    const ratio=area(top)/area(base);
    rows.push({id,height:h,areaRatio:ratio,maxEdgeError});
  }
  return { cells:rows, count:rows.length, minAreaRatio:rows.length?Math.min(...rows.map(c=>c.areaRatio)):1,
    maxAreaRatio:rows.length?Math.max(...rows.map(c=>c.areaRatio)):1,
    maxEdgeError:rows.reduce((a,c)=>Math.max(a,c.maxEdgeError),0) };
}

/** 统计"蘑菇化"：最高一层的格子面积 / 海平面面积 */
export function mushroomRatio(planet, at) {
  const { cells, H } = planet;
  let num = 0, den = 0;
  const area = (ring) => {
    let s = 0;
    for (let k = 1; k < ring.length - 1; k++) s += len(cross(sub(ring[k], ring[0]), sub(ring[k + 1], ring[0]))) / 2;
    return s;
  };
  for (const c of cells) {
    const h = H[c.id];
    if (h < 4) continue;
    num += area(c.ring.map((k) => at(k, h)));
    den += area(c.ring.map((k) => at(k, 0)));
  }
  return den ? num / den : 1;
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
