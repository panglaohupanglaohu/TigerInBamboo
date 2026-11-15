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
export function buildSphere({ n = 900, seed = 3, spacing = 40, relax = 30, history = false } = {}) {
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
  // r55: optional per-iteration snapshots for the stage animation (does not change the result)
  if (history) { steps.spacingFrames = []; steps.relaxFrames = []; }
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
    if (history) steps.spacingFrames.push(P.map((p) => p.slice()));
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
    if (history) steps.relaxFrames.push(P.map((p) => p.slice()));
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
export function cornerPositions(planet, { relax = true, iters = 40, moduleCells = null, solver = 'spring', maxLean = 30 } = {}) {
  const { cells, corners, H, R, L } = planet;
  if (!Number.isFinite(R) || R <= 0 || !Number.isFinite(L) || L < 0 ||
      !Number.isInteger(iters) || iters < 0 || iters > 1000 || H.length !== cells.length ||
      !H.every(h => Number.isInteger(h) && h >= 0 && h <= 256)) throw new RangeError('Invalid planet relaxation parameters');
  // 1769641473895432220: "all module-containing cells ... desired shape and size".
  // Explicit selection is a hook for real module ownership, not another voxel field.
  // null preserves the historical all-land proxy. [] means no module constraints.
  if (moduleCells !== null && !Array.isArray(moduleCells)) throw new TypeError('moduleCells must be cell IDs');
  if (!['spring', 'shape'].includes(solver) || !(maxLean >= 0 && maxLean < 90)) throw new RangeError('Invalid relax solver');
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
    if (relax && l > 0 && solver === 'shape') D = componentScaleLevel(cells, corners, pos[l - 1], (id) => active(id, l), R, L, l, maxLean);
    else if (relax && l > 0) {
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
  const sampler = (k, l) => {
    if (!Number.isInteger(k) || !corners[k] || !Number.isInteger(l) || l < 0 || l > maxH) throw new RangeError('Invalid planet corner/level');
    const d = pos[l][k], r = R + l * L; return [d[0] * r, d[1] * r, d[2] * r];
  };
  sampler.components = pos.flatMap((D) => D.components || []);
  return sampler;
}

/**
 * 装配顺序。784847933686575104 / 784847588893814785 两条老片里，球壳不是一次出现：
 * 先一小片，然后沿边缘一路铺满整个球（每个前缀都连通），最后才整球自转。
 *
 * mode: 'frontier' 邻接前沿生长 | 'height' 先低层后高层 | 'shuffle' 固定种子洗牌
 * 返回格子 id 数组（只含 H>0 的陆地格），长度 = 陆地格数。
 */
export function assemblyOrder(planet, { mode = 'frontier', seed = 7, root = null } = {}) {
  const { cells, H } = planet;
  if (!['frontier', 'height', 'shuffle'].includes(mode)) throw new RangeError('Invalid assembly mode');
  if (!Number.isFinite(seed)) throw new RangeError('Invalid assembly seed');
  const land = cells.filter((c) => H[c.id] > 0).map((c) => c.id);
  if (!land.length) return [];
  const rng = makeRng(seed);
  const pri = new Map(land.map((id) => [id, rng()]));
  if (mode === 'shuffle') return land.slice().sort((a, b) => pri.get(a) - pri.get(b) || a - b);
  if (mode === 'height') return land.slice().sort((a, b) => H[a] - H[b] || pri.get(a) - pri.get(b) || a - b);
  // frontier：从 root（默认最高一格）开始，每次取"已见前沿"里优先级最小的一格；
  // 陆地不连通时（球面噪声会出现几块孤岛）用最小优先级补种，保证全覆盖。
  let start = root;
  if (start === null) { start = land[0]; for (const id of land) if (H[id] > H[start]) start = id; }
  if (!Number.isInteger(start) || !pri.has(start)) throw new RangeError('Invalid assembly root cell');
  const order = [], seen = new Set(), frontier = [];
  const push = (id) => { if (id >= 0 && pri.has(id) && !seen.has(id)) { seen.add(id); frontier.push(id); } };
  push(start);
  while (order.length < land.length) {
    if (!frontier.length) {
      let seedCell = -1;
      for (const id of land) if (!seen.has(id) && (seedCell < 0 || pri.get(id) < pri.get(seedCell))) seedCell = id;
      push(seedCell);
    }
    let best = 0;
    for (let k = 1; k < frontier.length; k++) if (pri.get(frontier[k]) < pri.get(frontier[best])) best = k;
    const id = frontier.splice(best, 1)[0];
    order.push(id);
    for (const nb of cells[id].nb) push(nb);
  }
  return order;
}

/** 进度 t∈[0,1] → 当前应当出现的格子集合（前缀切片，按 order 顺序）。 */
export function assemblySlice(planet, order, t) {
  if (!Array.isArray(order) || !order.every((id) => Number.isInteger(id) && planet.cells[id] && planet.cells[id].id === id)) throw new RangeError('Invalid assembly order');
  if (!Number.isFinite(t) || t < 0 || t > 1) throw new RangeError('Invalid assembly progress');
  return new Set(order.slice(0, Math.round(order.length * t)));
}

/** 网格：顶面 + 侧壁，顶点色。返回 { position, normal, color } 数组
 * only：只出这些格子的网格（装配中）；被隐藏的邻居按 0 层处理，前沿出现断口侧壁。 */
export function planetMesh(planet, at, { only = null } = {}) {
  const { cells, H } = planet;
  const vis = only === null ? null : (only instanceof Set ? only : new Set(only));
  if (vis) for (const id of vis) if (!Number.isInteger(id) || !cells[id] || cells[id].id !== id) throw new RangeError('Invalid visible cell id');
  const P = [], N = [], C = [];
  const col = (h, wall) => wall ? (h <= 1 ? [0.62, 0.55, 0.48] : [0.70, 0.68, 0.64]) : h === 1 ? [0.93, 0.84, 0.62] : h <= 3 ? [0.55, 0.74, 0.40] : h <= 5 ? [0.47, 0.66, 0.36] : [0.86, 0.88, 0.84];
  const tri = (a, b, c, k) => {
    const n = norm(cross(sub(b, a), sub(c, a)));
    for (const v of [a, b, c]) { P.push(...v); N.push(...n); C.push(...k); }
  };
  for (const c of cells) {
    const h = H[c.id];
    if (h === 0) continue;
    if (vis && !vis.has(c.id)) continue;
    const ring = c.ring.map((k) => at(k, h));
    const ctr = ring.reduce((s, v) => [s[0] + v[0] / ring.length, s[1] + v[1] / ring.length, s[2] + v[2] / ring.length], [0, 0, 0]);
    const shade = 0.94 + 0.08 * ((c.id * 7919) % 13) / 13;
    const top = col(h, false).map((x) => x * shade);
    for (let k = 0; k < ring.length; k++) tri(ctr, ring[k], ring[(k + 1) % ring.length], top);
    for (let k = 0; k < c.ring.length; k++) {
      const o = c.nb[k], oh = o >= 0 && (!vis || vis.has(o)) ? H[o] : 0;
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

/* r55 (spheretown "multi-cell constraint conflict"): component similarity instead of edge springs.
 * 1769641473895432220 "all module-containing cells try to achieve their desired shape and size".
 * The edge-spring proxy gives every edge of an active cell the shrunken rest length, including the
 * spokes to pinned neighbour corners — a spoke cannot get shorter while the cell shrinks, so a
 * lone tall cell is pulled both ways (the 53 % worst edge error on the page). Here each active
 * cell wants its sea-level shape and size, but two neighbouring active cells cannot both shrink
 * about their OWN centres (they share corners) — inside a plateau the proposals cancel and the cell
 * stays mushroomed (a per-cell shape-matching/ARAP pass measured exactly that: mean shape error
 * only .21 → .16). The consistent answer is to shrink each connected plateau at level l as ONE
 * similarity (geodesic scaling about the component centroid, applied to level l−1's corners):
 * shared corners then agree exactly and every cell keeps its shape. What is left is the conflict
 * between SIZE and WALL LEAN (a big continent shrinking 7 %/level drags its coast walls sideways):
 * priority goes to walls — the per-level factor is clamped so no corner moves sideways more than
 * L·tan(maxLean); size not reached is carried up to the next level of that plateau. Corners touched
 * by no active cell keep the previous level's position (never drawn at this level). The original
 * module target shapes are not in REACode (spheretown lists this relax as "Not done"), so the
 * desired shape is the cell's own sea-level ring — an inference. */
function rotMin(a, b, v) {
  const k = cross(a, b), sn = len(k), cs = dot(a, b);
  if (sn < 1e-12) return v.slice();
  const u = [k[0] / sn, k[1] / sn, k[2] / sn], kv = cross(u, v), d = dot(u, v);
  return [0, 1, 2].map((i) => v[i] * cs + kv[i] * sn + u[i] * d * (1 - cs));
}
/** Geodesic scaling of unit direction p about unit centre c by factor f (angle → f·angle). */
function geoScale(c, p, f) {
  const cs = Math.max(-1, Math.min(1, dot(c, p))), ang = Math.acos(cs);
  if (ang < 1e-12) return p.slice();
  const t = norm(sub(p, c.map((x) => x * cs))), a = ang * f;
  return norm([c[0] * Math.cos(a) + t[0] * Math.sin(a), c[1] * Math.cos(a) + t[1] * Math.sin(a), c[2] * Math.cos(a) + t[2] * Math.sin(a)]);
}
const ringArea = (ring) => { let s2 = 0; for (let i = 1; i + 1 < ring.length; i++) s2 += len(cross(sub(ring[i], ring[0]), sub(ring[i + 1], ring[0]))) / 2; return s2; };
function componentScaleLevel(cells, base, prev, isActive, R, L, l, maxLean) {
  const D = prev.map((d) => d.slice()), r = R + l * L, seen = new Uint8Array(cells.length), cap = Math.tan(maxLean * Math.PI / 180) * L;
  const comps = [];
  for (const c0 of cells) {
    if (seen[c0.id] || !isActive(c0.id)) continue;
    const comp = [], stack = [c0.id]; seen[c0.id] = 1;
    while (stack.length) { const id = stack.pop(); comp.push(id); for (const o of cells[id].nb) if (o >= 0 && !seen[o] && isActive(o)) { seen[o] = 1; stack.push(o); } }
    const ks = [...new Set(comp.flatMap((id) => cells[id].ring))];
    // size still owed: component area at the previous level's corners (world units at r) vs sea level
    let aNow = 0, aWant = 0; for (const id of comp) { aNow += ringArea(cells[id].ring.map((k) => prev[k])) * r * r; aWant += ringArea(cells[id].ring.map((k) => base[k])) * R * R; }
    const want = Math.min(1, Math.sqrt(aWant / aNow));
    const ctr = norm(ks.reduce((a, k) => [a[0] + prev[k][0], a[1] + prev[k][1], a[2] + prev[k][2]], [0, 0, 0]));
    const far = ks.reduce((m, k) => Math.max(m, Math.acos(Math.max(-1, Math.min(1, dot(ctr, prev[k]))))), 0) * r;
    const farAng = far / r;
    // a plateau wider than ~70° cannot shrink as one similarity on a sphere (geodesic scaling
    // blows up toward the antipode): left unscaled and reported as unresolved
    const f = farAng > 1.2 ? 1 : far > 1e-12 ? Math.max(want, 1 - cap / far) : 1;   // wall lean cap wins over size
    for (const k of ks) D[k] = geoScale(ctr, prev[k], f);
    comps.push({ level: l, cells: comp.length, want, f, farAng, capped: f > want + 1e-9, unresolved: farAng > 1.2 });
  }
  D.components = comps;
  return D;
}

/** r55: measure the multi-cell constraint conflict of any corner sampler `at`.
 * For every active (cell, level ≥ 1), fit a SIMILARITY (rotation + translation + scale, tangent
 * plane) from the cell's sea-level ring to its actual corners. Then
 *   shapeErr  RMS fit residual / actual mean edge — the cell is no longer its own shape
 *   disagree  per corner shared by ≥2 active cells: max distance between where their fits put it,
 *             / mean edge — the cells' shape constraints contradict each other at that corner
 *   sizeErr   |area / sea-level area − 1| — the "mushrooming" (desired: same size as at sea level)
 *   drift     centroid offset from the sea-level column, / mean edge
 *   lean      max wall lean between consecutive levels (deg, 0 = radial wall)
 *   folded    fan triangles of drawn rings (levels 0..H) whose orientation flipped */
export function relaxConflictReport(planet, at, { moduleCells = null } = {}) {
  const { cells, H } = planet, sel = moduleCells === null ? null : new Set(moduleCells), maxH = Math.max(...H);
  const rows = [], perCorner = new Map();
  let folded = 0, leanMax = 0;
  for (let l = 1; l <= maxH; l++) for (const c of cells) {
    if (H[c.id] < l || (sel && !sel.has(c.id))) continue;
    const des = c.ring.map((k) => at(k, 0)), act = c.ring.map((k) => at(k, l));
    const md = des.reduce((a, p) => a.map((x, i) => x + p[i] / des.length), [0, 0, 0]), ma = act.reduce((a, p) => a.map((x, i) => x + p[i] / act.length), [0, 0, 0]);
    const nd = norm(md), na = norm(ma), ref = Math.abs(nd[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const t1 = norm(cross(nd, ref)), t2 = cross(nd, t1), u1 = rotMin(nd, na, t1), u2 = rotMin(nd, na, t2);
    const d2 = des.map((p) => { const d = sub(p, md); return [dot(d, t1), dot(d, t2)]; }), a2 = act.map((p) => { const d = sub(p, ma); return [dot(d, u1), dot(d, u2)]; });
    let sc = 0, ss = 0, dd = 0; d2.forEach((d, i) => { sc += d[0] * a2[i][0] + d[1] * a2[i][1]; ss += d[0] * a2[i][1] - d[1] * a2[i][0]; dd += d[0] * d[0] + d[1] * d[1]; });
    const a = sc / dd, b = ss / dd;   // complex-number similarity fit: a2 ≈ (a + ib)·d2
    let edge = 0, err = 0;
    const want = d2.map((d, i) => {
      const r = [a * d[0] - b * d[1], b * d[0] + a * d[1]], e = Math.hypot(r[0] - a2[i][0], r[1] - a2[i][1]);
      err += e * e; edge += Math.hypot(a2[i][0] - a2[(i + 1) % a2.length][0], a2[i][1] - a2[(i + 1) % a2.length][1]);
      return [0, 1, 2].map((j) => ma[j] + u1[j] * r[0] + u2[j] * r[1]);
    });
    edge /= d2.length;
    c.ring.forEach((k, i) => { const key = k + '@' + l; if (!perCorner.has(key)) perCorner.set(key, []); perCorner.get(key).push({ want: want[i], edge }); });
    rows.push({ id: c.id, level: l, shapeErr: Math.sqrt(err / d2.length) / edge, sizeErr: Math.abs(ringArea(act) / ringArea(des) - 1), drift: Math.acos(Math.max(-1, Math.min(1, dot(nd, na)))) * len(ma) / edge });
  }
  let disMax = 0, disSum = 0, disN = 0;
  for (const list of perCorner.values()) if (list.length > 1) {
    let m = 0; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) m = Math.max(m, len(sub(list[i].want, list[j].want)) / list[i].edge);
    disMax = Math.max(disMax, m); disSum += m; disN++;
  }
  for (const c of cells) for (let l = 0; l <= H[c.id]; l++) {
    const ring = c.ring.map((k) => at(k, l)), m = ring.reduce((a, p) => a.map((x, i) => x + p[i] / ring.length), [0, 0, 0]);
    for (let i = 0; i < ring.length; i++) if (dot(cross(sub(ring[i], m), sub(ring[(i + 1) % ring.length], m)), m) <= 0) folded++;
    if (l) for (const k of c.ring) { const a = at(k, l - 1), b = at(k, l), d = sub(b, a), r = norm(b), along = dot(d, r), side = len(sub(d, r.map((x) => x * along))); leanMax = Math.max(leanMax, Math.atan2(side, along) * 180 / Math.PI); }
  }
  const avg = (k) => rows.length ? rows.reduce((s2, r) => s2 + r[k], 0) / rows.length : 0, mx = (k) => rows.reduce((m, r) => Math.max(m, r[k]), 0);
  const top = rows.filter((r) => r.level === H[r.id]);
  return { cellLevels: rows.length, shapeErrMax: mx('shapeErr'), shapeErrMean: avg('shapeErr'), sizeErrMax: mx('sizeErr'), sizeErrMean: avg('sizeErr'),
    topSizeErrMean: top.length ? top.reduce((s2, r) => s2 + r.sizeErr, 0) / top.length : 0,
    driftMax: mx('drift'), driftMean: avg('drift'), disagreeMax: disMax, disagreeMean: disN ? disSum / disN : 0, sharedCorners: disN, folded, leanMaxDeg: leanMax,
    unresolved: (at.components || []).filter((c) => c.unresolved).length, capped: (at.components || []).filter((c) => c.capped).length };
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
