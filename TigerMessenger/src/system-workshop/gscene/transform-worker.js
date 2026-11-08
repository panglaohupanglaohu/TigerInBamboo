// 通用场景管线 · 改造 Worker：在材质色表副本上执行能力计划。
import { matchGscene, runGscenePlan, describeGsceneCapabilities } from './capabilities.js?v=sys-r11';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try {
    postMessage({ job, heartbeat: true, stage: msg.type === 'scan' ? '扫描材质色表' : '执行能力计划' });
    if (msg.type === 'scan') { postMessage({ job, ok: true, result: { matches: matchGscene(msg.materials), capabilities: describeGsceneCapabilities() } }); return; }
    postMessage({ job, ok: true, result: runGscenePlan(msg.materials, msg.steps) });
  } catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
