/**
 * metric-gap.mjs —— Guide §1.4 创新 5「课程由实景差距驱动」的第一步（R40）：验证指标离阈值多远 → 补学队列得分。
 *
 * 输入：metrics = [{ line, capability?, name, value, threshold, direction: 'max' | 'min', unit?, scene?, source? }]
 *   direction 'max' = 值不能超过阈值（例：圣城竖崖占比 ≤ 12%、0.39s 火光残留 ≤ 35%）；'min' = 值不能低于阈值（例：走廊板覆盖率 ≥ 98%）。
 *   来源：各层 verify 检查项上的 metric 字段（fx/verify.js、fx/verify-frontier.js），由夜间重建（tools/nightly/run-nightly.mjs）
 *   跑每条目标路径时收集，写 src/scene-authoring/catalog/verification-metrics.json；端到端 report.json 里的 metrics 数组也收。
 *
 * 公式（METRIC_GAP_FORMULA，原样写进 learn-queue.json）：见下。纯函数，不读文件；export-learn-queue.mjs 负责读 json。
 * 没有指标时队列原样返回（顺序、得分都不变），所以不影响没跑夜间重建时的行为。
 */
export const METRIC_GAP_FORMULA = '指标差距分（创新 5）：相对差距 g = 方向「上限」时 (值 − 阈值) / |阈值|，「下限」时 (阈值 − 值) / |阈值|（|阈值| 至少按 1e-6 算）。g > 0（越过阈值）记 min(6, 2 + 10·g)；−0.1 < g ≤ 0（离阈值不到一成，临界）记 10·(g + 0.1)，即 0–1 分；其余 0。一条能力线取它所有指标里的最高分（不累加，免得检查项多的线占便宜），加到补学队列里本线（含 alsoIn 交叉线，取最高）每一行的得分上，再按新得分重排（同分保持原名次）。';
export const METRIC_GAP_CAP = 6;
const r2 = (v) => Math.round(v * 100) / 100;

/** 单个指标 → { gap, score, state }；数值不合法返回 null。 */
export function metricGap(m) {
  const v = Number(m?.value), t = Number(m?.threshold), dir = m?.direction;
  if (!Number.isFinite(v) || !Number.isFinite(t) || (dir !== 'max' && dir !== 'min')) return null;
  const base = Math.max(Math.abs(t), 1e-6), gap = dir === 'max' ? (v - t) / base : (t - v) / base;
  const score = gap > 0 ? Math.min(METRIC_GAP_CAP, 2 + 10 * gap) : gap > -0.1 ? 10 * (gap + 0.1) : 0;
  return { gap: +gap.toFixed(4), score: r2(score), state: gap > 0 ? 'over' : gap > -0.1 ? 'near' : 'ok' };
}

/** 按能力线取最高分。返回 Map(line → { score, top, metrics })，只收 score > 0 的线。 */
export function lineBoosts(metrics = []) {
  const out = new Map();
  for (const m of metrics) {
    if (!m?.line) continue; const g = metricGap(m); if (!g || g.score <= 0) continue;
    const row = { ...m, ...g }, cur = out.get(m.line);
    if (!cur) out.set(m.line, { score: g.score, top: row, metrics: [row] });
    else { cur.metrics.push(row); if (g.score > cur.score) { cur.score = g.score; cur.top = row; } }
  }
  for (const v of out.values()) v.metrics.sort((a, b) => b.score - a.score);
  return out;
}

/** 把指标差距分加进补学队列并重排。不改入参；返回新数组（每行浅拷贝），rank 重新编号，原名次记在 rankBefore。 */
export function applyMetricGaps(queue = [], metrics = []) {
  const boosts = lineBoosts(metrics);
  if (!boosts.size) return queue.map((q) => ({ ...q }));   // 没有越线 / 临界的指标：顺序、得分、名次原样
  const rows = queue.map((q, i) => {
    const lines = [q.line, ...(q.alsoIn || [])], best = lines.map((l) => boosts.get(l)).filter(Boolean).sort((a, b) => b.score - a.score)[0];
    const row = { ...q, rankBefore: q.rank ?? i + 1 };
    if (best) {
      row.score = r2((q.score || 0) + best.score); row.why = [...(q.why || []), `指标离阈值：${best.top.name} ${best.top.value}（阈值 ${best.top.threshold}，${best.top.state === 'over' ? '已越过' : '临界'}）+${best.score}`];
      row.metricGap = { score: best.score, line: best.top.line, name: best.top.name, value: best.top.value, threshold: best.top.threshold, direction: best.top.direction, gap: best.top.gap, state: best.top.state, scene: best.top.scene || null };
    }
    return row;
  });
  rows.sort((a, b) => (b.score || 0) - (a.score || 0) || a.rankBefore - b.rankBefore);
  rows.forEach((q, i) => { q.rank = i + 1; });
  return rows;
}
