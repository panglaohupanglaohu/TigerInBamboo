/**
 * steel-r56.js — 第 56 批 C05-D：悬空体块的钢架（落点搜索 / 曲柄内倾腿 / 高腿分段系杆 + 节点 + Y 形斜撑）。
 *
 * 片子依据：
 *  1257213678056857600（9 秒原位改建）：腿从体块底角落到**下方真正的支撑**——码头、或者邻栋的屋顶；
 *      落到有坡屋顶的邻栋时腿先竖直、再折一段斜杆内倾到屋面里、末端一个红色垫块（frame-0080）；
 *      腿很长时（ff 33–55）两腿之间有横系杆 + 斜撑。
 *  1189902695303458816 "steel beam support structures … artificial yet organic … where the WFC algorithm really shines"：
 *      多层悬空体块下的长钢柱，隔一两层一道横系杆，系杆下有 Y 形短斜撑，节点处有接头（frame-0295）。
 *
 * 机制（本地离散规则，不是原版 378 模块 WFC 的逐模块复原）：
 *  1. 落点：每根腿在角点 p，向下逐层找"共享 p 的所有格"里最高的实心层 l（不只看自己这一列），
 *     腿停在 l·L —— 不再穿过邻栋。没有任何支撑 → 落到 0（水底，同旧行为）。
 *  2. 曲柄：支撑格 s 是 l≥2 的建筑顶层（有坡屋顶、不是码头铺地/岩石）→ 角点正落在檐口上站不住，
 *     腿在 kneeY 处折一段斜杆，脚点内收到 mix(p, s 格心, crank)，末端垫块。
 *  3. 系杆：同一簇（共用腿的悬空体块连通块）共用一套绝对层号的系杆集合 S；
 *     约束（每个开间 = 相邻两根直腿）：开间内相邻系杆/端点间隔 ≤ maxGap 层，且系杆不连层；
 *     在簇的层区间上穷举子集（≤ 2^12），取满足全部开间约束的最少系杆解，再按种子在等价解里选一个。
 *     这就是"约束求解出的系杆层"，相邻体块共腿时节点高度自动对齐。
 *  4. 每道系杆下两根短斜撑（Y 形），每个节点一个接头箍。头部（楼板下）横梁 + 斜撑沿用旧样式。
 *
 * 开关：world.steelFrame（默认 false；关时 buildings.js 走旧代码，几何逐字节不变 —— tests/steel-frame-r56.mjs 断言）。
 */
import { mix, hash01 } from '../core/noise.js';
import { ladderProfile } from '../core/ladder-profile.js';

const LEG = 0.045, TIE = 0.032, BRACE = 0.022;

/** 角点 p 的落点：共享 p 的格子里，lv-1 以下最高的实心层。返回 {level, support:[cells], flat, cell}。 */
export function legLanding(world, p, lv, { exclude = null } = {}) {
  const ids = world.grid.vertexCells.get(p.id) || [];
  for (let l = lv - 1; l >= 1; l--) {
    const sup = ids.map((id) => world.cells[id]).filter((c) => world.isSolid(c, l));
    if (!sup.length) continue;
    // 平的支撑：码头铺地（顶=1 的建筑）、岩石、或上面还有实心（=楼板/平台下的柱头，这里不会出现，因为 l 是最高）
    const flatOf = (c) => world.isRock(c, l) || l === 1 || world.isSolid(c, l + 1);
    const flat = sup.find(flatOf);
    return { level: l, flat: !!flat, cell: (flat ?? sup.find((c) => c !== exclude) ?? sup[0]).id, support: sup.map((c) => c.id) };
  }
  return { level: 0, flat: true, cell: -1, support: [] };
}

/** 约束求解系杆层：levels = 簇内所有开间 [{lo,hi}]（绝对层号，lo=脚落点层，hi=体块底层 lv-1）。 */
export function solveTieLevels(bays, { maxGap = 2, seed = 1 } = {}) {
  if (!bays.length) return { ties: [], solutions: 0, checked: 0 };
  const lo = Math.min(...bays.map((b) => b.lo)), hi = Math.max(...bays.map((b) => b.hi));
  const cand = []; for (let m = lo + 1; m <= hi; m++) cand.push(m);   // 节点高度 m·L（hi = lv-1：楼板下一层的顶）
  // hi 层的顶就是 yBase（头梁），不放系杆；系杆候选是 lo+1 .. hi-? —— 体块底 = (lv-1)·L = hi·L，所以 m < hi
  const C = cand.filter((m) => m < hi);
  if (C.length > 12) C.splice(0, C.length - 12);
  const ok = (set) => {
    for (let i = 1; i < set.length; i++) if (set[i] - set[i - 1] < 2) return false;      // 不连层
    for (const b of bays) {
      const pts = [b.lo, ...set.filter((m) => m > b.lo && m < b.hi), b.hi];
      for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > maxGap) return false;
    }
    return true;
  };
  let best = null, sols = [], checked = 0;
  for (let mask = 0; mask < 1 << C.length; mask++) {
    const set = C.filter((_, i) => mask >> i & 1);
    checked++;
    if (!ok(set)) continue;
    if (best === null || set.length < best) { best = set.length; sols = []; }
    if (set.length === best) sols.push(set);
  }
  if (!sols.length) return { ties: [], solutions: 0, checked, unsat: true };
  const pick = sols[Math.floor(hash01(seed * 9973 + 17) * sols.length) % sols.length];
  return { ties: pick, solutions: sols.length, checked };
}

/**
 * 画全部钢架。jobs = [{c, lv}]（buildings.js underside 里平底悬空段收集来的）。
 * 返回统计 + 每根腿的记录（测试与页面用）。
 */
export function emitSteelFrame(w, world, jobs, { L, K, posts, crank = 0.24, maxGap = 2 }) {
  const grid = world.grid, cells = world.cells;
  const legs = new Map();          // key = vid*64+lv → leg
  const blocks = [];
  for (const { c, lv } of jobs) {
    const below = lv - 1, yBase = (lv - 1) * L, corners = [];
    for (let k = 0; k < c.n; k++) {
      const p = c.pts[k];
      const sharing = grid.vertexCells.get(p.id) || [];
      if (sharing.some((id) => world.isSolid(cells[id], below))) continue;   // 角上已有墙托着
      corners.push(k);
      const key = p.id * 64 + lv;
      if (legs.has(key)) { legs.get(key).blocks.push(c.id); continue; }
      const land = legLanding(world, p, lv, { exclude: c });
      const x = mix(p.x, c.cx, 0.06), z = mix(p.z, c.cz, 0.06);
      const leg = { key, vid: p.id, lv, cell: c.id, blocks: [c.id], top: [x, yBase, z], landLevel: land.level, landCell: land.cell, flat: land.flat, support: land.support, crank: null };
      if (!land.flat && land.cell >= 0) {
        const s = cells[land.cell];
        const fx = mix(p.x, s.cx, crank), fz = mix(p.z, s.cz, crank);
        leg.crank = { foot: [fx, land.level * L, fz], knee: Math.min(yBase - 0.05, land.level * L + Math.max(0.35 * L, Math.hypot(fx - x, fz - z) * 1.6)) };
      }
      legs.set(key, leg);
    }
    blocks.push({ c, lv, yBase, corners });
  }
  // 簇：共用腿的体块（同 lv）
  const parent = new Map(blocks.map((b, i) => [b.c.id * 64 + b.lv, b.c.id * 64 + b.lv]));
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  for (const leg of legs.values()) for (const b of leg.blocks.slice(1)) parent.set(find(b * 64 + leg.lv), find(leg.blocks[0] * 64 + leg.lv));
  const bays = [];
  for (const b of blocks) for (let e = 0; e < b.c.n; e++) {
    const k0 = e, k1 = (e + 1) % b.c.n;
    if (!b.corners.includes(k0) || !b.corners.includes(k1)) continue;
    const l0 = legs.get(b.c.pts[k0].id * 64 + b.lv), l1 = legs.get(b.c.pts[k1].id * 64 + b.lv);
    bays.push({ block: b, l0, l1, cluster: find(b.c.id * 64 + b.lv), lo: Math.max(l0.landLevel, l1.landLevel), hi: b.lv - 1, straight: !l0.crank && !l1.crank });
  }
  const clusters = new Map();
  for (const bay of bays) if (bay.straight) (clusters.get(bay.cluster) ?? clusters.set(bay.cluster, []).get(bay.cluster)).push(bay);
  const tieOf = new Map(), clusterLog = [];
  for (const [id, list] of clusters) {
    const sol = solveTieLevels(list.map((b) => ({ lo: b.lo, hi: b.hi })), { maxGap, seed: id });
    tieOf.set(id, sol.ties);
    clusterLog.push({ cluster: id, bays: list.length, ties: sol.ties, solutions: sol.solutions, checked: sol.checked, unsat: !!sol.unsat });
  }

  /* ---- 画 ---- */
  const joint = (x, y, z) => w.box(x, y - 0.03, z, 0.075, 0.06, 0.075, K.steel, 0.8);
  const pad = K.band;
  let ties = 0, braces = 0, joints = 0, cranks = 0;
  const jointSeen = new Set();
  for (const leg of legs.values()) {
    w.at?.(cells[leg.cell]);
    const [x, yTop, z] = leg.top;
    if (leg.crank) {
      const { foot, knee } = leg.crank;
      w.beam([x, knee, z], [x, yTop, z], LEG, K.steel, 1);
      w.beam([foot[0], foot[1] + 0.06, foot[2]], [x, knee, z], LEG, K.steel, 0.95);
      joint(x, knee + 0.03, z); joints++;
      w.box(foot[0], foot[1] - 0.02, foot[2], 0.11, 0.1, 0.11, pad, 1);    // 红色垫块（frame-0080 腿落屋面处）
      cranks++;
    } else {
      w.beam([x, leg.landLevel * L, z], [x, yTop, z], LEG, K.steel, 1);
      if (leg.landLevel === 0) posts.push({ x, z });
    }
  }
  for (const bay of bays) {
    const { block, l0, l1 } = bay;
    w.at?.(block.c);
    const a = [l0.top[0], l0.top[2]], b = [l1.top[0], l1.top[2]], yBase = block.yBase;
    const yg = yBase - 0.05, span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // 头梁 + 斜撑（与旧样式一致）
    const yFoot = Math.max(l0.crank ? l0.crank.knee : l0.landLevel * L, l1.crank ? l1.crank.knee : l1.landLevel * L);
    const drop = Math.min(0.25, (yBase - yFoot) * 0.4);
    w.beam([a[0], yg, a[1]], [b[0], yg, b[1]], 0.035, K.steel, 0.95);
    w.beam([a[0], yg - drop, a[1]], [mix(a[0], b[0], 0.3), yg, mix(a[1], b[1], 0.3)], BRACE, K.steel, 0.9);
    w.beam([b[0], yg - drop, b[1]], [mix(b[0], a[0], 0.3), yg, mix(b[1], a[1], 0.3)], BRACE, K.steel, 0.9);
    braces += 2;
    if (!bay.straight) continue;
    for (const m of tieOf.get(bay.cluster) ?? []) {
      if (m <= bay.lo || m >= bay.hi) continue;
      const y = m * L, dr = Math.min(0.2, 0.4 * L, span * 0.35);
      w.beam([a[0], y, a[1]], [b[0], y, b[1]], TIE, K.steel, 0.92);
      w.beam([a[0], y - dr, a[1]], [mix(a[0], b[0], 0.32), y, mix(a[1], b[1], 0.32)], BRACE, K.steel, 0.88);
      w.beam([b[0], y - dr, b[1]], [mix(b[0], a[0], 0.32), y, mix(b[1], a[1], 0.32)], BRACE, K.steel, 0.88);
      ties++; braces += 2;
      for (const l of [l0, l1]) { const k = 'j' + l.key + ':' + m; if (!jointSeen.has(k)) { jointSeen.add(k); joint(l.top[0], y + 0.03, l.top[2]); joints++; } }
    }
  }
  // 5. 钢架爬梯（1189 frame-0295 柱间竖梯）：每簇在"落在码头铺地、≥3 层高"的直腿开间里按种子选一个，梯子在开间平面内从铺地爬到楼板下
  const ladders = [];
  for (const [id, list] of clusters) {
    const cand = list.filter((b) => b.lo === 1 && b.hi - b.lo >= 2);
    if (!cand.length) continue;
    const bay = cand[Math.floor(hash01(id * 131 + 7) * cand.length) % cand.length], { l0, l1, block } = bay;
    const mx = (l0.top[0] + l1.top[0]) / 2, mz = (l0.top[2] + l1.top[2]) / 2, ex = l1.top[0] - l0.top[0], ez = l1.top[2] - l0.top[2], el = Math.hypot(ex, ez) || 1;
    const prof = ladderProfile({ x: mx, y: L, z: mz }, { x: mx, y: block.yBase - 0.05, z: mz }, { side: { x: ex / el, y: 0, z: ez / el }, width: Math.min(0.16, el * 0.4), over: 0, spacing: 0.08 });
    w.at?.(block.c);
    for (const r of prof.rails) w.beam([r.a.x, r.a.y, r.a.z], [r.b.x, r.b.y, r.b.z], 0.014, K.rail, 1);
    for (const r of prof.rungs) w.beam([r.a.x, r.a.y, r.a.z], [r.b.x, r.b.y, r.b.z], 0.009, K.rail, 0.95);
    ladders.push({ cluster: id, cell: block.c.id, lv: block.lv, rungs: prof.rungs.length, length: prof.length });
  }
  return { legs: [...legs.values()], blocks: blocks.length, bays: bays.length, ties, braces, joints, cranks, ladders, clusters: clusterLog };
}
