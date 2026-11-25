// 山形进化 Worker：一代候选逐个算、逐个回传，页面边算边出图。
import { breed } from './evolve.js?v=evolve-r1';
self.onmessage = (e) => {
  const { runId, field, opts } = e.data || {};
  try { for (const candidate of breed(field, opts)) self.postMessage({ runId, candidate }); self.postMessage({ runId, done: true }); }
  catch (err) { self.postMessage({ runId, error: String(err?.message || err) }); }
};
