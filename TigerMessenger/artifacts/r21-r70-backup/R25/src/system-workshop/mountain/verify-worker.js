// 山形管线 · 验证 Worker。只读。
import { verifyMountain } from './verify.js?v=mountain-r2';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try { postMessage({ job, heartbeat: true, stage: '保护区 / 轨道净空 / 海岸线 / 山形指标' }); postMessage({ job, ok: true, result: verifyMountain(msg.field, msg.plan, { steps: msg.steps || [] }) }); }
  catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
