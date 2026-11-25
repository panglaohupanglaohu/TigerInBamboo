// 建筑管线 · 验证 Worker。只读：只拿原始采样 field 和候选 plan 重算（重构库 validateLayout + 契约生成的检查）。
import { verifyBuilding } from './verify.js?v=building-r1';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try { postMessage({ job, heartbeat: true, stage: '足迹 / 门与路 socket / 契约保护项（已有建筑、保护带、轨道净空、海岸线）' }); postMessage({ job, ok: true, result: verifyBuilding(msg.field, msg.plan, { steps: msg.steps || [], sceneId: msg.sceneId || null }) }); }
  catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
