/**
 * grouping.js — 把整张图"吃"成几块：最相连的邻居赢了就吞掉这个节点。
 *
 * 原文（x.com/OskSta/status/938422757288792064, 2017-12-06）：
 *
 *   "I'm extra happy with how the grouping turned out. It's a sort of cellular
 *    automaton where nodes get eaten by the neighbor group to which they are
 *    most connected. Here's a slowmo to illustrate:"
 *
 * 画面（24 帧总览）：一张扁长的节点图（点 + 细线），前 3 帧点还是各自一色；
 * 3.5s 起从几处种子开始整片"染色"，颜色按连通强度向外推；4.8~5.0s 有几块
 * 被邻组反吞（颜色回退一格）；8 秒后稳定，边界变成锯齿状、不再是直切。
 *
 * 关键不是"按距离分组"，而是**按连接强度**：一个节点归谁，看它到各组的
 * 边权和，不看几何距离。所以分组边界会沿着"弱连接"走，而不是沿着直线。
 * 这在画面上就是边界"啃"进凸起、把离得近但连接弱的节点判给远的组。
 *
 * 第二条（x.com/OskSta/status/938405900573986816, 2017-12-06）：
 *
 *   "A more legible peek at the campaign generation ... Islands get spread apart
 *    and divided into regions."
 *
 * 画面：节点先被推开（互相重叠的点散成一张网），白线把图切成几块区域，
 * 区域边界上的点被标成红/紫。所以"分组"之前还有一步"散开"——不然节点
 * 挤在一起，边权根本看不清。`spreadNodes()` 就是那一步。
 *
 * 本文件纯数据（不 import three），可在 node 里直接跑量化。
 */

/**
 * 把节点从重叠状态推开（弹簧斥力 + 迭代），只动 xz。
 * @param {{x:number,z:number}[]} nodes 就地修改
 */
export function spreadNodes(nodes, { minDist = 1, iterations = 30, strength = 0.5, bounds = 60 } = {}) {
  const n = nodes.length;
  for (let it = 0; it < iterations; it++) {
    const fx = new Float64Array(n), fz = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dz = nodes[j].z - nodes[i].z;
        let d2 = dx * dx + dz * dz;
        if (d2 > minDist * minDist || d2 < 1e-9) continue;
        const d = Math.sqrt(d2) || 1e-4;
        const push = (minDist - d) / d * strength;
        dx *= push; dz *= push;
        fx[i] -= dx; fz[i] -= dz;
        fx[j] += dx; fz[j] += dz;
      }
    }
    for (let i = 0; i < n; i++) {
      nodes[i].x = Math.max(-bounds, Math.min(bounds, nodes[i].x + fx[i]));
      nodes[i].z = Math.max(-bounds, Math.min(bounds, nodes[i].z + fz[i]));
    }
  }
  return nodes;
}

/**
 * 元胞自动机式分组：每轮，节点被"与它连接最强的那个邻居组"吃掉。
 *
 * @param {object} graph
 *   n            节点数
 *   neighbors(i) 返回 [{id, w}]（w = 连接强度，用边长占比/共边长度都行）
 * @param {object} opts
 *   seeds        初始种子数（0 = 每个节点自成一色，让 CA 自己合并）
 *   maxIters     迭代上限
 *   keepOwn      留在自己组的"惰性"（防止整图翻来覆去）
 * @returns {{group:Int32Array, history:object[], iters:number}}
 */
export function groupByConnectivity(graph, {
  seeds = 6,
  maxIters = 60,
  margin = 0.18,
  rng = Math.random,
} = {}) {
  const n = graph.n;
  const group = new Int32Array(n).fill(-1);

  // 种子：随机挑几个节点先上色
  const seedIdx = [];
  if (seeds > 0) {
    while (seedIdx.length < Math.min(seeds, n)) {
      const i = (rng() * n) | 0;
      if (!seedIdx.includes(i)) seedIdx.push(i);
    }
    seedIdx.forEach((i, g) => { group[i] = g; });
  } else {
    // 没有种子就给每个节点自己的颜色，让它们自己合并（合并过程就是"吃"）
    for (let i = 0; i < n; i++) group[i] = i;
  }

  const history = [];

  // ---- 阶段一：波前生长（画面里"整片被染色"的那 2 秒）-------------------
  // 每一轮只处理"至少有一个已上色邻居"的节点：按到各组边权和选一个，
  // 同权时选邻居多的那组（组越大越容易继续变大 → 边界会被推平）。
  let assigned = group.filter((v) => v >= 0).length;
  let layer = 0;
  while (assigned < n && layer < n) {
    const nextG = new Int32Array(n).fill(-1);
    let grew = 0;
    for (let i = 0; i < n; i++) {
      if (group[i] >= 0) continue;
      const w = new Map();
      for (const e of graph.neighbors(i)) {
        const g = group[e.id];
        if (g >= 0) w.set(g, (w.get(g) || 0) + e.w);
      }
      if (!w.size) continue;
      let best = -1, bestW = -1;
      for (const [g, v] of w) {
        if (v > bestW + 1e-9) { bestW = v; best = g; }
        else if (Math.abs(v - bestW) < 1e-9) {
          // 平手看组大小（大组吃掉平手节点）
          const sizeOf = (gg) => { let c = 0; for (let k = 0; k < n; k++) if (group[k] === gg || nextG[k] === gg) c++; return c; };
          if (sizeOf(g) > sizeOf(best)) best = g;
        }
      }
      nextG[i] = best;
      grew++;
    }
    if (!grew) break;
    for (let i = 0; i < n; i++) if (nextG[i] >= 0) group[i] = nextG[i];
    assigned += grew;
    layer++;
    history.push({ iter: layer, changed: grew, groups: countGroups(group), phase: 'grow' });
  }
  // 剩下的孤岛（整块连不到种子）各自成组
  for (let i = 0; i < n; i++) if (group[i] < 0) group[i] = 1e6 + i;

  // ---- 阶段二：边界回吞（画面里 4.8~5.0s 那几次颜色回退）---------------
  // 每个节点重新算"到各组的总边权"，只有超过自己那组一个裕量才改判。
  // 裕量（margin）是必要的：等强边界不加惰性会每轮翻一次，画面上就是闪烁。
  let iters = 0;
  for (let it = 0; it < maxIters; it++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      const w = new Map();
      let total = 0;
      for (const e of graph.neighbors(i)) {
        w.set(group[e.id], (w.get(group[e.id]) || 0) + e.w);
        total += e.w;
      }
      if (!w.size) continue;
      const own = group[i];
      const ownW = w.get(own) || 0;
      let best = own, bestW = ownW;
      for (const [g, v] of w) if (g !== own && v > bestW) { bestW = v; best = g; }
      if (best !== own && bestW > ownW + margin * total) { group[i] = best; changed++; }
    }
    iters = it + 1;
    history.push({ iter: layer + it, changed, groups: countGroups(group), phase: 'refine' });
    if (!changed) break;
  }

  // 重新编号 0..k-1
  const remap = new Map();
  for (let i = 0; i < n; i++) if (!remap.has(group[i])) remap.set(group[i], remap.size);
  for (let i = 0; i < n; i++) group[i] = remap.get(group[i]);
  return { group, history, iters, growLayers: layer };
}

function countGroups(group) {
  return new Set(group).size;
}

/** 分组质量：被切断的边权占比（越低越好，说明边界落在弱连接上）。 */
export function cutRatio(graph, group) {
  let cut = 0, total = 0;
  const seen = new Set();
  for (let i = 0; i < graph.n; i++) {
    for (const e of graph.neighbors(i)) {
      const key = i < e.id ? i + ':' + e.id : e.id + ':' + i;
      if (seen.has(key)) continue;
      seen.add(key);
      total += e.w;
      if (group[i] !== group[e.id]) cut += e.w;
    }
  }
  return total ? cut / total : 0;
}

/** 从四边形网格直接建图：边权 = 共边长度（长边 = 强连接）。 */
export function graphFromGrid(grid, town, { landOnly = true } = {}) {
  const cells = grid.cells;
  const index = new Int32Array(cells.length).fill(-1);
  const list = [];
  for (let i = 0; i < cells.length; i++) {
    if (landOnly && town.top(cells[i]) <= 0) continue;
    index[i] = list.length;
    list.push(i);
  }
  const neighbors = new Array(list.length);
  for (let k = 0; k < list.length; k++) {
    const cell = cells[list[k]];
    neighbors[k] = [];
    for (let s = 0; s < 4; s++) {
      const nid = cell.edgeNeighbors[s];
      if (nid < 0 || index[nid] < 0) continue;
      // 共边长度：用两格中心距离当代理（格子大小不同时比"1"更真实）
      const nb = cells[nid];
      const w = 1 / (1 + Math.hypot(cell.cx - nb.cx, cell.cz - nb.cz));
      neighbors[k].push({ id: index[nid], w });
    }
  }
  return {
    n: list.length,
    neighbors: (i) => neighbors[i],
    cellIds: list,
  };
}
