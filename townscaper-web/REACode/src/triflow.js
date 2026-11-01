/**
 * triflow.js — 三角图上的"流体"寻路 + 多组流场驱动。
 *
 * 来源两条：
 *   810157485638189056 —— "Trying out fluid pathfinding on a triangle graph.
 *     Making it up as I go along. Anyone got any tips on readings on this topic"
 *   816743289500106752 —— "3 groups of 100 soldiers being ordered around.
 *     Oh, the wonders of flow fields!"
 *
 * ---- 画面观察 ----
 *
 * 810157485638189056（俯视，24 帧 + 单帧 f020）：
 *   · 底子是**棕色实心走廊**，上面覆着一层**白色虚线三角网** —— 关键：网是**规则的**
 *     （每个格子切成三角形），不是自由 Delaunay。所以他的三角图是"栅格三角化"，
 *     不是逐点插入。这跟我原先想直接复用 src/triGraph.js 的增量插点**不一样**，
 *     增量插点出来的三角形大小差很多，画不出片子里那种均匀网格。
 *   · 走廊是一张**分叉的网络**（有回路、有死胡同），左下角还有一块独立的小区域。
 *   · 箭头（红/绿/蓝 gizmo，还有一根蓝色粗箭头、一根红色细箭头）钉在**三角形上**，
 *     不是钉在顶点上 —— 流场是**逐三角形**存的。
 *   · 左下那一小片密布的黑红点 = 一堆单位挤在同一块三角形上。点的排布跟着三角形
 *     走（有些点被三角边切开），说明单位位置是**三角形内的重心坐标**，不是格子坐标。
 *   · 全程网格不动、点不动，只有箭头在变 —— 他在调参数，不是在跑模拟。
 *
 * 816743289500106752（等距 3D 岛屿）：
 *   · 三团士兵（白蓝小点，每团约 100）在带墙的岛上来回走。团不是刚体：
 *     过窄口时会**拉长成一条**，出去以后再收拢回圆形。
 *   · 三团的路径会**互相穿插但不重叠** —— 各团有自己的目标，共用一张地形流场。
 *   · 士兵绕过墙角时是**沿墙滑**，没有卡在凹角里 —— 说明流场是把障碍当边界解出来的，
 *     不是"直线朝目标走 + 碰壁再绕"。
 *
 * ---- 原文说了什么 → 为什么这样写 ----
 *
 * "fluid pathfinding on a triangle graph"：普通流场是每个格存一个"朝向哪个邻居"的
 * 离散方向，单位走起来是**阶梯折线**（8 方向锯齿）。"流体"的意思是在三角面上解一个
 * 连续场，让方向在三角形**内部**也能连续变化。做法：
 *   1. 先用 Dijkstra 在三角形邻接图上算到目标的代价（离散、可靠、一定收敛）；
 *   2. 再对这个代价场做若干次拉普拉斯平滑，得到 φ；
 *   3. 把 φ 从三角形中心搬到**顶点**（= 相邻三角形平均），三角形内就是 φ 的分片线性
 *      插值，于是梯度 ∇φ 在每个三角形内是**常量**、跨边近似连续；
 *   4. 流向 = -∇φ / |∇φ|。
 * 这就是"把离散方向换成连续梯度"的全部内容 —— 原文说"making it up as I go along"，
 * 那我也把这两步分开实现、分开量，用曲率证明平滑到底有没有用。
 *
 * "3 groups of 100 soldiers"：一组一张流场。三组 = 三张场，各自 Dijkstra，
 * 代价很小（一次几百个三角形）。士兵之间只加一个**局部排斥**，不需要全局避障 ——
 * 避障是流场负责的。这就是 flow field 相对 steering 的核心优势：路是一次算好的，
 * 单位只查表。
 */

// ---------------------------------------------------------------- 走廊地形

/**
 * 用一串胶囊（线段 + 半径）拼出走廊网。片子里是手摆的关卡，这里用参数描述，
 * 但结构一样：有分叉、有回路、有一块孤岛。
 */
export const CORRIDOR_SPEC = [
  [[0.10, 0.18], [0.62, 0.18], 0.055],
  [[0.62, 0.18], [0.62, 0.44], 0.050],
  [[0.62, 0.44], [0.88, 0.44], 0.050],
  [[0.62, 0.44], [0.62, 0.78], 0.050],
  [[0.62, 0.78], [0.30, 0.78], 0.055],
  [[0.30, 0.78], [0.30, 0.52], 0.048],
  [[0.30, 0.52], [0.10, 0.52], 0.048],
  [[0.10, 0.52], [0.10, 0.18], 0.048],
  [[0.30, 0.52], [0.44, 0.52], 0.042],
  [[0.44, 0.52], [0.44, 0.34], 0.042],
  [[0.44, 0.34], [0.24, 0.34], 0.042],
  [[0.24, 0.34], [0.24, 0.30], 0.040],
  // 左下孤岛（片子里那块独立的小区域）
  [[0.16, 0.88], [0.30, 0.88], 0.048],
  [[0.23, 0.84], [0.23, 0.93], 0.040],
];

export function makeMask(w, h, spec = CORRIDOR_SPEC) {
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = (i + 0.5) / w, y = (j + 0.5) / h;
      for (const [a, b, r] of spec) {
        // 点到线段的距离，比逐像素画圆便宜，而且不会在接缝处露缝
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const L2 = dx * dx + dy * dy || 1e-9;
        let t = ((x - a[0]) * dx + (y - a[1]) * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = a[0] + dx * t, py = a[1] + dy * t;
        const dd = (x - px) * (x - px) + (y - py) * (y - py);
        if (dd <= r * r) { mask[j * w + i] = 1; break; }
      }
    }
  }
  return mask;
}

// ---------------------------------------------------------------- 三角场

/**
 * 栅格三角化：每个方格沿 TL→BR 对角线切成两个三角形，只保留重心落在 mask 里的。
 * ★ 为什么不用 src/triGraph.js（增量插点 + 翻边）：那套是给"自由点云"用的，
 *   三角形大小差很多，画出来跟片子里匀净的白虚线网对不上。这里是**规则网格三角化**，
 *   每个三角形都 3 条边、内部严格 3 邻接，Dijkstra 和梯度都好写。
 *
 * 三角形的 3 个方向：
 *   A（上右半，顶点 TL,TR,BR）：0=斜边(同格 B) 1=上边(上格 B 的底) 2=右边(右格 B 的左)
 *   B（下左半，顶点 TL,BR,BL）：0=斜边(同格 A) 1=左边(左格 A 的右) 2=底边(下格 A 的上)
 */
export class TriField {
  constructor(w, h, mask) {
    this.w = w; this.h = h; this.mask = mask;
    this.cellOfTri = new Int32Array(w * h * 2).fill(-1);
    this.triOfCell = new Int32Array(w * h * 2).fill(-1);
    const tris = [], cent = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!mask[j * w + i]) continue;
      for (let half = 0; half < 2; half++) {
        const id = tris.length;
        // 顶点坐标用格坐标（0..w, 0..h），比 0..1 好写好debug
        const v = half === 0
          ? [[i, j], [i + 1, j], [i + 1, j + 1]]
          : [[i, j], [i + 1, j + 1], [i, j + 1]];
        const cx = (v[0][0] + v[1][0] + v[2][0]) / 3;
        const cy = (v[0][1] + v[1][1] + v[2][1]) / 3;
        tris.push({ cell: j * w + i, half, v, cx, cy, area: 0.5 });
        cent.push([cx, cy]);
        this.cellOfTri[id] = j * w + i;
        this.triOfCell[(j * w + i) * 2 + half] = id;
      }
    }
    this.tris = tris; this.cent = cent;
    this.n = tris.length;
    this.nbr = new Int32Array(this.n * 3).fill(-1);
    for (let t = 0; t < this.n; t++) {
      const { cell, half } = tris[t];
      const i = cell % w, j = (cell / w) | 0;
      const at = (ii, jj, hh) => {
        if (ii < 0 || jj < 0 || ii >= w || jj >= h) return -1;
        if (!mask[jj * w + ii]) return -1;
        return this.triOfCell[(jj * w + ii) * 2 + hh];
      };
      let a, b, c;
      if (half === 0) { a = at(i, j, 1); b = at(i, j - 1, 1); c = at(i + 1, j, 1); }
      else { a = at(i, j, 0); b = at(i - 1, j, 0); c = at(i, j + 1, 0); }
      this.nbr[t * 3] = a; this.nbr[t * 3 + 1] = b; this.nbr[t * 3 + 2] = c;
    }
    // 顶点 → 相邻三角形（算顶点的 φ 用）
    this.vertKey = new Map();
    for (let t = 0; t < this.n; t++) {
      for (const v of tris[t].v) {
        const k = v[0] * 10007 + v[1];
        if (!this.vertKey.has(k)) this.vertKey.set(k, []);
        this.vertKey.get(k).push(t);
      }
    }
  }

  /** (x,y) 落在哪个三角形；不在域内返回 -1。 */
  locate(x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    const cell = j * this.w + i;
    // 对角线 TL→BR：在直线 y-j = x-i 上方的是 B（下左半），下方是 A
    const half = (y - j) > (x - i) ? 1 : 0;
    const t = this.triOfCell[cell * 2 + half];
    if (t >= 0) return t;
    const other = this.triOfCell[cell * 2 + (1 - half)];
    return other;
  }

  /** Dijkstra：多个目标，返回每个三角形到最近目标的代价。 */
  dijkstra(goals) {
    const INF = 1e9;
    // ★ 必须 Float64。第一版用了 Float32Array：代价存进去被舍入到 ~1e-7 精度，
    //   而 pop 时的"陈旧项"判据是 d > dist[v] + 1e-9 —— 1e-9 比 float32 的舍入误差
    //   小两个数量级，于是**一半节点被当成陈旧项直接丢掉**，Dijkstra 只走了 26 个
    //   三角形就没了（表现为"目标点孤岛"，实测 26/12342）。这坑很隐蔽：邻接图是
    //   连通的（BFS 能走满 12342），只有 Dijkstra 挂。
    const dist = new Float64Array(this.n).fill(INF);
    // 手写二叉堆：三角形数量级 1e3，比 Array.sort 每次重排靠谱
    const heap = [];
    const push = (d, v) => {
      heap.push([d, v]);
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
        while (true) {
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
    const goalSet = new Set(goals);
    for (const g of goals) { if (g >= 0 && g < this.n) { dist[g] = 0; push(0, g); } }
    while (heap.length) {
      const [d, v] = pop();
      if (d > dist[v] + 1e-9) continue;
      for (let k = 0; k < 3; k++) {
        const u = this.nbr[v * 3 + k];
        if (u < 0) continue;
        // 代价 = 两个重心之间的距离（等距三角形就是 1 或 0.7071）
        const w = Math.hypot(this.cent[u][0] - this.cent[v][0], this.cent[u][1] - this.cent[v][1]);
        const nd = d + w;
        if (nd < dist[u] - 1e-9) { dist[u] = nd; push(nd, u); }
      }
    }
    this.goals = goalSet;
    return dist;
  }

  /**
   * 拉普拉斯平滑。λ 太小没效果，太大会把代价场抹平到看不出目标在哪。
   * 边界上只对**存在的邻居**取平均，所以墙不会把 φ 往域外拉。
   */
  smooth(dist, { iters = 40, lambda = 0.5, pinGoals = true } = {}) {
    let phi = Float64Array.from(dist);
    const next = new Float64Array(this.n);
    const pinned = new Uint8Array(this.n);
    if (pinGoals) for (const g of this.goals) if (g >= 0 && g < this.n) pinned[g] = 1;
    for (let it = 0; it < iters; it++) {
      for (let t = 0; t < this.n; t++) {
        if (pinned[t]) { next[t] = phi[t]; continue; }
        let sum = 0, cnt = 0;
        for (let k = 0; k < 3; k++) {
          const u = this.nbr[t * 3 + k];
          if (u < 0) continue;
          sum += phi[u]; cnt++;
        }
        next[t] = cnt ? (1 - lambda) * phi[t] + lambda * (sum / cnt) : phi[t];
      }
      phi.set(next);
    }
    return phi;
  }

  /** 顶点的 φ = 相邻三角形平均。 */
  vertexPhi(phi) {
    const out = new Float64Array(this.n * 3);
    for (let t = 0; t < this.n; t++) {
      for (let k = 0; k < 3; k++) {
        const v = this.tris[t].v[k];
        const key = v[0] * 10007 + v[1];
        const list = this.vertKey.get(key);
        let s = 0;
        for (const u of list) s += phi[u];
        out[t * 3 + k] = s / list.length;
      }
    }
    return out;
  }

  /**
   * 三角形内的梯度。-∇φ 就是"流体"版本的方向。
   * 分片线性插值的梯度是常量：∇φ = Σ φ_i ∇λ_i，∇λ_i = rot90ccw(v_{i+1}-v_{i+2}) / 2A。
   * 这条式子比"三个顶点值相减"稳，不会因为选错边而符号反掉。
   */
  gradAt(t, vphi) {
    const { v } = this.tris[t];
    const p0 = vphi[t * 3], p1 = vphi[t * 3 + 1], p2 = vphi[t * 3 + 2];
    const twoA = 2 * this.tris[t].area;
    const rot = (a, b) => [-b, a];              // 逆时针 90°
    const e0 = rot(v[2][0] - v[1][0], v[2][1] - v[1][1]);
    const e1 = rot(v[0][0] - v[2][0], v[0][1] - v[2][1]);
    const e2 = rot(v[1][0] - v[0][0], v[1][1] - v[0][1]);
    return [
      (p0 * e0[0] + p1 * e1[0] + p2 * e2[0]) / twoA,
      (p0 * e0[1] + p1 * e1[1] + p2 * e2[1]) / twoA,
    ];
  }
}

/**
 * 一张流场 = 一个目标。离散模式和流体模式都从同一份 Dijkstra 结果出发，
 * 这样 A/B 才是同一道题。
 */
export class FlowField {
  constructor(field, goals, { mode = 'fluid', iters = 40, lambda = 0.5 } = {}) {
    this.F = field; this.mode = mode;
    this.dist = field.dijkstra(goals);
    if (mode === 'fluid') {
      this.phi = field.smooth(this.dist, { iters, lambda });
      this.vphi = field.vertexPhi(this.phi);
    }
    // 离散方向：指向代价最小的邻居（逐三角形，跟片子里的箭头一致）
    this.dir = new Float32Array(field.n * 2);
    for (let t = 0; t < field.n; t++) {
      let best = -1, bd = this.dist[t];
      for (let k = 0; k < 3; k++) {
        const u = field.nbr[t * 3 + k];
        if (u < 0) continue;
        if (this.dist[u] < bd) { bd = this.dist[u]; best = u; }
      }
      if (best >= 0) {
        const dx = field.cent[best][0] - field.cent[t][0];
        const dy = field.cent[best][1] - field.cent[t][1];
        const L = Math.hypot(dx, dy) || 1;
        this.dir[t * 2] = dx / L; this.dir[t * 2 + 1] = dy / L;
      }
    }
  }

  /** 采样：返回单位方向。流体模式返回梯度反方向，离散模式返回逐三角形方向。 */
  sample(x, y) {
    const t = this.F.locate(x, y);
    if (t < 0) return null;
    if (this.mode === 'fluid') {
      const g = this.F.gradAt(t, this.vphi);
      const L = Math.hypot(g[0], g[1]);
      if (L < 1e-9) return [0, 0];
      return [-g[0] / L, -g[1] / L];
    }
    return [this.dir[t * 2], this.dir[t * 2 + 1]];
  }
}

/**
 * 沿流场走一遍。返回路径 + 三项指标：
 *   len  —— 路径长 / 直线距离（绕路比）
 *   curv —— 平均每单位长度的转角（弧度）。锯齿越厉害越大
 *   rev  —— 转角 > 100° 的次数（"往回折"），离散场在窄口最容易出这个
 */
export function walk(field, flow, start, { step = 0.12, maxSteps = 4000, stopDist = 2.0 } = {}) {
  let x = start[0], y = start[1];
  const goalT = flow.F.goals;
  let prev = null, len = 0, turn = 0, rev = 0, n = 0;
  const path = [[x, y]];
  for (let s = 0; s < maxSteps; s++) {
    const t = field.locate(x, y);
    if (t < 0) break;
    // ★ 停止判定要给**一环容差**。只认"目标那一个三角形"的话，走到目标隔壁的
    //   另一个半三角形就不算到达，于是绕着目标转满 4000 步：实测 200 条里有 10%
    //   中招（p90 绕路比 24.5，中位数才 1.1），看起来像"流体寻路会打圈"，
    //   其实是终止条件写窄了。用 flow.dist 判更稳 —— dist 本身就是到目标的代价。
    if (stopDist != null ? flow.dist[t] <= stopDist : goalT.has(t)) break;
    const v = flow.sample(x, y);
    if (!v) break;
    if (Math.hypot(v[0], v[1]) < 1e-6) break;
    if (prev) {
      const dot = Math.max(-1, Math.min(1, prev[0] * v[0] + prev[1] * v[1]));
      const a = Math.acos(dot);
      turn += a; n++;
      if (a > 100 * Math.PI / 180) rev++;
    }
    prev = v;
    const nx = x + v[0] * step, ny = y + v[1] * step;
    if (field.locate(nx, ny) < 0) break;      // 贴着墙，这一步不合法就停
    len += Math.hypot(nx - x, ny - y);
    x = nx; y = ny;
    path.push([x, y]);
  }
  const straight = Math.hypot(x - start[0], y - start[1]) || 1e-6;
  return { path, len, ratio: len / straight, curv: n ? turn / len : 0, rev, reach: path.length > 2 };
}

/**
 * 三组 × n 个士兵。每个士兵：流场给主方向 + 邻域排斥（局部散开）。
 * 原文强调的是"3 groups of 100"这个量级 —— 所以这里刻意不做全局避障/寻路，
 * 单位只查表 + O(k) 邻域，300 个单位每帧仍然是线性的。
 */
export class Crowd {
  /**
   * ⚠ 单位坑：这整套坐标都是**格子**单位（x∈[0,W]，y∈[0,H]），不是 0~1。
   *   第一版生成点写成 (0.14,0.20) 这种归一化值，300 个士兵全叠在原点那一格里，
   *   一开局 sample() 就返回 null（不在域内）→ 全部判成 done，arrived 直接 0。
   *   所以生成点在这里乘回 W/H，速度也按"格/秒"给（不是"格/帧"）。
   */
  constructor(field, flows, { groups = 3, per = 100, seed = 1, radius = 0.7 } = {}) {
    this.F = field; this.flows = flows;
    this.radius = radius;
    this.agents = [];
    let r = (seed * 9301 + 49297) % 233280;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    // 三组从三块空地出发（归一化给出，乘 W/H 换成格坐标）
    const spawns = [[0.14, 0.18], [0.86, 0.44], [0.32, 0.78]];
    const W = field.w, H = field.h;
    for (let g = 0; g < groups; g++) {
      const sp = spawns[g % spawns.length];
      for (let k = 0; k < per; k++) {
        let x = 0, y = 0, tries = 0;
        do {
          const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 4.5;
          x = sp[0] * W + Math.cos(ang) * rr;
          y = sp[1] * H + Math.sin(ang) * rr;
        } while (field.locate(x, y) < 0 && ++tries < 60);
        this.agents.push({ g, x, y, vx: 0, vy: 0, done: false, t: 0 });
      }
    }
    this.t = 0; this.arrived = 0; this.minSep = 1e9;
    this.grid = new Map();
    this.realMs = 0;
  }

  /** 均匀网格分桶。sepR 当格边长，查邻域只看 3×3 —— 把 O(n²) 降到近似线性。 */
  rebuildGrid() {
    const g = this.grid; g.clear();
    const cs = this.radius * 2;
    this.cellSize = cs;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      // 到达的单位留在桶里：它们还占地方，活着的要从它们旁边绕（否则终点会叠成一坨）
      const k = ((a.x / cs) | 0) * 73856093 ^ ((a.y / cs) | 0) * 19349663;
      let bucket = g.get(k);
      if (!bucket) { bucket = []; g.set(k, bucket); }
      bucket.push(i);
    }
  }

  step(dt = 1 / 60) {
    const t0 = performance.now();
    const speed = 14;                      // 格/秒
    const sepR = this.radius * 2.2;
    const A = this.agents;
    this.rebuildGrid();
    const cs = this.cellSize;
    for (const a of A) {
      if (a.done) {
        // 到了也不能定死：只做"把邻居推开"这一件事，否则终点会叠成一坨（实测最小间距 0.01）
        let dx2 = 0, dy2 = 0;
        const ci2 = (a.x / cs) | 0, cj2 = (a.y / cs) | 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const bucket = this.grid.get((ci2 + di) * 73856093 ^ (cj2 + dj) * 19349663);
          if (!bucket) continue;
          for (const bi of bucket) {
            const b = A[bi];
            if (b === a) continue;
            const ddx = a.x - b.x, ddy = a.y - b.y;
            const dd2 = ddx * ddx + ddy * ddy;
            if (dd2 > sepR * sepR || dd2 < 1e-9) continue;
            const dd = Math.sqrt(dd2);
            dx2 += ddx / dd * (1 - dd / sepR);
            dy2 += ddy / dd * (1 - dd / sepR);
          }
        }
        const nx2 = a.x + dx2 * speed * 0.02, ny2 = a.y + dy2 * speed * 0.02;
        if (this.F.locate(nx2, ny2) >= 0) { a.x = nx2; a.y = ny2; }
        continue;
      }
      const flow = this.flows[a.g % this.flows.length];
      // ⚠ 别把"采样失败"当成"到达"。第一版这么写：被挤到域外的单位直接判 done，
      //   于是 300 个里只有 8 个真的走到目标，其余全卡在出生点外围当尸体。
      const v = flow.sample(a.x, a.y);
      if (!v) { a.x = a.px ?? a.x; a.y = a.py ?? a.y; a.vx *= 0.2; a.vy *= 0.2; continue; }
      // 排斥：只查自己所在格 + 周围 8 格
      let sx = 0, sy = 0;
      const ci = (a.x / cs) | 0, cj = (a.y / cs) | 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const k = (ci + di) * 73856093 ^ (cj + dj) * 19349663;
        const bucket = this.grid.get(k);
        if (!bucket) continue;
        for (const bi of bucket) {
          const b = A[bi];
          if (b === a) continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > sepR * sepR || d2 < 1e-9) continue;
          const d = Math.sqrt(d2);
          sx += dx / d * (1 - d / sepR);
          sy += dy / d * (1 - d / sepR);
        }
      }
      // ★ 排斥必须**归一化**。第一版直接线性相加：一个单位周围挤着二三十个邻居，
      //   sx 能到 15，速度瞬间变 200 格/秒，一步撞穿墙，然后 300 个人全贴着墙抖，
      //   90 秒里只有 8 个到了终点。改成"合推力先归一到 ≤1，再按权重叠加"，
      //   行为才回到片子里的样子：团会拉长、会沿墙滑，但整体是往目标走的。
      const sl = Math.hypot(sx, sy);
      if (sl > 1) { sx /= sl; sy /= sl; }
      const tvx = v[0] * speed + sx * speed * 0.85;
      const tvy = v[1] * speed + sy * speed * 0.85;
      a.vx += (tvx - a.vx) * 0.35;
      a.vy += (tvy - a.vy) * 0.35;
      const vl = Math.hypot(a.vx, a.vy), vmax = speed * 1.6;
      if (vl > vmax) { a.vx *= vmax / vl; a.vy *= vmax / vl; }
      const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
      if (this.F.locate(nx, ny) >= 0) { a.x = nx; a.y = ny; }
      else {
        // 贴墙：只走合法的那一轴，别硬顶，否则会卡在凹角（片子里士兵是沿墙滑的）
        if (this.F.locate(nx, a.y) >= 0) a.x = nx;
        else if (this.F.locate(a.x, ny) >= 0) a.y = ny;
        a.vx *= 0.4; a.vy *= 0.4;
      }
      if (this.F.locate(a.x, a.y) >= 0) { a.px = a.x; a.py = a.y; }
      a.t += dt;
      // 到达判定要留**一环容差**（dist ≤ 2 ≈ 相邻一个三角形），不能只认目标那一个三角形：
      // 单位会一直在目标三角形和邻居之间抖，永远锁不上，表现为"人都站在终点上却没算到达"。
      const t = this.F.locate(a.x, a.y);
      if (t >= 0 && flow.dist[t] <= 2.0) { a.done = true; this.arrived++; }
    }
    this.t += dt;
    // 最小间距抽样统计（每 7 个取一个，避免 O(n²) 全算）
    let mn = 1e9;
    for (let i = 0; i < A.length; i += 7) {
      for (let j = i + 1; j < A.length; j += 7) {
        const d = Math.hypot(A[i].x - A[j].x, A[i].y - A[j].y);
        if (d < mn) mn = d;
      }
    }
    if (mn < this.minSep) this.minSep = mn;
    this.realMs += performance.now() - t0;
    return this.arrived;
  }
}
