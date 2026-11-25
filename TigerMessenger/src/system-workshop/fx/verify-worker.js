// 表现层管线 · 验证 Worker。只读。
import { verifyFx } from './verify.js?v=fxe-r1';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try { postMessage({ job, heartbeat: true, stage: '分区 / 前线 / 镜头 / 尾迹 / 面板 / 火 / 走廊 / 沉积 / 弹道 / 回放' }); postMessage({ job, ok: true, result: verifyFx(msg.site, msg.plan, { steps: msg.steps || [] }) }); }
  catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
