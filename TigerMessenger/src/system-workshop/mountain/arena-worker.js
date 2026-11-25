// R26 地形线擂台 Worker：固定种子测试岛上按默认参数跑各代，回传四项指标、原样指标与比较判定（plan 只给缩略图用）。
import { ARENA_GENERATIONS, ARENA_SEED, arenaIsland, runArenaGeneration, compareGenerations, terrainMetrics } from './arena.js?v=arena-r26';
self.onmessage = (e) => {
  const { runId } = e.data || {};
  try {
    const field = arenaIsland(ARENA_SEED), t0 = Date.now();
    const original = terrainMetrics(field, { h: field.h, protect: { band: 6, railBand: 8 } });
    const gens = ARENA_GENERATIONS.map((g) => { const r = runArenaGeneration(g, field); return { id: r.id, label: r.label, steps: r.steps, metrics: r.metrics, plan: r.plan }; });
    const compare = compareGenerations(gens.at(-2).metrics, gens.at(-1).metrics);
    self.postMessage({ runId, done: true, seed: ARENA_SEED, field, original, gens, compare, ms: Date.now() - t0 });
  } catch (err) { self.postMessage({ runId, error: String(err?.message || err) }); }
};
