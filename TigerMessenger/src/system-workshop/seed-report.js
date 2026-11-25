/**
 * seed-report.js — 多种子分布报告，推广到所有管线层（Guide §1.4 创新 6「看分布，不看单张」· R61）。纯逻辑：Node / Worker / 浏览器共用，不读文件。
 *
 * R28 先在山形管线做了一份（mountain/seeds.js，本文件不改它）；这里把同一套「N 个种子 → 指标分布 → 最好 / 最差 / 最典型」抽成通用件。
 * 任何「run 是纯函数」的层只要给一个适配器（seed-layers.js 里登记）就能出报告：
 *   adapter = { layer, label, metrics:[{ key, label, unit, better:'higher'|'lower'|'none' }],
 *               runSeed(input, s) → { score, status, metrics:{ key: number }, note? } }
 * 算法与 R28 完全一致（单元测试里拿同一批行喂两边，答案必须相同）：
 *   分布   每项指标 min / p10 / 中位 / p90 / max / 均值 + 10 档直方图（线性插值分位数）。
 *   最好   没判失败（score ≥ 0）的里面分数最高；同分取种子小的。
 *   最差   全部里分数最低（判失败 = −1，排最差）；同分取种子小的。
 *   最典型 没判失败的里面，各指标离中位数的标准化距离（÷ (p90 − p10)，为 0 时 ÷ 1）平方和最小的一个。
 * 浏览器才拿得到输入的层（例如体素场景层：输入是游戏 iframe 里的体素世界）用 notRunReport 如实写 NOT_RUN 与原因，不编数。
 */
export const SEED_REPORT_VERSION = 1;
export const DEFAULT_SEED_COUNT = 30;
export const STATUS = Object.freeze({ RUN: 'RUN', NOT_RUN: 'NOT_RUN' });

const quant = (sorted, p) => { if (!sorted.length) return null; const x = (sorted.length - 1) * p, i = Math.floor(x), f = x - i; return sorted[i] + (sorted[Math.min(sorted.length - 1, i + 1)] - sorted[i]) * f; };
const r4 = (v) => (v == null ? null : Math.round(v * 10000) / 10000);
const keysOf = (metrics) => (metrics || []).map((m) => (typeof m === 'string' ? m : m.key));

/** 每项指标的分布：min / p10 / 中位 / p90 / max / 均值 + 10 档直方图。没有有效值的指标给 null。 */
export function distribution(rows, metrics) {
  const out = {};
  for (const key of keysOf(metrics)) {
    const v = rows.map((r) => r.metrics?.[key]).filter(Number.isFinite).sort((a, b) => a - b);
    if (!v.length) { out[key] = null; continue; }
    const lo = v[0], hi = v.at(-1), bins = new Array(10).fill(0);
    for (const x of v) bins[hi > lo ? Math.min(9, Math.floor((x - lo) / (hi - lo) * 10)) : 0]++;
    out[key] = { min: r4(lo), p10: r4(quant(v, 0.1)), median: r4(quant(v, 0.5)), p90: r4(quant(v, 0.9)), max: r4(hi), mean: r4(v.reduce((s, x) => s + x, 0) / v.length), bins };
  }
  return out;
}

/** 最好 / 最差 / 最典型（返回种子号；没有行时全是 null）。 */
export function pickThree(rows, metrics, dist = distribution(rows, metrics)) {
  const ok = rows.filter((r) => r.score >= 0), by = (a, b) => b.score - a.score || a.seed - b.seed;
  const best = [...ok].sort(by)[0] || null, worst = [...rows].sort((a, b) => a.score - b.score || a.seed - b.seed)[0] || null;
  let typical = null, bestD = Infinity;
  for (const r of ok) {
    let d = 0;
    for (const key of keysOf(metrics)) { const s = dist[key]; if (!s) continue; const w = (s.p90 - s.p10) || 1, x = r.metrics?.[key]; if (!Number.isFinite(x)) continue; d += ((x - s.median) / w) ** 2; }
    if (d < bestD - 1e-12) { bestD = d; typical = r; }
  }
  return { best: best?.seed ?? null, worst: worst?.seed ?? null, typical: typical?.seed ?? null, typicalDistance: Number.isFinite(bestD) ? r4(bestD) : null };
}

/** 验证结果 → 通用分数：判失败 = −1；否则 (通过 + 0.5 × 提醒) / 总项 × 100（两位小数）。 */
export function verificationScore(v) {
  const checks = v?.checks || [];
  if (!checks.length) return v?.status === 'fail' ? -1 : 0;
  if (v.status === 'fail' || checks.some((c) => c.status === 'fail')) return -1;
  const pass = checks.filter((c) => c.status === 'pass').length, warn = checks.filter((c) => c.status === 'warn').length;
  return Math.round((pass + 0.5 * warn) / checks.length * 10000) / 100;
}
/** 验证结果 → 三个通用指标：通过占比、提醒数、失败数。 */
export function verificationMetrics(v) {
  const checks = v?.checks || [], n = checks.length || 1;
  return { passShare: r4(checks.filter((c) => c.status === 'pass').length / n), warns: checks.filter((c) => c.status === 'warn').length, fails: checks.filter((c) => c.status === 'fail').length };
}
export const VERIFY_METRICS = Object.freeze([
  { key: 'passShare', label: '检查通过占比', unit: '%', better: 'higher' },
  { key: 'warns', label: '提醒项', unit: '项', better: 'lower' },
  { key: 'fails', label: '失败项', unit: '项', better: 'lower' },
]);

/** 逐个种子跑（Worker 边算边回传）。某个种子抛错 = 这一座判失败（score −1、status 'error'），不中断整批。 */
export function* runLayerSeeds(adapter, input, { count = DEFAULT_SEED_COUNT, from = 1 } = {}) {
  if (!adapter || typeof adapter.runSeed !== 'function') throw new TypeError('分布报告需要带 runSeed 的适配器');
  for (let s = from; s < from + count; s++) {
    const t0 = Date.now(); let r;
    try { r = adapter.runSeed(input, s); } catch (e) { r = { score: -1, status: 'error', metrics: {}, note: String(e?.message || e) }; }
    const metrics = {};
    for (const key of keysOf(adapter.metrics)) { const x = r?.metrics?.[key]; metrics[key] = Number.isFinite(x) ? x : null; }
    yield { seed: s, score: Number.isFinite(r?.score) ? r.score : -1, status: r?.status || 'unknown', metrics, ...(r?.note ? { note: String(r.note).slice(0, 160) } : {}), ms: Date.now() - t0 };
  }
}

/** 一次跑完（Node 报告与测试用）。 */
export function seedReport(adapter, input, opts = {}) {
  const rows = [...runLayerSeeds(adapter, input, opts)], dist = distribution(rows, adapter.metrics), pick = pickThree(rows, adapter.metrics, dist);
  return finishReport(adapter, rows, dist, pick, opts);
}
/** 行已经有了（Worker 逐个回传后在页面上汇总）。 */
export function finishReport(adapter, rows, dist = distribution(rows, adapter.metrics), pick = pickThree(rows, adapter.metrics, dist), { inputLabel = null } = {}) {
  return {
    version: SEED_REPORT_VERSION, status: STATUS.RUN, layer: adapter.layer, label: adapter.label || adapter.layer,
    input: inputLabel || adapter.inputLabel || null, seedMeaning: adapter.seedMeaning || null,
    metrics: (adapter.metrics || []).map((m) => (typeof m === 'string' ? { key: m, label: m } : { ...m })),
    count: rows.length, passed: rows.filter((r) => r.score >= 0).length, errors: rows.filter((r) => r.status === 'error').length,
    rows, distribution: dist, pick,
  };
}
/** 跑不了（浏览器才有输入 / 依赖缺失）：如实登记，不编数。 */
export function notRunReport({ layer, label = layer, reason, blocked = false }) {
  return { version: SEED_REPORT_VERSION, status: STATUS.NOT_RUN, layer, label, blocked: !!blocked, reason: String(reason || '没有说明原因'), count: 0, passed: 0, errors: 0, rows: [], distribution: {}, pick: { best: null, worst: null, typical: null, typicalDistance: null }, metrics: [] };
}

/** 报告一句话摘要（命令行 / 页面标题用）。 */
export function summarizeReport(r) {
  if (!r) return '没有报告';
  if (r.status === STATUS.NOT_RUN) return `${r.label}：NOT_RUN（${r.reason}）`;
  return `${r.label}：${r.count} 个种子 · ${r.passed} 个没判失败${r.errors ? ` · ${r.errors} 个抛错` : ''} · 最好 ${r.pick.best ?? '—'} · 最典型 ${r.pick.typical ?? '—'} · 最差 ${r.pick.worst ?? '—'}`;
}
/** 数值按单位写成文字（页面 / 命令行共用）。 */
export function formatMetric(m, v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (m?.unit === '%') return (v * 100).toFixed(1) + '%';
  if (m?.unit === 'm') return v.toFixed(2) + ' m';
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 1000) / 1000);
}
