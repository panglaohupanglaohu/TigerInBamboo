import {rebuildRiverNetwork} from './river-network.js';
import {fillTerrainDepressions} from './drainage.js';
import {depressionFill} from '../core/depression-fill.js';
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
import { placeLedges, thinLedges } from './thin-platform.js';
import { fbm, ridged, clamp01, smoothstep, makeRng } from '../core/noise.js';

export function generateTerrain(world, {
  seed = 7, maxLevels = 8, towers = 3, canyons = true, rivers = 2, caves = 2, beach = true, features = true, drainage = false, riverNetwork = false, softSlopes = false,
  riverRelax = false, lakes = false, erosion = null, basins = 0, softRelax = false, ledges = 0,
} = {}) {
  // r55: riverRelax = BFS gentle-slope collapse around carved rivers; lakes = joint lake/hole rebuild
  // (water-mode fill + every dangling river and every lake spill re-linked to the sea); erosion = stream power.
  if ((lakes || erosion) && (drainage || riverNetwork)) throw new RangeError('lakes/erosion replace drainage/riverNetwork; use one of them');
  if(riverNetwork && (caves!==0 || features || drainage))throw new RangeError('riverNetwork generation requires caves=0, features=false, drainage=false; protects channel topology');
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
  // softSlopes（REACode/overhangterrain heightField + terracecliff，1447488323845509121
  // "combine seamless soft slopes with distinct sharp cliffs"）：低频掩码按本场分位数
  // p30/p58 分出缓坡省（逐层 1 级台阶）与陡崖省（偶数层 2 级崖），过渡带按掩码插值，
  // 所以两种地形之间没有直线拼缝。World 只存整数层，缓坡 = 1 层小台阶，不是连续坡面。
  const sharp = softSlopes ? slopeMask(cells, seed) : null;
  // r55: keep the province mask beside the integer World; terrainmesh (world.softTops) uses it to
  // draw a continuous soft-slope surface where 1-level steps sit in soft provinces.
  const level = new Int32Array(cells.length);
  for (const c of cells) {
    const t = raw[c.id];
    if (t < 0.3) continue;
    if (beach && t < 0.37) { level[c.id] = 1; continue; }
    const k = (t - 0.37) / 0.63;
    const cliff = Math.max(2, Math.round(Math.pow(k, 0.62) * (maxLevels / 2)) * 2);
    if (!sharp) { level[c.id] = cliff; continue; }
    const soft = Math.max(2, Math.round(Math.pow(k, 0.62) * maxLevels));
    level[c.id] = Math.round(soft + (cliff - soft) * sharp[c.id]);
  }

  // 3) 塔柱
  for (let n = 0; n < towers; n++) {
    const ang = rng() * Math.PI * 2, dist = (0.15 + rng() * 0.45) * span;
    const tx = Math.cos(ang) * dist, tz = Math.sin(ang) * dist, rad = 0.7 + rng() * 1.3;
    const top = Math.min(maxLevels + 2, maxLevels + (rng() < 0.5 ? 2 : 0));
    for (const c of cells) if (level[c.id] >= 2 && Math.hypot(c.cx - tx, c.cz - tz) < rad) { level[c.id] = Math.max(level[c.id], top); if (sharp && softRelax) sharp[c.id] = 1; }   // 塔柱永远是陡崖
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

  // 5b) 缓坡连续化（softRelax，需 softSlopes）：缓坡省里相邻两格最多差 1 层，world.softTops 才能把它们连成连续坡面
  const softLimit = sharp && softRelax ? limitSoftSlopes(cells, level, sharp, softRelax === true ? {} : softRelax) : null;

  world.reset();
  world.lakes = null;
  world.slopeMask = sharp;
  world.softLimit = softLimit;
  for (const c of cells) if (level[c.id]) world.fill(c, level[c.id], { rock: true });

  // 6) 河流
  const network = riverNetwork ? rebuildRiverNetwork(world, riverNetwork===true?{}:riverNetwork) : null;
  world.riverFlow = null;
  const riverCells = network ? [...world.river.keys()].filter(id=>world.river[id]) : rivers > 0 ? carveRivers(world, { seed: seed + 5, count: rivers }) : [];
  const relax = riverRelax && riverCells.length ? relaxRiverSlopes(world, { seed: seed + 13, ...(riverRelax === true ? {} : riverRelax) }) : null;

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

  // 8b) 沿墙薄檐（thin-platform.js，781957658597269506，默认关）：高崖腰上挑出一层悬空窄檐，
  // 可站可走（top==ground 进可走图），落差 ≤2 的邻边 buildNav 放楼梯，ladderContact 判 thinPlatform。
  world.ledgeReport = ledges > 0 ? placeLedges(world, { seed: seed + 67, count: ledges }) : null;
  if (world.ledgeReport?.ledges.length) world.thinLedges = thinLedges(world);

  world.drainage = drainage ? fillTerrainDepressions(world, drainage===true?{}:drainage) : null;
  let joint = null;
  const holes = basins > 0 ? digBasins(world, { seed: seed + 41, count: basins }) : [];
  if (lakes || erosion) {
    world.drainage = fillTerrainDepressions(world, { lakes: lakes ? 'water' : 'rock', erosion: erosion ?? null });
    if (lakes) joint = linkRiversThroughLakes(world);
  }
  world.touch();
  if(world.drainage)world.drainage.version=world.version;
  if(network)network.version=world.version;
  if(world.drainage?.riverNetwork){world.riverNetwork=world.drainage.riverNetwork;world.riverNetwork.version=world.version;world.riverFlow=null;}
  // 开凿顺序流向只在河格仍是生成时那批时有效（洞窟/特征只改非河格，填洼会清掉被抬的河段）。
  if(world.riverFlow)world.riverFlow.version=world.version;
  if(world.lakes)world.lakes.version=world.version;
  return { relax, joint, holes, lakes: world.lakes?.lakes.length ?? 0, riverNetwork:network, drainage:world.drainage, rivers: drainage?world.river.reduce((a,b)=>a+b,0):riverCells.length, features: feat, ledges: world.ledgeReport };
}

/**
 * 1769691526924292506："collapsing them depth-first to let them wiggle real far"。
 * 本地近似（不是配文中的球面约束坍缩）：从高处出发深度优先往下走（不准爬升超过一层，遇死路回溯），沿途把河床切低，
 * 尚未实现“先河道约束坍缩、其余广度优先”的完整求解。河床高度只降不升；两岸比河床高出 1 层以上的削到 +1，形成 V 形河谷。
 */
export function carveRivers(world, { seed = 1, count = 2, maxSteps = 220, wiggle = 0.45, depth = 2, minSeparation = 6 } = {}) {
  const rng = makeRng(seed);
  const cells = world.cells;
  const h = (c) => world.ground(c);
  const nb = (c, i) => world.neighbor(c, i);
  const sources = [];
  for (const c of cells.filter((x) => h(x) > 3).sort((a, b) => h(b) - h(a))) {
    if (sources.length >= count) break;
    // r55: planet Worlds (src/sphere/planet-town.js planetWorld) carry a unit direction `dir`; use chord length there.
    if (sources.some((s) => (c.dir && s.dir ? Math.hypot(s.dir[0] - c.dir[0], s.dir[1] - c.dir[1], s.dir[2] - c.dir[2]) : Math.hypot(s.cx - c.cx, s.cz - c.cz)) < minSeparation)) continue;
    sources.push(c);
  }
  const riverCells = new Set();
  // REACode/engine/rivers.js 返回 paths/mouths：平床河段的"哪边是下游"只能来自 DFS
  // 开凿顺序（高度看不出）。这里把它写进共享 World.riverFlow，导航按版本读取。
  const flowTo = new Int32Array(cells.length).fill(-1), paths = [], mouths = [];
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
    const carved = [];
    for (const c of path) {
      if (h(c) === 0) { mouths.push(c.id); break; }
      const lvl = bed === null ? Math.max(1, h(c) - depth) : Math.min(bed, Math.max(1, h(c) - 1));
      bed = Math.max(1, lvl);
      world.fill(c, bed, { rock: true });
      world.river[c.id] = 1;
      riverCells.add(c.id);
      carved.push(c.id);
    }
    // 汇流：先开凿的河保留自己的流向，后来的支流并入时不改写。
    for (let i = 0; i + 1 < carved.length; i++) if (flowTo[carved[i]] < 0) flowTo[carved[i]] = carved[i + 1];
    if (carved.length) paths.push(carved);
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
  world.riverFlow = { flowTo, paths, mouths, version: world.version };
  return [...riverCells];
}

/**
 * 缓坡连续化 —— 1447488323845509121 "Properly combine seamless soft slopes with distinct sharp cliffs"。
 * softSlopes 只把缓坡省量化成逐层台阶，但噪声一格就能跳 2 层以上，结果缓坡省里仍然满是小崖，
 * soft-tops 没有可以连成坡面的 1 层台阶。这里给缓坡省加坡度上限：相邻两个缓坡格最多差 `step` 层。
 * 从低处往高处传播（桶队列，只降不升）：低格 h，缓坡邻格高于 h+step 的降到 h+step。
 * 陡崖省（sharp ≥ 0.5）的格不参与，也不被拉低，所以崖仍是崖；缓坡省与陡崖省之间的落差原样保留。
 * 海（level 0）不是源：临海的缓坡格不会被压成滩，海岸轮廓不变；pinned(c) 为真的格也保持原高。
 * 只改 level 数组（整数层），不建网格；返回降了多少格、多少层。
 */
export function limitSoftSlopes(cells, level, sharp, { step = 1, pinned = null } = {}) {
  if (!(step >= 1)) throw new RangeError('step must be >= 1');
  const soft = (id) => level[id] > 0 && sharp[id] < 0.5 && !(pinned && pinned(cells[id]));
  let top = 0; for (const c of cells) top = Math.max(top, level[c.id]);
  const buckets = Array.from({ length: top + 1 }, () => []);
  for (const c of cells) if (soft(c.id)) buckets[level[c.id]].push(c.id);
  let lowered = 0, volume = 0;
  for (let h = 1; h <= top; h++) for (let i = 0; i < buckets[h].length; i++) {
    const id = buckets[h][i]; if (level[id] !== h) continue;                 // 已被降到更低的桶
    for (const o of cells[id].edgeNeighbors) {
      if (o < 0 || !soft(o) || level[o] <= h + step) continue;
      volume += level[o] - (h + step); lowered++; level[o] = h + step; buckets[h + step].push(o);
    }
  }
  return { lowered, volume, step };
}

/** 0 = 缓坡省，1 = 陡崖省；阈值取本场分位数（REACode/overhangterrain p30/p58）。 */
export function slopeMask(cells, seed) {
  let span = 0;
  for (const c of cells) span = Math.max(span, Math.hypot(c.cx, c.cz));
  const raw = cells.map((c) => fbm(c.cx / (span * 2) * 1.3 + 21.3, c.cz / (span * 2) * 1.3 + 9.4, { octaves: 3, freq: 2, seed: seed + 57 }));
  const sorted = [...raw].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.3)], hi = sorted[Math.floor(sorted.length * 0.58)];
  return Float32Array.from(raw, (v) => smoothstep(lo, hi, v));
}

/**
 * 1769691526924292506 "...and then the rest is collapsed breadth-first, making nice gentle slopes that
 * only occasionally meet steep cliffs." After the depth-first river carve, a breadth-first pass grows
 * out from every river cell over land: a cell more than `step` levels above the BFS parent it was reached
 * from is lowered to parent+step, except with probability `cliffChance`, where the step is kept as a cliff
 * (and the BFS continues from the cliff top). Only pure rock columns are lowered; river beds never move.
 */
export function relaxRiverSlopes(world, { seed = 1, step = 1, cliffChance = 0.12 } = {}) {
  const cells = world.cells, rng = makeRng(seed), h = (c) => world.ground(c);
  const steep = () => { let s = 0; for (const c of cells) for (const id of c.edgeNeighbors) if (id > c.id && h(c) && h(cells[id]) && Math.abs(h(c) - h(cells[id])) > step) s++; return s; };
  const before = steep(), seen = new Uint8Array(cells.length), queue = [], depth = new Int32Array(cells.length);
  for (const c of cells) if (world.river[c.id]) { seen[c.id] = 1; queue.push(c); }
  let lowered = 0, volume = 0, cliffs = 0;
  for (let k = 0; k < queue.length; k++) {
    const cur = queue[k];
    for (let i = 0; i < cur.n; i++) {
      const o = world.neighbor(cur, i);
      if (!o || seen[o.id] || !h(o)) continue;
      seen[o.id] = 1; depth[o.id] = depth[cur.id] + 1; queue.push(o);
      const g = h(o), cap = h(cur) + step;
      if (g <= cap) continue;
      const pure = world.solid[o.id] === world.rock[o.id] && world.top(o) === g;
      if (!pure || rng() < cliffChance) { cliffs++; continue; }
      world.fill(o, cap, { rock: true });
      lowered++; volume += g - cap;
    }
  }
  return { lowered, volume, cliffsKept: cliffs, reached: queue.length, steepEdgesBefore: before, steepEdgesAfter: steep(), maxDepth: Math.max(0, ...depth) };
}

/**
 * Joint lake/hole rebuild (r55). Needs World.lakes from a water-mode fill. Holes left by the carve
 * (river beds forced monotone, caves) are lakes now; this re-links the river graph through them:
 * submerged river marks are dropped (the lake is the water body), lake cells drain along the
 * priority-flood tree to their spill cell, every lake spill and every dangling river end is
 * continued down the same tree until it meets the sea, another lake or an already-flowing river.
 * Result: every river cell's flowTo chain reaches the sea, passing only through rivers and lakes.
 */
export function linkRiversThroughLakes(world) {
  const cells = world.cells, n = cells.length, W = world.lakes;
  if (!W) throw new RangeError('linkRiversThroughLakes needs World.lakes (water-mode fill)');
  const parent = W.parent, lakeOf = W.lakeOf, filled = world.drainage?.filled;
  const old = world.riverFlow?.flowTo;
  const flowTo = new Int32Array(n).fill(-1);
  const sea = (id) => id < 0 || !world.ground(cells[id]);
  let submerged = 0, extended = 0, spills = 0;
  for (let id = 0; id < n; id++) {
    if (lakeOf[id] >= 0) { if (world.river[id]) { world.river[id] = 0; submerged++; } continue; }
    // Keep the carve order only where it strictly descends on the filled surface: with PF-tree steps
    // (non-increasing, acyclic on ties) the combined graph can then never cycle.
    if (world.river[id] && old && old[id] >= 0 && filled && filled[old[id]] < filled[id]) flowTo[id] = old[id];
  }
  // Inside each lake, all water drains to its one spill cell (BFS tree rooted at the member that spills).
  for (const lake of W.lakes) {
    // The true outlet is the parent of the lake's earliest-flooded member: its ancestor chain reaches the
    // sea without re-entering the lake (later members on flat ties may point at rim cells that loop back).
    const inLake = new Set(lake.cells);
    const clean = (m) => { let k = parent[m], steps = 0; while (k >= 0 && steps++ < n) { if (inLake.has(k)) return false; k = parent[k]; } return true; };
    const root = lake.cells.find((m) => !inLake.has(parent[m]) && clean(m)) ?? lake.cells[0], q = [root];
    lake.spillCell = parent[root];
    flowTo[root] = lake.spillCell; const seenL = new Set([root]);
    for (let k = 0; k < q.length; k++) for (const nb of cells[q[k]].edgeNeighbors) if (inLake.has(nb) && !seenL.has(nb)) { seenL.add(nb); flowTo[nb] = q[k]; q.push(nb); }
  }
  const follow = (start) => {
    let id = start, steps = 0;
    while (id >= 0 && !sea(id) && lakeOf[id] < 0 && steps++ < n) {
      if (world.river[id] && flowTo[id] >= 0) return;                 // joined a flowing river
      if (!world.river[id]) { world.river[id] = 1; extended++; }
      flowTo[id] = parent[id];
      id = parent[id];
    }
  };
  for (const lake of W.lakes) { const s = lake.spillCell; if (s >= 0 && lakeOf[s] < 0) { spills++; follow(s); } }
  for (let id = 0; id < n; id++) if (world.river[id] && flowTo[id] < 0 && lakeOf[id] < 0) {
    const c = cells[id];
    const into = c.edgeNeighbors.find((nb) => nb >= 0 && lakeOf[nb] >= 0);
    if (into !== undefined) { flowTo[id] = into; continue; }
    follow(id);
  }
  // verify: every river chain ends in the sea (lakes pass through their PF tree)
  let toSea = 0, broken = 0;
  for (let id = 0; id < n; id++) {
    if (!world.river[id]) continue;
    let k = id, steps = 0;
    while (k >= 0 && !sea(k) && steps++ < n) k = flowTo[k] >= 0 ? flowTo[k] : parent[k] === -1 ? -1 : -2;
    if (k === -2 || steps >= n) broken++; else toSea++;
  }
  const mouths = [];
  for (let id = 0; id < n; id++) if ((world.river[id] || lakeOf[id] >= 0) && sea(flowTo[id])) mouths.push(id);
  world.touch();
  world.riverFlow = { flowTo, paths: world.riverFlow?.paths ?? [], mouths, lakes: W.lakes.length, version: world.version };
  return { submerged, extended, spills, riverCells: world.river.reduce((a, b) => a + b, 0), toSea, broken, lakes: W.lakes.length };
}

/** Bowl-shaped holes in high plateaus (r55 demo of the joint lake/hole rebuild): pure rock columns within
 * `radius` of a plateau cell ≥ minLevel, at least `margin` cells from the coast, are lowered by `depth`
 * (centre) / depth-1 (ring). A water-mode fill turns each hole into a lake that spills into a river. */
export function digBasins(world, { seed = 1, count = 1, radius = 1.9, depth = 2, minLevel = 4 } = {}) {
  const cells = world.cells, rng = makeRng(seed), out = [];
  const pure = (c) => world.solid[c.id] === world.rock[c.id] && world.top(c) === world.ground(c);
  const interior = cells.filter((c) => world.ground(c) >= minLevel && pure(c) && !world.river[c.id] &&
    c.edgeNeighbors.every((id) => id >= 0 && world.ground(cells[id]) >= world.ground(c) && cells[id].edgeNeighbors.every((j) => j >= 0 && world.ground(cells[j]) >= minLevel - 1)));
  for (let k = 0; k < count && interior.length; k++) {
    const ctr = interior[(rng() * interior.length) | 0];
    if (out.some((b) => Math.hypot(b.cx - ctr.cx, b.cz - ctr.cz) < radius * 3)) continue;
    const touched = [], inside = cells.filter((c) => Math.hypot(c.cx - ctr.cx, c.cz - ctr.cz) <= radius && pure(c) && !world.river[c.id]);
    // flat floor `depth` below the lowest ground inside, one-level ring above it: a single bowl, one lake
    const floor = Math.max(1, Math.min(...inside.map((c) => world.ground(c))) - depth);
    for (const c of inside) {
      const d = Math.hypot(c.cx - ctr.cx, c.cz - ctr.cz), g = world.ground(c), to = d < radius * 0.55 ? floor : Math.min(g, floor + 1);
      if (to < g) { world.fill(c, to, { rock: true }); touched.push(c.id); }
    }
    out.push({ cell: ctr.id, cx: ctr.cx, cz: ctr.cz, cells: touched });
  }
  return out;
}
