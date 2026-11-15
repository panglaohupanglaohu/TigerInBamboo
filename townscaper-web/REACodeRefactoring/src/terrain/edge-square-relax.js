/**
 * edge-square-relax.js — 第 55 批（G2）：REACode edgesmooth.js 那句没兑现的"regularity() … should drop a lot"。
 *
 * 1670720537662836736 "I smooth my mesh according to an edge type hierarchy. Black is hard, red is game-tile-border
 *   and blue is material-border. Verts only get to pull at equal or lower order verts, and only along the appropriate edges"
 * 1670725072540106755 "no-, dumb- and hierarchical smoothing … helps preserve the intent of the input-tiles while
 *   smoothing out the jankyness from the weird underlying grid"
 *
 * 为什么 terrain/shape.js 量不出 regularity 大降：它的输入网格已经做过 80 遍"趋方"松弛（grid.js relaxPolygons），
 * 平滑只动轮廓线上的点（Taubin），格子本身的方正度没多少可降。原作说"磨平底层怪网格的毛糙"——毛糙在**未松弛**的网格里。
 * REACode 原文件末尾写着试过、但没落地的正解："把门控套到 quadgrid 那种'目标方格'的松弛上 …下一轮直接读 quadgrid.js
 * 的 relax 段照搬"。这里就是照搬 grid.js relaxPolygons（每格四角绕中心转 i·90° 求平均 → 目标正多边形，
 * 累加**位移**再按顶点平均），再套上边类层级：
 *   hard（台阶 / 海岸）   只沿自己的两条 hard 边滑（"Verts only get to pull at equal or lower order verts, and only along
 *                         the appropriate edges"）；交汇点与拐角（转角 > cornerDeg）钉住。lockHard:true = REACode 自加的整点冻结
 *   tile（有房 / 无房交界）只沿自己的两条 tile 边方向移动（位移投影到切线）
 *   material（河 / 非河、颜色交界）同上，沿 material 边
 *   free                  自由
 * 'dumb' = 同一个松弛、不分边类（只钉网格外圈）；'none' = 原网格。
 * 指标与 REACode 同义：regularity（|角 − 正多边形内角| 均值）、borderKink（tile 边折角）、hardShift（硬边点位移）、landAreaDrift。
 */
export const EDGE_ORDER = Object.freeze({ HARD: 0, TILE: 1, MATERIAL: 2, FREE: 3 });

/** 给共享 World 的每条格边定级；返回每个顶点的级（取相邻边最硬的）与每条边。 */
export function classifyWorldEdges(world) {
  const grid = world.grid, edges = [], vrank = new Uint8Array(grid.verts.length).fill(EDGE_ORDER.FREE);
  const colour = (c) => (world.color ? world.color[c.id] : -1);
  for (const c of grid.cells) for (let i = 0; i < c.n; i++) {
    const nid = c.edgeNeighbors[i];
    const a = c.pts[i].id, b = c.pts[(i + 1) % c.n].id;
    let order;
    if (nid < 0) order = EDGE_ORDER.HARD;   // 网格外圈
    else {
      if (nid < c.id) continue;
      const o = grid.cells[nid], ta = world.top(c), tb = world.top(o);
      if (ta !== tb) order = EDGE_ORDER.HARD;
      else if (ta === 0) order = EDGE_ORDER.FREE;
      else if (world.topIsBuilt(c) !== world.topIsBuilt(o)) order = EDGE_ORDER.TILE;
      else if (!!world.river?.[c.id] !== !!world.river?.[nid] || colour(c) !== colour(o)) order = EDGE_ORDER.MATERIAL;
      else order = EDGE_ORDER.FREE;
    }
    edges.push({ a, b, order, ca: c.id, cb: nid });
    vrank[a] = Math.min(vrank[a], order); vrank[b] = Math.min(vrank[b], order);
  }
  return { edges, vrank };
}

/** 方格目标松弛 + 边类层级门控。不改 grid；返回新坐标 X/Z（Float64Array，按顶点 id）。 */
export function squareRelax(world, { mode = 'hierarchical', passes = 40, k = .35, classification = null, lockHard = false, cornerDeg = 35 } = {}) {
  if (!['none', 'dumb', 'hierarchical'].includes(mode)) throw new RangeError('mode must be none, dumb or hierarchical');
  if (!Number.isInteger(passes) || passes < 0 || !(k > 0 && k <= 1)) throw new RangeError('invalid relax options');
  const grid = world.grid, n = grid.verts.length;
  const X = Float64Array.from(grid.verts, (v) => v.x), Z = Float64Array.from(grid.verts, (v) => v.z);
  const cls = classification ?? classifyWorldEdges(world);
  // 每个顶点：沿同级边的邻居（tile / material 点只沿这两条边滑）
  const along = Array.from({ length: n }, () => []);
  for (const e of cls.edges) if (e.order === cls.vrank[e.a] && e.order === cls.vrank[e.b] && e.order !== EDGE_ORDER.FREE) { along[e.a].push(e.b); along[e.b].push(e.a); }
  // 同级折线上的拐角（转角 > cornerDeg）当作端点钉住：滑动只发生在"本来就该是直的"那段线上
  const cosC = Math.cos(cornerDeg * Math.PI / 180), corner = new Uint8Array(n);
  for (let v = 0; v < n; v++) { const nb = along[v]; if (nb.length !== 2) { corner[v] = 1; continue; } const ax = grid.verts[v].x - grid.verts[nb[0]].x, az = grid.verts[v].z - grid.verts[nb[0]].z, bx = grid.verts[nb[1]].x - grid.verts[v].x, bz = grid.verts[nb[1]].z - grid.verts[v].z; corner[v] = (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1) < cosC ? 1 : 0; }
  const fx = new Float64Array(n), fz = new Float64Array(n), fn = new Float64Array(n);
  let frozen = 0, slid = 0;
  for (let v = 0; v < n; v++) { const r = cls.vrank[v]; if (mode === 'hierarchical') { if (r === EDGE_ORDER.HARD) frozen++; else if (r !== EDGE_ORDER.FREE) slid++; } }
  if (mode !== 'none') for (let pass = 0; pass < passes; pass++) {
    fx.fill(0); fz.fill(0); fn.fill(0);
    for (const c of grid.cells) {
      const m = c.n; let cx = 0, cz = 0;
      for (const p of c.pts) { cx += X[p.id]; cz += Z[p.id]; }
      cx /= m; cz /= m;
      let vx = 0, vz = 0;
      for (let i = 0; i < m; i++) { const a = -(i * 2 * Math.PI) / m, ca = Math.cos(a), sa = Math.sin(a), ox = X[c.pts[i].id] - cx, oz = Z[c.pts[i].id] - cz; vx += ox * ca - oz * sa; vz += ox * sa + oz * ca; }
      vx /= m; vz /= m;
      for (let i = 0; i < m; i++) { const a = (i * 2 * Math.PI) / m, ca = Math.cos(a), sa = Math.sin(a), id = c.pts[i].id; fx[id] += cx + vx * ca - vz * sa - X[id]; fz[id] += cz + vx * sa + vz * ca - Z[id]; fn[id]++; }
    }
    const kk = pass < passes * .5 ? k : k * .66;
    for (let v = 0; v < n; v++) {
      if (!fn[v] || grid.verts[v].pinned) continue;
      let dx = fx[v] / fn[v] * kk, dz = fz[v] / fn[v] * kk;
      if (mode === 'hierarchical') {
        const r = cls.vrank[v];
        if (r === EDGE_ORDER.HARD && lockHard) continue;
        if (r !== EDGE_ORDER.FREE) {
          const nb = along[v];
          if (corner[v]) continue;   // 交汇点 / 拐角不动
          let tx = X[nb[1]] - X[nb[0]], tz = Z[nb[1]] - Z[nb[0]]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
          const d = dx * tx + dz * tz; dx = tx * d; dz = tz * d;
        }
      }
      X[v] += dx; Z[v] += dz;
    }
  }
  return { X, Z, mode, frozen, slid, classification: cls };
}

/** 指标：regularity（全部格）/ regularityFree（四角都是 free 的格）/ tileKink / hardShift / landAreaDrift。 */
export function relaxMetrics(world, { X, Z, classification }) {
  const grid = world.grid, P = (id) => [X[id], Z[id]];
  let dev = 0, corners = 0, land0 = 0, land1 = 0, devF = 0, cornersF = 0;
  for (const c of grid.cells) {
    const ideal = 180 - 360 / c.n, free = c.pts.every((p) => classification.vrank[p.id] === EDGE_ORDER.FREE);
    for (let i = 0; i < c.n; i++) {
      const a = P(c.pts[(i + c.n - 1) % c.n].id), b = P(c.pts[i].id), d = P(c.pts[(i + 1) % c.n].id);
      const ux = a[0] - b[0], uz = a[1] - b[1], vx = d[0] - b[0], vz = d[1] - b[1];
      const e = Math.abs(Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) || 1)))) * 180 / Math.PI - ideal);
      dev += e; corners++; if (free) { devF += e; cornersF++; }
    }
    if (world.top(c) > 0) {
      let A0 = 0, A1 = 0;
      for (let i = 0; i < c.n; i++) { const p = c.pts[i], q = c.pts[(i + 1) % c.n]; A0 += p.x * q.z - q.x * p.z; A1 += X[p.id] * Z[q.id] - X[q.id] * Z[p.id]; }
      land0 += Math.abs(A0) / 2; land1 += Math.abs(A1) / 2;
    }
  }
  const cls = classification, nb = new Map();
  for (const e of cls.edges) if (e.order === EDGE_ORDER.TILE) { for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) { if (!nb.has(x)) nb.set(x, []); nb.get(x).push(y); } }
  let kink = 0, kn = 0;
  for (const [v, list] of nb) { if (list.length !== 2) continue; const a = P(list[0]), b = P(v), c = P(list[1]); const t = Math.acos(Math.max(-1, Math.min(1, ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]) || 1)))); kink += t * 180 / Math.PI; kn++; }
  let hs = 0, hn = 0;
  for (let v = 0; v < grid.verts.length; v++) if (cls.vrank[v] === EDGE_ORDER.HARD && !grid.verts[v].pinned) { hs += Math.hypot(X[v] - grid.verts[v].x, Z[v] - grid.verts[v].z); hn++; }
  return { regularity: corners ? dev / corners : 0, regularityFree: cornersF ? devF / cornersF : 0, tileKink: kn ? kink / kn : null, hardShift: hn ? hs / hn : 0, landAreaDrift: land0 ? Math.abs(land1 - land0) / land0 : 0 };
}
