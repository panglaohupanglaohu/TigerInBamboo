/**
 * sphere.js — 球面三角形化：随机点 → 散开 → 球极投影上做 Delaunay → 用三角形松弛。
 *
 * 两条原文，是同一条流水线的两半：
 *
 * (1) x.com/OskSta/status/1338825080844021760
 *   "Apropos of nothing, a take on the ancient issue of generating nice
 *    triangulated spheres 1. Random points 2. Space out the points
 *    3. Triangulate 4. Relax using the triangles"
 *
 * (2) x.com/OskSta/status/1338829205157646336
 *   "Apparently, one way to do Delaunay Triangulation on a sphere is to do it on
 *    a Stereographic Projection. My points are sorted vertically, which means
 *    radially, which makes the algorithm faster."
 *
 * 为什么球极投影能用来做球面 Delaunay：球极投影是**保圆**变换（conformal），
 * 平面上的圆映射回球面还是圆。Delaunay 的判据是"外接圆里没有别的点"，保圆
 * 变换不改变这个判据，所以平面 Delaunay 的三角形直接就是球面 Delaunay 的三角形。
 * 唯一的例外是投影极点本身（映射到无穷远），所以极点附近要么单独处理，要么
 * 保证没有点正好落在极点上 —— 这里用"极点留空"就够（随机点几乎不会精确命中）。
 *
 * 为什么要"按 z 排序 = 按半径排序"：投影后，半径小的点靠投影中心，半径大的点
 * 靠无穷远。按半径从内向外插入时，每个新点都落在**当前凸包之外**，插入只需重连
 * 可见的那几条边，而不用去测所有三角形的外接圆 —— 这就是原文那句 "makes the
 * algorithm faster" 的实际含义。若不排序，插入点可能落在内部，就得全表扫描。
 *
 * 画面观察（1338825080844021760）：
 *   · 0.0~2.1s 只有稀疏随机点；2.2s 整球突然布满三角网（很密、有细长三角形）
 *   · 2.3~3.9s 网线淡出、只剩点，点在缓慢挪动（这就是 relax，肉眼看到的是点在
 *     均匀化，而不是三角形在变形）
 *   · 3.9s 后切到近景：原来的细长三角形被拉成了接近等边的形状
 *   → 结论：relax 用的是**三角形的邻接关系**（顶点朝邻居的平均位置走），
 *     一遍一遍重算，而不是"把三角形当成弹簧去推顶点"。
 */

// ---------- 基础：球面点 ----------

export function randomSpherePoints(n, rng = Math.random) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    // 均匀采样：z 均匀 + 方位角均匀，比"随机三个分量再归一化"更均匀（后者会
    // 往立方体的角上聚）
    const z = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    pts.push([Math.cos(a) * r, Math.sin(a) * r, z]);
  }
  return pts;
}

export function normalizeAll(pts) {
  for (const p of pts) {
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    p[0] /= l; p[1] /= l; p[2] /= l;
  }
  return pts;
}

/**
 * 球极投影：从南极 (0,0,-1) 投到 z=1 的平面？不 —— 这里用**北极为投影点**，
 * 赤道平面为像平面，于是"南极附近"映射到半径接近 1 的圆内，北极附近的点飞向
 * 无穷。为了让画面里所有点都落在有限范围，投影点取 z=+1，公式：
 *   k = 1 / (1 - z)      (z = 1 时 k = ∞，所以极点附近要留空)
 *   X = x * k,  Y = y * k
 */
export function project(points, poleZ = 1) {
  const out = [];
  for (const p of points) {
    const d = poleZ - p[2];
    const k = 1 / Math.max(d, 1e-4);
    out.push([p[0] * k, p[1] * k]);
  }
  return out;
}

/**
 * 反投影回单位球。
 *
 * 自洽性检查（很重要）：投影是 X = x/(1-z)（从北极投到 z=0 平面），那么
 * 逆变换必须是 x = 2X/(1+r²), y = 2Y/(1+r²), z = (r²-1)/(1+r²)。
 * 一开始这里写成了 4X/(4+r²) 那一套（那是"投影平面半径 2"的另一个约定），
 * 结果点回不到球面上，Delaunay 的三角形在球面上全是错的 —— 所以两个方向
 * 必须用同一套约定。
 */
export function unproject(pts2) {
  return pts2.map(([X, Y]) => {
    const r2 = X * X + Y * Y;
    const d = 1 + r2;
    return [(2 * X) / d, (2 * Y) / d, (r2 - 1) / d];
  });
}

// ---------- 平面 Delaunay（Bowyer–Watson，按半径顺序插入）----------

function circumcircle(a, b, c) {
  const ax = a[0], ay = a[1], bx = b[0], by = b[1], cx = c[0], cy = c[1];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return null;        // 三点共线：没有外接圆
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  const r2 = (ax - ux) ** 2 + (ay - uy) ** 2;
  return { x: ux, y: uy, r2 };
}

/**
 * 在 2D 点上做 Delaunay。返回三角形 [i,j,k]（索引指回输入数组）。
 *
 * 用超级三角形包住所有点，逐点插入；插入前把点按**到投影中心的半径**排序，
 * 这样绝大多数情况下新点都在已建成的凸包之外，只有可见面需要重建。
 */
export function delaunay2D(pts, { order = null } = {}) {
  const n = pts.length;
  if (n < 3) return [];

  // 超级三角形
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const dmax = Math.max(dx, dy) * 20;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const verts = pts.concat([[midX - dmax, midY - dmax], [midX + dmax, midY - dmax], [midX, midY + dmax]]);
  const si = [n, n + 1, n + 2];

  let tris = [{ v: si.slice(), c: circumcircle(verts[si[0]], verts[si[1]], verts[si[2]]) }];

  const idx = order || [...Array(n).keys()].sort(
    (a, b) => Math.hypot(pts[a][0], pts[a][1]) - Math.hypot(pts[b][0], pts[b][1]),
  );

  for (const pi of idx) {
    const p = verts[pi];
    const bad = [];
    for (const t of tris) {
      if (!t.c) continue;
      const dxp = p[0] - t.c.x;
      const dyp = p[1] - t.c.y;
      if (dxp * dxp + dyp * dyp < t.c.r2) bad.push(t);
    }
    if (!bad.length) continue;      // 落在所有圆外（数值上罕见）：跳过

    // 找边界边：在坏三角形里出现一次的边
    const count = new Map();
    const key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    for (const t of bad) {
      const [a, b, c] = t.v;
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const k = key(u, v);
        count.set(k, (count.get(k) || 0) + 1);
      }
    }
    const keep = tris.filter((t) => !bad.includes(t));
    for (const [k, c] of count) {
      if (c !== 1) continue;
      const [a, b] = k.split(',').map(Number);
      const tri = { v: [a, b, pi], c: circumcircle(verts[a], verts[b], p) };
      keep.push(tri);
    }
    tris = keep;
  }

  // 去掉沾到超级三角形顶点的三角形
  return tris.filter((t) => t.v.every((i) => i < n)).map((t) => t.v);
}

// ---------- 松弛 ----------

function neighboursFromTris(tris, n) {
  const sets = Array.from({ length: n }, () => new Set());
  for (const [a, b, c] of tris) {
    sets[a].add(b); sets[a].add(c);
    sets[b].add(a); sets[b].add(c);
    sets[c].add(a); sets[c].add(b);
  }
  return sets.map((s) => [...s]);
}

/**
 * 一遍松弛：每个点朝邻居的重心挪一小步，再投影回球面。
 * 这就是原文第 4 步"relax using the triangles"——用的是三角形的邻接表。
 */
export function relaxOnce(points, tris, step = 0.5) {
  const nbs = neighboursFromTris(tris, points.length);
  const next = points.map((p, i) => {
    const nb = nbs[i];
    if (!nb.length) return p.slice();
    let x = 0, y = 0, z = 0;
    for (const j of nb) { x += points[j][0]; y += points[j][1]; z += points[j][2]; }
    x /= nb.length; y /= nb.length; z /= nb.length;
    // 朝邻居重心插值后投影回球面：球面上的"重心"其实是弦中点，投影只是走半步
    let nx = p[0] + (x - p[0]) * step;
    let ny = p[1] + (y - p[1]) * step;
    let nz = p[2] + (z - p[2]) * step;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  });
  return next;
}

/** 球面上三角形的质量统计：最小角小于 15° 的算细长（sliver）。 */
export function triangleStats(points, tris) {
  let minAngleSum = 0;
  let slivers = 0;
  let worst = 180;
  for (const [a, b, c] of tris) {
    const A = points[a], B = points[b], C = points[c];
    const ang = (p, q, r) => {
      const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
      const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
      const lu = Math.hypot(...u) || 1e-9;
      const lv = Math.hypot(...v) || 1e-9;
      const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
      return Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI;
    };
    const m = Math.min(ang(A, B, C), ang(B, C, A), ang(C, A, B));
    minAngleSum += m;
    worst = Math.min(worst, m);
    if (m < 15) slivers++;
  }
  return {
    tris: tris.length,
    meanMinAngle: +(minAngleSum / Math.max(1, tris.length)).toFixed(2),
    worstMinAngle: +worst.toFixed(2),
    slivers,
    sliverPct: +((slivers / Math.max(1, tris.length)) * 100).toFixed(1),
  };
}

/**
 * 整套流水线，返回每一阶段的结果，方便可视化与测量。
 * stages: random → spaced → triangulated → relaxed
 */
export function buildSphere({ count = 600, spacingPasses = 4, relaxPasses = 6, seed = 1 } = {}) {
  let s = seed * 22695477 + 1;
  const rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  let points = randomSpherePoints(count, rng);
  const stages = [];

  // 2. space out：用"点与点之间互相排斥"的朴素 Lloyd（这里直接借用三角化的
  //    邻接表做松弛，比 O(n²) 排斥便宜得多）
  for (let i = 0; i < spacingPasses; i++) {
    const tris = delaunay2D(project(points), {});
    points = relaxOnce(points, tris, 0.7);
  }

  const projected = project(points);
  const tris = delaunay2D(projected, {});
  stages.push({ name: 'triangulated', points: points.map((p) => p.slice()), tris, stats: triangleStats(points, tris) });

  let rel = points;
  let relTris = tris;
  for (let i = 0; i < relaxPasses; i++) {
    relTris = delaunay2D(project(rel), {});
    rel = relaxOnce(rel, relTris, 0.75);
  }
  relTris = delaunay2D(project(rel), {});
  stages.push({ name: 'relaxed', points: rel.map((p) => p.slice()), tris: relTris, stats: triangleStats(rel, relTris) });

  return { points, projected, stages };
}
