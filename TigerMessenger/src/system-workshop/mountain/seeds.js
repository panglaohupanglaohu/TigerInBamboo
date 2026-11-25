/**
 * R28 多种子分布报告（Guide §1.4 创新 6）：同一条山形管线（6 个能力、默认参数）只换噪声种子跑 30 次，
 * 看指标分布，挑出最好 / 最差 / 最典型三座。纯数据（Node / Worker 共用）；一张好看的截图可能是运气，分布不会。
 *   种子 s（1..30）：mountain.massif.seed = s，mountain.rolling.seed = (s × 37) mod 1000；其余参数全是默认。
 *   每座：evolve.evaluate（runPlan + 独立 verifyMountain，分数只用验证指标）+ arena.terrainMetrics（排水率 / 硬边位移）。
 *   最好 = 过硬检查里分数最高；最差 = 全部里分数最低（没过硬检查的 = −1，最差）；
 *   最典型 = 过硬检查里，各指标离中位数的标准化距离（÷ p90−p10）平方和最小的一座。
 */
import { defaultGenome, evaluate } from './evolve.js?v=evolve-r25';
import { terrainMetrics } from './arena.js?v=arena-r26';
export const SEEDS_VERSION = 1;
export const SEED_METRICS = [
  { key: 'mid', label: '中等坡', unit: '%', better: 'higher' }, { key: 'cliff', label: '竖崖', unit: '%', better: 'lower' },
  { key: 'drain', label: '排水率', unit: '%', better: 'higher' }, { key: 'hardEdge', label: '硬边位移', unit: 'm', better: 'lower' },
  { key: 'prominence', label: '主峰高出中位', unit: 'm', better: 'higher' }, { key: 'top', label: '最高点', unit: 'm', better: 'higher' },
];
export function seedGenome(s) { const g = defaultGenome(); g['mountain.massif'].seed = Math.max(1, Math.min(99, s)); g['mountain.rolling'].seed = (s * 37) % 1000; return g; }

/** 逐座生成（Worker 边算边回传）。keepPlans = 每行都带 plan（Node 报告默认不带，只给三张代表带） */
export function* runSeeds(field, { count = 30, from = 1, keepPlans = false } = {}) {
  for (let s = from; s < from + count; s++) {
    const e = evaluate(field, seedGenome(s)), t = terrainMetrics(field, e.plan);
    yield { seed: s, score: e.score, status: e.status, hard: e.hard, warn: e.warn, metrics: { mid: t.mid, cliff: t.cliff, drain: t.drain, hardEdge: t.hardEdge, prominence: t.prominence, top: t.top }, ms: e.ms, ...(keepPlans ? { plan: e.plan } : {}) };
  }
}
const quant = (sorted, p) => { if (!sorted.length) return null; const x = (sorted.length - 1) * p, i = Math.floor(x), f = x - i; return sorted[i] + (sorted[Math.min(sorted.length - 1, i + 1)] - sorted[i]) * f; };
const r4 = (v) => (v == null ? null : Math.round(v * 10000) / 10000);
/** 每项指标：min / p10 / 中位 / p90 / max / 均值 + 10 档直方图 */
export function distribution(rows) {
  const out = {};
  for (const { key } of SEED_METRICS) {
    const v = rows.map((r) => r.metrics?.[key]).filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) { out[key] = null; continue; }
    const lo = v[0], hi = v.at(-1), bins = new Array(10).fill(0); for (const x of v) bins[hi > lo ? Math.min(9, Math.floor((x - lo) / (hi - lo) * 10)) : 0]++;
    out[key] = { min: r4(lo), p10: r4(quant(v, 0.1)), median: r4(quant(v, 0.5)), p90: r4(quant(v, 0.9)), max: r4(hi), mean: r4(v.reduce((s, x) => s + x, 0) / v.length), bins };
  }
  return out;
}
export function pickThree(rows, dist = distribution(rows)) {
  const ok = rows.filter((r) => r.score >= 0), by = (a, b) => b.score - a.score || a.seed - b.seed;
  const best = [...ok].sort(by)[0] || null, worst = [...rows].sort((a, b) => a.score - b.score || a.seed - b.seed)[0] || null;
  let typical = null, bestD = Infinity;
  for (const r of ok) { let d = 0; for (const { key } of SEED_METRICS) { const s = dist[key]; if (!s) continue; const w = (s.p90 - s.p10) || 1; d += ((r.metrics[key] - s.median) / w) ** 2; } if (d < bestD - 1e-12) { bestD = d; typical = r; } }
  return { best: best?.seed ?? null, worst: worst?.seed ?? null, typical: typical?.seed ?? null, typicalDistance: Number.isFinite(bestD) ? r4(bestD) : null };
}
/** 一次跑完（Node 报告与测试用） */
export function seedReport(field, opts = {}) {
  const rows = [...runSeeds(field, opts)], dist = distribution(rows), pick = pickThree(rows, dist);
  return { version: SEEDS_VERSION, count: rows.length, passed: rows.filter((r) => r.score >= 0).length, rows, distribution: dist, pick };
}
