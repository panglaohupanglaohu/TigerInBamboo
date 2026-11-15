// 维京远征 · 战役导演（2026-11-09，规划 §4.1，P3 起；2026-11-10：可跨铁轨航线 + 战前约 10 分钟离港）。
// muster（登船，bookshopBoarding）→ sail-moss（vikingVoyage：两船编队到苔庭外锚地）→ hold-moss（锚地待命）
//   → moss（苔庭之战）→ reembark（回船）→ sail-citadel → citadel（P4）→ done
// 苔庭之战的兵源对接（REA 的 Battle 自己按波次放长船，每波 6 + 2×波次人，最多 12）：
//   大船在锚地不动，REA 长船 = 大船放下的登陆艇；每来一波就从两船「舱内」人数里扣掉这波人数（轮流扣），扣完就不再来船（battle.nextWave = ∞）。
// 回船（REA 没有，新写，小）：时限到 / 守军全灭 → 活着的维京人走回各自登陆的滩格，到了就离开战场，人数加回大船。
// 时间线（用户 2026-11-10）：离港 = 苔庭开战 − 约 10 分钟；铁轨可跨，A* 航线李白 ~449 m / Duke ~323 m，巡航 0.75 m/s ≈ 7–10 分钟。
import * as THREE from 'three';
import { createWarshipWaterRoutes } from '../warshipWaterRoutes.js';
import { planBookshopToMoss, planVoyageAstar, findAnchorage, createShipPilot, createVoyageObstacles, VOYAGE_TIMING, BOOKSHOP_TO_MOSS_ROUTE, estimateMossBattleEtaSec, scheduleBeforeMoss } from './vikingVoyage.js';
import { ReaBattleStage, SOLDIER_HEIGHT_M } from '../rea/reaBattleStage.js';
import { createCitadelBattle } from './citadelBattle.js';
import { romanizeMossDefenders } from './mossDefenders.js';
import { createVikingBatianAttack } from './mossBatianAttack.js';
import { saihojiBattleTrigger } from '../saihojiBattleTrigger.js';

export function createVikingCampaign({ scene, camera, boarding, targets, mossSeconds = 150, onPhase = () => {}, getFleet = () => scene.userData.batianFleet || null, syncBatian = true } = {}) {
  const dirOf = (id) => targets().find((t) => t.id === id)?.dir?.clone().normalize() || null;
  let planning = false, roman = null, citadel = null, seenBoats = new WeakSet(), phase = 'muster', pilots = [], stage = null, t = 0, lastWave = 0, turn = 0, landing = [], log = [];
  let routeMeta = null, holdReady = false, batianAttack = null;
  const ships = boarding.ships;
  const say = (p, note = '') => { phase = p; t = 0; log.push({ phase: p, note, at: performance.now() }); boarding.phase = { 'sail-moss': '驶向苔庭', 'hold-moss': '苔庭锚地待命', moss: '苔庭之战', reembark: '回船', 'sail-citadel': '驶向高山圣城', citadel: '高山圣城之战', done: '远征结束' }[p] || p; onPhase(p, note); };

  // 航线异步算；集结一开始就预计算，离港时直接驾船（不再等 10–40 s）
  const HALF_BEAM = { leebai: 6.85, duke: 4.3 };
  const cruiseSpeed = () => Math.max(0.5, Number(new URLSearchParams(location.search).get('vikingSpeed')) || VOYAGE_TIMING.cruiseSpeedMps);   // ?vikingSpeed= 米/秒
  function preplanMoss() {
    if (planning || routeMeta?.ok) return;
    const centre = dirOf('moss'); if (!centre) return;
    const solver = createWarshipWaterRoutes(scene, 160);
    const obstacles = createVoyageObstacles(scene);
    planning = true;
    (async () => {
      const out = [], meta = [];
      for (const [k, s] of ships.entries()) {
        const from = (s.posWorld || s.root.getWorldPosition(new THREE.Vector3())).clone().normalize();
        const margin = (HALF_BEAM[s.id] ?? 6) + 2.5;
        const anch = findAnchorage(solver, centre, from, { minDist: 48 + k * 16, margin, obstacles }) || centre;
        const plan = await planBookshopToMoss(solver, from, anch, { shipId: s.id === 'duke' ? 'duke' : 'lee', obstacles, speed: cruiseSpeed() });
        s.plan = plan; s.anchorage = anch;
        meta.push({ id: s.id, len: Math.round(plan.length), sailSec: Math.round(plan.sailSec), source: plan.source, pts: plan.points.length });
        out.push({ ship: s, points: plan.points, speed: plan.speed });
      }
      routeMeta = { ok: true, legs: meta, obstacles: { crossRails: true }, timing: VOYAGE_TIMING, table: { lee: BOOKSHOP_TO_MOSS_ROUTE.lee.lengthM, duke: BOOKSHOP_TO_MOSS_ROUTE.duke.lengthM } };
      // 先存点列；真正离港后再 createShipPilot（载具组要先建好）
      ships._pendingMoss = out;
      planning = false;
      log.push({ phase: 'preplan-moss', note: meta.map((m) => `${m.id}:${m.len}m/${m.sailSec}s/${m.source}`).join(' · '), at: performance.now() });
    })().catch((e) => { console.warn('[vikingVoyage]', e); planning = false; routeMeta = { ok: false, error: String(e) }; });
  }

  function sailTo(id) {
    const centre = dirOf(id); if (!centre) return false;
    // 苔庭：用预计算；圣城：现算（同样可跨铁轨）
    if (id === 'moss' && ships._pendingMoss?.length) {
      pilots = ships._pendingMoss.map(({ ship, points, speed }) => createShipPilot(ship, points, { speed, lookahead: 12 }));
      ships._pendingMoss = null;
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
        if (id === 'moss') {
          plan = await planBookshopToMoss(solver, from, anch, { shipId: s.id === 'duke' ? 'duke' : 'lee', obstacles, speed: cruiseSpeed() });
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

  function mossBattleReady() {
    if (!syncBatian) return true;
    const fleet = getFleet?.();
    if (!fleet) return t > VOYAGE_TIMING.holdAfterArriveSec;   // 无霸天：到锚地稍等就开打（测试）
    const hub = dirOf('moss');
    const trig = saihojiBattleTrigger(fleet, hub ? { x: hub.x, y: hub.y, z: hub.z } : null, 160);
    if (trig.allowed) return true;
    // 霸天已在苔庭进场但还没开火：继续等；若等太久（测试）也放行
    const snap = fleet.snapshot?.() || {};
    if (snap.target === 'moss' && ['assemble', 'transit', 'blockade', 'pincer', 'cannon', 'guard'].includes(snap.phase)) {
      return t > Math.max(VOYAGE_TIMING.holdAfterArriveSec, 300);   // 霸天已来苔庭：最多等 5 分钟它开火
    }
    // 未开自动战役：到锚地后短等即开打，不堵测试
    if (!fleet.active && snap.phase === 'idle') return t > VOYAGE_TIMING.holdAfterArriveSec;
    return t > 600;   // 霸天还在打前一站（main.js batianMossGate 让它等维京到锚地后才出征苔庭）：最多等 10 分钟
  }

  function startMoss() {
    const dir = dirOf('moss');
    // 2026-11-10 用户：苔庭士兵偏小（scale 2 时约 0.36 m）→ 恢复 1.7 m，长船同比放大。
    // 一格 4 m（scale 2 时 2 m）：只放大单位不加大格子会让 REA 的交战距离 / 站位全失真；格子也不能大到 9 m（REA 原比例），苔庭陆地只有约 30 m 宽。
    // 折中：scale 4 + 单位 / 长船再 ×2.36 → 人 1.7 m；舞台半径保持约 36 m。?mossScale= 可调。
    const q = new URLSearchParams(location.search), S = Math.max(2, Number(q.get('mossScale')) || 4);
    stage = new ReaBattleStage({ scene, dir, camera, name: 'viking-moss-battle', scale: S, gridRadius: Math.ceil(36 / S), unitHeightM: SOLDIER_HEIGHT_M }).start();
    lastWave = 0; landing = []; seenBoats = new WeakSet();
    roman = romanizeMossDefenders(stage, scene.getObjectByName('saihoji-phalanx-battle'));
    log.push({ phase: 'moss-defenders', note: roman.report.join(' · '), at: performance.now() });
    // 2026-11-10 用户：维京人要真的打霸天舰队（投矛）和先锋重甲兵（扑上去砍）
    batianAttack = createVikingBatianAttack({ scene, stage, getFleet });
    // 长船从李白号 / Duke 号出发（舞台贴球坐标）
    stage.view.boatOrigins = () => ships.map((sh) => stage.worldToStage((sh.posWorld || sh.root.getWorldPosition(new THREE.Vector3())).clone(), new THREE.Vector3()));
    globalThis.__tmVikingMossStage = stage;
  }
  const pool = () => ships.reduce((n, s) => n + s.count, 0);
  function takeFromShips(n) { for (let i = 0; i < n; i++) { for (let k = 0; k < ships.length; k++) { const s = ships[(turn + k) % ships.length]; if (s.count > 0) { s.count--; turn++; break; } } } }
  function giveToShips(n) { for (let i = 0; i < n; i++) ships[(turn++) % ships.length].count++; }

  // 集结一开始就预计算航线
  preplanMoss();

  const api = {
    get phase() { return phase; }, get stage() { return stage; }, log, get routeMeta() { return routeMeta; },
    timing: VOYAGE_TIMING,
    schedule(battleEtaSec) { return scheduleBeforeMoss(battleEtaSec); },
    estimateMossEta() {
      const fleet = getFleet?.();
      const snap = fleet?.snapshot?.();
      return estimateMossBattleEtaSec(snap, targets(), VOYAGE_TIMING);
    },
    update(dt) {
      t += dt;
      if (phase === 'muster') {
        if (!routeMeta && !planning) preplanMoss();
        if (boarding.departed && t > 3) { sailTo('moss'); say('sail-moss', routeMeta?.legs?.map((m) => `${m.id} ${m.len}m`).join(' · ') || ''); }
        return;
      }
      if (phase === 'sail-moss' || phase === 'sail-citadel') {
        if (planning || !pilots.length) return;
        for (const p of pilots) p.update(dt);
        if (pilots.every((p) => p.done)) {
          if (phase === 'sail-moss') { holdReady = false; say('hold-moss', '锚地待命 · 等待苔庭开战窗口'); }
          else { citadel = createCitadelBattle({ scene, camera, dir: dirOf('citadel'), oldCity: scene.getObjectByName('citadel-target-old-city'), fleet: scene.userData.batianFleet, takeFromShips, giveToShips, pool, motherShips: ships }); globalThis.__tmVikingCitadel = citadel; say('citadel'); }
        }
        return;
      }
      if (phase === 'hold-moss') {
        if (mossBattleReady()) { startMoss(); say('moss', '锚地控制位就绪 · 开战'); }
        return;
      }
      if (phase === 'citadel') { citadel.update(dt); if (citadel.done) { citadel.dispose(); say('done', citadel.log.at(-2) || ''); } return; }
      if (phase === 'moss' || phase === 'reembark') {
        const b = stage.battle;
        stage.update(dt);
        batianAttack?.update(dt);
        for (const boat of b.boats) if (!seenBoats.has(boat)) { seenBoats.add(boat); takeFromShips(boat.crew.length); landing.push(boat.land); }
        lastWave = b.wave;
        if (pool() <= 0) b.nextWave = 1e9;
        const vik = b.units.filter((u) => !u.dead && u.team === 1);
        const defAlive = b.units.some((u) => !u.dead && u.squad);
        if (phase === 'moss' && (t > mossSeconds || !defAlive || (pool() <= 0 && !vik.length && !b.boats.some((x) => x.state === 'in')))) { b.nextWave = 1e9; batianAttack?.stop(); say('reembark', !defAlive ? '苔庭守军全灭' : t > mossSeconds ? '时限到' : '维京人打光了'); }
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
          if (!vik.some((u) => !u.left && !u.dead) && t > 2) { batianAttack?.dispose(); batianAttack = null; stage.dispose(); stage = null; globalThis.__tmVikingMossStage = null; sailTo('citadel'); say('sail-citadel'); }
        }
      }
    },
    stats() {
      return {
        phase, t: +t.toFixed(1), pool: pool(),
        route: routeMeta,
        timing: VOYAGE_TIMING,
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
