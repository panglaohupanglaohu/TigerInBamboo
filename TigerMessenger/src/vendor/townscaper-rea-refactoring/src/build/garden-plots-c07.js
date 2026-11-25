/**
 * garden-plots-c07.js — 第 56 批 C07：后院 = 石边草地块 + 从门口出发的细石板小径 + 中心圆台装饰（默认关，world.gardenPlots）。
 *
 *   1178731576982724611「I made some grassy plots. I'm real happy with the shapes they make.」
 *     画面：围合的码头层空地被分成一块块草地，每块草地四周一圈石沿（按块、不是按格），拆掉屋子空出来的格并进来、地块重新划分。
 *   1290997501332525056「... I added some garden paths.」
 *     画面：院子里的小径是比格子窄得多的石板条，从（新开的）门口出发，汇到中间一个圆形小广场，广场中心有装饰；
 *     0141–0143 帧加了一扇门，立刻长出一条从这扇门通到小径网的新路。
 *
 * 本地规则（原作没给算法）：
 *   - 门优先：小径端点 = 院子里贴着「房子门」那条边的格（buildings.js 的 door 表：每栋房子一扇门，开在朝码头层空地的墙上）；
 *     中心 = 离院子形心最近的格；从中心在院内 BFS，取到每个门格的最短路并成小径树。院子里没有门就沿用原 core/garden-paths.js 的端点。
 *   - 草地块 = 院内非小径格用 core/field-plots.js 的 partitionPlots 并成 2–5 格的块；块的外边界整体内收一道石沿。
 *   - 大田（第 194 轮）：院子草格 ≥ 2×9=18 时，先长一块「大田」占草格 ≈55%（上限 16 格），余下再按 2–5 格切 ——
 *     片 0095/0250 里同一座岛上是「一块 10+ 格的大田 + 若干 2–5 格小块」，不是均一的碎块；草格不够 18 时不出大田（保持旧形制）。
 *   - 最小块 2 格：1 格地块并进共边最多的邻块（片里没有 1 格的孤立草地）。
 *   - 小径条宽 0.2（格宽约 1），只沿小径树的连接边画（格心 → 边中点），门格多画一段到门边。
 */
import { partitionPlots } from '../core/field-plots.js';
import { gardenPaths } from '../core/garden-paths.js';
import { UP } from '../core/meshwriter.js';

const h01 = (x) => { let h = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/**
 * 大田：从「邻居最多」的草格起（同样多取 id 小的），每步吃「与本区域共边最多」的候选（同样多取 id 小的），
 * 长到 target 格为止。全程无随机 → 同输入同输出。返回 Set<cellId>。
 */
export function growBigField(lawn, lawnNbr, target) {
  if (!lawn.length || target <= 0) return new Set();
  const byId = new Map(lawn.map((c) => [c.id, c]));
  let seed = lawn[0], bestDeg = -1;
  for (const c of lawn) { const d = lawnNbr(c).length; if (d > bestDeg || (d === bestDeg && c.id < seed.id)) { bestDeg = d; seed = c; } }
  const inRegion = new Set([seed.id]), frontier = new Set();
  for (const o of lawnNbr(seed)) frontier.add(o.id);
  while (inRegion.size < target && frontier.size) {
    let best = -1, bestAdj = -1;
    for (const id of frontier) {
      if (!byId.has(id)) continue;
      let adj = 0; for (const o of lawnNbr(byId.get(id))) if (inRegion.has(o.id)) adj++;
      if (adj > bestAdj || (adj === bestAdj && id < best)) { bestAdj = adj; best = id; }
    }
    if (best < 0) break;
    inRegion.add(best); frontier.delete(best);
    for (const o of lawnNbr(byId.get(best))) if (!inRegion.has(o.id)) frontier.add(o.id);
  }
  return inRegion;
}

/**
 * @param {object} world  共享 World
 * @param {object[][]} comps  courtyards.components
 * @param {Map} door  buildings.js 的 door 表（house → { key:'cellId:edge' }）
 * @param {(c,i)=>object|null} nbr
 * @param {Uint8Array} path  原小径标记（就地改写：有门的院子换成门优先的小径树）
 */
export function planGardenC07(world, comps, door, nbr, path, { maxPlot = 5, bigField = 0.55, bigMin = 9, bigMax = 16 } = {}) {
  const cells = world.cells, compOf = new Map();
  comps.forEach((comp, k) => { for (const c of comp) compOf.set(c.id, k); });
  const links = new Map(), hubs = new Set(), doorCells = new Map(), plotOf = new Map(), plots = [];
  const link = (a, i) => { if (!links.has(a.id)) links.set(a.id, new Set()); links.get(a.id).add(i); };
  const edgeTo = (a, b) => { for (let i = 0; i < a.n; i++) if (nbr(a, i)?.id === b.id) return i; return -1; };
  // 门：房子格 c 的第 i 条边外面是院子格 → 院子格记一条「门边」
  for (const { key } of door.values()) {
    const [cid, ei] = key.split(':').map(Number), c = cells[cid], y = c && nbr(c, ei);
    if (!y || !compOf.has(y.id)) continue;
    const back = edgeTo(y, c); if (back < 0) continue;
    if (!doorCells.has(y.id)) doorCells.set(y.id, []);
    doorCells.get(y.id).push(back);
  }
  const stats = { comps: comps.length, doorPaths: 0, fallbackPaths: 0, plots: 0, hubs: 0, bigPlots: 0, bigCells: 0, plotSizes: [] };
  comps.forEach((comp, k) => {
    const ids = new Set(comp.map((c) => c.id));
    const doors = comp.filter((c) => doorCells.has(c.id));
    const n = comp.length, mx = comp.reduce((s, c) => s + c.cx, 0) / n, mz = comp.reduce((s, c) => s + c.cz, 0) / n;
    const hub = comp.reduce((a, c) => ((c.cx - mx) ** 2 + (c.cz - mz) ** 2 < (a.cx - mx) ** 2 + (a.cz - mz) ** 2 - 1e-10 ? c : a), comp[0]);
    for (const c of comp) path[c.id] = 0;
    if (doors.length && n >= 3) {
      // 中心出发的 BFS 树，每个门格回溯到中心
      const parent = new Map([[hub.id, null]]), q = [hub];
      for (let i = 0; i < q.length; i++) for (let e = 0; e < q[i].n; e++) { const b = nbr(q[i], e); if (b && ids.has(b.id) && !parent.has(b.id)) { parent.set(b.id, q[i]); q.push(b); } }
      for (const d of doors) {
        for (let c = d; parent.get(c.id); c = parent.get(c.id)) { const p = parent.get(c.id); path[c.id] = path[p.id] = 1; link(c, edgeTo(c, p)); link(p, edgeTo(p, c)); }
        path[d.id] = 1; for (const e of doorCells.get(d.id)) link(d, e);
      }
      stats.doorPaths += doors.length;
    } else if (n >= 6) {
      const plan = gardenPaths(comp, (c) => Array.from({ length: c.n }, (_, i) => nbr(c, i)));
      for (const id of plan.path) path[id] = 1;
      for (const id of plan.path) { const c = cells[id]; for (let e = 0; e < c.n; e++) { const b = nbr(c, e); if (b && plan.path.has(b.id)) link(c, e); } }
      stats.fallbackPaths++;
    }
    if (n >= 6 && path[hub.id]) { hubs.add(hub.id); stats.hubs++; }
    // 草地块：非小径格
    const lawn = comp.filter((c) => !path[c.id]);
    if (lawn.length) {
      const lawnIds = new Set(lawn.map((c) => c.id));
      const lawnNbr = (c) => { const out = []; for (let i = 0; i < c.n; i++) { const b = nbr(c, i); if (b && lawnIds.has(b.id)) out.push(b); } return out; };
      const local = [];
      // ① 大田：草格够两倍「大田最小格数」才切，保证余下还够再分小块（片里是「大田 + 小块」共存）
      let rest = lawn;
      if (bigField > 0 && lawn.length >= 2 * bigMin) {
        const target = Math.min(bigMax, Math.max(bigMin, Math.round(lawn.length * bigField)), lawn.length - bigMin);
        const bigIds = growBigField(lawn, lawnNbr, target);
        if (bigIds.size >= bigMin) {
          local.push({ cells: lawn.filter((c) => bigIds.has(c.id)).map((c) => c.id), big: true });
          rest = lawn.filter((c) => !bigIds.has(c.id));
          stats.bigPlots++; stats.bigCells += bigIds.size;
        }
      }
      // ② 余下按 2–5 格切
      if (rest.length) {
        const restIds = new Set(rest.map((c) => c.id));
        const part = partitionPlots({ cells: rest, neighbors: (c) => { const out = []; for (let i = 0; i < c.n; i++) { const b = nbr(c, i); if (b && restIds.has(b.id)) out.push(b); } return out; }, seed: 1 + Math.min(...rest.map((c) => c.id)), joinChance: 0.85, maxCells: maxPlot });
        for (const p of part.plots) local.push({ cells: p.cells, big: false });
      }
      // ③ 不做「最小块合并」：片 0095 里确有单格圆角草台（石沿内一小片草），1 格地块是合理的
      for (const p of local) {
        if (!p.cells.length) continue;
        const idx = plots.length;
        for (const id of p.cells) plotOf.set(id, idx);
        plots.push({ comp: k, cells: p.cells, big: !!p.big });
      }
    }
  });
  stats.plots = plots.length;
  stats.plotSizes = plots.map((p) => p.cells.length).sort((a, b) => b - a);
  return { links, hubs, doorCells, plotOf, plots, compOf, stats };
}

/** 凸多边形按每条边各自的内收量偏移（边线平移后相邻边求交）。 */
export function insetPolygon(pts, amounts) {
  const n = pts.length, lines = [];
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l * s, nz = dx / l * s, d = amounts[i];   // 指向多边形内部
    lines.push([a[0] + nx * d, a[1] + nz * d, dx, dz]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = lines[(i + n - 1) % n], q = lines[i], den = p[2] * q[3] - p[3] * q[2];
    if (Math.abs(den) < 1e-9) { out.push([q[0], q[1]]); continue; }
    const t = ((q[0] - p[0]) * q[3] - (q[1] - p[1]) * q[2]) / den;
    out.push([p[0] + p[2] * t, p[1] + p[3] * t]);
  }
  return out;
}

/** 画一格院子（替代 buildings.js 原来「整格草 / 整格石板」的那一段）。 */
export function drawGardenCellC07(w, c, y, plan, K, nbr) {
  const P = c.pts.map((p) => [p.x, p.z]);
  // 底：石沿 / 小径底色
  w.poly(P.map(([x, z]) => [x, y, z]), UP, K.stone, 0.9 + 0.06 * h01(c.id));
  const plot = plan.plotOf.get(c.id);
  if (plot !== undefined) {
    const amounts = c.pts.map((_, i) => { const b = nbr(c, i); return b && plan.plotOf.get(b.id) === plot ? 0 : 0.07; });
    const lawnC = h01(plot * 7 + 3) < 0.5 ? K.lawn : K.lawnAlt;
    w.poly(insetPolygon(P, amounts).map(([x, z]) => [x, y + 0.004, z]), UP, lawnC, 0.96 + 0.06 * h01(plot));
    return 'plot';
  }
  // 小径格：先铺满草，再沿连接边画窄石板条
  w.poly(P.map(([x, z]) => [x, y + 0.004, z]), UP, K.lawn, 0.97);
  // 尺度跟格子走：格心到最近边中点的距离 rc；小径宽 ≈ 0.36·rc，广场半径 ≈ 0.85·rc
  let rc = Infinity; for (let i = 0; i < c.n; i++) { const a = c.pts[i], b = c.pts[(i + 1) % c.n]; rc = Math.min(rc, Math.hypot((a.x + b.x) / 2 - c.cx, (a.z + b.z) / 2 - c.cz)); }
  const hub = plan.hubs.has(c.id), hw = 0.18 * rc, yS = y + 0.009;
  const strip = (i) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.n], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, dx = mx - c.cx, dz = mz - c.cz, l = Math.hypot(dx, dz) || 1, px = -dz / l, pz = dx / l;
    for (const [wd, col, dy] of [[hw, K.stone, 0], [hw * 0.68, K.pavingAlt, 0.002]])
      w.quad([c.cx + px * wd, yS + dy, c.cz + pz * wd], [mx + px * wd, yS + dy, mz + pz * wd], [mx - px * wd, yS + dy, mz - pz * wd], [c.cx - px * wd, yS + dy, c.cz - pz * wd], UP, col, 1.05);
  };
  for (const i of plan.links.get(c.id) || []) strip(i);
  const ring = (r, col, dy, k = 12) => w.poly(Array.from({ length: k }, (_, j) => { const a = -j / k * Math.PI * 2; return [c.cx + Math.cos(a) * r, yS + dy, c.cz + Math.sin(a) * r]; }), UP, col, 1.05);
  if (hub) {
    // 中心圆形小广场 + 中央装饰（石台 + 圆冠小树），片子 0143 起
    ring(0.85 * rc, K.stone, 0.001, 20); ring(0.72 * rc, K.pavingAlt, 0.003, 20);
    w.box(c.cx, yS + 0.004, c.cz, 0.3 * rc, 0.05, 0.3 * rc, K.stone, 1);
    w.box(c.cx, yS + 0.054, c.cz, 0.08 * rc, 0.08, 0.08 * rc, K.trunk, 1);
    w.blob(c.cx, yS + 0.17, c.cz, 0.2 * rc, 0.07, K.tree);
    return 'hub';
  }
  ring(hw, K.stone, 0.001, 8); ring(hw * 0.68, K.pavingAlt, 0.003, 8);
  return 'path';
}
