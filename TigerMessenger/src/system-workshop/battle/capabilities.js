/**
 * 战役管线 · 能力库（Worker 安全：纯数据，不 import three / DOM）。
 *
 * 输入 input = 实景战斗舞台的采样报告（pipeline-bridge 的 battle.probe 产出）：
 *   { scene:{id,label}, site:{meshes,cells,land,maxLevel,houses,scale,gridRadius,unitHeight,plateauRaised} }
 * 能力在 input.plan 上累积作战计划；预览时由实景里的 sceneBattle.js 按计划真正开战。
 *
 *   battle.stage     部署战斗舞台 —— 采样尺度 / 网格半径 / 士兵身高
 *   battle.garrison  守军布防     —— 默认 3 队之外增援的守军队数、兵种与规模
 *   battle.waves     登陆波次     —— 首波提前量与波次间隔
 * R34–R36 起追加三个导航能力（能力线 navigation，见 nav-capabilities.js）：
 *   battle.navFinePortals 拱洞精细门户 / battle.navTraffic 窄道会车 / battle.navFooting 穿洞与脚高插值
 * 它们读 input.nav（battle.probe 的导航采样），在 Worker 里真实调用 vendor 副本的 BattleNavigation。
 */
import { NAV_CAPABILITIES } from './nav-capabilities.js?v=contract-r1';
export const BATTLE_CAPABILITIES_VERSION = 2;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const battleStage = {
  meta: {
    id: 'battle.stage', name: '部署战斗舞台', domain: 'battle', line: 'combat',
    does: '在选定场景局部采样出一块 REA 战斗舞台：地形网格、海线、台地与小屋目标。',
    keywords: ['战斗', '战役', '舞台', '部署', 'bad north', '登陆'], related: ['959530111187013632', '946660607008403456'], ideas: ['townscaper-web/REACode/src/walkreach.js'],
    modules: ['src/badnorth/battle.js', 'src/core/grid.js', 'src/core/spatial.js', 'src/core/world.js', 'src/world/worldmesh.js'],   // 实景预览经 reaBattleStage 真实调用（vendor 副本）
    reads: ['heightfield', 'landMask', 'buildingMask'], writes: ['battleStage'], preserves: ['userBuildings', 'userSaves'],
    params: {
      scale: { label: '舞台尺度（米/格）', min: 2, max: 10, step: 0.5, default: 5 },
      gridRadius: { label: '网格半径（格）', min: 10, max: 24, step: 1, default: 18 },
      unitHeight: { label: '士兵身高（米）', min: 1.2, max: 2.2, step: 0.1, default: 1.7 },
    },
  },
  match(site) {
    if (!site?.land) return [];
    return [{ id: site.scene?.id || 'site', cells: [], score: site.land, reason: `陆地 ${site.land} 格 · 最高 ${site.maxLevel} 层 · 小屋 ${site.houses}` }];
  },
  run(site, { params }) {
    site.plan ||= {};
    site.plan.scale = params.scale; site.plan.gridRadius = params.gridRadius; site.plan.unitHeight = params.unitHeight;
    return { applied: [site.scene?.id || 'site'], changed: [`舞台 ${params.gridRadius * 2}×${params.gridRadius * 2} 格 · ${params.scale} 米/格 · 士兵 ${params.unitHeight} 米`] };
  },
};

export const battleGarrison = {
  meta: {
    id: 'battle.garrison', name: '守军布防', domain: 'battle', line: 'combat',
    does: '在小屋台地追加守军小队（Bad North 原生小队：矛 / 盾刀 / 弓循环，可指定人数与装备等级）。',
    keywords: ['守军', '布防', '小队', '防守', '弓手', '增援'], related: ['839067977781768193', '946660607008403456'], ideas: ['townscaper-web/REACode/src/combatfx.js'],
    modules: ['src/badnorth/battle.js', 'src/badnorth/squad-hud.js'],
    requires: ['battle.stage'],
    reads: ['battleStage'], writes: ['garrison'], preserves: ['userSaves'],
    params: {
      squads: { label: '增援小队数', min: 0, max: 5, step: 1, default: 1 },
      size: { label: '每队人数', min: 4, max: 14, step: 1, default: 8 },
      tier: { label: '装备等级', min: 0, max: 3, step: 1, default: 1 },
      archer: { label: '含弓手队', type: 'bool', default: true },
    },
  },
  match(site) {
    if (!site?.houses) return [];
    return [{ id: 'houses', cells: [], score: site.houses * 10, reason: `${site.houses} 个小屋目标可驻守` }];
  },
  run(site, { params }) {
    site.plan ||= {};
    site.plan.garrison = { squads: params.squads, size: params.size, tier: params.tier, archer: params.archer };
    return { applied: params.squads ? ['houses'] : [], changed: [params.squads ? `增援 ${params.squads} 队 × ${params.size} 人 · 装备 ${params.tier} 级${params.archer ? ' · 含弓手' : ''}` : '不增援，仅默认 3 队守军'] };
  },
};

export const battleWaves = {
  meta: {
    id: 'battle.waves', name: '登陆波次', domain: 'battle', line: 'combat',
    does: '调整维京长船首波到达时间与后续波次间隔（Bad North 原生波次循环）。',
    keywords: ['维京', '登陆', '波次', '长船', '进攻'], related: ['974325184525201409'],
    modules: ['src/badnorth/battle.js', 'src/badnorth/landing-plan.js'],
    requires: ['battle.stage'],
    reads: ['battleStage'], writes: ['waves'], preserves: ['userSaves'],
    params: {
      firstWave: { label: '首波到达（秒）', min: 1, max: 15, step: 1, default: 3 },
      interval: { label: '波次间隔（秒）', min: 8, max: 60, step: 1, default: 26 },
    },
  },
  match(site) {
    if (!site?.land) return [];
    return [{ id: 'coast', cells: [], score: site.land, reason: '海岸线上有维京人可登陆的滩头' }];
  },
  run(site, { params }) {
    site.plan ||= {};
    site.plan.waves = { first: params.firstWave, interval: params.interval };
    return { applied: ['coast'], changed: [`首波 ${params.firstWave}s · 之后每 ${params.interval}s 一波`] };
  },
};

export const BATTLE_CAPABILITIES = [battleStage, battleGarrison, battleWaves, ...NAV_CAPABILITIES];
const byId = new Map(BATTLE_CAPABILITIES.map((c) => [c.meta.id, c]));

/** 只读描述（工坊 UI）：可 JSON 化 */
export function describeBattleCapabilities() {
  return BATTLE_CAPABILITIES.map(({ meta }) => ({ ...meta, params: meta.params || {}, executable: true }));
}

const defaults = (meta, params = {}) => Object.fromEntries(Object.entries(meta.params || {}).map(([k, p]) =>
  [k, p.type === 'bool' ? !!(params[k] ?? p.default) : clamp(+(params[k] ?? p.default), p.min ?? -Infinity, p.max ?? Infinity)]));

/** 扫描：每个能力在当前舞台采样上是否可作用 */
export function matchAll(site) {
  return BATTLE_CAPABILITIES.map((cap) => {
    let rows = [];
    try { rows = cap.match(site, {}, defaults(cap.meta)); } catch (e) { return { id: cap.meta.id, error: e.message, count: 0, targets: [] }; }
    return { id: cap.meta.id, count: rows.length, targets: rows.slice(0, 12) };
  });
}

/** 执行：按顺序在 site.plan 上累积作战计划 */
export function runPlan(site, steps, onStep = () => {}) {
  const report = [];
  site.plan = {};
  for (const step of steps) {
    const cap = byId.get(step.id);
    if (!cap) { report.push({ id: step.id, status: 'error', error: '能力库里没有这个能力' }); continue; }
    const params = defaults(cap.meta, step.params);
    onStep(step.id);
    const t0 = Date.now(), out = cap.run(site, { targets: step.targets || cap.match(site, {}, params), params, ctx: {} });
    report.push({ id: step.id, line: cap.meta.line, status: out.applied.length ? 'applied' : 'no-target', applied: out.applied, changed: out.changed || [], ms: Date.now() - t0, params });
  }
  return report;
}
