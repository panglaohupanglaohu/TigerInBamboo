// 十二门徒地形候选开关（实验）。默认全部关闭：认可的现有画面、vendor 副本与打包结果不变。
// 2026-11-15 同机位对照结论（artifacts/apostles-soft-terrain-20261115）：latest 让崖壁折面更硬，soft 在现有台地构图上几乎看不出缓坡并有一处半透明破面，
// 两者都不是可采用的改进；保留开关只为后续继续对照，见 docs/APOSTLES_TERRAIN_DIAGNOSIS.md。
//   ?apostlesLook=soft            用最新能力库（REACodeRefactoring）的地形 / 网格 / 烘焙，并启用「缓坡省 + 连续软坡顶面」
//   ?apostlesLook=latest          只换成最新能力库，地形生成规则不变（用来区分「库版本」与「软坡」各自的影响）
// 也可在同源页面写 localStorage['tm.apostles.look.v1']（工坊里的游戏 iframe 用这个）。候选只影响生成与显示，不写任何存档。
const raw = (() => { try { return new URLSearchParams(location.search).get('apostlesLook') ?? localStorage.getItem('tm.apostles.look.v1') ?? ''; } catch { return ''; } })();
const flags = new Set(String(raw).split(',').map((s) => s.trim()).filter(Boolean));
export const APOSTLES_LOOK = Object.freeze({ soft: flags.has('soft'), latest: flags.has('soft') || flags.has('latest'), id: [...flags].sort().join('+') || 'approved' });
const ROOT = new URL('../../../townscaper-web/REACodeRefactoring/src/', import.meta.url);
const load = (p) => import(/* @vite-ignore */ new URL(p, ROOT).href);
/** 最新能力库的同名模块；未开启候选时为 null（调用方回落到 vendor 副本）。 */
export const LATEST = APOSTLES_LOOK.latest ? await (async () => {
  const [grid, spatial, world, palette, noise, features, save, worldmesh, shore, vegetation, generate] = await Promise.all(['core/grid.js', 'core/spatial.js', 'core/world.js', 'core/palette.js', 'core/noise.js', 'terrain/features.js', 'world/save.js', 'world/worldmesh.js', 'water/shore.js', 'life/vegetation.js', 'terrain/generate.js'].map(load));
  return { grid, spatial, world, palette, noise, features, save, worldmesh, shore, vegetation, generate };
})() : null;
