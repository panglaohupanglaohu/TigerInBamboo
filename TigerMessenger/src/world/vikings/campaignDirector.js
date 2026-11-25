// 维京远征 · 战役导演（2026-11-09，规划 §4.1，P3 起；2026-11-10：可跨铁轨航线 + 战前约 10 分钟离港；
//   2026-11-16 用户：主战场从苔庭改到十二门徒——apostles 场景已有 deploySceneBattle / battle-apostles e2e 实测，与 REA 战斗接入同口径）。
// muster（登船，bookshopBoarding）→ sail-<site>（vikingVoyage：两船编队到主战场外锚地）→ hold-<site>（锚地待命）
//   → <site>（主战场之战）→ reembark（回船）→ sail-citadel → citadel（P4）→ done
// 主战场站（battleSite）：默认 'apostles'；?vikingSite=moss 或 createVikingCampaign({site:'moss'}) 切回苔庭战役。
//   apostles：守军 = REA 默认 3 队（岩群无本地驻军编制，不写假守军），舞台 scale 5 / 半径 18 格（sceneBattle PRESETS 实测口径）。
//   moss：守军 = 西芳寺方阵接管（romanizeMossDefenders），舞台 scale 4 / 半径 9 格，固化航线表兜底——原苔庭路径完整保留。
// 阶段 id 随站走（sail-apostles / hold-apostles / apostles …），main.js 的霸天门按 vikingCampaign.battleSite 对齐。
// 主战场之战的兵源对接（REA 的 Battle 自己按波次放长船，每波 6 + 2×波次人，最多 12）：
//   大船在锚地不动，REA 长船 = 大船放下的登陆艇；每来一波就从两船「舱内」人数里扣掉这波人数（轮流扣），扣完就不再来船（battle.nextWave = ∞）。
// 回船（REA 没有，新写，小）：时限到 / 守军全灭 → 活着的维京人走回各自登陆的滩格，到了就离开战场，人数加回大船。
// 时间线（用户 2026-11-10）：离港 = 主战场开战 − 约 10 分钟；铁轨可跨，A* 航线（苔庭实测李白 ~449 m / Duke ~323 m），巡航 15 m/s。
import * as THREE from 'three';
import { createWarshipWaterRoutes } from '../warshipWaterRoutes.js';
import { planBookshopToSite, planVoyageAstar, findAnchorage, createShipPilot, createVoyageObstacles, VOYAGE_TIMING, BOOKSHOP_TO_MOSS_ROUTE, estimateSiteBattleEtaSec, scheduleBeforeBattle, resolveVikingSite } from './vikingVoyage.js';
import { ReaBattleStage, SOLDIER_HEIGHT_M } from '../rea/reaBattleStage.js';
import { createCitadelBattle } from './citadelBattle.js';
import { romanizeMossDefenders } from './mossDefenders.js';
import { createVikingBatianAttack } from './mossBatianAttack.js';
import { saihojiBattleTrigger } from '../saihojiBattleTrigger.js';

// 各主战场站的舞台尺度：apostles 用 sceneBattle PRESETS 里实测过的 5 / 18；moss 用苔庭战役原值 4 / 9。
const SITE_PRESETS = {
  apostles: { scale: 5, gridRadius: 18 },
  moss: { scale: 4, gridRadius: 9 },   // 苔庭原值：scale 4 + 半径 ceil(36/4)=9，舞台直径约 36 m
};
const SITE_LABEL = { apostles: '十二门徒', moss: '苔庭' };

export function createVikingCampaign({ scene, camera, boarding, targets, site = null, battleSeconds = null, mossSeconds = 150, onPhase = () => {}, getFleet = () => scene.userData.batianFleet || null, syncBatian = true } = {}) {
  let SITE = site || resolveVikingSite();
  const battleLimitSec = battleSeconds ?? mossSeconds;   // 主战场时限（mossSeconds 为苔庭战役时期留下的兼容键名）
  const dirOf = (id) => targets().find((t) => t.id === id)?.dir?.clone().normalize() || null;
  const label = () => targets().find((t) => t.id === SITE)?.label || SITE_LABEL[SITE] || SITE;
  // 主战场站不在目标表里时自动退化到苔庭（apostles 目标缺失时战役不卡死）
  const ensureSite = () => { if (!dirOf(SITE) && SITE !== 'moss' && dirOf('moss')) SITE = 'moss'; return dirOf(SITE); };
  const sailPhase = () => 'sail-' + SITE, holdPhase = () => 'hold-' + SITE;
  let planning = false, roman = null, citadel = null, seenBoats = new WeakSet(), phase = 'muster', pilots = [], stage = null, t = 0, lastWave = 0, turn = 0, landing = [], log = [];
  let routeMeta = null, holdReady = false, batianAttack = null;
  const ships = boarding.ships;
  const say = (p, note = '') => {
    phase = p; t = 0; log.push({ phase: p, note, at: performance.now() });
    const L = label();
    boarding.phase = { [sailPhase()]: `驶向${L}`, [holdPhase()]: `${L}锚地待命`, [SITE]: `${L}之战`, reembark: '回船', 'sail-citadel': '驶向高山圣城', citadel: '高山圣城之战', done: '远征结束' }[p] || p;
    onPhase(p, note);
  };

  // 航线异步算；集结一开始就预计算，离港时直接驾船（不再等 10–40 s）
  const HALF_BEAM = { leebai: 6.85, duke: 4.3 };
  const cruiseSpeed = () => Math.max(0.5, Number(new URLSearchParams(location.search).get('vikingSpeed')) || VOYAGE_TIMING.cruiseSpeedMps);   // ?vikingSpeed= 米/秒
  function preplanSite() {
    if (planning || routeMeta?.ok) return;
    const centre = ensureSite(); if (!centre) return;
    const solver = createWarshipWaterRoutes(scene, 160);
    const obstacles = createVoyageObstacles(scene);
    planning = true;
    (async () => {
      const out = [], meta = [];
      for (const [k, s] of ships.entries()) {
        const from = (s.posWorld || s.root.getWorldPosition(new THREE.Vector3())).clone().normalize();
        const margin = (HALF_BEAM[s.id] ?? 6) + 2.5;
        // 主锚地找不到（十二门徒是海上岩柱群，近岸可能没有船宽走廊）→ 放宽再搜一轮；仍没有才退回战场中心方向
        const anch = findAnchorage(solver, centre, from, { minDist: 48 + k * 16, margin, obstacles })
          || findAnchorage(solver, centre, from, { minDist: 80, maxDist: 260, margin: Math.max(3, margin - 3), obstacles })
          || centre;
        const plan = await planBookshopToSite(solver, from, anch, { site: SITE, shipId: s.id === 'duke' ? 'duke' : 'lee', obstacles, speed: cruiseSpeed() });
        s.plan = plan; s.anchorage = anch;
        meta.push({ id: s.id, len: Math.round(plan.length), sailSec: Math.round(plan.sailSec), source: plan.source, pts: plan.points.length });
        out.push({ ship: s, points: plan.points, speed: plan.speed });
      }
      routeMeta = { ok: true, site: SITE, legs: meta, obstacles: { crossRails: true }, timing: VOYAGE_TIMING, table: SITE === 'moss' ? { lee: BOOKSHOP_TO_MOSS_ROUTE.lee.lengthM, duke: BOOKSHOP_TO_MOSS_ROUTE.duke.lengthM } : null };
      // 先存点列；真正离港后再 createShipPilot（载具组要先建好）
      ships._pendingSite = out;
      planning = false;
      log.push({ phase: 'preplan-' + SITE, note: meta.map((m) => `${m.id}:${m.len}m/${m.sailSec}s/${m.source}`).join(' · '), at: performance.now() });
    })().catch((e) => { console.warn('[vikingVoyage]', e); planning = false; routeMeta = { ok: false, site: SITE, error: String(e) }; });
  }

  function sailTo(id) {
    const centre = dirOf(id); if (!centre) return false;
    // 主战场：用预计算；圣城：现算（同样可跨铁轨）
    if (id === SITE && ships._pendingSite?.length) {
      pilots = ships._pendingSite.map(({ ship, points, speed }) => createShipPilot(ship, points, { speed, lookahead: 12 }));
      ships._pendingSite = null;
      return true;
    }
    const solver = createWarshipWaterRoutes(scene, 160);
    const obstacles = createVoyageObstacles(scene);
    // 2026-11-10 用户：「这条船应该停在旧城的码头」——上一版锚地按圣城中心外 48 m 找水，落在双层轨桥底下。
    // 圣城：锚地改到旧城码头（旧港整组贴在圣城岸湾，target 'old-port'），离码头 14 m 起找；找锚地时轨桥 / 高架算障碍（航行时仍可从桥下穿）。
    const quay = id === 'citadel' ? dirOf('old-port') : null;
    const berthObstacles = id === 'citadel' ? createVoyageObstacles(scene, { crossRails: false }) : obstacles;
    pilots = []; planning = true;
    (async () => {
      const out = [];
      for (const [k, s] of ships.entries()) {
        const from = s.posWorld.clone().normalize(), margin = (HALF_BEAM[s.id] ?? 6) + 2.5;
        const anch = (quay && findAnchorage(solver, quay, from, { minDist: 14 + k * 14, maxDist: 90, margin, obstacles: berthObstacles })) || findAnchorage(solver, centre, from, { minDist: 48 + k * 16, margin, obstacles: berthObstacles }) || centre;
        s.berth = quay ? 'old-city-quay' : null;
        let plan;
        if (id !== 'citadel') {
          // 主战场（预计算没赶上时的现算兜底）：apostles / moss 都走 planBookshopToSite（moss 内有固化表兜底，apostles 有绕行 / 直线兜底）
          plan = await planBookshopToSite(solver, from, anch, { site: id, shipId: s.id === 'duke' ? 'duke' : 'lee', obstacles, speed: cruiseSpeed() });
        } else {
          const clearance = s.id === 'duke' ? 7 : 9;
          plan = await planVoyageAstar(solver, from, anch, { step: 8, band: 220, clearance, obstacles, maxNodes: 100000 });
          plan.speed = VOYAGE_TIMING.dashSpeedMps;
          plan.sailSec = (plan.length || 0) / plan.speed;
          plan.source = plan.ok ? 'astar' : 'astar-failed';
        }
        s.plan = plan; s.anchorage = anch;
        out.push(createShipPilot(s, plan.points, { speed: plan.speed || VOYAGE_TIMING.dashSpeedMps }));
      }
      pilots = out; planning = false;
    })().catch((e) => { console.warn('[vikingVoyage]', e); planning = false; });
    return true;
  }

  function battleReady() {
    if (!syncBatian) return true;
    const fleet = getFleet?.();
    if (!fleet) return t > VOYAGE_TIMING.holdAfterArriveSec;   // 无霸天：到锚地稍等就开打（测试）
    const hub = dirOf(SITE);
    const trig = saihojiBattleTrigger(fleet, hub ? { x: hub.x, y: hub.y, z: hub.z } : null, 160, SITE);
    if (trig.allowed) return true;
    // 霸天已在主战场进场但还没开火：继续等；若等太久（测试）也放行
    const snap = fleet.snapshot?.() || {};
    if (snap.target === SITE && ['assemble', 'transit', 'blockade', 'pincer', 'cannon', 'guard'].includes(snap.phase)) {
      return t > Math.max(VOYAGE_TIMING.holdAfterArriveSec, 300);   // 霸天已来主战场：最多等 5 分钟它开火
    }
    // 未开自动战役：到锚地后短等即开打，不堵测试
    if (!fleet.active && snap.phase === 'idle') return t > VOYAGE_TIMING.holdAfterArriveSec;
    return t > 600;   // 霸天还在打前一站（main.js 霸天门让它等维京到锚地后才出征主战场）：最多等 10 分钟
  }

  function startSiteBattle() {
    const dir = dirOf(SITE);
    // 苔庭战役原备注（2026-11-10 用户：苔庭士兵偏小（scale 2 时约 0.36 m）→ 恢复 1.7 m，长船同比放大；
    //   一格 4 m（scale 2 时 2 m）：只放大单位不加大格子会让 REA 的交战距离 / 站位全失真；格子也不能大到 9 m（REA 原比例），苔庭陆地只有约 30 m 宽。
    //   折中：scale 4 + 单位 / 长船再 ×2.36 → 人 1.7 m；舞台半径保持约 36 m）。
    // 十二门徒用 sceneBattle PRESETS 实测口径 scale 5 / 半径 18 格（≈90 m 覆盖岩柱群）。
    const q = new URLSearchParams(location.search), PRE = SITE_PRESETS[SITE] || SITE_PRESETS.moss;
    const S = Math.max(2, Number(q.get('vikingBattleScale')) || Number(q.get('mossScale')) || PRE.scale);   // ?vikingBattleScale= 通用；?mossScale= 兼容苔庭战役
    const gridRadius = Math.max(4, Number(q.get('vikingBattleRadius')) || (SITE === 'moss' && q.get('mossScale') ? Math.ceil(36 / S) : PRE.gridRadius));
    stage = new ReaBattleStage({ scene, dir, camera, name: `viking-${SITE}-battle`, scale: S, gridRadius, unitHeightM: SOLDIER_HEIGHT_M }).start();
    lastWave = 0; landing = []; seenBoats = new WeakSet();
    if (SITE === 'moss') {
      roman = romanizeMossDefenders(stage, scene.getObjectByName('saihoji-phalanx-battle'));
      log.push({ phase: 'site-defenders', note: `西芳寺方阵接管：${roman.report.join(' · ')}`, at: performance.now() });
    } else {
      // 十二门徒没有本地驻军编制（也没有西芳寺方阵）：守军 = REA 默认 3 队——battle.start 按台地 / 小屋格布防，
      // 岩群无可识别建筑时 bnHouses 退回最高台地格（reaBattleStage #sample 的 housesFromPlateau）。不写假守军。
      const sq = stage.battle.squads?.length ?? 0, men = stage.battle.units.filter((u) => u.squad && u.team === 0).length;
      log.push({ phase: 'site-defenders', note: `${label()}守军 = REA 默认守军 ${sq} 队 / ${men} 人（岩群无本地驻军编制；另有霸天舰队攻方对抗面）`, at: performance.now() });
    }
    // 2026-11-10 用户：维京人要真的打霸天舰队（投矛）和先锋重甲兵（扑上去砍）；与地点无关，site 透传给船体结算
    batianAttack = createVikingBatianAttack({ scene, stage, getFleet, site: SITE });
    // 长船从李白号 / Duke 号出发（舞台贴球坐标）
    stage.view.boatOrigins = () => ships.map((sh) => stage.worldToStage((sh.posWorld || sh.root.getWorldPosition(new THREE.Vector3())).clone(), new THREE.Vector3()));
    globalThis.__tmVikingBattleStage = stage;
    globalThis.__tmVikingMossStage = stage;   // 苔庭战役时期的调试句柄，保留兼容
  }
  const pool = () => ships.reduce((n, s) => n + s.count, 0);
  function takeFromShips(n) { for (let i = 0; i < n; i++) { for (let k = 0; k < ships.length; k++) { const s = ships[(turn + k) % ships.length]; if (s.count > 0) { s.count--; turn++; break; } } } }
  function giveToShips(n) { for (let i = 0; i < n; i++) ships[(turn++) % ships.length].count++; }

  // 集结一开始就预计算航线
  preplanSite();

  const api = {
    get phase() { return phase; }, get stage() { return stage; }, get battleSite() { return SITE; }, log, get routeMeta() { return routeMeta; },
    timing: VOYAGE_TIMING,
    schedule(battleEtaSec) { return scheduleBeforeBattle(battleEtaSec); },
    estimateSiteEta() {
      const fleet = getFleet?.();
      const snap = fleet?.snapshot?.();
      return estimateSiteBattleEtaSec(snap, targets(), VOYAGE_TIMING, SITE);
    },
    estimateMossEta() { return api.estimateSiteEta(); },   // 兼容苔庭战役时期的调用名
    update(dt) {
      t += dt;
      const SAIL = sailPhase(), HOLD = holdPhase(), BATTLE = SITE;
      if (phase === 'muster') {
        if (!routeMeta && !planning) preplanSite();
        if (boarding.departed && t > 3) { ensureSite(); if (sailTo(SITE)) say(SAIL, routeMeta?.legs?.map((m) => `${m.id} ${m.len}m`).join(' · ') || ''); }
        return;
      }
      if (phase === SAIL || phase === 'sail-citadel') {
        if (planning || !pilots.length) return;
        for (const p of pilots) p.update(dt);
        if (pilots.every((p) => p.done)) {
          if (phase === SAIL) { holdReady = false; say(HOLD, '锚地待命 · 等待主战场开战窗口'); }
          else { citadel = createCitadelBattle({ scene, camera, dir: dirOf('citadel'), oldCity: scene.getObjectByName('citadel-target-old-city'), fleet: scene.userData.batianFleet, takeFromShips, giveToShips, pool, motherShips: ships }); globalThis.__tmVikingCitadel = citadel; say('citadel'); }
        }
        return;
      }
      if (phase === HOLD) {
        if (battleReady()) { startSiteBattle(); say(BATTLE, '锚地控制位就绪 · 开战'); }
        return;
      }
      if (phase === 'citadel') { citadel.update(dt); if (citadel.done) { citadel.dispose(); say('done', citadel.log.at(-2) || ''); } return; }
      if (phase === BATTLE || phase === 'reembark') {
        const b = stage.battle;
        stage.update(dt);
        batianAttack?.update(dt);
        for (const boat of b.boats) if (!seenBoats.has(boat)) { seenBoats.add(boat); takeFromShips(boat.crew.length); landing.push(boat.land); }
        lastWave = b.wave;
        if (pool() <= 0) b.nextWave = 1e9;
        const vik = b.units.filter((u) => !u.dead && u.team === 1);
        const defAlive = b.units.some((u) => !u.dead && u.squad);
        if (phase === BATTLE && (t > battleLimitSec || !defAlive || (pool() <= 0 && !vik.length && !b.boats.some((x) => x.state === 'in')))) { b.nextWave = 1e9; batianAttack?.stop(); say('reembark', !defAlive ? `${label()}守军全灭` : t > battleLimitSec ? '时限到' : '维京人打光了'); }
        if (phase === 'reembark') {
          for (const u of vik) {
            if (u.onBoat) continue;
            const goal = landing.reduce((best, c) => (!best || Math.hypot(c.cx - u.x, c.cz - u.z) < Math.hypot(best.cx - u.x, best.cz - u.z) ? c : best), null);
            if (!goal) continue;
            const dx = goal.cx - u.x, dz = goal.cz - u.z, d = Math.hypot(dx, dz);
            if (d < 0.5) { u.dead = true; u.left = true; u.hp = 0; giveToShips(1); continue; }
            const step = Math.min(d, 0.9 * dt); u.x += dx / d * step; u.z += dz / d * step; u.face = Math.atan2(dx, dz);
          }
          b.units = b.units.filter((u) => !u.left);
          if (!vik.some((u) => !u.left && !u.dead) && t > 2) { batianAttack?.dispose(); batianAttack = null; stage.dispose(); stage = null; globalThis.__tmVikingBattleStage = null; globalThis.__tmVikingMossStage = null; sailTo('citadel'); say('sail-citadel'); }
        }
      }
    },
    stats() {
      return {
        phase, t: +t.toFixed(1), pool: pool(),
        battleSite: SITE,
        route: routeMeta,
        timing: VOYAGE_TIMING,
        battleEta: api.estimateSiteEta(),
        mossEta: api.estimateMossEta(),
        ships: ships.map((s) => ({ id: s.id, count: s.count, voyage: s.plan ? { pts: s.plan.points.length, len: Math.round(s.plan.length), source: s.plan.source, sailSec: Math.round(s.plan.sailSec || 0), blocked: s.plan.blocked, fixes: s.plan.fixes, dryLegs: s.plan.dryLegs } : null })),
        citadel: citadel?.stats?.() ?? null,
        batianAttack: batianAttack ? { ...batianAttack.stats } : null,
        battle: stage ? { wave: stage.battle.wave, alive: stage.battle.units.filter((u) => !u.dead).length } : null,
        log: log.map((l) => l.phase + (l.note ? `(${l.note})` : '')),
      };
    },
  };
  globalThis.__tmVikingCampaign = api;
  return api;
}
