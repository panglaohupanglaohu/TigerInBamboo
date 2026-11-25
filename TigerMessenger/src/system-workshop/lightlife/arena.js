/**
 * 光影与生命管线 · 擂台（R65–R68 能力的 ⑦ 证据）：每个能力在固定种子的合成岛上「加这一代 vs 不加」各跑一次，按写死的规则判输赢。
 * 口径与地貌擂台（relief/arena.js）相同：上一代 = 排在它前面的能力（不含它），这一代 = 前面的 + 它；第一代的上一代是 baseline（原合成岛，不跑任何能力）。
 *   prev / next 都是同一颗 syntheticSite(LIGHTLIFE_ARENA_SEED) 上 runPlan + verifyLightLife 的实测指标（lightlifeMetrics，缺项记 0）。
 * 规则先定后量：要变好的指标 + 守护指标 + 容差写在 ARENA_RULES 里，不按结果回头改。
 *   better = 这一代自己该产出的量（相对没有它时的 0 / 缺项）；guard = 前面能力的产出与验证检查不许退步（同一份确定性计算，容差 0 = 必须一字不差）。
 *   life.* 三个能力没有逐能力的数值质量指标可比，better 用它们的产出计数 / 覆盖率，正确性由 verifyLightLife 的专项检查（风不进实心 / 烟序 / 动物留陆地）经 checksFail 守护。
 * 登记表 TigerMessenger/src/scene-authoring/catalog/arena/<能力ID>.json 由 tools/refactor/record-lightlife-arena.mjs 实算写入（唯一写入方）；
 * 测试 tests/lightlife-arena.test.mjs：① 这一代必须赢；② 登记过成绩后，任何改动让任一规则指标比登记的差过该指标自己的容差 → 红。
 */
import { LIGHTLIFE_CAPABILITIES, runPlan, seedMetricsOf } from './capabilities.js';
import { verifyLightLife } from './verify.js';
import { syntheticSite } from './scene-voxels.js';
import { judge } from '../terrain/arena-generic.js';

export const LIGHTLIFE_ARENA_SEED = 20261123;
export const LIGHTLIFE_ORDER = LIGHTLIFE_CAPABILITIES.map((c) => c.meta.id);
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/**
 * 一次 runPlan + verifyLightLife 的全量数值指标（缺项 = 0；prev 没跑的能力在 next 里也没有对应产出时两边都是 0）。
 * 区域图 / 遮蔽 / 反弹 / 大纹理 / 植物 / 风 / 烟 / 动物各自的产出量 + verifyLightLife 的 pass / warn / fail 计数 + applied 计数。
 */
export function lightlifeMetrics(site, report, verify) {
  const P = site.plan || {}, m = P.metrics || {}, s = seedMetricsOf(P), t = P.town || {}, mt = P.megatex || {}, pl = P.plants || {};
  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const c of verify?.checks || []) counts[c.status === 'pass' ? 'pass' : c.status === 'warn' ? 'warn' : 'fail']++;
  const num = (v) => (Number.isFinite(v) ? v : 0);
  const corner = num(s.corner), open = num(s.open);
  return {
    townRegions: num(t.regions), townBuildings: num(t.buildings), townWalkways: num(t.walkways), townLargest: num(t.largest), townChimneys: (t.chimneys || []).length,
    aoMean: num(s.aoMean), aoOpen: open, aoCorner: corner, aoTouched: num(m.ao?.touched), aoContrast: r4(corner - open),
    tintShift: num(s.tintShift), hueShifted: num(m.bounce?.hueShifted),
    megaOccupancy: num(mt.occupancy ?? s.megaOccupancy), megaExact: num(mt.exactRate), megaBleed: num(mt.bleedRate), megaMip1: num(mt.mip1Bleed), megaFaces: num(mt.faces),
    plantCoverage: num(s.plantCoverage), plantUsed: (pl.used || []).length, plantInstances: num(pl.instances),
    windLines: num(s.windLines), windBlocked: num(m.wind?.windBlocked), windInside: num(m.wind?.windInside), windRise: num(m.wind?.windRise),
    smokeSources: num(m.smoke?.smokeSources), smokePuffs: num(s.smokePuffs), smokeRise: num(m.smoke?.smokeRise),
    animals: num(m.animals?.animals), animalsOnLand: num(s.animalsOnLand), animalsLeft: num(m.animals?.animalsLeft), animalsTravel: num(m.animals?.animalsTravel),
    plateauRuns: num(m.plateau?.runs), plateauLevels: num(m.plateau?.levels), plateauLargest: num(m.plateau?.largest),
    stepEdges: num(m.plateau?.stepEdges), stepLand: num(m.plateau?.stepLand), stepArea: num(m.plateau?.stepArea),
    checksPass: counts.pass, checksWarn: counts.warn, checksFail: counts.fail,
    applied: (report || []).filter((r) => r.status === 'applied').length,
  };
}

/** 规则先定后量：better = 该能力应改善的产出（相对没有它时的 0）；guard = 前面能力的产出与验证计数不许退步（容差 0 = 确定性一字不差）。 */
export const ARENA_RULES = Object.freeze({
  'scene.town-graph': {
    better: [{ key: 'townBuildings', dir: 1, tol: 0 }, { key: 'townRegions', dir: 1, tol: 0 }],
    guard: [{ key: 'checksFail', dir: -1, tol: 0 }, { key: 'checksWarn', dir: -1, tol: 0 }, { key: 'checksPass', dir: 1, tol: 0 }] },
  'light.voxel-ao': {
    better: [{ key: 'aoCorner', dir: 1, tol: 0.02 }, { key: 'aoMean', dir: 1, tol: 0.02 }],
    guard: [{ key: 'townBuildings', dir: 1, tol: 0 }, { key: 'townRegions', dir: 1, tol: 0 }, { key: 'checksFail', dir: -1, tol: 0 }, { key: 'checksWarn', dir: -1, tol: 0 }] },
  'light.bounce': {
    better: [{ key: 'tintShift', dir: 1, tol: 0.005 }, { key: 'hueShifted', dir: 1, tol: 0.001 }],
    guard: [{ key: 'aoCorner', dir: 1, tol: 0 }, { key: 'aoMean', dir: 1, tol: 0 }, { key: 'checksFail', dir: -1, tol: 0 }, { key: 'checksWarn', dir: -1, tol: 0 }] },
  'light.megatex': {
    better: [{ key: 'megaExact', dir: 1, tol: 0.01 }, { key: 'megaOccupancy', dir: 1, tol: 0.01 }],
    guard: [{ key: 'megaBleed', dir: -1, tol: 0.001 }, { key: 'tintShift', dir: 1, tol: 0 }, { key: 'checksFail', dir: -1, tol: 0 }, { key: 'checksWarn', dir: -1, tol: 0 }] },
  'life.plant-atlas': {
    better: [{ key: 'plantCoverage', dir: 1, tol: 0.1 }, { key: 'plantUsed', dir: 1, tol: 0 }],
    guard: [{ key: 'megaExact', dir: 1, tol: 0 }, { key: 'megaOccupancy', dir: 1, tol: 0 }, { key: 'checksFail', dir: -1, tol: 0 }, { key: 'checksWarn', dir: -1, tol: 0 }] },
  'life.wind': {
    better: [{ key: 'windLines', dir: 1, tol: 2 }],
    guard: [{ key: 'windInside', dir: -1, tol: 0 }, { key: 'plantCoverage', dir: 1, tol: 0 }, { key: 'checksFail', dir: -1, tol: 0 }, { key: 'checksWarn', dir: -1, tol: 0 }] },
  'life.smoke': {
    better: [{ key: 'smokePuffs', dir: 1, tol: 10 }, { key: 'smokeSources', dir: 1, tol: 0 }],
    guard: [{ key: 'windLines', dir: 1, tol: 0 }, { key: 'windInside', dir: -1, tol: 0 }, { key: 'checksFail', dir: -1, tol: 0 }, { key: 'checksWarn', dir: -1, tol: 0 }] },
  'life.animals': {
    better: [{ key: 'animalsOnLand', dir: 1, tol: 0.1 }, { key: 'animals', dir: 1, tol: 1 }],
    guard: [{ key: 'animalsLeft', dir: -1, tol: 0 }, { key: 'smokePuffs', dir: 1, tol: 0 }, { key: 'checksFail', dir: -1, tol: 0 }, { key: 'checksWarn', dir: -1, tol: 0 }] },
  'scene.plateau-diag': {
    better: [{ key: 'plateauRuns', dir: 1, tol: 0 }, { key: 'stepEdges', dir: 1, tol: 0 }],
    guard: [{ key: 'animalsOnLand', dir: 1, tol: 0 }, { key: 'checksFail', dir: -1, tol: 0 }, { key: 'checksWarn', dir: -1, tol: 0 }] },
});

function runSteps(site, steps) {
  const report = runPlan(site, steps);
  const verify = verifyLightLife(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) });
  return { report, verify, metrics: lightlifeMetrics(site, report, verify) };
}

/** 一个能力的擂台：prev = 排在它前面的能力（不含它），next = 前面的 + 它 */
export function runArena(id, { seed = LIGHTLIFE_ARENA_SEED } = {}) {
  const rule = ARENA_RULES[id]; if (!rule) throw Error('没有擂台规则：' + id);
  const cap = LIGHTLIFE_CAPABILITIES.find((c) => c.meta.id === id), pos = LIGHTLIFE_ORDER.indexOf(id);
  const prefix = LIGHTLIFE_CAPABILITIES.slice(0, pos).map((c) => ({ id: c.meta.id })), withIt = [...prefix, { id }];
  const sPrev = syntheticSite(seed), sNext = syntheticSite(seed);
  const a = runSteps(sPrev, prefix), b = runSteps(sNext, withIt);
  const verdict = judge(a.metrics, b.metrics, rule);
  return { capability: id, line: cap.meta.line, beat: prefix.length ? prefix.map((s) => s.id).join('+') : 'baseline',
    arena: { seed, n: sNext.n, step: sNext.step, L: sNext.L, generator: 'lightlife/scene-voxels.js syntheticSite' },
    rule, prev: a.metrics, next: b.metrics, judge: verdict, pass: verdict.pass,
    verify: { prev: a.verify.status, next: b.verify.status },
    planSummary: { applied: b.report.filter((r) => r.status === 'applied').map((r) => r.id), steps: withIt.map((s) => s.id) } };
}

/** 回归：现在算出来的这一代 vs 登记表里记的这一代，任一规则指标比登记的差过该指标自己的 tol → 列出来（guard 的 tol 0 = 必须一字不差） */
export function regressions(now, recorded, rule) {
  if (!recorded) return [];
  const out = [];
  for (const r of [...(rule.better || []), ...(rule.guard || [])]) {
    const a = recorded[r.key], b = now[r.key]; if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if ((b - a) * r.dir < -r.tol) out.push({ key: r.key, recorded: a, now: b, tol: r.tol });
  }
  return out;
}
