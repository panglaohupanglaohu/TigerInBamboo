/**
 * navmesh-flow.js — 导航面内的连续流场 + 百人群体流动（816748103193817088，2017-01-04）
 *
 * README 原文：「I'm flowing right on the nav mesh, so it depends」（回复「坡 / 台阶怎么处理」一类的问题；
 *   同日上一条 816743289500106752「3 groups of 100 soldiers being ordered around. Oh, the wonders of flow fields!」）。
 * 逐帧（479 帧，sheet-00…04；本轮重看 sheet-01）：
 *   0100–0129  一大团兵（约百人）在下层台地上像一条有头有尾的「流」，前端已沿坡道上到上层，后面的人排着跟进；
 *   0130–0146  地面上叠出导航面的多边形线框，目标处白色圆圈（goal）；
 *   0147–0199  目标换到另一层，人群立刻整体转向，在坡道入口收窄成一股、上坡后又在上层摊开 —— 不是排成单列走格子中心，
 *              而是在导航面内连续地流（同一时刻各人方向是平滑过渡的）。
 * 重构版此前：`src/badnorth/flowfield.js` 是**格心**多源 Dijkstra（每格一个 parent 指针），单位朝下一格的中心 / 通口走；
 *   GAP-PRIORITIES 记的缺口就是「连续导航面内流动 / 群体流体运动 / 坡高」。本文件补这三件：
 *   1) 距离场放在导航面**顶点**上（多边形内两两顶点连边 = 面内直线可达，近似测地距离；跨层只在声明的坡道 / 台阶口连通）；
 *   2) 任意点的流向 = 所在多边形顶点距离的最小二乘平面梯度的反方向（面内连续、过边连续）；
 *   3) 群体：期望速度 = 流向 × 速度，叠加邻居分离（空间哈希），积分后约束回导航面（出边找邻面，边界就沿边滑），
 *      高度取所在面的平面插值 → 上坡下坡是连续的。
 */

/** 导航面：verts[{x,y,z}]，polys[[vi...]]（凸、逆时针俯视）。返回带邻接的结构。 */
export function buildNavMesh(verts, polys) {
  if (!Array.isArray(verts) || !Array.isArray(polys) || !polys.length) throw new TypeError('Invalid nav mesh');
  const edgeKey = (a, b) => (a < b ? a + '_' + b : b + '_' + a), edgeOwner = new Map();
  const P = polys.map((vs, id) => {
    if (vs.length < 3 || vs.some((v) => !verts[v])) throw new TypeError('Invalid polygon ' + id);
    const cx = vs.reduce((s, v) => s + verts[v].x, 0) / vs.length, cz = vs.reduce((s, v) => s + verts[v].z, 0) / vs.length;
    return { id, vs, cx, cz, nb: new Array(vs.length).fill(-1), plane: fitPlane(vs.map((v) => verts[v])) };
  });
  for (const p of P) p.vs.forEach((a, i) => {
    const b = p.vs[(i + 1) % p.vs.length], k = edgeKey(a, b);
    if (edgeOwner.has(k)) { const [q, j] = edgeOwner.get(k); p.nb[i] = q; P[q].nb[j] = p.id; } else edgeOwner.set(k, [p.id, i]);
  });
  return { verts, polys: P };
}

/** y = a x + b z + c 最小二乘（坡道面），也用于距离场梯度 */
function fitPlane(pts, val = (p) => p.y) {
  let sx = 0, sz = 0, sxx = 0, szz = 0, sxz = 0, sv = 0, sxv = 0, szv = 0; const n = pts.length;
  for (const p of pts) { const v = val(p); sx += p.x; sz += p.z; sxx += p.x * p.x; szz += p.z * p.z; sxz += p.x * p.z; sv += v; sxv += p.x * v; szv += p.z * v; }
  const mx = sx / n, mz = sz / n, cxx = sxx / n - mx * mx, czz = szz / n - mz * mz, cxz = sxz / n - mx * mz, cxv = sxv / n - mx * sv / n, czv = szv / n - mz * sv / n;
  const det = cxx * czz - cxz * cxz;
  const a = Math.abs(det) < 1e-12 ? 0 : (cxv * czz - czv * cxz) / det, b = Math.abs(det) < 1e-12 ? 0 : (czv * cxx - cxv * cxz) / det;
  return { a, b, c: sv / n - a * mx - b * mz };
}

const cross = (ax, az, bx, bz) => ax * bz - az * bx;
/** 点是否在凸多边形（俯视）内，eps 容差 */
export function insidePoly(mesh, poly, x, z, eps = 1e-7) {
  const V = mesh.verts, vs = poly.vs; let sign = 0;
  for (let i = 0; i < vs.length; i++) {
    const a = V[vs[i]], b = V[vs[(i + 1) % vs.length]], c = cross(b.x - a.x, b.z - a.z, x - a.x, z - a.z);
    if (Math.abs(c) <= eps) continue;
    const s = Math.sign(c); if (sign && s !== sign) return false; sign = s;
  }
  return true;
}
export function locate(mesh, x, z, hint = -1) {
  if (hint >= 0 && insidePoly(mesh, mesh.polys[hint], x, z)) return hint;
  if (hint >= 0) for (const q of mesh.polys[hint].nb) if (q >= 0 && insidePoly(mesh, mesh.polys[q], x, z)) return q;
  for (const p of mesh.polys) if (insidePoly(mesh, p, x, z)) return p.id;
  return -1;
}
export const heightAt = (mesh, poly, x, z) => { const pl = mesh.polys[poly].plane; return pl.a * x + pl.b * z + pl.c; };

/**
 * 顶点距离场（多源 Dijkstra）：目标 = 圆（x, z, r）内的顶点，或多边形 goalPolys 的顶点。
 * 边：每个多边形内两两顶点（面内直线可达），代价 = 三维长度。
 */
export function buildVertexField(mesh, { goal = null, goalPolys = [] } = {}) {
  const V = mesh.verts, n = V.length, dist = new Float64Array(n).fill(Infinity), adj = Array.from({ length: n }, () => new Map());
  for (const p of mesh.polys) for (let i = 0; i < p.vs.length; i++) for (let j = i + 1; j < p.vs.length; j++) {
    const a = p.vs[i], b = p.vs[j], d = Math.hypot(V[a].x - V[b].x, V[a].y - V[b].y, V[a].z - V[b].z);
    if (!adj[a].has(b) || adj[a].get(b) > d) { adj[a].set(b, d); adj[b].set(a, d); }
  }
  // G5：跨层连接（台阶口两侧的顶点副本）由 mesh.links 显式给出 [a, b, cost]
  for (const [a, b, w] of mesh.links || []) if (!adj[a].has(b) || adj[a].get(b) > w) { adj[a].set(b, w); adj[b].set(a, w); }
  const heap = [], push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  const seeds = new Set();
  if (goal) V.forEach((v, i) => { if (Math.hypot(v.x - goal.x, v.z - goal.z) <= goal.r) seeds.add(i); });
  for (const g of goalPolys) for (const v of mesh.polys[g].vs) seeds.add(v);
  if (!seeds.size && goal) { const g = locate(mesh, goal.x, goal.z); if (g >= 0) for (const v of mesh.polys[g].vs) seeds.add(v); }
  for (const s of seeds) { dist[s] = goal ? Math.max(0, Math.hypot(V[s].x - goal.x, V[s].z - goal.z) - goal.r) : 0; push(dist[s], s); }
  while (heap.length) { const [d, v] = pop(); if (d > dist[v]) continue; for (const [u, w] of adj[v]) if (d + w < dist[u]) { dist[u] = d + w; push(dist[u], u); } }
  // G5：贴墙顶点的离墙偏置（只加在结果上、不参与传播）——梯度不再把人推进「崖边 + 通口」交汇的死角
  if (mesh.vertexBias) for (let v = 0; v < n; v++) if (Number.isFinite(dist[v]) && dist[v] > 0) dist[v] += mesh.vertexBias[v];
  return { dist, goal };
}

/** 单个面内距离场的平面梯度 [∂d/∂x, ∂d/∂z]；顶点距离不全有限或面积退化时返回 null。 */
export function faceGradient(mesh, field, poly) {
  const p = mesh.polys[poly];
  const pts = p.vs.map((v) => ({ x: mesh.verts[v].x, z: mesh.verts[v].z, d: field.dist[v] }));
  if (pts.some((q) => !Number.isFinite(q.d))) return null;
  const pl = fitPlane(pts, (q) => q.d), l = Math.hypot(pl.a, pl.b);
  return l < 1e-12 ? null : [pl.a, pl.b];
}

/**
 * 逐面流向表：每面一条单位流向（= -∇d 归一化），退化面记 NaN。
 *
 * 逐面常量虽然面内精确，但过共面边时方向会整段换向（第 47 轮实测 p90 0.39 / max 1.08 rad），
 * 片中人群过面边界是逐像素平滑的。所以这里把「邻面方向」按到边的距离混进来 —— 见 flowAt 的共边带。
 */
export function buildFaceDirs(mesh, field) {
  const dirs = new Float64Array(mesh.polys.length * 2).fill(NaN);
  for (const p of mesh.polys) {
    const g = faceGradient(mesh, field, p.id); if (!g) continue;
    const l = Math.hypot(g[0], g[1]); if (l < 1e-12) continue;
    dirs[p.id * 2] = -g[0] / l; dirs[p.id * 2 + 1] = -g[1] / l;
  }
  return { dirs, band: 0.35 };
}

/** 点到线段距离（俯视 x,z） */
function segDist(ax, az, bx, bz, x, z) {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  let t = l2 < 1e-18 ? 0 : ((x - ax) * ex + (z - az) * ez) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + ex * t), z - (az + ez * t));
}

/**
 * 面内流向。给 `fd`（buildFaceDirs）时走**共边带混合**：距共享边 band 以内把邻面方向按 0.5·(1-d/band) 混进来。
 * 为什么不是顶点插值：试过「顶点梯度 + 均值坐标」，跨面差确实做到 0°，但它把临崖顶点上「顺着墙拐向坡口」
 * 那点切向抹平了 —— 崖脚的人顶着墙原地打转（100 人里卡 1 人，40 s 走不出）。共边带混合只动内部，
 * 崖边（nb = -1）与面心（d ≥ band）保持逐面精确，过边仍然连续：两侧同为 0.5·(d_p + d_q)。
 */
export function flowAt(mesh, field, poly, x, z, fd = null) {
  if (field.goal && Math.hypot(x - field.goal.x, z - field.goal.z) <= field.goal.r * 0.6) return [0, 0];
  const p = mesh.polys[poly], g = faceGradient(mesh, field, poly);
  if (!g) return [0, 0];
  const gl = Math.hypot(g[0], g[1]); if (gl < 1e-9) return [0, 0];
  const dx0 = -g[0] / gl, dz0 = -g[1] / gl;
  if (!fd) return [dx0, dz0];
  const V = mesh.verts, vs = p.vs, band = fd.band;
  let ax = dx0, az = dz0, used = 0;
  for (let i = 0; i < vs.length; i++) {
    const q = p.nb[i];
    if (q < 0) continue;                                  // 崖边没有邻面 → 保持逐面精确
    const qx = fd.dirs[q * 2], qz = fd.dirs[q * 2 + 1];
    if (!Number.isFinite(qx)) continue;
    const a = V[vs[i]], b = V[vs[(i + 1) % vs.length]];
    const d = segDist(a.x, a.z, b.x, b.z, x, z);
    if (d >= band) continue;
    const w = 0.5 * (1 - d / band);
    ax += qx * w; az += qz * w; used += w;                // used 只统计权重，自己那份最后按 1-used 补
  }
  if (!used) return [dx0, dz0];
  const own = Math.max(0, 1 - used);                      // 到共享边时 own = 0.5，两侧对称
  let rx = dx0 * own + (ax - dx0), rz = dz0 * own + (az - dz0);
  const rl = Math.hypot(rx, rz);
  return rl < 1e-9 ? [dx0, dz0] : [rx / rl, rz / rl];
}

/**
 * 第 55 批 G3 · 鞍点守卫。顶点距离场在两条代价相近的路之间有鞍点（梯度≈0 或指向墙角），纯连续流会把人困在那里
 * （第 53 批：24 人里 1–2 人卡住）。面级 Dijkstra 树（buildPolyField）没有鞍点：每面恰好一个出口、树距离严格下降。
 * 这里只在「连续流向会把人带出本面、但出去的那条边是墙或不比本面更近（树距离不下降）」时才改用树出口；
 * 其余时候保持连续流（片中人群逐点平滑的流动），所以绝大多数面内方向不变。返回 [dx, dz, guarded]。
 */
export function guardedFlowAt(mesh, field, poly, x, z, fd, pf, { margin = 0.08 } = {}) {
  const f = flowAt(mesh, field, poly, x, z, fd);
  if (!pf || poly === pf.goalPoly) return [f[0], f[1], 0];
  const P = mesh.polys[poly], V = mesh.verts;
  let dx = f[0], dz = f[1], exit = -1, tBest = Infinity;
  if (dx || dz) for (let i = 0; i < P.vs.length; i++) {
    const A = V[P.vs[i]], B = V[P.vs[(i + 1) % P.vs.length]], ex = B.x - A.x, ez = B.z - A.z, den = cross(dx, dz, ex, ez);
    if (Math.abs(den) < 1e-12) continue;
    const t = cross(A.x - x, A.z - z, ex, ez) / den, u = cross(A.x - x, A.z - z, dx, dz) / den;
    if (t >= -1e-9 && t < tBest && u >= -1e-6 && u <= 1 + 1e-6) { tBest = t; exit = i; }
  }
  const q = exit >= 0 ? P.nb[exit] : -1;
  if ((dx || dz) && q >= 0 && pf.dist[q] < pf.dist[poly] - 1e-9) return [dx, dz, 0];
  const k = pf.exitEdge[poly]; if (k < 0) return [dx, dz, 0];
  const A = V[P.vs[k]], B = V[P.vs[(k + 1) % P.vs.length]], el = Math.hypot(B.x - A.x, B.z - A.z) || 1;
  // 对准树出口边上离自己最近的点（两端让出 margin），再往边外推一点 → 跨边后进入树距离更小的面
  const m = Math.min(0.5, margin / el), t = Math.max(m, Math.min(1 - m, ((x - A.x) * (B.x - A.x) + (z - A.z) * (B.z - A.z)) / (el * el)));
  let tx = A.x + (B.x - A.x) * t - x, tz = A.z + (B.z - A.z) * t - z;
  const nx = (B.z - A.z) / el, nz = -(B.x - A.x) / el, out = (nx * (A.x - P.cx) + nz * (A.z - P.cz)) >= 0 ? 1 : -1;
  tx += nx * out * 0.05; tz += nz * out * 0.05;
  const l = Math.hypot(tx, tz); return l < 1e-9 ? [dx, dz, 0] : [tx / l, tz / l, 1];
}

/**
 * 群体：agents[{x,z,y,poly,vx,vz}]；每步：期望 = 流向 × speed，加分离，限速，移动后约束回导航面。
 * 返回统计 {left: 走出导航面的次数（应为 0）, maxDy: 单步最大高度跳变}。
 */
export function stepCrowd(mesh, field, agents, dt, { speed = 1.2, radius = 0.18, sep = 1.6, accel = 6, faceDirs = null, polyField = null } = {}) {
  const cell = radius * 2.5, hash = new Map(), key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
  for (const a of agents) { const k = key(a.x, a.z); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(a); }
  let left = 0, maxDy = 0, guarded = 0;
  for (const a of agents) {
    if (a.poly < 0) continue;
    const [fx, fz, gd] = polyField ? guardedFlowAt(mesh, field, a.poly, a.x, a.z, faceDirs, polyField) : flowAt(mesh, field, a.poly, a.x, a.z, faceDirs);
    if (gd) guarded++;
    let dx = fx * speed, dz = fz * speed, sx = 0, sz = 0;
    const gx = Math.floor(a.x / cell), gz = Math.floor(a.z / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of hash.get((gx + i) + ',' + (gz + j)) || []) {
      if (b === a) continue; const ox = a.x - b.x, oz = a.z - b.z, d = Math.hypot(ox, oz);
      if (d < 2 * radius && d > 1e-6) { const k = (2 * radius - d) / (2 * radius); sx += ox / d * k; sz += oz / d * k; }
    }
    dx += sx * sep * speed; dz += sz * sep * speed;
    const m = Math.hypot(dx, dz); if (m > speed * 1.3) { dx *= speed * 1.3 / m; dz *= speed * 1.3 / m; }
    a.vx = (a.vx || 0) + (dx - (a.vx || 0)) * Math.min(1, accel * dt); a.vz = (a.vz || 0) + (dz - (a.vz || 0)) * Math.min(1, accel * dt);
    const y0 = a.y;
    moveOnMesh(mesh, a, a.vx * dt, a.vz * dt);
    if (a.poly < 0) left++; else { a.y = heightAt(mesh, a.poly, a.x, a.z); maxDy = Math.max(maxDy, Math.abs(a.y - y0)); }
  }
  return { left, maxDy, guarded };
}

/** 在导航面上移动：跨边进邻面；碰到边界就把位移投影到边上滑行（不穿出）。 */
export function moveOnMesh(mesh, a, dx, dz) {
  for (let iter = 0; iter < 4 && (Math.abs(dx) + Math.abs(dz)) > 1e-9; iter++) {
    const nx = a.x + dx, nz = a.z + dz, p = mesh.polys[a.poly];
    if (insidePoly(mesh, p, nx, nz)) { a.x = nx; a.z = nz; return; }
    // 找穿出的边
    let hit = -1, tBest = 1;
    for (let i = 0; i < p.vs.length; i++) {
      const A = mesh.verts[p.vs[i]], B = mesh.verts[p.vs[(i + 1) % p.vs.length]], ex = B.x - A.x, ez = B.z - A.z;
      const den = cross(dx, dz, ex, ez); if (Math.abs(den) < 1e-12) continue;
      const t = cross(A.x - a.x, A.z - a.z, ex, ez) / den, u = cross(A.x - a.x, A.z - a.z, dx, dz) / den;
      if (t >= -1e-9 && t <= tBest && u >= -1e-6 && u <= 1 + 1e-6) { tBest = t; hit = i; }
    }
    if (hit < 0) { const q = locate(mesh, nx, nz, a.poly); if (q >= 0) { a.x = nx; a.z = nz; a.poly = q; } return; }
    const q = p.nb[hit];
    const A = mesh.verts[p.vs[hit]], B = mesh.verts[p.vs[(hit + 1) % p.vs.length]], ex = B.x - A.x, ez = B.z - A.z, el = Math.hypot(ex, ez);
    const t = Math.max(0, tBest - 1e-4);
    a.x += dx * t; a.z += dz * t;
    const rx = dx * (1 - t), rz = dz * (1 - t);
    if (q >= 0) { a.x += dx * 2e-4; a.z += dz * 2e-4; if (insidePoly(mesh, mesh.polys[q], a.x, a.z)) a.poly = q; dx = rx; dz = rz; continue; }
    // 边界：沿边滑
    const ux = ex / el, uz = ez / el, along = rx * ux + rz * uz; dx = ux * along; dz = uz * along;
  }
}

/**
 * 台地 + 坡道导航面（演示 / 测试用；片中是这种「几层台地由坡道连起来」的地形）：
 * 顶点高度 = levelAt(i, j) × L（(nx+1)×(nz+1) 个顶点），每个方格一个四边形：
 *   四角同层 → 平台；差 1 层且 rampAt(i, j) → 坡面（顶点共享，坡与上下平台天然连续）；其余（崖）不进导航面。
 */
export function navMeshFromTerraces({ nx = 16, nz = 12, size = 1, L = 0.6, levelAt, rampAt = () => false } = {}) {
  if (typeof levelAt !== 'function') throw new TypeError('levelAt required');
  const verts = [], id = (i, j) => i + (nx + 1) * j;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) verts.push({ x: i * size, y: 0, z: j * size, lv: null });
  const polys = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const lv = levelAt(i, j), ramp = rampAt(i, j);
    if (lv == null) continue;
    const q = [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)];
    polys.push({ q, lv, ramp, i, j });
  }
  // 顶点层：平台格给自己的层；坡道格不定层（由两侧平台定）。同一顶点被不同层的平台占 → 该顶点所在的平台之间是崖，拆成两份顶点
  const at = new Map();   // vid -> Map(level -> newVid)
  const out = [];
  const vfor = (v, level) => { if (!at.has(v)) at.set(v, new Map()); const m = at.get(v); if (!m.has(level)) { out.push({ x: verts[v].x, y: level * L, z: verts[v].z }); m.set(level, out.length - 1); } return m.get(level); };
  const flat = polys.filter((p) => !p.ramp).map((p) => p.q.map((v) => vfor(v, p.lv)));
  const ramps = [];
  for (const p of polys.filter((p) => p.ramp)) {
    // 坡道：低边两顶点取 lv，高边两顶点取 lv+1；rampAt 返回方向 'x+'|'x-'|'z+'|'z-'（往哪边升高）
    const dir = p.ramp === true ? 'x+' : p.ramp, up = (k) => { const [cx, cz] = [[0, 0], [1, 0], [1, 1], [0, 1]][k]; return dir === 'x+' ? cx === 1 : dir === 'x-' ? cx === 0 : dir === 'z+' ? cz === 1 : cz === 0; };
    ramps.push(p.q.map((v, k) => vfor(v, p.lv + (up(k) ? 1 : 0))));
  }
  const ccw = (vs) => { let s2 = 0; for (let i = 0; i < vs.length; i++) { const a = out[vs[i]], b = out[vs[(i + 1) % vs.length]]; s2 += a.x * b.z - b.x * a.z; } return s2 < 0 ? vs.slice().reverse() : vs; };
  return buildNavMesh(out, [...flat, ...ramps].map(ccw));
}

/* ---------------------------------------------------------------------------------------------
 * 第 50 轮：迁自 REACode src/triflowfield.js（972829402873716737「the triangular flow fields we use for pathfinding and combat」）
 * 原版在「方格翻对角线」的直角三角网格上做：面级 Dijkstra（每面记从哪条边出去）→ 逐边中点路径 → 漏斗拉直（string pulling），
 * 并和方格 8 邻接梯度下降比路径长度 / 拐弯 / 方向分辨率。这里换到共享的凸多边形导航面（任意多边形、可跨层坡道），
 * 漏斗沿用原版修过的手性（Mononen triarea2 = (c−a)×(b−a)，写反会把每个通口都当转角，路径翻到 2.19×）。
 * ------------------------------------------------------------------------------------------- */

/** 面级流场：以 goalPoly 为源按面心距离 Dijkstra；exitEdge[p] = 往目标走要穿的边序号，exitTo[p] = 下一面。 */
export function buildPolyField(mesh, goalPoly, goal = null) {
  const n = mesh.polys.length, dist = new Float64Array(n).fill(Infinity), exitEdge = new Int32Array(n).fill(-1), exitTo = new Int32Array(n).fill(-1);
  const C = mesh.polys.map((p) => [p.cx, heightAt(mesh, p.id, p.cx, p.cz), p.cz]);
  const heap = [[0, goalPoly]]; dist[goalPoly] = 0;
  const pop = () => { let k = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[k][0]) k = i; return heap.splice(k, 1)[0]; };
  while (heap.length) {
    const [d, p] = pop(); if (d > dist[p]) continue;
    const P = mesh.polys[p];
    for (let i = 0; i < P.nb.length; i++) {
      const q = P.nb[i]; if (q < 0) continue;
      const w = Math.hypot(C[p][0] - C[q][0], C[p][1] - C[q][1], C[p][2] - C[q][2]);
      if (d + w < dist[q]) { dist[q] = d + w; exitTo[q] = p; exitEdge[q] = mesh.polys[q].nb.indexOf(p); heap.push([dist[q], q]); }
    }
  }
  // 走廊选择：只按面心 Dijkstra，方格类导航面上斜向与 L 形等长，平局常落在 L 形走廊里，漏斗拉不直。
  // goal 给了点（x,z）时，改用顶点测地距离场（buildVertexField，面内两两顶点连边 ≈ 直线）挑出口：
  // 每面从「两端点距离均值」最小、且比本面更近的那条边出去；没有更近的边才退回面心 Dijkstra 的选择。
  if (goal) {
    const vf = buildVertexField(mesh, { goal: { x: goal[0], z: goal[1], r: 1e-6 } }), vd = vf.dist;
    const polyD = mesh.polys.map((P) => P.vs.reduce((s2, v) => s2 + vd[v], 0) / P.vs.length);
    for (const P of mesh.polys) {
      if (P.id === goalPoly) continue;
      let best = -1, bd = polyD[P.id];
      for (let i = 0; i < P.nb.length; i++) { const q = P.nb[i]; if (q < 0) continue; const e = (vd[P.vs[i]] + vd[P.vs[(i + 1) % P.vs.length]]) / 2; if (polyD[q] < polyD[P.id] - 1e-9 && e < bd) { bd = e; best = i; } }
      if (best >= 0) { exitEdge[P.id] = best; exitTo[P.id] = P.nb[best]; }
    }
  }
  return { goalPoly, dist, exitEdge, exitTo };
}

/** 从 start（x,z）沿面级流场到 goal（x,z）的通口序列：[[左, 右], …]，首尾是起点 / 终点自身。 */
export function portalsAlong(mesh, F, start, goal) {
  let p = locate(mesh, start[0], start[1]); if (p < 0) return null;
  const P = [[start, start]]; let guard = 0;
  while (p !== F.goalPoly && guard++ < 10000) {
    const k = F.exitEdge[p], nx = F.exitTo[p]; if (k < 0 || nx < 0) return null;
    const poly = mesh.polys[p], a = mesh.verts[poly.vs[k]], b = mesh.verts[poly.vs[(k + 1) % poly.vs.length]];
    const A = [a.x, a.z], B = [b.x, b.z], c0 = [poly.cx, poly.cz], c1 = [mesh.polys[nx].cx, mesh.polys[nx].cz];
    const cr = (B[0] - A[0]) * (c1[1] - c0[1]) - (B[1] - A[1]) * (c1[0] - c0[0]);
    P.push(cr > 0 ? [A, B] : [B, A]);
    p = nx;
  }
  P.push([goal, goal]);
  return P;
}

/** 漏斗拉直（简单漏斗算法），输入 portalsAlong 的通口序列，输出折线点 [[x,z]…]。 */
export function funnelPath(P) {
  const tri = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1]);
  const eq = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const out = [];
  let apex = P[0][0], left = P[0][0], right = P[0][0], apexI = 0, leftI = 0, rightI = 0;
  out.push([apex[0], apex[1]]);
  for (let i = 1; i < P.length; i++) {
    const L = P[i][0], R = P[i][1];
    if (tri(apex, right, R) <= 0) {
      if (eq(apex, right) || tri(apex, left, R) > 0) { right = R; rightI = i; }
      else { out.push([left[0], left[1]]); apex = left; apexI = leftI; left = right = apex; leftI = rightI = apexI; i = apexI; continue; }
    }
    if (tri(apex, left, L) >= 0) {
      if (eq(apex, left) || tri(apex, right, L) < 0) { left = L; leftI = i; }
      else { out.push([right[0], right[1]]); apex = right; apexI = rightI; left = right = apex; leftI = rightI = apexI; i = apexI; continue; }
    }
  }
  const last = P[P.length - 1][0]; if (!eq(out[out.length - 1], last)) out.push([last[0], last[1]]);
  return out;
}

/** 原版的「逐边中点」锯齿路径（对照）与折线量度：长度、拐弯数（>5°）。 */
export function midpointPath(P) { return P.map(([a, b]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
export function pathStats(pts) {
  let len = 0, turns = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  for (let i = 1; i < pts.length - 1; i++) { const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]), b = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]); let d = Math.abs(b - a); if (d > Math.PI) d = 2 * Math.PI - d; if (d > 5 * Math.PI / 180) turns++; }
  return { length: len, turns, points: pts.length };
}

/** 视线捷径：从当前点往后找最远的、整段都在导航面内（逐 step 采样、相邻采样点所在面相邻或相同）的点直接连过去。
 *  走廊（面序列）本身在方格类导航面上有平局，漏斗只能在给定走廊里拉直；这一步把走廊带来的多余折角去掉。 */
export function shortcutPath(mesh, pts, step = 0.05) {
  const clear = (a, b) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); let prev = locate(mesh, a[0], a[1]);
    if (prev < 0) return false;
    for (let k = 1; k <= n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n, p = locate(mesh, x, z, prev);
      if (p < 0 || (p !== prev && !mesh.polys[prev].nb.includes(p))) return false;   // 不能跳过崖缝 / 跨到不相邻的层
      prev = p;
    }
    return true;
  };
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !clear(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
  return out;
}

/* ---------------------------------------------------------------------------------------------
 * 第 53 批（G5）：816748103193817088「I'm flowing right on the nav mesh」接到共享 World。
 * 由 BattleNavigation 的分层图（world/layerednav.js）直接生成导航面：每个节点 = 它所在格的多边形，抬到 floor·L；
 * 同层相邻格共享顶点副本（面内/过边连续），图里没连的同层边断开（nb=-1），跨层台阶口用 nb + links 显式连通。
 * 于是 buildVertexField / flowAt / stepCrowd 直接在战斗用的那张图上跑，不再是独立的台地演示网格。
 * ------------------------------------------------------------------------------------------- */
export function navMeshFromLayeredGraph(graph, { levelHeight = 0.5, stairCost = 1.8, wallBias = 0.35 } = {}) {
  if (!graph?.nodes?.length) throw new TypeError('layered graph required');
  const verts = [], vmap = new Map();
  // 顶点副本按「同层且在图里连通的那一片」分组：同层相邻但图里没连的格（河道单向、净空不足、断崖缝）
  // 不能共享顶点——否则距离会从没连通的那一侧漏过来，梯度把人推向墙（第一版实测 24 人卡住 14 个）。
  const root = graph.nodes.map((n) => n.id), find = (i) => { while (root[i] !== i) i = root[i] = root[root[i]]; return i; };
  for (const a of graph.nodes) for (const e of graph.adj[a.id]) if (graph.nodes[e.to].floor === a.floor) root[find(a.id)] = find(e.to);
  let group = 0;
  const vid = (p, floor) => {
    const k = (p.id ?? `${p.x.toFixed(6)},${p.z.toFixed(6)}`) + '@' + floor + '#' + group;
    let v = vmap.get(k); if (v === undefined) { v = verts.length; verts.push({ x: p.x, y: floor * levelHeight, z: p.z }); vmap.set(k, v); }
    return v;
  };
  const flipped = [], polys = graph.nodes.map((node) => {
    const pts = node.cell.pts; let s2 = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s2 += a.x * b.z - b.x * a.z; }
    group = find(node.id); const vs = pts.map((p) => vid(p, node.floor));
    flipped.push(s2 < 0);
    return s2 < 0 ? vs.slice().reverse() : vs;
  });
  const mesh = buildNavMesh(verts, polys);
  const polyEdge = (id, cellEdge) => { const n = graph.nodes[id].cell.n; return flipped[id] ? ((n - 2 - cellEdge) % n + n) % n : cellEdge; };
  // 同层共享顶点但图里没连（净空不够、河道单向等）的边断开
  for (const p of mesh.polys) for (let i = 0; i < p.nb.length; i++) {
    const q = p.nb[i]; if (q < 0) continue;
    if (!graph.adj[p.id].some((e) => e.to === q) && !graph.adj[q].some((e) => e.to === p.id)) p.nb[i] = -1;
  }
  const links = [];
  for (const a of graph.nodes) for (const e of graph.adj[a.id]) {
    const b = graph.nodes[e.to]; if (b.floor === a.floor || !e.portal) continue;
    const i = e.portal.edge, pa = a.cell.pts[i], pb = a.cell.pts[(i + 1) % a.cell.n];
    mesh.polys[a.id].nb[polyEdge(a.id, i)] = b.id;
    const j = b.cell.edgeNeighbors.indexOf(a.cell.id); if (j >= 0) mesh.polys[b.id].nb[polyEdge(b.id, j)] = a.id;
    const rise = Math.abs(b.floor - a.floor) * levelHeight * stairCost;
    for (const p of [pa, pb]) { group = find(a.id); const va = vid(p, a.floor); group = find(b.id); links.push([va, vid(p, b.floor), rise]); }
  }
  mesh.links = links; mesh.levelHeight = levelHeight; mesh.nodeOfPoly = (id) => graph.nodes[id];
  mesh.vertexBias = new Float64Array(verts.length);
  for (const p of mesh.polys) for (let i = 0; i < p.vs.length; i++) if (p.nb[i] < 0) { mesh.vertexBias[p.vs[i]] = wallBias; mesh.vertexBias[p.vs[(i + 1) % p.vs.length]] = wallBias; }
  // 新加的跨层顶点副本（vid 可能在 buildNavMesh 之后才建）要同步进 verts —— verts 是同一个数组，已同步
  return mesh;
}
