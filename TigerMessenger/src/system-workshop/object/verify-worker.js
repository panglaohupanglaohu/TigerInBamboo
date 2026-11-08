// 物件 · 验证 Worker。只读。
import { verifyObjects } from './verify.js';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try { postMessage({ job, heartbeat: true, stage: '数值 / 范围 / 重叠 / 出界' }); postMessage({ job, ok: true, result: verifyObjects(msg.layout, msg.edits, { steps: msg.steps }) }); }
  catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
