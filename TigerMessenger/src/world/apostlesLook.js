// 十二门徒地形候选开关。2026-11-25 定案（用户确认）：默认启用 soft——
// soft-tops 破面修复+成面放宽后 e2e 候选验证可融台阶 163、无裂缝（crack.bad:[]）、不写存档；
// palette 保持候选（ΔE 5.766 色彩方向变化待用户实看）。
//   ?apostlesLook=approved        回到原认可画面（覆盖默认）
//   ?apostlesLook=soft,palette    再叠加库地形配色候选
//   ?apostlesLook=latest          只换最新能力库、不开软坡
// 也可在同源页面写 localStorage['tm.apostles.look.v1']（工坊里的游戏 iframe 用这个）。开关只影响生成与显示，不写任何存档。
const raw = (() => { try { return new URLSearchParams(location.search).get('apostlesLook') ?? localStorage.getItem('tm.apostles.look.v1') ?? 'soft'; } catch { return 'soft'; } })();
const flags = new Set(String(raw).split(',').map((s) => s.trim()).filter(Boolean));
export const APOSTLES_LOOK = Object.freeze({ soft: flags.has('soft'), latest: flags.has('soft') || flags.has('latest'), palette: flags.has('palette'), id: [...flags].sort().join('+') || 'approved' });
const ROOT = new URL('../../../townscaper-web/REACodeRefactoring/src/', import.meta.url);
const load = (p) => import(/* @vite-ignore */ new URL(p, ROOT).href);
/** 最新能力库的同名模块；未开启候选时为 null（调用方回落到 vendor 副本）。 */
export const LATEST = APOSTLES_LOOK.latest ? await (async () => {
  const [grid, spatial, world, palette, noise, features, save, worldmesh, shore, vegetation, generate] = await Promise.all(['core/grid.js', 'core/spatial.js', 'core/world.js', 'core/palette.js', 'core/noise.js', 'terrain/features.js', 'world/save.js', 'world/worldmesh.js', 'water/shore.js', 'life/vegetation.js', 'terrain/generate.js'].map(load));
  return { grid, spatial, world, palette, noise, features, save, worldmesh, shore, vegetation, generate };
})() : null;
