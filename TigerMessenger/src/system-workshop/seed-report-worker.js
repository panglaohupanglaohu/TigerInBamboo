// R62 多种子分布 Worker（通用，所有登记了适配器的层共用）：逐个种子算、逐个回传，最后回传整份报告。
// 消息：{ runId, layer, count = 30, from = 1, input? }（不给 input = 用这层的合成 / 擂台输入）。
import { loadSeedAdapter, seedLayerFor } from './seed-layers.js?v=seeds-r61';
import { runLayerSeeds, finishReport, notRunReport } from './seed-report.js?v=seeds-r61';
self.onmessage = async (e) => {
  const { runId, layer, count = 30, from = 1, input = null } = e.data || {};
  try {
    const L = seedLayerFor(layer);
    if (!L || L.notRun) { self.postMessage({ runId, done: true, report: notRunReport({ layer, label: L?.label || layer, reason: L?.notRun || '这一层还没有登记分布适配器', blocked: !L }) }); return; }
    const a = await loadSeedAdapter(layer), fx = input ?? a.fixture(), rows = [];
    for (const row of runLayerSeeds(a, fx, { count, from })) { rows.push(row); self.postMessage({ runId, row }); }
    self.postMessage({ runId, done: true, report: finishReport(a, rows, undefined, undefined, { inputLabel: input ? '实景采样（当前场景）' : a.inputLabel }) });
  } catch (err) { self.postMessage({ runId, error: String(err?.message || err) }); }
};
