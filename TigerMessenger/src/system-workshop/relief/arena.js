/**
 * 地貌管线 · 擂台（R47，创新 3 制度化）：每个地貌能力在固定种子的测试岛上「加这一代 vs 不加」各跑一次，按写死的规则判输赢。
 * 上一代 = 同一条管线去掉这个能力（只保留排在它前面的能力）；第一代的上一代是 baseline（原采样）。
 * 规则先定后量：要变好的指标 + 守护指标 + 容差都写在 ARENA_RULES 里，不按结果回头改。
 * 登记表 TigerMessenger/src/scene-authoring/catalog/arena/<能力ID>.json 由 tools/refactor/record-relief-evidence.mjs 实算写入（唯一写入方）；
 * 测试 tests/relief-arena.test.mjs：① 这一代必须赢；② 登记过成绩后，任何改动让任一指标比登记的成绩差过容差 → 红。
 */
import { RELIEF_ORDER, runPlan } from './capabilities.js';
import { arenaSite, reliefMetrics, judge, ARENA_SEED } from '../terrain/arena-generic.js';
import { interpContour, rowsOf } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/island-passes.js';

export const ARENA_RULES = Object.freeze({
  'relief.soft': { better: [{ key: 'rough', dir: -1, tol: 0.01 }], guard: [{ key: 'hardEdge', dir: -1, tol: 0.05 }, { key: 'drainage', dir: 1, tol: 0.01 }] },
  'relief.cliff': { better: [{ key: 'flat', dir: 1, tol: 0.005 }, { key: 'cliff', dir: 1, tol: 0.005 }], guard: [{ key: 'hardEdge', dir: -1, tol: 0.05 }] },
  'relief.valley': { better: [{ key: 'drainage', dir: 1, tol: 0.005 }, { key: 'pits', dir: -1, tol: 0 }], guard: [{ key: 'hardEdge', dir: -1, tol: 0.05 }] },
  'relief.overhang': { better: [{ key: 'overhang', dir: 1, tol: 0 }], guard: [{ key: 'midSlope', dir: 1, tol: 0 }, { key: 'drainage', dir: 1, tol: 0 }, { key: 'hardEdge', dir: -1, tol: 0 }] },
  'relief.ledge': { better: [{ key: 'climb', dir: 1, tol: 0.005 }], guard: [{ key: 'drainage', dir: 1, tol: 0 }, { key: 'hardEdge', dir: -1, tol: 0 }] },
  'relief.passes': { better: [{ key: 'contour', dir: 1, tol: 0.5 }], guard: [{ key: 'drainage', dir: 1, tol: 0 }] },
});
/** 登记成绩之后的回归容差（任何一项比登记的这一代差过它 → 测试红） */
export const REGRESSION_TOL = 0.002;

/** 粗糙度：自由陆地格的 |离散拉普拉斯| 均值（米）。软坡要让它变小。 */
export function roughness(h, n, cls = null) {
  let s = 0, c = 0;
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const k = j * n + i, v = h[k]; if (!(v > 0) || cls?.[k]) continue;
    const nb = [h[k - 1], h[k + 1], h[k - n], h[k + n]]; if (!nb.every((x) => x > 0)) continue;
    s += Math.abs(nb.reduce((a, b) => a + b, 0) / 4 - v); c++;
  }
  return c ? +(s / c).toFixed(4) : 0;
}

function measurePlan(site, plan, { interp = false } = {}) {
  const h = plan ? plan.h : site.h, n = site.n;
  let contours = plan?.contours || null;
  if (interp) {
    // 上一代的等高线 = marching squares 中点插值（原版 islandpasses 的反面对照）：端点都落在半格上，在格边上的比例 = 0
    const step = plan?.step || 3, rows = rowsOf(h.map((v) => (v == null ? NaN : v)), n, 0), segs = [];
    for (let t = step; t < 200; t += step) { const s = interpContour(rows, t); if (!s.length && t > 60) break; segs.push(...s); }
    const on = segs.filter(([a, b]) => [...a, ...b].every(Number.isInteger)).length;
    contours = { onGrid: segs.length ? on / segs.length : 0 };
  }
  const m = reliefMetrics({ n, cell: site.cell, h, base: site.h, cls: site.cls, lips: plan?.lips || [], ladders: plan?.ladders || [], contours });
  return { ...m, rough: roughness(h.map((v) => (v == null ? NaN : v)), n, site.cls) };
}

/** 一个能力的擂台：prev = 排在它前面的能力（不含它），next = 前面的 + 它 */
export function runArena(id, { seed = ARENA_SEED } = {}) {
  const rule = ARENA_RULES[id]; if (!rule) throw Error('没有擂台规则：' + id);
  const pos = RELIEF_ORDER.indexOf(id), prefix = RELIEF_ORDER.slice(0, pos).map((x) => ({ id: x })), withIt = [...prefix, { id }];
  const sPrev = arenaSite(seed), sNext = arenaSite(seed);
  if (prefix.length) runPlan(sPrev, prefix);
  runPlan(sNext, withIt);
  const prev = measurePlan(sPrev, sPrev.plan || null, { interp: id === 'relief.passes' });
  const next = measurePlan(sNext, sNext.plan);
  const verdict = judge(prev, next, rule);
  return { capability: id, line: 'terrain', beat: prefix.length ? prefix.map((s) => s.id).join('+') : 'baseline', arena: { seed, n: sNext.n, cell: sNext.cell, generator: 'terrain/arena-generic.js arenaSite' }, rule, prev, next, judge: verdict, pass: verdict.pass, plan: sNext.plan };
}

/** 回归：现在算出来的这一代 vs 登记表里记的这一代，任一规则指标差过 REGRESSION_TOL（坑：差过 0 格）→ 列出来 */
export function regressions(now, recorded, rule) {
  if (!recorded) return [];
  const out = [];
  for (const r of [...(rule.better || []), ...(rule.guard || [])]) {
    const a = recorded[r.key], b = now[r.key]; if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const tol = r.key === 'pits' ? 0 : REGRESSION_TOL;
    if ((b - a) * r.dir < -tol) out.push({ key: r.key, recorded: a, now: b });
  }
  return out;
}
