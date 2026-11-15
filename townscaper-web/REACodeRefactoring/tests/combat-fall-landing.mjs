// 第 53 批 G5 · 870296307889573889「Units can now get knocked off ledges」——REACode/src/combatfx.js 的状态机：
// WALK →（击退出崖）AIR/FALL →（重力）LAND（落差越大硬直越久）/ DROWN（落水，掉到水面以下就结束）。
// 重构版原来：落到海格（top=0）且落差 <3 时单位站在海面上、没有导航节点 → 永远卡住。本轮补溺水 + 落地硬直。
import assert from 'node:assert/strict';
import { stripWorld, makeView, Battle } from './fixtures/g5-battle.mjs';
import { resolveFallLanding } from '../src/core/combat-state.js';
assert.deepEqual(resolveFallLanding({ drop: 1, water: true }), { outcome: 'drown', stun: 0 });
assert.equal(resolveFallLanding({ drop: 3 }).outcome, 'dead');
assert.equal(resolveFallLanding({ drop: 2 }).outcome, 'hurt');
assert.ok(resolveFallLanding({ drop: 1 }).stun > 0 && resolveFallLanding({ drop: 0 }).stun === 0);
assert.ok(resolveFallLanding({ drop: 2 }).stun > resolveFallLanding({ drop: 1 }).stun, '落差越大硬直越久');
assert.throws(() => resolveFallLanding({ drop: NaN }));
const fall = (levels, from) => {
  const S = stripWorld(4, 1); levels.forEach((lv, i) => lv && S.world.fill(S.at(i, 0), lv, { rock: true }));
  const b = new Battle(makeView(S.world, S.index)); b.start(S.world); b.nextWave = 1e9; b.squads = [];
  const sq = { id: 0, members: [], alive: true, goal: null, goalFloor: 1 };
  const u = { uid: 1, team: 0, squad: sq, k: 0, hp: 3, max: 3, x: 1.4, z: 0, y: from * .5, navFloor: from, cd: 9, dead: false, onBoat: null, face: 0, soak: 0, radius: .055, stunRemaining: 0 };
  u.fall = { vx: 1.2, vz: 0, vy: .25, from }; sq.members.push(u); b.units = [u];
  let landedStun = 0;
  for (let i = 0; i < 180 && (u.fall || i < 5); i++) { b.update(1 / 60); if (!u.fall && !landedStun) landedStun = u.stunRemaining; }
  return { u, b, landedStun };
};
// ① 2 层台 → 海（x=2 格 top=0）：旧逻辑是「掉 1 点血 + 站在海面上卡住」，现在溺水沉下去
const sea = fall([2, 2, 0, 0], 2);
assert.ok(sea.u.dead && sea.u.drowned && sea.u.y < 0, `落海溺水 ${JSON.stringify({ dead: sea.u.dead, y: sea.u.y })}`);
assert.equal(sea.b.blood.count > 0 ? sea.b.blood.count : 0, 0, '水面上不铺血泊');
// ② 2 层台 → 1 层台：落差 1，活着、落地硬直
const step = fall([2, 2, 1, 1], 2);
assert.ok(!step.u.dead && step.u.navFloor === 1 && step.landedStun > 0, `落地硬直 ${step.landedStun}`);
// ③ 3 层 → 1 层（中间无可滚落的台阶）：落差 2 → 掉血 + 硬直
const hurt = fall([3, 3, 1, 1], 3);
assert.ok(!hurt.u.dead && hurt.u.hp === 2 && hurt.u.stunRemaining > 0, `落差 2 掉一点血 hp=${hurt.u.hp}`);
// ④ 4 层 → 1 层：摔死、留血
const dead = fall([4, 4, 1, 1], 4);
assert.ok(dead.u.dead && !dead.u.drowned && dead.b.blood.count > 0);
console.log('PASS 落海溺水（不再卡在海面）、落差 1 硬直、落差 2 掉血、≥3 摔死、结算表', JSON.stringify({ stepStun: +step.landedStun.toFixed(2), hurtHp: hurt.u.hp }));
