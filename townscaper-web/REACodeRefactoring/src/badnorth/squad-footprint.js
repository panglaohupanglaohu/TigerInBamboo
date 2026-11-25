/** 883447205176238083: the pale wireframe a selected squad leaves on the ground.
 *  654 frames of the snow island. Under every squad there is a near-white cyan
 *  net: an outline around the occupied ground, a hub in the middle of the men and
 *  one spoke from the hub to each outline corner, with a small square tick sitting
 *  on every corner. The net follows the cell the men stand on, so it is a hull of
 *  occupied cells rather than a fixed quad.
 *  Local construction; the reference is a screen-space overlay of 1px lines.
 */
const EPS = 1e-9;

/** Monotone chain, counter-clockwise, no repeated first point. */
export function hullRing(points) {
  const uniq = [];
  for (const p of points) {
    if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) throw new RangeError('invalid footprint point');
    if (!uniq.some((q) => Math.abs(q[0] - p[0]) < 1e-7 && Math.abs(q[1] - p[1]) < 1e-7)) uniq.push([p[0], p[1]]);
  }
  if (uniq.length < 3) return uniq.slice();
  const s = uniq.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of s) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= EPS) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= EPS) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

export function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

export function ringPerimeter(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    s += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return s;
}

/** Hub = mean of the men, which is what the reference puts the spokes on. */
export function hubOf(points) {
  if (!points.length) throw new RangeError('empty squad');
  let x = 0, y = 0;
  for (const p of points) { x += p[0]; y += p[1]; }
  return [x / points.length, y / points.length];
}

export function fanTriangles(ring, hub) {
  if (ring.length < 3) return [];
  const tris = [];
  for (let i = 0; i < ring.length; i++) tris.push([hub, ring[i], ring[(i + 1) % ring.length]]);
  return tris;
}

/** Small square tick centred on a corner, in world units. */
export function cornerTick([x, y], size = 0.07) {
  return [[x - size, y - size], [x + size, y - size], [x + size, y + size], [x - size, y + size]];
}

/**
 * 占位格并集的**真实边界**（沿格边走，凹口保留）。
 *
 * 凸包在 L 形 / 环形的占位上会把凹口一刀切掉，而原片的线网是「沿占位最外一圈的轮廓」——
 * 那个「一圈」是格子的边界，队伍少站一格，线就往里凹一格。做法：每格四条单位边按逆时针入表，
 * 相邻两格共用的边（方向相反）互相抵消，剩下的边首尾相接成环，合并共线点。
 *
 * @param {Array<[number, number]>} cells 格坐标（格心为整数）
 * @returns {Array<Array<[number, number]>>} 环列表（逆时针，顶点在格角上）
 */
export function cellOutline(cells) {
  if (!Array.isArray(cells)) throw new RangeError('invalid cell list');
  const uniq = [];
  const seen = new Set();
  for (const c of cells) {
    if (!Array.isArray(c) || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) throw new RangeError('invalid cell');
    const cx = Math.round(c[0]), cz = Math.round(c[1]);
    const k = `${cx},${cz}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push([cx, cz]);
  }
  const open = new Map();
  const add = (a, b) => {
    const rev = `${b[0]},${b[1]}|${a[0]},${a[1]}`;
    if (open.has(rev)) { open.delete(rev); return; }          // 两格共用边：内部边，抵消
    open.set(`${a[0]},${a[1]}|${b[0]},${b[1]}`, [a, b]);
  };
  for (const [cx, cz] of uniq) {
    const h = 0.5;
    const q = [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];
    for (let i = 0; i < 4; i++) add(q[i], q[(i + 1) % 4]);
  }
  const from = new Map();
  for (const [a, b] of open.values()) {
    const k = `${a[0]},${a[1]}`;
    if (!from.has(k)) from.set(k, []);
    from.get(k).push([a, b]);
  }
  const loops = [];
  while (from.size) {
    const first = from.values().next().value[0];
    const ring = [first[0]];
    let cur = first;
    for (let guard = 0; guard < 100000; guard++) {
      const k = `${cur[0][0]},${cur[0][1]}`;
      const list = from.get(k);
      if (list) { const i = list.indexOf(cur); if (i >= 0) list.splice(i, 1); if (!list.length) from.delete(k); }
      ring.push(cur[1]);
      const nk = `${cur[1][0]},${cur[1][1]}`;
      const next = from.get(nk);
      if (!next || !next.length) break;
      cur = next[0];
      if (cur[1][0] === ring[0][0] && cur[1][1] === ring[0][1]) {
        const lk = `${cur[0][0]},${cur[0][1]}`;
        const l = from.get(lk); if (l) { const i = l.indexOf(cur); if (i >= 0) l.splice(i, 1); if (!l.length) from.delete(lk); }
        break;
      }
    }
    if (ring.length > 1 && ring[ring.length - 1][0] === ring[0][0] && ring[ring.length - 1][1] === ring[0][1]) ring.pop();
    const merged = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[(i + ring.length - 1) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cross) > EPS) merged.push(b);               // 共线点只留端点
    }
    const rr = merged.length >= 3 ? merged : ring;
    if (rr.length < 3) continue;
    let a2 = 0;
    for (let i = 0; i < rr.length; i++) { const p = rr[i], q = rr[(i + 1) % rr.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    loops.push(a2 < 0 ? rr.slice().reverse() : rr);
  }
  return loops;
}

/** 耳切：简单多边形（允许凹）→ 三角形，全部正向、且面积和 == 多边形面积。 */
export function earClip(ring) {
  if (!Array.isArray(ring)) throw new RangeError('invalid ring');
  if (ring.length < 3) return [];
  const pts = ring.map((p) => [p[0], p[1]]);
  const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inTri = (p, a, b, c) => area2(a, b, p) >= -EPS && area2(b, c, p) >= -EPS && area2(c, a, p) >= -EPS;
  const tris = [];
  let guard = 0;
  while (pts.length > 3 && guard++ < 5000) {
    let cut = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      if (area2(a, b, c) <= EPS) continue;                      // 反角 / 共线
      let blocked = false;
      for (const p of pts) {
        if (p === a || p === b || p === c) continue;
        if (inTri(p, a, b, c)) { blocked = true; break; }
      }
      if (blocked) continue;
      tris.push([a, b, c]);
      pts.splice(i, 1);
      cut = true;
      break;
    }
    if (!cut) break;                                            // 自交/退化：剩下的不做面
  }
  if (pts.length === 3 && area2(pts[0], pts[1], pts[2]) > EPS) tris.push([pts[0], pts[1], pts[2]]);
  return tris;
}

/**
 * 按格边界走的占位线网（原片口径）：轮廓沿格边、凹口保留；辐条从众数人中心连到每个角；
 * 三角面用耳切铺满（凹形也不会把面画到轮廓外）；每个角一个方块标记。
 * 不相邻的占位（斜角相接 / 隔一格）会出多个环：只有**被外环包住**的环才算洞，其余算独立的岛。
 */
export function footprintCells(men, cells, { tick = 0.07 } = {}) {
  if (!Array.isArray(men) || !men.length) throw new RangeError('empty squad');
  const loops = cellOutline(cells);
  if (!loops.length) throw new RangeError('empty cells');
  const sorted = loops.slice().sort((a, b) => ringArea(b) - ringArea(a));
  const outer = sorted[0];
  const inRing = (p, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  const rings = [outer], islands = [], holes = [];
  for (const l of sorted.slice(1)) {
    if (inRing(l[0], outer)) holes.push({ ring: l, area: ringArea(l) });
    else { rings.push(l); islands.push({ ring: l, area: ringArea(l) }); }
  }
  const hub = hubOf(men);
  const hull = hullRing(outer);
  // 辐条把轮廓切成扇形（片里的「三角面」就是这些），另外给一版耳切只用于填色：凹形时扇形会跨到轮廓外
  const tris = outer.map((p, i) => [hub, p, outer[(i + 1) % outer.length]]);
  const fillTris = rings.flatMap((r) => earClip(r));
  const triArea = fillTris.reduce((s, [a, b, c]) => s + ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2, 0);
  const area = ringArea(outer) + islands.reduce((s, h) => s + h.area, 0) - holes.reduce((s, h) => s + h.area, 0);
  return {
    ring: outer,
    rings,
    islands,
    holes,
    hub,
    spokes: outer.map((p) => [hub, p]),
    tris,
    fillTris,
    triArea,
    ticks: outer.map((p) => cornerTick(p, tick)),
    area,
    perimeter: ringPerimeter(outer),
    hullArea: rings.length === 1 && hull.length >= 3 ? ringArea(hull) : null,
    notchArea: rings.length === 1 && hull.length >= 3 ? Math.max(0, ringArea(hull) - area) : 0,
    cellCount: new Set(cells.map((c) => `${Math.round(c[0])},${Math.round(c[1])}`)).size,
    degenerate: outer.length < 3,
  };
}

/**
 * 真实格网的并集边界：格是多边形（抖动网格 / 混合格型），边用顶点 id 记，
 * 与**同样被占**的邻格共用的边是内部边，去掉；剩下的边按顶点 id 首尾相接成环。
 * @param {Array<object>} cells 格对象（需 edges / edgeNeighbors / pts）
 */
export function unionOutline(cells) {
  if (!Array.isArray(cells) || !cells.length) throw new RangeError('empty cell list');
  const occ = new Set(cells.map((c) => c.id));
  const coord = new Map();
  const open = new Map();
  for (const c of cells) {
    for (const pt of c.pts ?? []) coord.set(pt.id, [pt.x, pt.z]);
    for (let i = 0; i < c.edges.length; i++) {
      const nb = c.edgeNeighbors?.[i];
      if (nb != null && occ.has(nb)) continue;                 // 内部边
      const [a, b] = c.edges[i];
      const k = `${a}|${b}`, rev = `${b}|${a}`;
      if (open.has(rev)) { open.delete(rev); continue; }        // 重叠反向边（凹口对咬）
      open.set(k, [a, b]);
    }
  }
  const from = new Map();
  for (const [a, b] of open.values()) {
    if (!from.has(a)) from.set(a, []);
    from.get(a).push([a, b]);
  }
  const loops = [];
  while (from.size) {
    const first = from.values().next().value[0];
    const ids = [first[0]];
    let cur = first;
    for (let guard = 0; guard < 100000; guard++) {
      const list = from.get(cur[0]);
      if (list) { const i = list.indexOf(cur); if (i >= 0) list.splice(i, 1); if (!list.length) from.delete(cur[0]); }
      ids.push(cur[1]);
      const next = from.get(cur[1]);
      if (!next || !next.length) break;
      cur = next[0];
      if (cur[1] === ids[0]) {
        const l = from.get(cur[0]); if (l) { const i = l.indexOf(cur); if (i >= 0) l.splice(i, 1); if (!l.length) from.delete(cur[0]); }
        break;
      }
    }
    if (ids.length > 1 && ids[ids.length - 1] === ids[0]) ids.pop();
    const pts = ids.map((id) => coord.get(id)).filter(Boolean);
    const merged = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cross) > 1e-9) merged.push(b);
    }
    const rr = merged.length >= 3 ? merged : pts;
    if (rr.length < 3) continue;
    let a2 = 0;
    for (let i = 0; i < rr.length; i++) { const p = rr[i], q = rr[(i + 1) % rr.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    loops.push(a2 < 0 ? rr.slice().reverse() : rr);
  }
  return loops;
}

/** 真实格网版的口径：环 / 辐条 / 角标 / 面积（和格面积对得上）/ 凹口。 */
export function footprintBoundary(men, cells, { tick = 0.07 } = {}) {
  if (!Array.isArray(men) || !men.length) throw new RangeError('empty squad');
  const loops = unionOutline(cells);
  if (!loops.length) throw new RangeError('no outline');
  const sorted = loops.slice().sort((a, b) => ringArea(b) - ringArea(a));
  const outer = sorted[0];
  const inRing = (p, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  const rings = [outer], holes = [], islands = [];
  for (const l of sorted.slice(1)) {
    if (inRing(l[0], outer)) holes.push({ ring: l, area: ringArea(l) });
    else { rings.push(l); islands.push({ ring: l, area: ringArea(l) }); }
  }
  const hub = hubOf(men);
  const hull = hullRing(outer);
  const tris = outer.map((p, i) => [hub, p, outer[(i + 1) % outer.length]]);
  const fillTris = rings.flatMap((r) => earClip(r));
  const triArea = fillTris.reduce((s, [a, b, c]) => s + ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2, 0);
  const area = ringArea(outer) + islands.reduce((s, h) => s + h.area, 0) - holes.reduce((s, h) => s + h.area, 0);
  return {
    ring: outer, rings, islands, holes, hub,
    spokes: outer.map((p) => [hub, p]),
    tris, fillTris, triArea,
    ticks: outer.map((p) => cornerTick(p, tick)),
    area,
    perimeter: ringPerimeter(outer),
    hullArea: rings.length === 1 && hull.length >= 3 ? ringArea(hull) : null,
    notchArea: rings.length === 1 && hull.length >= 3 ? Math.max(0, ringArea(hull) - area) : 0,
    cellCount: cells.length,
    cellArea: cells.reduce((s, c) => s + (c.pts?.length >= 3 ? ringArea(c.pts.map((p) => [p.x, p.z])) : 0), 0),
    degenerate: outer.length < 3,
  };
}

export function footprint(points, { tick = 0.07 } = {}) {
  const ring = hullRing(points);
  const hub = hubOf(points);
  return {
    ring,
    hub,
    spokes: ring.map((p) => [hub, p]),
    tris: fanTriangles(ring, hub),
    ticks: ring.map((p) => cornerTick(p, tick)),
    area: ring.length >= 3 ? ringArea(ring) : 0,
    perimeter: ring.length >= 3 ? ringPerimeter(ring) : 0,
    degenerate: ring.length < 3,
  };
}
