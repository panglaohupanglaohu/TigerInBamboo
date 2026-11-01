/**
 * surfacedeco.js — 墙面装饰（窗/门/百叶）用**一套更小的 WFC**单独解，别塞进建筑 WFC。
 *
 * 1181464374839521280  "I made some stairs, plus an additional smaller WFC for
 *   surface decorations like windows and doors (who's awkward placement otherwise
 *   explodes the permutation count)"
 *
 * 这句话是整条学习线上少见的"架构性"陈述，不是美术技巧：装饰不该是建筑 tile 的一部分，
 * 因为它会把 tile 集合乘上一个装饰变体数的若干次方（每格 6 个面，每个面都得带上
 * 装饰状态），而装饰自己的约束（门只在地面、门上方要过梁、窗不连排）都是**局部**的。
 *
 * 所以这里做的是一套二维小 WFC：把一面墙（w 格宽 × h 层高）当一张 w×h 的槽位网格，
 * 只在装饰 tile 集合 {none, window, window2, door, arch, shutter} 上求解。
 *
 * 三件事：
 *   1. `runDeco()`       —— 解一面墙，返回每个槽位的 tile + 解算过程的计数
 *   2. `validate()`      —— 解完之后逐条复查约束（不自证"应该没问题"）
 *   3. `permutationCost()` —— 算"折进建筑 WFC" vs "拆出来"的搜索空间差多少（对数）
 *
 * 装修落点：`engine/props.js` 是窗/门的**几何**（打洞、不重叠），这个文件是**该不该在那儿**
 * ——两者互补，不重复。
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ tiles */

// 装饰 tile：名字 → 期望出现的槽位（角色过滤）
export const DECO_TILES = ['none', 'window', 'window2', 'door', 'arch', 'shutter'];
const T = Object.fromEntries(DECO_TILES.map((n, i) => [n, i]));
const NONE = T.none;

/**
 * 左右相邻允许表。手工写，不搞概率权重 —— 这套规则要的是"可读"，不是"多变"。
 * 关键几条来自片子里的画面：门窗各自成组、同类型窗不并排（不然看不出"窗"这个符号）、
 * 百叶必须在窗旁边（否则一片百叶就是脏点）。
 */
function pairOk(a, b) {
  if (a === NONE || b === NONE) return true;
  if (a === T.shutter || b === T.shutter) {
    const other = a === T.shutter ? b : a;
    return other === T.window || other === T.window2;
  }
  if (a === T.door || a === T.arch) return b !== T.door && b !== T.arch && b !== T.window2;
  if (b === T.door || b === T.arch) return a !== T.door && a !== T.arch && a !== T.window2;
  // 两扇窗并排：允许，但必须是不同类型，形成节奏
  return a !== b;
}

/** 上下相邻允许表：门上方要过梁/横窗；竖长窗上方必须空。 */
function vertOk(below, above) {
  if (below === T.door || below === T.arch) return above === NONE || above === T.window2 || above === T.window;
  if (below === T.window2) return above === NONE;
  return true;
}

/* ------------------------------------------------------------------- WFC */

/**
 * 解一面墙。槽位网格 w×h（h = 层），row 0 = 地面层。
 *
 * 用最朴素的那套：域 = 位掩码 → 传播（谁变了就推邻居）→ 最小熵挑选（带随机权重）
 * → 失败就回溯一步。装饰墙的槽位通常 ≤ 60，回溯深度设 400 足够。
 */
export function runDeco({ w = 8, h = 4, seed = 1, corners = true } = {}) {
  const t0 = performance.now();
  const rnd = mulberry32(seed);
  const n = w * h;
  const idx = (x, y) => y * w + x;
  const all = (1 << DECO_TILES.length) - 1;
  // 权重：墙大部分是空的，但"空"不能压倒一切 —— 纯最小熵 + 空的域不约束邻居时，
  // 求解器会一路把整面墙填成 none（第一版就是这么翻的：352 个槽位全 none）。
  const W = [0.5, 0.22, 0.09, 0.07, 0.03, 0.09];
  const order = [0, 1, 2, 3, 4, 5].sort((a, b) => W[b] - W[a]);

  const dom = new Uint32Array(n).fill(all);
  // 角色过滤：门/拱只在地面层；顶层的 window2 会被上面切掉一半 → 不许
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = all;
      if (y > 0) m &= ~((1 << T.door) | (1 << T.arch));
      if (y === h - 1) m &= ~(1 << T.window2);
      // 两端槽位：山墙角不放百叶（贴着边看不出是"挂在窗边"）
      if (corners && (x === 0 || x === w - 1) && y > 0) m &= ~(1 << T.shutter);
      dom[idx(x, y)] = m;
    }
  }

  let pushes = 0;
  let decisions = 0;
  let backtracks = 0;
  const trail = [];

  const neighbours = (i) => {
    const x = i % w;
    const y = (i / w) | 0;
    const out = [];
    if (x > 0) out.push([idx(x - 1, y), 'h']);
    if (x < w - 1) out.push([idx(x + 1, y), 'h']);
    if (y > 0) out.push([idx(x, y - 1), 'v']);
    if (y < h - 1) out.push([idx(x, y + 1), 'v']);
    return out;
  };

  const supported = (i, j, kind, t) => {
    // 槽位 j 是否还允许 t（取决于 i 的当前域）
    const d = dom[i];
    for (let s = 0; s < DECO_TILES.length; s++) {
      if (!(d & (1 << s))) continue;
      if (kind === 'h' ? pairOk(s, t) : vertOk(s, t)) return true;
    }
    return false;
  };

  const propagate = (start) => {
    const q = [start];
    while (q.length) {
      const i = q.pop();
      for (const [j, kind] of neighbours(i)) {
        const before = dom[j];
        let m = before;
        for (let t = 0; t < DECO_TILES.length; t++) {
          if (!(m & (1 << t))) continue;
          if (!supported(i, j, kind, t)) m &= ~(1 << t);
        }
        if (m !== before) {
          pushes++;
          trail.push([j, before]);
          dom[j] = m;
          if (m === 0) return false;
          q.push(j);
        }
      }
    }
    return true;
  };

  const solve = (depth) => {
    // 找最小熵且未定的槽位（熵相同时随机挑，避免总是从左到右塌陷）
    let best = -1;
    let bestN = 99;
    let ties = 0;
    for (let i = 0; i < n; i++) {
      const c = popcount(dom[i]);
      if (c > 1 && c < bestN) { bestN = c; best = i; ties = 1; }
      else if (c > 1 && c === bestN) { ties++; if (rnd() < 1 / ties) best = i; }
    }
    if (best < 0) return true;
    if (depth > 400) return false;
    const opts = order.filter((t) => dom[best] & (1 << t));
    // 按权重**随机**排序（不是恒取最大权重）：第一版恒取 none 时，因为它不约束邻居，
    // 求解器一路塌陷成一整面空墙 —— 权重必须是采样，不能是顺序。
    const picks = [];
    const pool = opts.slice();
    const pw = pool.map((t) => W[t]);
    while (pool.length) {
      let r = rnd() * pw.reduce((a, b) => a + b, 0);
      let k = 0;
      while (k < pool.length - 1 && r > pw[k]) { r -= pw[k]; k++; }
      picks.push(pool[k]);
      pool.splice(k, 1);
      pw.splice(k, 1);
    }
    for (const t of picks) {
      const mark = trail.length;
      const before = dom[best];
      dom[best] = 1 << t;
      decisions++;
      trail.push([best, before]);
      if (propagate(best) && solve(depth + 1)) return true;
      while (trail.length > mark) {
        const [j, d] = trail.pop();
        dom[j] = d;
      }
      backtracks++;
    }
    return false;
  };

  // 钉一扇门：没有门的墙在片子里不会出现（"stairs + door"是那次更新的主语）。
  // 钉住 = 把一个地面槽位的域收成单值，再交给同一个求解器。
  const doorX = 1 + Math.floor(rnd() * Math.max(1, w - 2));
  if (w >= 4) {
    const i = idx(doorX, 0);
    dom[i] = 1 << T.door;
    if (!propagate(i)) dom[i] = all;
  }

  const ok = solve(0);
  const tiles = [];
  for (let i = 0; i < n; i++) tiles.push(ok ? lowestBit(dom[i]) : -1);
  const ms = performance.now() - t0;
  const res = { ok, w, h, tiles, names: tiles.map((t) => (t < 0 ? '?' : DECO_TILES[t])), pushes, decisions, backtracks, ms };
  res.violations = validate(res);
  return res;
}

function popcount(x) {
  let c = 0;
  while (x) { x &= x - 1; c++; }
  return c;
}
function lowestBit(x) {
  for (let i = 0; i < 32; i++) if (x & (1 << i)) return i;
  return -1;
}

/**
 * 解完自己复查一遍。任何一条约束不满足就记一笔 —— 上一步的传播只保证"当下相容"，
 * 回溯实现里最容易出的错就是恢复了域却忘了恢复队列。
 */
export function validate(res) {
  const { w, h, tiles } = res;
  let bad = 0;
  const at = (x, y) => tiles[y * w + x];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = at(x, y);
      if (t < 0) { bad++; continue; }
      if (x + 1 < w && !pairOk(t, at(x + 1, y))) bad++;
      if (y + 1 < h && !vertOk(t, at(x, y + 1))) bad++;
      if ((t === T.door || t === T.arch) && y !== 0) bad++;
      if (t === T.window2 && y === h - 1) bad++;
    }
  }
  return bad;
}

/* ------------------------------------------------------- 搜索空间（估算） */

/**
 * "折进建筑 WFC" 会让 tile 集合乘上一个装饰变体数的可见面次方。
 *
 * 估算前提（写在返回值里，别当实测）：
 *   - 建筑 tile 集合 12 种（墙/角/顶/拱…的粗数）
 *   - 平均每格 2 个可见面（一面墙面的典型值：外侧 + 顶）
 *   - 每面 6 种装饰变体
 * 于是折进去之后 |tiles| = 12 × 6²；不折则仍是 12。
 * 状态空间取 log10(|tiles|^cells)。
 */
export function permutationCost({ cells = 160, runs = 9, runW = 8, runH = 4, baseTiles = 12, faces = 2, variants = DECO_TILES.length } = {}) {
  const folded = baseTiles * Math.pow(variants, faces);
  const monolithic = cells * Math.log10(folded);
  const base = cells * Math.log10(baseTiles);
  const decoPerRun = runW * runH * Math.log10(variants);
  return {
    rows: [
      { name: '折进建筑 WFC', tiles: folded, log10States: monolithic },
      { name: '拆出来（建筑部分）', tiles: baseTiles, log10States: base },
      { name: '拆出来（每个 run，单独解）', tiles: variants, log10States: decoPerRun },
    ],
    ratioLog10: monolithic - base,
    assumptions: { cells, runs, runW, runH, baseTiles, faces, variants },
  };
}

/* ------------------------------------------------------------ 接到真城的桥 */

/**
 * 数一数真城里有多少个"可贴装饰的槽位"：每格每条暴露的边 × 每层。
 * 这里只**数**，不生成 run —— 把面切成连续的 run 需要网格侧给出"哪些格在同一条墙上"，
 * 那是 TownMesh 的事（见 LEARNING.md 未做清单）。
 */
export function townFaceCount(town, grid) {
  let faces = 0;
  let slots = 0;
  let cells = 0;
  for (const cell of grid.cells) {
    const top = town.top(cell);
    if (!top) continue;
    cells++;
    const bottom = town.bottom(cell) || 1;
    for (let i = 0; i < cell.pts.length; i++) {
      const nb = cell.edgeNeighbors ? cell.edgeNeighbors[i] : cell.nbr ? cell.nbr[i] : -1;
      const nbTop = nb >= 0 ? town.top(grid.cells[nb]) : 0;
      const exposed = nbTop < bottom;
      if (!exposed) continue;
      faces++;
      slots += top - bottom + 1;
    }
  }
  return { cells, faces, slots };
}

/** 一键体检：解若干面墙 + 统计 + 搜索空间估算。 */
export function audit({ runs = 12, w = 8, h = 4, seed = 1181464374839521280 } = {}) {
  const t0 = performance.now();
  let slots = 0;
  let pushes = 0;
  let decisions = 0;
  let backtracks = 0;
  let bad = 0;
  let fails = 0;
  let maxMs = 0;
  const heights = [];
  const sample = [];
  for (let i = 0; i < runs; i++) {
    const hh = 2 + (i % 3 === 0 ? 0 : 1 + (i % 3));
    heights.push(hh);
    const r = runDeco({ w, h: hh, seed: seed + i * 7919 });
    if (!r.ok) fails++;
    slots += r.tiles.length;
    pushes += r.pushes;
    decisions += r.decisions;
    backtracks += r.backtracks;
    bad += r.violations;
    maxMs = Math.max(maxMs, r.ms);
    if (i < 3) sample.push({ h: hh, names: r.names });
  }
  return {
    runs,
    slots,
    fails,
    violations: bad,
    pushes,
    decisions,
    backtracks,
    maxMs,
    totalMs: performance.now() - t0,
    heights,
    sample,
    cost: permutationCost({ runs, runH: h }),
  };
}

export { T, pairOk, vertOk };
