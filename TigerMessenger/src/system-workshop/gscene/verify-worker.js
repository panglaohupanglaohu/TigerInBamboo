// 通用场景管线 · 验证 Worker。只读。
import { verifyGscene } from './verify.js?v=sys-r11';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try { postMessage({ job, heartbeat: true, stage: '明度 / 层次 / 颜色数' }); postMessage({ job, ok: true, result: verifyGscene(msg.materials, msg.colors) }); }
  catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
