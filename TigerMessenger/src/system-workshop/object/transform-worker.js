// 物件 · 改造 Worker：在布局副本上执行能力计划，产出每个物件的新增量。不接触实景。
import { matchObjects, runObjectPlan, describeObjectCapabilities } from './capabilities.js';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try {
    postMessage({ job, heartbeat: true, stage: msg.type === 'scan' ? '扫描物件布局' : '执行能力计划' });
    if (msg.type === 'scan') { postMessage({ job, ok: true, result: { matches: matchObjects(msg.layout), capabilities: describeObjectCapabilities() } }); return; }
    postMessage({ job, ok: true, result: runObjectPlan(msg.layout, msg.steps) });
  } catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
