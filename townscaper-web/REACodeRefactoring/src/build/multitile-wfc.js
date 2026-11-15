/**
 * multitile-wfc.js — 多格 tile 的三维 WFC + 顶点体素 AO（793545297376972801，2016-11-01）
 *
 * README 原文：「I got multi tiles and voxel AO working. Would you play a game that takes place on a building like this?
 *   Maybe if it was infinitely tall?」
 * 逐帧（102 帧 / 0.1 s 一帧，sheet-00/01，原尺寸 0/50/67/68/96/101）：
 *   0–67   一个立方体空间里，构件一块一块出现：楼板、墙柱、**跨两三格的拱**、楼梯、外挑；位置跳着出（不是逐层扫），
 *          先出现的块会把周围「能放什么」定下来 → WFC 按最少可能数挑格子坍缩；
 *   67→68  切到完整结果：一整栋多层楼，拱洞下面是空的（多格 tile 占的格子里有的是空心）；
 *   68–101 转镜、换种子换高度：凹处 / 拱下 / 楼板夹缝明显暗，凸角亮 —— 顶点体素 AO（只看相邻体素占用，没有方向色）。
 *
 * 原 REACode：`src/voxelao.js` 只有 AO 的五档对比，没有多格 tile（STUDY-INDEX：「town.js 仍是一格一模块」）；
 * 重构版 `src/build/multicell.js` 是二维双格房屋整体编辑。本文件补上片中的另一半：**一个 tile 占多个体素**的 3D WFC。
 *
 * 做法（多格 tile 在 WFC 里的标准拆法）：
 *   · 每个多格 tile 拆成「部件」part = (tile, 偏移 o)；部件之间的内部面贴一张只与搭档匹配的私有标签 → 传播自动保证整块一起出现；
 *   · 外部面标签：A 空气、W 墙、T 顶面（可承托）、S 底面须承托、O 底面须悬空（拱洞）；
 *     竖直：下.T–上.S、下.A–上.O、下.T–上.A、下.A–上.A 合法；地面（y = -1）视作 T；顶外 / 侧外视作 A；
 *     水平：A/W 任意互配（只有内部私有标签受限）。
 *   · 最少可能数优先坍缩（种子决定并列），AC 传播 + 回溯；trace 记录每次坍缩 → 页面逐块回放「长出来」。
 * AO：每个外露面 4 个顶点，看面外侧那一层的两侧 + 对角三个体素（side1、side2、corner），
 *     ao = side1 && side2 ? 0 : (3 − side1 − side2 − corner) / 3（经典顶点体素 AO）。
 */

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];   // +x -x +y -y +z -z
const OPP = [1, 0, 3, 2, 5, 4];
export const MULTITILE_DIRS = DIRS;

/**
 * 默认构件（尺寸 [sx,sy,sz]；solid(o) 该偏移是否实心；bottom(o) 底面标签 'S' 须承托 / 'O' 须悬空；weight 权重）
 * 单格：room 房间块、pillar 柱、slab 楼板（薄）；多格：archX / archZ（3×2×1，下中空）、tower 1×3×1、hall 2×1×2、stair 1×2×2（台阶式）。
 */
export const DEFAULT_TILES = Object.freeze([
  { id: 'room', size: [1, 1, 1], weight: 1.4 },
  { id: 'pillar', size: [1, 1, 1], weight: 0.8, kind: 'pillar' },
  { id: 'slab', size: [1, 1, 1], weight: 1.2, kind: 'slab' },
  { id: 'archX', size: [3, 2, 1], weight: 2.6, solid: (o) => !(o[0] === 1 && o[1] === 0), bottom: (o) => (o[0] === 1 ? 'O' : 'S') },
  { id: 'archZ', size: [1, 2, 3], weight: 2.6, solid: (o) => !(o[2] === 1 && o[1] === 0), bottom: (o) => (o[2] === 1 ? 'O' : 'S') },
  { id: 'tower', size: [1, 3, 1], weight: 1.0 },
  { id: 'hall', size: [2, 1, 2], weight: 1.4 },
  { id: 'stair', size: [1, 2, 2], weight: 0.9, solid: (o) => !(o[1] === 1 && o[2] === 0), bottom: () => 'S', kind: 'stair' },
]);

/** 把构件拆成部件，算 6 个面的标签。 */
export function buildParts(tiles = DEFAULT_TILES) {
  const parts = [{ id: 'air', tile: 'air', o: [0, 0, 0], solid: false, faces: ['A', 'A', 'A', 'A', 'A', 'A'], weight: 1, anchor: true }];
  for (const t of tiles) {
    const [sx, sy, sz] = t.size;
    if (![sx, sy, sz].every((v) => Number.isInteger(v) && v >= 1 && v <= 4)) throw new RangeError('Invalid tile size ' + t.id);
    for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) {
      const o = [x, y, z], solid = t.solid ? !!t.solid(o) : true;
      const faces = DIRS.map((d, k) => {
        const q = [x + d[0], y + d[1], z + d[2]];
        if (q[0] >= 0 && q[0] < sx && q[1] >= 0 && q[1] < sy && q[2] >= 0 && q[2] < sz) {
          // 内部面：私有标签，按（小偏移→大偏移）排序保证两边同名
          const a = o.join(','), b = q.join(',');
          return `#${t.id}:${a < b ? a + '|' + b : b + '|' + a}`;
        }
        if (k === 2) return solid ? 'T' : 'A';                          // 顶
        if (k === 3) return t.bottom ? t.bottom(o) : (solid ? 'S' : 'O'); // 底
        return solid ? 'W' : 'A';                                        // 侧
      });
      parts.push({ id: `${t.id}@${o.join(',')}`, tile: t.id, o, solid, faces, weight: (t.weight ?? 1) / (sx * sy * sz), anchor: x === 0 && y === 0 && z === 0, kind: t.kind || 'room', size: [sx, sy, sz] });
    }
  }
  return parts;
}

/** 面标签 a（本体 dir 方向）与邻居面标签 b 是否相容。dir 是 a 所在面的方向。 */
export function facesCompatible(a, b, dir) {
  if (a[0] === '#' || b[0] === '#') return a === b;
  if (dir === 2) return compatUp(a, b);      // a 是下方的顶面，b 是上方的底面
  if (dir === 3) return compatUp(b, a);
  return (a === 'A' || a === 'W') && (b === 'A' || b === 'W');
}
function compatUp(top, bottom) {
  if (bottom === 'S') return top === 'T';
  if (bottom === 'O') return top === 'A';
  return bottom === 'A' && (top === 'A' || top === 'T');
}

function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296); }

/**
 * 解一栋楼。返回 { ok, grid(部件索引 W*H*D), placements[{tile, at:[x,y,z], size}], trace[{cell, part, step}], stats }。
 * @param {{size?:[number,number,number], seed?:number, parts?:object[], maxBacktracks?:number, airBias?:(y,H)=>number}} o
 */
export function solveMultitile({ size = [5, 6, 5], seed = 1, parts = buildParts(), maxBacktracks = 2000, airBias = (y, H) => 1.1 + 1.8 * (y / Math.max(1, H - 1)) ** 2 } = {}) {
  const [W, H, D] = size;
  if (![W, H, D].every((v) => Number.isInteger(v) && v >= 1 && v <= 24)) throw new RangeError('Invalid size');
  const N = W * H * D, idx = (x, y, z) => x + W * (y + H * z), xyz = (i) => [i % W, Math.floor(i / W) % H, Math.floor(i / (W * H))];
  const P = parts.length, rand = rng(seed);
  // 兼容表：compat[dir][p] = Uint8Array(P)
  const compat = DIRS.map((_, d) => parts.map((a) => Uint8Array.from(parts, (b) => facesCompatible(a.faces[d], b.faces[OPP[d]], d) ? 1 : 0)));
  // 边界：顶外 / 侧外 = A；地面 = T
  const boundaryOk = (p, d, y) => { const f = parts[p].faces[d]; if (d === 3 && y === 0) return compatUp('T', f) || f[0] === '#' && false; if (d === 2) return compatUp(f, 'A'); return f === 'A' || f === 'W'; };
  let dom = [];
  for (let i = 0; i < N; i++) {
    const [x, y, z] = xyz(i), arr = new Uint8Array(P);
    for (let p = 0; p < P; p++) {
      let ok = true;
      for (let d = 0; d < 6 && ok; d++) {
        const q = [x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]];
        if (q[0] < 0 || q[0] >= W || q[1] < 0 || q[1] >= H || q[2] < 0 || q[2] >= D) ok = boundaryOk(p, d, y);
      }
      arr[p] = ok ? 1 : 0;
    }
    dom.push(arr);
  }
  const count = (a) => { let n = 0; for (let p = 0; p < P; p++) n += a[p]; return n; };
  const nb = (i, d) => { const [x, y, z] = xyz(i), q = [x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]]; return q[0] < 0 || q[0] >= W || q[1] < 0 || q[1] >= H || q[2] < 0 || q[2] >= D ? -1 : idx(q[0], q[1], q[2]); };
  function propagate(start) {
    const queue = [...start], inq = new Uint8Array(N); for (const i of queue) inq[i] = 1;
    while (queue.length) {
      const i = queue.shift(); inq[i] = 0;
      for (let d = 0; d < 6; d++) {
        const j = nb(i, d); if (j < 0) continue;
        const di = dom[i], dj = dom[j]; let changed = false;
        for (let q = 0; q < P; q++) {
          if (!dj[q]) continue;
          let sup = false; for (let p = 0; p < P && !sup; p++) if (di[p] && compat[d][p][q]) sup = true;
          if (!sup) { dj[q] = 0; changed = true; }
        }
        if (changed) { if (!count(dj)) return false; if (!inq[j]) { inq[j] = 1; queue.push(j); } }
      }
    }
    return true;
  }
  const stack = [], trace = [];
  let backtracks = 0, decisions = 0;
  if (!propagate([...Array(N).keys()])) return { ok: false, reason: 'initial contradiction' };
  for (;;) {
    let best = -1, bestN = 1e9, bestT = 0;
    for (let i = 0; i < N; i++) { const n = count(dom[i]); if (n > 1) { const tie = rand(); if (n < bestN || (n === bestN && tie < bestT)) { best = i; bestN = n; bestT = tie; } } }
    if (best < 0) break;
    const [, y] = xyz(best), cands = [];
    for (let p = 0; p < P; p++) if (dom[best][p]) cands.push(p);
    const wts = cands.map((p) => (p === 0 ? airBias(y, H) : parts[p].weight));
    // 带权随机序（回溯时依次尝试下一个）
    const order = []; const pool = cands.map((p, k) => ({ p, w: wts[k] }));
    while (pool.length) { let s = 0; for (const e of pool) s += e.w; let r = rand() * s, k = 0; for (; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; } order.push(pool.splice(k, 1)[0].p); }
    let placed = false;
    while (order.length) {
      const p = order.shift(), snap = dom.map((a) => a.slice());
      dom[best].fill(0); dom[best][p] = 1; decisions++;
      if (propagate([best])) { stack.push({ snap, cell: best, rest: order.slice(), traceLen: trace.length }); trace.push({ cell: best, part: p, step: decisions }); placed = true; break; }
      dom = snap; backtracks++;
      if (backtracks > maxBacktracks) return { ok: false, reason: 'backtrack budget', backtracks };
    }
    if (!placed) {
      // 回退到上一层的下一候选
      let resumed = false;
      while (stack.length && !resumed) {
        const fr = stack.pop(); dom = fr.snap; trace.length = fr.traceLen;
        while (fr.rest.length) {
          const p = fr.rest.shift(), snap = dom.map((a) => a.slice());
          dom[fr.cell].fill(0); dom[fr.cell][p] = 1; backtracks++;
          if (propagate([fr.cell])) { stack.push({ snap, cell: fr.cell, rest: fr.rest, traceLen: trace.length }); trace.push({ cell: fr.cell, part: p, step: ++decisions }); resumed = true; break; }
          dom = snap;
        }
        if (backtracks > maxBacktracks) return { ok: false, reason: 'backtrack budget', backtracks };
      }
      if (!resumed) return { ok: false, reason: 'unsatisfiable', backtracks };
    }
  }
  const grid = new Int16Array(N);
  for (let i = 0; i < N; i++) { let k = -1; for (let p = 0; p < P; p++) if (dom[i][p]) { k = p; break; } grid[i] = k; }
  const placements = [];
  for (let i = 0; i < N; i++) { const pt = parts[grid[i]]; if (pt.anchor && pt.tile !== 'air') placements.push({ tile: pt.tile, at: xyz(i), size: pt.size, kind: pt.kind }); }
  const solid = new Uint8Array(N); for (let i = 0; i < N; i++) solid[i] = parts[grid[i]].solid ? 1 : 0;
  return { ok: true, size, grid, solid, parts, placements, trace, stats: { decisions, backtracks, multi: placements.filter((p) => p.size[0] * p.size[1] * p.size[2] > 1).length, solid: solid.reduce((a, b) => a + b, 0) }, idx, xyz };
}

/** 校验：多格块完整、竖直承托、拱下悬空、私有面对齐。返回错误列表（空 = 合法）。 */
export function validateMultitile(res) {
  const { size: [W, H, D], grid, parts, idx } = res, errs = [];
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = parts[grid[idx(x, y, z)]];
    for (let d = 0; d < 6; d++) {
      const q = [x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]];
      const out = q[0] < 0 || q[0] >= W || q[1] < 0 || q[1] >= H || q[2] < 0 || q[2] >= D;
      if (out) {
        if (d === 3 && y === 0) { if (!compatUp('T', p.faces[3])) errs.push(`ground ${x},${y},${z}`); }
        else if (d === 2) { if (!compatUp(p.faces[2], 'A')) errs.push(`top ${x},${y},${z}`); }
        else if (!(p.faces[d] === 'A' || p.faces[d] === 'W')) errs.push(`side ${x},${y},${z}`);
        continue;
      }
      const o = parts[grid[idx(q[0], q[1], q[2])]];
      if (!facesCompatible(p.faces[d], o.faces[OPP[d]], d)) errs.push(`face ${x},${y},${z} d${d} ${p.id}|${o.id}`);
    }
  }
  return errs;
}

/**
 * 顶点体素 AO：每个外露面 4 顶点。返回 faces[{x,y,z,d,ao:[4]}]（顶点顺序：面内 (u,v) = (0,0),(1,0),(1,1),(0,1)）。
 * occ(x,y,z) 越界返回 0（地面 y<0 视为实心，挡住底部）。
 */
export function voxelFaceAO(res) {
  const { size: [W, H, D], solid, idx } = res;
  const occ = (x, y, z) => (y < 0 ? 1 : x < 0 || x >= W || y >= H || z < 0 || z >= D ? 0 : solid[idx(x, y, z)]);
  const faces = [];
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!occ(x, y, z)) continue;
    for (let d = 0; d < 6; d++) {
      const n = DIRS[d], fx = x + n[0], fy = y + n[1], fz = z + n[2];
      if (occ(fx, fy, fz)) continue;
      // 面内两条切向
      const ax = d < 2 ? [0, 1, 0] : d < 4 ? [1, 0, 0] : [1, 0, 0], bx = d < 2 ? [0, 0, 1] : d < 4 ? [0, 0, 1] : [0, 1, 0];
      const ao = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => {
        const s1 = occ(fx + ax[0] * su, fy + ax[1] * su, fz + ax[2] * su), s2 = occ(fx + bx[0] * sv, fy + bx[1] * sv, fz + bx[2] * sv);
        const c = occ(fx + ax[0] * su + bx[0] * sv, fy + ax[1] * su + bx[1] * sv, fz + ax[2] * su + bx[2] * sv);
        return s1 && s2 ? 0 : (3 - s1 - s2 - c) / 3;
      });
      faces.push({ x, y, z, d, ao, axes: [ax, bx] });
    }
  }
  return faces;
}
