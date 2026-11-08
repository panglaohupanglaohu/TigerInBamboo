/**
 * socketrock.js — 为什么"岩类 tile 一块都不出现"：不是种子不好，是 tile 集不闭合。
 *
 * 1164926304640229376  "WFC running at interactive speed on that funky grid.
 *   Next up is to make it deterministic"
 *
 * 上一轮 src/gridwfc.js 把**确定性**那半边做完了，但 note 里留了一句没解释的现象：
 *   「岩类 tile 0 块 —— 边界锁 0 把 rock 沿传播链一路消掉」。
 * 这个文件专门查那件事，结论跟"边界"只有一半关系：
 *
 *   · rock = [1,1,1,1] 意味着**四个邻居朝着它的那条边都必须是 1 号接口**；
 *   · 能把 1 摆到"朝 rock"那个位置的只有 rock 自己、grassRock(0,1,0,1)、
 *     sandRock(3,3,1,1) 三块；
 *   · 于是 rock 的西/南两侧（edge0/edge2 = 1）只能接 rock 或 sandRock ——
 *     而 sandRock 的 edge1 = 3 要求邻居 edge3 = 3，全套里**没有任何 tile 的 edge3 是 3**
 *     （sand 是 [3,0,3,0]，edge3 = 0）。sandRock 自己也永远放不下。
 *   · 结果 rock 只能"被 rock 包围"，一路回溯到网格边界；边界又被锁成 0 号接口，
 *     于是整块岩石被消掉。**根因是 tile 集在"边标签"上不闭合，边界只是最后一根稻草。**
 *
 * 三个变体实测（同一张网格、同一 seed）：
 *   A 原 8 块 + 边界锁 0        → rock 0
 *   B 原 8 块 + 边界不锁         → rock 仍然 0（说明不是边界单方面的锅）
 *   C 原 8 块 + 3 条过渡边 + 锁 0 → rock 出现，接口冲突 0
 *
 * 求解器只做 AC-3 传播 + 确定性坍缩（并列按 cellId 最小），不靠"跑两次一样"来保证。
 */

/** 原 8 块（与 gridwfc.js 的 TILES 同一套，便于对照） */
export const BASE_TILES = [
  { name: 'grass', edges: [0, 0, 0, 0] },
  { name: 'grassRock', edges: [0, 1, 0, 1] },
  { name: 'rock', edges: [1, 1, 1, 1] },
  { name: 'grassPath', edges: [0, 2, 0, 2] },
  { name: 'pathCross', edges: [2, 2, 2, 2] },
  { name: 'pathEnd', edges: [2, 0, 0, 0] },
  { name: 'sand', edges: [3, 0, 3, 0] },
  { name: 'sandRock', edges: [3, 3, 1, 1] },
];

/**
 * 补三条"过渡边"，让每个接口在两个方向上都有人接：
 *   rockEdge  (0,1,0,1) 已有 —— 岩石贴着草
 *   rockNS    [1,0,1,0]  岩石在南北、草在东西（原套里缺这一块）
 *   sandEdge  [3,0,0,0]  沙贴着草（原套里 sand 的 edge1/3 = 0，但 edge0/2 只能接 3）
 *   rockSand  [1,3,1,3]  岩石与沙的过渡（sandRock 的 3 落在 edge1 上时没人接）
 */
export const RIM_TILES = [
  { name: 'rockNS', edges: [1, 0, 1, 0] },
  { name: 'sandEdge', edges: [3, 0, 0, 0] },
  { name: 'rockSand', edges: [1, 3, 1, 3] },
];

/**
 * 真正能"收口"的一套：给岩石四边各一块**只在一侧**带 1 的过渡块。
 * （RIM_TILES 那三条是反例：它们把 1 放在一对**相对边**上，等于要求岩石沿那个方向
 *   一直延伸下去 —— 有限岩块永远闭合不了，这才是 rock 恒 0 的真正原因。）
 */
export const CAP_TILES = [
  { name: 'rockN', edges: [1, 0, 0, 0] },   // 在岩石北侧：只有朝南(edge3)接岩石    ← 这里 edge3 才是朝下的那条
  { name: 'rockS', edges: [0, 1, 0, 0] },   // 在岩石南侧
  { name: 'rockE', edges: [0, 0, 1, 0] },   // 在岩石东侧
  { name: 'rockW', edges: [0, 0, 0, 1] },   // 在岩石西侧
];

/** 两接口能不能接上（与 gridwfc.js 同一条规则：同号接，草可与路/沙柔接） */
function socketOk(a, b) {
  if (a === b) return true;
  if ((a === 0 && (b === 2 || b === 3)) || (b === 0 && (a === 2 || a === 3))) return true;
  return false;
}

function hash3(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const popcount = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
const lowbit = (x) => { for (let i = 0; i < 31; i++) if (x & (1 << i)) return i; return 255; };

/**
 * @param grid  {cells:[{id,edgeNeighbors,pts,cx,cz}]} —— buildQuadGrid() 的返回值
 * @param o.tiles      要用的 tile 集
 * @param o.boundary   'grass'（原版：外边锁 0 号接口）| 'open'（外边不约束）
 * @param o.seed
 */
export function solveGrid(grid, { tiles = BASE_TILES, boundary = 'grass', seed = 7, pins = [] } = {}) {
  const t0 = performance.now();
  const cells = grid.cells;
  const n = cells.length;
  const BITS = (1 << tiles.length) - 1;
  const dom = new Uint32Array(n).fill(BITS);
  let boundaryLocks = 0;

  if (boundary === 'grass') {
    for (const c of cells) {
      for (let e = 0; e < c.edgeNeighbors.length; e++) {
        if (c.edgeNeighbors[e] >= 0) continue;
        let m = 0;
        for (let t = 0; t < tiles.length; t++) if (tiles[t].edges[e] === 0) m |= 1 << t;
        if (m === 0) continue;               // 没有 tile 能给 0 号接口 → 放弃这条边（原版这里会 &= BITS，等于没约束）
        dom[c.id] &= m;
        boundaryLocks++;
      }
    }
  }

  const trail = [];
  let contradictions = 0, propagations = 0, decisions = 0, backtracks = 0;
  let pinApplied = 0;

  const propagate = (start) => {
    const stack = [start];
    while (stack.length) {
      stack.sort((a, b) => a - b);          // 容器顺序不进结果
      const cur = stack.shift();
      propagations++;
      const nbr = cells[cur].edgeNeighbors;
      for (let e = 0; e < nbr.length; e++) {
        const j = nbr[e];
        if (j < 0) continue;
        let m = 0;
        for (let t = 0; t < tiles.length; t++) {
          if (!(dom[j] & (1 << t))) continue;
          for (let s = 0; s < tiles.length; s++) {
            if (!(dom[cur] & (1 << s))) continue;
            if (socketOk(tiles[s].edges[e], tiles[t].edges[(e + 2) % 4])) { m |= 1 << t; break; }
          }
        }
        if (m === 0) { contradictions++; return false; }
        const before = dom[j];
        const after = before & m;
        if (after !== before) {
          trail.push([j, before]);
          dom[j] = after;
          if (after === 0) { contradictions++; return false; }
          stack.push(j);
        }
      }
    }
    return true;
  };

  const pick = () => {
    let best = -1, bestCount = 99;
    for (let i = 0; i < n; i++) {                  // 并列取 cellId 最小
      const c = popcount(dom[i]);
      if (c > 1 && (c < bestCount || (c === bestCount && i < best))) { bestCount = c; best = i; }
    }
    return best;
  };

  const rec = (depth) => {
    if (depth > 6000) return false;
    const i = pick();
    if (i < 0) return true;
    decisions++;
    const opts = [];
    for (let t = 0; t < tiles.length; t++) if (dom[i] & (1 << t)) opts.push(t);
    const rot = Math.floor(hash3(seed, i, decisions) * opts.length);
    const ordered = opts.slice(rot).concat(opts.slice(0, rot));
    for (const t of ordered) {
      const mark = trail.length;
      const before = dom[i];
      const after = before & (1 << t);
      if (after !== before) { trail.push([i, before]); dom[i] = after; }
      if (propagate(i) && rec(depth + 1)) return true;
      while (trail.length > mark) { const [k, d] = trail.pop(); dom[k] = d; }
      backtracks++;
    }
    return false;
  };

  // 钉种子：把指定格锁成一类 tile（只在该类域里随机取一块），再传播
  for (const pin of pins) {
    if (pin.cell < 0 || pin.cell >= n) continue;
    let m = 0;
    for (let t = 0; t < tiles.length; t++) if (tiles[t].name === pin.tile) m |= 1 << t;
    if (!m) continue;
    if (dom[pin.cell] & m) { dom[pin.cell] &= m; pinApplied++; }
  }
  for (const pin of pins) if (pin.cell >= 0 && pin.cell < n) propagate(pin.cell);

  const ok = rec(0);
  const out = new Uint8Array(n).fill(255);
  if (ok) for (let i = 0; i < n; i++) out[i] = lowbit(dom[i]);

  // 自检：解出来的相邻接口是否真的一致
  let mismatch = 0;
  if (ok) {
    for (const c of cells) {
      for (let e = 0; e < c.edgeNeighbors.length; e++) {
        const j = c.edgeNeighbors[e];
        if (j < 0 || c.id > j) continue;
        if (!socketOk(tiles[out[c.id]].edges[e], tiles[out[j]].edges[(e + 2) % 4])) mismatch++;
      }
    }
  }

  const counts = {};
  for (let i = 0; i < n; i++) if (out[i] !== 255) counts[tiles[out[i]].name] = (counts[tiles[out[i]].name] || 0) + 1;
  const rockCells = (counts.rock || 0) + (counts.rockNS || 0) + (counts.rockEdge || 0) + (counts.rockSand || 0);

  return {
    ok, out, tiles, counts, cells: n, rockCells,
    boundaryLocks, contradictions, decisions, backtracks, propagations, pinApplied,
    mismatch, ms: performance.now() - t0,
  };
}

/** 三个变体一次跑完，lab 与 node 用同一份。 */
export function compare(grid, { seed = 7 } = {}) {
  const A = solveGrid(grid, { tiles: BASE_TILES, boundary: 'grass', seed });
  const B = solveGrid(grid, { tiles: BASE_TILES, boundary: 'open', seed });
  const CLOSED = [...BASE_TILES, ...RIM_TILES];
  const C = solveGrid(grid, { tiles: CLOSED, boundary: 'grass', seed });
  return { A, B, C };
}

/**
 * 穷举"中心一块 rock 的四个邻居各能接什么"。这是本文件最硬的证据：
 * 只要**某一条边的候选集只有 rock 自己**，有限岩块就不可能闭合 —— 它必须沿那一侧无限延伸，
 * 最后撞到被锁成草的网格边界，于是整块岩石在回溯里被消掉。
 */
export function rockSides(tiles = BASE_TILES) {
  const rock = tiles.find((t) => t.name === 'rock');
  const perSide = [], lists = [];
  for (let k = 0; k < 4; k++) {
    const l = tiles.filter((t) => socketOk(rock.edges[k], t.edges[(k + 2) % 4])).map((t) => t.name);
    perSide.push(l.length); lists.push(l);
  }
  return {
    perSide, lists,
    combos: perSide.reduce((a, b) => a * b, 1),
    cappedSides: perSide.filter((n) => n > 1).length,
    forcedSide: perSide.findIndex((n) => n === 1),
    bounded: perSide.every((n) => n > 1),
  };
}

/** tile 集在"边标签"上是否闭合：每条 (边号, 接口号) 都能在对面找到人接。 */
export function closure(tiles = BASE_TILES) {
  const missing = [];
  for (let e = 0; e < 4; e++) {
    const vals = new Set(tiles.map((t) => t.edges[e]));
    for (const v of vals) {
      const opp = (e + 2) % 4;
      const canPair = tiles.some((t) => socketOk(v, t.edges[opp]));
      if (!canPair) missing.push({ edge: e, socket: v });
    }
  }
  return { closed: missing.length === 0, missing };
}
