/**
 * campaign.js — Bad North 战役地图生成。
 *
 * 依据：
 *   1042732450730913793 "The graph generator I ended up using for the Bad North campaign maps:
 *     1. Create nodes of varying sizes and spread them out 2. Cull nodes outside bounds
 *     3. Do a random walk from start to finish 4. Do some more random walks 5. Pick some more random nodes"
 *     全帧复核：一长条圆圈 → 青色的路径 → 黄色的支路；多次重新生成。
 *   938405900573986816 "Islands get spread apart and divided into regions"
 *     画面：竖长条里的星图，按颜色分成几片区域，顶上一个起点、底下一个终点。
 *   911913981731885056 "Saving island snapshots to 64² textures and then crisping them back up with some shader magic"
 *     画面：海上一个个白色小岛图标，点线相连。→ snapshot()：岛画进 64² 小图、模糊，放大时用阈值把边"收脆"。
 */

import { makeRng } from '../core/noise.js';
import { campaignGraph, campaignWalk } from '../core/campaign-graph.js';
import { groupByConnection, spreadCircles } from '../core/region-groups.js';

export function generateCampaign({ seed = 4, n = 260, W = 6, H = 26, regions = 6 } = {}) {
  if (!Number.isInteger(n) || n < 2 || n > 512 || !Number.isFinite(seed) ||
      ![W, H].every(v => Number.isFinite(v) && v > 0 && v <= 10000) ||
      !Number.isInteger(regions) || regions < 1 || regions > 512) throw new RangeError('invalid campaign parameters');
  const rng = makeRng(seed);
  const steps = {};
  // 1. 大小不一的节点，斥力散开
  let nodes = [];
  for (let i = 0; i < n; i++) nodes.push({ x: (rng() - 0.5) * W * 1.6, y: (rng() - 0.5) * H * 1.3, r: 0.22 + rng() * rng() * 0.45 });
  nodes = spreadCircles(nodes);
  const spread = nodes.map((p) => ({ ...p }));
  // 2. 剔除边界外
  nodes = nodes.filter((p) => Math.abs(p.x) < W / 2 && Math.abs(p.y) < H / 2);
  nodes.forEach((p, i) => (p.id = i));
  if (nodes.length < 2) throw new RangeError('campaign bounds retained fewer than two nodes');
  // 1078792665980915714: progressive graph/route display. Exact original
  // adjacency is unknown; preserve Delaunay approximation and expose repairs.
  const graph = campaignGraph(nodes), nb = graph.nb;
  steps.tri = graph.tri;
  steps.nearest = graph.nearest;
  steps.bridges = graph.bridges;
  steps.componentsBeforeRepair = graph.componentsBeforeRepair;
  const start = nodes.reduce((a, b) => (b.y > a.y ? b : a)).id;
  const end = nodes.reduce((a, b) => (b.y < a.y ? b : a)).id;
  const walk = (from, to) => campaignWalk(nodes, nb, from, to, rng);
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
  // are most connected"）：每个用到的节点先自成一组；反复挑最小的一组，整组并进和它连边最多的邻组，直到剩 regions 组。再按局部连接权重转移边界节点，保持每个区域连通。
  const region = groupRegions([...used], nb, regions, { relaxPasses: 8 });
  steps.groups = region.history;
  return { nodes, spread, steps, nb, start, end, used: [...used], edges: [...edges].map((e) => { const [a, b, kind] = e.split(':'); return { a: +a, b: +b, kind }; }), region, main };
}

// Keep the historical Map/history API while using the shared validated graph.
export function groupRegions(ids, nb, target, options) {
  return groupByConnection(ids, nb, target, options);
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
