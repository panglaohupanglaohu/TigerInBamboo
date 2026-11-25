/**
 * 战役管线 · 导航能力（Guide §9 D 组 R34–R36，能力线 navigation）。Worker 安全：只 import nav-lab.js（vendor 副本的导航模块）。
 *
 * 输入 site.nav = 实景战斗舞台的导航采样（sceneBattle.probeSceneBattle 产出：每格的实心层位掩码 + 拱洞挖空后的版本）。
 * run 在 Worker 里把采样重建成 REA World，真实调用 BattleNavigation / fine-portals / traffic 算出报告，写进 site.plan.navigation；
 * 预览时 sceneBattle.deploySceneBattle 按 plan.navigation 打开对应开关。所有开关默认关，只在这条管线的候选里打开。
 *
 *   battle.navFinePortals  拱洞精细门户   单位从拱洞里穿过而不是穿墙（finePortals + 实景拱洞挖空）
 *   battle.navTraffic      窄道会车       弯道 / 岔口统计、不同体型重新选路、两队对向会车模拟；实景里给每队 1/4 的人换大个子体型
 *   battle.navFooting      穿洞与脚高插值 洞道里脚贴洞底、楼梯按踏面插值；实景里画面脚高按洞底 / 踏面修正（只改画，不改战斗逻辑）
 */
import { envFromNavSample, columnStats, finePortalReport, trafficReport, footingReport, corridorStats, NAV_MODULES, UNIT_HEIGHT, BODY_RADIUS } from './nav-lab.js?v=nav-r1';

const ORIGINALS = ['townscaper-web/REACode/src/cheesenav.js', 'townscaper-web/REACode/src/holenav.js'];
const CLIPS_HOLES = ['906425294533394432', '797119718477991936'];
/** 舞台单位里的身高：plan.unitHeight 米 ÷ 舞台尺度（与 reaBattleStage 画单位的放大倍数同口径）；没有就用 REA 原值 0.18 */
export function stageUnitHeight(site, params = {}) {
  if (params.unitHeight > 0) return +params.unitHeight;
  const plan = site?.plan || {}, h = plan.unitHeight ?? site?.unitHeight, s = plan.scale ?? site?.scale;
  return h > 0 && s > 0 ? +(h / s).toFixed(3) : (site?.nav?.unitHeight > 0 ? site.nav.unitHeight : UNIT_HEIGHT);
}
const envOf = (site, hollow) => envFromNavSample(site.nav, { hollow });
const plan = (site) => { site.plan ||= {}; site.plan.navigation ||= {}; return site.plan.navigation; };

export const navFinePortals = {
  meta: {
    id: 'battle.navFinePortals', name: '拱洞精细门户', domain: 'battle', line: 'navigation', added: '2026-11-23',
    does: '单位从拱洞里穿过而不是穿墙：门户按拱下几何收窄、拱脚处加形变侧壁（fine-portals）；实景采样里头顶有悬垂的格子按多层射线挖出洞（开关，默认关）。',
    keywords: ['拱洞', '拱门', '门户', '侧壁', '穿墙', '洞道', '瑞士奶酪', '导航'],
    clips: CLIPS_HOLES, sources: ORIGINALS,
    modules: [NAV_MODULES.navigation, NAV_MODULES.fine, NAV_MODULES.layered, NAV_MODULES.arch],
    requires: ['battle.stage'],
    reads: ['battleStage'], writes: ['battleStage'], preserves: ['userSaves'],
    params: {
      arches: { label: '实景拱洞挖空', type: 'bool', default: true },
      unitHeight: { label: '身高（舞台单位，0 = 按士兵身高 ÷ 尺度）', min: 0, max: 1.2, step: 0.02, default: 0 },
    },
  },
  match(site) {
    const n = site?.nav; if (!n) return [];
    const cs = columnStats(n.solid), arches = n.arches || 0;
    if (!arches && !cs.hollowCols) return [];
    return [{ id: 'arches', cells: [], score: arches + cs.hollowCols, reason: `实景拱洞候选 ${arches} 列 · 采样里已有洞道 ${cs.hollowCols} 列` }];
  },
  run(site, { params }) {
    const hollow = !!params.arches && Array.isArray(site.nav?.hollow), h = stageUnitHeight(site, params);
    const rep = finePortalReport(envOf(site, hollow), { unitHeight: h });
    Object.assign(plan(site), { finePortals: true, arches: hollow, unitHeight: h, fine: rep });
    return { applied: rep.fine.covered ? ['arches'] : [], changed: [
      `拱下节点 ${rep.fine.archNodes} · 平底洞 ${rep.fine.flatNodes} · 收窄门户 ${rep.fine.narrowed} · 封死 ${rep.fine.closed} · 侧壁 ${rep.fine.sideWalls}`,
      `穿墙探针 ${rep.probes.probes} 处：关时放得下身体 ${rep.probes.offFits}，开后拦下 ${rep.probes.offFitsOnBlocked}`,
      `穿拱模拟 ${rep.crossings} 处：开 到达 ${rep.on.arrived} / 穿拱 ${rep.on.through} / 擦墙帧 ${rep.on.clips}；关 擦墙帧 ${rep.off.clips}`,
    ] };
  },
};

export const navTraffic = {
  meta: {
    id: 'battle.navTraffic', name: '窄道会车', domain: 'battle', line: 'navigation', added: '2026-11-23',
    does: '弯道、岔口、不同体型重新选路：统计窄道 / 弯道 / 岔口，按体型（大个子放不进窄门）重算路线，并在最长的窄道里模拟两队对向会车（左行车道 + 软分离）。实景里每队 1/4 的人换成大个子体型（开关）。',
    keywords: ['窄道', '会车', '让路', '弯道', '岔口', '体型', '重新选路', '左行'],
    clips: ['880853661936734211'], sources: ['townscaper-web/REACode/src/holenav.js'],
    modules: [NAV_MODULES.navigation, NAV_MODULES.traffic, NAV_MODULES.layered, NAV_MODULES.navgraph],
    requires: ['battle.stage'],
    reads: ['battleStage'], writes: ['battleStage'], preserves: ['userSaves'],
    params: {
      heavyRadius: { label: '大个子身体半径（舞台单位）', min: 0.06, max: 0.2, step: 0.01, default: 0.12 },
      heavyShare: { label: '实景里每队换大个子的比例', min: 0, max: 0.5, step: 0.05, default: 0.25 },
      squad: { label: '会车模拟每队人数', min: 1, max: 6, step: 1, default: 3 },
    },
  },
  match(site) {
    if (!site?.nav) return [];
    const cs = corridorStats(envOf(site, false));
    if (!cs.corridors) return [];
    return [{ id: 'corridors', cells: [], score: cs.corridors, reason: `窄道 ${cs.corridors} 格 · 弯道 ${cs.curves} · 岔口 ${cs.forks}` }];
  },
  run(site, { params }) {
    const n = site.plan?.navigation || {}, hollow = !!n.arches && Array.isArray(site.nav?.hollow), h = n.unitHeight ?? stageUnitHeight(site);
    const rep = trafficReport(envOf(site, hollow), { unitHeight: h, heavyRadius: params.heavyRadius, squad: params.squad, radius: BODY_RADIUS });
    Object.assign(plan(site), { traffic: { heavyRadius: params.heavyRadius, heavyShare: params.heavyShare, squad: params.squad, unitHeight: h, report: rep } });
    const m = rep.meeting;
    return { applied: rep.corridors ? ['corridors'] : [], changed: [
      `窄道 ${rep.corridors} 格 · 弯道 ${rep.curves} · 岔口 ${rep.forks} · 窄门会车冲突 ${rep.laneConflicts}`,
      `体型重路由：${rep.reroute.pairs} 对起终点里大个子绕路 ${rep.reroute.rerouted}、走不通 ${rep.reroute.blocked}（最大绕路 ×${rep.reroute.maxDetour}）`,
      m ? `对向会车（窄道 ${m.corridor} 格）：${m.arrived}/${m.total} 到达（大个子 ${m.heavyArrived}/${m.heavyTotal}）· 用了 ${m.frames} 帧 · 最长原地 ${m.stuckMax} 帧` : '没有能做会车模拟的窄道',
    ] };
  },
};

export const navFooting = {
  meta: {
    id: 'battle.navFooting', name: '穿洞与脚高插值', domain: 'battle', line: 'navigation', added: '2026-11-23',
    does: '洞道里脚贴洞底而不是洞顶，楼梯上脚高按踏面一级级插值（BattleNavigation.footHeight / stairAt）；实景里画面上的脚高按洞底 / 踏面修正（只改画的位置，不改战斗逻辑）。',
    keywords: ['穿洞', '洞道', '脚高', '插值', '楼梯', '踏面', '悬空', '埋地'],
    clips: ['906425294533394432', '828984794407170048'], sources: ['townscaper-web/REACode/src/cheesenav.js'],
    modules: [NAV_MODULES.navigation, NAV_MODULES.fine, NAV_MODULES.layered, NAV_MODULES.navgraph],
    requires: ['battle.stage'],
    reads: ['battleStage'], writes: ['battleStage'], preserves: ['userSaves'],
    params: {
      routes: { label: '逐帧采样路线数', min: 2, max: 12, step: 1, default: 6 },
    },
  },
  match(site) {
    const n = site?.nav; if (!n) return [];
    const cs = columnStats(n.solid), env = envOf(site, false), stairs = footingStairs(env);
    if (!stairs && !cs.hollowCols && !n.arches) return [];
    return [{ id: 'footing', cells: [], score: stairs + cs.hollowCols + (n.arches || 0), reason: `楼梯 ${stairs} 架 · 洞道列 ${cs.hollowCols} · 拱洞候选 ${n.arches || 0}` }];
  },
  run(site, { params }) {
    const n = site.plan?.navigation || {}, hollow = !!n.arches && Array.isArray(site.nav?.hollow), h = n.unitHeight ?? stageUnitHeight(site);
    const rep = footingReport(envOf(site, hollow), { unitHeight: h, maxRoutes: params.routes });
    Object.assign(plan(site), { footing: { routes: params.routes, unitHeight: h, report: rep } });
    return { applied: rep.stairs || rep.covered ? ['footing'] : [], changed: [
      `楼梯 ${rep.stairs} 架：踏面最大一步 ${rep.stairMaxStep}（不插值一步 ${rep.stairFlatStep}）`,
      `洞道节点 ${rep.covered}：脚高不在洞底的 ${rep.tunnelErrors} 个（洞顶比洞底高 ${rep.roofGap}）`,
      `逐帧 ${rep.walk.samples} 帧：脚高最大跳变 ${rep.walk.maxJumpFoot}（不插值 ${rep.walk.maxJumpFlat}）· 楼梯帧 ${rep.walk.stairFrames} · 洞道帧 ${rep.walk.tunnelFrames}`,
    ] };
  },
};
function footingStairs(env) { return corridorStats(env).surface.stairs.length; }

export const NAV_CAPABILITIES = [navFinePortals, navTraffic, navFooting];
