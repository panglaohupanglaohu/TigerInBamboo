/**
 * navgraph.js — 带"水道加速"的导航图。
 *
 * 原文（x.com/OskSta/status/1795831296952041691, 2024-05-29）：
 *
 *   "I'm putting together a navigation structure that lets you travel faster
 *    along rivers (and especially downstream)"
 *
 * 画面（24 帧，看总览图）：
 *   · 岛是黄绿色台地，河在台地之间绕，河道本身是灰白色带蓝边的窄条；
 *   · 沿河有一条**黄色折线**，线上的白色小点是路径节点（第 8~14 帧最清楚）；
 *   · 起点在下游河口，线顺着河往上爬，到某处**离开河道沿台地边缘继续走**；
 *   · 同一段河道，顺流那一侧的黄线更"贴"河心，逆流时线会往岸上偏一格 ——
 *     这是"下游更快"在画面上唯一的痕迹（同一对格子，两个方向的权重不同）。
 *
 * 所以这不是"寻路"这个老问题的新解法，而是**边的权重函数**：
 *   顺流 0.35、逆流 1.35、普通台地 1.0（再按高差加惩罚）。
 * 路径本身仍是 Dijkstra；区别只在于同一段河在两个方向上有两个价。
 *
 * 这一层刻意做成**纯数据**（不 import three），这样能在 node 里直接量：
 * 见 `stats()` 里的 routeCostOnRiver / routeCostOffRiver 与 upDownRatio。
 */

/**
 * @param {object} town 体素场（只读：用 town.top(cell)）
 * @param {object} grid 四边形网格（用 cell.edgeNeighbors / cx / cz）
 * @param {{cells:number[]}} rivers carveRivers() 的结果
 * @param {object} opts
 */
export function buildNavGraph(town, grid, rivers, {
  downstream = 0.35,   // 顺流一格的代价倍率（原文"especially downstream"）
  upstream = 1.35,     // 逆流（要顶水走，慢）
  slopePenalty = 0.55, // 每高差一级的额外代价（非河道）
  riverBonusAll = 0,   // 只要在河里就减的固定项（0 = 严格按方向，不按"是不是河"）
} = {}) {
  const cells = grid.cells;
  const riverSet = new Set(rivers && rivers.cells ? rivers.cells : []);
  const height = new Float64Array(cells.length);
  for (let i = 0; i < cells.length; i++) height[i] = town.top(cells[i]);

  // 河道"流向"：**不能靠高差判断**。
  // carveRivers 把每条河削成几段平台（同一段里 height 完全相同），实测 156 条
  // 河道内部有向边里 152 条是"平"的，只有 4 条能看出高差 —— 按高差定流向会
  // 让绝大多数河段两边权重一样，"下游更快"就消失了。
  // 真正的流向是**开凿顺序**：DFS 从源头走到河口，相邻两个格子就是一顺一逆。
  const flowTo = new Int32Array(cells.length).fill(-1);
  if (rivers && rivers.paths) {
    for (const path of rivers.paths) {
      for (let i = 0; i + 1 < path.length; i++) flowTo[path[i]] = path[i + 1];
    }
  }

  // 到河口的水路距离（只在河道格子上 BFS）。
  // 为什么还要这一层：河道格子之间除了"上/下一格"还有横向相邻的边（两条河汇流、
  // 或者 DFS 在平地上折了一下），这些边按开凿顺序看不出方向。用"离河口几步"
  // 当第二判据，横向边也能分出顺逆。
  const toMouth = new Int32Array(cells.length).fill(-1);
  if (rivers && rivers.mouths) {
    const q = [];
    for (const m of rivers.mouths) if (riverSet.has(m)) { toMouth[m] = 0; q.push(m); }
    for (let qi = 0; qi < q.length; qi++) {
      const id = q[qi];
      const c = cells[id];
      for (let i = 0; i < 4; i++) {
        const nid = c.edgeNeighbors[i];
        if (nid < 0 || !riverSet.has(nid) || toMouth[nid] >= 0) continue;
        toMouth[nid] = toMouth[id] + 1;
        q.push(nid);
      }
    }
  }

  const edgeCost = (from, to) => {
    const dh = height[to] - height[from];
    let cost = 1 + Math.abs(dh) * slopePenalty;
    if (riverSet.has(from) && riverSet.has(to)) {
      // 三个判据，优先级从硬到软：开凿顺序 > 离河口距离 > 高差
      const dm = toMouth[from], dn = toMouth[to];
      const closer = dm >= 0 && dn >= 0 ? (dn < dm ? 1 : dn > dm ? -1 : 0) : 0;
      const isDown = flowTo[from] === to || (flowTo[from] < 0 && closer === 1) ||
                     (flowTo[from] < 0 && closer === 0 && dh < 0);
      const isUp = flowTo[to] === from || (flowTo[to] < 0 && closer === -1) ||
                   (flowTo[to] < 0 && closer === 0 && dh > 0);
      if (isDown && !isUp) cost *= downstream;
      else if (isUp && !isDown) cost *= upstream;
      else cost *= 1 + riverBonusAll;
    }
    return cost;
  };

  /** 邻接表：只装走得到的格子（top>0 或河道）。 */
  const adj = new Array(cells.length);
  for (let id = 0; id < cells.length; id++) {
    const c = cells[id];
    if (!c || (height[id] <= 0 && !riverSet.has(id))) { adj[id] = []; continue; }
    const list = [];
    for (let i = 0; i < 4; i++) {
      const nid = c.edgeNeighbors[i];
      if (nid < 0) continue;
      if (height[nid] <= 0 && !riverSet.has(nid)) continue;   // 不下水
      list.push({ id: nid, cost: edgeCost(id, nid) });
    }
    adj[id] = list;
  }

  /** 二叉堆 Dijkstra（格子数 ~2.4k，堆比排序快一个量级）。 */
  function findPath(from, to, { ignoreRivers = false } = {}) {
    if (from === to) return { path: [from], cost: 0 };
    const n = cells.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    const heap = [[0, from]];
    dist[from] = 0;
    const push = (d, id) => {
      heap.push([d, id]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };

    while (heap.length) {
      const [d, id] = pop();
      if (done[id]) continue;
      done[id] = 1;
      if (id === to) break;
      for (const e of adj[id]) {
        const w = ignoreRivers ? 1 + Math.abs(height[e.id] - height[id]) * slopePenalty : e.cost;
        const nd = d + w;
        if (nd < dist[e.id]) { dist[e.id] = nd; prev[e.id] = id; push(nd, e.id); }
      }
    }
    if (!Number.isFinite(dist[to])) return { path: [], cost: Infinity };
    const path = [];
    for (let id = to; id >= 0; id = prev[id]) { path.push(id); if (id === from) break; }
    path.reverse();
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      cost += ignoreRivers ? 1 + Math.abs(height[path[i]] - height[path[i - 1]]) * slopePenalty
                           : edgeCost(path[i - 1], path[i]);
    }
    return { path, cost };
  }

  /** 这条路上"按走路价"要多少（用于和河道价对比同一条路线的加速比）。 */
  function walkCostOf(path) {
    let c = 0;
    for (let i = 1; i < path.length; i++) {
      c += 1 + Math.abs(height[path[i]] - height[path[i - 1]]) * slopePenalty;
    }
    return c;
  }

  /**
   * 量化。三种量别混：
   *   · speedup      = 同一条路线的走路价 / 河道价  ← "沿河更快"的直接证据
   *   · detour       = 河道最优路线 / 走路最优路线  ← 绕路代价（>1 表示河绕远了）
   *   · upDownRatio  = 逆流价 / 顺流价              ← "尤其下游"的直接证据
   */
  function stats({ from, to } = {}) {
    const walkable = (id) => id >= 0 && adj[id] && adj[id].length > 0;
    let start = from;
    let end = to;
    if (start === undefined) {
      // 默认：最高的河道格 → 河口（顺流）
      let best = -1, bestH = -1;
      for (const id of riverSet) if (walkable(id) && height[id] > bestH) { bestH = height[id]; best = id; }
      start = best;
    }
    if (end === undefined) {
      // 河口本身就是水（adj 为空），所以退一格取"河里最后一个走得到的格子"：
      // 这是导航图里真实的终点 —— 再往前就要下水了，而这一层没有船。
      const mouths = (rivers && rivers.mouths) || [];
      const near = [];
      for (const m of mouths) {
        if (walkable(m)) { near.push(m); continue; }
        const c = cells[m];
        if (!c) continue;
        for (let i = 0; i < 4; i++) {
          const nid = c.edgeNeighbors[i];
          if (nid >= 0 && riverSet.has(nid) && walkable(nid)) { near.push(nid); break; }
        }
      }
      end = near.length ? near[0] : -1;
    }
    if (!walkable(end)) return [];
    // 起点可能被封在孤岛上（河道格子被水围住时 adj 为空）——按高度从高到低
    // 依次试，取第一条真的走得通的路线。实测 seed 13 就是这种情况。
    let down = { path: [], cost: Infinity };
    if (start !== undefined && walkable(start)) {
      if (!Number.isFinite(start) || !adj[start]) return [];
      down = findPath(start, end);
    }
    if (!down.path.length) {
      const cands = [...riverSet].filter((id) => walkable(id) && id !== end)
        .sort((a, b) => height[b] - height[a]);
      for (const id of cands) {
        const r = findPath(id, end);
        if (r.path.length) { start = id; down = r; break; }
      }
    }
    if (!down.path.length) return [];
    const up = findPath(end, start);
    const plain = findPath(start, end, { ignoreRivers: true });
    const sameWalk = walkCostOf(down.path);
    const riverCells = down.path.filter((id) => riverSet.has(id)).length;
    return [{
      from: start, to: end,
      steps: down.path.length - 1,
      riverCells,
      costRiver: +down.cost.toFixed(3),
      costSamePathWalk: +sameWalk.toFixed(3),
      costWalkOptimal: +plain.cost.toFixed(3),
      speedup: down.cost > 0 ? +(sameWalk / down.cost).toFixed(3) : 1,
      detour: plain.cost > 0 ? +(down.cost / plain.cost).toFixed(3) : 1,
      upDownRatio: down.cost > 0 ? +(up.cost / down.cost).toFixed(3) : 1,
      path: down.path,
    }];
  }

  /**
   * 把格子图压成"路口图"（原文 1582293326815862786：只在坍缩边缘附近枚举，
   * 然后把一张**简化的导航图**扩张/互联）。
   *
   * 为什么需要压缩：格子数 ~6.8k，但真正做决策的地方只有"岔路口"。
   * 度数为 2 的格子只是走廊，除了耗时没有任何信息量。
   *   · 节点 = 度数 ≠ 2 的格子（路口 degree≥3、死胡同 degree 1）
   *   · 边   = 沿走廊一路走到底的那条链，权重 = 沿途边权之和
   *
   * 注意边权是**有向的**（顺流 0.35 / 逆流 1.35），所以压缩后也要按方向分别存，
   * 不能当成无向图再对称化 —— 那样"下游更快"就被抹平了。
   */
  function simplify({ degreeThreshold = 3, keep = null } = {}) {
    const n = cells.length;
    // keep：只在"子图"上压缩。踩过的坑：直接在整张 4 邻接网格上压缩毫无意义 ——
    // 4 邻接里绝大多数格子的度数就是 4，全被判成路口，压缩比 1.00（实测
    // 1,011 路口 / 3,890 边、走廊中位长度 1）。原文那张图是**坍缩边缘**上的
    // 图（崖沿线、河道），那里的格子才真的是一条条走廊。
    const sub = new Array(n);
    for (let i = 0; i < n; i++) {
      if (!adj[i] || !adj[i].length) { sub[i] = []; continue; }
      if (keep && !keep(i)) { sub[i] = []; continue; }
      sub[i] = keep ? adj[i].filter((e) => keep(e.id)) : adj[i];
    }
    const deg = new Int32Array(n);
    for (let i = 0; i < n; i++) deg[i] = sub[i].length;
    const isNode = (i) => deg[i] !== 2 && deg[i] > 0;
    const nodeIds = [];
    const nodeIndex = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) if (isNode(i)) { nodeIndex[i] = nodeIds.length; nodeIds.push(i); }

    const edges = [];
    for (const start of nodeIds) {
      for (const e of sub[start] || []) {
        let prev = start, cur = e.id, cost = e.cost, guard = 0, via = [];
        while (!isNode(cur) && guard++ < 4096) {
          via.push(cur);
          const outs = sub[cur] || [];
          if (outs.length !== 2) break;
          const step = outs[0].id === prev ? outs[1] : outs[0];
          cost += step.cost;
          prev = cur;
          cur = step.id;
        }
        if (isNode(cur)) {
          edges.push({ from: start, to: cur, cost, via });
        }
      }
    }
    // 每个节点一条邻接表（有向）
    const out = new Map(nodeIds.map((id) => [id, []]));
    for (const e of edges) out.get(e.from).push(e);
    return {
      nodes: nodeIds,
      nodeIndex,
      edges,
      out,
      degreeOf: (id) => deg[id],
      /** 在路口图上跑 Dijkstra（返回 cost 与途经节点）。 */
      path(fromCell, toCell) {
        const a = nearestNode(fromCell, sub), b = nearestNode(toCell, sub);
        if (a < 0 || b < 0) return { cost: Infinity, nodes: [] };
        const dist = new Map(nodeIds.map((id) => [id, Infinity]));
        const prev = new Map();
        dist.set(a, 0);
        const open = [[0, a]];
        while (open.length) {
          open.sort((p, q) => p[0] - q[0]);
          const [d, id] = open.shift();
          if (d > dist.get(id)) continue;
          if (id === b) break;
          for (const e of out.get(id)) {
            const nd = d + e.cost;
            if (nd < dist.get(e.to)) { dist.set(e.to, nd); prev.set(e.to, id); open.push([nd, e.to]); }
          }
        }
        const path = [];
        for (let id = b; id !== undefined && id >= 0; id = prev.get(id)) { path.push(id); if (id === a) break; }
        return { cost: dist.get(b), nodes: path.reverse() };
      },
      /** 把格子映射到"最近的路口"（压缩图的外部接口需要它）。 */
      nearestNode,
      stats: {
        cells: n,
        walkable: sub.reduce((acc, l) => acc + (l.length ? 1 : 0), 0),
        nodes: nodeIds.length,
        edges: edges.length,
        junctionRatio: +(nodeIds.length / Math.max(1, n)).toFixed(4),
        avgEdgeCells: +(edges.reduce((acc, e) => acc + e.via.length + 1, 0) / Math.max(1, edges.length)).toFixed(2),
      },
    };
  }

  function nearestNode(cellId, subAdj = adj) {
    if (cellId < 0) return -1;
    if (subAdj[cellId] && subAdj[cellId].length !== 2) return cellId;
    // 走廊里的格子：沿两个方向各走一段，取先碰到的路口（比较代价不比较步数）
    let best = -1, bestCost = Infinity;
    for (const e of subAdj[cellId] || []) {
      let prev = cellId, cur = e.id, cost = e.cost, guard = 0;
      while (guard++ < 4096) {
        if (subAdj[cur] && subAdj[cur].length !== 2) {
          if (cost < bestCost) { bestCost = cost; best = cur; }
          break;
        }
        const outs = subAdj[cur] || [];
        if (outs.length !== 2) break;
        const step = outs[0].id === prev ? outs[1] : outs[0];
        cost += step.cost;
        prev = cur;
        cur = step.id;
      }
    }
    return best;
  }

  return {
    adj,
    height,
    riverSet,
    isRiver: (id) => riverSet.has(id),
    edgeCost,
    findPath,
    stats,
    simplify,
    cellCount: cells.length,
    riverCount: riverSet.size,
  };
}
