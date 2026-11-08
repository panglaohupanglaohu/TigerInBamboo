// 改造 Worker：在场景副本上执行能力计划，产出候选编码。不接触实景、不写存档。
// 消息：{ job, type:'match'|'run', data, allowed, steps, focusCells }
import { worldFrom } from './world-cache.js';
import { rea } from './rea.js';
const registry = import(rea('src/capabilities/registry.js'));
const beat = (job, stage) => postMessage({ job, heartbeat: true, stage });
onmessage = async ({ data: msg }) => {
  const { job } = msg;
  try {
    beat(job, '加载能力库与场景副本');
    const reg = await registry;
    const { world, encode } = await worldFrom(msg.data);
    const ctx = { allowed: msg.allowed ? Uint8Array.from(msg.allowed) : null };
    if (msg.type === 'match') {
      beat(job, '扫描场景物件');
      postMessage({ job, ok: true, result: { capabilities: reg.describeCapabilities(), matches: reg.matchAll(world, ctx, { focusCells: msg.focusCells || null }), registryVersion: reg.REGISTRY_VERSION } });
      return;
    }
    beat(job, '执行能力计划');
    const report = reg.runPlan(world, msg.steps, ctx, { focusCells: msg.focusCells || null });
    beat(job, '编码候选');
    postMessage({ job, ok: true, result: { data: encode(world), report } });
  } catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
