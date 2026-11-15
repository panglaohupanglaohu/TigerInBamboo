/**
 * island-quality-c09.js — 第 56 批 C09-C · 1669315384619540487「The generator consistently spits out pretty cool islands now」。
 *
 * 片子（649 帧）：一个接一个新岛——空海面 → 一圈海岸轮廓线 → 黑色剪影 → 成品岛，然后转台展示。
 * 每个岛都有：一整块主岛（外加零星小礁）、多级台地、高耸石柱、拱洞 / 洞穴、缓坡与竖崖并存、湖 / 河。
 * 「consistently」是这条片子的要点：不是挑出一个好种子，而是**每个种子**都过得去。
 *
 * 这里把「过得去」写成可量的体检（只读 World，不改任何东西）：
 *   landFrac   陆地格占比；mainFrac 最大连通陆块占陆地比（连边、top>0）；islets 其余小块数
 *   levels     出现过的顶层种类数；maxLevel；stacks 石柱数（高 ≥3 层、四周邻居都低 ≥2 层的格）
 *   caves      洞穴 / 拱下空腔格数（某层是岩、下一层空）；lakes / riverCells
 *   cliffEdges / stepEdges   落差 ≥2 / =1 的共享边（竖崖与缓坡台阶并存）
 * islandVerdict 给出各条是否达标与总评 cool；阈值见 ISLAND_RULES（依据片子 + 实测分布定，写死在这里便于复核）。
 */
export const ISLAND_RULES = Object.freeze({ landFrac: [0.18, 0.8], mainFrac: 0.85, levels: 4, maxLevel: 5, cliffEdges: 20, stepEdges: 20, features: 1 });

export function islandReport(world) {
  const cells = world.cells, n = cells.length, land = new Uint8Array(n);
  let landCount = 0, maxLevel = 0, caves = 0, stacks = 0, cliffEdges = 0, stepEdges = 0, riverCells = 0;
  const levelSet = new Set();
  for (const c of cells) {
    const t = world.top(c); if (t <= 0) continue;
    land[c.id] = 1; landCount++; maxLevel = Math.max(maxLevel, t); levelSet.add(world.ground(c) || t);
    if (world.river?.[c.id]) riverCells++;
    for (let lv = 2; lv <= t; lv++) if (world.isRock(c, lv) && !world.isSolid(c, lv - 1)) { caves++; break; }
    const g = world.ground(c);
    if (g >= 3) { let ok = true; for (let i = 0; i < c.n; i++) { const o = world.neighbor(c, i); if (o && world.top(o) > g - 2) { ok = false; break; } } if (ok) stacks++; }
    for (let i = 0; i < c.n; i++) {
      const o = world.neighbor(c, i); if (!o || o.id < c.id) continue;
      const d = Math.abs(world.ground(o) - g); if (!world.top(o)) continue;
      if (d >= 2) cliffEdges++; else if (d === 1) stepEdges++;
    }
  }
  // 连通陆块（BFS）
  const comp = new Int32Array(n).fill(-1), sizes = [];
  for (const c of cells) {
    if (!land[c.id] || comp[c.id] >= 0) continue;
    const id = sizes.length, q = [c.id]; comp[c.id] = id; let s = 0;
    while (q.length) { const k = q.pop(); s++; const cc = cells[k]; for (const nid of cc.edgeNeighbors) if (nid >= 0 && land[nid] && comp[nid] < 0) { comp[nid] = id; q.push(nid); } }
    sizes.push(s);
  }
  sizes.sort((a, b) => b - a);
  return {
    cells: n, land: landCount, landFrac: landCount / n, mainFrac: landCount ? sizes[0] / landCount : 0, islets: Math.max(0, sizes.length - 1),
    levels: levelSet.size, maxLevel, stacks, caves, cliffEdges, stepEdges, riverCells, lakes: world.lakes?.lakes?.length ?? 0,
  };
}

/** 连通陆块列表（大到小），每块是格 id 数组。 */
export function landComponents(world) {
  const cells = world.cells, seen = new Uint8Array(cells.length), out = [];
  for (const c of cells) {
    if (seen[c.id] || world.top(c) <= 0) continue;
    const q = [c.id], comp = []; seen[c.id] = 1;
    while (q.length) { const k = q.pop(); comp.push(k); for (const nid of cells[k].edgeNeighbors) if (nid >= 0 && !seen[nid] && world.top(cells[nid]) > 0) { seen[nid] = 1; q.push(nid); } }
    out.push(comp);
  }
  return out.sort((a, b) => b.length - a.length);
}

/**
 * 清掉离主岛的碎块：保留最大陆块；其余块若 ≤ keepMax 格（片子里主岛旁的小礁）或含湖 / 河格就留，否则抹平成海。
 * 返回被抹掉的格数。只在 consistentIsland 里调用；generateTerrain 默认行为不变。
 */
export function pruneIslets(world, { keepMax = 4 } = {}) {
  const comps = landComponents(world); let removed = 0;
  const lakeCells = new Set(); for (const l of world.lakes?.lakes ?? []) for (const id of l.cells ?? []) lakeCells.add(id);
  for (const comp of comps.slice(1)) {
    if (comp.length <= keepMax || comp.some((id) => world.river?.[id] || lakeCells.has(id))) continue;
    for (const id of comp) { const c = world.cells[id]; world.fill(c, 0); if (world.river) world.river[id] = 0; if (world.color) world.color[id] = -1; removed++; }
  }
  return removed;
}

export const deriveSeed = (seed, k) => k === 0 ? seed : ((seed * 7919 + k * 104729) % 99991) + 1;

/**
 * 「每个种子都出好岛」：generate(world, opts) 生成 → 清碎块 → 体检；不达标就用派生种子重来（确定性，最多 tries 次），
 * 全不达标时留体检分最高的那次。返回 { seed, tries, report, verdict, attempts }。
 */
export function consistentIsland(world, generate, opts = {}, { tries = 8, keepMax = 4, rules = ISLAND_RULES } = {}) {
  if (typeof generate !== 'function' || !Number.isInteger(tries) || tries < 1) throw new RangeError('consistentIsland(world, generate, opts, {tries})');
  const base = opts.seed ?? 7, attempts = []; let best = null;
  for (let k = 0; k < tries; k++) {
    const seed = deriveSeed(base, k);
    world.reset?.(); generate(world, { ...opts, seed });
    const pruned = pruneIslets(world, { keepMax }), report = islandReport(world), verdict = islandVerdict(report, rules);
    const score = Object.values(verdict.checks).filter(Boolean).length + Math.min(report.landFrac, .4);
    attempts.push({ seed, pruned, cool: verdict.cool, failed: verdict.failed });
    if (!best || score > best.score) best = { seed, score };
    if (verdict.cool) return { seed, tries: k + 1, report, verdict, attempts, pruned };
  }
  world.reset?.(); generate(world, { ...opts, seed: best.seed }); const pruned = pruneIslets(world, { keepMax });
  const report = islandReport(world);
  return { seed: best.seed, tries, report, verdict: islandVerdict(report, rules), attempts, pruned };
}

export function islandVerdict(r, rules = ISLAND_RULES) {
  const checks = {
    landFrac: r.landFrac >= rules.landFrac[0] && r.landFrac <= rules.landFrac[1],
    mainFrac: r.mainFrac >= rules.mainFrac,
    levels: r.levels >= rules.levels,
    maxLevel: r.maxLevel >= rules.maxLevel,
    cliffs: r.cliffEdges >= rules.cliffEdges,
    steps: r.stepEdges >= rules.stepEdges,
    features: (r.stacks > 0) + (r.caves > 0) + (r.lakes > 0 || r.riverCells > 0) >= rules.features,
  };
  return { checks, cool: Object.values(checks).every(Boolean), failed: Object.keys(checks).filter((k) => !checks[k]) };
}
