/**
 * edgesmooth.js — relax the grid, but only as far as the tiles allow.
 *
 * Two clips, one mechanism:
 *
 *   1670720537662836736  "I smooth my mesh according to an edge type hierarchy.
 *     Black is hard, red is game-tile-border and blue is material-border. Verts
 *     only get to pull at equal or lower order verts, and only along the
 *     appropriate edges"
 *
 *   1670725072540106755  "a comparison showing no-, dumb- and hierarchical
 *     smoothing. The hierarchical smoothing helps preserve the intent of the
 *     input-tiles while smoothing out the jankyness from the weird underlying
 *     grid and from the limited slope angles in the input tileset"
 *
 * What the clips show: three panels of the same island. Without smoothing the
 * silhouette is ragged; with "dumb" smoothing the rag is gone but the tile
 * borders (the ridges running across the terraces) wobble, because every vertex
 * is pulled equally hard and the border follows the grid instead of the tile.
 * The third panel is smooth *and* the borders stay straight.
 *
 * So the smoothing is not the interesting part — the Laplacian is four lines.
 * The interesting part is the *permission*: each edge carries an order, and a
 * vertex is only allowed to be pulled across an edge whose order is high enough.
 * Order 0 (hard, a step in the terrain) never pulls at all; game-tile borders
 * pull very little; material borders pull moderately; same-tile interiors pull
 * fully. The result is that the raggedness inside a tile disappears while the
 * tile's own outline is preserved — "preserve the intent of the input tiles".
 *
 * Numbers to check it with (both are computed here, not assumed):
 *   regularity()  mean |corner angle - 90°| over all cells — should drop a lot
 *   borderKink()  mean deviation from "straight through" along tile borders —
 *                 should barely move, whereas dumb smoothing wrecks it
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const ORDER = { HARD: 0, TILE: 1, MATERIAL: 2, FREE: 3 };
export const ORDER_NAME = ['hard', 'tile-border', 'material-border', 'free'];

/**
 * Classify every cell-to-cell edge into one of the four orders.
 *
 * The mapping onto this project's Town:
 *   hard            a level step, or land against empty — geometry the town
 *                   data actually depends on, so it must not move
 *   tile-border     same height, but one side has a roof and the other does not
 *                   (the closest thing a Townscaper town has to "another tile")
 *   material-border same height, same kind, different wall colour
 *   free            same height, same kind, same colour — interior of a patch
 */
export function classifyEdges(grid, { topOf, colourOf }) {
  const edges = [];
  const pairOrder = new Map();
  for (const cell of grid.cells) {
    const n = cell.pts.length;
    for (let i = 0; i < n; i++) {
      const otherId = cell.edgeNeighbors[i];
      if (otherId < 0 || otherId < cell.id) continue;   // each edge once
      const other = grid.cells[otherId];
      if (!other) continue;
      const ta = topOf(cell), tb = topOf(other);
      let order;
      // 只有"高度不同"才是硬边（台阶/岸线，几何真依赖它）。
      // 两块都空 = 开阔地，本来就该自由松弛 —— 第一版把 ta===0 也算硬边，
      // 结果整张空网格一步都动不了，等于没做。
      if (ta !== tb) order = ORDER.HARD;
      else if (ta === 0) order = ORDER.FREE;
      else if (colourOf(cell) !== colourOf(other)) order = ORDER.MATERIAL;
      else order = ORDER.FREE;

      const a = cell.pts[i], b = cell.pts[(i + 1) % n];
      edges.push({ a: a.id, b: b.id, order, ca: cell.id, cb: otherId });
      const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
      const prev = pairOrder.get(key);
      pairOrder.set(key, prev === undefined ? order : Math.min(prev, order));
    }
  }
  return { edges, pairOrder };
}

/**
 * Relax the grid's shared vertices with the order-dependent permission.
 *
 * `dumb` runs the identical loop with every edge at order FREE, which is the
 * comparison panel in the clip.
 */
export function hierarchicalSmooth(grid, classification, {
  passes = 4,
  strength = 0.55,
  maxStep = 0.06,
  weights = [0, 0.15, 0.5, 1.0],
  dumb = false,
  lockOnHard = true,
} = {}) {
  const { pairOrder } = classification;
  const verts = grid.verts;

  // adjacency: vertex -> [{ to: vert, w }]
  const adj = new Map();
  for (const v of verts) adj.set(v.id, []);
  for (const [key, order] of pairOrder) {
    const [ai, bi] = key.split(':').map(Number);
    const w = dumb ? 1 : weights[order];
    if (w <= 0) continue;
    const A = adj.get(ai), B = adj.get(bi);
    if (!A || !B) continue;
    A.push({ to: bi, w });
    B.push({ to: ai, w });
  }
  const byId = new Map(verts.map((v) => [v.id, v]));

  // 顶点级锁：落在硬边上的顶点一步都不许动。只按边加权挡不住它 —— 一个海岸顶点
  // 仍会沿自己那些 free 边被拉走，整条岸线就跟着塌。这条是"保住 tile 意图"的关键。
  const frozen = new Set();
  if (lockOnHard && !dumb) {
    for (const e of classification.edges) {
      if (e.order !== ORDER.HARD) continue;
      frozen.add(e.a);
      frozen.add(e.b);
    }
  }

  let moved = 0;
  let maxMove = 0;
  for (let pass = 0; pass < passes; pass++) {
    const next = new Map();
    for (const v of verts) {
      if (frozen.has(v.id)) continue;
      const nb = adj.get(v.id);
      if (!nb.length) continue;
      let dx = 0, dz = 0, wsum = 0;
      for (const { to, w } of nb) {
        const q = byId.get(to);
        if (!q) continue;
        dx += (q.x - v.x) * w;
        dz += (q.z - v.z) * w;
        wsum += w;
      }
      if (wsum < 1e-6) continue;
      dx = (dx / wsum) * strength;
      dz = (dz / wsum) * strength;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      const k = len > maxStep ? maxStep / len : 1;
      next.set(v.id, { x: v.x + dx * k, z: v.z + dz * k });
      moved++;
      if (len > maxMove) maxMove = len;
    }
    for (const [id, p] of next) {
      const v = byId.get(id);
      v.x = p.x;
      v.z = p.z;
    }
    refreshBounds(grid);
  }
  return { moved, maxMove: +maxMove.toFixed(4), passes };
}

/** Cell bounds are cached on the cell; moving verts invalidates them. */
export function refreshBounds(grid) {
  for (const cell of grid.cells) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of cell.pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    cell.minX = minX; cell.maxX = maxX; cell.minZ = minZ; cell.maxZ = maxZ;
    cell.cx = (minX + maxX) / 2;
    cell.cz = (minZ + maxZ) / 2;
  }
}

/** Mean |corner angle − 90°| in degrees: how un-square the cells are. */
export function regularity(grid) {
  let sum = 0, n = 0;
  for (const cell of grid.cells) {
    const pts = cell.pts;
    const m = pts.length;
    for (let i = 0; i < m; i++) {
      const p = pts[i], q = pts[(i + 1) % m], r = pts[(i + 2) % m];
      const ax = q.x - p.x, az = q.z - p.z;
      const bx = r.x - q.x, bz = r.z - q.z;
      const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
      if (la < 1e-9 || lb < 1e-9) continue;
      let c = (ax * bx + az * bz) / (la * lb);
      c = clamp(c, -1, 1);
      const angle = Math.acos(c) * 180 / Math.PI;
      sum += Math.abs(angle - 90);
      n++;
    }
  }
  return n ? +(sum / n).toFixed(2) : 0;
}

/**
 * Mean "kink" along tile borders, in degrees. 0 = the border runs dead straight
 * through a vertex, larger = it wobbles. This is the number the clip is really
 * about: hierarchical smoothing should keep it small, dumb smoothing should not.
 */
export function borderKink(grid, classification, order = ORDER.TILE) {
  const at = new Map();   // vert id -> { p, nb: [vert...] }
  for (const e of classification.edges) {
    if (e.order !== order) continue;
    for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) {
      let rec = at.get(x);
      if (!rec) {
        const p = grid.verts.find((v) => v.id === x);
        if (!p) break;
        rec = { p, nb: [] };
        at.set(x, rec);
      }
      const q = grid.verts.find((v) => v.id === y);
      if (q) rec.nb.push(q);
    }
  }
  let sum = 0, n = 0;
  for (const { p, nb } of at.values()) {
    if (nb.length !== 2) continue;              // only where exactly two border edges meet
    const ax = nb[0].x - p.x, az = nb[0].z - p.z;
    const bx = nb[1].x - p.x, bz = nb[1].z - p.z;
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    if (la < 1e-9 || lb < 1e-9) continue;
    const c = clamp((ax * bx + az * bz) / (la * lb), -1, 1);
    const angle = Math.acos(c) * 180 / Math.PI;   // 180 = dead straight through
    sum += Math.abs(angle - 180);
    n++;
  }
  return n ? +(sum / n).toFixed(2) : 0;
}

/**
 * Cell areas before/after, to catch a smoothing pass that eats the coast.
 * Returns the mean |relative area change| over cells that sit on a given order.
 */
export function areaDrift(grid, before, order, classification) {
  const affected = new Set();
  if (order !== undefined) {
    for (const e of classification.edges) {
      if (e.order !== order) continue;
      affected.add(e.ca);
      affected.add(e.cb);
    }
  } else {
    for (const c of grid.cells) affected.add(c.id);
  }
  let sum = 0, n = 0, worst = 0;
  for (const cell of grid.cells) {
    if (!affected.has(cell.id)) continue;
    const a0 = before.get(cell.id);
    const pts = cell.pts;
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p.x * q.z - q.x * p.z;
    }
    a = Math.abs(a) / 2;
    if (a0 < 1e-9) continue;
    const d = Math.abs(a - a0) / a0;
    sum += d;
    if (d > worst) worst = d;
    n++;
  }
  return { cells: n, mean: n ? +(sum / n).toFixed(4) : 0, worst: +worst.toFixed(4) };
}

/** Snapshot cell areas, for areaDrift(). */
export function snapshotAreas(grid) {
  const m = new Map();
  for (const cell of grid.cells) {
    const pts = cell.pts;
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p.x * q.z - q.x * p.z;
    }
    m.set(cell.id, Math.abs(a) / 2);
  }
  return m;
}

/*
 * 试过但没落地的一版：把门控套到 quadgrid 那种"目标方格"的松弛上（每个角绕
 * 中心转 i·90° 求平均当目标）。理论上这才是"磨平 jank 同时保住 tile"的正解，
 * 但两处没搞对 —— 这套网格的 cell.pts 是反序绕向（mesher 需要），照抄 quadgrid
 * 的旋转公式会让格子往里卷：实测 4654 格平均面积掉 9%，最差一格掉 95%，
 * 规整度反而从 11.14° 涨到 13.13°。改绕向之后仍是这个量级，说明目标聚合也不对
 * （quadgrid 累加的是"位移"，我这里累加的是"目标位置"，四角绕序一错就放大）。
 * 结论写在 LEARNING 里，下一轮直接读 quadgrid.js 的 relax 段照搬，别自己推。
 */
