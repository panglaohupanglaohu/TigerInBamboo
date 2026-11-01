/**
 * holenav.js — 在"满是洞"的模块化结构里走：门洞图（portal graph）。
 *
 * 原文两条（同一件事的前后两年）：
 *   x.com/OskSta/status/797119718477991936, 2016-11-11
 *     "Got some basic navigation going"
 *   x.com/OskSta/status/906425294533394432, 2017-09-09
 *     "It's like navigating a Swiss cheese"
 *
 * 画面：
 *   · 7971（2016）：空平台上模块一格一格长出来（拱、塔、台阶），长完之后白点出现在结构**内部**
 *     并沿着拱门穿行，右下角写着 Debug。等于先有几何、再有导航。
 *   · 9064（2017）：一座粉紫色城堡岛，墙体上全是拱洞，白点从外面走进洞、穿到另一侧再出来。
 *     镜头绕着转，白点一直没有绕开墙走 —— 它走的是**洞**。
 *
 * 为什么这件事不能直接用"格心连格心"的 navmesh：
 *   · 这些拱洞是**竖直的洞口**（底下能过、上面是墙），在 2D 平面上就是一个窄缝；
 *   · 墙厚只有一格，拱洞位置由模块决定 —— 每一格可能有 0~4 个洞；
 *   · 所以正确的图不是"格子图"，而是 **门洞图**：节点 = 可站立的位置，边 = 一个具体的门洞，
 *     边的代价 = 穿过去的长度 + 门的宽度惩罚（窄门要排队，代价更高）。
 *
 * 本文件做的事：
 *   ① 从一份"每格有哪些朝向是通的"的数据建门洞图（不猜几何，直接用模块的接口表）；
 *   ② Dijkstra 求"穿洞"路线；
 *   ③ 和两条基线比：直线（忽略墙）、绕外围（不穿洞）；
 *   ④ 量化：绕路比、穿洞比例、窄门惩罚对路线的影响。
 */

const DIRS = [
  { x: -1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: 0, z: 1 },
];
const OPP = [1, 0, 3, 2];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 造一座"瑞士奶酪"：规整的房间网格（墙线每 3 格一道）+ 墙线上随机开口（拱门）。
 * 开口所在的格子仍然可走 —— 这就是"洞里穿过去"。
 *
 * 为什么改成房间网格：第一版是随机散点墙，试了三档 openness，
 * 实测"穿洞比例"全是 0 —— 空地本来就能绕过去，门洞一次都用不上，
 * 那就不叫"navigating a Swiss cheese"了。原文那座城堡是**连续墙 + 拱洞**，
 * 洞是唯一的横向通路，这里照这个来。
 */
export function makeCheese({ W = 15, D = 15, wallChance = 0.34, openness = 0.55, seed = 7 } = {}) {
  void wallChance;
  const rnd = mulberry32(seed);
  const solid = new Uint8Array(W * D);
  const doorCell = new Uint8Array(W * D);     // 1 = 这一格是门洞（墙上的缺口）
  const at = (x, z) => z * W + x;
  const wallX = new Set(), wallZ = new Set();
  for (let x = 3; x < W - 1; x += 3) wallX.add(x);
  for (let z = 3; z < D - 1; z += 3) wallZ.add(z);

  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const border = x === 0 || z === 0 || x === W - 1 || z === D - 1;
      solid[at(x, z)] = border || wallX.has(x) || wallZ.has(z) ? 1 : 0;
    }
  }
  // 在每条墙线上开口：横墙开竖洞，竖墙开横洞
  for (const z of wallZ) {
    for (let x = 1; x < W - 1; x++) {
      if (wallX.has(x)) continue;
      if (rnd() < openness * 0.55) { solid[at(x, z)] = 0; doorCell[at(x, z)] = 1; }
    }
  }
  for (const x of wallX) {
    for (let z = 1; z < D - 1; z++) {
      if (wallZ.has(z)) continue;
      if (rnd() < openness * 0.55) { solid[at(x, z)] = 0; doorCell[at(x, z)] = 1; }
    }
  }
  return { W, D, solid, door: doorCell, at };
}

/** 某格能否站人。 */
const walkable = (ch, x, z) => x >= 0 && z >= 0 && x < ch.W && z < ch.D && !ch.solid[ch.at(x, z)];

/** 门洞惩罚：门洞格代价略高（挤过去要排队），这样"多走两步绕另一个门"也可能更优。 */
export function doorCost(ch, x, z) {
  return ch.door && ch.door[ch.at(x, z)] ? 1.35 : 1;
}

/** 可达图：节点 = 可站格，边 = 4 邻接；经过门洞格的边加权。 */
export function buildPortalGraph(ch) {
  const nodes = [];
  const id = new Int32Array(ch.W * ch.D).fill(-1);
  for (let z = 0; z < ch.D; z++) {
    for (let x = 0; x < ch.W; x++) {
      if (walkable(ch, x, z)) { id[ch.at(x, z)] = nodes.length; nodes.push({ x, z }); }
    }
  }
  const adj = nodes.map(() => []);
  let doorEdges = 0;
  for (let i = 0; i < nodes.length; i++) {
    const { x, z } = nodes[i];
    for (let d = 0; d < 4; d++) {
      const v = DIRS[d];
      const nx = x + v.x, nz = z + v.z;
      if (!walkable(ch, nx, nz)) continue;
      const j = id[ch.at(nx, nz)];
      if (j < 0) continue;
      const isDoor = !!(ch.door && (ch.door[ch.at(nx, nz)] || ch.door[ch.at(x, z)]));
      if (isDoor) doorEdges++;
      adj[i].push({ to: j, w: doorCost(ch, nx, nz), door: isDoor });
    }
  }
  const doorCells = new Set();
  for (const n of nodes) if (ch.door && ch.door[ch.at(n.x, n.z)]) doorCells.add(n.z * 1000 + n.x);
  return { nodes, adj, id, doorEdges: doorEdges / 2, doorCells };
}

/** Dijkstra。返回 {dist, path, throughDoors, length}。 */
export function route(g, start, goal) {
  const n = g.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const doorUsed = new Uint8Array(n);
  const si = g.nodes.findIndex((p) => p.x === start.x && p.z === start.z);
  const gi = g.nodes.findIndex((p) => p.x === goal.x && p.z === goal.z);
  if (si < 0 || gi < 0) return { reachable: false };
  dist[si] = 0;
  // 小规模用 O(n²) 选择，省一个堆
  const done = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    if (u === gi) break;
    for (const e of g.adj[u]) {
      const nd = dist[u] + e.w;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        prev[e.to] = u;
        doorUsed[e.to] = e.door ? 1 : doorUsed[u];
      }
    }
  }
  if (!Number.isFinite(dist[gi])) return { reachable: false };
  const path = [];
  for (let i = gi; i >= 0; i = prev[i]) path.push(g.nodes[i]);
  path.reverse();
  let doors = 0, steps = 0;
  for (let i = 1; i < path.length; i++) {
    steps++;
    const p = path[i];
    if (g.doorCells && g.doorCells.has(p.z * 1000 + p.x)) doors++;
  }
  return { reachable: true, dist: dist[gi], path, doors, steps, length: path.length };
}

/** 直线距离（忽略墙）。 */
export function straightDist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** 基线：不穿洞（只沿空地走）—— 用来对比"洞"带来的收益。 */
export function routeNoDoors(ch) {
  const g = buildPortalGraph(ch);
  const g2 = { ...g, adj: g.adj.map((list) => list.filter((e) => !e.door)) };
  return g2;
}

/**
 * 一次性报告：随机取 pairs 组 (起点, 终点)，比
 *   直线（忽略墙） / 不穿洞 / 穿洞 三种走法的长度，并统计穿洞比例。
 *
 * 这是把原文 "It's like navigating a Swiss cheese" 变成数字的方式：
 * 如果穿洞的比例很低，说明这结构其实是在绕墙，不是"穿奶酪"。
 */
export function report({ pairs = 400, seed = 11, openness = 0.55, wallChance = 0.34 } = {}) {
  const ch = makeCheese({ W: 15, D: 15, wallChance, openness, seed });
  const g = buildPortalGraph(ch);
  const gNoDoor = { ...g, adj: g.adj.map((l) => l.filter((e) => !e.door)) };
  const rnd = mulberry32(seed * 31 + 5);
  const open = g.nodes;
  let n = 0, reach = 0, reachNo = 0;
  let sumDetour = 0, sumNoDoor = 0, sumStraight = 0, throughDoors = 0, unreachableNo = 0;
  for (let k = 0; k < pairs; k++) {
    const a = open[(rnd() * open.length) | 0];
    const b = open[(rnd() * open.length) | 0];
    if (a === b) continue;
    const r = route(g, a, b);
    const rn = route(gNoDoor, a, b);
    n++;
    if (!rn.reachable) unreachableNo++;
    if (!r.reachable) continue;
    reach++;
    if (rn.reachable) { reachNo++; sumNoDoor += rn.dist; }
    sumDetour += r.dist;
    sumStraight += straightDist(a, b);
    if (r.doors > 0) throughDoors++;
  }
  return {
    grid: { W: ch.W, D: ch.D, walkableCells: g.nodes.length, doorEdges: g.doorEdges },
    pairs: n, reachable: reach, reachableNoDoors: reachNo,
    unreachableWithoutDoors: unreachableNo,
    pctThroughDoors: +((throughDoors / Math.max(1, reach)) * 100).toFixed(1),
    meanPath: +(sumDetour / Math.max(1, reach)).toFixed(2),
    meanStraight: +(sumStraight / Math.max(1, reach)).toFixed(2),
    detourRatio: +(sumDetour / Math.max(1e-6, sumStraight)).toFixed(3),
    meanPathNoDoors: +(sumNoDoor / Math.max(1, reachNo)).toFixed(2),
    // 把门洞全部封死（= 只能在自己房间里转）之后，有多少对直接不连通。
    // 这才是"瑞士奶酪"的核心：**洞是唯一横向通路**。
    sealedUnreachablePct: +((unreachableNo / Math.max(1, n)) * 100).toFixed(1),
  };
}

/**
 * 结构"长出来"的顺序（对应 7971 那条的先长几何后导航）：
 * 返回每一步新长出的模块与导航图节点数，用来验证"导航是跟着几何长的"。
 */
export function growthSeries({ steps = 40, seed = 5, openness = 0.55 } = {}) {
  const ch = makeCheese({ W: 13, D: 13, wallChance: 0.30, openness, seed });
  const rnd = mulberry32(seed * 17 + 3);
  // 从中心向外的 BFS 顺序"长出"模块
  const order = [];
  const seen = new Uint8Array(ch.W * ch.D);
  const q = [[6, 6]];
  seen[ch.at(6, 6)] = 1;
  while (q.length && order.length < steps) {
    const [x, z] = q.shift();
    order.push([x, z]);
    const dirs = [0, 1, 2, 3].sort(() => rnd() - 0.5);
    for (const d of dirs) {
      const v = DIRS[d];
      const nx = x + v.x, nz = z + v.z;
      if (nx < 1 || nz < 1 || nx >= ch.W - 1 || nz >= ch.D - 1) continue;
      if (seen[ch.at(nx, nz)]) continue;
      seen[ch.at(nx, nz)] = 1;
      q.push([nx, nz]);
    }
  }
  const series = [];
  for (let i = 1; i <= order.length; i++) {
    // 只保留前 i 个模块可站/有洞，其余一律当墙
    const sub = {
      W: ch.W, D: ch.D, at: ch.at,
      solid: new Uint8Array(ch.W * ch.D).fill(1),
      door: new Uint8Array(ch.W * ch.D * 4),
    };
    for (let k = 0; k < i; k++) {
      const [x, z] = order[k];
      sub.solid[ch.at(x, z)] = ch.solid[ch.at(x, z)];
      for (let d = 0; d < 4; d++) sub.door[ch.at(x, z) * 4 + d] = ch.door[ch.at(x, z) * 4 + d];
    }
    const g = buildPortalGraph(sub);
    series.push({ step: i, cells: g.nodes.length, edges: g.adj.reduce((s, l) => s + l.length, 0) });
  }
  return series;
}
