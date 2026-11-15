/**
 * 第 56 批 C03 · 810157485638189056（2016-12-17）原文：
 *   「Trying out fluid pathfinding on a triangle graph. Making it up as I go along.」
 * 全 510 帧（sheet-00…05）：俯视棕色「粗走廊」迷宫（圆头端点、环路、分叉），一团暗红小点像液体一样
 * 沿走廊流向被 gizmo 拖动的目标；目标一换，整团立即改道、在窄口收成一股、到开阔处又摊开。
 * 旧 note 把它当成「路线密集采样编辑器」是误判——原文写的是三角图上的流体寻路。
 *
 * 本模块只负责：粗走廊迷宫（随机格点图 + 圆头胶囊）→ 掩码三角剖分成三角图（导航面）。
 * 流场 / 群体复用共享的 world/navmesh-flow.js（顶点距离场 + 共边带流向 + 分离 + 约束回面），不另起一套。
 */
import { buildNavMesh } from '../world/navmesh-flow.js';

const rng = (seed) => { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/** 随机走廊图：jitter 格点 + 生成树 + 额外环边 + 少量伸出的「死胡同」端头。返回 {nodes, edges, width}。 */
export function corridorMaze({ seed = 7, cols = 7, rows = 7, size = 10, width = 0.6, loops = 0.3, spurs = 9 } = {}) {
  const R = rng(seed), nodes = [], edges = [];
  const sx = size / cols, sz = size / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) nodes.push({ x: (i + .5) * sx + (R() - .5) * sx * .5, z: (j + .5) * sz + (R() - .5) * sz * .5 });
  const id = (i, j) => j * cols + i, cand = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (i + 1 < cols) cand.push([id(i, j), id(i + 1, j)]);
    if (j + 1 < rows) cand.push([id(i, j), id(i, j + 1)]);
    if (i + 1 < cols && j + 1 < rows && R() < .25) cand.push(R() < .5 ? [id(i, j), id(i + 1, j + 1)] : [id(i + 1, j), id(i, j + 1)]);
  }
  for (let k = cand.length - 1; k > 0; k--) { const r = Math.floor(R() * (k + 1)); [cand[k], cand[r]] = [cand[r], cand[k]]; }
  const parent = nodes.map((_, i) => i), find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  for (const [a, b] of cand) { const ra = find(a), rb = find(b); if (ra !== rb) { parent[ra] = rb; edges.push([a, b]); } else if (R() < loops) edges.push([a, b]); }
  for (let k = 0; k < spurs; k++) {   // 端头：从随机节点朝外伸一截（片子边缘那些圆头）
    const a = Math.floor(R() * nodes.length), ang = R() * Math.PI * 2, L = Math.min(sx, sz) * (.55 + R() * .4), n = nodes[a];
    const x = Math.max(width, Math.min(size - width, n.x + Math.cos(ang) * L)), z = Math.max(width, Math.min(size - width, n.z + Math.sin(ang) * L));
    nodes.push({ x, z }); edges.push([a, nodes.length - 1]);
  }
  return { nodes, edges, width, size };
}

/** 点到线段距离 */
const segDist = (ax, az, bx, bz, x, z) => { const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez; let t = l2 < 1e-12 ? 0 : ((x - ax) * ex + (z - az) * ez) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - ax - ex * t, z - az - ez * t); };

/** 迷宫内判定：到任一走廊中线 ≤ width/2（胶囊并集 = 天然圆头端点 + 圆角路口）。 */
export function insideMaze(maze, x, z) {
  const r = maze.width / 2;
  for (const [a, b] of maze.edges) { const A = maze.nodes[a], B = maze.nodes[b]; if (segDist(A.x, A.z, B.x, B.z, x, z) <= r) return true; }
  return false;
}

/**
 * 掩码三角剖分：步长 step 的顶点格，每个方格四角都在里面 → 切成两个三角形（对角线交替，避免全朝一个方向的各向异性）。
 * 得到的是共享 buildNavMesh 结构（逆时针俯视），可直接给 buildVertexField / stepCrowd 用。
 */
export function triangulateMaze(maze, { step = 0.22 } = {}) {
  const n = Math.ceil(maze.size / step) + 1, inside = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) inside[j * n + i] = insideMaze(maze, i * step, j * step) ? 1 : 0;
  const vid = new Int32Array(n * n).fill(-1), verts = [], polys = [];
  const v = (i, j) => { const k = j * n + i; if (vid[k] < 0) { vid[k] = verts.length; verts.push({ x: i * step, y: 0, z: j * step }); } return vid[k]; };
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++) {
    if (!(inside[j * n + i] && inside[j * n + i + 1] && inside[(j + 1) * n + i] && inside[(j + 1) * n + i + 1])) continue;
    const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
    // 俯视 x 右 z 下：a→d→c 是逆时针（x×z 叉积为负 → 反过来）；统一用 ccw() 修正
    if ((i + j) & 1) polys.push([a, c, b], [a, d, c]); else polys.push([a, d, b], [b, d, c]);
  }
  const ccw = (vs) => { let s2 = 0; for (let k = 0; k < 3; k++) { const p = verts[vs[k]], q = verts[vs[(k + 1) % 3]]; s2 += p.x * q.z - q.x * p.z; } return s2 < 0 ? vs.slice().reverse() : vs; };
  // 只保留与最大连通块（防止孤立的小碎片吃掉 spawn）
  const mesh = buildNavMesh(verts, polys.map(ccw));
  const comp = new Int32Array(mesh.polys.length).fill(-1); let best = -1, bestN = 0;
  for (let s = 0, c = 0; s < mesh.polys.length; s++) {
    if (comp[s] >= 0) continue; const st = [s]; comp[s] = c; let cnt = 0;
    while (st.length) { const p = st.pop(); cnt++; for (const q of mesh.polys[p].nb) if (q >= 0 && comp[q] < 0) { comp[q] = c; st.push(q); } }
    if (cnt > bestN) { bestN = cnt; best = c; } c++;
  }
  mesh.mainComponent = best; mesh.component = comp; mesh.step = step;
  return mesh;
}

/** 在最大连通块里、靠近 (x,z) 的面上撒 n 个点（圆盘内拒绝采样）。 */
export function spawnSwarm(mesh, n, { x, z, r = 1.2, seed = 3 } = {}, locateFn) {
  const R = rng(seed), out = [];
  for (let k = 0, guard = 0; out.length < n && guard < n * 400; guard++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, poly = locateFn(mesh, px, pz);
    if (poly < 0 || mesh.component[poly] !== mesh.mainComponent) continue;
    out.push({ x: px, z: pz, y: 0, poly, vx: 0, vz: 0, k: k++ });
  }
  return out;
}
