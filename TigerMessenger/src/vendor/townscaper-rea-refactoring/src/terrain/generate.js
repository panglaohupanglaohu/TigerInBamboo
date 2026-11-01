/**
 * generate.js — 地形管线：在共享网格上生成岛屿（岩石体素）。
 *
 * 流程移植自 REACode/engine/mesa.js、rivers.js，但改成写进共享的 World（rock 层），
 * 并且用的是和 Townscaper 同一张网格 —— 这是"融合"的前提（学习路线第 0、1 步）。
 *
 *   1. 高度场：域扭曲 fbm + 脊线噪声，乘径向衰减
 *   2. 量化到偶数层（相邻两档至少差 2 层，崖壁是垂直的）—— 1447488323845509121
 *      "combine seamless soft slopes with distinct sharp cliffs"；海边留一圈 1 层的滩
 *   3. 塔柱：平台之上再起石柱
 *   4. 去毛刺：比四邻高 / 低 3 层以上的单格拉回来
 *   5. 峡谷：脊线噪声的窄带切到海面 / 1 层，把一整块饼切成几座台地
 *   6. 河流：深度优先往下游走、遇死路回溯，河床单调下降 —— 1769691526924292506
 *   7. 洞窟：从临水高格往里挖空 1–2 层
 */

import { addFeatures } from './features.js';
import { fbm, ridged, clamp01, smoothstep, makeRng } from '../core/noise.js';

export function generateTerrain(world, {
  seed = 7, maxLevels = 8, towers = 3, canyons = true, rivers = 2, caves = 2, beach = true, features = true,
} = {}) {
  const cells = world.cells;
  const rng = makeRng(seed);
  let span = 0;
  for (const c of cells) span = Math.max(span, Math.hypot(c.cx, c.cz));

  // 1) 高度场
  const raw = new Float32Array(cells.length);
  for (const c of cells) {
    const u = c.cx / (span * 2) + 0.5, v = c.cz / (span * 2) + 0.5;
    const wx = fbm(u * 2.6 + 3.1, v * 2.6 + 8.4, { octaves: 3, freq: 2, seed: seed + 11 });
    const wy = fbm(u * 2.6 + 12.7, v * 2.6 + 1.9, { octaves: 3, freq: 2, seed: seed + 29 });
    const x = u + (wx - 0.5) * 0.22, y = v + (wy - 0.5) * 0.22;
    let e = fbm(x * 1.7, y * 1.7, { octaves: 4, freq: 2.1, gain: 0.52, seed });
    e = e * 0.78 + ridged(x * 2.1, y * 2.1, { octaves: 3, freq: 2.3, seed: seed + 3 }) * 0.22;
    const r = Math.hypot(c.cx, c.cz) / (span * 0.74);
    raw[c.id] = clamp01(e * 1.3 - 0.24) * (1 - smoothstep(0.5, 1.0, r));
  }

  // 2) 量化
  const level = new Int32Array(cells.length);
  for (const c of cells) {
    const t = raw[c.id];
    if (t < 0.3) continue;
    if (beach && t < 0.37) { level[c.id] = 1; continue; }
    const k = (t - 0.37) / 0.63;
    level[c.id] = Math.max(2, Math.round(Math.pow(k, 0.62) * (maxLevels / 2)) * 2);
  }

  // 3) 塔柱
  for (let n = 0; n < towers; n++) {
    const ang = rng() * Math.PI * 2, dist = (0.15 + rng() * 0.45) * span;
    const tx = Math.cos(ang) * dist, tz = Math.sin(ang) * dist, rad = 0.7 + rng() * 1.3;
    const top = Math.min(maxLevels + 2, maxLevels + (rng() < 0.5 ? 2 : 0));
    for (const c of cells) if (level[c.id] >= 2 && Math.hypot(c.cx - tx, c.cz - tz) < rad) level[c.id] = Math.max(level[c.id], top);
  }

  // 4) 去毛刺
  const nb = (c, i) => (c.edgeNeighbors[i] >= 0 ? cells[c.edgeNeighbors[i]] : null);
  for (let pass = 0; pass < 2; pass++) {
    const copy = level.slice();
    for (const c of cells) {
      const h = copy[c.id];
      if (!h) continue;
      let maxN = 0, minN = Infinity;
      for (let i = 0; i < c.n; i++) { const o = nb(c, i); if (!o) continue; maxN = Math.max(maxN, copy[o.id]); minN = Math.min(minN, copy[o.id]); }
      if (minN !== Infinity && maxN - h >= 3) level[c.id] = maxN - 2;
      if (minN !== Infinity && h - minN >= 4) level[c.id] = minN + 2;
    }
  }

  // 5) 峡谷
  if (canyons) {
    for (const c of cells) {
      if (!level[c.id]) continue;
      const ch = ridged(c.cx * 0.11 + 7.3, c.cz * 0.11 + 2.1, { octaves: 2, freq: 1.5, seed: seed + 91 });
      if (ch < 0.2) level[c.id] = 0;
      else if (ch < 0.28) level[c.id] = Math.min(level[c.id], 1);
    }
  }

  world.reset();
  for (const c of cells) if (level[c.id]) world.fill(c, level[c.id], { rock: true });

  // 6) 河流
  const riverCells = rivers > 0 ? carveRivers(world, { seed: seed + 5, count: rivers }) : [];

  // 7) 洞窟
  const rim = cells.filter((c) => world.top(c) >= 4 && c.edgeNeighbors.some((_, i) => { const o = nb(c, i); return !o || world.top(o) === 0; }));
  for (let n = 0; n < caves && rim.length; n++) {
    let cur = rim[(rng() * rim.length) | 0];
    const carved = new Set();
    for (let step = 0; step < 3 && cur && !carved.has(cur.id); step++) {
      carved.add(cur.id);
      world.setSolid(cur, 1, false);
      world.setSolid(cur, 2, false);
      let best = null, score = -1;
      for (let i = 0; i < cur.n; i++) {
        const o = nb(cur, i);
        if (!o || carved.has(o.id) || world.top(o) < 4) continue;
        if (world.top(o) > score) { score = world.top(o); best = o; }
      }
      cur = best;
    }
  }

  // 8) 特征：悬垂、石拱、海中石柱（features.js）
  const feat = features ? addFeatures(world, { seed }) : null;
  world.features = feat;

  world.touch();
  return { rivers: riverCells.length, features: feat };
}

/**
 * 1769691526924292506："collapsing them depth-first to let them wiggle real far"。
 * 从高处出发深度优先往下走（不准爬升超过一层，遇死路回溯），沿途把河床切低，
 * 河床高度只降不升；两岸比河床高出 1 层以上的削到 +1，形成 V 形河谷。
 */
export function carveRivers(world, { seed = 1, count = 2, maxSteps = 220, wiggle = 0.45, depth = 2 } = {}) {
  const rng = makeRng(seed);
  const cells = world.cells;
  const h = (c) => world.ground(c);
  const nb = (c, i) => world.neighbor(c, i);
  const sources = [];
  for (const c of cells.filter((x) => h(x) > 3).sort((a, b) => h(b) - h(a))) {
    if (sources.length >= count) break;
    if (sources.some((s) => Math.hypot(s.cx - c.cx, s.cz - c.cz) < 6)) continue;
    sources.push(c);
  }
  const riverCells = new Set();
  for (const source of sources) {
    const seen = new Set([source.id]);
    const stack = [{ cell: source, prev: null }];
    const path = [source];
    while (stack.length && path.length < maxSteps) {
      const top = stack[stack.length - 1];
      const cur = top.cell;
      if (h(cur) <= 0) break;
      const opts = [];
      for (let i = 0; i < cur.n; i++) {
        const o = nb(cur, i);
        if (!o || seen.has(o.id) || h(o) > h(cur) + 1) continue;
        opts.push({ cell: o, score: (h(cur) - h(o)) * 0.4 + rng() * wiggle * 5 });
      }
      if (!opts.length) { stack.pop(); path.pop(); continue; }
      opts.sort((a, b) => b.score - a.score);
      const next = opts[0].cell;
      seen.add(next.id);
      path.push(next);
      stack.push({ cell: next, prev: cur });
      if (h(next) === 0) break;
    }
    let bed = null;
    for (const c of path) {
      if (h(c) === 0) break;
      const lvl = bed === null ? Math.max(1, h(c) - depth) : Math.min(bed, Math.max(1, h(c) - 1));
      bed = Math.max(1, lvl);
      world.fill(c, bed, { rock: true });
      world.river[c.id] = 1;
      riverCells.add(c.id);
    }
  }
  for (const id of riverCells) {
    const c = cells[id];
    for (let i = 0; i < c.n; i++) {
      const o = nb(c, i);
      if (!o || riverCells.has(o.id)) continue;
      if (world.ground(o) > world.ground(c) + 1) world.fill(o, world.ground(c) + 1, { rock: true });
    }
  }
  world.touch();
  return [...riverCells];
}
