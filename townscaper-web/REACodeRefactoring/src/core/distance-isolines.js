/** 902103473365417984 "Ok, one more visualization. Distances this time."
 *
 * 片子里是一整座岛铺满等间距的亮线：线在地面/台阶上绕行，遇到建筑绕开，
 * 同一块平地上是一圈圈互相嵌套的闭环 —— 这是距离场的等值线（iso-distance），
 * 不是流向继承线（902069261304287232 那条画的是每格到父格的一段，会分叉、不闭合）。
 *
 * 本模块只做这条链：可走格 mask + 任意多边形占地 obstacles → 精确欧氏距离变换
 *   （到最近不可走格 / 岛缘 / 多边形边界的格心距离）→ marching squares 取任意多级等值线
 *   → 端点缝合成长折线（闭环 / 开放都能标出来）。
 *
 * 3D 多层台阶与 battle.js 调试接入落在 src/badnorth/battle-c03.js 的 distIso 档
 *   （isoLinesOnMesh：渲染网格表面测地距离，线爬崖壁/台阶立面，默认关，?distIso=1 或
 *   c03.set('distIso', true) 打开）。本文件管 2D 网格口径 + 亚格精度的多边形占地。
 */

/** 一维平方距离变换（Felzenszwalb & Huttenlocher）。f 里允许 Infinity（没有源）。 */
function edt1d(f, n, d, v, z) {
  let k = -1;
  for (let q = 0; q < n; q++) {
    if (!Number.isFinite(f[q])) continue;
    if (k < 0) { k = 0; v[0] = q; z[0] = -Infinity; z[1] = Infinity; continue; }
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      if (k < 0) break;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  if (k < 0) { for (let q = 0; q < n; q++) d[q] = Infinity; return; }
  let j = 0;
  for (let q = 0; q < n; q++) {
    while (z[j + 1] < q) j++;
    const p = v[j]; d[q] = (q - p) * (q - p) + f[p];
  }
}

/** 点到线段距离。 */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/** 校验并归一化一个任意多边形占地（≥3 顶点、有限坐标、首尾不重复）。 */
function normalizePolygon(poly) {
  if (!Array.isArray(poly) || poly.length < 3) throw new RangeError('多边形占地至少需要 3 个顶点');
  const out = poly.map((p) => {
    if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) throw new TypeError('多边形顶点必须是 [x,y] 有限坐标');
    return [p[0], p[1]];
  });
  if (out.length > 1 && out[0][0] === out.at(-1)[0] && out[0][1] === out.at(-1)[1]) out.pop();
  if (out.length < 3) throw new RangeError('多边形占地去重后不足 3 个顶点');
  return out;
}

/**
 * 点到简单多边形的**有向**欧氏距离：负 = 内部，0 = 边界上。
 * 任意凸/凹多边形都行（偶奇规则判内外），距离取到各边线段的最小值 —— 所以斜墙、
 * 退台、尖角 footprint 的等值线都贴着真实边线走，不再被格子边界切成台阶。
 */
export function polygonDistance(x, y, poly) {
  const p = normalizePolygon(poly);
  let best = Infinity, inside = false;
  for (let i = 0; i < p.length; i++) {
    const [ax, ay] = p[i], [bx, by] = p[(i + 1) % p.length];
    const d = segDist(x, y, ax, ay, bx, by); if (d < best) best = d;
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside ? -best : best;
}

/**
 * 距离场：dist[i] = 该格中心到最近「不可走格、岛外或多边形占地边界」的欧氏距离（格为单位）。
 * 岛缘算距离 0.5 之外的第一格 → 边界格距离 1。
 *
 * obstacles：任意多边形 footprint（顶点按 mask 同款「格心=整数坐标」口径）。
 *   格心落在多边形内 → 距离 0（等于多了一个源）；多边形外取到边界的精确距离，
 *   与 EDT 的格心距离取 min —— 斜边占地不再退化成一格一格的方块。
 */
export function distanceField(mask, { w, h, obstacles = [] } = {}) {
  if (!Array.isArray(mask) && !mask?.length) throw new TypeError('mask 需要可索引的格子数组');
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 2 || h < 2) throw new RangeError('w/h 必须是 ≥2 的整数');
  if (mask.length !== w * h) throw new RangeError(`mask 长度 ${mask.length} ≠ ${w}×${h}`);
  const polys = obstacles.map(normalizePolygon);
  // 四周补一圈「外面」= 距离 0 的源，边界格的距离才是 1 而不是无穷。
  const W = w + 2, H = h + 2, f = new Float64Array(W * H).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (mask[y * w + x]) f[(y + 1) * W + (x + 1)] = Infinity;
  }
  const tmp = new Float64Array(Math.max(W, H)), out = new Float64Array(Math.max(W, H)), v = new Int32Array(Math.max(W, H) + 1), z = new Float64Array(Math.max(W, H) + 1);
  const grid = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    const base = y * W;
    for (let x = 0; x < W; x++) tmp[x] = f[base + x];
    edt1d(tmp, W, out, v, z);
    for (let x = 0; x < W; x++) grid[base + x] = out[x];
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) tmp[y] = grid[y * W + x];
    edt1d(tmp, H, out, v, z);
    for (let y = 0; y < H; y++) grid[y * W + x] = out[y];
  }
  /** 占地多边形对单点的贡献：内部/边界 0，外部取精确边界距离。 */
  const polyAt = (x, y) => {
    let d = Infinity;
    for (const p of polys) { const sd = polygonDistance(x, y, p); if (sd < d) d = sd; }
    return Math.max(0, d);
  };
  const dist = new Float32Array(w * h);
  let max = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let d = Math.sqrt(grid[(y + 1) * W + (x + 1)]);
    if (mask[i] && polys.length) { const pd = polyAt(x, y); if (pd < d) d = pd; }
    dist[i] = mask[i] ? d : 0;
    if (mask[i] && d > max) max = d;
  }
  return {
    w, h, dist, max, obstacles: polys,
    /** 双线性采样（格子中心为整数坐标），给等值线插值和验收用；
     *  有占地多边形时与多边形边界的精确距离取 min —— 等值线在格内也贴斜边。 */
    at(x, y) {
      const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
      const g = (px, py) => {
        const cx = Math.min(w - 1, Math.max(0, px)), cy = Math.min(h - 1, Math.max(0, py));
        return dist[cy * w + cx];
      };
      const a = g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx;
      const b = g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx;
      let v = a * (1 - ty) + b * ty;
      if (polys.length) { const pd = polyAt(x, y); if (pd < v) v = pd; }
      return v;
    },
  };
}

const key = (x, y) => `${Math.round(x * 1e4)}|${Math.round(y * 1e4)}`;

/**
 * marching squares，取多级等值线。
 *
 * 口径：不可走格的距离是 0（= 距离场的源），照样参与四角插值 —— 这样等值线才会
 * 贴着岸边/建筑基脚闭合，像片子里那样绕过去，而不是在障碍旁边断成一堆开口。
 * 代价：level 越接近 1，线会往障碍格里多压一点（最多半格）；层数密时看不出来。
 */
export function isoContours(field, { levels = [0.5] } = {}) {
  const { w, h, dist } = field;
  if (!levels.length) throw new RangeError('levels 不能为空');
  if (levels.some((L) => !Number.isFinite(L) || L <= 0)) throw new RangeError('等值必须为有限正数');
  return levels.map((level) => {
    const segments = [], cache = new Map();
    const cut = (ax, ay, bx, by) => {
      const va = field.at(ax, ay) - level, vb = field.at(bx, by) - level;
      if (va === 0 && vb === 0) return null;
      if ((va > 0) === (vb > 0)) return null;
      const k = key(ax, ay) < key(bx, by) ? `${key(ax, ay)}~${key(bx, by)}` : `${key(bx, by)}~${key(ax, ay)}`;
      const hit = cache.get(k);
      if (hit) return hit;
      // va / vb 异号，t 必在 (0,1) 内；端点值相等时退化到中点。
      const den = vb - va, t = Math.abs(den) < 1e-12 ? 0.5 : -va / den;
      const p = { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
      cache.set(k, p);
      return p;
    };
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
      const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
      if (corners.some(([cx, cy]) => !Number.isFinite(dist[cy * w + cx]))) continue;
      const val = corners.map(([cx, cy]) => dist[cy * w + cx]);
      if (val.every((v) => v < level) || val.every((v) => v > level)) continue;
      let idx = 0;
      for (let i = 0; i < 4; i++) if (val[i] > level) idx |= 1 << i;
      const e0 = () => cut(...corners[0], ...corners[1]);
      const e1 = () => cut(...corners[1], ...corners[2]);
      const e2 = () => cut(...corners[3], ...corners[2]);
      const e3 = () => cut(...corners[0], ...corners[3]);
      const pair = (a, b) => { if (a && b && (a.x !== b.x || a.y !== b.y)) segments.push([a, b]); };
      switch (idx) {
        case 1: case 14: pair(e3(), e0()); break;
        case 2: case 13: pair(e0(), e1()); break;
        case 3: case 12: pair(e3(), e1()); break;
        case 4: case 11: pair(e1(), e2()); break;
        case 6: case 9: pair(e0(), e2()); break;
        case 7: case 8: pair(e2(), e3()); break;
        case 5: case 10: {
          // 鞍点：用四角均值判连接方向，跟 contour.js 的判别保持一致
          const mid = (val[0] + val[1] + val[2] + val[3]) / 4;
          if ((mid > level) === (idx === 5)) { pair(e3(), e0()); pair(e1(), e2()); }
          else { pair(e3(), e2()); pair(e0(), e1()); }
          break;
        }
      }
    }
    // 缝合：端点重合就串起来，分叉保留成多条（不硬连）
    const incident = new Map();
    segments.forEach((s, i) => s.forEach((p) => {
      const k = key(p.x, p.y);
      if (!incident.has(k)) incident.set(k, []);
      incident.get(k).push(i);
    }));
    const unused = new Set(segments.map((_, i) => i)), paths = [];
    const step = (from, first) => {
      let p = from, index = first;
      const points = [p];
      while (unused.has(index)) {
        unused.delete(index);
        const s = segments[index];
        p = key(s[0].x, s[0].y) === key(p.x, p.y) ? s[1] : s[0];
        points.push(p);
        const next = incident.get(key(p.x, p.y)) || [];
        if (key(p.x, p.y) === key(from.x, from.y) || next.length !== 2) break;
        index = next.find((i) => unused.has(i));
        if (index === undefined) break;
      }
      paths.push({ points, closed: points.length > 2 && key(points.at(-1).x, points.at(-1).y) === key(points[0].x, points[0].y) });
    };
    for (const [k, ids] of incident) if (ids.length !== 2) for (const i of ids) if (unused.has(i)) step(segments[i][0], i);
    for (const i of unused) step(segments[i][0], i);
    return {
      level,
      segments: segments.map(([a, b]) => [a.x, a.y, b.x, b.y]),
      paths,
      closed: paths.filter((p) => p.closed).length,
      openEnds: [...incident.values()].filter((ids) => ids.length === 1).length,
    };
  });
}

/** 按等间距取一组等值：片子里的线是等距的，不是按数据分布。 */
export function evenLevels(max, spacing) {
  if (!Number.isFinite(max) || max <= 0) throw new RangeError('max 必须是有限正数');
  if (!Number.isFinite(spacing) || spacing <= 0) throw new RangeError('spacing 必须是有限正数');
  const out = [];
  for (let L = spacing; L < max + 1e-9; L += spacing) out.push(Number(L.toFixed(6)));
  return out;
}
