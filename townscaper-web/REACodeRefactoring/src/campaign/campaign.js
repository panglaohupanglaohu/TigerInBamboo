/**
 * campaign.js — Bad North 战役地图生成。
 *
 * 依据：
 *   1042732450730913793 "The graph generator I ended up using for the Bad North campaign maps:
 *     1. Create nodes of varying sizes and spread them out 2. Cull nodes outside bounds
 *     3. Do a random walk from start to finish 4. Do some more random walks 5. Pick some more random nodes"
 *     画面：一长条圆圈 → 青色的路径 → 黄色的支路。
 *   938405900573986816 "Islands get spread apart and divided into regions"
 *     画面：竖长条里的星图，按颜色分成几片区域，顶上一个起点、底下一个终点。
 *   911913981731885056 "Saving island snapshots to 64² textures and then crisping them back up with some shader magic"
 *     画面：海上一个个白色小岛图标，点线相连。→ snapshot()：岛画进 64² 小图、模糊，放大时用阈值把边"收脆"。
 */

import { makeRng } from '../core/noise.js';
import { TriGraph } from '../core/trigraph.js';

export function generateCampaign({ seed = 4, n = 260, W = 6, H = 26, regions = 6 } = {}) {
  const rng = makeRng(seed);
  const steps = {};
  // 1. 大小不一的节点，斥力散开
  let nodes = [];
  for (let i = 0; i < n; i++) nodes.push({ x: (rng() - 0.5) * W * 1.6, y: (rng() - 0.5) * H * 1.3, r: 0.22 + rng() * rng() * 0.45 });
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, min = a.r + b.r + 0.12;
      if (d < min) { const f = (min - d) / d * 0.5; a.x -= dx * f; a.y -= dy * f; b.x += dx * f; b.y += dy * f; }
    }
  }
  const spread = nodes.map((p) => ({ ...p }));
  // 2. 剔除边界外
  nodes = nodes.filter((p) => Math.abs(p.x) < W / 2 && Math.abs(p.y) < H / 2);
  nodes.forEach((p, i) => (p.id = i));
  // 邻接（1078792665980915714 "campaign map node graffing"，画面上半：所有节点连成一张白色三角网）：
  // 节点做 Delaunay 三角化，去掉太长的边（凸包上那种横跨的长边），剩下的就是"可以航行的连线"。
  // 再补每个节点最近的 2 个邻居，保证不会有孤点。
  const nb = nodes.map(() => new Set());
  const T = new TriGraph(Math.max(W, H) * 4);
  for (const p of nodes) T.add(p.x, p.y);
  const tri = [];
  for (const t of T.triangles()) for (let k = 0; k < 3; k++) {
    const a = t[k], b = t[(k + 1) % 3];
    if (a > b) continue;   // 每条边只算一次（另一半在相邻三角里）
    const A = nodes[a], B = nodes[b];
    if (Math.hypot(A.x - B.x, A.y - B.y) > (A.r + B.r) * 2.6 + 0.6) continue;
    nb[a].add(b); nb[b].add(a); tri.push([a, b]);
  }
  for (const a of nodes) {
    const near = nodes.filter((b) => b !== a).map((b) => [b.id, Math.hypot(a.x - b.x, a.y - b.y)]).sort((u, v) => u[1] - v[1]).slice(0, 2);
    for (const [j] of near) { nb[a.id].add(j); nb[j].add(a.id); }
  }
  steps.tri = tri;
  for (let i = 0; i < nb.length; i++) nb[i] = [...nb[i]];
  const start = nodes.reduce((a, b) => (b.y > a.y ? b : a)).id;   // 屏幕下方（y 大）开始
  const end = nodes.reduce((a, b) => (b.y < a.y ? b : a)).id;
  // 3. 起点 → 终点的随机游走（偏向终点）
  const walk = (from, to) => {
    const path = [from];
    let cur = from;
    for (let k = 0; k < 300 && cur !== to; k++) {
      const opts = nb[cur];
      if (!opts.length) break;
      const T = nodes[to];
      const w = opts.map((o) => { const d0 = Math.hypot(nodes[cur].x - T.x, nodes[cur].y - T.y), d1 = Math.hypot(nodes[o].x - T.x, nodes[o].y - T.y); return Math.exp((d0 - d1) * 2.2) * (path.includes(o) ? 0.15 : 1); });
      let r = rng() * w.reduce((a, b) => a + b, 0), pick = opts[0];
      for (let i = 0; i < opts.length; i++) { if ((r -= w[i]) <= 0) { pick = opts[i]; break; } }
      cur = pick; path.push(cur);
    }
    if (cur !== to) {   // 兜底：BFS 最短路
      const prev = new Map([[from, -1]]), q = [from];
      for (let h = 0; h < q.length && !prev.has(to); h++) for (const o of nb[q[h]]) if (!prev.has(o)) { prev.set(o, q[h]); q.push(o); }
      const p = [];
      for (let c = to; c !== -1 && c !== undefined; c = prev.get(c)) p.unshift(c);
      return p;
    }
    return path;
  };
  const used = new Set();
  const edges = new Set();
  const addPath = (p, kind) => { for (let i = 0; i < p.length; i++) { used.add(p[i]); if (i) edges.add(Math.min(p[i - 1], p[i]) + ':' + Math.max(p[i - 1], p[i]) + ':' + kind); } };
  const main = walk(start, end); addPath(main, 'main');
  // 4. 再走几条：从主路上的点出发，走到主路上更远的点
  for (let k = 0; k < 4; k++) {
    const a = main[(rng() * main.length * 0.6) | 0], b = main[Math.min(main.length - 1, main.indexOf(a) + 6 + ((rng() * 10) | 0))];
    addPath(walk(a, b), 'branch');
  }
  // 5. 再挑一些和已用节点相邻的
  const extra = [];
  for (let k = 0; k < nodes.length * 0.12; k++) {
    const u = [...used][(rng() * used.size) | 0];
    const o = nb[u][(rng() * nb[u].length) | 0];
    if (o !== undefined && !used.has(o)) { used.add(o); extra.push(o); edges.add(Math.min(u, o) + ':' + Math.max(u, o) + ':extra'); }
  }
  // 区域（938422757288792064 "a sort of cellular automaton where nodes get eaten by the neighbor group to which they
  // are most connected"）：每个用到的节点先自成一组；反复挑最小的一组，整组并进和它连边最多的邻组，直到剩 regions 组。
  const region = groupRegions([...used], nb, regions);
  steps.groups = region.history;
  return { nodes, spread, steps, nb, start, end, used: [...used], edges: [...edges].map((e) => { const [a, b, kind] = e.split(':'); return { a: +a, b: +b, kind }; }), region, main };
}

export function groupRegions(ids, nb, target) {
  const set = new Set(ids);
  const g = new Map(ids.map((i) => [i, i]));
  const members = new Map(ids.map((i) => [i, [i]]));
  const history = [];
  while (members.size > target) {
    // 最小的组
    let small = null;
    for (const [k, m] of members) if (!small || m.length < members.get(small).length) small = k;
    // 和各邻组的连边数
    const links = new Map();
    for (const i of members.get(small)) for (const j of nb[i]) if (set.has(j) && g.get(j) !== small) links.set(g.get(j), (links.get(g.get(j)) || 0) + 1);
    if (!links.size) { members.delete(small); continue; }   // 孤岛：不参与
    const eater = [...links].sort((a, b) => b[1] - a[1])[0][0];
    for (const i of members.get(small)) { g.set(i, eater); members.get(eater).push(i); }
    members.delete(small);
    if (members.size <= target * 4) history.push(new Map(g));
  }
  // 组号压成 0…target-1
  const ids2 = [...members.keys()];
  const out = new Map();
  for (const [i, k] of g) out.set(i, Math.max(0, ids2.indexOf(k)));
  out.history = history;
  return out;
}

/**
 * 岛屿快照：岛的形状画进 64² 小图（这里用几个圆 + 噪声边），放大显示时用"阈值 + 窄过渡"把模糊边收脆，
 * 再描一圈边 —— 小图存得少，放大后边缘依然干净（911913981731885056 "crisping them back up"）。
 * 返回一个 canvas（size × size）。
 */
export function islandSnapshot(seed, size = 96) {
  const rng = makeRng(seed * 31 + 7);
  const S = 64;
  const small = document.createElement('canvas'); small.width = small.height = S;
  const g = small.getContext('2d');
  g.filter = 'blur(2.5px)';
  g.fillStyle = '#fff';
  const blobs = 3 + ((rng() * 4) | 0);
  for (let i = 0; i < blobs; i++) {
    const x = S / 2 + (rng() - 0.5) * 22, y = S / 2 + (rng() - 0.5) * 22, r = 8 + rng() * 10;
    g.beginPath(); g.roundRect ? g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.45) : g.arc(x, y, r, 0, 7); g.fill();
  }
  // 放大 + 收脆
  const big = document.createElement('canvas'); big.width = big.height = size;
  const b = big.getContext('2d');
  b.imageSmoothingEnabled = true;
  b.drawImage(small, 0, 0, size, size);
  const img = b.getImageData(0, 0, size, size), d = img.data;
  const out = b.createImageData(size, size), o = out.data;
  const a = (x, y) => d[((Math.max(0, Math.min(size - 1, y)) * size + Math.max(0, Math.min(size - 1, x))) * 4) + 3] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = a(x, y);
    const k = (y * size + x) * 4;
    const land = smooth(0.46, 0.54, v);            // 阈值收脆
    const rim = smooth(0.30, 0.36, v) - land;       // 外圈白边（浪）
    const cliff = smooth(0.54, 0.62, v) - smooth(0.70, 0.78, v);   // 崖边一圈深色
    const top = 236 - cliff * 120;
    o[k] = top; o[k + 1] = top; o[k + 2] = top - 4;
    o[k + 3] = Math.max(land, rim * 0.9) * 255;
    if (rim > land) { o[k] = o[k + 1] = o[k + 2] = 250; }
  }
  b.putImageData(out, 0, 0);
  return big;
}
function smooth(e0, e1, x) { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
