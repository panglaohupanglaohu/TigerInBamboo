/**
 * tilerepair.js — 约束式铺砖的"自我修复"：坏掉之后只动坏的那一小块。
 *
 * 原文（x.com/OskSta/status/793806535898136576, 2016-11-02）：
 *
 *   "I gave it an extra difficult tileset to work with to make sure it can repair
 *    itself when it has screwed up"
 *
 * 画面（24 帧，436×460 等距俯视）：
 *   · 一座**全是管道**的方阵：直管、弯头、三通、管帽堆成三层，很多管子悬在半空、互相插入；
 *     这套 tileset 明显是故意做难的（弯头多、直管少），所以结构看起来"能把人卡死"；
 *   · 右侧有一组**红色线框盒**，框住几个格子 —— 那些是被判"坏了"的位置；
 *   · 红盒旁边还有**黄色线框盒**，位置更靠外一点 —— 备选位置/待试的候选；
 *   · 第 8~16 帧里红盒逐个消失、黄盒顶上，结构最后又连成一片。
 *
 * 原文说 "repair itself when it has screwed up"，重点是**自己**和**局部**：
 *   不是"重新生成一遍"，而是"只改坏掉的那几格"。
 *   这两者的差别可以直接量：重生成会改动整张图（改动率 ~100%），
 *   局部修复只改坏区边界那一圈（改动率几个百分点）。片子里红盒只有几个、结构其余部分纹丝不动，
 *   说的就是这件事。
 *
 * 算法（和 Sudoku 那套是同一个骨架，但目标不同）：
 *   1. 先铺满（MRV + 回溯，见 `src/tileplace.js`）；
 *   2. 人为破坏：随机改 k 格；
 *   3. `findConflicts` 找出**相邻两侧贴不上**的格子（片子里的红盒）；
 *   4. 从冲突格 BFS 长出一块"坏区"，边界定格不动；
 *   5. 在坏区里重新 MRV 回溯，**候选顺序按"离原值近的优先"**排 —— 这一条是"少改动"的关键，
 *      不排的话解出来的坏区会整体换个样子（虽然合法，但和"修"不是一回事）；
 *   6. 修不好就把坏区往外扩一圈再来（片子里的黄盒往外挪就是这个意思）。
 *
 * 这个文件不 import three；tile 只有 4 条边的"通/堵"，方便在 node 里量。
 */

/**
 * tileset：每块砖给出 4 条边是否"开口"。
 * 约束只有一条：**我这边的开口 == 邻居对应边的开口**。
 * 故意做得难：只有弯头和直管两种开口组合，且直管权重低 —— 弯头之间互相咬得很死，
 * 破坏一格往往要连带改 2~3 格才解得开。
 */
export const PIPESET = [
  { name: 'cap',    open: [0, 0, 0, 1], weight: 2 },   // 只有一边开口，最容易成死角
  { name: 'straight', open: [1, 0, 1, 0], weight: 1 }, // 竖管
  { name: 'straightH', open: [0, 1, 0, 1], weight: 1 },// 横管
  { name: 'elbow',  open: [1, 0, 0, 1], weight: 6 },
  { name: 'elbow2', open: [0, 1, 1, 0], weight: 6 },
  { name: 'elbow3', open: [1, 1, 0, 0], weight: 6 },
  { name: 'elbow4', open: [0, 1, 0, 1], weight: 0.0001 }, // 与 straightH 同形但低权重，制造"同形不同名"的干扰
  { name: 'tee',    open: [1, 1, 0, 1], weight: 3 },
  { name: 'cross',  open: [1, 1, 1, 1], weight: 0.5 },
];

// 0=+x 1=-x 2=+y 3=-y → 对面。
// 坑：第一版抄成 [2,3,0,1]（把 +x 的对面写成 +y），结果连"原始正确图"都带着 97 个冲突 ——
// 那不是修复失败，是判据本身错了。凡是这种"基准数据自己就不合法"的现象，先怀疑对面表。
const OPP = [1, 0, 3, 2];
const DIR_X = [1, -1, 0, 0];
const DIR_Y = [0, 0, 1, -1];

export class Grid {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows; this.n = cols * rows;
  }
  cell(x, y) { return y * this.cols + x; }
  x(c) { return c % this.cols; }
  y(c) { return (c / this.cols) | 0; }
  nbr(c, d) {
    const x = this.x(c) + DIR_X[d], y = this.y(c) + DIR_Y[d];
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return -1;
    return this.cell(x, y);
  }
}

/** compat[t * 4 + d] = 位集：t 在 d 方向能接的 tile。 */
export function buildCompat(tiles) {
  const T = tiles.length;
  const compat = new Uint8Array(T * 4 * T);
  for (let t = 0; t < T; t++) {
    for (let d = 0; d < 4; d++) {
      for (let u = 0; u < T; u++) {
        compat[(t * 4 + d) * T + u] = tiles[t].open[d] === tiles[u].open[OPP[d]] ? 1 : 0;
      }
    }
  }
  return compat;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 两格是否合法相邻。 */
export function fits(compat, T, a, b, d) {
  return compat[(a * 4 + d) * T + b] === 1;
}

/** 找出所有"至少有一条边贴不上"的格子（片子里的红盒）。 */
export function findConflicts(assign, grid, compat, tiles) {
  const T = tiles.length;
  const bad = new Set();
  for (let c = 0; c < grid.n; c++) {
    const t = assign[c];
    if (t < 0) continue;
    for (let d = 0; d < 4; d++) {
      const nb = grid.nbr(c, d);
      if (nb < 0) continue;
      const u = assign[nb];
      if (u < 0) continue;
      if (!fits(compat, T, t, u, d)) { bad.add(c); bad.add(nb); }
    }
  }
  return [...bad];
}

/**
 * 坏区：从冲突格 BFS 长 radius 圈。边界格（区域外但贴着区域）用来当"固定约束"。
 */
export function growRegion(grid, seeds, radius) {
  const inRegion = new Uint8Array(grid.n);
  let frontier = seeds.slice();
  for (const c of frontier) inRegion[c] = 1;
  for (let r = 0; r < radius; r++) {
    const next = [];
    for (const c of frontier) {
      for (let d = 0; d < 4; d++) {
        const nb = grid.nbr(c, d);
        if (nb >= 0 && !inRegion[nb]) { inRegion[nb] = 1; next.push(nb); }
      }
    }
    frontier = next;
  }
  const cells = [];
  for (let c = 0; c < grid.n; c++) if (inRegion[c]) cells.push(c);
  return { cells, inRegion };
}

/**
 * 在坏区里重新求解，尽量保留原值。
 *
 * @returns {{ok:boolean, changed:number[], assign:Int16Array, nodes:number}}
 */
export function solveRegion(assign, grid, compat, tiles, region, rng) {
  const T = tiles.length;
  const out = Int16Array.from(assign);
  const cells = region.cells.slice();
  // MRV 的顺序由"当前候选数"动态决定，这里先按"原值信心"排个初序：
  // 冲突核心先解，边缘后解（边缘被外面钉住，候选通常更少，会自然被 MRV 提前）。
  let nodes = 0;
  const cands = new Map();

  const allowedFor = (c, partial) => {
    const out2 = [];
    for (let t = 0; t < T; t++) {
      let ok = true;
      for (let d = 0; d < 4; d++) {
        const nb = grid.nbr(c, d);
        if (nb < 0) continue;
        if (region.inRegion[nb]) {
          const u = partial[nb];
          if (u >= 0 && !fits(compat, T, t, u, d)) { ok = false; break; }
        } else {
          const u = assign[nb];
          if (u >= 0 && !fits(compat, T, t, u, d)) { ok = false; break; }
        }
      }
      if (ok) out2.push(t);
    }
    return out2;
  };

  const MAX = 200000;
  const dfs = () => {
    if (++nodes > MAX) return false;
    // 选**还没定型**的格里候选最少的那个。
    // 坑：第一版写成 `if (out[c] >= 0 && cands.has(c)) continue;` —— `cands` 从没被填过，
    // 于是已经落子的格子会被反复选中、反复落子，回溯永远不收敛，直接 RangeError 爆栈。
    let best = -1, bestList = null;
    for (const c of cells) {
      if (out[c] >= 0) continue;
      const list = allowedFor(c, out);
      if (list.length === 0) return false;
      if (!bestList || list.length < bestList.length) { best = c; bestList = list; if (list.length === 1) break; }
    }
    if (best < 0) return true;
    // 候选排序：原值优先，其余按 tileset 权重（权重高的更像"这个 tileset 的正常砖"）
    const orig = assign[best];
    bestList.sort((a, b) => {
      if (a === orig) return -1;
      if (b === orig) return 1;
      return (tiles[b].weight || 0) - (tiles[a].weight || 0);
    });
    for (const t of bestList) {
      out[best] = t;
      if (dfs()) return true;
      out[best] = -1;
    }
    return false;
  };

  // 先把坏区清成未定，边界靠 assign 钉住
  for (const c of cells) out[c] = -1;
  const ok = dfs();
  if (!ok) return { ok: false, changed: [], assign, nodes };

  const changed = [];
  for (const c of cells) if (out[c] !== assign[c]) changed.push(c);
  return { ok: true, changed, assign: out, nodes };
}

/** 一次性全解（用来造"原始正确图"）。 */
export function solveAll(grid, compat, tiles, rng, { maxNodes = 400000 } = {}) {
  const T = tiles.length;
  const totalW = tiles.reduce((s, t) => s + (t.weight || 1), 0);
  const pick = () => {
    let r = rng() * totalW;
    for (let t = 0; t < T; t++) { r -= tiles[t].weight || 1; if (r <= 0) return t; }
    return T - 1;
  };
  const assign = new Int16Array(grid.n).fill(-1);
  let nodes = 0;
  const dfs = () => {
    if (++nodes > maxNodes) return false;
    let best = -1, bestList = null;
    for (let c = 0; c < grid.n; c++) {
      if (assign[c] >= 0) continue;
      const list = [];
      for (let t = 0; t < T; t++) {
        let ok = true;
        for (let d = 0; d < 4; d++) {
          const nb = grid.nbr(c, d);
          if (nb < 0) continue;
          const u = assign[nb];
          if (u >= 0 && !fits(compat, T, t, u, d)) { ok = false; break; }
        }
        if (ok) list.push(t);
      }
      if (list.length === 0) return false;
      if (!bestList || list.length < bestList.length) { best = c; bestList = list; if (list.length === 1) break; }
    }
    if (best < 0) return true;
    // 加权随机排序（每个候选先摇一个随机数，再按权重降序 + 随机扰动）
    bestList.sort((a, b) => (tiles[b].weight || 1) * (0.5 + rng()) - (tiles[a].weight || 1) * (0.5 + rng()));
    for (const t of bestList) {
      assign[best] = t;
      if (dfs()) return true;
      assign[best] = -1;
    }
    return false;
  };
  const ok = dfs();
  return { ok, assign, nodes, pick };
}

/**
 * 自检：铺一张图 → 随机破坏 k 格 → 修复，量"改动了几格"。
 * 对照组：把整张图重铺一遍（改动率≈100%）。
 */
export function selfCheck({ cols = 14, rows = 14, trials = 20, corrupt = 6, seed = 11 } = {}) {
  const grid = new Grid(cols, rows);
  const tiles = PIPESET;
  const compat = buildCompat(tiles);
  const rng = mulberry32(seed);

  const base = solveAll(grid, compat, tiles, rng);
  if (!base.ok) return { error: 'base solve failed' };

  let okCount = 0, changedSum = 0, regionSum = 0, conflictsSum = 0, attemptsSum = 0;
  const samples = [];
  for (let t = 0; t < trials; t++) {
    const broken = Int16Array.from(base.assign);
    const picked = [];
    for (let k = 0; k < corrupt; k++) {
      const c = (rng() * grid.n) | 0;
      broken[c] = (rng() * tiles.length) | 0;
      picked.push(c);
    }
    const before = findConflicts(broken, grid, compat, tiles);
    conflictsSum += before.length;

    let assign = broken, radius = 1, attempts = 0, res = null;
    while (attempts < 4) {
      attempts++;
      const region = growRegion(grid, before.length ? before : picked, radius);
      res = solveRegion(assign, grid, compat, tiles, region, rng);
      if (res.ok) { regionSum += region.cells.length; break; }
      radius++;
    }
    attemptsSum += attempts;
    if (res && res.ok) okCount++;
    const changed = res && res.ok ? res.changed.length : grid.n;
    changedSum += changed;
    if (samples.length < 5) samples.push({ corrupt: picked.length, conflicts: before.length, changed, attempts, nodes: res ? res.nodes : -1 });
  }

  return {
    cols, rows, cells: grid.n, tiles: tiles.length, trials, corrupt,
    baseNodes: base.nodes,
    baseConflicts: findConflicts(base.assign, grid, compat, tiles).length,
    repaired: okCount, repairRate: +(okCount / trials).toFixed(3),
    meanConflicts: +(conflictsSum / trials).toFixed(2),
    meanRegion: +(regionSum / Math.max(1, okCount)).toFixed(1),
    meanChanged: +(changedSum / trials).toFixed(2),
    changedRate: +(changedSum / trials / grid.n).toFixed(4),
    meanAttempts: +(attemptsSum / trials).toFixed(2),
    samples,
  };
}
