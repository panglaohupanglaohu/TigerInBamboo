// §6-2 补学队列落盘：把「本机经验 + 管线需求」合并进队列顺序，导出成 8769 学习自动任务可直接读取的文件。
// 用法：node tools/refactor/export-learn-queue.mjs [--experience tm-experience.json] [--demand demand.json] [--out 路径] [--stdout]
//   --experience  学习工坊「⇩ 导出经验」下载的文件（{rows:[…]}）；省略则按零经验导出
//   --demand      [{id,name,clips,reason}] 管线里已放但不能执行的节点
//   --metrics     验证指标（{metrics:[{line,name,value,threshold,direction,…}]}）；省略则读 src/scene-authoring/catalog/verification-metrics.json（夜间重建写的），没有就不加分
//   R40 创新 5：指标离阈值的差距按 tools/refactor/metric-gap.mjs 的 METRIC_GAP_FORMULA 加到本线补学行的得分上再重排。
import fs from 'node:fs';
import path from 'node:path';
import { computeLineage } from './build-capability-lineage.mjs';
import { summaryFor } from '../../src/scene-authoring/agent/experience.js';
import { applyMetricGaps, METRIC_GAP_FORMULA } from './metric-gap.mjs';

const arg = (name) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : null; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

export async function exportLearnQueue({ experience = {}, demand = [], metrics = [] } = {}) {
  const { lineage } = await computeLineage({ experience: experience || {}, demand });
  const queue = applyMetricGaps(lineage.queue, metrics);
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), formula: lineage.formula, metricFormula: METRIC_GAP_FORMULA,
    inputs: { experienceRows: Object.keys(experience || {}).length, demand: demand.length, metrics: metrics.length },
    queue, adaptQueue: lineage.adaptQueue, demand: lineage.demand,
    summary: { gaps: lineage.gaps, queueRows: queue.length, adapt: lineage.adaptQueue.length, metricBoosted: queue.filter((q) => q.metricGap).length },
  };
}

/** 把导出的经验文件（{rows}）汇总成 buildCapabilityLineage 需要的 {能力ID:{runs,…}} 形态。 */
export function experienceFromExport(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const ids = [...new Set(rows.flatMap((r) => (r.steps || []).map((s) => s.id).concat(r.capabilityId ? [r.capabilityId] : [])))];
  return Object.fromEntries(ids.map((id) => [id, summaryFor(id, rows)]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const expFile = arg('experience'), demandFile = arg('demand'), out = arg('out') || path.resolve('src/scene-authoring/catalog/learn-queue.json');
  const experience = expFile ? experienceFromExport(readJson(expFile)) : {};
  const demand = demandFile ? readJson(demandFile) : [];
  const metricsFile = arg('metrics') || path.resolve('src/scene-authoring/catalog/verification-metrics.json');
  const metrics = fs.existsSync(metricsFile) ? (readJson(metricsFile).metrics || []) : [];
  const doc = await exportLearnQueue({ experience, demand, metrics });
  if (process.argv.includes('--stdout')) console.log(JSON.stringify(doc.summary) + '\n队首：' + doc.queue.slice(0, 5).map((q) => `#${q.rank} ${q.score} ${q.lineName}·${q.generation}`).join(' | '));
  else { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(doc, null, 1)); console.log('写入 ' + out + '（' + doc.queue.length + ' 项补学 · ' + doc.adaptQueue.length + ' 条适配）'); }
}
