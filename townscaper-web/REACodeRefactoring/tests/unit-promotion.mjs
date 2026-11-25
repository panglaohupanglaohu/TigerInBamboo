// 827215002448846848 残差·升级机制（本地机制，非原作复现 —— 原作升级经济/XP 未公开，
// 上游 REACode 无对应字段）：击杀数 → 等级 → 装备档位（appearanceTier 色阶接管渲染）。
// 覆盖：纯函数阈值/校验/不降级；真实 Battle opt-in 开关、近战与箭两路记账、
// 同队误伤与死者不记、升档只写外观不动战斗状态、默认关闭零行为变化。
import assert from 'node:assert/strict';
import { makeIsland, Battle, THREE } from './fixtures/g5-battle.mjs';
import { unitLevelForKills, creditUnitKill, PROMOTION_THRESHOLDS, unitTierAppearance, setUnitAppearanceTier } from '../src/core/unit-tier.js';
import { defaultBallisticTable, pickBallisticShot } from '../src/core/ballistic-table.js';

// 与 unit-ground-height-battle.mjs 同法：确定性 Math.random
const reseed = (a = 20561) => { let s = a; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
reseed();
const out = {};

/* ── 纯函数：阈值映射、非法输入、不降级 ─────────────────────────────── */
assert.deepEqual([0, 1, 2, 4, 5, 999].map((k) => unitLevelForKills(k)), [1, 1, 2, 2, 3, 3]);
for (const bad of [-1, 1.5, NaN, '2']) assert.throws(() => unitLevelForKills(bad), RangeError);
for (const ths of [[], [0], [1.5], ['x'], null]) assert.throws(() => unitLevelForKills(0, ths), RangeError);
{
  const u = {};
  assert.deepEqual([creditUnitKill(u).promoted, u.kills, u.level], [false, 1, 1]);
  assert.deepEqual([creditUnitKill(u).promoted, u.kills, u.level], [true, 2, 2]);
  creditUnitKill(u); creditUnitKill(u);                       // 4 杀仍是 2 档
  assert.equal(u.level, 2); assert.equal(creditUnitKill(u).promoted, true); assert.equal(u.level, 3);   // 5 杀 → 3 档
  // 预置档位（spawnSquad tier=3）：不降级、不重复记升档
  const vet = { appearanceTier: 3 };
  const rv = creditUnitKill(vet); assert.equal(rv.earned, 1); assert.equal(rv.promoted, false); assert.equal(vet.level, 3);
  const vet2 = { level: 2, appearanceTier: 2, kills: 4 };
  const rv2 = creditUnitKill(vet2); assert.equal(rv2.promoted, true); assert.equal(vet2.level, 3);
  // 先验后写：脏状态整单拒绝，字段不变
  const dirty = { kills: 1.5, hp: 3 }; assert.throws(() => creditUnitKill(dirty), RangeError); assert.equal(dirty.kills, 1.5); assert.equal(dirty.level, undefined);
  assert.throws(() => creditUnitKill(null), TypeError);
}
out.pure = { thresholds: [...PROMOTION_THRESHOLDS], levels: [0, 1, 2, 4, 5].map((k) => unitLevelForKills(k)) };

/* ── 默认关：真实 Battle 零行为变化 ─────────────────────────────────── */
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.nextWave = 1e9;
  assert.equal(b.promotion, false, '缺省关闭');
  const def = b.squads[0].members[0], mate = b.squads[0].members[1];
  mate.hp = 1; b.applyHit(mate, def);
  assert.ok(mate.dead);
  assert.equal(def.kills, undefined); assert.equal(def.level, undefined); assert.equal(def.appearanceTier, undefined);
  assert.deepEqual(b.promotionStats, { credited: 0, promoted: 0, last: null });
  out.off = { credited: 0 };
}

/* ── opt-in：真 Battle 近战记账 → 等级 → 装备档位 ───────────────────── */
{
  const { world, view } = makeIsland('quad', 7);
  view.unitPromotion = true;
  const b = new Battle(view); b.start(world);
  assert.ok(b.promotion, 'view.unitPromotion 打开');
  b.nextWave = .5;
  for (let k = 0; k < 1500 && b.units.filter((u) => u.team === 1 && !u.onBoat && !u.dead).length < 8; k++) b.update(1 / 30);
  const viks = () => b.units.filter((u) => u.team === 1 && !u.onBoat && !u.dead);
  assert.ok(viks().length >= 7, '第一波维京人上岸 ' + viks().length);
  const def = b.squads[0].members.find((u) => !u.dead);
  const base = [def.hp, def.max, def.soak, def.kind, def.bodyScale, def.navFloor, def.stunRemaining];

  // 第 1 杀：记账但不到 2 档阈值
  const v0 = viks()[0]; v0.hp = 1; b.applyHit(v0, def);
  assert.ok(v0.dead); assert.equal(def.kills, 1); assert.equal(def.level, 1); assert.equal(def.appearanceTier, undefined);
  assert.deepEqual([b.promotionStats.credited, b.promotionStats.promoted], [1, 0]);

  // 第 2 杀：升 2 档 → 银白头盔/盾色阶接管
  const v1 = viks()[0]; v1.hp = 1; b.applyHit(v1, def);
  assert.equal(def.kills, 2); assert.equal(def.level, 2); assert.equal(def.appearanceTier, 2);
  assert.deepEqual(b.promotionStats.last, { uid: def.uid, level: 2 });
  assert.equal(unitTierAppearance(def.appearanceTier).helmet, '#edf0df');
  // 升档只写外观：血量/伤势/兵种/体型/楼层全不变
  assert.deepEqual([def.hp, def.max, def.soak, def.kind, def.bodyScale, def.navFloor, def.stunRemaining], base, '升级不回血不重置状态');

  // 再 3 杀 → 5 杀 → 3 档金档
  for (let i = 0; i < 3; i++) { const v = viks()[0]; v.hp = 1; b.applyHit(v, def); }
  assert.equal(def.kills, 5); assert.equal(def.level, 3); assert.equal(def.appearanceTier, 3);
  assert.equal(b.promotionStats.promoted, 2); assert.equal(unitTierAppearance(def.appearanceTier).helmet, '#e9d37b');

  // 同队误伤：受害者死，击杀者不记
  const mate = b.squads[0].members.find((u) => !u.dead && u !== def);
  mate.hp = 1; const before = b.promotionStats.credited;
  b.applyHit(mate, def); assert.ok(mate.dead);
  assert.equal(def.kills, 5); assert.equal(b.promotionStats.credited, before);

  // 已死的击杀者不记（v0 死后再「补刀」不算它的）
  const vNext = viks()[0]; if (vNext) { vNext.hp = 1; b.applyHit(vNext, v0); assert.ok(vNext.dead); assert.equal(v0.kills, undefined); }
  out.melee = { kills: def.kills, level: def.level, promoted: b.promotionStats.promoted };

  /* ── 箭杀记账：shooter 字段接进同一击杀记账 ── */
  {
    const archer = b.squads.find((s) => s.archer)?.members.find((u) => !u.dead);
    const vik = viks().find((u) => u !== def);
    assert.ok(archer && vik, '弓手与靶子都在场');
    // 靶子挪到离守军最远的可站节点：单帧内没有近战/弓手干扰
    const defs = b.units.filter((u) => u.team === 0 && !u.dead);
    let best = null, bestD = -1;
    for (const n of b.navigation.graph.nodes) {
      if (n.floor !== world.top(n.cell)) continue;
      const d = Math.min(...defs.map((u) => Math.hypot(u.x - n.cell.cx, u.z - n.cell.cz)));
      if (d > bestD) { bestD = d; best = n; }
    }
    vik.x = best.cell.cx + .05; vik.z = best.cell.cz; vik.y = best.floor * b.L; vik.navFloor = best.floor; vik.hp = 1; vik.stunRemaining = 0;
    const to = [vik.x, vik.y + .08 * (vik.bodyScale ?? 1), vik.z];
    // 从四个方向里挑一条导航上通的短弧（避免隔墙导致箭提前插住）
    let arrow = null;
    for (const [dx, dz] of [[.3, 0], [-.3, 0], [0, .3], [0, -.3]]) {
      const from = [to[0] + dx, to[1] + .15, to[2] + dz];
      const shot = pickBallisticShot(defaultBallisticTable, Math.hypot(dx, dz), to[1] - from[1]);
      if (shot && b.navigation.clearSegment({ x: from[0], y: from[1], z: from[2] }, { x: to[0], y: to[1], z: to[2] })) { arrow = { from, shot }; break; }
    }
    assert.ok(arrow, '找到可行弹道');
    const m = new THREE.Mesh(b.arrowGeo, b.arrowMat); b.group.add(m);
    const killsBefore = archer.kills ?? 0;
    b.arrows.push({ mesh: m, trail: null, from: arrow.from, to, t: 1 - 1e-9, dur: arrow.shot.time, shot: arrow.shot, target: vik, stuck: false, shooter: archer });
    b.update(1 / 30);
    assert.ok(vik.dead, '箭落点击杀');
    assert.equal(archer.kills, killsBefore + 1, '箭杀记到射手');
    assert.equal(archer.level, unitLevelForKills(archer.kills), '射手等级 = 阈值映射');
    out.arrow = { kills: archer.kills, level: archer.level, credited: b.promotionStats.credited };
  }
}

console.log('unit-promotion: PASS', JSON.stringify(out));
