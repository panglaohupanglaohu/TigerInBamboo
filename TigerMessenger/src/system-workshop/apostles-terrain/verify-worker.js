// 十二门徒地形管线 · 验证 Worker。只读，独立复算。
import { verifyApostlesTerrain } from './verify.js?v=apt-r1';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try { postMessage({ job, heartbeat: true, stage: '开关组合 / 不写存档 / 软坡台阶复算 / 配色差复算' }); postMessage({ job, ok: true, result: verifyApostlesTerrain(msg.site, msg.plan, { steps: msg.steps || [] }) }); }
  catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
