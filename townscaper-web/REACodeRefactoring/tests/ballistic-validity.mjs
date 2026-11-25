// 987267068495003648 补学 · Validity 契约（射程环 / 沿弧遮挡 / 落点地表）。
// 原 Inspector 的 Valid 表达式只管「弧线离目标够近」；本测验收补上的世界语义契约：
//   契约逐项拒绝理由（环内/环外/遮挡/落点/无解/非法输入）、表达式表被墙挡自动换高抛弧、
//   同参同种子确定性、真实 Battle 装契约后放行照常命中 / 超环与遮挡不射。
// 跑法：node --test tests/ballistic-validity.mjs（或直接 node tests/ballistic-validity.mjs）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripWorld, makeView, Battle } from './fixtures/g5-battle.mjs';
import { createBallisticTable, createExpressionBallisticTable, createShotContract, pickBallisticShot } from '../src/core/ballistic-table.js';

// 确定性：把 Math.random 钉成固定序列（#shoot 的散布/cd 抖动都走它）
function seededRng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000; }
function withRng(seed, fn) { const keep = Math.random; Math.random = seededRng(seed); try { return fn(); } finally { Math.random = keep; } }

// 合成条带世界：9×1 格、全填 1 层岩 → 地表 y=0.5（L=0.5）；wallLevel>0 时把 x=2 那格再填成 wallLevel 层的墙
function battleFixture(wallCell = -1, wallLevel = 0) {
  const S = stripWorld(9, 1);
  for (const c of S.cells) S.world.fill(c, 1, { rock: true });
  if (wallCell >= 0 && wallLevel > 1) S.world.fill(S.at(wallCell, 0), wallLevel, { rock: true });
  const b = new Battle(makeView(S.world, S.index));
  b.start(S.world); b.nextWave = 1e9;
  const squad = { id: 2, archer: true, members: [], alive: true, goal: S.at(1, 0), goalFloor: 1 };
  const archer = { uid: 1, team: 0, squad, k: 0, hp: 3, max: 3, x: 1, z: 0, y: .5, navFloor: 1, cd: 0, dead: false, onBoat: null, face: 0, soak: 0, radius: .055 };
  const vik = { uid: 2, team: 1, squad: null, k: 0, hp: 2, max: 2, x: 4.4, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, radius: .055, stunRemaining: 9 };
  squad.members.push(archer); b.units = [archer, vik]; b.squads = [];
  return { b, archer, vik };
}
const pinTarget = (vik) => { vik.stunRemaining = 9; vik.x = 4.4; vik.z = 0; };

test('契约构造：非法参数逐项拒绝', () => {
  assert.throws(() => createShotContract({ minRange: -1 }), RangeError);
  assert.throws(() => createShotContract({ minRange: 4, maxRange: 3 }), RangeError);
  assert.throws(() => createShotContract({ landingTolerance: -0.1 }), RangeError);
  assert.throws(() => createShotContract({ samples: 3 }), RangeError);
  assert.throws(() => createShotContract({ blockedAt: 'wall' }), TypeError);
  assert.throws(() => createShotContract({ groundAt: 7 }), TypeError);
});

test('射程环 / 输入 / 落点：逐项拒绝理由', () => {
  const table = createBallisticTable();
  const shot = table.lookup(3, 0);
  assert.ok(shot, '解析表对 (3,0) 有解');
  const c = createShotContract({ minRange: .8, maxRange: 4.5 });
  assert.equal(c.validate([0, 0, 0], [3, 0, 0], shot).ok, true, '环内放行');
  const near = table.lookup(.4, 0);
  assert.equal(c.validate([0, 0, 0], [.4, 0, 0], near).reason, 'inside-min-ring', '内环拒绝');
  const far = table.lookup(5.2, 0);
  assert.equal(c.validate([0, 0, 0], [5.2, 0, 0], far).reason, 'beyond-max-ring', '外环拒绝');
  assert.equal(c.validate([0, 0, 0], [3, 0, 0], null).reason, 'no-solution');
  assert.equal(c.validate([0, 0, 0], [NaN, 0, 0], shot).reason, 'invalid-input');
  assert.equal(c.validate(null, [3, 0, 0], shot).reason, 'invalid-input');
  const water = createShotContract({ groundAt: (x) => (x > 2 ? null : 0) });   // 目标区是水面，没有地表
  assert.equal(water.validate([0, 0, 0], [3, 0, 0], shot).reason, 'bad-landing');
  const cliff = createShotContract({ groundAt: () => 2 });                     // 地表比瞄准点高两级
  assert.equal(cliff.validate([0, 0, 0], [3, 0, 0], shot).reason, 'bad-landing');
  const flat = createShotContract({ groundAt: () => 0 });
  assert.equal(flat.validate([0, 0, 0], [3, .2, 0], shot).ok, true, '落点容差内放行');
});

test('遮挡：解析表唯一解被墙挡即拒；表达式表自动换高抛越墙；全挡即 null', () => {
  // 墙 x∈[1.5,2.5]，低墙 y<1.0（相当于 1 层地上的 2 层柱），高墙 y<1.5，巨墙 y<6
  const low = (x, y) => x > 1.5 && x < 2.5 && y < 1.0;
  const mid = (x, y) => x > 1.5 && x < 2.5 && y < 1.5;
  const huge = (x, y) => x > 1.5 && x < 2.5 && y < 6;
  const cLow = createShotContract({ blockedAt: low, samples: 64 });
  const cMid = createShotContract({ blockedAt: mid, samples: 64 });
  const cHuge = createShotContract({ blockedAt: huge, samples: 64 });
  const from = [1, .65, 0], to = [4.4, .58, 0];

  const analytic = createBallisticTable().lookup(3.4, -0.07);
  assert.ok(analytic, '解析表有唯一解');
  const r = cLow.validate(from, to, analytic);
  assert.equal(r.reason, 'occluded', '解析表低平弧被低墙挡');
  assert.ok(r.at.x > 1.5 && r.at.x < 2.5 && r.at.y < 1.0, '遮挡点在墙体内');
  assert.equal(pickBallisticShot(createBallisticTable(), 3.4, -0.07, (s) => cLow.validate(from, to, s).ok), null, '解析表没有备选弧，契约拒即 null');

  const expr = createExpressionBallisticTable({ drag: 0, speedSteps: 21, angleSteps: 19 });
  const open = pickBallisticShot(expr, 3.4, -0.07, null);
  const lob = pickBallisticShot(expr, 3.4, -0.07, (s) => cLow.validate(from, to, s).ok);
  assert.ok(open && lob, '无墙/低墙都有解');
  assert.notEqual(lob.arcId, open.arcId, '被墙挡后换了候选弧');
  assert.ok(lob.th > open.th + .5, `低墙逼出高抛弧（${(open.th * 57.2958).toFixed(0)}°→${(lob.th * 57.2958).toFixed(0)}°）`);
  assert.equal(cLow.validate(from, to, lob).ok, true, '换出的弧沿程不碰墙');
  const lobMid = pickBallisticShot(expr, 3.4, -0.07, (s) => cMid.validate(from, to, s).ok);
  assert.ok(lobMid && lobMid.th > open.th, '1.5 高墙仍可高抛越过');
  assert.equal(pickBallisticShot(expr, 3.4, -0.07, (s) => cHuge.validate(from, to, s).ok), null, '全挡：所有候选都拒');
});

test('确定性：同参两表/同表两次结果逐项一致', () => {
  const mk = () => createExpressionBallisticTable({ drag: .8, speedSteps: 21, angleSteps: 19 });
  const wall = createShotContract({ blockedAt: (x, y) => x > 1.5 && x < 2.5 && y < .9, samples: 48 });
  const a1 = pickBallisticShot(mk(), 3.4, -0.07, (s) => wall.validate([1, .65, 0], [4.4, .58, 0], s).ok);
  const a2 = pickBallisticShot(mk(), 3.4, -0.07, (s) => wall.validate([1, .65, 0], [4.4, .58, 0], s).ok);
  assert.deepEqual({ id: a1.arcId, th: a1.th, v: a1.v, time: a1.time, cost: a1.cost }, { id: a2.arcId, th: a2.th, v: a2.v, time: a2.time, cost: a2.cost });
  const t = mk(), s1 = t.lookup(3.4, -0.07), s2 = t.lookup(3.4, -0.07);
  assert.deepEqual({ id: s1.arcId, cost: s1.cost }, { id: s2.arcId, cost: s2.cost }, '缓存路径同值');
});

test('真实 Battle：装契约后放行照常命中', () => withRng(0xbeef, () => {
  const { b, vik } = battleFixture();
  b.shotContract = b.makeShotContract({ minRange: .3, maxRange: 4.5 });
  let hits = 0;
  for (let i = 0; i < 240 && !hits; i++) { pinTarget(vik); b.update(1 / 60); if (vik.hp < 2) hits++; }
  assert.ok(b.arrows.length >= 1, '契约放行：箭射出了');
  assert.equal(hits, 1, '契约放行：箭命中了');
}));

test('真实 Battle：超射程环不射（表有解，是契约拒的）', () => withRng(0xbeef, () => {
  const { b, vik } = battleFixture();
  b.shotContract = b.makeShotContract({ minRange: .3, maxRange: 2.0 });       // 目标 3.4 格外
  const probe = b.shotContract.validate([1, .65, 0], [4.4, .58, 0], createBallisticTable().lookup(3.4, -0.07));
  assert.equal(probe.reason, 'beyond-max-ring');
  assert.ok(createBallisticTable().lookup(3.4, -0.07), '表本身有解，确系契约拦下');
  for (let i = 0; i < 200; i++) { pinTarget(vik); b.update(1 / 60); }
  assert.equal(b.arrows.length, 0, '超环：一支都没射');
}));

test('真实 Battle：解析表遇墙不射，表达式表换弧照射', () => withRng(0xbeef, () => {
  {   // 默认解析表 + x=2 格填到 3 层（y .5–1.5 实心）→ 唯一解被挡 → 不射
    const { b, vik } = battleFixture(2, 3);
    b.shotContract = b.makeShotContract({ minRange: .3, maxRange: 4.5 });
    for (let i = 0; i < 200; i++) { pinTarget(vik); b.update(1 / 60); }
    assert.equal(b.arrows.length, 0, '墙挡唯一解：一支都没射');
  }
  {   // 表达式表：同一堵墙，契约在 ranked 候选里挑出高抛弧 → 照射
    const { b, vik } = battleFixture(2, 3);
    b.projectileTable = createExpressionBallisticTable({ drag: 0, speedSteps: 21, angleSteps: 19 });
    b.shotContract = b.makeShotContract({ minRange: .3, maxRange: 4.5 });
    for (let i = 0; i < 120; i++) { pinTarget(vik); b.update(1 / 60); }
    assert.ok(b.arrows.length >= 1, '表达式表换高抛弧越墙射出');
    assert.ok(b.arrows[0].shot.th > .8, `射出的是高抛弧（${(b.arrows[0].shot.th * 57.2958).toFixed(0)}°）`);
  }
}));
