/**
 * nav-lab.js — 战役层导航实验台（Guide §9 D 组 R33–R36）。Worker 安全：纯数据，只 import vendor 副本里的导航模块，
 * 不 import three / DOM。能力（nav-capabilities.js）、验证（nav-verify.js）、对照（nav-parity.js）、演示页都用它。
 *
 *   stripWorld / asciiWorld      方格测试岛（与 REACodeRefactoring tests/fixtures/g5-battle.mjs 的 stripWorld 同口径）
 *   envFromNavSample             把实景舞台的采样（battle.probe 的 site.nav）在 Worker 里重建成 REA World
 *   makeNav                      BattleNavigation（vendor 副本，R33 换成最新库）
 *   simulateWalk                 battle.js「走」那一段的无随机复刻（plan → steerTarget → 左行车道 → 软分离 → move）
 *   finePortalReport             R34 拱洞精细门户：穿墙探针 + 穿拱模拟（开 / 关对照）
 *   trafficReport                R35 窄道会车：窄道 / 弯道 / 岔口统计、体型重路由、两队对向会车模拟
 *   footingReport                R36 穿洞与脚高插值：楼梯踏面、洞道脚高、逐帧脚高跳变
 *
 * 所有数字都是这些模块真实算出来的；这里不复制任何算法，只做取样和统计。
 */
import { buildQuadGrid } from '../../vendor/townscaper-rea-refactoring/src/core/grid.js';
import { decorateCells, buildCellIndex } from '../../vendor/townscaper-rea-refactoring/src/core/spatial.js';
import { World, MAX_LEVEL } from '../../vendor/townscaper-rea-refactoring/src/core/world.js';
import { BattleNavigation } from '../../vendor/townscaper-rea-refactoring/src/world/battle-navigation.js';
import { buildNav } from '../../vendor/townscaper-rea-refactoring/src/world/navgraph.js';
import { narrowCells, leftLaneTarget, localSeparation } from '../../vendor/townscaper-rea-refactoring/src/world/traffic.js';
import { UNIT_HEIGHT } from '../../vendor/townscaper-rea-refactoring/src/world/fine-portals.js';

export const NAV_LAB_VERSION = 1;
export const LEVEL_HEIGHT = 0.5;
export const BODY_RADIUS = 0.055;
export { UNIT_HEIGHT };
/** 能力 meta.modules 用的重构库路径（相对 REACodeRefactoring/，与 vendor 副本里的同名文件逐字相同，见 R33 swap-manifest） */
export const NAV_MODULES = Object.freeze({
  navigation: 'src/world/battle-navigation.js', layered: 'src/world/layerednav.js', fine: 'src/world/fine-portals.js',
  arch: 'src/core/arch-floor-budget.js', navgraph: 'src/world/navgraph.js', traffic: 'src/world/traffic.js', flow: 'src/world/navmesh-flow.js',
});
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);

/* ------------------------------------------------------------------ 方格测试岛 */
export function stripWorld(cols, rows) {
  const id = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows) ? -1 : j * cols + i;
  const vid = (a, b) => b * (cols + 1) + a;
  const cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push({
    id: id(i, j), n: 4, cx: i, cz: j, i, j,
    pts: [{ x: i - .5, z: j - .5, id: vid(i, j) }, { x: i + .5, z: j - .5, id: vid(i + 1, j) }, { x: i + .5, z: j + .5, id: vid(i + 1, j + 1) }, { x: i - .5, z: j + .5, id: vid(i, j + 1) }],
    // 边 k：pts[k]→pts[k+1]；0 = j−1、1 = i+1、2 = j+1、3 = i−1
    edgeNeighbors: [id(i, j - 1), id(i + 1, j), id(i, j + 1), id(i - 1, j)],
  });
  for (const c of cells) c.edgeTwins = c.edgeNeighbors.map((nb) => (nb < 0 ? -1 : cells[nb].edgeNeighbors.indexOf(c.id)));
  const vertexCells = new Map();
  for (const c of cells) for (const p of c.pts) { if (!vertexCells.has(p.id)) vertexCells.set(p.id, []); vertexCells.get(p.id).push(c.id); }
  const grid = { kind: 'strip', cells, vertexCells, cols, rows };
  const world = new World(grid);
  const index = { cellAt(x, z) { const i = Math.round(x), j = Math.round(z); if (Math.abs(x - i) > .5 || Math.abs(z - j) > .5) return null; const k = id(i, j); return k < 0 ? null : cells[k]; } };
  return { kind: 'strip', grid, world, index, cols, rows, L: LEVEL_HEIGHT, at: (i, j) => cells[id(i, j)] ?? null };
}

export const maskOf = (levels) => levels.reduce((m, lv) => (lv >= 1 && lv <= MAX_LEVEL ? m | (1 << (lv - 1)) : m), 0);
const span = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
/** 字符 → 这一列的实心层。墙高 6 层：与 1 层地面差 5 层，既走不上去也不会被 buildNav 放楼梯。
 *  A / T = 拱 / 洞道：第 1 层是地面，第 2 层是空的（洞），第 3–6 层是拱顶，顶面与墙同高（不会在拱顶上长楼梯）。 */
export const COLUMN = Object.freeze({ '#': span(1, 6), '.': [1], '1': [1], '2': [1, 2], A: [1, ...span(3, 6)], T: [1, ...span(3, 6)], '~': [] });
/** '#' 是考场围墙 / 障碍：6 层实心但顶上没有楼梯可上，顶面不算可站地表（rock=0 → ground=0，buildNav 不放 walk）。
 *  否则围墙顶会多出一圈「一格宽窄道」和一个更大的可走区域，把楼梯 used 判定与窄道统计带偏。 */
const NO_TOP = new Set(['#']);
export function asciiWorld(rows, legend = COLUMN) {
  const R = rows.length, C = Math.max(...rows.map((r) => r.length));
  const env = stripWorld(C, R);
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
    const ch = rows[j][i] ?? '~', lv = legend[ch];
    if (!lv) throw new RangeError(`测试岛第 ${j} 行第 ${i} 列的字符「${ch}」没有定义`);
    const c = env.at(i, j), m = maskOf(lv);
    env.world.solid[c.id] = m; env.world.rock[c.id] = NO_TOP.has(ch) ? 0 : m;
  }
  env.world.touch();
  env.map = rows.slice();
  return env;
}
/** R34：一道墙把小岛隔成南北两半，只有两个拱洞能过（9×7）。 */
export const ARCH_ISLAND = Object.freeze(['.........', '.........', '.........', '##A###A##', '.........', '.........', '.........']);
/** R35：左右两间屋，一条带拱的直窄道（短）+ 一条有弯、有岔口的长窄道。 */
export const TRAFFIC_ISLAND = Object.freeze(['#############', '#...#####...#', '#.....A.....#', '#...#####...#', '##.#######.##', '##.#######.##', '##.........##', '######.######', '#############']);
/** R35：对向会车考场：一条四道弯、中间一个岔口（死胡同）的一格宽窄道连着左右两间屋，没有拱。 */
export const COURSE = Object.freeze(['#############', '#..#######..#', '#....###....#', '#..#.###.#..#', '####.....####', '######.######', '#############']);
/** R36：洞道（三格 T）+ 一层台地（2）与楼梯。 */
export const FOOTING_ISLAND = Object.freeze(['#############', '#111TTT11222#', '#111###11222#', '#11111111222#', '#############']);

/* ------------------------------------------------------------------ 实景采样重建 */
const envCache = new Map();
/** site.nav = { gridRadius, hexSize, levelHeight, cells, solid:[…], hollow:[…]|null, arches, unitHeight, radius }（sceneBattle.probe 产出）。
 *  hollow=true 时用「拱洞挖空」后的柱子（R34 开关）；同一份采样只重建一次网格。 */
export function envFromNavSample(nav, { hollow = false } = {}) {
  if (!nav || !Array.isArray(nav.solid) || !(nav.gridRadius > 0)) throw new Error('没有导航采样（site.nav）：先在实景里扫描战斗舞台');
  const cols = hollow && Array.isArray(nav.hollow) ? nav.hollow : nav.solid;
  const key = nav.gridRadius + ':' + (nav.hexSize ?? 1) + ':' + nav.cells + ':' + (hollow ? 'h' : 's') + ':' + hashCols(cols);
  const hit = envCache.get(key); if (hit) return hit;
  const grid = decorateCells(buildQuadGrid({ radius: nav.gridRadius, hexSize: nav.hexSize ?? 1 }));
  if (nav.cells && grid.cells.length !== nav.cells) throw new Error(`网格重建不一致：实景 ${nav.cells} 格，Worker 里 ${grid.cells.length} 格`);
  if (cols.length !== grid.cells.length) throw new Error('导航采样长度与网格不一致');
  const world = new World(grid);
  for (let i = 0; i < cols.length; i++) { world.solid[i] = cols[i] | 0; world.rock[i] = cols[i] | 0; }
  world.touch();
  const env = { kind: 'stage', grid, world, index: buildCellIndex(grid), L: nav.levelHeight ?? LEVEL_HEIGHT, hollow: !!hollow };
  if (envCache.size > 6) envCache.clear();
  envCache.set(key, env);
  return env;
}
function hashCols(a) { let h = 2166136261; for (let i = 0; i < a.length; i++) { h ^= a[i] | 0; h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + a.length; }

/** 测试 / 演示用：在与实景同一种网格（buildQuadGrid）上按函数造一份导航采样。column(cell) → 实心层列表；hollowColumn 给挖空后的版本。 */
export function syntheticNavSample({ gridRadius = 8, column, hollowColumn = null, unitHeight = .34 } = {}) {
  const grid = decorateCells(buildQuadGrid({ radius: gridRadius, hexSize: 1 }));
  const solid = grid.cells.map((c) => maskOf(column(c)));
  const hollow = hollowColumn ? grid.cells.map((c) => maskOf(hollowColumn(c))) : null;
  return { gridRadius, hexSize: 1, levelHeight: LEVEL_HEIGHT, cells: grid.cells.length, solid, hollow, arches: hollow ? hollow.filter((m, i) => m !== solid[i]).length : 0, radius: BODY_RADIUS, unitHeight };
}
/** 演示岛：海 → 1 层滩 → 2 层台地（有楼梯）；台地中间一道东西向、6 层高的墙，挖空版本在墙正中开一条南北向的洞道（洞底 = 台地第 2 层，洞高 1 层）。 */
export function demoNavSample({ gridRadius = 8 } = {}) {
  const land = (c) => { const r = Math.hypot(c.cx, c.cz); return r > 6.5 ? [] : r > 4.5 ? [1] : [1, 2]; };
  const wall = (c) => Math.abs(c.cz) < 1.3 && Math.abs(c.cx) < 3.6 && Math.hypot(c.cx, c.cz) <= 4.5;
  return syntheticNavSample({ gridRadius, column: (c) => (wall(c) ? span(1, 6) : land(c)), hollowColumn: (c) => (wall(c) ? (Math.abs(c.cx) < .5 ? [1, 2, ...span(4, 6)] : span(1, 6)) : land(c)) });
}
export function demoSite(nav = demoNavSample()) {
  const land = nav.solid.filter(Boolean).length;
  return { scene: { id: 'demo', label: '演示岛' }, meshes: 0, cells: nav.cells, land, maxLevel: 6, houses: 1, scale: 5, gridRadius: nav.gridRadius, unitHeight: 1.7, plateauRaised: 0, nav };
}
/** 柱子统计（只看位掩码，不建图）：实心柱 = 从第 1 层连续到顶；否则这一列有洞道 / 拱下空间。 */
export function columnStats(cols) {
  let land = 0, hollowCols = 0;
  for (const m of cols || []) { if (!m) continue; land++; const top = 32 - Math.clz32(m); if (m !== (2 ** top) - 1) hollowCols++; }
  return { land, hollowCols };
}

/* ------------------------------------------------------------------ 导航 */
export function makeNav(env, { finePortals = false, unitHeight = UNIT_HEIGHT, radius = BODY_RADIUS, doorCost } = {}) {
  const opts = { levelHeight: env.L, radius, finePortals, unitHeight };
  if (doorCost !== undefined) opts.doorCost = doorCost;
  const nav = new BattleNavigation(env.world, env.index, opts);
  nav.refresh();
  return nav;
}
export function statsOf(graph) {
  const s = graph.stats();
  return { nodes: s.nodes, portals: s.portals, components: s.components, largest: s.largest, largestShare: r3(s.largestShare), covered: s.covered, coveredShare: r3(s.coveredShare) };
}
const nodeAt = (nav, cell, floor) => { const id = cell ? nav.graph.at(cell, floor) : -1; return id >= 0 ? nav.graph.nodes[id] : null; };
const topNode = (nav, cell) => nodeAt(nav, cell, nav.world.top(cell));

/**
 * battle.js「走」的那一段（2026-11-16 换库版后：vendor badnorth/battle.js ~996–1025 行主循环 + #step 456–471）：plan → steerTarget → 窄道左行车道 → 软分离 → move（失败再不带分离试一次）。
 * 新库版 #step 额外有「斜滑 30° / 慢速爬行」自救分支与 easeUnitToHeight 脚高跟层——这里复刻的是主路口径，不带自救与脚高插值。
 * 去掉战斗、流场、编队与随机；到了目标格（plan.arrived）就停。units: [{ x, z, navFloor, radius, goal:cell, goalFloor, speed? }]
 * onFrame(u, frame, nav) 每人每帧回调一次（用来采样）。
 */
export function simulateWalk(env, nav, units, { dt = 1 / 30, frames = 1800, speed = .9, lanes = true, separation = true, onFrame = null } = {}) {
  const w = env.world, L = env.L;
  const narrow = lanes ? narrowCells(w, buildNav(w)) : null;
  for (const u of units) { u.y = (u.navFloor ?? 0) * L; u.still = 0; u.stuckMax = 0; u.cells = new Set(); u.arrived = false; u.arrivedAt = null; u.noPlan = 0; u.dead = false; }
  let frame = 0;
  for (; frame < frames; frame++) {
    if (units.every((u) => u.arrived)) break;
    for (const u of units) {
      if (u.arrived) continue;
      const plan = nav.plan(u, u.goal, u.goalFloor ?? w.top(u.goal));
      if (!plan) { u.noPlan++; u.still++; u.stuckMax = Math.max(u.stuckMax, u.still); continue; }
      if (plan.arrived) { u.arrived = true; u.arrivedAt = frame; continue; }
      const here = plan.from.cell, next = plan.next.cell;
      const aim = nav.steerTarget(u, plan);
      let tx = aim?.x ?? next.cx, tz = aim?.z ?? next.cz;
      if (narrow && (narrow[here.id] || narrow[next.id])) { const r = u.radius ?? BODY_RADIUS, lane = leftLaneTarget(here, next, { width: Math.max(.08, r), bodyRadius: r }); tx = lane.x; tz = lane.z; }
      const x0 = u.x, z0 = u.z, dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz);
      if (d > .02) {
        const s = Math.min(d, (u.speed ?? speed) * dt) / d;
        const sep = separation ? localSeparation(u, units, dt, { heightTolerance: L * .6 }) : { x: 0, z: 0 };
        if (!nav.move(u, u.x + dx * s + sep.x, u.z + dz * s + sep.z, plan)) nav.move(u, u.x + dx * s, u.z + dz * s, plan);
      }
      u.y = (u.navFloor ?? 0) * L;
      const c = env.index.cellAt(u.x, u.z); if (c) u.cells.add(c.id);
      if (Math.hypot(u.x - x0, u.z - z0) < 1e-4) { u.still++; u.stuckMax = Math.max(u.stuckMax, u.still); } else u.still = 0;
      onFrame?.(u, frame, nav, plan);
    }
  }
  return { frames: frame, arrived: units.filter((u) => u.arrived).length, total: units.length, stuckMax: Math.max(0, ...units.map((u) => u.stuckMax)), noPlan: units.reduce((s, u) => s + u.noPlan, 0) };
}
/** 格心到各边的最短距离 */
export function innerRadius(c) {
  let r = Infinity;
  for (let i = 0; i < c.n; i++) { const p = c.pts[i], q = c.pts[(i + 1) % c.n], ex = q.x - p.x, ez = q.z - p.z; r = Math.min(r, Math.abs(ex * (c.cz - p.z) - ez * (c.cx - p.x)) / (Math.hypot(ex, ez) || 1)); }
  return r;
}
const unitAt = (cell, floor, { radius = BODY_RADIUS, dx = 0, dz = 0, goal = null, goalFloor = null, k = 0 } = {}) => ({ x: cell.cx + dx, z: cell.cz + dz, navFloor: floor, radius, goal, goalFloor, k, team: 0 });

/* ------------------------------------------------------------------ R34 拱洞精细门户 */
/** 被收窄的门户（t0 > 0）上取一点：离格角超过身体半径、又落在被拱脚封掉的那一段里。
 *  关精细门户：这里放得下身体（= 贴着拱脚穿墙）；开：放不下。 */
function wallProbes(off, on, radius) {
  let probes = 0, offFits = 0, onBlocked = 0, both = 0;
  for (const [from, list] of on.graph.adj.entries()) for (const e of list) {
    const f = on.fine.aperture(from, e.portal.edge); if (!f || !(f.width > 0) || !(f.t0 > 1e-9)) continue;
    const a = on.graph.nodes[from], c = a.cell, P0 = c.pts[e.portal.edge], P1 = c.pts[(e.portal.edge + 1) % c.n], len = Math.hypot(P1.x - P0.x, P1.z - P0.z);
    const lo = (radius + 1e-3) / len; if (!(f.t0 > lo)) continue;
    const t = (lo + f.t0) / 2, x = P0.x + (P1.x - P0.x) * t, z = P0.z + (P1.z - P0.z) * t;
    probes++;
    const okOff = off.discFits(off.graph.nodes[from], x, z, radius), okOn = on.discFits(a, x, z, radius);
    if (okOff) offFits++; if (!okOn) onBlocked++; if (okOff && !okOn) both++;
  }
  return { probes, offFits, onBlocked, offFitsOnBlocked: both };
}
/** 拱下节点：两侧开口边各对着一个同层可站格（从一侧走到另一侧就是「穿拱」）。 */
function archCrossings(on, max) {
  const out = [];
  for (const n of on.graph.nodes) {
    const u = on.fine.under[n.id]; if (!u || u.kind !== 'arch' || !(u.u0 < .5)) continue;
    const edges = [...u.open.keys()]; if (edges.length < 2) continue;
    const c1 = on.world.neighbor(n.cell, edges[0]), c2 = on.world.neighbor(n.cell, edges[1]);
    const a = nodeAt(on, c1, n.floor), b = nodeAt(on, c2, n.floor); if (!a || !b) continue;
    const P0 = n.cell.pts[edges[0]], P1 = n.cell.pts[(edges[0] + 1) % n.cell.n];
    out.push({ node: n, from: a, to: b, side: { x: (P1.x - P0.x) * .3, z: (P1.z - P0.z) * .3 } });
    if (out.length >= max) break;
  }
  return out;
}
export function finePortalReport(env, { unitHeight = UNIT_HEIGHT, radius = BODY_RADIUS, maxArches = 12, frames = 600 } = {}) {
  const off = makeNav(env, { finePortals: false, unitHeight, radius }), on = makeNav(env, { finePortals: true, unitHeight, radius });
  const fine = on.fine.stats(), graph = statsOf(on.graph), probes = wallProbes(off, on, radius);
  const crossings = archCrossings(on, maxArches);
  const run = (nav) => {
    let arrived = 0, clips = 0, samples = 0, through = 0;
    for (const x of crossings) {
      // 从拱一侧的格子出发、起点往拱脚那边偏 0.3 格（斜着进拱，最容易擦到拱脚），走到另一侧
      const u = unitAt(x.from.cell, x.from.floor, { radius, dx: x.side.x, dz: x.side.z, goal: x.to.cell, goalFloor: x.to.floor });
      let inArch = false;
      simulateWalk(env, nav, [u], { frames, lanes: false, separation: false, onFrame: (v) => {
        const node = on.unitNode(v); samples++;
        if (!node || !on.discFits(node, v.x, v.z, radius)) clips++;     // 用「开」的判据检查每一帧的位置
        if (node && node.id === x.node.id) inArch = true;
      } });
      if (u.arrived) arrived++; if (u.arrived && inArch) through++;
    }
    return { arrived, through, clips, samples };
  };
  return {
    unitHeight: r3(unitHeight), radius, graph,
    fine: { archNodes: fine.archNodes, flatNodes: fine.flatNodes, covered: fine.covered, sideWalls: fine.sideWalls, legs: fine.legs, narrowed: fine.narrowed, closed: fine.closed, meanNarrowing: r3(fine.meanNarrowing) },
    probes, crossings: crossings.length, on: run(on), off: run(off),
  };
}

/* ------------------------------------------------------------------ R35 窄道会车 */
function surfaceLinks(world, surface, c) {
  if (!surface.walk[c.id]) return [];
  return c.edgeNeighbors.filter((id) => id >= 0 && surface.walk[id] && Number.isFinite(surface.cost(c, world.cells[id])));
}
/** 窄道（traffic.narrowCells）里两条通路夹角 < 150° 的是弯道；有 ≥3 条通路、且挨着窄道的是岔口。 */
export function corridorStats(env) {
  const w = env.world, surface = buildNav(w), narrow = narrowCells(w, surface);
  let corridors = 0, curves = 0, forks = 0;
  for (const c of w.cells) {
    const links = surfaceLinks(w, surface, c); if (!links.length) continue;
    if (narrow[c.id]) {
      corridors++;
      if (links.length === 2) {
        const a = w.cells[links[0]], b = w.cells[links[1]], ax = a.cx - c.cx, az = a.cz - c.cz, bx = b.cx - c.cx, bz = b.cz - c.cz;
        const cos = (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1);
        if (cos > -0.866) curves++;
      }
    } else if (links.length >= 3 && links.some((id) => narrow[id])) forks++;
  }
  return { surface, narrow, corridors, curves, forks };
}
/** 最长的一段窄道（窄格经表层通路相连）和它两头外面的格子。 */
function longestCorridor(env, cs) {
  const w = env.world, seen = new Set(); let best = null;
  for (const c of w.cells) {
    if (!cs.narrow[c.id] || seen.has(c.id)) continue;
    const chain = [], q = [c.id]; seen.add(c.id);
    for (let h = 0; h < q.length; h++) { chain.push(q[h]); for (const id of surfaceLinks(w, cs.surface, w.cells[q[h]])) if (cs.narrow[id] && !seen.has(id)) { seen.add(id); q.push(id); } }
    const ends = [];
    for (const id of chain) for (const nb of surfaceLinks(w, cs.surface, w.cells[id])) if (!cs.narrow[nb] && !ends.includes(nb)) ends.push(nb);
    if (ends.length >= 2 && (!best || chain.length > best.chain.length)) {
      // 两头取离得最远的一对
      let a = ends[0], b = ends[1], dmax = -1;
      for (const x of ends) for (const y of ends) { const d = Math.hypot(w.cells[x].cx - w.cells[y].cx, w.cells[x].cz - w.cells[y].cz); if (d > dmax) { dmax = d; a = x; b = y; } }
      best = { chain, a: w.cells[a], b: w.cells[b] };
    }
  }
  return best;
}
/** 两队对向会车：每队 squad 个普通兵 + 1 个大个子，从 A 走到 B / 从 B 走到 A。 */
export function meetingRun(env, nav, a, b, { squad = 3, radius = BODY_RADIUS, heavyRadius = .12, frames = 2400 } = {}) {
  const fa = env.world.top(a), fb = env.world.top(b), units = [];
  // 起点围着格心一圈；圈半径按格子内切半径收（实景网格一格只有约 0.5 舞台单位宽）
  const ring = (c, k) => { const r = Math.min(.18, innerRadius(c) * .5); return { dx: Math.cos(k * 2.1) * r, dz: Math.sin(k * 2.1) * r }; };
  for (let k = 0; k < squad; k++) { units.push(unitAt(a, fa, { radius, goal: b, goalFloor: fb, k, ...ring(a, k) })); units.push(unitAt(b, fb, { radius, goal: a, goalFloor: fa, k, ...ring(b, k) })); }
  units.push(unitAt(a, fa, { radius: heavyRadius, goal: b, goalFloor: fb, k: 9 }), unitAt(b, fb, { radius: heavyRadius, goal: a, goalFloor: fa, k: 9 }));
  let maxPenetration = 0;
  const sim = simulateWalk(env, nav, units, { frames, onFrame: (u) => {
    for (const v of units) if (v !== u && !v.arrived && Math.abs(v.y - u.y) < env.L * .6) maxPenetration = Math.max(maxPenetration, (u.radius + v.radius) - Math.hypot(u.x - v.x, u.z - v.z));
  } });
  const heavy = units.filter((u) => u.radius === heavyRadius);
  return { ...sim, heavyArrived: heavy.filter((u) => u.arrived).length, heavyTotal: heavy.length, maxPenetration: r3(Math.max(0, maxPenetration)), units };
}
/** 体型重路由：同一对起终点，普通兵与大个子各求一次路线代价。 */
function reroutes(nav, env, { radius, heavyRadius, goals = 12, starts = 24 }) {
  const tops = nav.graph.nodes.filter((n) => n.floor === env.world.top(n.cell));
  const pick = (k) => { const out = []; const step = Math.max(1, Math.floor(tops.length / k)); for (let i = 0; i < tops.length && out.length < k; i += step) out.push(tops[i]); return out; };
  let pairs = 0, rerouted = 0, blocked = 0, maxDetour = 1;
  for (const g of pick(goals)) for (const s of pick(starts)) {
    if (s.id === g.id) continue;
    const small = nav.plan({ x: s.x, z: s.z, navFloor: s.floor, radius }, g.cell, g.floor); if (!small) continue;
    pairs++;
    const big = nav.plan({ x: s.x, z: s.z, navFloor: s.floor, radius: heavyRadius }, g.cell, g.floor);
    if (!big) blocked++; else if (big.distance > small.distance + 1e-6) { rerouted++; maxDetour = Math.max(maxDetour, big.distance / Math.max(1e-6, small.distance)); }
  }
  return { pairs, rerouted, blocked, maxDetour: r3(maxDetour) };
}
export function trafficReport(env, { unitHeight = UNIT_HEIGHT, radius = BODY_RADIUS, heavyRadius = .12, squad = 3, frames = 2400, meet = null } = {}) {
  const nav = makeNav(env, { finePortals: true, unitHeight, radius });
  const cs = corridorStats(env);
  const lanePass = 2 * (.08 + radius);   // 左行车道两人并排要的门宽
  let laneConflicts = 0, minPortal = Infinity;
  for (const p of nav.graph.portals) { if (p.width < lanePass && p.width > 0) laneConflicts++; if (p.width > 0) minPortal = Math.min(minPortal, p.width); }
  const rr = reroutes(nav, env, { radius, heavyRadius });
  const corr = meet ? { chain: [], a: meet.a, b: meet.b } : longestCorridor(env, cs);
  let meeting = null;
  if (corr) { const m = meetingRun(env, nav, corr.a, corr.b, { squad, radius, heavyRadius, frames }); meeting = { corridor: corr.chain.length, from: corr.a.id, to: corr.b.id, frames: m.frames, arrived: m.arrived, total: m.total, heavyArrived: m.heavyArrived, heavyTotal: m.heavyTotal, stuckMax: m.stuckMax, noPlan: m.noPlan, maxPenetration: m.maxPenetration }; }
  return { unitHeight: r3(unitHeight), radius, heavyRadius, corridors: cs.corridors, curves: cs.curves, forks: cs.forks, laneConflicts, minPortal: r3(Number.isFinite(minPortal) ? minPortal : 0), reroute: rr, meeting };
}

/* ------------------------------------------------------------------ R36 穿洞与脚高插值 */
function stairProfile(nav, s) {
  const c = s.low, p = c.pts[s.edge], q = c.pts[(s.edge + 1) % c.n], ux = q.x - p.x, uz = q.z - p.z, len = Math.hypot(ux, uz);
  if (len < .2) return null;
  let vx = -uz / len, vz = ux / len; const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2;
  if ((c.cx - mx) * vx + (c.cz - mz) * vz < 0) { vx = -vx; vz = -vz; }
  const node = topNode(nav, c); if (!node) return null;
  let prev = null, maxStep = 0, hits = 0; const base = node.floor * nav.L;
  for (let k = 50; k >= 0; k--) {   // 整数步：d 恰好落到 0（浮点累减会落到 −1e−16，那一点就不在楼梯上了）
    const d = k * .01, h = nav.surfaceHeight(mx + vx * d, mz + vz * d, node); if (h > base + 1e-9) hits++;
    if (prev !== null) maxStep = Math.max(maxStep, Math.abs(h - prev)); prev = h;
  }
  const rise = s.rise || 1;
  // 走到墙边（d→0）时踏面应到上层地面；未插值时一步就是 rise·L
  return { rise, maxStep: r3(maxStep), flat: r3(rise * nav.L), top: r3(prev), hits };
}
export function footingReport(env, { unitHeight = UNIT_HEIGHT, radius = BODY_RADIUS, maxRoutes = 6, frames = 900, routes = null } = {}) {
  const nav = makeNav(env, { finePortals: true, unitHeight, radius }), w = env.world, L = env.L;
  const profiles = (nav.stairs || []).slice(0, 24).map((s) => stairProfile(nav, s)).filter(Boolean);
  let covered = 0, tunnelErrors = 0, roofGap = 0;
  for (const n of nav.graph.nodes) {
    const top = w.top(n.cell); if (n.floor >= top) continue;
    covered++; const h = nav.surfaceHeight(n.x, n.z, n);
    if (Math.abs(h - n.floor * L) > 1e-9) tunnelErrors++;
    roofGap = Math.max(roofGap, (top - n.floor) * L);
  }
  // 逐帧：未插值（navFloor·L）与插值（footHeight）的跳变；洞道里脚高必须是洞底，不是洞顶
  const list = routes || autoRoutes(nav, env, maxRoutes);
  let samples = 0, maxJumpFlat = 0, maxJumpFoot = 0, stairFrames = 0, tunnelFrames = 0, roofFrames = 0, arrived = 0;
  for (const r of list) {
    const u = unitAt(r.from, r.fromFloor ?? w.top(r.from), { radius, goal: r.to, goalFloor: r.toFloor ?? w.top(r.to) });
    let lastFlat = null, lastFoot = null;
    simulateWalk(env, nav, [u], { frames, lanes: false, separation: false, onFrame: (v) => {
      const node = nav.unitNode(v); if (!node) return;
      const flat = node.floor * L, foot = nav.footHeight(v); samples++;
      if (lastFlat !== null) { maxJumpFlat = Math.max(maxJumpFlat, Math.abs(flat - lastFlat)); maxJumpFoot = Math.max(maxJumpFoot, Math.abs(foot - lastFoot)); }
      lastFlat = flat; lastFoot = foot;
      if (foot > flat + 1e-9) stairFrames++;
      if (node.floor < w.top(node.cell)) { tunnelFrames++; if (Math.abs(foot - flat) < 1e-9) roofFrames++; }
    } });
    if (u.arrived) arrived++;
  }
  return {
    unitHeight: r3(unitHeight), stairs: (nav.stairs || []).length, profiles: profiles.length,
    stairMaxStep: r3(Math.max(0, ...profiles.map((p) => p.maxStep))), stairFlatStep: r3(Math.max(0, ...profiles.map((p) => p.flat))),
    covered, tunnelErrors, roofGap: r3(roofGap),
    walk: { routes: list.length, arrived, samples, maxJumpFlat: r3(maxJumpFlat), maxJumpFoot: r3(maxJumpFoot), stairFrames, tunnelFrames, tunnelFloorFrames: roofFrames },
  };
}
/** 自动挑路线：每架楼梯从低格对面那格走到高格；每个洞道从一侧开口走到另一侧。 */
function autoRoutes(nav, env, max) {
  const w = env.world, out = [];
  for (const s of nav.stairs || []) {
    if (out.length >= Math.ceil(max / 2)) break;
    const back = w.neighbor(s.low, (s.edge + 2) % s.low.n);
    const from = back && topNode(nav, back) && w.top(back) === w.top(s.low) ? back : s.low;
    out.push({ from, to: s.high });
  }
  if (nav.fine) for (const n of nav.graph.nodes) {
    if (out.length >= max) break;
    const u = nav.fine.under[n.id]; if (!u || u.kind !== 'arch') continue;
    const e = [...u.open.keys()]; if (e.length < 2) continue;
    const a = w.neighbor(n.cell, e[0]), b = w.neighbor(n.cell, e[1]);
    if (nodeAt(nav, a, n.floor) && nodeAt(nav, b, n.floor)) out.push({ from: a, fromFloor: n.floor, to: b, toFloor: n.floor });
  }
  return out;
}
