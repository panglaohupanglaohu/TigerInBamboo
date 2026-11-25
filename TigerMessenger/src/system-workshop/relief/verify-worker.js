// 地貌管线 · 验证 Worker。只读，从原采样和候选计划独立复算（保护格 / 海陆 / 排水 / 岩檐 / 梯子 / 等高线）。
import { verifyRelief } from './verify.js?v=relief-r2';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try { postMessage({ job, heartbeat: true, stage: '保护格 / 海陆 / 排水 / 岩檐 / 梯子 / 等高线复算' }); postMessage({ job, ok: true, result: verifyRelief(msg.site, msg.plan, { steps: msg.steps || [], scene: msg.site?.scene || null }) }); }
  catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
