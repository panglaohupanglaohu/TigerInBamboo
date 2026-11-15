// r56 C08 · 1490068909042642944「Late night cryptic graph tweet」— 原尺寸回看 0250 / 0390 帧：
// 节点是几条同心「环带」（每条环带自身是一张三角/四边小网格的邻接图），环带之间只靠几根单边「辐条」相连
// （东南西北 4 根，最外圈还有外伸的悬挂点）；0200–0299 从中心开始一层层搜索（黄/红前沿边向外扩），
// 定稿时颜色按环带分段（中心青、蓝、品红、黄橙），底下是极坐标参考网（同心圆 + 放射线）。
// 这正是「桥」把图切成若干 2-边连通分量：颜色 = 去掉桥之后的连通块。这里在共享 grid.js 的真实格子
// 邻接上构图，并实现 Tarjan 找桥（迭代版）+ 2-边连通分量 + BFS 前沿回放。
import { buildMixedGrid } from './grid.js';

/** Tarjan 桥（迭代，无递归栈溢出）。返回 Set("a,b" 小在前) */
export function findBridges(ids, nb) {
  const disc = new Map(), low = new Map(), out = new Set(); let time = 0;
  for (const s of ids) {
    if (disc.has(s)) continue;
    const st = [[s, null, 0]]; disc.set(s, time); low.set(s, time); time++;
    while (st.length) {
      const top = st[st.length - 1], [v, p] = top, ns = nb(v);
      if (top[2] < ns.length) {
        const w = ns[top[2]++];
        if (w === p) continue;
        if (!disc.has(w)) { disc.set(w, time); low.set(w, time); time++; st.push([w, v, 0]); }
        else low.set(v, Math.min(low.get(v), disc.get(w)));
      } else {
        st.pop();
        if (p !== null) { low.set(p, Math.min(low.get(p), low.get(v))); if (low.get(v) > disc.get(p)) out.add(p < v ? p + ',' + v : v + ',' + p); }
      }
    }
  }
  return out;
}

/** 去掉桥后的连通分量（= 2-边连通分量），大的在前；返回 {comp: Map(id→k), sizes} */
export function twoEdgeComponents(ids, nb, bridges = findBridges(ids, nb)) {
  const comp = new Map(), groups = [];
  for (const s of ids) {
    if (comp.has(s)) continue;
    const g = [s]; comp.set(s, -1);
    for (let i = 0; i < g.length; i++) for (const w of nb(g[i])) { const k = g[i] < w ? g[i] + ',' + w : w + ',' + g[i]; if (!bridges.has(k) && !comp.has(w)) { comp.set(w, -1); g.push(w); } }
    groups.push(g);
  }
  groups.sort((a, b) => b.length - a.length || Math.min(...a) - Math.min(...b));
  groups.forEach((g, k) => g.forEach((v) => comp.set(v, k)));
  return { comp, sizes: groups.map((g) => g.length), groups };
}

/** 构图：混合网格里取若干同心环带的格子（环带内用真实格邻接），带间加 4 根辐条桥，最外圈外伸悬挂点 */
export function bandedGraph({ radius = 13, seed = 5, bands = [[0, .17], [.27, .45], [.55, .73], [.83, .99]], spokes = 4 } = {}) {
  const grid = buildMixedGrid({ radius, seed }), keep = new Map();
  const R = grid.cells.reduce((m, c) => Math.max(m, Math.hypot(c.cx, c.cz)), 0);   // bands are fractions of the grid extent
  for (const c of grid.cells) { const r = Math.hypot(c.cx, c.cz) / R, b = bands.findIndex(([lo, hi]) => r >= lo && r < hi); if (b >= 0) keep.set(c.id, b); }
  const adj = new Map([...keep.keys()].map((id) => [id, new Set()]));
  for (const id of keep.keys()) for (const n of grid.cells[id].edgeNeighbors) if (n >= 0 && keep.get(n) === keep.get(id)) adj.get(id).add(n);
  // keep only the largest connected piece of each band (bands can fragment at the jagged edges)
  for (let b = 0; b < bands.length; b++) {
    const ids = [...keep].filter(([, k]) => k === b).map(([id]) => id), seen = new Set(), pieces = [];
    for (const s of ids) { if (seen.has(s)) continue; const p = [s]; seen.add(s); for (let i = 0; i < p.length; i++) for (const w of adj.get(p[i])) if (!seen.has(w)) { seen.add(w); p.push(w); } pieces.push(p); }
    pieces.sort((x, y) => y.length - x.length);
    for (const p of pieces.slice(1)) for (const id of p) { for (const w of adj.get(id)) adj.get(w).delete(id); adj.delete(id); keep.delete(id); }
  }
  const pos = new Map([...keep.keys()].map((id) => [id, [grid.cells[id].cx, grid.cells[id].cz]]));
  const spokeEdges = [];
  const nearestAt = (b, ang, outer) => { let best = null, bd = Infinity; for (const [id, k] of keep) { if (k !== b) continue; const [x, z] = pos.get(id), a = Math.atan2(z, x), r = Math.hypot(x, z), da = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang))); const d = da * 10 + (outer ? -r : r) * .15; if (d < bd) { bd = d; best = id; } } return best; };
  for (let b = 0; b + 1 < bands.length; b++) for (let s = 0; s < spokes; s++) {
    const ang = -Math.PI / 2 + s * 2 * Math.PI / spokes, u = nearestAt(b, ang, true), v = nearestAt(b + 1, ang, false);
    if (u !== null && v !== null) { adj.get(u).add(v); adj.get(v).add(u); spokeEdges.push([u, v]); }
  }
  // pendant nodes outside the outer band (the clip's outward spikes)
  let next = -1; const last = bands.length - 1;
  for (let s = 0; s < spokes; s++) {
    const ang = -Math.PI / 2 + s * 2 * Math.PI / spokes, u = nearestAt(last, ang, true); if (u === null) continue;
    const [x, z] = pos.get(u), r = Math.hypot(x, z), id = next--;
    pos.set(id, [x / r * (r + 1.4), z / r * (r + 1.4)]); adj.set(id, new Set([u])); adj.get(u).add(id); keep.set(id, last + 1); spokeEdges.push([u, id]);
  }
  const ids = [...adj.keys()].sort((a, b) => a - b), nb = (v) => [...adj.get(v)];
  const center = ids.reduce((best, id) => (Math.hypot(...pos.get(id)) < Math.hypot(...pos.get(best)) ? id : best), ids[0]);
  return { grid, ids, nb, pos, band: keep, spokeEdges, center };
}

/** BFS 回放：每层的前沿边（父→子），用于 0200–0299 那段向外搜索动画 */
export function bfsLayers(ids, nb, root) {
  const depth = new Map([[root, 0]]), layers = [[]]; let q = [root];
  while (q.length) {
    const nq = [], L = [];
    for (const v of q) for (const w of nb(v)) if (!depth.has(w)) { depth.set(w, depth.get(v) + 1); nq.push(w); L.push([v, w]); }
    if (L.length) layers.push(L); q = nq;
  }
  return { depth, layers };
}
