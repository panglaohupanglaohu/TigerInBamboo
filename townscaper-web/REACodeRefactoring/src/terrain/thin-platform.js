/**
 * thin-platform.js — 薄平台：沿墙/柱可站的窄檐、单层悬空突出层（781957658597269506，2016-09-30，109 帧）。
 *
 * 片子：黄色薄平台错层叠在中心柱上、木梯跨空隙上下 —— 几何机制 = 「只写一层体素、底下留空」的站立面。
 * C04 的 mushroom-c04.js 已在共享 World 里造出这种层叠薄台；这里补上通用的一层：
 *   · thinTops / thinLedges  标记：哪些站立面是「薄」的（顶面实心、正下一层是空的），连片成檐；
 *   · ledgeSites             生成候选：高壁（比本格顶高 ≥3 层）腰上、比本格顶高 ≥2 层的位置能贴一片窄檐
 *                            —— 檐底与本格顶之间至少隔一层空气，所以放下去就是真薄台不是加高柱子；
 *   · placeThinLedge         写入：在指定层放单层体素，只落在「该层空、下一层也空」的格上；
 *   · placeLedges            批量：按种子从候选位挑几片放下（generate.js 的 ledges 选项走这里）。
 *
 * 体素读写只用 solid/rock 位掩码（capabilities/ops.js 同口径），库 World 与 vendor 旧副本通用。
 * 薄台格 top == ground → buildNav 本来就算可走；上下落差 ≤2 的邻边 buildNav 会放楼梯，
 * ladderContact 用 supportDepth < rise 判得出「这把梯子搭在薄台上」（thinPlatform）。
 */

const bit = (lv) => 1 << (lv - 1);
const solid = (w, id, lv) => lv >= 1 && ((w.solid[id] >> (lv - 1)) & 1) === 1;
const top = (w, id) => { const m = w.solid[id]; return m === 0 ? 0 : 32 - Math.clz32(m); };
const MAX_LEVEL = 12;

/** 这层是不是「可站的薄面」：≥2 层、本层实心可踩、上一层空（能站）、下一层空（悬空 = 薄）。
 *  第 1 层不算——它是地形地板不是挑出的檐（柱脚到底没有"悬空"可言）。 */
export const thinAt = (w, id, lv) => lv >= 2 && solid(w, id, lv) && !solid(w, id, lv + 1) && !solid(w, id, lv - 1);

/** 每个格子的薄站立面：{ cell, level, gap }（gap = 檐底到下一层实心的空层数）。 */
export function thinTops(world) {
  const out = [];
  for (const c of world.cells) {
    const t = top(world, c.id);
    if (!t || !thinAt(world, c.id, t)) continue;
    let gap = 0; for (let lv = t - 1; lv >= 1 && !solid(world, c.id, lv); lv--) gap++;
    out.push({ cell: c, level: t, gap });
  }
  return out;
}

/** 薄面格按（同层 + 边邻接）连成檐片：{ level, cells, gap, walls }。walls = 片外贴着、该层或更高处实心的邻格。 */
export function thinLedges(world) {
  const cells = world.cells, thin = new Map(thinTops(world).map((t) => [t.cell.id, t]));
  const seen = new Set(), out = [];
  for (const [id] of thin) {
    if (seen.has(id)) continue;
    const level = thin.get(id).level, q = [id], members = [], walls = new Set();
    seen.add(id);
    while (q.length) {
      const cur = q.pop(); members.push(cur);
      for (const nid of cells[cur].edgeNeighbors) {
        if (nid < 0) continue;
        const t = thin.get(nid);
        if (t && t.level === level && !seen.has(nid)) { seen.add(nid); q.push(nid); }
        else if (!t && solid(world, nid, level)) walls.add(nid);   // 邻格在这层有体 = 檐挂着的壁/柱
      }
    }
    out.push({ level, cells: members, gap: Math.min(...members.map((m) => thin.get(m).gap)), walls: [...walls] });
  }
  return out;
}

/**
 * 窄檐候选位：本格顶 t 与邻格顶 wt 满足 wt ≥ t + 3 时，在 level = min(wt - 1, t + 2) 放一片单层檐 —
 * 檐底（level-1）到本格顶之间至少一层空气；从本格爬上檐的落差 rise = level - t ≤ 2（梯子量程），
 * 檐到壁顶还差 drop = wt - level ≥ 1（檐挂在壁腰，不是贴着壁顶）。同一对（格,壁）只报一次。
 */
export function ledgeSites(world, { editable = () => true } = {}) {
  const cells = world.cells, out = [];
  for (const c of cells) {
    const t = top(world, c.id);
    if (!t || !editable(c.id)) continue;
    for (let e = 0; e < c.n; e++) {
      const wid = c.edgeNeighbors[e];
      if (wid < 0) continue;
      const wt = top(world, wid);
      if (wt < t + 3) continue;
      const level = Math.min(wt - 1, t + 2);
      if (level - t < 2 || solid(world, c.id, level) || solid(world, c.id, level - 1)) continue;
      out.push({ id: `ledge:${c.id}>${wid}@${level}`, cells: [c.id], wall: wid, edge: e, level, rise: level - t, drop: wt - level, focus: c.id,
        score: (wt - t) + (level === wt - 1 ? .5 : 0), reason: `格 ${c.id}（顶 ${t} 层）挨着 ${wt} 层岩壁 ${wid}，可在第 ${level} 层贴一层悬空窄檐（落差 ${level - t}）` });
    }
  }
  return out;
}

/**
 * 写檐：在 level 层给每格放单层体素（默认岩石）。只落在「该层空、下一层也空」的格上 —
 * 下一层有体就直接坐上去成柱子了（not-thin），该层有体跳过（occupied）。返回逐格处置结果。
 */
export function placeThinLedge(world, cellIds, level, { rock = true } = {}) {
  if (!Number.isInteger(level) || level < 2 || level > MAX_LEVEL) throw new RangeError('ledge level must be 2..' + MAX_LEVEL + '（第 1 层放不出悬空檐）');
  const placed = [], skipped = [];
  for (const id of cellIds) {
    const c = world.cells[id];
    if (!c) { skipped.push({ id, reason: 'no-cell' }); continue; }
    if (solid(world, id, level)) { skipped.push({ id, reason: 'occupied' }); continue; }
    if (solid(world, id, level - 1)) { skipped.push({ id, reason: 'not-thin' }); continue; }
    world.solid[id] |= bit(level);
    if (rock) world.rock[id] |= bit(level); else world.rock[id] &= ~bit(level);
    placed.push(id);
  }
  if (placed.length) world.touch?.();
  return { level, placed, skipped };
}

/** 批量：从 ledgeSites 挑 count 片（种子随机 + 彼此隔开），逐片 placeThinLedge。 */
export function placeLedges(world, { seed = 1, count = 2, minGap = 2.5 } = {}) {
  let a = seed >>> 0;
  const rng = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const sites = ledgeSites(world).sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
  for (let i = sites.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0;[sites[i], sites[j]] = [sites[j], sites[i]]; }
  const picked = [];
  for (const s of sites) {
    const c = world.cells[s.focus];
    if (picked.some((p) => Math.hypot(world.cells[p.focus].cx - c.cx, world.cells[p.focus].cz - c.cz) < minGap)) continue;
    const r = placeThinLedge(world, s.cells, s.level);
    if (r.placed.length) picked.push({ ...s, placed: r.placed });
    if (picked.length >= count) break;
  }
  return { candidates: sites.length, ledges: picked };
}
