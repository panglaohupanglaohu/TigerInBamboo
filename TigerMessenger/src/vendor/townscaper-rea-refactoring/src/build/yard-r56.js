/**
 * yard-r56.js — 第 56 批 C05-D：后院矮墙分区 + 拱门缺口，及后院植物的稳定道具清单（给道具出现/消失动画）。
 *
 * 1238474550511308800 "if you build an enclosed area it becomes a backyard!"：封闭后院里不只是草地 + 树，
 *   还有**矮石墙**沿小径把草地隔成一块块小园，每块小园在墙上留一个带小拱的门洞（sheet-00/01；1246 的 frame-0029 原尺寸可见）。
 * 1246074663546916873 "The props now animate when they appear and disappear"：树 / 灌木随布局更替而长出、缩没。
 *
 * 机制（本地离散规则，非原版算法逐行复原）：
 *  - 后院连通块 = classifyCourtyards；小径 = gardenPaths（与 buildings.js 同一份结果）。
 *  - 小园 = 后院里非小径格的连通块；矮墙 = 小径格与草地格之间的每条公共边。
 *  - 门：每个小园在它的"小径–草地"边里选一条（离小园质心最近，按哈希破平）留缺口 + 画拱；
 *    只靠房屋围着、不挨小径的小园不开门（由房屋门进出）。
 *  - yardFloraSpecs：用 buildings.js 后院树的同一套哈希（r<0.25 大树、<0.45 小树、<0.7 灌木），
 *    每株一个稳定 key（tree:<格>/shrub:<格>），供 prop-anim 层做出现/消失动画。
 * 开关：world.yardWalls / world.propAnimYard（默认关；关时几何不变）。
 */
import { classifyCourtyards } from '../core/courtyards.js';
import { gardenPaths } from '../core/garden-paths.js';
import { hash01, mix } from '../core/noise.js';
import { UP } from '../core/meshwriter.js';

/** 纯函数：后院 + 小径 + 小园 + 墙边 + 门。 */
export function planYardWalls(world, { components = null, path = null } = {}) {
  const cells = world.cells, n = cells.length;
  if (!components) components = classifyCourtyards(world).components;
  if (!path) {
    path = new Uint8Array(n);
    for (const comp of components) for (const id of gardenPaths(comp, (c) => Array.from({ length: c.n }, (_, i) => world.neighbor(c, i))).path) path[id] = 1;
  }
  const yard = new Uint8Array(n); for (const comp of components) for (const c of comp) yard[c.id] = 1;
  const plotOf = new Int32Array(n).fill(-1), plots = [];
  for (const comp of components) for (const s of comp) {
    if (path[s.id] || plotOf[s.id] >= 0) continue;
    const id = plots.length, list = [], st = [s]; plotOf[s.id] = id;
    while (st.length) { const c = st.pop(); list.push(c.id); for (let i = 0; i < c.n; i++) { const o = world.neighbor(c, i); if (o && yard[o.id] && !path[o.id] && plotOf[o.id] < 0) { plotOf[o.id] = id; st.push(o); } } }
    plots.push({ id, cells: list, edges: [], gate: null });
  }
  const walls = [];
  for (const c of cells) {
    if (!yard[c.id] || path[c.id]) continue;          // 从草地一侧记边（每条边一次）
    for (let i = 0; i < c.n; i++) {
      const o = world.neighbor(c, i);
      if (!o || !yard[o.id] || !path[o.id]) continue;
      const a = c.pts[i], b = c.pts[(i + 1) % c.n];
      const e = { lawn: c.id, path: o.id, edge: i, a: [a.x, a.z], b: [b.x, b.z], plot: plotOf[c.id], gate: false };
      walls.push(e); plots[e.plot].edges.push(walls.length - 1);
    }
  }
  for (const p of plots) {
    if (!p.edges.length) continue;
    let cx = 0, cz = 0; for (const id of p.cells) { cx += cells[id].cx; cz += cells[id].cz; } cx /= p.cells.length; cz /= p.cells.length;
    let best = -1, bd = Infinity;
    for (const k of p.edges) { const e = walls[k], d = Math.hypot((e.a[0] + e.b[0]) / 2 - cx, (e.a[1] + e.b[1]) / 2 - cz) + 1e-3 * hash01(e.lawn * 31 + e.edge); if (d < bd) { bd = d; best = k; } }
    walls[best].gate = true; p.gate = best;
  }
  return { yard, path, plots, walls };
}

/** 画矮墙与拱门（buildings.js 在 world.yardWalls 时调用）。 */
export function drawYardWalls(w, world, plan, { L, K, h = 0.11, t = 0.018 }) {
  const y = L + 0.006;
  const slab = (a, b, y0, y1, th, col, sh = 1) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * th, nz = dx / l * th;
    const P = (p, s, yy) => [p[0] + nx * s, yy, p[1] + nz * s];
    w.quad(P(a, 1, y0), P(b, 1, y0), P(b, 1, y1), P(a, 1, y1), [nx, 0, nz], col, sh);
    w.quad(P(a, -1, y0), P(b, -1, y0), P(b, -1, y1), P(a, -1, y1), [-nx, 0, -nz], col, sh * .92);
    w.quad(P(a, 1, y1), P(b, 1, y1), P(b, -1, y1), P(a, -1, y1), UP, K.frame, .9);    // 浅色压顶
    w.quad(P(a, 1, y0), P(a, -1, y0), P(a, -1, y1), P(a, 1, y1), [-dx, 0, -dz], col, .85);
    w.quad(P(b, 1, y0), P(b, -1, y0), P(b, -1, y1), P(b, 1, y1), [dx, 0, dz], col, .85);
  };
  let segs = 0, gates = 0;
  for (const e of plan.walls) {
    w.at?.(world.cells[e.lawn]);
    if (!e.gate) { slab(e.a, e.b, y, y + h, t, K.stone, 1); segs++; continue; }
    // 门洞：两侧墙垛 + 门柱 + 半圆拱（6 段）
    const g0 = [mix(e.a[0], e.b[0], .3), mix(e.a[1], e.b[1], .3)], g1 = [mix(e.a[0], e.b[0], .7), mix(e.a[1], e.b[1], .7)];
    slab(e.a, g0, y, y + h, t, K.stone, 1); slab(g1, e.b, y, y + h, t, K.stone, 1); segs += 2;
    const ph = h * 1.9, r = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]) / 2;
    w.beam([g0[0], y, g0[1]], [g0[0], y + ph, g0[1]], 2 * t + .01, K.stone, 1.05);
    w.beam([g1[0], y, g1[1]], [g1[0], y + ph, g1[1]], 2 * t + .01, K.stone, 1.05);
    let prev = null;
    for (let s = 0; s <= 6; s++) {
      const th = Math.PI * s / 6, u = .5 - .5 * Math.cos(th), p = [mix(g0[0], g1[0], u), y + ph + r * Math.sin(th), mix(g0[1], g1[1], u)];
      if (prev) w.beam(prev, p, t * 1.6, K.stone, 1.1);
      prev = p;
    }
    gates++;
  }
  return { segs, gates, plots: plan.plots.length, walls: plan.walls.length };
}

/** 后院植物的稳定清单（与 buildings.js「后院的树」同一套哈希）。 */
export function yardFloraSpecs(world, { L = .5, plan = null } = {}) {
  const { yard, path } = plan ?? planYardWalls(world);
  const out = [];
  for (const c of world.cells) {
    if (!yard[c.id] || path[c.id]) continue;
    const r = hash01(c.id * 977 + 5), y = L + 0.006;
    if (r < 0.45) {
      const big = r < 0.25, s = big ? 0.15 : 0.11;
      out.push({ key: 'tree:' + c.id, kind: big ? 'treeBig' : 'tree', cell: c.id, x: c.cx + (hash01(c.id * 31) - 0.5) * 0.1, y, z: c.cz + (hash01(c.id * 37) - 0.5) * 0.1, s });
    } else if (r < 0.7) out.push({ key: 'shrub:' + c.id, kind: 'shrub', cell: c.id, x: c.cx, y, z: c.cz, s: 0.09 });
  }
  return out;
}
