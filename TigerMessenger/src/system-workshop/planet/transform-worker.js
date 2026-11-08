// 球系统 · 改造 Worker：执行能力计划（配方变换）→ 编译候选星球 → 摘要 + 预览图。不接触游戏。
import { runPlanetPlan, PLANET_CAPABILITIES, describePlanetCapabilities } from './capabilities.js?v=sys-r11';
import { compileAndSummarize } from './summarize.js?v=sys-r11';
const beat = (job, stage) => postMessage({ job, heartbeat: true, stage });
onmessage = ({ data: msg }) => {
  const { job } = msg;
  try {
    if (msg.type === 'scan') {
      beat(job, '编译当前星球'); const s = compileAndSummarize(msg.recipe);
      if (!s.ok) throw new Error('当前配方编译失败：' + s.stage);
      beat(job, '逐个能力匹配');
      const matches = PLANET_CAPABILITIES.map((c) => { const m = c.match(s, {}); return { id: c.meta.id, count: m.length, targets: m }; });
      postMessage({ job, ok: true, result: { summary: s, matches, capabilities: describePlanetCapabilities() } }, [s.raster.px.buffer]);
      return;
    }
    beat(job, '执行配方计划'); const plan = runPlanetPlan(msg.recipe, msg.steps);
    beat(job, '编译候选星球（field → hydrology → climate → ecology → clouds → charts → vegetation → snapshot）');
    const s = compileAndSummarize(plan.recipe);
    postMessage({ job, ok: true, result: { recipe: plan.recipe, report: plan.report, summary: s } }, s.raster ? [s.raster.px.buffer] : []);
  } catch (e) { postMessage({ job, ok: false, error: e?.message || String(e) }); }
};
