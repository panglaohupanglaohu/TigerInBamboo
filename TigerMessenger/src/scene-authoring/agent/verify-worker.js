// 验证 Worker：比较原始与候选——范围、手工建筑、承托、通行、几何量。只读。
import { worldFrom } from './world-cache.js';
import { rea } from './rea.js';
const verify = import(rea('src/capabilities/verify.js'));
onmessage = async ({ data: msg }) => {
  const { job } = msg;
  try {
    postMessage({ job, heartbeat: true, stage: '解码原始与候选' });
    const { verifyCandidate } = await verify;
    const a = await worldFrom(msg.before), b = await worldFrom(msg.after);
    postMessage({ job, heartbeat: true, stage: '承托 / 通行 / 几何量' });
    const t0 = Date.now();
    const result = verifyCandidate(a.world, b.world, { allowed: msg.allowed ? Uint8Array.from(msg.allowed) : null, touchesBuilt: !!msg.touchesBuilt });
    result.ms = Date.now() - t0;
    postMessage({ job, ok: true, result });
  } catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
