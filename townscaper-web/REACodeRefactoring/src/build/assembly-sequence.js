/** 787319655648100352「More procedural tile placement. Now in 3D」残差（二）：
 * 底板上的分步拼装序列 + 空中待置零件的落下轨迹数据。
 *
 * 原片事实（REACode/src/tileplace.js 头注，67 帧全核 + 797844857821732864 幽灵网格）：
 *  · 块一次一个蹦出来 —— 形状/朝向事先由约束定好，动画只是把定形顺序放慢演出来；
 *  · 已钉死的块不悬空（标签匹配天然排除悬空），悬空的那块是「还没被钉死的候选」，落位才变实。
 * 残差判定：库里已有 layeredLattice + solveWFC/solveAssembly（tile-assembly.js，r55），
 *  但缺「保证每步落地的支撑顺序 + 逐步事务/撤销 + 空中零件轨迹数据 + 桥廊/围合楼体模块集」。
 *  本文件补前三件；模块集在 assembly-modules.js。
 *
 * 与 build/tile-assembly.js 的分工：那边按「求解器钉死顺序」回放（块可以比自己的支撑先出现，
 *  忠实于求解轨迹）；这边按「结构支撑就绪顺序」提交（每步后 World 都合法，可逐块撤销）。
 *  渲染/补间由消费者做：本文件只产关键帧参数（起点在空中、终点在落位、悬停相位）。
 * 纯函数、确定性（同输入同种子同输出），Node / 浏览器 / Worker 通用。
 */
import { findWFCConflicts } from '../core/wfc.js';

const hash01 = (seed, id) => { let h = Math.imul((seed | 0) ^ Math.imul(id + 1, 2654435761), 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const isVoid = (t) => t.void === true || t.solid === false;
const supportOf = (t) => t.support ?? 'below';

/** 空中落下轨迹的关键帧参数（原片：候选件在空中缓慢漂移，钉死后下落变实）。 */
export function dropTrajectory({ x, y, z }, { seed = 1, piece = 0, n = 0, dropHeight = 4, drift = 1.2, slot = 0.55, levelHeight = 1 } = {}) {
  const a = hash01(seed ^ 0x51ab, piece) * Math.PI * 2, d = drift * (0.55 + 0.45 * hash01(seed ^ 0x9e37, piece));
  const p0 = [+(x + Math.cos(a) * d).toFixed(4), +(y + dropHeight).toFixed(4), +(z + Math.sin(a) * d).toFixed(4)];
  const bow = drift * 0.25 * (hash01(seed ^ 0x77, piece) - 0.5);
  const p1 = [+((p0[0] + x) / 2 - Math.sin(a) * bow).toFixed(4), +(y + dropHeight * 0.62).toFixed(4), +((p0[2] + z) / 2 + Math.cos(a) * bow).toFixed(4)];
  return {
    kind: 'quadratic', ease: 'out',
    p0, p1, p2: [+x.toFixed(4), +y.toFixed(4), +z.toFixed(4)],
    hover: { amp: +(0.12 * levelHeight).toFixed(4), period: +(1.4 + 0.5 * hash01(seed ^ 0x31, piece)).toFixed(4), phase: +(hash01(seed ^ 0x7f, piece) * Math.PI * 2).toFixed(4) },
    dur: +(0.45 + 0.15 * Math.sqrt(Math.max(1, dropHeight / levelHeight))).toFixed(4),
    start: +(n * slot).toFixed(4),
  };
}

/**
 * 生成有序拼装步骤。输入：
 *   world        共享体素 World（取基格几何 cx/cz；不改写）
 *   lattice      layeredLattice(world, cellIds, H)：cells 带 {cell 基格 id, level 1..H}
 *   assignment   {lattice 格 id: tile id}——必须覆盖全部 lattice 格（空气用 void tile 填）
 *   tiles        tile 目录（assembly-modules.js moduleTiles / tile-assembly.js expandTiles 皆可）
 *   compatible   (edgeA, edgeB)=>bool——用 tile-assembly.js labelCompatible(joins,{gravity})
 *   ground       底板顶的世界层：lattice 层 k 提交到世界层 ground+k（同 commitAssembly 约定）
 *   order        'support'（默认：支撑就绪序，种子决胜）| 'solve'（尽量按 solveOrder，
 *                支撑没到位的块顺延——钉死顺序与支撑合法两不占便宜时先保合法）
 *   solveOrder   [lattice 格 id] 求解器钉死序（如 solveAssembly 的 pieces），order:'solve' 用
 *   allowFloating  缺支撑的块照常排入并标 floating:true；默认 false——排不下去如实报 unsupported
 *   levelHeight / drop  轨迹参数（{height,drift,slot}）
 * 返回 {ok:true, steps, count, floating, lattice, tileById, compatible, ground} |
 *     {ok:false, reason, stuck?, conflicts?}。
 * step = {n, instance, lattice, cell, level, commit:{cell,level}, tile, name, support, deps, floating, trajectory}
 */
export function planAssembly(world, lattice, assignment, tiles, {
  compatible, ground = 0, seed = 1, order = 'support', solveOrder = null,
  allowFloating = false, levelHeight = 1, drop = {},
} = {}) {
  if (typeof compatible !== 'function') throw new TypeError('compatible required');
  const byId = new Map(tiles.map((t) => [String(t.id), t])), byLc = new Map(lattice.cells.map((c) => [c.id, c]));
  for (const lc of lattice.cells) {
    if (assignment[lc.id] === undefined) return { ok: false, reason: 'assignment', detail: `lattice 格 ${lc.id} 未指派` };
    if (!byId.get(String(assignment[lc.id]))) return { ok: false, reason: 'tile', detail: `格 ${lc.id} 的 tile ${assignment[lc.id]} 不在目录` };
  }
  const conflicts = findWFCConflicts(lattice, assignment, tiles, { compatible });
  if (conflicts.length) return { ok: false, reason: 'conflicts', conflicts };

  const pieces = lattice.cells.filter((lc) => !isVoid(byId.get(String(assignment[lc.id]))));
  const posOf = (id) => { const c = world.cells[id]; return c.cx !== undefined ? [c.cx, c.cz] : [c.pts.reduce((s, p) => s + p.x, 0) / c.n, c.pts.reduce((s, p) => s + p.z, 0) / c.n]; };

  // 硬前置：'below' 支撑且脚下是同基格下一层的非空模块。脚下是空模块 → 永远缺支撑。
  const hardPre = new Map(), stuck = [];
  for (const lc of pieces) {
    const sup = supportOf(byId.get(String(assignment[lc.id]))), pre = [];
    if ((sup === 'below' || sup === 'plate') && lc.level > 1) {
      const b = byLc.get(lc.id - 1);   // layeredLattice：同基格下一层 id 恰好减 1
      if (!b) return { ok: false, reason: 'assignment', detail: `格 ${lc.id} 的下一层不在 lattice` };
      if (isVoid(byId.get(String(assignment[b.id])))) stuck.push(lc.id); else pre.push(b.id);
    }
    hardPre.set(lc.id, pre);
  }
  if (stuck.length && !allowFloating) return { ok: false, reason: 'unsupported', stuck: stuck.slice() };

  const prio = new Map(pieces.map((lc) => [lc.id, solveOrder ? (solveOrder.indexOf(lc.id) + 1 || Infinity) : 0]));
  const key = (lc) => { const k = prio.get(lc.id) ?? Infinity; return [k, hash01(seed, lc.id)]; };
  const lt = (a, b) => a[0] - b[0] || a[1] - b[1];
  const sideReady = (lc, t, placed) => {
    const sup = supportOf(t);
    if (typeof sup !== 'object' || sup.type !== 'sides') return true;
    let got = 0;
    for (let e = 0; e < lc.edgeNeighbors.length; e++) {
      const nb = lc.edgeNeighbors[e];
      if (nb < 0 || !placed.has(nb)) continue;
      const mine = t.edges[e];
      if (mine?.v === 0 && sup.sockets.includes(mine.label)) got++;
    }
    return got >= (sup.min ?? 1);
  };

  const placed = new Set(), remaining = new Set(pieces.map((c) => c.id)), steps = [], deferred = new Set(stuck);
  while (remaining.size) {
    let best = null, bk = null;
    for (const id of remaining) {
      if (deferred.has(id)) continue;
      const lc = byLc.get(id), t = byId.get(String(assignment[id]));
      if (!hardPre.get(id).every((p) => placed.has(p))) continue;
      if (!sideReady(lc, t, placed)) continue;
      const k = key(lc);
      if (!bk || lt(k, bk) < 0) { best = lc; bk = k; }
    }
    let floating = false;
    if (!best) {
      if (!allowFloating) return { ok: false, reason: 'unsupported', stuck: [...remaining], placed: steps.map((s) => s.lattice) };
      best = [...remaining].map((id) => byLc.get(id)).sort((a, b) => lt(key(a), key(b)))[0];
      floating = true; deferred.add(best.id);
    }
    remaining.delete(best.id); placed.add(best.id);
    const t = byId.get(String(assignment[best.id])), lv = ground + best.level, [x, z] = posOf(best.cell);
    const sup = supportOf(t);
    steps.push({
      n: steps.length, instance: `asm:${best.cell}:${best.level}`, lattice: best.id, cell: best.cell, level: best.level,
      commit: { cell: best.cell, level: lv }, tile: String(t.id), name: t.name ?? String(t.id),
      support: (sup === 'below' || sup === 'plate') && best.level === 1 ? 'plate' : typeof sup === 'object' ? 'sides' : sup,
      sideSockets: typeof sup === 'object' ? sup.sockets : null,
      deps: hardPre.get(best.id), floating,
      trajectory: dropTrajectory({ x, y: (lv - 0.5) * levelHeight, z },
        { seed, piece: best.id, n: steps.length, dropHeight: drop.height ?? 4, drift: drop.drift ?? 1.2, slot: drop.slot ?? 0.55, levelHeight }),
    });
  }
  return { ok: true, steps, count: steps.length, floating: steps.filter((s) => s.floating).length, lattice, tileById: byId, compatible, ground };
}

/** 拼装会话：逐块提交到 World，journal 支持逐块撤销。 */
export function createAssembly(world, plan, { color = 0 } = {}) {
  if (!plan?.ok) throw new TypeError('需要 planAssembly 的成功结果');
  return { world, plan, color, next: 0, placed: new Map(), journal: [], stepsByLc: new Map(plan.steps.map((s) => [s.lattice, s])), lcById: new Map(plan.lattice.cells.map((c) => [c.id, c])) };
}

/** 提交下一块。失败（目标体素已被占）原样返回，不写任何体素。 */
export function applyStep(session, { color } = {}) {
  const { world, plan } = session;
  if (session.next >= plan.steps.length) return { ok: false, reason: 'done' };
  const step = plan.steps[session.next], cell = world.cells[step.commit.cell], lv = step.commit.level;
  if (world.isSolid(cell, lv)) return { ok: false, reason: 'occupied', step };
  session.journal.push({ lattice: step.lattice, cell: cell.id, solid: world.solid[cell.id], rock: world.rock[cell.id], color: world.color[cell.id], river: world.river[cell.id] });
  world.setSolid(cell, lv, true);
  world.color[cell.id] = color ?? session.color;
  world.touch();
  session.placed.set(step.lattice, lv);
  session.next++;
  return { ok: true, step, index: session.next - 1 };
}

/** 撤销上一块（LIFO）。空栈如实返回 'empty'。 */
export function undoStep(session) {
  const { world } = session, j = session.journal.pop();
  if (!j) return { ok: false, reason: 'empty' };
  world.solid[j.cell] = j.solid; world.rock[j.cell] = j.rock; world.color[j.cell] = j.color; world.river[j.cell] = j.river;
  world.touch();
  session.placed.delete(j.lattice);
  session.next--;
  return { ok: true, undone: j.lattice, next: session.next };
}

/** 还在空中的待置零件（原片那块悬空漂移的候选）：尚未提交的步 + 各自轨迹参数。 */
export function assemblyGhosts(session) {
  return session.plan.steps.slice(session.next).map((s) => ({ lattice: s.lattice, cell: s.cell, level: s.level, name: s.name, trajectory: s.trajectory }));
}

/**
 * 逐步合法性校验（每步后都应成立）：
 *  · 每块已落体素是实心的；
 *  · 支撑策略满足——'below'/'plate' 脚下一层实心；'sides' 有 ≥min 个已放邻居共享所列接口；
 *  · 已放子集的每条共享半边接口闭合（compatible 成立），未放邻居不算开口。
 * 返回 {ok, unsupported, conflicts, placed, pending}——不静默，全部列清。
 */
export function verifyAssembly(session) {
  const { world, plan } = session, comp = plan.compatible, placed = session.placed;
  const unsupported = [], conflicts = [];
  for (const [id, lv] of placed) {
    const step = session.stepsByLc.get(id), cell = world.cells[step.cell];
    if (!world.isSolid(cell, lv)) { unsupported.push({ lattice: id, cell: step.cell, level: lv, reason: 'voxel-missing' }); continue; }
    if (step.support === 'below' || step.support === 'plate') {
      if (!world.isSolid(cell, lv - 1)) unsupported.push({ lattice: id, cell: step.cell, level: lv, reason: 'below' });
    } else if (step.support === 'sides') {
      const lc = session.lcById.get(id), t = plan.tileById.get(step.tile), min = t.support?.min ?? 1;
      let got = 0;
      for (let e = 0; e < lc.edgeNeighbors.length; e++) {
        const nb = lc.edgeNeighbors[e];
        if (nb >= 0 && placed.has(nb) && t.edges[e]?.v === 0 && (step.sideSockets ?? []).includes(t.edges[e].label)) got++;
      }
      if (got < min) unsupported.push({ lattice: id, cell: step.cell, level: lv, reason: 'sides', got });
    }
  }
  for (const id of placed.keys()) {
    const lc = session.lcById.get(id), t = plan.tileById.get(session.stepsByLc.get(id).tile);
    for (let e = 0; e < lc.edgeNeighbors.length; e++) {
      const nb = lc.edgeNeighbors[e];
      if (nb < 0 || !placed.has(nb) || nb < id) continue;
      const nlc = session.lcById.get(nb), twin = lc.edgeTwins?.[e] ?? nlc.edgeNeighbors.indexOf(id);
      const bt = plan.tileById.get(session.stepsByLc.get(nb).tile);
      if (twin < 0 || !comp(t.edges[e], bt.edges[twin])) conflicts.push({ a: id, b: nb, edge: e, mine: t.edges[e].label, theirs: twin >= 0 ? bt.edges[twin].label : null });
    }
  }
  return { ok: !unsupported.length && !conflicts.length, unsupported, conflicts, placed: placed.size, pending: plan.steps.length - session.next };
}
