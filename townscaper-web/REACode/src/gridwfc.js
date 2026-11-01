/**
 * gridwfc.js — 在 Townscaper 那种"不规则四边形网格"上跑 WFC，并且**做成确定性的**。
 *
 * 1164926304640229376  "WFC running at interactive speed on that funky grid.
 *   Next up is to make it deterministic"
 *
 * ---- 这条为什么值得单独做 ----
 * 原文只有两句话，但第二句是**工程约束**，不是美术：交互式 WFC 一旦不确定，
 * "撤销 / 重放 / 存档"全都对不上 —— 同一个格子点两次会长出不同的东西。
 * 确定性的难点不在随机数（那好办），而在于**求解顺序**：熵最小的格子如果有并列，
 * 按"遍历顺序"取第一个就会把实现细节（数组顺序、哈希插入序）泄进结果里。
 *
 * 这个文件的确定性来自三条，缺一不可：
 *   1. 随机数由 `(seed, cellId, 决策序号)` 三元组算出来，跟"第几个被访问"无关；
 *   2. 熵并列时按 **cellId 最小** 取（不是按数组下标、不是按队列顺序）；
 *   3. 传播用"按 cellId 排序的优先队列"，不用 `Set`/`Map` 的插入序。
 * 于是"倒着遍历 / 换个容器 / 换个浏览器"都得到同一张图 —— 这是可以实测的。
 *
 * 网格用调用方给的不规则四边形（`buildQuadGrid`），这里只认 `edgeNeighbors`。
 */

function hash3(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * 一套"边长字"的 tile：每个 tile 四条边各有一个接口号，相邻两格的接口号必须相等。
 * 这是 WFC 最土的写法（socket / marching），够用来量速度与确定性。
 */
export const TILES = [
  { name: 'grass', edges: [0, 0, 0, 0] },
  { name: 'grassRock', edges: [0, 1, 0, 1] },
  { name: 'rock', edges: [1, 1, 1, 1] },
  { name: 'grassPath', edges: [0, 2, 0, 2] },
  { name: 'pathCross', edges: [2, 2, 2, 2] },
  { name: 'pathEnd', edges: [2, 0, 0, 0] },
  { name: 'sand', edges: [3, 0, 3, 0] },
  { name: 'sandRock', edges: [3, 3, 1, 1] },
];

/** 两接口能不能接上。0 是草、1 岩、2 路、3 沙；同号才接，另加两条"过渡允许"。 */
function socketOk(a, b) {
  if (a === b) return true;
  // 草可以挨着路和沙（边缘柔和一点），但不能直接挨着岩（要有一圈过渡）
  if ((a === 0 && (b === 2 || b === 3)) || (b === 0 && (a === 2 || a === 3))) return true;
  return false;
}

/**
 * 解一张网格。
 *
 * @param grid `buildQuadGrid()` 的返回值（只用到 cells[].edgeNeighbors / id）
 * @param opts.seed      随机种子（同一 seed + 同一网格 = 同一结果）
 * @param opts.order     'forward' | 'reverse' —— 只影响遍历顺序，**不应该**影响结果
 * @param opts.tiles     可选，替换 tile 集
 */
export function solve(grid, { seed = 1, order = 'forward', tiles = TILES, maxSteps = 4e6 } = {}) {
  const t0 = performance.now();
  const cells = grid.cells;
  const n = cells.length;
  const BITS = (1 << tiles.length) - 1;
  const dom = new Uint16Array(n).fill(BITS);
  // 边上的格子：把外边锁成草/沙（网格外是海，不能让岩石长到边界外面去）
  for (const c of cells) {
    const nbr = c.edgeNeighbors;
    for (let i = 0; i < nbr.length; i++) {
      if (nbr[i] < 0) {
        let m = 0;
        for (let t = 0; t < tiles.length; t++) if (tiles[t].edges[i] === 0) m |= 1 << t;
        dom[c.id] &= m || BITS;
      }
    }
  }

  let steps = 0;
  let decisions = 0;
  let propagations = 0;
  let backtracks = 0;
  let contradictions = 0;

  const trail = [];
  const orderIdx = (i) => (order === 'reverse' ? n - 1 - i : i);

  /** 把 i 的域收缩到 m；返回是否引起矛盾。 */
  const narrow = (i, m) => {
    const before = dom[i];
    const after = before & m;
    if (after === before) return false;
    trail.push([i, before]);
    dom[i] = after;
    return after === 0;
  };

  /** 从 i 出发传播到稳定：每一步都把"当前域支持哪些接口"算出来，再反推邻居。 */
  const propagate = (i) => {
    const stack = [i];
    while (stack.length) {
      // 按 cellId 排序：容器顺序不进结果（确定性第 3 条）
      stack.sort((a, b) => a - b);
      const cur = stack.shift();
      propagations++;
      if (++steps > maxSteps) return false;
      const nbr = cells[cur].edgeNeighbors;
      for (let e = 0; e < nbr.length; e++) {
        const j = nbr[e];
        if (j < 0) continue;
        let m = 0;
        for (let t = 0; t < tiles.length; t++) {
          if (!(dom[j] & (1 << t))) continue;
          // j 的第 t 个 tile 是否还有"某个 cur 的 tile"能对上
          for (let s = 0; s < tiles.length; s++) {
            if (!(dom[cur] & (1 << s))) continue;
            if (socketOk(tiles[s].edges[e], tiles[t].edges[(e + 2) % 4])) { m |= 1 << t; break; }
          }
        }
        if (m === 0) { contradictions++; return false; }
        const before = dom[j];
        if (narrow(j, m)) return false;
        if (dom[j] !== before) stack.push(j);
      }
    }
    return true;
  };

  /** 选下一个要坍缩的格子：熵最小；并列取 cellId 最小（确定性第 2 条）。 */
  const pick = () => {
    let best = -1;
    let bestCount = 99;
    for (let k = 0; k < n; k++) {
      const i = orderIdx(k);
      const c = popcount(dom[i]);
      if (c > 1 && c < bestCount) { bestCount = c; best = i; }
      else if (c > 1 && c === bestCount && i < best) { best = i; }
    }
    return best;
  };

  const solveRec = (depth) => {
    if (depth > 4000) return false;
    const i = pick();
    if (i < 0) return true; // 全部单值 → 解出来了
    decisions++;
    const options = [];
    for (let t = 0; t < tiles.length; t++) if (dom[i] & (1 << t)) options.push(t);
    // 顺序也由 hash 决定（确定性第 1 条：随机数只依赖 seed/cellId/决策序号）
    const r = hash3(seed, i, decisions);
    const rot = Math.floor(r * options.length);
    const ordered = options.slice(rot).concat(options.slice(0, rot));
    for (const t of ordered) {
      const mark = trail.length;
      const before = dom[i];
      if (narrow(i, 1 << t) || !propagate(i)) {
        while (trail.length > mark) { const [k, d] = trail.pop(); dom[k] = d; }
        backtracks++;
        continue;
      }
      if (solveRec(depth + 1)) return true;
      while (trail.length > mark) { const [k, d] = trail.pop(); dom[k] = d; }
      backtracks++;
    }
    dom[i] = before;
    return false;
  };

  const ok = solveRec(0);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = ok ? lowestBit(dom[i]) : 255;

  // 自检：解出来的相邻接口是否真的一致（不靠"求解器说它对"）
  let mismatches = 0;
  if (ok) {
    for (const c of cells) {
      const nbr = c.edgeNeighbors;
      for (let e = 0; e < nbr.length; e++) {
        const j = nbr[e];
        if (j < 0 || c.id > j) continue;
        if (!socketOk(tiles[out[c.id]].edges[e], tiles[out[j]].edges[(e + 2) % 4])) mismatches++;
      }
    }
  }

  const counts = {};
  for (let i = 0; i < n; i++) if (out[i] !== 255) counts[tiles[out[i]].name] = (counts[tiles[out[i]].name] || 0) + 1;

  return {
    ok,
    tiles: out,
    counts,
    cells: n,
    steps,
    decisions,
    propagations,
    backtracks,
    contradictions,
    mismatches,
    ms: performance.now() - t0,
    cellsPerSec: n / (performance.now() - t0) * 1000,
  };
}

function popcount(x) {
  let c = 0;
  while (x) { x &= x - 1; c++; }
  return c;
}
function lowestBit(x) {
  for (let i = 0; i < 16; i++) if (x & (1 << i)) return i;
  return 255;
}

/**
 * 确定性体检：同一个 seed，正着遍历一遍、倒着遍历一遍，逐格比较。
 *
 * 这就是原文 "next up is to make it deterministic" 的验收方式 ——
 * 不是"跑两次看起来一样"，是**逐格相等**。
 */
export function determinism(grid, { seed = 7, tiles = TILES } = {}) {
  const a = solve(grid, { seed, order: 'forward', tiles });
  const b = solve(grid, { seed, order: 'reverse', tiles });
  let diff = 0;
  for (let i = 0; i < a.tiles.length; i++) if (a.tiles[i] !== b.tiles[i]) diff++;
  const c = solve(grid, { seed: seed + 1, order: 'forward', tiles });
  let diffSeed = 0;
  for (let i = 0; i < a.tiles.length; i++) if (a.tiles[i] !== c.tiles[i]) diffSeed++;
  return {
    sameUnderTraversal: diff === 0,
    diff,
    differsAcrossSeeds: diffSeed > 0,
    diffSeed,
    forward: a,
    reverse: b,
    otherSeed: c,
  };
}
