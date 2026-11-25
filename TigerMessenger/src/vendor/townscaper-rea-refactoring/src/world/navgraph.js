/**
 * navgraph.js — 简化导航图 + 河流加速 + 楼梯。
 *
 * 依据：
 *   1582293326815862786 "my algorithm now tries to expand (and interconnect) a simplified nav graph"
 *     → 走得通的格子按"同一高度连成片"合并成区域节点，区域之间用"台阶边"相连；图很小，可以随时重算。
 *   1795831296952041691 "a navigation structure that lets you travel faster along rivers (and especially downstream)"
 *     → 河格之间的边更便宜，高差优先区分顺逆；平床用河口距离，无法判向时保持中性河道费用。
 *   1181464374839521280 "I made some stairs"
 *     → 落差 1 层的边才能走，并且要有楼梯；每对相邻区域只放一架（最短路树里用到的那条边），避免满地台阶。
 *
 * 纯数据模块（不依赖 three）：buildNav(world, { shape }) → { walk, region, regions, edges, tree, stairs, cost }
 *   walk[id]    这一格能不能站人（地表 = 裸露岩顶 / 码头面）
 *   hgt[id]     站立高度（层）
 *   region[id]  所属区域
 *   tree        从"起点"出发的 Dijkstra 最短路树：parent[id]、time[id]
 *   stairs      [{ low, high, edge }]：low 格的第 edge 条边往上一层到 high
 */

// 地形量化到偶数层（generate.js），一道崖 = 2 层；建筑 / 码头 / 滩是 1 层。楼梯最多爬一道崖。
const MAX_STEP = 2;
const STAIR_COST = 1.8, RIVER_DOWN = 0.3, RIVER_UP = 0.65;

import { archPassage } from '../core/arch-floor-budget.js';
// r56 C09-B（1795831296952041691，默认关）：metric(a,b) 自定义边长（星球用弦长）；slopeStep>0 时落差 ≤slopeStep
// 的非河边当缓坡直接可走（BFS 缓坡地形没有成片同高平台，不该每级都要楼梯），费用 ×SLOPE_COST。
const SLOPE_COST = 1.25;
export function buildNav(world, { start = null, underArches = null, metric = null, slopeStep = 0 } = {}) {
  const cells = world.cells, n = cells.length;
  const walk = new Uint8Array(n), hgt = new Int8Array(n);
  for (const c of cells) {
    const t = world.top(c), g = world.ground(c);
    if (t > 0 && t === g) { walk[c.id] = 1; hgt[c.id] = t; }                 // 裸露地表
    else if (t === 1 && !world.isRock(c, 1)) { walk[c.id] = 1; hgt[c.id] = 1; } // 码头
  }
  // r55 piercefloor (opt-in, default off): a cell under a drawn arch becomes walkable at the arch floor
  // when a unit of underArches.height × radius clears the soffit (archPassage over buildings.js archBudgets).
  const archPass = [];
  if (underArches) for (const rec of underArches.archBudgets ?? []) {
    if (!(rec.floorLevel >= 1) || walk[rec.cell]) continue;
    const p = archPassage(rec, { height: underArches.height, radius: underArches.radius ?? 0 });
    archPass.push({ cell: rec.cell, ok: p.ok, headroom: p.headroom, floorLevel: rec.floorLevel });
    if (p.ok) { walk[rec.cell] = 1; hgt[rec.cell] = rec.floorLevel; }
  }

  // 河：离河口（接水的河格）的步数，用来判断顺流 / 逆流
  const river = world.river, rd = new Int32Array(n).fill(-1);
  const q = [];
  for (const c of cells) if (river[c.id] && c.edgeNeighbors.some((id) => id >= 0 && world.top(cells[id]) === 0)) { rd[c.id] = 0; q.push(c); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    for (const id of c.edgeNeighbors) if (id >= 0 && river[id] && rd[id] < 0) { rd[id] = rd[c.id] + 1; q.push(cells[id]); }
  }

  // Local heuristic, not a reconstruction of the original solver. Height wins:
  // shortcuts between nearby meanders must not label an uphill step downstream.
  // Flat reaches use mouth distance; closed/equidistant reaches stay neutral.
  const network=world.riverNetwork?.version===world.version?world.riverNetwork:null;
  // REACode/navgraph: DFS carve order (generate.carveRivers → World.riverFlow) is the
  // flow direction on flat reaches; only trusted while the World version is unchanged.
  const flow=!network&&world.riverFlow?.version===world.version?world.riverFlow.flowTo:null;
  const riverDirection = (a, b) => {
    if (!river[a.id] || !river[b.id]) return 0;
    const dh = hgt[b.id] - hgt[a.id];
    if (dh) return dh < 0 ? 1 : -1;
    if(network)return network.parent[a.id]===b.id?1:network.parent[b.id]===a.id?-1:0;
    if(flow&&(flow[a.id]===b.id||flow[b.id]===a.id))return flow[a.id]===b.id?1:-1;
    if (rd[a.id] < 0 || rd[b.id] < 0) return 0;
    return Math.sign(rd[a.id] - rd[b.id]);
  };
  const dist = metric ?? ((a, b) => Math.hypot(a.cx - b.cx, a.cz - b.cz));
  const edgeCost = (a, b) => {
    if (!walk[a.id] || !walk[b.id] || !a.edgeNeighbors.includes(b.id) || Math.abs(hgt[a.id] - hgt[b.id]) > MAX_STEP) return Infinity;
    const slope = slopeStep > 0 && hgt[a.id] !== hgt[b.id] && Math.abs(hgt[a.id] - hgt[b.id]) <= slopeStep;
    if (hgt[a.id] !== hgt[b.id] && !slope && !stairSet.has(a.id + '>' + b.id) && !(river[a.id] && river[b.id])) return Infinity;
    let k = hgt[a.id] !== hgt[b.id] ? (slope ? SLOPE_COST : STAIR_COST) : 1;
    if (river[a.id] && river[b.id]) k = riverDirection(a, b) > 0 ? RIVER_DOWN : RIVER_UP;
    return dist(a, b) * k;
  };

  // 简化：同一高度、不跨河岸的连片 → 一个区域
  const region = new Int32Array(n).fill(-1), regions = [];
  for (const c of cells) {
    if (!walk[c.id] || region[c.id] >= 0) continue;
    const r = regions.length, list = [c];
    region[c.id] = r;
    for (let h = 0; h < list.length; h++) {
      const x = list[h];
      for (const id of x.edgeNeighbors) {
        if (id < 0 || region[id] >= 0 || !walk[id] || hgt[id] !== hgt[c.id] || river[id] !== river[c.id]) continue;
        region[id] = r; list.push(cells[id]);
      }
    }
    let sx = 0, sz = 0;
    for (const x of list) { sx += x.cx; sz += x.cz; }
    regions.push({ id: r, h: hgt[c.id], river: !!river[c.id], cells: list, cx: sx / list.length, cz: sz / list.length });
  }

  // 区域之间的边（简化图）+ 楼梯：每对相邻区域只取一条边（离两个区域中心连线中点最近的那条），
  // 落差 1 的那条上放楼梯；寻路只允许走有楼梯的落差边 —— 画出来的和走得通的是同一回事
  const edges = new Map();
  for (const a of cells) {
    if (!walk[a.id]) continue;
    for (let i = 0; i < a.n; i++) {
      const bid = a.edgeNeighbors[i];
      if (bid < 0 || !walk[bid] || region[bid] <= region[a.id]) continue;
      const dh = hgt[bid] - hgt[a.id];
      if (Math.abs(dh) > MAX_STEP) continue;
      const b = cells[bid], ra = regions[region[a.id]], rb = regions[region[bid]];
      const mx = (ra.cx + rb.cx) / 2 - (a.cx + b.cx) / 2, mz = (ra.cz + rb.cz) / 2 - (a.cz + b.cz) / 2;
      const score = mx * mx + mz * mz;
      const key = region[a.id] + ':' + region[bid];
      const prev = edges.get(key);
      if (!prev || score < prev.score) edges.set(key, { a: ra.id, b: rb.id, dh, score, cellA: a, cellB: b });
    }
  }
  const stairs = [], stairSet = new Set();
  for (const e of edges.values()) {
    if (!e.dh || (river[e.cellA.id] && river[e.cellB.id])) continue;
    const low = e.dh > 0 ? e.cellA : e.cellB, high = e.dh > 0 ? e.cellB : e.cellA;
    stairs.push({ low, high, edge: low.edgeNeighbors.indexOf(high.id), rise: Math.abs(e.dh) });
    stairSet.add(low.id + '>' + high.id); stairSet.add(high.id + '>' + low.id);
  }

  // 起点：给定格 / 否则最大的区域里离中心最近的格
  if (!start || !walk[start.id]) {
    const big = regions.reduce((a, b) => (b.cells.length > (a?.cells.length ?? 0) ? b : a), null);
    start = big ? big.cells.reduce((a, b) => (Math.hypot(b.cx - big.cx, b.cz - big.cz) < Math.hypot(a.cx - big.cx, a.cz - big.cz) ? b : a)) : null;
  }

  // Dijkstra（二叉堆）
  const time = new Float64Array(n).fill(Infinity), parent = new Int32Array(n).fill(-1);
  if (start) {
    const heap = [[0, start.id]];
    time[start.id] = 0;
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [t, id] = pop();
      if (t > time[id]) continue;
      const a = cells[id];
      for (const bid of a.edgeNeighbors) {
        if (bid < 0) continue;
        const nt = t + edgeCost(a, cells[bid]);
        if (nt < time[bid]) { time[bid] = nt; parent[bid] = id; push([nt, bid]); }
      }
    }
  }

  // 只留最短路树真正用到的楼梯（每片区域一架通向起点就够了，满山台阶反而乱）
  const used = stairs.filter((st) => parent[st.high.id] === st.low.id || parent[st.low.id] === st.high.id);

  return { cost: edgeCost, walk, hgt, region, regions, edges: [...edges.values()], start, tree: { parent, time }, stairs: used, stairCandidates: stairs.length, riverDist: rd, riverDirection, flowSource: network ? 'network' : flow ? 'carve' : 'mouthDistance', underArches: archPass };
}

/* ---- REACode/navgraph.js 接口迁移：findPath / stats / simplify，全部复用上面的共享边价 ---- */
const walkCost = (nav, a, b) => {
  const k = nav.cost(a, b);
  if (!Number.isFinite(k)) return Infinity;
  return Math.hypot(a.cx - b.cx, a.cz - b.cz) * (nav.hgt[a.id] !== nav.hgt[b.id] ? STAIR_COST : 1);
};
/** Dijkstra between two cells on the shared directed costs; ignoreRivers = same edges priced as walking. */
export function findNavPath(world, nav, from, to, { ignoreRivers = false } = {}) {
  const cells = world.cells, n = cells.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const price = ignoreRivers ? (a, b) => walkCost(nav, a, b) : nav.cost;
  if (!from || !to || !nav.walk[from.id] || !nav.walk[to.id]) return { path: [], cost: Infinity };
  const heap = [[0, from.id]];dist[from.id] = 0;
  while (heap.length) {
    let bi = 0;for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
    const [d, id] = heap[bi];heap[bi] = heap[heap.length - 1];heap.pop();
    if (d > dist[id]) continue;if (id === to.id) break;
    for (const nb of cells[id].edgeNeighbors) { if (nb < 0) continue;const nd = d + price(cells[id], cells[nb]);if (nd < dist[nb]) { dist[nb] = nd;prev[nb] = id;heap.push([nd, nb]); } }
  }
  if (!Number.isFinite(dist[to.id])) return { path: [], cost: Infinity };
  const path = [];for (let id = to.id; id >= 0; id = prev[id]) { path.push(id);if (id === from.id) break; }
  return { path: path.reverse(), cost: dist[to.id] };
}
/** speedup = same-route walking / river price; detour = river optimum / walking optimum; upDownRatio = upstream / downstream. */
export function riverRouteStats(world, nav, from, to) {
  const cells = world.cells, down = findNavPath(world, nav, from, to);
  if (!down.path.length) return null;
  const up = findNavPath(world, nav, to, from), plain = findNavPath(world, nav, from, to, { ignoreRivers: true });
  let same = 0;for (let i = 1; i < down.path.length; i++) same += walkCost(nav, cells[down.path[i - 1]], cells[down.path[i]]);
  return { from: from.id, to: to.id, steps: down.path.length - 1, riverCells: down.path.filter((id) => world.river[id]).length, costRiver: down.cost, costSamePathWalk: same, costWalkOptimal: plain.cost, speedup: same / down.cost, detour: down.cost / plain.cost, upDownRatio: up.cost / down.cost, path: down.path };
}
/** Junction graph (1582293326815862786 "simplified nav graph"): nodes = degree≠2 cells of the
 * kept walkable subgraph, edges = directed corridor chains with summed directed cost. */
export function simplifyNav(world, nav, { keep = null } = {}) {
  const cells = world.cells, n = cells.length, adj = Array.from({ length: n }, () => []);
  for (const a of cells) { if (!nav.walk[a.id] || (keep && !keep(a.id))) continue;
    for (const b of a.edgeNeighbors) if (b >= 0 && (!keep || keep(b)) && Number.isFinite(nav.cost(a, cells[b])) && Number.isFinite(nav.cost(cells[b], a))) adj[a.id].push(b); }
  const isNode = (id) => adj[id].length > 0 && adj[id].length !== 2, nodes = [], edges = [];
  for (let id = 0; id < n; id++) if (isNode(id)) nodes.push(id);
  for (const start of nodes) for (const first of adj[start]) {
    let prev = start, cur = first, cost = nav.cost(cells[start], cells[first]), back = nav.cost(cells[first], cells[start]);const via = [];
    while (!isNode(cur) && via.length <= n) { via.push(cur);const next = adj[cur][0] === prev ? adj[cur][1] : adj[cur][0];cost += nav.cost(cells[cur], cells[next]);back += nav.cost(cells[next], cells[cur]);prev = cur;cur = next; if (cur === start) break; }
    if (isNode(cur)) edges.push({ from: start, to: cur, cost, reverseCost: back, via });
  }
  const walkable = adj.filter((l) => l.length).length;
  return { nodes, edges, walkable, compression: walkable ? nodes.length / walkable : 0 };
}
