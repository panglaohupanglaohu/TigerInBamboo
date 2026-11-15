// 苔庭之战 · 维京人打霸天（2026-11-10 用户：「只看到小船载着维京人到苔庭，并未见到维京人射击霸天舰队，也未见攻击重甲士兵……攻击你必须安排」）。
// REA 战斗只有两队（维京 / 守军），霸天舰队和先锋重甲兵不在 REA 单位表里，所以这里接一层：
//   1. 投矛打霸天舰队：上岸维京人每 2.4–3.6 s 向最近的霸天单位（aircraft / 护航舰）掷一支标枪（140 m 内；抛物线、追着目标飞）。
//      命中走苔庭原有的弓箭 / 标枪通道：飞行中每帧 interceptSaihojiFleetProjectile（护盾拦截，有护盾火花），
//      落到船体 applySaihojiFleetHullContact（扣船体）。与罗马长弓 / 标枪同一口径（javelin = 8），不另造伤害规则。
//   2. 扑重甲兵：先锋重甲兵（vanguard-squad）落在 REA 舞台陆地上、且比最近的守军更近 → 维京人的 REA 寻路目标改成它所在格（battle.js [TM] u.tmGoal），
//      走到 2 m 内挥斧：hitVanguard(tr,'melee')（与罗马兵砍重甲同一账：15 刀 1 伤）；
//      重甲兵反手（代差）：每 1.2 s 砍倒 / 打晕身边一名维京人。
import * as THREE from 'three';
import { interceptSaihojiFleetProjectile, applySaihojiFleetHullContact, recordSaihojiFleetContact } from '../saihojiFleetContact.js?v=saihoji-battle-r9-20261025';
import { applyVanguardHit } from '../vanguardTrooper.js';

const THROW_RANGE = 140, MELEE_R = 2.0, MAX_SPEARS = 70;
const hitVanguard = (tr, kind) => tr?.userData?.saihojiReceiveHit?.(kind) || applyVanguardHit(tr, kind);
const visibleChain = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

export function createVikingBatianAttack({ scene, stage, getFleet = () => scene.userData.batianFleet || null }) {
  const b = stage.battle, inv = stage.anchor.matrixWorld.clone().invert();
  const stats = { throws: 0, shield: 0, hull: 0, missed: 0, trooperStrikes: 0, trooperWounds: 0, trooperKills: 0, vikingsCut: 0, pursuing: 0 };
  const spears = [], sparks = [];
  const shaftGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.7, 5).rotateX(Math.PI / 2);
  const headGeo = new THREE.ConeGeometry(0.08, 0.28, 5).rotateX(Math.PI / 2).translate(0, 0, 0.98);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.9 }), headMat = new THREE.MeshStandardMaterial({ color: 0xc9c6bd, metalness: 0.6, roughness: 0.4 });
  const sparkGeo = new THREE.SphereGeometry(0.18, 6, 4), sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, depthWrite: false });
  const root = new THREE.Group(); root.name = 'viking-batian-attack'; root.userData.reaIgnore = true; scene.add(root);
  const v = new THREE.Vector3(), w = new THREE.Vector3(), up = new THREE.Vector3();
  const local = (p, out = new THREE.Vector3()) => stage.worldToStage(p, out);   // 贴球舞台坐标
  const unitWorld = (u, out = new THREE.Vector3()) => stage.toWorld(u.x, u.y + (stage.view.visualOffset?.(u.x, u.z) || 0) + 0.12 * (u.bodyScale ?? 1), u.z, out);
  let enabled = true;

  function spark(p) {
    const m = new THREE.Mesh(sparkGeo, sparkMat.clone()); m.position.copy(p); m.raycast = () => {}; root.add(m); sparks.push({ m, t: 0 });
  }
  function throwSpear(u, target, fleet) {
    if (spears.length >= MAX_SPEARS) return;
    const g = new THREE.Group(); g.add(new THREE.Mesh(shaftGeo, shaftMat), new THREE.Mesh(headGeo, headMat));
    g.traverse((o) => { o.raycast = () => {}; });
    const from = unitWorld(u); root.add(g); g.position.copy(from);
    const dist = from.distanceTo(target.getWorldPosition(w));
    spears.push({ g, from, target, fleet, t: 0, dur: THREE.MathUtils.clamp(dist / 24, 0.6, 3.5), arc: Math.min(14, dist * 0.18), prev: from.clone() });
    stats.throws++;
  }

  function update(dt) {
    const fleet = getFleet();
    // —— 霸天单位（只在霸天打苔庭时才算数：interceptSaihoji… 自带 commandedTarget 判定）
    const ships = enabled && fleet?.active ? (fleet.units?.() || []).filter((m) => m?.parent && !m.userData?.batianDisabled && visibleChain(m)) : [];
    const shipPos = ships.map((m) => m.getWorldPosition(new THREE.Vector3()));
    // —— 先锋重甲兵（落地、活着、可见）
    const squad = scene.getObjectByName('vanguard-squad');
    const troopers = enabled ? (squad?.userData?.troopers || []).filter((tr) => tr.parent && !tr.userData.dead && !tr.userData.downed && !tr.userData.swallowed && visibleChain(tr)) : [];
    const trW = troopers.map((tr) => tr.getWorldPosition(new THREE.Vector3()));
    const trL = trW.map((p) => local(p));
    const trCell = trL.map((p) => { const c = stage.index.cellAt(p.x, p.z); return c && stage.world.top(c) >= 1 ? c : null; });
    const defs = b.units.filter((u) => !u.dead && u.team === 0 && !u.onBoat);
    stats.pursuing = 0;
    for (const u of b.units) {
      if (u.team !== 1) continue;
      if (u.dead || u.onBoat || u.fall || u.left) { u.tmGoal = null; continue; }
      u.tmCd = (u.tmCd ?? Math.random() * 2) - dt;
      const me = unitWorld(u, v);
      // 1) 重甲兵：近身就砍，否则（比守军近）扑过去
      let ti = -1, td = 1e9;
      for (let i = 0; i < troopers.length; i++) { const d = me.distanceTo(trW[i]); if (d < td) { td = d; ti = i; } }
      if (ti >= 0 && td < MELEE_R) {
        u.face = Math.atan2(trL[ti].x - u.x, trL[ti].z - u.z);
        u.tmMelee = (u.tmMelee ?? 0.25) - dt;   // 近战另计冷却（不被投矛的冷却拖住）
        if (u.tmMelee <= 0) {
          u.tmMelee = 0.9 + Math.random() * 0.3;
          const r = hitVanguard(troopers[ti], 'melee'); stats.trooperStrikes++;
          if (r?.wounded) stats.trooperWounds++; if (r?.dead) stats.trooperKills++;
          spark(trW[ti].clone().addScaledVector(up.copy(trW[ti]).normalize(), 1.2));
        }
        u.tmGoal = trCell[ti]; stats.pursuing++;
        continue;
      }
      u.tmMelee = 0.25;
      if (ti >= 0 && trCell[ti]) {
        let dd = 1e9; for (const d of defs) dd = Math.min(dd, Math.hypot(d.x - u.x, d.z - u.z));
        const tl = Math.hypot(trL[ti].x - u.x, trL[ti].z - u.z);
        u.tmGoal = tl < dd && tl < 10 ? trCell[ti] : null;
        if (u.tmGoal) stats.pursuing++;
      } else u.tmGoal = null;
      // 2) 投矛打霸天舰队
      if (u.tmCd <= 0 && ships.length) {
        let si = -1, sd = THROW_RANGE;
        for (let i = 0; i < ships.length; i++) { const d = me.distanceTo(shipPos[i]); if (d < sd) { sd = d; si = i; } }
        u.tmCd = 2.4 + Math.random() * 1.2;
        if (si >= 0) { u.face = Math.atan2(local(shipPos[si], w).x - u.x, w.z - u.z); throwSpear(u, ships[si], fleet); }
      }
    }
    // 重甲兵反手：每 1.2 s 砍倒 / 打晕身边一名维京人（代差：1 刀 1 个）
    for (let i = 0; i < troopers.length; i++) {
      const tr = troopers[i]; tr.userData.tmVikCd = (tr.userData.tmVikCd ?? 0.6) - dt;
      if (tr.userData.tmVikCd > 0) continue;
      const near = b.units.find((u) => u.team === 1 && !u.dead && !u.onBoat && !u.fall && unitWorld(u, v).distanceTo(trW[i]) < MELEE_R + 0.4);
      if (!near) continue;
      tr.userData.tmVikCd = 1.2;
      near.hp -= 1; stats.vikingsCut++;
      if (near.hp <= 0) { near.dead = true; near.stunRemaining = 0; near.corpseRot = Math.random() * 6; } else near.stunRemaining = Math.max(near.stunRemaining || 0, 0.7);
    }
    // 标枪飞行
    for (const s of spears) {
      s.t += dt; const k = Math.min(1, s.t / s.dur);
      const tgt = s.target.getWorldPosition(w);
      up.copy(s.from).normalize();
      s.prev.copy(s.g.position);
      s.g.position.copy(s.from).lerp(tgt, k).addScaledVector(up, s.arc * 4 * k * (1 - k));
      const dir = v.subVectors(s.g.position, s.prev); if (dir.lengthSq() > 1e-8) s.g.lookAt(v.copy(s.g.position).add(dir));
      const fl = getFleet();
      const ic = fl ? interceptSaihojiFleetProjectile(fl, s.target, s.prev, s.g.position, 'javelin') : null;
      if (ic) { stats.shield++; recordSaihojiFleetContact(root, ic); s.done = true; continue; }
      if (k >= 1) {
        const hit = fl ? applySaihojiFleetHullContact(fl, s.target, s.g.position.clone(), 'javelin') : null;
        if (hit) { stats.hull++; recordSaihojiFleetContact(root, hit); spark(s.g.position); } else stats.missed++;
        s.done = true;
      }
    }
    for (const s of spears) if (s.done) s.g.removeFromParent();
    for (let i = spears.length - 1; i >= 0; i--) if (spears[i].done) spears.splice(i, 1);
    for (const p of sparks) { p.t += dt; p.m.scale.setScalar(1 + p.t * 6); p.m.material.opacity = Math.max(0, 1 - p.t / 0.35); if (p.t > 0.35) { p.m.removeFromParent(); p.m.material.dispose(); p.done = true; } }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].done) sparks.splice(i, 1);
  }

  return {
    stats, update,
    stop() { enabled = false; for (const u of b.units) u.tmGoal = null; },
    dispose() { root.removeFromParent(); shaftGeo.dispose(); headGeo.dispose(); sparkGeo.dispose(); shaftMat.dispose(); headMat.dispose(); sparkMat.dispose(); },
  };
}
