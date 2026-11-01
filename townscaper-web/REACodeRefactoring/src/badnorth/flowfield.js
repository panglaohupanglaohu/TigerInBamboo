/**
 * flowfield.js — Bad North 的流场 / 影响场（多源 Dijkstra + 数据继承）。
 *
 * 依据：
 *   972829402873716737 "the triangular flow fields we use for pathfinding and combat"（GDC 微型演讲）
 *     画面：岛上铺满彩色细线，每条线从单位那里一路分叉出去。
 *   901842167508992000 "Made my flow/influence fields even smarter: In addition to distance and direction to nearest unit,
 *     it can now tell you what type they are"
 *   902069261304287232 "visualization of data inheritance in my flow/distance/influence fields"
 *     画面：粉 / 蓝 / 黄三种颜色的树状线，颜色 = 这一格的数据是从哪个单位"继承"来的。
 *
 * 做法：所有源（某一方的单位）同时入堆，在可走格子上做 Dijkstra（台阶 / 楼梯规则和 navgraph 一致）；
 *   每格记下：dist（到最近源的代价）、parent（往源走的下一格 = 流向）、以及从 parent 一路继承下来的源数据
 *   （源的编号、兵种）。查询任意格都是 O(1)：最近的敌人在哪、多远、是什么兵种、往哪走。
 *   每帧只重算一次，代价和单位数量无关（比 n² 的"找最近敌人"便宜）。
 */

export function buildFlowField(world, nav, sources) {
  const cells = world.cells, n = cells.length;
  const dist = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const src = new Int32Array(n).fill(-1);       // 继承来的源序号
  const heap = [];
  const push = (d, id) => { heap.push([d, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  sources.forEach((s, k) => {
    if (!s.cell || !nav.walk[s.cell.id]) return;
    if (0 < dist[s.cell.id]) { dist[s.cell.id] = 0; src[s.cell.id] = k; push(0, s.cell.id); }
  });
  while (heap.length) {
    const [d, id] = pop();
    if (d > dist[id]) continue;
    const a = cells[id];
    for (let i = 0; i < a.n; i++) {
      const bid = a.edgeNeighbors[i];
      if (bid < 0 || !nav.walk[bid]) continue;
      const dh = Math.abs(nav.hgt[bid] - nav.hgt[id]);
      if (dh > 2) continue;
      const b = cells[bid];
      // Reverse edge: distance is FROM this neighbor TO the source.
      // Reuse the navigation graph's stairs and directed river costs.
      const cost = nav.cost ? nav.cost(b, a) : Math.hypot(a.cx - b.cx, a.cz - b.cz) * (dh ? 1.8 : 1);
      if (!Number.isFinite(cost)) continue;
      const nd = d + cost;
      if (nd < dist[bid]) { dist[bid] = nd; parent[bid] = id; src[bid] = src[id]; push(nd, bid); }   // 数据继承：沿父格一路传下来
    }
  }
  return {
    dist, parent, src, sources,
    /** 这一格：最近的源（含兵种等数据）、距离、往它走的下一格 */
    at(cell) { if (!cell) return null; const k = src[cell.id]; return k < 0 ? null : { source: sources[k], dist: dist[cell.id], next: parent[cell.id] >= 0 ? cells[parent[cell.id]] : cell }; },
  };
}
