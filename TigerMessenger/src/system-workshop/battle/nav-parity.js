/**
 * nav-parity.js — 原版当裁判，第一例：导航（Guide §1.4 创新 1、§9 D 组 R33）。纯逻辑：Node 与浏览器共用，不写文件。
 *
 * 同一座岛喂给两边：
 *   原版   townscaper-web/REACode/src/cheesenav.js（体素「瑞士奶酪」：可站 = 空气 + 脚下实心 + 头顶两格空气，6 邻接）
 *          townscaper-web/REACode/src/holenav.js  （门洞图：墙 + 拱门，门洞格加价 1.35）
 *          —— 只读 import，一个字都不改。
 *   重构版 vendor 副本 world/layerednav.js + world/battle-navigation.js（R33 换成最新库，游戏实际跑的就是这两份）。
 * 比三个数：连通块数、最大块占比、被覆盖节点数（同一列上方还有实心 = 洞道 / 拱下）；门洞图另比路线代价。
 *
 * 每座岛比两种口径：
 *   同判据   重构版按原版的定义取同一批节点（奶酪：净空 3 层、只走同层、去掉外壳；门洞：只看第 1 层）。应当完全一致 → 「行为等价」。
 *   战役判据 BattleNavigation 默认参数（游戏里真的这么算）。不一致的地方逐条登记成缺口（diffs），带可复现输入，
 *            由 tools/refactor/nav-parity.mjs 写进 catalog/parity/，再经 export-learn-queue 进补学队列。
 * 「同判据一致」只说明这几个统计量在这两座岛上一致，不说明两份代码在任意输入上等价。
 */
import { carveCheese, navNodes } from '../../../../townscaper-web/REACode/src/cheesenav.js';
import { makeCheese, buildPortalGraph, route } from '../../../../townscaper-web/REACode/src/holenav.js';
import { buildLayeredNav } from '../../vendor/townscaper-rea-refactoring/src/world/layerednav.js';
import { stripWorld, makeNav, maskOf } from './nav-lab.js';

export const NAV_PARITY_VERSION = 1;
export const PARITY_INPUTS = Object.freeze({
  cheese: Object.freeze({ w: 20, h: 11, d: 20, seed: 7, tunnels: 7, tunnelLen: 60 }),
  holes: Object.freeze({ W: 15, D: 15, openness: .55, seed: 7 }),
  pairs: 200, pairSeed: 11,
});
export const ORIGINAL_FILES = Object.freeze(['townscaper-web/REACode/src/cheesenav.js', 'townscaper-web/REACode/src/holenav.js']);
export const REFACTORED_FILES = Object.freeze(['TigerMessenger/src/vendor/townscaper-rea-refactoring/src/world/layerednav.js', 'TigerMessenger/src/vendor/townscaper-rea-refactoring/src/world/battle-navigation.js']);
/** 战役层里真实调用 layerednav / battle-navigation 的导航能力：每个都拿到这份对照作 ④ 的证据 */
export const NAV_PARITY_CAPABILITIES = Object.freeze(['battle.navFinePortals', 'battle.navTraffic', 'battle.navFooting']);
export const PARITY_CLIPS = Object.freeze(['906425294533394432', '797119718477991936']);
const r4 = (v) => Math.round(v * 1e4) / 1e4;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function componentsOf(n, neighbors) {
  const comp = new Int32Array(n).fill(-1), sizes = [];
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0) continue;
    const q = [i]; comp[i] = sizes.length;
    for (let h = 0; h < q.length; h++) for (const j of neighbors(q[h])) if (comp[j] < 0) { comp[j] = sizes.length; q.push(j); }
    sizes.push(q.length);
  }
  const largest = Math.max(0, ...sizes);
  return { components: sizes.length, largest, largestShare: n ? r4(largest / n) : 0 };
}
/** 重构图的子图统计（只保留 keep 为真的节点、只走保留节点之间的边） */
function subgraph(graph, world, keep) {
  const ids = graph.nodes.filter(keep).map((n) => n.id), local = new Map(ids.map((id, k) => [id, k]));
  const c = componentsOf(ids.length, (k) => graph.adj[ids[k]].map((e) => local.get(e.to)).filter((x) => x !== undefined));
  const covered = ids.filter((id) => graph.nodes[id].floor < world.top(graph.nodes[id].cell)).length;
  return { nodes: ids.length, ...c, covered };
}
function wholeGraph(graph, world) { return subgraph(graph, world, () => true); }

/* ---------------------------------------------------------------- 奶酪（cheesenav） */
export function cheeseWorld(ch) {
  const env = stripWorld(ch.w, ch.d), idx = (x, y, z) => (z * ch.h + y) * ch.w + x;
  for (let z = 0; z < ch.d; z++) for (let x = 0; x < ch.w; x++) {
    const levels = []; for (let y = 0; y < ch.h; y++) if (ch.solid[idx(x, y, z)]) levels.push(y + 1);   // 体素 y → World 第 y+1 层
    const c = env.at(x, z), m = maskOf(levels); env.world.solid[c.id] = m; env.world.rock[c.id] = m;
  }
  env.world.touch();
  return env;
}
function cheeseOriginal(ch) {
  const { w, h, d, solid } = ch, nav = navNodes(ch), idx = (x, y, z) => (z * h + y) * w + x;
  const pos = (c) => [c % w, ((c / w) | 0) % h, (c / (w * h)) | 0];
  const local = new Map(nav.nodes.map((c, k) => [c, k]));
  const NB6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  // cheesenav.findPath 的同一判据：6 邻接、边界 1..w−2 / 1..h−2 / 1..d−2、两端都是可站格
  const comp = componentsOf(nav.nodes.length, (k) => {
    const [x, y, z] = pos(nav.nodes[k]), out = [];
    for (const [dx, dy, dz] of NB6) { const nx = x + dx, ny = y + dy, nz = z + dz; if (nx < 1 || ny < 1 || nz < 1 || nx >= w - 1 || ny >= h - 1 || nz >= d - 1) continue; const j = local.get(idx(nx, ny, nz)); if (j !== undefined) out.push(j); }
    return out;
  });
  let covered = 0;
  for (const c of nav.nodes) { const [x, y, z] = pos(c); for (let yy = y + 1; yy < h; yy++) if (solid[idx(x, yy, z)]) { covered++; break; } }
  return { nodes: nav.nodes.length, ...comp, covered };
}
export function cheeseCase(opts = PARITY_INPUTS.cheese) {
  const ch = carveCheese({ ...opts }), env = cheeseWorld(ch);
  const original = cheeseOriginal(ch);
  // 同判据：净空 3 层（原版：脚下实心 + 本格与上面两格是空气）、只走同层（原版没有上下可站的邻格）、去掉原版不算的外壳
  const g = buildLayeredNav(env.world, { headroom: 3, maxStep: 0 });
  const same = subgraph(g, env.world, (n) => n.cell.i >= 1 && n.cell.i <= ch.w - 2 && n.cell.j >= 1 && n.cell.j <= ch.d - 2 && n.floor >= 1 && n.floor <= ch.h - 3);
  const battle = wholeGraph(makeNav(env).graph, env.world);
  return { id: 'cheese', title: '瑞士奶酪（cheesenav.carveCheese）', input: { fn: 'carveCheese', ...opts }, original, sameCriteria: same, battleCriteria: battle };
}

/* ---------------------------------------------------------------- 门洞（holenav） */
export function holesWorld(ch) {
  const env = stripWorld(ch.W, ch.D);
  for (let z = 0; z < ch.D; z++) for (let x = 0; x < ch.W; x++) {
    const k = ch.at(x, z), levels = ch.door[k] ? [1, 3, 4] : ch.solid[k] ? [1, 2, 3, 4] : [1];   // 墙 4 层；门洞 = 第 2 层空、3–4 层是门楣
    const c = env.at(x, z), m = maskOf(levels); env.world.solid[c.id] = m; env.world.rock[c.id] = m;
  }
  env.world.touch();
  return env;
}
function holesOriginal(ch) {
  const g = buildPortalGraph(ch);
  return { g, stats: { nodes: g.nodes.length, ...componentsOf(g.nodes.length, (i) => g.adj[i].map((e) => e.to)), covered: g.doorCells.size } };
}
export function holesCase(opts = PARITY_INPUTS.holes, { pairs = PARITY_INPUTS.pairs, pairSeed = PARITY_INPUTS.pairSeed } = {}) {
  const ch = makeCheese({ ...opts }), env = holesWorld(ch), { g, stats: original } = holesOriginal(ch);
  const same = subgraph(buildLayeredNav(env.world, { headroom: 1, maxStep: 0 }), env.world, (n) => n.floor === 1);
  const nav = makeNav(env), battle = wholeGraph(nav.graph, env.world);
  // 路线代价：同一对起终点，原版 route()（只在走进门洞格时 ×1.35）对重构版 BattleNavigation 的图（碰到拱下节点的边 ×doorCost）
  const rnd = rng(pairSeed); let n = 0, both = 0, differ = 0, sumRatio = 0, maxRatio = 0, minRatio = Infinity, reachMismatch = 0;
  for (let k = 0; k < pairs; k++) {
    const a = g.nodes[(rnd() * g.nodes.length) | 0], b = g.nodes[(rnd() * g.nodes.length) | 0];
    if (a === b) continue; n++;
    const ro = route(g, a, b), na = nav.graph.at(env.at(a.x, a.z), 1), nb = nav.graph.at(env.at(b.x, b.z), 1);
    const rr = na >= 0 && nb >= 0 ? nav.graph.search(na, nb) : { distance: Infinity };
    const okO = !!ro.reachable, okR = Number.isFinite(rr.distance);
    if (okO !== okR) { reachMismatch++; continue; }
    if (!okO) continue;
    both++; const ratio = rr.distance / ro.dist; sumRatio += ratio; maxRatio = Math.max(maxRatio, ratio); minRatio = Math.min(minRatio, ratio);
    if (Math.abs(rr.distance - ro.dist) > 1e-9) differ++;
  }
  const routes = { pairs: n, reachableBoth: both, reachMismatch, differ, meanRatio: both ? r4(sumRatio / both) : null, minRatio: both ? r4(minRatio) : null, maxRatio: both ? r4(maxRatio) : null, doorCost: nav.doorCost };
  return { id: 'holes', title: '门洞图（holenav.makeCheese）', input: { fn: 'makeCheese', ...opts, pairs, pairSeed }, original, sameCriteria: same, battleCriteria: battle, routes };
}

/* ---------------------------------------------------------------- 差异 → 缺口 */
const METRICS = ['nodes', 'components', 'largestShare', 'covered'];
const METRIC_NAME = { nodes: '可站节点数', components: '连通块数', largestShare: '最大块占比', covered: '被覆盖节点数' };
const DESIGN_NOTE = {
  cheese: {
    nodes: '战役判据按 1 层净空（士兵身高 0.18 < 半层 0.5）取可站点，原版要头顶两格空气；外壳顶面在重构版里也算可站。',
    components: '战役判据允许 1–2 层的台阶边（maxStep 2），原版只走同一层；外壳顶面连成一块。',
    largestShare: '同上：台阶边与外壳顶面把碎块并进了大块。',
    covered: '净空要求变低后，更多矮洞里的点被算成可站的洞道节点。',
  },
  holes: {
    nodes: '战役判据把墙顶与门楣顶也算成可站点（原版墙不可站）。',
    components: '墙顶 / 门楣顶连成的走道在重构版里是另外的连通块。',
    largestShare: '同上：节点总数变多，最大块占比被摊薄。',
    covered: '墙顶节点头上没有实心，不影响被覆盖数；若不一致说明门洞判定不同。',
  },
};
export function diffsOf(cases) {
  const out = [];
  for (const c of cases) for (const m of METRICS) {
    const o = c.original[m], s = c.sameCriteria[m], b = c.battleCriteria[m];
    if (o !== s) out.push({ id: `${c.id}.same.${m}`, case: c.id, criteria: 'same', metric: m, original: o, refactored: s, kind: 'gap', note: `同判据下${METRIC_NAME[m]}不一致：不是口径问题，是两份实现对同一座岛给出不同结果，要查。` });
    if (o !== b) out.push({ id: `${c.id}.battle.${m}`, case: c.id, criteria: 'battle', metric: m, original: o, refactored: b, kind: 'design', note: DESIGN_NOTE[c.id]?.[m] || '战役判据与原版口径不同。' });
  }
  for (const c of cases) if (c.routes) {
    const r = c.routes;
    if (r.reachMismatch) out.push({ id: `${c.id}.routes.reach`, case: c.id, criteria: 'battle', metric: 'reachable', original: r.pairs - r.reachMismatch, refactored: r.pairs, kind: 'gap', note: `${r.reachMismatch} 对起终点一边能到、另一边到不了。` });
    if (r.differ) out.push({ id: `${c.id}.routes.cost`, case: c.id, criteria: 'battle', metric: 'routeCost', original: 1, refactored: r.meanRatio, kind: 'gap', note: `门洞加价口径不同：原版 holenav 只在走进门洞格时 ×1.35，重构版 BattleNavigation 凡是碰到拱下节点的边（进、出、洞里）都 ×${r.doorCost}；${r.differ}/${r.reachableBoth} 对路线代价不同（比值 ${r.minRatio}–${r.maxRatio}，均值 ${r.meanRatio}）。穿单个门洞时重构版多罚一次，绕另一个门更容易被选中。` });
  }
  return out;
}

/** 跑完整对照，返回登记文档（capability 字段由写文件的脚本按能力 ID 填）。 */
export function runNavParity({ cheese = PARITY_INPUTS.cheese, holes = PARITY_INPUTS.holes, pairs = PARITY_INPUTS.pairs, pairSeed = PARITY_INPUTS.pairSeed } = {}) {
  const cases = [cheeseCase(cheese), holesCase(holes, { pairs, pairSeed })];
  const diffs = diffsOf(cases);
  const sameEqual = cases.every((c) => METRICS.every((m) => c.original[m] === c.sameCriteria[m]));
  return {
    schemaVersion: 1, line: 'navigation', parityVersion: NAV_PARITY_VERSION,
    verdict: diffs.length ? 'diff-registered' : 'equivalent',
    sameCriteriaEqual: sameEqual,
    original: ORIGINAL_FILES.slice(), refactored: REFACTORED_FILES.slice(), clips: PARITY_CLIPS.slice(),
    inputs: { cheese: { ...cheese }, holes: { ...holes }, pairs, pairSeed },
    metrics: METRICS.map((m) => ({ id: m, name: METRIC_NAME[m] })),
    cases: cases.map((c) => ({ id: c.id, title: c.title, input: c.input, original: c.original, sameCriteria: c.sameCriteria, battleCriteria: c.battleCriteria, ...(c.routes ? { routes: c.routes } : {}) })),
    diffs,
    gaps: diffs.filter((d) => d.kind === 'gap').length,
    decisions: [{ id: 'navigation:design', decided: 'keep-battle-criteria', at: '2026-11-25', note: '战役判据与原版口径不同处定案保留：细粒度导航图是刻意的战役功能差异，向原版口径靠拢会退化可达性表达。design diffs 继续登记，不再作为补学需求。' }],
    basis: '同一座岛（固定种子）喂给原版与重构版；「同判据」一致只说明这几个统计量在这两座岛上一致，不代表任意输入等价；「战役判据」是游戏里 BattleNavigation 的默认参数。',
  };
}

/** 补学队列需求行（export-learn-queue 的 demand 格式 [{id,name,clips,reason}]）：每条缺口一行；口径差异（design）也登记，但只记一行汇总。 */
export function parityDemand(doc) {
  const rows = doc.diffs.filter((d) => d.kind === 'gap').map((d) => ({ id: 'parity:navigation:' + d.id, name: '原版对照缺口·' + (METRIC_NAME[d.metric] || d.metric), clips: doc.clips.slice(), reason: d.note, source: 'parity', parity: 'TigerMessenger/src/scene-authoring/catalog/parity/navigation.json#' + d.id }));
  // 战役判据与原版口径不同（design kind）已在 doc.diffs / doc.decisions 逐条登记；2026-11-25 定案保留：
  // 细粒度导航图是刻意的战役功能差异，向原版口径靠拢会退化可达性表达，不再作为补学需求行。

  return rows;
}
