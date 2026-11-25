/**
 * river-valley.js — 河谷：在任意方格高度场上开河、填洼、削两岸（R44，河流网络与排水的嫁接补缺）。
 *
 * 对账（Guide §3.1 第 4 条，先查是不是已经嫁接）：
 *   REACode/engine/rivers.js carveRivers  → 已在 terrain/generate.js carveRivers（共享 World 版）；只差 paintRivers 这一个导出。
 *   REACode/src/depfill.js priorityFlood → 已在 core/depression-fill.js depressionFill（多边形邻接版）；
 *                                          方格版的诊断（drained / liftStats / stepEdges / naiveLift）补在 terrain/depfill-grid.js。
 *   core/river-network.js planRiverNetwork（汇流累积 + 无环出口树）是重构版自己的东西，原版没有对应。
 * 所以这里不重写这些算法，只做三件原版 / 重构版都没有的事：
 *   1. gridCells / gridWorld：把方格高度场包成 depressionFill / planRiverNetwork 吃的 cells，以及 generate.js carveRivers 吃的最小 World，
 *      这样地貌管线（TigerMessenger/src/system-workshop/relief/）和对照测试都能在方格上直接调库；
 *   2. carveValleys：planRiverNetwork 出河 → 河床 = 溢出面 − depth 层 → 两岸按离河距离 bank 层 / 格的 V 形削低 → 洼地按溢出面填成湖；
 *      只降不升（湖除外），按出口树 BFS 削岸，所以削完仍然处处能排到海（verify 复算）；保护格不动、陆地不变海；
 *   3. paintRivers：原版 engine/rivers.js 的导出（把河格标成水色槽），World 有 colors 就写 colors，没有就写 river。
 */
import { planRiverNetwork } from '../core/river-network.js';
import { depressionFill, drainedCells } from '../core/depression-fill.js';

const land = (v) => Number.isFinite(v) && v > 0;

/** n×n 方格 → cells[{ id, cx, cz, edgeNeighbors }]（-1 = 网格外）。diag = true 时 8 邻（原版 depfill 用 8 邻）。邻接对称。 */
export function gridCells(n, { diag = false } = {}) {
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], D8 = [...D4, [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const dirs = diag ? D8 : D4, cells = new Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const id = j * n + i;
    cells[id] = { id, cx: i, cz: j, n: dirs.length, edgeNeighbors: dirs.map(([di, dj]) => { const a = i + di, b = j + dj; return a >= 0 && b >= 0 && a < n && b < n ? b * n + a : -1; }) };
  }
  return cells;
}

/**
 * generate.js carveRivers 需要的最小 World：cells（带 n / cx / cz）、ground(c)、neighbor(c, i)、fill(c, level)、river[]、touch()、version。
 * levels：每格整数层（0 = 海）。fill 直接改 levels。
 */
export function gridWorld(n, levels) {
  const cells = gridCells(n), lv = Int32Array.from(levels, (v) => Math.max(0, Math.round(v)));
  const world = {
    cells, levels: lv, river: new Uint8Array(n * n), colors: null, version: 0,
    ground: (c) => lv[c.id], top: (c) => lv[c.id],
    neighbor: (c, i) => { const id = c.edgeNeighbors[i]; return id >= 0 ? cells[id] : null; },
    fill: (c, level) => { lv[c.id] = Math.max(0, Math.round(level)); },
    touch: () => { world.version++; },
  };
  return world;
}

/** 原版 engine/rivers.js paintRivers：把河格标成水色槽（slot 默认 2）。 */
export function paintRivers(world, riverCells, slot = 2) {
  for (const id of riverCells) {
    if (!world.cells?.[id]) continue;
    if (world.colors) world.colors[id] = slot; else if (world.river) world.river[id] = 1;
  }
  if (typeof world.touch === 'function') world.touch(); else world.version = (world.version || 0) + 1;
  return world;
}

/**
 * 河谷。h：行优先米制高度（海 / 场外 = NaN 或 ≤ 0）；layer：一层多少米；threshold：汇流格数到多少算河；
 * depth：河床比溢出面低几层；bank：两岸每离河一格最多高出几层；rings：削岸几圈；protect：不改的格。
 * 返回 { h, river:[id], lakes:[id], outlets:[id], maxArea, lowered, raised, parent }（parent 是削岸前的出口树，verify 用）。
 */
export function carveValleys(h, n, { layer = 1.5, threshold = 24, depth = 1, bank = 1, rings = 2, protect = null, minLand = 0.3 } = {}) {
  if (h.length !== n * n) throw new RangeError('高度场大小与 n 不符');
  const cells = gridCells(n), heights = Float64Array.from(h, (v) => (land(v) ? v / layer : 0));
  const net = planRiverNetwork(cells, heights, { threshold, depth });
  const out = Array.from(h), lock = protect || new Uint8Array(n * n);
  const river = [], lakes = [], isLake = new Uint8Array(n * n);
  let lowered = 0, raised = 0;
  const bedM = new Float64Array(n * n).fill(NaN);
  for (let id = 0; id < n * n; id++) {
    if (!land(h[id]) || lock[id]) continue;
    // 先判湖：穿过洼地的河段属于湖面（不下切），否则它会比两边的湖面低、成为新的坑
    if (net.filled[id] > heights[id] + 1e-9) {
      out[id] = net.filled[id] * layer + 1e-7; raised++; lakes.push(id); isLake[id] = 1;   // +1e-7 m：层 × 层高换回米的浮点误差不能让湖面比溢出口低
    } else if (net.river[id]) {
      const b = Math.max(minLand, Math.min(h[id], net.bed[id] * layer));
      if (b < out[id]) { out[id] = b; lowered++; }
      bedM[id] = out[id]; river.push(id);
    }
  }
  // 河床不能比下游那一格（出口树的父格）还低：下游是湖 / 保护格 / 没下切的格时，河床抬到与它齐平，否则会切出新的坑
  const fixed = new Uint8Array(n * n);
  for (const start of river) {
    const chain = []; let id = start;
    while (id >= 0 && net.river[id] && !fixed[id] && !isLake[id] && !lock[id]) { chain.push(id); id = net.parent[id]; }
    for (let c = chain.length - 1; c >= 0; c--) {
      const x = chain[c], par = net.parent[x];
      if (par >= 0 && land(h[par]) && out[par] > out[x]) { out[x] = out[par]; bedM[x] = out[x]; }
      fixed[x] = 1;
    }
  }
  // 两岸 V 形：从河格向外 BFS（4 邻），第 d 圈最多高出最近河床 d·bank 层。
  // 只穿过「削完不高于本圈上限」的格往外走；湖格、保护格不改也不往外传，免得削出比湖面 / 保护格还低的坑。
  const dist = new Int32Array(n * n).fill(-1), near = new Float64Array(n * n).fill(NaN), q = [];
  for (const id of river) { dist[id] = 0; near[id] = bedM[id]; q.push(id); }
  for (let k = 0; k < q.length; k++) {
    const id = q[k]; if (dist[id] >= rings) continue;
    for (const nb of cells[id].edgeNeighbors) {
      if (nb < 0 || dist[nb] >= 0 || !land(h[nb])) continue;
      dist[nb] = dist[id] + 1; near[nb] = near[id];
      if (lock[nb] || net.river[nb] || isLake[nb]) continue;
      const cap = Math.max(minLand, near[nb] + dist[nb] * bank * layer);
      if (out[nb] > cap) { out[nb] = cap; lowered++; }
      q.push(nb);
    }
  }
  return { h: out, river, lakes, outlets: net.outlets, maxArea: net.maxArea, lowered, raised, parent: Array.from(net.parent) };
}

/** 排水率：陆地格里有一条不上坡的路能到海 / 网格边的比例（core/depression-fill.js drainedCells，4 邻） */
export function drainShare(h, n) {
  const cells = gridCells(n), heights = Float64Array.from(h, (v) => (land(v) ? v : 0));
  return drainedCells(cells, heights).share;
}

/** 填洼后会被抬起超过 tol 米的格数（> 0 说明还有排不出去的坑；tol 吸收「层 × 层高」来回换算的浮点误差） */
export function pitCells(h, n, { tol = 1e-6 } = {}) {
  const cells = gridCells(n), heights = Float64Array.from(h, (v) => (land(v) ? v : 0));
  const { filled } = depressionFill(cells, heights); let c = 0;
  for (let id = 0; id < filled.length; id++) if (filled[id] - heights[id] > tol) c++;
  return c;
}
