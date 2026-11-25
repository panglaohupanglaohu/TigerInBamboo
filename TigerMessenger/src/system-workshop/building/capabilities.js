/**
 * 建筑管线 · 能力库（R56，Worker 安全：纯数据）。输入 site.field = 实景高度网格（building.probe）：
 *   { n, step, half, h[n*n]（米，null = 无地形）, cls[n*n]（0 可建地形 1 已有建筑 2 轨道）, sea }
 *   site.terrain = 'original' | 'mountain-candidate'（高山圣城上若山形候选正在预览，高度用候选山形 —— 「地形 → 建筑」两段管线的接缝）
 * 能力都真实调用重构库 src/build/prefab-socket.js（R54 / R55 嫁接：多格 prefab / socket + 联合 WFC，底下是 core/wfc.js solveWFC）。
 *   building.sites    选址       —— 建筑格聚合 + 老城保护带 / 轨道净空 / 海 / 坡度 判定可建格
 *   building.prefabs  prefab 目录 —— 选哪些多格 prefab（4 个朝向 × 每格 socket：墙 / 门）
 *   building.joint-wfc 联合 WFC 摆建筑群 —— prefab、路、空地一次解；门只对路，路接老城或别的门
 * 每个能力的契约（reads / writes / preserves）写在 meta 上（R51）；验证项由 preserves 自动生成（R52，见 verify.js）。
 * 候选只是候选：预览加一组独立网格，不碰已有建筑、不写存档；采用只记 tm.building.adopted.v1:<场景>，进游戏不自动换（待用户决定 P-R57-01）。
 */
import { latticeFromField, solveJointLayout, PREFAB_LIBRARY, validateLibrary, prefabTiles, summarizeLattice, chooseWindow } from '../../../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';
export const BUILDING_CAPABILITIES_VERSION = 1;
const LIB = 'townscaper-web/REACodeRefactoring/';
const MOD = LIB + 'src/build/prefab-socket.js';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const KEEP = ['userBuildings', 'buildingBuffer', 'railClearance', 'coastline', 'userSaves', 'lakeBuildings', 'originalTerrain'];

// 默认 4 m：实际建筑格 = round(cellSize/step)·step。在 3 m 步长的圣城采样上得 3 m 格——6 m 格会把窄台地抹进「太陡 / 老城带」，真实圣城只剩零星单格，联合 WFC 凑不齐 minBuildings；细一档后平缓台地保留成连续格，能解出建筑群（合成场地两种粒度都能过）。
const siteParams = (site) => site.plan?.sites?.params || { cellSize: 4, band: 4, railBand: 6, maxSlope: 26 };
const lattice = (site, params = siteParams(site)) => { const k = JSON.stringify(params); if (site._lat?.k !== k) site._lat = { k, lat: latticeFromField(site.field, params) }; return site._lat.lat; };

export const buildingSites = {
  meta: { id: 'building.sites', name: '建筑选址', domain: 'building', line: 'grid', requires: [],
    reads: ['heightfield', 'landMask', 'buildingMask', 'railMask', 'coastline'], writes: ['buildableMask'], preserves: KEEP,
    does: '把高度场聚成建筑格（默认 6 m 一格）；已有建筑外扩保护带、轨道净空、海 / 无地形、太陡的格都标成「保留」，其余才是可建格。',
    keywords: ['选址', '可建', '空地', '建筑', '保护带'], modules: ['src/build/prefab-socket.js'], sources: [MOD], ideas: [LIB + 'src/build/multicell.js', LIB + 'src/core/module-fit.js', 'townscaper-web/REACode/src/town.js'], learn: ['1579483114178768898'],
    params: { cellSize: { label: '建筑格边长（米，按采样步长取整）', min: 4, max: 10, step: 1, default: 4 }, band: { label: '老城保护带（米）', min: 2, max: 12, step: 1, default: 4 }, railBand: { label: '轨道净空（米）', min: 4, max: 14, step: 1, default: 6 }, maxSlope: { label: '最大坡度（°）', min: 8, max: 35, step: 1, default: 26 } } },
  match(site) { const L = lattice(site, { cellSize: 4, band: 4, railBand: 6, maxSlope: 26 }), s = summarizeLattice(L); return s.counts[0] >= 6 ? [{ id: 'buildable', cells: [], score: s.counts[0], reason: `可建格 ${s.counts[0]}（${L.cellSize} m 一格）· 老城保护 ${s.counts[1]} · 轨道 ${s.counts[2]} · 海 ${s.counts[3]} · 太陡 ${s.counts[4]}` }] : []; },
  run(site, { params }) {
    site.plan.sites = { params: { cellSize: params.cellSize, band: params.band, railBand: params.railBand, maxSlope: params.maxSlope } };
    const L = lattice(site), s = summarizeLattice(L); site.plan.sites.counts = s.counts; site.plan.sites.W = L.W; site.plan.sites.cellSize = L.cellSize;
    return { applied: s.counts[0] ? ['buildable'] : [], changed: [`${L.W}×${L.H} 建筑格（${L.cellSize} m）：可建 ${s.counts[0]} · 老城保护 ${s.counts[1]} · 轨道净空 ${s.counts[2]} · 海 / 无地形 ${s.counts[3]} · 太陡 ${s.counts[4]}`] };
  },
};

const PREFAB_PARAMS = Object.fromEntries(PREFAB_LIBRARY.map((p) => [p.id, { label: `${p.name}（${p.cells.length} 格 · ${p.stories} 层）`, type: 'bool', default: true }]));
export const buildingPrefabs = {
  meta: { id: 'building.prefabs', name: '多格 prefab 目录', domain: 'building', line: 'wfc', requires: [],
    reads: [], writes: ['prefabCatalog'], preserves: ['userSaves'],
    does: '选这次能用的多格 prefab：每种 × 4 个朝向拆成部件 tile，部件之间贴私有配对标签（整块出现），外边贴 socket（墙 / 门）。',
    keywords: ['prefab', 'socket', '多格', '房子', '模块', '宅', '礼拜堂'], modules: ['src/build/prefab-socket.js'], sources: [MOD], ideas: [LIB + 'src/core/wfc.js', LIB + 'src/build/multitile-wfc.js', 'townscaper-web/REACode/src/town.js'], learn: ['1751932427272909032', '1579483114178768898'],
    params: PREFAB_PARAMS },
  match() { const v = validateLibrary(); return v.ok ? [{ id: 'catalog', cells: [], score: PREFAB_LIBRARY.length, reason: `${PREFAB_LIBRARY.length} 种 prefab：${PREFAB_LIBRARY.map((p) => p.name).join('、')}` }] : []; },
  run(site, { params }) {
    const ids = PREFAB_LIBRARY.filter((p) => params[p.id] !== false).map((p) => p.id);
    const lib = PREFAB_LIBRARY.filter((p) => ids.includes(p.id)), v = validateLibrary(lib), { tiles } = prefabTiles(lib);
    site.plan.prefabs = { ids, tiles: tiles.length, library: lib.map((p) => ({ id: p.id, name: p.name, cells: p.cells.map((c) => [c[0], c[1]]), door: [p.door[0], p.door[1]], stories: p.stories, tower: p.tower ?? null })) };
    return { applied: ids.length && v.ok ? ['catalog'] : [], changed: [ids.length ? `${ids.length} 种 prefab × 4 朝向 = ${tiles.length} 个部件 tile${v.ok ? '' : '；库有问题：' + v.errors.join('、')}` : '一种 prefab 都没选'] };
  },
};

export const buildingJointWfc = {
  meta: { id: 'building.joint-wfc', name: '联合 WFC 摆建筑群', domain: 'building', line: 'building', requires: ['building.sites', 'building.prefabs'],
    reads: ['buildableMask', 'prefabCatalog', 'heightfield'], writes: ['buildingLayout', 'roadNetwork'], preserves: KEEP,
    does: '在可建格最多的一块窗口里，用 core/wfc.js 把 prefab（放哪种、朝哪、放在哪）、路、空地一次解出来：足迹要平、门只对着路、路接老城或别的门。换种子 = 整体换一组。',
    keywords: ['建筑群', '城镇', '聚落', '村', '房', 'wfc', '联合', '路网'], modules: ['src/build/prefab-socket.js', 'src/core/wfc.js'], sources: [MOD, LIB + 'src/core/wfc.js'], ideas: [LIB + 'src/build/tile-assembly.js'], learn: ['1751932427272909032', '1579483114178768898', '1164926304640229376'],
    params: { seed: { label: '种子（换一个 = 整体换一组）', min: 1, max: 999, step: 1, default: 7 }, span: { label: '窗口边长（建筑格）', min: 8, max: 24, step: 1, default: 16 }, density: { label: 'prefab 密度', min: 0.3, max: 3, step: 0.1, default: 1 },
      maxStep: { label: '足迹内最大高差（米，台基补平）', min: 0.3, max: 6, step: 0.1, default: 3 }, minBuildings: { label: '至少几栋', min: 1, max: 20, step: 1, default: 3 } } },
  match(site) { const L = lattice(site, { cellSize: 4, band: 4, railBand: 6, maxSlope: 26 }), w = chooseWindow(L, 16); return w.buildable >= 6 ? [{ id: 'window', cells: [], score: w.buildable, reason: `窗口 ${w.w}×${w.h} 格里可建 ${w.buildable} 格` }] : []; },
  run(site, { params }) {
    const prefabs = site.plan.prefabs?.ids || PREFAB_LIBRARY.map((p) => p.id);
    const res = solveJointLayout(site.field, { ...siteParams(site), prefabs, seed: params.seed, span: params.span, density: params.density, maxStep: params.maxStep, minBuildings: params.minBuildings });
    site.plan.solve = { ok: res.ok, reason: res.reason || null, tries: (res.tries || []).map((t) => ({ seed: t.seed, ok: t.ok, reason: t.reason, steps: t.steps, backtracks: t.backtracks })) };
    if (!res.ok) { site.plan.layout = null; return { applied: [], changed: [res.reason] }; }
    site.plan.layout = res.layout;
    const s = res.stats;
    return { applied: ['layout'], changed: [`${s.buildings} 栋（${Object.entries(s.byPrefab).map(([k, v]) => (PREFAB_LIBRARY.find((p) => p.id === k)?.name || k) + ' ' + v).join('、')}）· 路 ${s.roadCells} 格 · 种子 ${res.layout.seed}${res.tries.length > 1 ? `（试了 ${res.tries.length} 次）` : ''}`] };
  },
};

export const BUILDING_CAPABILITIES = [buildingSites, buildingPrefabs, buildingJointWfc];
const byId = new Map(BUILDING_CAPABILITIES.map((c) => [c.meta.id, c]));
export function describeBuildingCapabilities() { return BUILDING_CAPABILITIES.map(({ meta }) => ({ ...meta, params: meta.params || {}, executable: true })); }
const defaults = (meta, params = {}) => Object.fromEntries(Object.entries(meta.params || {}).map(([k, p]) => [k, p.type === 'bool' ? (typeof params[k] === 'boolean' ? params[k] : p.default) : clamp(+(params[k] ?? p.default), p.min ?? -Infinity, p.max ?? Infinity)]));
export function matchAll(site) {
  return BUILDING_CAPABILITIES.map((cap) => { let rows = []; try { rows = cap.match(site); } catch (e) { return { id: cap.meta.id, error: e.message, count: 0, targets: [] }; } return { id: cap.meta.id, count: rows.length, targets: rows }; });
}
/** 执行：按传入顺序（PipeLineEngine 已保证 requires 在前）。plan = { sceneId, terrain, sites, prefabs, solve, layout }。 */
export function runPlan(site, steps, onStep = () => {}) {
  const report = []; site.plan = { sceneId: site.scene?.id || null, terrain: site.terrain || 'original', mountainSig: site.mountainSig ?? null }; delete site._lat;
  for (const step of steps) {
    const cap = byId.get(step.id); if (!cap) { report.push({ id: step.id, status: 'error', error: '能力库里没有这个能力' }); continue; }
    const params = defaults(cap.meta, step.params); onStep(step.id);
    const t0 = Date.now(), out = cap.run(site, { params });
    report.push({ id: step.id, line: cap.meta.line, status: out.applied.length ? 'applied' : 'no-target', applied: out.applied, changed: out.changed || [], ms: Date.now() - t0, params });
  }
  delete site._lat;
  return report;
}
