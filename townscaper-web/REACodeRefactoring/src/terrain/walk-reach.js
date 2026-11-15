/**
 * walk-reach.js — 「图上连通」≠「人能走到」：可走连通分量 + 沿路线补台阶（917405214638006273，第 50 轮迁自 REACode src/walkreach.js）
 *
 * README 原文：「A somewhat major breakthrough in my procedural generation: a heuristic for deliberately generating navigable levels」
 * REACode 版本在自建的 52×40 方格高度场上量了三件事：① 忽略高度的 BFS 最短路（图连通）；② 「单步落差 ≤ 可跨高度」重算真正可达分量；
 * ③ 沿路线每遇一条崖边在低侧补一级台阶，重跑 ②。结论：图连通 24/24，但能一脚走完 0/24；补台阶后 24/24，全岛可达 38% → 95%。
 * 这里换到共享 World（真实生成地形、任意多边形网格）：
 *   · 可走 = 露天地表（top 上方是空的，top ≥ 1）；单步可跨 = 相邻两格高差 ≤ maxStep 层（REA 导航的台阶规则是 1 层）；
 *   · 修补 = 沿忽略高度的 BFS 路线，遇到高差 > maxStep 的边，把低侧那格加高一层（岩石体素，和地形同一种），直到这一步可跨；
 *     加高可能让低侧格和它别的邻居落差变大，所以每补一格都重新检查路线（最多 maxRaise 次）。
 * 只改 World 的体素，不碰网格：重建网格 / 导航由调用方按 world.version 自行刷新。
 */
const standable = (world, c) => { const t = world.top(c); return t >= 1 && !world.isSolid(c, t + 1); };

/** 可走连通分量（单步高差 ≤ maxStep）。返回 { comp: Int32Array（-1 = 不可站）, count }。 */
export function walkComponents(world, { maxStep = 1 } = {}) {
  const cells = world.cells, comp = new Int32Array(cells.length).fill(-1); let count = 0;
  for (const s of cells) {
    if (comp[s.id] >= 0 || !standable(world, s)) continue;
    const q = [s]; comp[s.id] = count;
    while (q.length) { const c = q.pop(), t = world.top(c); for (const nid of c.edgeNeighbors) { if (nid < 0 || comp[nid] >= 0) continue; const o = cells[nid]; if (!standable(world, o) || Math.abs(world.top(o) - t) > maxStep) continue; comp[nid] = count; q.push(o); } }
    count++;
  }
  return { comp, count };
}

/** 忽略高度、只走陆地的 BFS 最短路（格序列）；到不了返回 null。 */
export function landRoute(world, from, to) {
  const cells = world.cells, prev = new Int32Array(cells.length).fill(-2); prev[from.id] = -1; const q = [from];
  for (let h = 0; h < q.length; h++) { const c = q[h]; if (c === to) break; for (const nid of c.edgeNeighbors) { if (nid < 0 || prev[nid] !== -2 || !standable(world, cells[nid])) continue; prev[nid] = c.id; q.push(cells[nid]); } }
  if (prev[to.id] === -2) return null;
  const out = []; for (let id = to.id; id >= 0; id = prev[id]) out.push(cells[id]); return out.reverse();
}

/** 路线上的「崖边」（高差 > maxStep 的相邻两步）。 */
export function cliffCrossings(world, route, { maxStep = 1 } = {}) {
  const out = []; for (let i = 1; i < route.length; i++) { const d = world.top(route[i]) - world.top(route[i - 1]); if (Math.abs(d) > maxStep) out.push({ i, a: route[i - 1], b: route[i], drop: Math.abs(d) }); } return out;
}

/**
 * 修补：沿 from→to 的忽略高度路线，把每条崖边的低侧格逐层加高，直到整条路线单步可跨。
 * 返回 { ok, raised: [{cell, from, to}], before, after }，before/after = { reachable（from、to 同一可走分量）, crossings, share（全岛可站格里与 from 同分量的比例） }。
 */
export function repairReach(world, from, to, { maxStep = 1, maxRaise = 400 } = {}) {
  const snap = () => { const route = landRoute(world, from, to), { comp } = walkComponents(world, { maxStep }); let land = 0, same = 0; for (const c of world.cells) if (standable(world, c)) { land++; if (comp[c.id] === comp[from.id]) same++; } return { reachable: comp[from.id] >= 0 && comp[from.id] === comp[to.id], crossings: route ? cliffCrossings(world, route, { maxStep }).length : null, share: land ? same / land : 0, routeLen: route?.length ?? null }; };
  const before = snap(), raised = [];
  for (let guard = 0; guard < maxRaise; guard++) {
    const route = landRoute(world, from, to); if (!route) return { ok: false, reason: 'no land route', raised, before, after: snap() };
    const cr = cliffCrossings(world, route, { maxStep }); if (!cr.length) break;
    const { a, b } = cr[0], low = world.top(a) < world.top(b) ? a : b, high = low === a ? b : a;
    // 两种补法挑「新增断边更少」的：低侧加高一层（台阶），或高侧削低一层（REA island.js 的削台）；平局取加高。
    const broken = (c, t) => c.edgeNeighbors.reduce((n, nid) => { if (nid < 0) return n; const o = world.cells[nid]; return n + (standable(world, o) && Math.abs(world.top(o) - t) > maxStep ? 1 : 0); }, 0);
    const tl = world.top(low), th = world.top(high);
    const touched = (c, dir) => raised.some((x) => x.cell === c.id && (dir > 0 ? x.carve : !x.carve));   // 不来回改同一格（防振荡）
    const raiseCost = broken(low, tl + 1) - broken(low, tl), carveCost = th > 1 && world.isRock(high, th) && !touched(high, -1) ? broken(high, th - 1) - broken(high, th) : Infinity;
    if (carveCost < raiseCost) { world.setSolid(high, th, false); raised.push({ cell: high.id, from: th, to: th - 1, carve: true }); }
    else { world.fill(low, tl + 1, { rock: true }); raised.push({ cell: low.id, from: tl, to: tl + 1 }); }
  }
  world.touch?.();
  const after = snap();
  return { ok: after.reachable, raised, before, after };
}
