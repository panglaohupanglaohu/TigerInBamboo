// 球系统 · 验证 Worker：独立复算候选（确定性），再跑 verifyPlanet。只读。
import { compileAndSummarize } from './summarize.js?v=sys-r11';
import { verifyPlanet } from './verify.js?v=sys-r11';
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try {
    postMessage({ job, heartbeat: true, stage: '独立复算候选' });
    const again = msg.after.ok ? compileAndSummarize(msg.after.recipe, { W: 8, H: 4 }) : null;
    postMessage({ job, heartbeat: true, stage: '检查报告 / 锚点 / 预算' });
    postMessage({ job, ok: true, result: verifyPlanet(msg.before, msg.after, again) });
  } catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
