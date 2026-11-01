/**
 * flowfield.js — 一张"到目标的流场"，整群单位共用。
 *
 * 原文（x.com/OskSta/status/816748103193817088, 2017-01-04）：
 *
 *   "I'm flowing right on the nav mesh, so it depends"
 *
 * 画面（24 帧，GIF 主体全是俯视的灰色地形）：**几百个白色小钉同时朝同一个方向挪**，
 * 走的是同一条贴着地形的路线；到转角处整团被"挤"过去，宽的地方摊开、窄口收窄。
 *
 * 为什么不是"每个单位各跑一次 A*"：那样 300 个单位 = 300 次搜索，转角处还会各走各的、
 * 看起来像各自为战。流场反过来算一次 —— 从**目标**往回做 Dijkstra 得到"到目标的代价"，
 * 然后每个格子记下"哪个邻居的代价最小"，单位只需要读一格。
 *   建场 O(E log V) × 1
 *   每个单位每帧 O(1)
 *
 * 代价是**有向**的（navgraph 里顺流 0.35 / 逆流 1.35），所以反向 Dijkstra 不能直接
 * 用邻接权：从 v 松弛 u 时用的是 cost(u→v)，不是 cost(v→u)。这一点写错了，流向就会
 * 在河道上整体反掉。
 */

/**
 * @param {object} graph buildNavGraph() 的返回（需要 adj / edgeCost）
 * @param {number} targetId 目标格
 * @returns {{
 *   target:number, dist:Float64Array, dir:Int32Array, reachable:number,
 *   path:(id:number, maxSteps?:number)=>number[], stats:()=>object
 * }}
 */
export function buildFlowField(graph, targetId) {
  const adj = graph.adj;
  const n = adj.length;
  const dist = new Float64Array(n).fill(Infinity);
  const dir = new Int32Array(n).fill(-1);
  if (!(targetId >= 0) || !adj[targetId] || !adj[targetId].length) {
    // 目标本身不可走（比如河口是水）→ 直接给空场，调用方不用特判
    return {
      target: targetId, dist, dir, reachable: 0,
      path: () => [],
      stats: () => ({ target: targetId, reachable: 0, walkable: 0, coverage: 0 }),
    };
  }

  // --- 反向 Dijkstra：从目标出发，沿"别人能走到我"的边回溯 ---
  // 用数组当二叉堆（格子 ~7k，够用；比每次 sort 快，也不用引第三方）
  const heap = [];
  const push = (id, d) => {
    heap.push([d, id]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      const t = heap[p]; heap[p] = heap[i]; heap[i] = t;
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
        const t = heap[m]; heap[m] = heap[i]; heap[i] = t;
        i = m;
      }
    }
    return top;
  };

  // 反向邻接缓存：谁指向我。声明必须放在 Dijkstra 之前 —— 下面那两个 helper 是
  // 函数声明（会提升），但 `rev` 是 const，提升不了：放后面就是 TDZ 报错。
  const rev = new Array(n);

  dist[targetId] = 0;
  push(targetId, 0);
  while (heap.length) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    // v 的邻居里，**能走到 v** 的那些格子，代价 = cost(u→v) + dist[v]
    for (const u of neighborsOf(v)) {
      const c = edgeCostDirected(u, v);
      if (!Number.isFinite(c)) continue;
      const nd = d + c;
      if (nd < dist[u]) { dist[u] = nd; push(u, nd); }
    }
  }

  // --- 方向：每格选"自己出发代价最小"的邻居 ---
  let reachable = 0;
  for (let id = 0; id < n; id++) {
    if (!Number.isFinite(dist[id])) continue;
    reachable++;
    // 这里**不能**用 `total < dist[id]` 当判据：最优邻居的 total 恰好等于 dist[id]，
    // 严格小于永远不成立 → 整张场的 dir 全是 -1（第一版就是这样，走一步就停）。
    // 正确做法是取 argmin，再接受"不大于自己"的那个。
    let best = -1, bestD = Infinity;
    for (const e of adj[id]) {
      const c = edgeCostDirected(id, e.id);
      if (!Number.isFinite(c)) continue;
      const total = c + dist[e.id];
      if (total < bestD) { bestD = total; best = e.id; }
    }
    dir[id] = bestD <= dist[id] + 1e-6 ? best : -1;   // -1 表示自己就是目标
  }

  // 反向邻接：谁指向我。用来做反向 Dijkstra，也顺手缓存，避免每格再扫一遍
  function neighborsOf(v) {
    if (rev[v]) return rev[v];
    const out = [];
    // 4 邻接是无向拓扑，所以 v 的邻接就是"能连到 v 的格子"
    for (const e of adj[v] || []) out.push(e.id);
    rev[v] = out;
    return out;
  }
  function edgeCostDirected(from, to) {
    const outs = adj[from];
    if (!outs) return Infinity;
    for (const e of outs) if (e.id === to) return e.cost;
    return Infinity;
  }

  let walkable = 0;
  for (let i = 0; i < n; i++) if (adj[i] && adj[i].length) walkable++;

  return {
    target: targetId,
    dist,
    dir,
    reachable,
    /** 沿流场走到目标（返回途经格子）。maxSteps 防死循环。 */
    path(id, maxSteps = 4096) {
      const out = [];
      let cur = id, guard = 0;
      while (cur >= 0 && guard++ < maxSteps) {
        out.push(cur);
        if (cur === targetId) break;
        cur = dir[cur];
      }
      return out;
    },
    stats() {
      let maxDist = 0, sumDist = 0;
      for (let i = 0; i < n; i++) {
        if (!Number.isFinite(dist[i])) continue;
        if (dist[i] > maxDist) maxDist = dist[i];
        sumDist += dist[i];
      }
      return {
        target: targetId,
        walkable,
        reachable,
        // 覆盖率：能读到方向的格子占全部可走格子的比例。
        // 岛被河切开时会出现"过不去的一片"，这个数就会掉下来。
        coverage: +(reachable / Math.max(1, walkable)).toFixed(4),
        maxDist: +maxDist.toFixed(3),
        meanDist: +(sumDist / Math.max(1, reachable)).toFixed(3),
      };
    },
  };
}

/**
 * 让 n 个单位沿流场前进，返回每个单位走了几步到目标。
 *
 * 这不是渲染，是**量化**"一张场喂一群"到底省了什么：同样的 n 个单位，
 * 各跑一次 Dijkstra 的耗时和这张场的建场耗时可以直接比。
 */
export function flowCrowd(field, starts, { maxSteps = 512 } = {}) {
  const out = [];
  for (const s of starts) {
    let cur = s, steps = 0;
    while (cur >= 0 && cur !== field.target && steps < maxSteps) {
      cur = field.dir[cur];
      steps++;
    }
    out.push({ start: s, steps, reached: cur === field.target });
  }
  return out;
}
