/**
 * 山形进化：把 6 个山形能力的参数当基因，一代代繁殖候选山，人在实景里挑喜欢的留种。
 * 纯数据（Worker 与 Node 共用）。每个候选都过独立验证；硬检查不过的照样显示，但不能留种、不能采用。
 * 思路来自交互式进化（人当选择压力）与 AlphaEvolve 式「提出 → 评分 → 留优」循环；这里变异的是参数，不是代码。
 */
import { MOUNTAIN_CAPABILITIES, runPlan } from './capabilities.js?v=mountain-r2';
import { verifyMountain } from './verify.js?v=mountain-r25';

export const EVOLVE_VERSION = 1;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function rng32(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const specs = () => MOUNTAIN_CAPABILITIES.flatMap((c) => Object.entries(c.meta.params || {}).map(([k, p]) => ({ cap: c.meta.id, k, p })));
const snap = (v, p) => { const st = p.step || 0.01, x = clamp(Math.round(v / st) * st, p.min, p.max); return +x.toFixed(4); };

export function defaultGenome() { const g = {}; for (const { cap, k, p } of specs()) (g[cap] ||= {})[k] = p.default; return g; }
/** 每个基因有一半机会变；幅度 = 取值范围 × strength 的高斯。离散基因（步长 ≥ 1 且只有 ≤ 4 档）改成小概率换档。 */
export function mutate(genome, r, strength = 0.3) {
  const g = {};
  for (const { cap, k, p } of specs()) {
    const v = genome[cap]?.[k] ?? p.default, span = p.max - p.min, levels = span / (p.step || 1);
    let nv = v;
    if (levels <= 3) { if (r() < strength * 0.6) nv = p.min + Math.floor(r() * (levels + 1)) * (p.step || 1); }
    else if (r() < 0.5) nv = v + gauss(r) * span * strength;
    (g[cap] ||= {})[k] = snap(nv, p);
  }
  return g;
}
/** 交叉：每个基因随机取自某一个亲本 */
export function mix(parents, r) { const g = {}; for (const { cap, k, p } of specs()) (g[cap] ||= {})[k] = parents[Math.floor(r() * parents.length)][cap]?.[k] ?? p.default; return g; }
export const genomeKey = (g) => specs().map(({ cap, k }) => g[cap][k]).join(',');
/** 和默认参数比，哪些基因变了（卡片上显示「它和上一代差在哪」） */
export function describeGenome(g, base = defaultGenome()) {
  return specs().filter(({ cap, k }) => g[cap][k] !== base[cap][k]).map(({ cap, k, p }) => ({ cap, k, label: p.label, from: base[cap][k], to: g[cap][k] }));
}

/** 跑一遍管线 + 独立验证。分数只用验证算出的山形指标，不看参数。 */
export function evaluate(field, genome) {
  const steps = MOUNTAIN_CAPABILITIES.map((c) => ({ id: c.meta.id, params: genome[c.meta.id] || {} })), site = { field };
  const report = runPlan(site, steps), plan = site.plan, verify = verifyMountain(field, plan, { steps }), a = verify.metrics?.after;
  const hard = verify.checks.filter((c) => c.status === 'fail').map((c) => c.name);
  const score = !a || hard.length ? -1 : +(a.mid * 40 + Math.min(a.prominence, 30) / 30 * 30 + (1 - Math.min(a.cliff / 0.2, 1)) * 20 + (1 - a.flat) * 10).toFixed(1);
  return { genome, plan, score, status: verify.status, hard, warn: verify.checks.filter((c) => c.status === 'warn').map((c) => c.name),
    metrics: a ? { mid: a.mid, flat: a.flat, cliff: a.cliff, top: a.top, prominence: a.prominence } : null, before: verify.metrics?.before || null,
    ms: report.reduce((s, x) => s + (x.ms || 0), 0) };
}

/**
 * 繁殖一代。parents 为空 = 第一代：第 0 个是默认参数（基线），其余从基线大幅变异，再掺入以前留过种的口味。
 * 有 parents：亲本原样保留排在最前（精英保留，所以每代最好成绩不会倒退），其余 = 交叉 + 变异，幅度逐代收窄。
 */
export function* breed(field, { parents = [], favourites = [], count = 12, generation = 1, seed = 1 } = {}) {
  const r = rng32(seed * 7919 + generation * 104729), seen = new Set(), out = [];
  const push = (genome, origin) => { const key = genomeKey(genome); if (seen.has(key)) return null; seen.add(key); const c = { ...evaluate(field, genome), id: `g${generation}-${out.length}`, generation, origin }; out.push(c); return c; };
  if (!parents.length) {
    let c = push(defaultGenome(), 'baseline'); if (c) yield c;
    for (const f of favourites.slice(0, 2)) { c = push(mutate(f, r, 0.12), 'taste'); if (c) yield c; }
    for (let tries = 0; out.length < count && tries < count * 6; tries++) { c = push(mutate(defaultGenome(), r, 0.45), 'explore'); if (c) yield c; }
  } else {
    for (const p of parents) { const c = push(p, 'parent'); if (c) yield c; }
    const strength = Math.max(0.1, 0.36 * Math.pow(0.75, generation - 2));
    for (let tries = 0; out.length < count && tries < count * 6; tries++) { const c = push(mutate(mix(parents, r), r, strength), 'child'); if (c) yield c; }
  }
}
