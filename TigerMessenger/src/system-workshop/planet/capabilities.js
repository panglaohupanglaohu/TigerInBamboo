/**
 * 球系统工坊的能力代码。作用对象是「星球配方」（compilePlanetV8 的参数），不是体素：
 *   meta   id / 分区（与 system-catalog.json 的球系统分区一致）/ 参数范围 / Router 关键词
 *   match(summary, params)  看当前星球快照，说明这个能力能不能作用、为什么
 *   run(recipe, params)     返回新的配方（纯数据，在改造 Worker 里执行）
 * 星球编译器本身（src/procgen/planet）是 TigerMessenger 的代码；学到的球系统方法在重构完成后
 * 以同样的契约登记到这里，目录里对应的「原版占位」节点就升级为可执行。
 */
export const DEFAULT_PLANET_RECIPE = Object.freeze({ seed: 1, radius: 160, subdivision: 1, chartLimit: 6, resolution: 24, seaLevel: 0, landformChain: true });
export const PLANET_RECIPE_KEYS = ['seed', 'subdivision', 'chartLimit', 'resolution', 'seaLevel', 'landformChain'];
export const FINAL_KEY = 'tm.planet.final.v1';

const pct = (x) => Math.round(x * 100) + '%';
export const PLANET_CAPABILITIES = [
  { meta: { id: 'planet.sea-level', domain: 'water', name: '海平面', does: '整体抬高或降低海平面：沿岸低地变海或露出。验证会检查每个场景锚点是否被淹。',
      keywords: ['海平面', '海', '淹', '水位', '陆地', '海岸', 'sea'], params: { level: { label: '海平面', min: -3, max: 3, step: 0.25, default: 0.5 } } },
    match: (s) => [{ id: 'planet', score: 1, reason: `陆地占 ${pct(s.stats.land)}；最低的陆上场景锚点高 ${s.stats.lowestLandmark?.height.toFixed(2)}（${s.stats.lowestLandmark?.id}）` }],
    run: (r, p) => ({ ...r, seaLevel: +p.level }) },
  { meta: { id: 'planet.reseed', domain: 'terrain', name: '重解地形', does: '换地形求解种子：场景锚点位置保持，锚点之间的山谷、湖泊、云重新求解。',
      keywords: ['种子', '重排', '重新生成', '地形', '大陆', '山', 'seed'], params: { seed: { label: '种子', min: 1, max: 999, step: 1, default: 7 } } },
    match: (s) => [{ id: 'planet', score: 0.8, reason: `${s.stats.landmarks} 个场景锚点固定，地形 WFC 解 ${s.hashes.wfc}` }],
    run: (r, p) => ({ ...r, seed: Math.round(p.seed) }) },
  { meta: { id: 'planet.surface-detail', domain: 'grid', name: '地表分辨率', does: '每个切图的地表采样密度：越高越细，编译和渲染越慢。',
      keywords: ['分辨率', '细节', '精细', '粗', '性能', 'resolution'], params: { resolution: { label: '分辨率', min: 12, max: 40, step: 4, default: 32 } } },
    match: (s) => [{ id: 'planet', score: 0.6, reason: `当前分辨率 ${s.recipe.resolution}，编译 ${s.ms} ms` }],
    run: (r, p) => ({ ...r, resolution: Math.round(p.resolution) }) },
  { meta: { id: 'planet.chart-split', domain: 'grid', name: '切图数', does: '球面切成多少个切图（chart）装网格：影响接缝数量和分块加载。',
      keywords: ['切图', '分块', '接缝', 'chart', 'seam'], params: { charts: { label: '切图上限', min: 2, max: 12, step: 1, default: 8 } } },
    match: (s) => [{ id: 'planet', score: 0.5, reason: `当前 ${s.stats.charts} 个切图，接缝检查 ${s.reports.seamReport?.ok ? '通过' : '未通过'}` }],
    run: (r, p) => ({ ...r, chartLimit: Math.round(p.charts) }) },
  { meta: { id: 'planet.grid-subdivision', domain: 'grid', name: '网格细分', does: '测地网格再细分一级：格子变多，场景锚点之间的地形更丰富。（实验：目前 2 级过不了编译器的地形链检查，验证会拦下）',
      keywords: ['细分', '网格', '格子', '更多', 'subdivision', 'grid'], params: { level: { label: '细分级数', min: 1, max: 3, step: 1, default: 1 } } },
    match: (s) => [{ id: 'planet', score: 0.5, reason: `当前细分 ${s.recipe.subdivision} 级，${s.stats.cells} 个格子；2 级目前编译不通过（实验）` }],
    run: (r, p) => ({ ...r, subdivision: Math.round(p.level) }) },
];
export const describePlanetCapabilities = () => PLANET_CAPABILITIES.map((c) => ({ ...c.meta, tier: 'planet', kind2: 'recipe' }));
export function cleanRecipe(r = {}) {
  const o = { ...DEFAULT_PLANET_RECIPE };
  for (const k of PLANET_RECIPE_KEYS) if (r[k] !== undefined) o[k] = k === 'landformChain' ? !!r[k] : Number(r[k]);
  return o;
}
export function runPlanetPlan(recipe, steps) {
  let r = cleanRecipe(recipe); const report = [];
  for (const s of steps) {
    const cap = PLANET_CAPABILITIES.find((c) => c.meta.id === s.id);
    if (!cap) { report.push({ id: s.id, status: 'missing' }); continue; }
    const params = {}; for (const [k, d] of Object.entries(cap.meta.params)) params[k] = Math.max(d.min, Math.min(d.max, Number(s.params?.[k] ?? d.default)));
    const before = r; r = cleanRecipe(cap.run(r, params));
    report.push({ id: s.id, status: 'applied', params, changed: PLANET_RECIPE_KEYS.filter((k) => before[k] !== r[k]).map((k) => `${k} ${before[k]} → ${r[k]}`) });
  }
  return { recipe: r, report };
}
