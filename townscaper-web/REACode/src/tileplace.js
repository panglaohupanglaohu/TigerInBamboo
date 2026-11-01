/**
 * tileplace.js — 内容无关的约束式铺砖（"Sudoku-solver on steroids"）。
 *
 * 来源三条（2016-10，Bad North 早期原型期）：
 *
 *   784847588893814785 —— "Content-agnostic algorithm for placing tiles. Heavily
 *     based on the work of @ExUtumno . Basically a Sudoku-solver on steroids."
 *   784847933686575104 —— "Currently built for triangular tiles, but would work for
 *     squares or voxels too"
 *   787319655648100352 —— "More procedural tile placement. Now in 3D. Algorithm
 *     inspired by the work of @ExUtumno"
 *   797844857821732864 —— "@ExUtumno, I came up with an unrelated optimization where
 *     I actually use bitmasks less. Maybe 20 ~30% faster."
 *
 * ---- 画面观察（每片 24 帧总览 + 单帧） ----
 *
 * 784847588893814785（蓝底）：一团灰白石块在 ~4.3s 里长满。0.5s 只有三五个块，
 *   1.7s 变成一条弯曲的脊，2.4s 已经是一个**带洞的闭合团**，右侧凸出一个环形塔。
 *   关键：**块是一次一个蹦出来的，不是整片同时出现**；而且从头到尾形状/朝向没变
 *   —— 说明"要填哪些格"是事先定好的，动画只是把**求解顺序**放慢演出来。
 *   形状是不规则的有机团，不是矩形 —— 这跟"随机挑最少候选的格"是一致的：
 *   约束最紧的地方先崩解，视觉上就像从角落往外啃。
 *
 * 784847933686575104（紫底）：同一团东西的另一机位（更侧）。亮度更平，能看出
 *   表面是**小块拼接**而不是一整块 —— 每块有自己的窄边框（几何缝隙），
 *   这就是"tile"而不是"mesh"的证据。
 *
 * 787319655648100352（深色等距台面）：**3D 版**。0.2s 台面上只有一块；1.8s 长成
 *   一条有高低起伏的墙；3.6s 出现第二层和一根细柱；5.2s 是一个带院子的多层宅子。
 *   ★ 有一块**悬空**的方块在左上方缓慢平移（全程 8 帧都在原位附近）—— 这不是 bug，
 *   是"候选块"的可视化：它还没被约束钉死，所以在空中飘。落地/落位那一刻它才变实。
 *   这条直接决定了我在代码里要**记录候选数**，而不只是记录结果。
 *
 * 797844857821732864（暗紫底 + 背景幽灵网格）：★ 这是"少用位掩码"那条的片子。
 *   背景整片是**半透明的候选块幽灵**（能看到网格状排布），前景是慢慢实体化的结构。
 *   所以"少用位掩码"不是纯性能话题：**它同时是可视化话题** —— 用标签计数代替
 *   逐 tile 的位掩码，才能便宜地拿到"这个方向的某个标签还剩几个"这种信息去画幽灵。
 *   5.4s 收尾时结构是一栋有楼板/立柱/屋顶的多层房子，跟 787 那片同源。
 *
 * ---- 原文说了什么 → 为什么这样写 ----
 *
 * 1) "content-agnostic"：算法里**不能出现**"墙/门/屋顶"这种词。所以 tile 只是一组
 *    朝向标签 `faces[d]`，两个格能不能相邻只看标签能不能接上（相等，或在允许的
 *    配对表里）。想看"内容无关"是否真成立，最硬的检验是**同一份求解器换一套 tile
 *    集跑出完全不同风格的东西**，demo 里给了两套（fort / ruin）。
 *
 * 2) "would work for squares or voxels too"：把"邻居/朝向/对向"抽成 Lattice 适配器。
 *    三角格 3 个朝向、方阵 4 个、体素 6 个，求解器一行都不用改。这不是为了好看，
 *    是因为**约束传播只依赖"格 × 朝向"的邻接关系**，跟格的几何形状无关。
 *
 * 3) "Sudoku-solver on steroids"：数独的解法就是"选候选最少的格子 → 试一个 →
 *    传播约束 → 撞墙就回溯"。这里一模一样，只是格子有 3~6 个朝向、每个候选是一个
 *    带标签的 tile。所以要**最小剩余值(MRV)选格 + 前向检查 + 回溯**三件套。
 *
 * 4) "Actually use bitmasks less, 20~30% faster"：位掩码的经典写法是维护每个格的
 *    候选位集，传播时对每个候选 tile 做 AND。它的问题不是慢在 AND 本身，而是
 *    **每传播一次都要把该方向所有候选 tile 扫一遍**去攒"对面允许什么"。
 *    换成**标签计数**：每个 (格, 朝向, 标签) 存一个数，格失去 tile 时把它的标签
 *    计数减掉；某个标签计数掉到 0，就只删对面那些带这个标签的 tile。
 *    ★ 免掉了位掩码那一整轮 OR 扫描，代价是多一张 L 倍的表。tile 越多、标签越少，
 *    省得越多 —— 这正好解释了 20~30% 这个量级。
 *    两种写法必须**求出一模一样的解**，demo 里会逐格比对，不是"差不多"。
 */

// ---------------------------------------------------------------- 格阵适配器

/**
 * 方阵：4 朝向。ring 是"绕竖轴转 90°"的循环序，用来给 tile 做旋转展开。
 */
export class SquareLattice {
  constructor(cols, rows) {
    this.type = 'square';
    this.cols = cols; this.rows = rows;
    this.nCells = cols * rows;
    this.nDirs = 4;
    this.ring = [0, 2, 1, 3];            // +x → +y → -x → -y
  }
  opp(d) { return d ^ 1; }
  cell(x, y) { return y * this.cols + x; }
  pos(c) { return [c % this.cols, Math.floor(c / this.cols), 0]; }
  nbr(c, d) {
    const x = c % this.cols, y = Math.floor(c / this.cols);
    const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
    const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
    if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) return -1;
    return this.cell(nx, ny);
  }
}

/**
 * 三角格：每个方格沿 TL→BR 对角线切成两个三角形，所以每个三角形恰好 3 个朝向，
 * 内部三角形严格 3 邻接（和片子里那层白色虚线三角网一致）。
 *
 * 朝向编号固定为 [0]=斜边(同格另一半), [1]="上/右"方向的外边, [2]="下/左"方向的外边。
 * 邻接关系是死算出来的（见下面构造里的 A/B 推导），没有任何几何搜索。
 */
export class TriLattice {
  constructor(cols, rows) {
    this.type = 'tri';
    this.cols = cols; this.rows = rows;
    this.nCells = cols * rows * 2;
    this.nDirs = 3;
    this.ring = [0, 1, 2];
  }
  opp(d) { return d; }   // 三角格：穿过去以后再穿回来落在同一个朝向上
  // A 型（上右半）= 2*idx，B 型（下左半）= 2*idx+1
  cell(x, y, half) { return (y * this.cols + x) * 2 + half; }
  pos(c) { const i = c >> 1; return [i % this.cols, Math.floor(i / this.cols), c & 1]; }
  nbr(c, d) {
    const half = c & 1;
    const i = c >> 1, x = i % this.cols, y = Math.floor(i / this.cols);
    const at = (xx, yy, hh) => {
      if (xx < 0 || yy < 0 || xx >= this.cols || yy >= this.rows) return -1;
      return this.cell(xx, yy, hh);
    };
    if (half === 0) {
      // A: 0=斜边 → 同格 B；1=上边 → 上格 B 的底边；2=右边 → 右格 B 的左边
      if (d === 0) return at(x, y, 1);
      if (d === 1) return at(x, y - 1, 1);
      return at(x + 1, y, 1);
    }
    // B: 0=斜边 → 同格 A；1=左边 → 左格 A 的右边；2=底边 → 下格 A 的上边
    if (d === 0) return at(x, y, 0);
    if (d === 1) return at(x - 1, y, 0);
    return at(x, y + 1, 0);
  }
}

/**
 * 体素：6 朝向。原文的"Now in 3D"就是这一档。
 * 注意 3D 不需要额外写"支撑"规则：空气朝下的面接不上实心朝上的面，
 * 标签匹配天然把悬空块排除了 —— 这是 content-agnostic 的直接红利。
 */
export class VoxelLattice {
  constructor(sx, sy, sz) {
    this.type = 'voxel';
    this.sx = sx; this.sy = sy; this.sz = sz;
    this.cols = sx;
    this.nCells = sx * sy * sz;
    this.nDirs = 6;
    this.ring = [0, 2, 1, 3];            // 绕 +z 转 90° 的四个侧面
    this.hasVertical = true;             // 4、5 是 ±z，旋转时不参与
  }
  opp(d) { return d ^ 1; }
  cell(x, y, z) { return (z * this.sy + y) * this.sx + x; }
  pos(c) {
    const x = c % this.sx, y = Math.floor(c / this.sx) % this.sy, z = Math.floor(c / (this.sx * this.sy));
    return [x, y, z];
  }
  nbr(c, d) {
    const [x, y, z] = this.pos(c);
    const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
    const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
    const nz = z + (d === 4 ? 1 : d === 5 ? -1 : 0);
    if (nx < 0 || ny < 0 || nz < 0 || nx >= this.sx || ny >= this.sy || nz >= this.sz) return -1;
    return this.cell(nx, ny, nz);
  }
}

// ---------------------------------------------------------------- tile 集

/**
 * 把 tile 的侧面按 ring 循环移位，生成旋转变体。
 * content-agnostic 的另一半：同一个"门在正面"的模块，转 90° 就是一个新 tile，
 * 求解器不用知道它们其实是兄弟。
 */
export function expandRotations(base, lattice, steps = 4) {
  const out = [];
  for (const t of base) {
    for (let k = 0; k < steps; k++) {
      const f = t.faces.slice();
      // 侧面按 ring 循环移 k 步；竖直方向（体素 4/5）不动
      const ring = lattice.ring;
      for (let i = 0; i < ring.length; i++) {
        f[ring[i]] = t.faces[ring[(i - k + ring.length * 4) % ring.length]];
      }
      out.push({ ...t, faces: f, rot: k, src: t.name });
    }
  }
  return out;
}

/**
 * 由标签配对表建 compat[dir][t1][t2]。
 * joins 里没写的组合一律不兼容 —— 这就是全部"知识"，没有别的规则。
 */
export function buildCompat(tiles, lattice, joins) {
  const D = lattice.nDirs, T = tiles.length;
  const ok = (a, b) => a === b || joins.has(a + '|' + b) || joins.has(b + '|' + a);
  const compat = [];
  for (let d = 0; d < D; d++) {
    const m = new Uint8Array(T * T);
    for (let i = 0; i < T; i++) {
      for (let j = 0; j < T; j++) {
        m[i * T + j] = ok(tiles[i].faces[d], tiles[j].faces[lattice.opp(d)]) ? 1 : 0;
      }
    }
    compat.push(m);
  }
  // 配套：按"标签"给 tile 分组，供 tally 传播器用
  const labels = new Map();
  const labelOf = [];
  for (let d = 0; d < D; d++) {
    labelOf.push([]);
    for (let t = 0; t < T; t++) {
      const l = tiles[t].faces[d];
      if (!labels.has(l)) labels.set(l, labels.size);
      labelOf[d].push(labels.get(l));
    }
  }
  return { compat, labelOf, nLabels: labels.size, labelName: [...labels.keys()] };
}

// ---------------------------------------------------------------- 求解器

const EMPTY = -1;

/**
 * Poset 求解器。strategy:
 *   'bitmask' —— 每个格一个候选位集，传播时按朝向把对面所有候选 OR 起来再 AND。
 *   'tally'   —— 每个 (格,朝向,标签) 一个计数，标签计数归零才去删对面带该标签的 tile。
 *
 * 两者语义必须等价（同一个约束闭包），所以 demoTab 会逐格对比结果。
 */
export class Placer {
  constructor(lattice, tiles, { joins = new Set(), strategy = 'tally', seed = 1, det = false } = {}) {
    this.L = lattice; this.tiles = tiles;
    this.T = tiles.length; this.D = lattice.nDirs;
    const { compat, labelOf, nLabels, labelName } = buildCompat(tiles, lattice, joins);
    this.compat = compat; this.labelOf = labelOf;
    this.nLabels = nLabels; this.labelName = labelName;
    this.strategy = strategy;
    // det=true：不做加权随机，按 tile 序号试。用于 A/B 严格等价测试 ——
    // 两种传播器的随机调用次数不同，随机模式下解一定会分叉，那样比"解是否相同"没意义。
    this.det = det;
    this.rng = mulberry32(seed);
    // supp[d][j] = 位集，第 i 位为 1 表示"i 在该朝向能接 j"。
    // ★ 这才是位掩码版的正统写法：判 j 能不能活，只看 supp[d][j] & mask[邻居] 非零，
    //   而不是先把所有候选 tile 的 compat 行 OR 起来再扫一遍。
    //   我第一版写成"OR 全攒"那种，量出来位掩码比标签计数慢 3 倍 —— 那是我写法的问题，
    //   不是算法的问题，拿那个数去比会冤枉位掩码。改成交集判定后才是同一个起跑线。
    this.maskWords = Math.ceil(this.T / 32);
    this.supp = [];
    for (let d = 0; d < this.D; d++) {
      const arr = [];
      for (let j = 0; j < this.T; j++) {
        const bits = new Uint32Array(this.maskWords);
        for (let i = 0; i < this.T; i++) {
          if (compat[d][i * this.T + j]) bits[i >>> 5] |= 1 << (i & 31);
        }
        arr.push(bits);
      }
      this.supp.push(arr);
    }
    // byLabel[d][l] = 该朝向上带标签 l 的 tile 列表。
    // ★ 这一层索引是"少用位掩码"能真的更快的前提，第一版没有它：每遇到一个归零标签
    //   就 for(t=0..T) 扫全表找同标签 tile，T=24 时白扫 5/6 的项，量出来反而比位掩码
    //   慢一倍多。改成按标签分桶后，传播的工作量正比于**真正被删掉的 tile 数**，
    //   而不是正比于 T × 朝向数 —— 这才是原文那句 20~30% 的来源。
    this.byLabel = [];
    for (let d = 0; d < this.D; d++) {
      const per = [];
      for (let l = 0; l < nLabels; l++) per.push([]);
      for (let t = 0; t < this.T; t++) per[labelOf[d][t]].push(t);
      this.byLabel.push(per);
    }
    this.steps = 0;
    this.prunes = 0;
    this.backtracks = 0;
    this.order = [];        // 求解顺序（给动画用）
    this.cands = [];        // 每步落子前的候选数（原文 787 那块"悬空块"的可视化依据）
    this.reset();
  }

  reset() {
    const n = this.L.nCells, T = this.T, D = this.D;
    this.allowed = new Uint8Array(n * T).fill(1);
    if (this.strategy === 'tally') {
      // cnt[(c*D + d)*nLabels + l] = 该格在该朝向上带标签 l 的候选数
      this.cnt = new Uint16Array(n * D * this.nLabels);
      for (let c = 0; c < n; c++) {
        for (let d = 0; d < D; d++) {
          const base = (c * D + d) * this.nLabels;
          for (let t = 0; t < T; t++) this.cnt[base + this.labelOf[d][t]]++;
        }
      }
      // 位掩码版才需要 scratch 缓冲，tally 版没有
    } else {
      this.maskWords = Math.ceil(T / 32);
      this.mask = new Uint32Array(n * this.maskWords);
      for (let c = 0; c < n; c++) {
        for (let t = 0; t < T; t++) this.mask[c * this.maskWords + (t >>> 5)] |= 1 << (t & 31);
      }
      // ★ 复用一块 acc 缓冲。第一版在循环里 new Uint32Array，位掩码版被 GC 拖成
      //   tally 的 3 倍慢 —— 那就不是"算法差异"而是"我写得烂"，对比失去意义。
      this.scratch = new Uint32Array(this.maskWords);
    }
    this.queue = [];
    this.inQueue = new Uint8Array(n);
    this.fixed = new Int16Array(n).fill(EMPTY);
    // ★ 增量 undo-log，替代整表快照。
    //   第一版 snapshot() 是 allowed/cnt/mask 的整份 slice：体素 1296 格时单层快照
    //   ~110KB，DFS 深 1296 层 → 上百 MB 分配，两种传播器都被拷贝开销淹没，量出来的
    //   "谁快谁慢"其实是"谁的表小"。改成只记录被删的 (格,tile) 之后，回溯代价正比于
    //   改动量，传播器的差异才浮出水面。
    this.trail = [];        // 被删掉的 c*T+t
    this.fixedTrail = [];   // 被钉住/被覆盖的格
    // 增量候选数。位掩码版数 popcount、tally 版扫一遍 T 都不贵，但它们在传播里被
    // 调用的次数是同一个数量级 —— 让两边都退化成 O(1)，比出来的才是算法差异。
    this.ncand = new Int16Array(n).fill(T);
  }

  count(c) { return this.ncand[c]; }

  candidates(c) {
    const out = [];
    if (this.strategy === 'bitmask') {
      const base = c * this.maskWords;
      for (let t = 0; t < this.T; t++) if (this.mask[base + (t >>> 5)] & (1 << (t & 31))) out.push(t);
    } else {
      const base = c * this.T;
      for (let t = 0; t < this.T; t++) if (this.allowed[base + t]) out.push(t);
    }
    return out;
  }

  /** 从格 c 的候选里删掉 tile t；tally 版顺手把标签计数减掉。 */
  remove(c, t) {
    if (this.strategy === 'bitmask') {
      const base = c * this.maskWords;
      if (!(this.mask[base + (t >>> 5)] & (1 << (t & 31)))) return false;
      this.mask[base + (t >>> 5)] &= ~(1 << (t & 31));
      this.prunes++; this.ncand[c]--; this.trail.push(c * this.T + t);
      return true;
    }
    const base = c * this.T;
    if (!this.allowed[base + t]) return false;
    this.allowed[base + t] = 0;
    this.prunes++; this.ncand[c]--; this.trail.push(c * this.T + t);
    const cbase = c * this.D * this.nLabels;
    for (let d = 0; d < this.D; d++) this.cnt[cbase + d * this.nLabels + this.labelOf[d][t]]--;
    return true;
  }

  /** 传播一格的变化。返回 false = 出现 0 候选（矛盾）。 */
  propagateFrom(startCells) {
    const D = this.D, L = this.L;
    const q = this.queue;
    q.length = 0;
    for (const c of startCells) { q.push(c); this.inQueue[c] = 1; }
    let head = 0;
    while (head < q.length) {
      const c = q[head++]; this.inQueue[c] = 0;
      this.steps++;
      if (this.strategy === 'bitmask') {
        // ---- 位掩码（正统写法）：对邻居的每个候选 j，检查 supp[d][j] 与本格掩码是否相交 ----
        for (let d = 0; d < D; d++) {
          const nb = L.nbr(c, d);
          if (nb < 0) continue;
          const words = this.maskWords;
          const obase = c * words, nbase = nb * words;
          let changed = false;
          for (let j = 0; j < this.T; j++) {
            if (!(this.mask[nbase + (j >>> 5)] & (1 << (j & 31)))) continue;
            const sj = this.supp[d][j];
            let alive = false;
            for (let w = 0; w < words; w++) {
              if (sj[w] & this.mask[obase + w]) { alive = true; break; }
            }
            if (!alive) { this.remove(nb, j); changed = true; }
          }
          if (changed) {
            if (this.ncand[nb] === 0) return false;
            if (!this.inQueue[nb]) { q.push(nb); this.inQueue[nb] = 1; }
          }
        }
      } else {
        // ---- 标签计数：只有"某标签在这个朝向上没支撑了"才去删对面 ----
        const cbase = c * D * this.nLabels;
        for (let d = 0; d < D; d++) {
          const nb = L.nbr(c, d);
          if (nb < 0) continue;
          const od = L.opp(d);
          let changed = false;
          for (let l = 0; l < this.nLabels; l++) {
            if (this.cnt[cbase + d * this.nLabels + l] !== 0) continue;
            // 标签 l 在本格本朝向已无候选 → 对面所有带 l 的 tile 出局（走分桶，不扫全表）
            for (const t of this.byLabel[od][l]) {
              if (this.allowed[nb * this.T + t]) { this.remove(nb, t); changed = true; }
            }
          }
          if (changed) {
            if (this.ncand[nb] === 0) return false;
            if (!this.inQueue[nb]) { q.push(nb); this.inQueue[nb] = 1; }
          }
        }
      }
    }
    return true;
  }

  snapshot() {
    return { tl: this.trail.length, fl: this.fixedTrail.length, pr: this.prunes };
  }

  /** 按 undo-log 倒着还原。O(改动量)，不碰没动过的格。 */
  restore(s) {
    const T = this.T;
    while (this.trail.length > s.tl) {
      const k = this.trail.pop();
      const c = (k / T) | 0, t = k - c * T;
      if (this.strategy === 'bitmask') {
        this.mask[c * this.maskWords + (t >>> 5)] |= 1 << (t & 31);
      } else {
        this.allowed[c * T + t] = 1;
        const cbase = c * this.D * this.nLabels;
        for (let d = 0; d < this.D; d++) this.cnt[cbase + d * this.nLabels + this.labelOf[d][t]]++;
      }
      this.ncand[c]++;
    }
    while (this.fixedTrail.length > s.fl) {
      const k = this.fixedTrail.pop();
      this.fixed[(k / 4096) | 0] = (k % 4096) - 1;   // 编码：格号*4096 + (原值+1)
    }
    this.prunes = s.pr;
    this.queue.length = 0;
    this.inQueue.fill(0);
  }

  /** 落子：把 c 钉成 t，其余候选删掉，再传播。返回 false = 当场矛盾。 */
  assign(c, t) {
    const cand = this.candidates(c);
    for (const u of cand) if (u !== t) this.remove(c, u);
    this.fixedTrail.push(c * 4096 + (this.fixed[c] + 1));  // 4096 > tile 数上限
    this.fixed[c] = t;
    if (this.ncand[c] === 0) return false;
    return this.propagateFrom([c]);
  }

  /**
   * MRV + 前向检查 + 回溯 —— "Sudoku-solver on steroids" 的直译。
   *
   * 为什么用递归而不是手攒栈：回溯要还原的东西有四张表（候选、计数、落子、剪枝数），
   * 手写栈第一版漏了 ncand，回溯后候选数没还原，于是"解出来"的格子里塞了本该被
   * 剪掉的 tile，还一路返回 true。递归里每层自己持有一份快照，不会漏。
   * 递归深度 = 格数（体素 384 格也吃得下）。
   */
  solve({ maxBacktracks = 20000 } = {}) {
    const n = this.L.nCells;
    this.order = []; this.cands = [];
    this.backtracks = 0;
    const all = [];
    for (let c = 0; c < n; c++) all.push(c);
    if (!this.propagateFrom(all)) return false;
    const ok = this._dfs(n, maxBacktracks);
    this.order.reverse(); this.cands.reverse();   // 递归是后序，反过来才是真正落子顺序
    return ok;
  }

  _dfs(n, maxBT) {
    // MRV：挑候选最少的格。随机起点只是为了同分时别总从左上角开啃 ——
    // 固定顺序会长出"推土机"式的矩形，而不是片子里那种从最紧处往里塌的有机团。
    let best = -1, bestN = 1e9;
    const start = this.det ? 0 : (this.rng() * n) | 0;
    for (let k = 0; k < n; k++) {
      const cc = (start + k) % n;
      if (this.fixed[cc] !== EMPTY) continue;
      const cn = this.ncand[cc];
      if (cn < bestN) { bestN = cn; best = cc; if (cn <= 1) break; }
    }
    if (best < 0) return true;      // 全部落定
    if (bestN === 0) return false;

    const cand = this.candidates(best);
    if (!cand.length) return false;
    // 加权随机顺序：weight 大的（实心/墙）先试，视觉上才像"先砌墙再挖洞"
    if (this.det) {
      for (const t of cand) {
        const snap = this.snapshot();
        if (this.assign(best, t) && this._dfs(n, maxBT)) {
          this.order.push(best); this.cands.push(cand.length);
          return true;
        }
        this.restore(snap);
        if (++this.backtracks > maxBT) return false;
      }
      return false;
    }
    const pool = cand.slice(), order = [];
    while (pool.length) {
      let tot = 0;
      for (const t of pool) tot += (this.tiles[t].weight ?? 1);
      let r = this.rng() * tot, pick = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        r -= (this.tiles[pool[i]].weight ?? 1);
        if (r <= 0) { pick = i; break; }
      }
      order.push(pool.splice(pick, 1)[0]);
    }

    for (const t of order) {
      const snap = this.snapshot();
      if (this.assign(best, t) && this._dfs(n, maxBT)) {
        this.order.push(best); this.cands.push(cand.length);
        return true;
      }
      this.restore(snap);
      if (++this.backtracks > maxBT) return false;
    }
    return false;
  }

  // ---------------------------------------------------------------- 修复

  /**
   * 把一格打回"什么都没定"。整格恢复成全集，计数同步重建。
   * ⚠ 这一步会跟 undo-log 打架：手工清格之后，之前记的 trail 条目对新状态已经不成立，
   *   所以 repair() 进来先把 trail 清空 —— 修复是"从头开始解这几个格"，不是回溯。
   */
  clearCell(c) {
    const T = this.T, D = this.D;
    if (this.fixed[c] !== EMPTY) this.fixed[c] = EMPTY;
    for (let t = 0; t < T; t++) {
      if (this.strategy === 'bitmask') this.mask[c * this.maskWords + (t >>> 5)] |= 1 << (t & 31);
      else this.allowed[c * T + t] = 1;
    }
    this.ncand[c] = T;
    if (this.strategy === 'tally') {
      const base = c * D * this.nLabels;
      this.cnt.fill(0, base, base + D * this.nLabels);
      for (let d = 0; d < D; d++) {
        for (let t = 0; t < T; t++) this.cnt[base + d * this.nLabels + this.labelOf[d][t]]++;
      }
    }
  }

  /**
   * 全局自洽检查：数一遍"相邻两格的标签对不上"的次数。0 = 合法。
   * 光看"每格都有一个 tile"是不够的 —— 修复完最容易出的错就是某格被留成
   * 一个跟邻居接不上的孤块，画面上一眼看不出，validate 一数就露。
   */
  validate() {
    const L = this.L, D = L.nDirs, T = this.T;
    let bad = 0;
    for (let c = 0; c < L.nCells; c++) {
      const tc = this.fixed[c];
      if (tc === EMPTY) { bad++; continue; }
      for (let d = 0; d < D; d++) {
        const nb = L.nbr(c, d);
        if (nb < 0) continue;
        const tn = this.fixed[nb];
        if (tn === EMPTY) { bad++; continue; }
        if (!this.compat[d][tc * T + tn]) bad++;
      }
    }
    return bad;
  }

  /**
   * 修复：把若干格打回未定，就地继续求解。
   *
   * 原文（793806535898136576，白管子迷宫那条）：
   *   "I gave it an extra difficult tileset to work with to make sure it can repair
   *    itself when it has screwed up"
   *
   * 画面里看得出来这就是"修"而不是"重解"：0.98s / 2.28s 两次塌成只剩台面上的桩，
   * 紧接着从塌掉的地方一圈一圈往外重新长回来，**没塌的部分一根管子都不动**。
   * 红色线框是目标骨架（哪格该有东西），黄色块是正在处理的格。
   *
   * 所以这里也做**局部**：只清掉被破坏的格，从它们开始传播，不碰别处。
   * 局部性的检验方式是"touched"—— 实际被重新落子的格数，远小于总格数就说明是修复不是重解。
   */
  repair(cells, { maxBacktracks = 20000 } = {}) {
    this.trail.length = 0; this.fixedTrail.length = 0;
    this.order = []; this.cands = [];
    const prunes0 = this.prunes, steps0 = this.steps;
    for (const c of cells) this.clearCell(c);
    if (!this.propagateFrom(cells)) return { ok: false, touched: 0, steps: 0, prunes: 0 };
    const ok = this._dfs(this.L.nCells, maxBacktracks);
    this.order.reverse(); this.cands.reverse();
    return { ok, touched: this.order.length, steps: this.steps - steps0, prunes: this.prunes - prunes0 };
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function popcount(x) {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
}
function ctz(x) { return 31 - Math.clz32(x & -x); }

// ---------------------------------------------------------------- tile 集

/**
 * 两套 tile 集，用来证明 content-agnostic：同一份求解器、同一个格阵，
 * 只换下面这两段数据，长出来的东西完全不一样。
 *
 * 标签含义（对求解器来说只是字符串）：
 *   A=空气  S=实心  W=墙  R=楼板/顶  D=门洞  G=地面
 * 配对表 joins 是唯一"知识"。
 */
// ★ 权重不是"美术参数"，它直接决定长出来是空壳还是实心团：
//   air 权重 5 / block 3 那版，体素跑出来是个**空心方盒**（四面墙 + 地板），
//   跟片子里那团有体积感的宅子完全不像。把实心几档抬上去才是片子的密度。
export const TILESET_FORT = {
  joins: new Set(['A|D', 'W|D']),        // 门洞可以贴空气，也可以贴墙
  base: [
    { name: 'air',   faces: ['A', 'A', 'A', 'A', 'A', 'A'], weight: 3 },
    { name: 'block', faces: ['S', 'S', 'S', 'S', 'S', 'S'], weight: 9 },
    { name: 'wall',  faces: ['W', 'W', 'W', 'W', 'R', 'S'], weight: 7 },
    { name: 'door',  faces: ['D', 'W', 'W', 'W', 'R', 'S'], weight: 1 },
    { name: 'floor', faces: ['W', 'W', 'W', 'W', 'R', 'A'], weight: 5 },
    { name: 'pillar',faces: ['W', 'W', 'W', 'W', 'S', 'S'], weight: 3 },
    // 下面两档是"制造起伏"的关键：全对称的 tile 集在纯 socket 约束下会收敛到
    // 一整块均匀实体（我第一版跑出来就是个实心方块）。要出现片子里那种窗户、
    // 挑檐、高低错落，tile 集里必须有**朝向不对称**的成员，约束才会局部打架，
    // 解才会长出结构。
    { name: 'window',faces: ['A', 'W', 'W', 'W', 'R', 'S'], weight: 2 },
    { name: 'ledge', faces: ['R', 'R', 'R', 'R', 'A', 'S'], weight: 1 },
  ],
};

export const TILESET_RUIN = {
  joins: new Set(['A|W', 'A|R']),
  base: [
    { name: 'air',   faces: ['A', 'A', 'A', 'A', 'A', 'A'], weight: 6 },
    { name: 'rubble',faces: ['R', 'R', 'R', 'R', 'R', 'S'], weight: 3 },
    { name: 'wall',  faces: ['W', 'W', 'W', 'W', 'A', 'S'], weight: 3 },
    { name: 'arch',  faces: ['A', 'W', 'W', 'W', 'A', 'S'], weight: 1 },
  ],
};

/**
 * 三角格专用的一套（3 个朝向）。同一份求解器换个格阵就换了一套 tile，
 * 这就是原文 "currently built for triangular tiles, but would work for squares
 * or voxels too" 里那句"currently"的全部含义。
 */
export const TILESET_TRI = {
  joins: new Set(['A|W', 'A|R']),
  base: [
    { name: 'air',  faces: ['A', 'A', 'A'], weight: 3 },
    { name: 'fill', faces: ['S', 'S', 'S'], weight: 9 },
    { name: 'edge', faces: ['W', 'W', 'A'], weight: 4 },
    { name: 'corn', faces: ['W', 'A', 'W'], weight: 2 },
  ],
};

/**
 * CONTENTS —— tile 名 → 该格"长什么样"的渲染描述。
 *
 * 原文（784848286272327680）："You can fill it with anything"。
 * 片子里同一套摆放跑出来的不是方块，而是一堆随意朝向的**胶囊**，最后拼成一条 C 形。
 * 这就是 content-agnostic 的另一半：**求解器只认识标签，不认识几何**。
 * 所以外面这张表跟求解器完全解耦 —— 换一套 CONTENTS 就换一种外观，
 * 求解器一行都不改，甚至连这个对象都不 import。
 */
export const CONTENTS = {
  box:    { shape: 'box',     palette: '#dfe3e2' },
  pipe:   { shape: 'pipe',    palette: '#e9ecec', tube: 0.34 },   // 白管子
  capsule:{ shape: 'capsule', palette: '#c6d2d8', length: 0.78 }, // 胶囊（片子里的"任何东西"）
  blob:   { shape: 'blob',    palette: '#d3d8d2', wobble: 0.18 },
};
