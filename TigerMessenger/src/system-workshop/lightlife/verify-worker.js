// 光影与生命管线 · 验证 Worker。只读，从采样独立重算。
import { verifyLightLife } from './verify.js?v=light-r66';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try { postMessage({ job, heartbeat: true, stage: '遮蔽复算 / 区域图 / 大纹理 / 图集 / 风 / 烟 / 动物' }); postMessage({ job, ok: true, result: verifyLightLife(msg.site, msg.plan, { steps: msg.steps || [] }) }); }
  catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
