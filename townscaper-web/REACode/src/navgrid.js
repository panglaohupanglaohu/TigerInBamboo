/**
 * navgrid.js — 多层可走面导航：把"岛屿"拆成 (x,y,z) 节点图来找路。
 *
 * 来源三条（2016-12 ~ 2017-01，Bad North 最早的原型期）：
 *
 *   797119718477991936 —— "Got some basic navigation going"
 *   807135253215199233 —— "Trying to figure out basic gameplay. Just navigating around
 *     the island is a bit more tedious than I thought, so I might have to pivot a bit"
 *   817323301357948928 —— "Trying to figure out a good approach to units. Has to look
 *     good, be quick to make and perform well in large numbers."
 *
 * ---- 画面观察 ----
 *
 * 797（紫色小岛）：一座带城墙的城堡，几个白色小人贴着地面走。岛缘有一圈浅色带
 *   （滩），小人只在深色可走面上活动 —— 说明"可走"是**算出来的**，不是全岛都能走。
 *   机位在缓慢环绕，小人的路径不跟着镜头变 —— 路径是世界空间的。
 *
 * 807（红砖楼）：两栋三层砖楼并排，砖缝纹理很清楚。小人在**不同楼层**上走：
 *   底层院子、二层挑台、还有从楼梯/梯子上下的。这正是那句"navigating around the
 *   island is more tedious than I thought"的字面意思 —— 岛不是平的，
 *   **二维最短路会把路算穿墙穿楼板**。
 *
 * 817（灰色台地）：三团各上百个士兵，另外还有黄色小点（箭/投石）在飞。
 *   ★ 关键在"perform well in large numbers"：这些士兵明显不是一个个带骨骼的模型，
 *   是**极小的贴片**，密集到看起来像一团噪点。所以渲染要能批量，
 *   不能一个单位一次 fill。
 *
 * ---- 原文说了什么 → 为什么这样写 ----
 *
 * 1) "basic navigation"：可走面 = 顶面朝上且上方为空的那一格。相邻两格高度差
 *    ≤1 才算连通（一格台阶跳得上去，两格就是墙）。这是最朴素的版本，
 *    但已经能解释片子里小人为什么只走院子不走城墙顶。
 *
 * 2) "more tedious than I thought"：节点必须是 **(x, y, z)** 三元组，不是 (x, y)。
 *    二维最短路在多层结构上会给出**物理上走不通**的路径（穿楼板/穿墙），
 *    这条片子就是这个坑的现场。所以这里同时实现 2D 与 3D 两版，
 *    用"路径是否合法"和"绕路比"两个数把差距量出来。
 *
 * 3) "perform well in large numbers"：单位只做两件事 —— 沿预计算路径插值 + 一个
 *    局部排斥。渲染按颜色合批（一个 Path2D 一次 fill），把 600 次 fill 压成 3 次。
 */

// ---------------------------------------------------------------- 村庄地形

/**
 * 用"盒子"堆一个小村：地面 + 两栋带楼板的房子 + 外部楼梯 + 一段城墙。
 * 盒子格式 [x0, y0, z0, x1, y1, z1]（左闭右开）。
 *
 * 尺寸取 22×22×6：够摆两栋楼 + 院子，又小到能在页面上一次看全。
 */
export const VILLAGE = {
  sx: 14, sy: 14, sz: 6,
  // ⚠ 楼梯必须做成"每级顶面比前一级高 1 且水平相邻"，否则连不起来 ——
  //   第一版把楼梯写成三个小方块摞在一起，顶面是同一个高度，结果是堵墙不是楼梯，
  //   二层直接变成不可达（astar 返回 null）。
  // ⚠ 楼要摆中间、地基别摊太大：第一版 22×22 地基 + 6×6 的楼，屏幕上是一块平板，楼看不见。
  boxes: [
    [1, 1, 0, 13, 13, 1],            // 地基：顶面 z=1
    // 房子 A（两层）
    [4, 4, 1, 9, 9, 3],
    [4, 4, 3, 9, 9, 4],              // 楼板 → 二层地面 z=4
    [5, 5, 4, 8, 8, 5],              // 屋顶小屋（挡路）
    // 房 A 楼梯（x=9 挨着楼板的 x=8）
    [9, 6, 0, 10, 7, 2],
    [9, 5, 0, 10, 6, 3],
    [9, 4, 0, 10, 5, 4],
    // 房子 B（三层）
    [8, 8, 1, 13, 13, 3],
    [8, 8, 4, 13, 13, 5],            // 楼板 → 三层地面 z=5
    // 房 B 楼梯（x=7 挨着楼板的 x=8）
    [7, 10, 0, 8, 11, 2],
    [7, 9, 0, 8, 10, 3],
    [7, 8, 0, 8, 9, 4],
    [7, 7, 0, 8, 8, 5],
    // 一段城墙：把西北角切开，逼出"绕行"的取舍
    [1, 6, 1, 4, 7, 4],
  ],
};

export function buildSolid(spec = VILLAGE) {
  const { sx, sy, sz, boxes } = spec;
  const solid = new Uint8Array(sx * sy * sz);
  const at = (x, y, z) => (z * sy + y) * sx + x;
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) continue;
      solid[at(x, y, z)] = 1;
    }
  }
  return { solid, at, sx, sy, sz };
}

// ---------------------------------------------------------------- 节点图

/**
 * 可走节点 = 该格为空 且 (下面是实体 或 在最底层)。
 * 连通 = 上下左右相邻且高度差 ≤ 1（一格台阶）。
 */
export class NavGrid {
  constructor({ solid, at, sx, sy, sz }) {
    this.solid = solid; this.at = at;
    this.sx = sx; this.sy = sy; this.sz = sz;
    this.nodeId = new Int32Array(sx * sy * sz).fill(-1);
    this.nodes = [];
    for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
      if (solid[at(x, y, z)]) continue;
      // ⚠ 别给 z==0 开"永远可走"的口子。第一版写了 `z===0 ? 1 : solid[...]`，
      //   结果岛缘之外（z=0 是空的）全被当成可走面，最短路直接从岛外绕 ——
      //   量出来的路径会莫名其妙掉到 z=0 一层。必须**下面一定有实体**才算踩得住。
      if (z === 0 || !solid[at(x, y, z - 1)]) continue;
      this.nodeId[at(x, y, z)] = this.nodes.length;
      this.nodes.push([x, y, z]);
    }
    this.n = this.nodes.length;
    // 邻接：4 方向 ±1 高差。竖向不加边 —— 上下楼只能靠"台阶"那一格，
    // 这正是片子里"麻烦"的地方：不能垂直跳，只能找楼梯。
    this.adj = [];
    for (let i = 0; i < this.n; i++) {
      const [x, y, z] = this.nodes[i];
      const out = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (const dz of [0, 1, -1]) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
          const j = this.nodeId[at(nx, ny, nz)];
          if (j < 0) continue;
          // 高差只能 0 或 1；上下楼多花一点
          out.push([j, dz === 0 ? 1 : 1.45]);
          break;                       // 同一方向只连最近的那一层
        }
      }
      this.adj.push(out);
    }
  }

  find(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return -1;
    return this.nodeId[this.at(x, y, z)];
  }

  /** A*。h 用水平曼哈顿 + 高度差 —— 高度差乘 1 是为了让"能不上楼就不上楼"。 */
  astar(s, t) {
    if (s < 0 || t < 0) return null;
    const n = this.n;
    const g = new Float64Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const T = this.nodes[t];
    const h = (i) => {
      const [x, y, z] = this.nodes[i];
      return Math.abs(x - T[0]) + Math.abs(y - T[1]) + Math.abs(z - T[2]) * 1.2;
    };
    const heap = [[h(s), s]];
    const push = (f, i) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]]; c = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let p = 0;
        for (;;) {
          const l = p * 2 + 1, r = l + 1;
          let m = p;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === p) break;
          [heap[p], heap[m]] = [heap[m], heap[p]]; p = m;
        }
      }
      return top;
    };
    g[s] = 0; push(h(s), s);
    while (heap.length) {
      const [, i] = pop();
      if (closed[i]) continue;
      closed[i] = 1;
      if (i === t) break;
      for (const [j, w] of this.adj[i]) {
        const nd = g[i] + w;
        if (nd < g[j] - 1e-9) { g[j] = nd; from[j] = i; push(nd + h(j), j); }
      }
    }
    if (!isFinite(g[t])) return null;
    const path = [];
    for (let i = t; i >= 0; i = from[i]) { path.push(i); if (i === s) break; }
    return path.reverse();
  }

  /** 路径合法性：每一跳都必须是一条真实存在的边。 */
  isPathValid(path) {
    if (!path || path.length < 2) return path !== null;
    for (let k = 1; k < path.length; k++) {
      if (!this.adj[path[k - 1]].some(([j]) => j === path[k])) return false;
    }
    return true;
  }

  /**
   * 对照用的"朴素二维寻路"：把 z 丢掉，只按 (x,y) 走，回来再补一个 z。
   * 这就是原文说的"比想象中麻烦"：它在多层结构上会算出**穿楼板**的路径。
   */
  astar2D(s, t) {
    const A = this.nodes[s], B = this.nodes[t];
    // 在"某一层平面"上跑 BFS，允许穿越任何高度（错误就在这一句）
    const key = (x, y) => y * this.sx + x;
    const start = key(A[0], A[1]), goal = key(B[0], B[1]);
    const prev = new Map();
    const seen = new Set([start]);
    const q = [start];
    const walkable2D = (x, y) => {
      for (let z = 0; z < this.sz; z++) if (this.nodeId[this.at(x, y, z)] >= 0) return true;
      return false;
    };
    while (q.length) {
      const cur = q.shift();
      if (cur === goal) break;
      const cx = cur % this.sx, cy = (cur / this.sx) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= this.sx || ny >= this.sy) continue;
        if (!walkable2D(nx, ny)) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        seen.add(k); prev.set(k, cur); q.push(k);
      }
    }
    if (!seen.has(goal)) return null;
    const cells = [];
    for (let k = goal; k !== start; k = prev.get(k)) cells.push(k);
    cells.push(start);
    cells.reverse();
    // 补 z：每格取"最上面那个可走层"—— 朴素做法，正是会穿模的原因
    const path = [];
    for (const k of cells) {
      const x = k % this.sx, y = (k / this.sx) | 0;
      let z = -1;
      for (let zz = this.sz - 1; zz >= 0; zz--) if (this.nodeId[this.at(x, y, zz)] >= 0) { z = zz; break; }
      path.push(this.find(x, y, z));
    }
    return path;
  }
}

// ---------------------------------------------------------------- 单位

/**
 * 单位沿预计算路径插值。刻意做得很便宜：只查路径 + 少量局部排斥。
 * 817 那条的"perform well in large numbers"就是这个意思 —— 别给单位加智能，
 * 智能在路径里，单位只是跟着点走。
 */
export class Squad {
  constructor(grid, paths, { per = 200, rng = Math.random } = {}) {
    this.grid = grid; this.paths = paths; this.agents = [];
    for (let g = 0; g < paths.length; g++) {
      for (let k = 0; k < per; k++) {
        const jitter = (rng() - 0.5) * 0.55;
        this.agents.push({ g, t: rng() * 2, jitter, done: false, x: 0, y: 0, z: 0 });
      }
    }
    this.speed = 2.4;   // 节点/秒
    this.t = 0; this.arrived = 0;
  }

  /** 路径按节点下标索引；位置用"两节点之间插值"得到，不需要任何物理。 */
  static posAt(grid, path, t) {
    const i = Math.min(path.length - 2, Math.floor(t));
    const f = t - i;
    const a = grid.nodes[path[Math.max(0, i)]], b = grid.nodes[path[Math.min(path.length - 1, i + 1)]];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  step(dt) {
    const A = this.agents;
    for (const ag of A) {
      if (ag.done) continue;
      const path = this.paths[ag.g];
      if (!path || path.length < 2) { ag.done = true; continue; }
      ag.t += dt * this.speed;
      if (ag.t >= path.length - 1) { ag.t = path.length - 1; ag.done = true; this.arrived++; }
      const p = Squad.posAt(this.grid, path, ag.t);
      // jitter 只是在垂直方向抖半个格，纯视觉，不参与寻路
      ag.x = p[0] + ag.jitter * 0.35;
      ag.y = p[1] + ag.jitter * 0.35;
      ag.z = p[2];
    }
    this.t += dt;
    return this.arrived;
  }
}
