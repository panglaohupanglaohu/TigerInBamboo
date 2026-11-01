/**
 * borderpath.js — 在三角网上"沿着边走"出一条边境线。
 *
 * 原文（x.com/OskSta/status/1097458505315946496, 2019-02-18）：
 *
 *   "The Viking frontier in @BadNorthGame is dripping with funky math:
 *    1. Triangulate (with some added padding)
 *    2. Walk on triangle edges alo[ng]..."
 *
 * 画面观察（18 帧 @0.25s）：
 *   · 0s：一层**完整的 Delaunay 三角网**，节点是大小不一的圆形徽记；
 *   · 0.5~2s：三角边一条条被"抽掉"，只剩下一条深色线在网里绕 —— 线沿三角边走，
 *     但**绕开节点**：经过节点附近时是贴着圆的外侧弧过去，不是穿过圆心；
 *   · 2.5s 起：线继续延展，分出岔路，最后接上地名词条（Northeast / West / Shadow …）。
 *
 * 所以"walk on triangle edges"不是"沿节点连成的折线走"，而是**在三角网的边上走**，
 * 且把节点半径当作障碍（padding）。这正是本文件做的事：
 *
 *   1. 三角化（`delaunay2D`，第 10 轮球面三角化那套）
 *   2. 建"边图"：每条三角边是一个**边节点**，它的邻居是同一三角形里的另外两条边
 *   3. 在边图上跑 A*，代价 = 边长 + 节点圆内的惩罚（padding）
 *   4. 输出边中点序列 → 一条连续折线
 *
 * 为什么不用"节点图 + A*"：那样路径是**穿过节点中心**的直线段，和画面里"绕着徽记走"
 * 完全不一样；而且节点图会退化成"最近邻连点"，看起来像扫雷而不是边境线。
 */
import { delaunay2D } from '../engine/sphere.js';

// ---------------------------------------------------------------- 采样
/** 变半径泊松圆盘：节点大小不一，且互不重叠（原文 "nodes of varying sizes"）。 */
export function scatterNodes(w, h, { minR = 0.34, maxR = 0.72, gap = 1.12, seed = 7, tries = 40 } = {}) {
  let s = (seed * 22695477 + 1) | 0;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 8) / 16777216;
  const out = [];
  let guard = 0;
  while (guard++ < 6000) {
    const x = minR + rnd() * (w - minR * 2);
    const y = minR + rnd() * (h - minR * 2);
    const r = minR + rnd() * (maxR - minR);
    let ok = true;
    for (const n of out) {
      const d = Math.hypot(n.x - x, n.y - y);
      // gap 是"圆心距 / 半径和"。第一版写成 0.5*gap + 0.2*min(r)，
      // 算下来圆心距只有半径和的 0.675 倍 —— **圆是重叠的**，于是三角网里
      // 一半的边中点落在圆内，路径根本绕不开（clearance 一直是负数）。
      // 取 1.14 表示圆心距 = 半径和的 1.14 倍，圆之间留出 14% 的缝。
      if (d < (n.r + r) * gap) { ok = false; break; }
    }
    if (ok && out.length < tries * 3) out.push({ x, y, r });
  }
  return out;
}

// ---------------------------------------------------------------- 边图
/**
 * 把三角网变成"边图"。
 * 每条边一个节点：{ id, a, b, mx, my, tris }，邻居 = 共用一个三角形的其它边。
 */
export function buildEdgeGraph(pts, tris) {
  const key = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
  const edges = new Map();
  const edgeList = [];
  const vid = (k) => {
    let e = edges.get(k);
    if (e) return e;
    e = edgeList.length;
    edges.set(k, e);
    const [a, b] = k.split('_').map(Number);
    edgeList.push({
      id: e, a, b,
      mx: (pts[a][0] + pts[b][0]) / 2,
      my: (pts[a][1] + pts[b][1]) / 2,
      tris: [],
    });
    return e;
  };
  for (const t of tris) {
    const e0 = vid(key(t[0], t[1]));
    const e1 = vid(key(t[1], t[2]));
    const e2 = vid(key(t[2], t[0]));
    const ids = [e0, e1, e2];
    for (const e of ids) edgeList[e].tris.push(t);
    // 三角形内两两相邻
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const A = edgeList[ids[i]], B = edgeList[ids[j]];
        (A.nb || (A.nb = [])).push(ids[j]);
        (B.nb || (B.nb = [])).push(ids[i]);
      }
    }
  }
  return { edges: edgeList, index: edges };
}

// ---------------------------------------------------------------- 寻路
/**
 * 在边图上走一条从 (x0,y0) 到 (x1,y1) 的路径。
 *
 * 代价：
 *   基础 = 两个边中点之间的距离
 *   padding = 边中点到最近节点的"侵入量"（落在节点圆内就贵）—— 这就是原文里的
 *             "with some added padding"：三角化时给节点留了内边距，路径于是绕开徽记。
 */
export function walkBorder(pts, tris, from, to, nodes, { padding = 1.0, nodeWeight = 8, wander = 0.25, edgeRepel = 3.2 } = {}) {
  const { edges } = buildEdgeGraph(pts, tris);
  const n = edges.length;
  if (!n) return { path: [], length: 0 };

  // 每个边节点的惩罚：越靠近最近节点圆心越贵
  const pen = new Float32Array(n);
  for (const e of edges) {
    let best = Infinity;
    for (const nd of nodes) {
      const d = Math.hypot(e.mx - nd.x, e.my - nd.y) - nd.r * padding;
      if (d < best) best = d;
    }
    // d < 0 表示落在圆内：按侵入深度给惩罚
    pen[e.id] = best >= 0 ? 0 : nodeWeight * Math.min(1, -best / 0.9);
  }

  // 每条边的"地形成本"：纯 A* 会走一条几乎贴着上边界的最短路（实测绕行比只有 1.06，
  // 看起来像一条拉直的电线）；参考帧里的边境线是上下摆动的。给每条边加一点
  // 确定性的成本噪声，路径就会自然地在图的上下摆动 —— 这就是那个 "funky math" 的手感。
  const jitter = new Float32Array(n);
  for (const e of edges) {
    let h = Math.imul(e.id * 2654435761 + 1013904223, 2246822519);
    h ^= h >>> 13;
    jitter[e.id] = ((h >>> 0) / 4294967296) * 2 - 1;
  }

  // 贴边惩罚：纯最短路会沿着图的上边界拉一条直线（实测离边不到 1 个单位），
  // 而参考帧的边境线是在图的中部蜿蜒的。给"离上下边界太近"的边加成本。
  let minY = Infinity, maxY = -Infinity;
  for (const e of edges) { minY = Math.min(minY, e.my); maxY = Math.max(maxY, e.my); }
  const span = Math.max(1e-6, maxY - minY);
  const edgePen = new Float32Array(n);
  for (const e of edges) {
    const t = (e.my - minY) / span;          // 0 = 底边，1 = 顶边
    const d = Math.min(t, 1 - t);            // 到最近横边的归一化距离
    edgePen[e.id] = d < 0.24 ? edgeRepel * (1 - d / 0.24) : 0;
  }

  const dist = (a, b) => Math.hypot(edges[a].mx - edges[b].mx, edges[a].my - edges[b].my);
  const nearestEdge = (x, y) => {
    let bi = 0, bd = Infinity;
    for (const e of edges) {
      const d = Math.hypot(e.mx - x, e.my - y);
      if (d < bd) { bd = d; bi = e.id; }
    }
    return bi;
  };

  const start = nearestEdge(from.x, from.y);
  const goal = nearestEdge(to.x, to.y);

  // A*（节点少，二叉堆都嫌重，直接用数组）
  const g = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const open = new Set([start]);
  g[start] = 0;
  const h = (i) => Math.hypot(edges[i].mx - edges[goal].mx, edges[i].my - edges[goal].my);

  let guard = 0;
  while (open.size && guard++ < 20000) {
    let cur = -1, best = Infinity;
    for (const i of open) {
      const f = g[i] + h(i);
      if (f < best) { best = f; cur = i; }
    }
    if (cur === goal) break;
    open.delete(cur);
    for (const nb of edges[cur].nb || []) {
      const cost = dist(cur, nb) * (1 + pen[nb] + edgePen[nb]) * (1 + wander * jitter[nb]);
      if (g[cur] + cost < g[nb]) {
        g[nb] = g[cur] + cost;
        came[nb] = cur;
        open.add(nb);
      }
    }
  }

  if (came[goal] < 0 && goal !== start) return { path: [], length: 0, reason: 'unreachable' };

  const path = [];
  for (let i = goal; i >= 0; i = came[i]) {
    path.push([edges[i].mx, edges[i].my]);
    if (i === start) break;
  }
  path.reverse();

  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);

  // 量化：绕行比、转折数、离节点的最小距离
  const straight = Math.hypot(to.x - from.x, to.y - from.y);
  let minNode = Infinity;
  for (const p of path) {
    for (const nd of nodes) {
      minNode = Math.min(minNode, Math.hypot(p[0] - nd.x, p[1] - nd.y) - nd.r);
    }
  }
  let turns = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const a = Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]);
    const b = Math.atan2(path[i + 1][1] - path[i][1], path[i + 1][0] - path[i][0]);
    let d = Math.abs(a - b);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d > 0.25) turns++;
  }

  return {
    path,
    length: +len.toFixed(3),
    straight: +straight.toFixed(3),
    detour: +(len / Math.max(straight, 1e-6)).toFixed(3),
    turns,
    clearance: +minNode.toFixed(3),   // > 0 表示整条线都没有压进任何一个节点圆
  };
}

/** 一次算完：撒点 → 三角化 → 走线。 */
export function buildBorder({ w = 16, h = 10, seed = 7, count = 26, from, to, padding = 1.0 } = {}) {
  const nodes = scatterNodes(w, h, { seed });
  const pts = nodes.map((p) => [p.x, p.y]);
  const tris = delaunay2D(pts);
  // 默认取"最左 → 最右"两个节点：参考帧里的边境线是横穿整张地图的，
  // 如果随便取首尾两个点，路径只会在中间拐一下，看不出"沿着边走"的样子。
  const leftMost = pts.reduce((a, b) => (b[0] < a[0] ? b : a), pts[0]);
  const rightMost = pts.reduce((a, b) => (b[0] > a[0] ? b : a), pts[0]);
  const f = from || { x: leftMost[0], y: leftMost[1] };
  const t = to || { x: rightMost[0], y: rightMost[1] };
  const route = walkBorder(pts, tris, f, t, nodes, { padding });
  const { edges } = buildEdgeGraph(pts, tris);
  void count;
  return {
    nodes, pts, tris, edges, route,
    stats: {
      nodes: nodes.length,
      tris: tris.length,
      edgeNodes: edges.length,
      turns: route.turns,
      detour: route.detour,
      clearance: route.clearance,
      straight: route.straight,
      length: route.length,
    },
  };
}
