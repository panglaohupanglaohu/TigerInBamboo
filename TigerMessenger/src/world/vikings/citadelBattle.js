// 维京远征 · 高山圣城之战 + 龙纛反击（2026-11-09，规划 §4.3 / §5，P4–P5）。
// 舞台：ReaBattleStage（REA Battle 原样）罩住新城、前港和旧城；scale 8 → 一格约 8 m、一层 4 m、人约 1.4 m。
// 维京人：大船在锚地，REA 长船分波登陆；每波从两船舱内扣人（同苔庭）。
// 与霸天合作（REA 只有两队，霸天不进单位表）：霸天每发炮弹（batianFleet.snapshot().fireLog 的 point）落点 1.2 格内的守军掉 2 血，
//   掉光即阵亡；开打时若霸天空闲，请它出征圣城（fleet.start('citadel')）。
// 旧城源源不断补兵：每 20 s 在旧城格（citadel-target-old-city 所在）用 battle.spawnSquad 出一队 8 人守军（REA 的 #spawn / #flag，vendor 只加了这个公开入口），
//   同屏守军 ≤ 120；REA 小队会按自己的流场去迎击。
// 龙纛（《绍宋》尧山之战：龙纛前移、班直金甲护纛结阵稳进、敌阵一垮全线溃退）：
//   开战 60 s 或新城失守 1 栋 → 旧城门出龙纛队：矛 / 盾刀 / 弓三队 × 12 人，全员 unit-tier 3 金盔金盾 + 金色衣（u.bodyColor），
//   矛队旗放大 ×2.5、明黄旗面「龍」字 = 龙纛；三队目标格沿旧城 → 登陆滩逐段前移（前排站稳再进）。
//   望纛而进：纛 3 格内的守军眩晕时间减半；溃退：上岸维京人阵亡过半或龙纛推到滩头 → 维京人回船，两船起锚离开。
import * as THREE from 'three';
import { ReaBattleStage, SOLDIER_HEIGHT_M } from '../rea/reaBattleStage.js';
import { romanizeMossDefenders } from './mossDefenders.js';

const GOLD = '#d9b44a';
function dragonBannerTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f2c230'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#a3241c'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 116);
  g.fillStyle = '#a3241c'; g.font = 'bold 92px "Songti SC","STSong","Noto Serif CJK SC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('龍', 104, 68);
  // 燕尾：旗尾挖一个三角（材质 alphaTest 0.5）
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(256, 0); g.lineTo(205, 64); g.lineTo(256, 128); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createCitadelBattle({ scene, camera, dir, oldCity, fleet, takeFromShips, giveToShips, pool, landingDir = null, seconds = 360, motherShips = [] }) {
  const stage = new ReaBattleStage({ scene, dir, camera, name: 'viking-citadel-battle', scale: 8, gridRadius: 14, unitHeightM: SOLDIER_HEIGHT_M }).start();   // 人 1.7 m（原 1.44 m）
  const b = stage.battle, inv = stage.anchor.matrixWorld.clone().invert(), local = (w) => stage.worldToStage(w, new THREE.Vector3());   // 贴球舞台坐标
  // 长船从停在旧城码头的李白号 / Duke 号出发
  if (motherShips.length) stage.view.boatOrigins = () => motherShips.map((sh) => local((sh.posWorld || sh.root.getWorldPosition(new THREE.Vector3())).clone()));
  const roman = romanizeMossDefenders(stage, scene.getObjectByName('saihoji-phalanx-battle'));   // 圣城红衣驻军原地接管成 REA 守军
  const seen = new WeakSet(), landing = [];
  const log0 = [`守军：${roman.report.join(' · ')}`];
  let t = 0, nextReinforce = 20, fireIndex = fleet?.snapshot?.()?.fireLog?.length || 0, dragon = null, routed = false, done = false, landedTotal = 0, log = [...log0];
  const cellNear = (x, z, minLevel = 1) => { let best = null, bd = 1e9; for (const c of stage.grid.cells) { if (stage.world.top(c) < minLevel) continue; const d = Math.hypot(c.cx - x, c.cz - z); if (d < bd) { bd = d; best = c; } } return best; };
  const oldCellAt = () => { if (!oldCity) return null; const p = local(new THREE.Box3().setFromObject(oldCity).getCenter(new THREE.Vector3())); return cellNear(p.x, p.z, 2); };
  const oldCell = oldCellAt();
  // 请霸天出征圣城：霸天要开局后（gameStarted）且空闲才接令；没接上就每 5 s 再请一次，接上记一笔
  let askAt = -1e9, batianJoined = false;
  const askBatian = () => { if (!fleet || batianJoined) return; const sn = fleet.snapshot?.(); if (sn?.target === 'citadel' && sn.phase !== 'idle') { batianJoined = true; log.push(`霸天舰队到场（${sn.phase}）`); return; } if (t - askAt < 5) return; askAt = t; try { if (fleet.start?.('citadel')) log.push('霸天接令出征圣城'); } catch {} };

  function batianStrikes() {
    const fl = fleet?.snapshot?.()?.fireLog; if (!fl) return;
    for (; fireIndex < fl.length; fireIndex++) {
      const p = fl[fireIndex]?.point; if (!p) continue;
      const q = local(new THREE.Vector3().fromArray(p));
      for (const u of b.units) if (!u.dead && u.team === 0 && Math.hypot(u.x - q.x, u.z - q.z) < 1.2) { u.hp -= 2; if (u.hp <= 0) { u.dead = true; u.corpseRot = Math.random() * 6.28; } }
    }
  }
  function spawnDragon() {
    if (!oldCell) return;
    const common = { cell: oldCell, size: 12, tier: 3, bodyColor: GOLD };
    const pike = b.spawnSquad({ ...common, pike: true, flagScale: 2.5, flagStyle: 2 });   // ×2.5：圣城舞台 scale 8 下杆高约 12 m（×5 时 24 m，比房子高太多）
    const foot = b.spawnSquad({ ...common, flagStyle: 0 });
    const bow = b.spawnSquad({ ...common, archer: true, flagStyle: 1 });
    if (!pike) return;
    const cloth = pike.flag.userData.cloth; cloth.material.map = dragonBannerTexture(); cloth.material.needsUpdate = true;
    pike.members[0].bodyScale = 1.25;   // 纛手
    // 推进线：旧城 → 最近的登陆滩，分 5 段
    const beach = landing.length ? landing[0] : cellNear(0, 0, 1);
    const steps = [];
    for (let k = 1; k <= 5; k++) { const c = cellNear(oldCell.cx + (beach.cx - oldCell.cx) * k / 5, oldCell.cz + (beach.cz - oldCell.cz) * k / 5, 1); if (c && c !== steps.at(-1)) steps.push(c); }
    dragon = { squads: [pike, foot, bow], steps, k: 0, hold: 0 };
    log.push('龙纛出旧城');
  }
  const centroid = (sq) => { const a = sq.members.filter((u) => !u.dead); if (!a.length) return null; return { x: a.reduce((s, u) => s + u.x, 0) / a.length, z: a.reduce((s, u) => s + u.z, 0) / a.length }; };

  const api = {
    stage, log, get done() { return done; }, get routed() { return routed; },
    update(dt) {
      if (done) return; t += dt;
      stage.update(dt);
      for (const boat of b.boats) if (!seen.has(boat)) { seen.add(boat); takeFromShips(boat.crew.length); landedTotal += boat.crew.length; landing.push(boat.land); }
      if (pool() <= 0) b.nextWave = 1e9;
      askBatian(); batianStrikes();
      // 旧城补兵
      const defAlive = b.units.filter((u) => !u.dead && u.team === 0).length;
      if (t >= nextReinforce && !routed) { nextReinforce = t + 20; if (oldCell && defAlive < 120) { b.spawnSquad({ cell: oldCell, size: 8, archer: Math.random() < 0.3 }); log.push(`旧城补兵 @${Math.round(t)}s`); } }
      // 龙纛出场
      const lost = b.houses?.filter((h) => h.lost).length || 0;
      if (!dragon && (t > 60 || lost >= 1)) spawnDragon();
      if (dragon && !routed) {
        const [pike] = dragon.squads, c = centroid(pike), goal = dragon.steps[dragon.k];
        for (const sq of dragon.squads) { sq.goal = goal; sq.goalFloor = stage.world.top(goal); }
        if (c && goal && Math.hypot(c.x - goal.cx, c.z - goal.cz) < 1.6) { dragon.hold += dt; if (dragon.hold > 3 && dragon.k < dragon.steps.length - 1) { dragon.k++; dragon.hold = 0; } } else dragon.hold = 0;
        // 望纛而进：纛 3 格内守军眩晕减半
        if (c) for (const u of b.units) if (!u.dead && u.team === 0 && u.stunRemaining > 0 && Math.hypot(u.x - c.x, u.z - c.z) < 3) u.stunRemaining -= dt;
      }
      // 溃退
      const vik = b.units.filter((u) => !u.dead && u.team === 1);
      const vikDead = b.units.filter((u) => u.dead && u.team === 1).length;
      const atBeach = dragon && dragon.k >= dragon.steps.length - 1 && dragon.hold > 2;
      if (!routed && landedTotal > 0 && (vikDead > landedTotal * 0.5 || atBeach || t > seconds)) { routed = true; b.nextWave = 1e9; log.push(atBeach ? '龙纛推到滩头，维京人溃退' : vikDead > landedTotal * 0.5 ? '维京人阵亡过半，全线溃退' : '时限到，维京人撤退'); }
      if (routed) {
        for (const u of vik) {
          if (u.onBoat) continue;
          const g = landing.reduce((best, c) => (!best || Math.hypot(c.cx - u.x, c.cz - u.z) < Math.hypot(best.cx - u.x, best.cz - u.z) ? c : best), null); if (!g) continue;
          const dx = g.cx - u.x, dz = g.cz - u.z, d = Math.hypot(dx, dz);
          if (d < 0.5) { u.dead = true; u.left = true; giveToShips(1); continue; }
          const step = Math.min(d, 1.1 * dt); u.x += dx / d * step; u.z += dz / d * step; u.face = Math.atan2(dx, dz);
        }
        b.units = b.units.filter((u) => !u.left);
        if (!vik.some((u) => !u.left && !u.dead) && t > 2) { done = true; log.push('维京人全部回船'); }
      }
    },
    stats() { const alive = (team) => b.units.filter((u) => !u.dead && u.team === team).length; return { batian: batianJoined ? 'joined' : (fleet?.snapshot?.()?.phase || 'none'), batianShots: fireIndex, t: Math.round(t), wave: b.wave, landedTotal, vikAlive: alive(1), defAlive: alive(0), squads: b.squads.length, dragon: dragon ? { step: dragon.k, of: dragon.steps.length } : null, routed, done, log }; },
    dispose() { roman.restore(); stage.dispose(); },
  };
  return api;
}
