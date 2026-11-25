// 战役管线 · 验证 Worker。只读。
import { verifyBattle } from './verify.js?v=nav-r1';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try { postMessage({ job, heartbeat: true, stage: '战场 / 尺度 / 兵力 / 波次 / 导航' }); postMessage({ job, ok: true, result: verifyBattle(msg.site, msg.plan, { steps: msg.steps || [] }) }); }
  catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
