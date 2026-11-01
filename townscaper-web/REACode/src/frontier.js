/**
 * frontier.js — 只在"坍缩边缘"附近枚举可能的 tile，再把它们连成简化导航图。
 *
 * 原文（x.com/OskSta/status/1582293326815862786, 2022-10-18）：
 *
 *   "I thought it would be too expensive to properly evaluate each tile
 *    placement. But! While the number of possible tiles is indeed very large,
 *    it is actually quite small **around the collapsed edge**! Thus, my
 *    algorithm now tries to expand (and interconnect) a simplified nav graph."
 *
 * 画面观察（24 帧总览）：
 *   · 0.05s 只有零星几个点；0.6s 起冒出一条**黄线折线**，一节一节往外长；
 *   · 1.5~2.5s 出现**第二团绿线**（另一个种子/另一个区域），两团独立生长；
 *   · 黄线的节距不均匀：已经坍缩的平坦区是大跨步，靠近未坍缩边缘的节距很密
 *     —— 这就是"只在边缘枚举"在画面上的痕迹；
 *   · 4.6s 线停止生长，切到渲染相机（8.2s）看那座岛。
 *
 * 为什么"边缘附近很少"：一个格子可能的 tile 数，取决于它已经被坍缩的邻居要求
 * 什么。内部格子的四个邻居都定了 → 只剩 1 种；边缘格子有 1~2 个邻居定了 →
 * 几十种里剩几种；只有完全孤立（没有已坍缩邻居）才需要枚举整个 tile 集合。
 * 所以总代价 ≈ 边缘格数 × 每种边缘配置的候选数，而不是 格数 × 全集合。
 *
 * 我们把 tile 定义成"四条边各要什么高度"（edge-height tile，0..L-1）：
 *   · tile 总数 = L⁴（L=3 → 81 种；这和 WFC 的"排列数爆炸"是同一个量级问题）
 *   · 两条相邻 tile 能拼 ⇔ 共享边上要求的高度相同
 *   · 可走 ⇔ 中心高度差 ≤ 1（简化版的"能走上去"）
 *
 * 这样"候选数"就是可数的整数，不是估计值 —— 见 `measure()`。
 */

/** 生成 tile 集合：四条边（N/E/S/W）各要求一个高度。 */
export function makeTileSet(levels = 3) {
  const tiles = [];
  for (let n = 0; n < levels; n++) {
    for (let e = 0; e < levels; e++) {
      for (let s = 0; s < levels; s++) {
        for (let w = 0; w < levels; w++) {
          tiles.push({ id: tiles.length, n, e, s, w, h: Math.round((n + e + s + w) / 4) });
        }
      }
    }
  }
  return tiles;
}

// 边邻居的约定：0=E 1=N 2=W 3=S（和 src/grid.js 的 edgeNeighbors 同序）
const OPPOSITE = [2, 3, 0, 1];

/**
 * 从一个种子格开始，按"最小熵优先"坍缩，每一步只枚举**边缘格**的候选。
 *
 * @param {object} grid  {cells: [{id, edgeNeighbors:[4], cx, cz}]}
 * @param {(cell)=>number} top 高度查询（只读）
 * @param {object} opts
 * @returns {{order:number[], candidates:Map<number,number>, edges:Array, stats:object}}
 */
export function expandFrontier(grid, top, {
  levels = 3,
  seeds = [0],
  tileSet = makeTileSet(levels),
  walkStep = 1,
  maxCells = Infinity,
  // 已被别的区域占掉的格子：不进入、也不穿越（原片里黄绿两团是分开的）
  blocked = null,
  // 'tree' = 只有生长树 + 少量同高捷径；'lattice' = 每个同高邻居都连（格子图，不简化）
  edgeMode = 'tree',
} = {}) {
  const cells = grid.cells;
  const n = cells.length;
  const assigned = new Int32Array(n).fill(-1);   // 每格坍缩成哪个 tile
  const inFrontier = new Uint8Array(n);
  const order = [];
  const candidates = new Map();                  // cellId -> 候选数（坍缩那一刻）
  const edges = [];
  const parentOf = new Int32Array(n).fill(-1);
  const hash2 = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;

  // 候选计算：只看**已坍缩**的邻居给的约束
  const neighbours = (c, dir) => {
    const id = c.edgeNeighbors[dir];
    return id >= 0 ? cells[id] : null;
  };

  function candidateTiles(c) {
    const req = [null, null, null, null];
    for (let d = 0; d < 4; d++) {
      const nb = neighbours(c, d);
      if (!nb) continue;
      const t = assigned[nb.id];
      if (t < 0) continue;
      // 邻居的"对面那条边"的要求 = 我这条边的要求
      const nt = tileSet[t];
      req[d] = [nt.e, nt.n, nt.w, nt.s][OPPOSITE[d]];
    }
    const out = [];
    for (const t of tileSet) {
      if (req[0] !== null && t.e !== req[0]) continue;
      if (req[1] !== null && t.n !== req[1]) continue;
      if (req[2] !== null && t.w !== req[2]) continue;
      if (req[3] !== null && t.s !== req[3]) continue;
      out.push(t.id);
    }
    return out;
  }

  /** 朴素做法：不管邻居怎么定，每个格子都枚举整个 tile 集合。 */
  function naiveCount() {
    return tileSet.length;
  }

  // 种子：按当地高度挑一个"四条边都等于它"的 tile，保证一开始就自洽
  for (const s of seeds) {
    if (s < 0 || s >= n) continue;
    if (blocked && blocked[s]) continue;
    const h = Math.min(levels - 1, Math.max(0, top(cells[s])));
    const pick = tileSet.find((t) => t.n === h && t.e === h && t.s === h && t.w === h);
    assigned[s] = pick ? pick.id : 0;
    order.push(s);
    candidates.set(s, 1);
    for (let d = 0; d < 4; d++) {
      const nb = neighbours(cells[s], d);
      if (nb && assigned[nb.id] < 0 && !(blocked && blocked[nb.id])) inFrontier[nb.id] = 1;
    }
  }

  let frontierSize = 0;
  for (let i = 0; i < n; i++) if (inFrontier[i]) frontierSize++;

  while (order.length < maxCells) {
    // 最小熵：先处理候选最少的边缘格（WFC 的标准做法）
    let best = -1;
    let bestCount = Infinity;
    let bestCands = null;
    for (let i = 0; i < n; i++) {
      if (!inFrontier[i]) continue;
      if (blocked && blocked[i]) { inFrontier[i] = 0; continue; }
      const cands = candidateTiles(cells[i]);
      if (cands.length === 0) { inFrontier[i] = 0; continue; }
      if (cands.length < bestCount) {
        bestCount = cands.length;
        best = i;
        bestCands = cands;
        if (bestCount === 1) break;
      }
    }
    if (best < 0) break;

    // 选一个和地形高度最接近的候选（这就是"按地形约束坍缩"）
    const wantH = Math.min(levels - 1, Math.max(0, top(cells[best])));
    let pickId = bestCands[0];
    let bestErr = Infinity;
    for (const id of bestCands) {
      const err = Math.abs(tileSet[id].h - wantH);
      if (err < bestErr) { bestErr = err; pickId = id; }
    }

    assigned[best] = pickId;
    inFrontier[best] = 0;
    order.push(best);
    candidates.set(best, bestCands.length);

    // 连边 + 把未坍缩邻居推进边缘
    for (let d = 0; d < 4; d++) {
      const nb = neighbours(cells[best], d);
      if (!nb) continue;
      if (assigned[nb.id] >= 0) {
        if (Math.abs(top(cells[best]) - top(nb)) > walkStep) continue;
        if (edgeMode === 'tree') {
          // 简化图：只留"生长树"的边（父边），外加少量同高捷径。
          // 全连就是格子图本身，那等于没简化 —— 原片里的黄线是树状带少量交叉的。
          const isParent = parentOf[best] === nb.id || parentOf[nb.id] === best;
          if (isParent) edges.push([best, nb.id, 1]);
          else if (top(cells[best]) === top(nb) && hash2(best, nb.id) % 3 === 0) edges.push([best, nb.id, 1]);
        } else {
          edges.push([best, nb.id, 1]);
        }
      } else if (!(blocked && blocked[nb.id])) {
        if (parentOf[nb.id] < 0) parentOf[nb.id] = best;
        inFrontier[nb.id] = 1;
      }
    }
  }

  let totalCands = 0;
  for (const [, c] of candidates) totalCands += c;
  const collapsed = order.length;
  const stats = {
    collapsed,
    seeds: seeds.length,
    tileSpace: tileSet.length,
    // 平均候选数：这就是"边缘附近其实很小"的量化
    meanCandidates: collapsed ? +(totalCands / collapsed).toFixed(2) : 0,
    maxCandidates: collapsed ? Math.max(...candidates.values()) : 0,
    naiveTotal: collapsed * naiveCount(),
    evaluatedTotal: totalCands,
    saving: +(1 - totalCands / Math.max(1, collapsed * naiveCount())).toFixed(4),
    edges: edges.length,
  };
  return { order, candidates, edges, assigned, parentOf, stats };
}

/**
 * 单独量化"边缘格的候选数"与"内部格"的差别，用来支撑原文那句
 * "quite small around the collapsed edge"。
 */
export function measureCandidateCounts(grid, top, { levels = 3, sample = 400, tileSet = makeTileSet(levels) } = {}) {
  const cells = grid.cells;
  const n = cells.length;
  // 用真实地形高度当"已坍缩"的参照：邻居四边高度 = 邻居自己的高度
  const hOf = (c) => Math.min(levels - 1, Math.max(0, top(c)));
  let edgeSum = 0, edgeN = 0, interiorSum = 0, interiorN = 0;
  const step = Math.max(1, Math.floor(n / sample));
  for (let i = 0; i < n; i += step) {
    const c = cells[i];
    const req = [];
    let collapsedNb = 0;
    for (let d = 0; d < 4; d++) {
      const id = c.edgeNeighbors[d];
      if (id < 0) { req.push(null); continue; }
      req.push(hOf(cells[id]));
      collapsedNb++;
    }
    let count = 0;
    for (const t of tileSet) {
      if (req[0] !== null && t.e !== req[0]) continue;
      if (req[1] !== null && t.n !== req[1]) continue;
      if (req[2] !== null && t.w !== req[2]) continue;
      if (req[3] !== null && t.s !== req[3]) continue;
      count++;
    }
    if (collapsedNb < 4) { edgeSum += count; edgeN++; }
    else { interiorSum += count; interiorN++; }
  }
  return {
    tileSpace: tileSet.length,
    edgeMean: edgeN ? +(edgeSum / edgeN).toFixed(2) : 0,
    edgeCells: edgeN,
    interiorMean: interiorN ? +(interiorSum / interiorN).toFixed(2) : 0,
    interiorCells: interiorN,
  };
}
