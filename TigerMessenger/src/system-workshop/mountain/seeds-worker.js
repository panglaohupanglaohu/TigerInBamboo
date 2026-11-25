// R28 山形多种子分布 Worker：30 个种子逐个算、逐个回传（行里不带 plan），最后回传分布、三张代表（带 plan，给缩略图和实景预览）。
import { runSeeds, distribution, pickThree } from './seeds.js?v=seeds-r28';
self.onmessage = (e) => {
  const { runId, field, count = 30 } = e.data || {};
  try {
    const rows = [], plans = new Map();
    for (const r of runSeeds(field, { count, keepPlans: true })) { plans.set(r.seed, r.plan); const { plan, ...row } = r; rows.push(row); self.postMessage({ runId, row }); }
    const dist = distribution(rows), pick = pickThree(rows, dist), picked = {};
    for (const k of ['best', 'worst', 'typical']) if (pick[k] != null) picked[k] = { seed: pick[k], plan: plans.get(pick[k]) };
    self.postMessage({ runId, done: true, distribution: dist, pick, picked });
  } catch (err) { self.postMessage({ runId, error: String(err?.message || err) }); }
};
