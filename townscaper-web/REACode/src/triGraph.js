/**
 * triGraph.js — 可增量插入的三角图：插点、翻边、始终保持流形 + 近 Delaunay。
 *
 * 原文（x.com/OskSta/status/1677242779162877952）：
 *
 *   "I am (once again) rewriting my generic triangle graph system to (hopefully)
 *    be more robust and generic. Here's a stress test where I'm adding random
 *    verts, making sure the graph stays mainifold and delauney-ish along the way."
 *
 * 画面观察（24 帧总览）：
 *   · 0.2s 只有一个三角形；1.7s 起每次插点后网格**变大一点点**，但外轮廓几乎不动
 *     —— 说明点插在**内部**，不是往外扩
 *   · 每次插点都有一小簇**绿色**短线（被检查的边）和一条**黄色**粗线（正在翻的边），
 *     集中在刚插入的点周围 2~3 个三角形内 —— 翻边是局部的，不是全局重算
 *   · 全程 24 帧没有出现洞、没有重叠三角形 → 流形一直保持
 *   · 网眼从又细又长变成越来越均匀（Delaunay-ish 的效果就是最小角被抬起来）
 *
 * 三个必须同时成立的性质，和它们各自的做法：
 *
 *   1. **流形**：每条内部边正好被 2 个三角形共享，边界边只被 1 个共享。
 *      做法是插点时**只在包含该点的那一个三角形里**一分为三，绝不碰别处；
 *      翻边时只动共享这条边的 2 个三角形，且要求四边形是凸的（否则翻完会重叠）。
 *
 *   2. **近 Delaunay**：翻边判据用"对面的点在不在外接圆内"。
 *      注意是**近** Delaunay：翻了若干次之后不再无限迭代（原文也说的是 -ish），
 *      每插一个点只处理受影响的边，队列空了就停。
 *
 *   3. **局部性**：插点只影响 O(1) 个三角形，翻边只沿受影响边传播。
 *      这就是为什么它能在"随机加顶点"的压力测试里一直保持合法 ——
 *      任何时刻只有一个很小的区域处于"暂时不合法"的状态。
 *
 * 为什么不用 Bowyer–Watson（`engine/sphere.js` 里那个）：那个是**批量**算法，
 * 一次插一个点但会删除所有外接圆包含该点的三角形，重连边界；适合"一次性生成"。
 * 这里要的是**增量**：已经有一张合法网格，往里加一个点，希望改动最小。
 * 两者的差别在 demo 里看得见 —— 这里每次只亮 3~5 条绿边、1 条黄边。
 */

// ---------- 基础工具 ----------

/** 有向面积 ×2：>0 逆时针。 */
export function orient(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function inCircle(a, b, c, p) {
  // 假定 a,b,c 逆时针；返回 p 是否在外接圆内
  const ax = a[0] - p[0], ay = a[1] - p[1];
  const bx = b[0] - p[0], by = b[1] - p[1];
  const cx = c[0] - p[0], cy = c[1] - p[1];
  const det =
    (ax * ax + ay * ay) * (bx * cy - cx * by) -
    (bx * bx + by * by) * (ax * cy - cx * ay) +
    (cx * cx + cy * cy) * (ax * by - bx * ay);
  return det > 0;
}

const edgeKey = (a, b) => (a < b ? a + '_' + b : b + '_' + a);

export class TriGraph {
  constructor(verts = [], tris = [], pinned = new Set()) {
    this.verts = verts.map((v) => [v[0], v[1]]);
    this.tris = tris.map((t) => t.slice());
    // 超级三角形的三个顶点：参与计算，但**不算在结果里**（不画、不体检）
    this.pinned = new Set(pinned);
    // 每次插点/翻边的现场记录，给可视化用（黄=翻边，绿=被检查的边）
    this.lastFlips = [];
    this.lastTouched = [];
  }

  /**
   * 用一个**包住点云的超级三角形**起手。
   *
   * 为什么不是"贴着点云的三角形"：贴着点云的那个三角形的三条边会成为**边界边**，
   * 而边界边不能翻（翻了会掉三角形），于是靠近边界的点一定长出又长又薄的三角形，
   * 而且这些三角形会在画面上留下扇形的长刺 —— 第一版就是这样，最差最小角永远
   * 卡在 0.0x°。用超级三角形（比点云大若干倍）后，所有真实点都在内部，
   * 边界由**点云自己的凸包**决定；超级三角形的三个顶点最后被 filtered 掉。
   */
  static withSuper(points, { margin = 20 } = {}) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const w = (maxX - minX) || 1, h = (maxY - minY) || 1;
    const mx = minX - w * margin, my = minY - h * margin;
    const px = maxX + w * margin, py = maxY + h * margin;
    const cx = (minX + maxX) / 2;
    const g = new TriGraph([[mx, my], [px, my], [cx, py + (py - my)]], [], new Set([0, 1, 2]));
    g.tris.push([0, 1, 2]);
    return g;
  }

  /** 只看"真实点"构成的三角形（超级三角形参与计算，但不进结果）。 */
  visibleTris() {
    if (!this.pinned.size) return this.tris;
    return this.tris.filter((t) => !this.pinned.has(t[0]) && !this.pinned.has(t[1]) && !this.pinned.has(t[2]));
  }

  clone() {
    return new TriGraph(this.verts, this.tris, this.pinned);
  }

  /** 边 → 相邻三角形索引列表。每次调用重算，简单可靠（顶点数千级够快）。 */
  edgeMap() {
    const map = new Map();
    this.tris.forEach((t, ti) => {
      for (let i = 0; i < 3; i++) {
        const k = edgeKey(t[i], t[(i + 1) % 3]);
        let list = map.get(k);
        if (!list) { list = []; map.set(k, list); }
        list.push(ti);
      }
    });
    return map;
  }

  /** 找出包含 p 的三角形（含边上）。返回 {tri, onEdge:[a,b]|null} */
  locate(p) {
    for (let ti = 0; ti < this.tris.length; ti++) {
      const [a, b, c] = this.tris[ti];
      const A = this.verts[a], B = this.verts[b], C = this.verts[c];
      const d1 = orient(A, B, p);
      const d2 = orient(B, C, p);
      const d3 = orient(C, A, p);
      if (d1 >= -1e-9 && d2 >= -1e-9 && d3 >= -1e-9) {
        // 落在某条边上（含共线两点之间）时记下来，插点会退化，跳过
        const onEdge =
          Math.abs(d1) < 1e-9 ? [a, b] :
          Math.abs(d2) < 1e-9 ? [b, c] :
          Math.abs(d3) < 1e-9 ? [c, a] : null;
        return { tri: ti, onEdge };
      }
    }
    return null;
  }

  /**
   * 插入一个点。返回 true 表示插进去了。
   *
   * 步骤：定位 → 一分为三 → 对三条新边做 Lawson 翻边（栈式传播）。
   */
  insertPoint(p) {
    const hit = this.locate(p);
    if (!hit || hit.onEdge) return false;      // 点在外面 / 正好压在边上：跳过
    const [a, b, c] = this.tris[hit.tri];
    const pi = this.verts.length;
    this.verts.push([p[0], p[1]]);
    // 一分为三，保持逆时针（原三角形是逆时针，子三角形按同样的环序切）
    this.tris.splice(hit.tri, 1, [a, b, pi], [b, c, pi], [c, a, pi]);

    this.lastFlips = [];
    this.lastTouched = [];
    // 受影响的边：三条外框边 a-b / b-c / c-a
    const stack = [[a, b], [b, c], [c, a]];
    let guard = 0;
    while (stack.length && guard++ < 64) {
      const [u, v] = stack.pop();
      this.lastTouched.push([u, v]);
      const next = this.tryFlip(u, v);
      if (next) for (const e of next) stack.push(e);
    }
    return true;
  }

  /**
   * 尝试翻边 (u,v)：找它两侧的三角形，若对点在外接圆内且四边形凸，就翻。
   * 返回翻完之后的"需要重新检查的两条边"，或 null。
   */
  tryFlip(u, v) {
    const map = this.edgeMap();
    const adj = map.get(edgeKey(u, v)) || [];
    if (adj.length !== 2) return null;         // 边界边不翻（翻了会掉三角形）

    const t1 = this.tris[adj[0]];
    const t2 = this.tris[adj[1]];
    const opp = (t) => t.find((i) => i !== u && i !== v);
    const p = opp(t1);
    const q = opp(t2);
    if (p === undefined || q === undefined) return null;

    const U = this.verts[u], V = this.verts[v], P = this.verts[p], Q = this.verts[q];

    // 凸性检查：p 和 q 必须在 u-v 的两侧，且四边形 u-p-v-q 是凸的。
    // 少了这一步，翻边会翻出重叠三角形 —— 流形立刻被破坏。
    if (orient(U, V, P) * orient(U, V, Q) >= 0) return null;
    if (orient(P, Q, U) * orient(P, Q, V) >= 0) return null;

    // Delaunay 判据：q 若在 (u,v,p) 的外接圆内，这条边就不该存在。
    // 用 (U,V,P) 的逆时针序做判据，避免三角形绕向不定带来的符号问题。
    const A = orient(U, V, P) > 0 ? [U, V, P] : [V, U, P];
    if (!inCircle(A[0], A[1], A[2], Q)) return null;

    // 执行翻转：把 (u,v) 换成 (p,q)
    this.tris[adj[0]] = orient(this.verts[p], this.verts[q], U) > 0 ? [p, q, u] : [q, p, u];
    this.tris[adj[1]] = orient(this.verts[p], this.verts[q], V) > 0 ? [p, q, v] : [q, p, v];
    this.lastFlips.push([u, v, p, q]);
    // 翻完之后要重新检查的是四边形另外四条边（新边 p-q 本身不用）
    return [[p, u], [u, q], [p, v], [v, q]];
  }

  /**
   * 体检：流形性 + 质量。
   *
   * 流形性的定义（和 `engine/meshcheck.js` 一致，但这里是 2D 三角图）：
   *   · 每条边最多被 2 个三角形共享（>2 = 非流形边）
   *   · 每条**内部**边正好被 2 个共享；只有 1 个的是边界边
   *   · 没有重复三角形、没有零面积三角形
   */
  audit() {
    const vis = this.visibleTris();
    const map = new Map();
    for (const t of vis) {
      for (let i = 0; i < 3; i++) {
        const k = edgeKey(t[i], t[(i + 1) % 3]);
        const list = map.get(k);
        if (list) list.push(t); else map.set(k, [t]);
      }
    }
    let boundary = 0;
    let nonManifold = 0;
    let degenerate = 0;
    let minAngle = 180;
    const angles = [];
    const seenTri = new Set();
    let dup = 0;

    for (const [, list] of map) {
      if (list.length === 1) boundary++;
      else if (list.length > 2) nonManifold++;
    }
    for (const [a, b, c] of vis) {
      const key = [a, b, c].slice().sort((x, y) => x - y).join('_');
      if (seenTri.has(key)) dup++;
      seenTri.add(key);
      const A = this.verts[a], B = this.verts[b], C = this.verts[c];
      const area = Math.abs(orient(A, B, C)) * 0.5;
      if (area < 1e-9) { degenerate++; continue; }
      const ma = minAngleOf(A, B, C);
      angles.push(ma);
      minAngle = Math.min(minAngle, ma);
    }
    angles.sort((x, y) => x - y);
    const medianMinAngle = angles.length ? +angles[(angles.length / 2) | 0].toFixed(2) : 0;
    const slivers = angles.filter((v) => v < 10).length;
    const edges = map.size;
    // 欧拉公式：V - E + F = 1（单连通、带边界）
    const realVerts = this.pinned.size ? this.verts.length - this.pinned.size : this.verts.length;
    const euler = realVerts - edges + vis.length;
    return {
      verts: realVerts,
      tris: vis.length,
      edges,
      boundary,
      nonManifold,
      duplicateTris: dup,
      degenerate,
      minAngle: +minAngle.toFixed(2),
      medianMinAngle,
      slivers,
      euler,
      manifold: nonManifold === 0 && dup === 0 && degenerate === 0 && euler === 1,
    };
  }
}

function minAngleOf(a, b, c) {
  const ang = (p, q, r) => {
    const ux = q[0] - p[0], uy = q[1] - p[1];
    const vx = r[0] - p[0], vy = r[1] - p[1];
    const lu = Math.hypot(ux, uy) || 1e-9;
    const lv = Math.hypot(vx, vy) || 1e-9;
    const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (lu * lv)));
    return Math.acos(cos) * 180 / Math.PI;
  };
  return Math.min(ang(a, b, c), ang(b, c, a), ang(c, a, b));
}

/**
 * 生成一个"不规则六边形块"里的随机点，按插入顺序返回（离中心近的先插，
 * 这样早期三角形不会被拉得特别长 —— 和片子里"从一小片长起来"一致）。
 */
export function blobPoints(n, { radius = 1, rng = Math.random } = {}) {
  const pts = [];
  let guard = 0;
  while (pts.length < n && guard++ < n * 40) {
    // 六边形近似：用极坐标 + 角度调制，得到片子里那种不规则的块状分布
    const a = rng() * Math.PI * 2;
    const rMax = radius * (0.72 + 0.28 * Math.cos(3 * a) ** 2);
    const r = Math.sqrt(rng()) * rMax;
    pts.push([Math.cos(a) * r * 1.35, Math.sin(a) * r * 0.92]);
  }
  pts.sort((p, q) => (p[0] * p[0] + p[1] * p[1]) - (q[0] * q[0] + q[1] * q[1]));
  return pts;
}

/**
 * 一把跑完：建种子三角形 → 逐个插点 → 每步体检。
 * @returns {{graph:TriGraph, history:Array, skipped:number}}
 */
export function buildTriGraph(points, { stopAt = Infinity, flip = true, margin = 0.12 } = {}) {
  // 种子三角形要**贴着点云**，不能随手给一个大框。
  // 踩过的坑：第一版种子是固定的大三角形（±2.2），而点都在半径 1.35 内，
  // 于是最初几次插点会在种子三条边上留下又长又薄的三角形 —— 那三条是**边界边**，
  // 翻边动不了（翻了会掉三角形），最差最小角永远卡在 0.5°，Delaunay 白做。
  let g = TriGraph.withSuper(points, { margin: margin * 40 });
  const history = [];
  let skipped = 0;
  for (let i = 0; i < points.length; i++) {
    const before = g.audit();
    const ok = flip ? g.insertPoint(points[i]) : insertNoFlip(g, points[i]);
    if (!ok) { skipped++; continue; }
    const after = g.audit();
    history.push({
      i, point: points[i],
      flips: g.lastFlips.length,
      touched: g.lastTouched.length,
      minAngle: after.minAngle,
      tris: after.tris,
      manifold: after.manifold,
      eulerBefore: before.euler,
    });
    if (i >= stopAt) break;
  }
  return { graph: g, history, skipped };
}

/** 对照用：只插点不翻边，看最小角会差多少。 */
export function insertNoFlip(g, p) {
  const hit = g.locate(p);
  if (!hit || hit.onEdge) return false;
  const [a, b, c] = g.tris[hit.tri];
  const pi = g.verts.length;
  g.verts.push([p[0], p[1]]);
  g.tris.splice(hit.tri, 1, [a, b, pi], [b, c, pi], [c, a, pi]);
  g.lastFlips = [];
  g.lastTouched = [];
  return true;
}
