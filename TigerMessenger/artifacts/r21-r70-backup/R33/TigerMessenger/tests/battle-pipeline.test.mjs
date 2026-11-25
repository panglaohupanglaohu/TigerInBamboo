// 战役管线：Worker 侧能力库（纯数据）+ 验证 —— 不依赖 three / DOM / 游戏。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BATTLE_CAPABILITIES, describeBattleCapabilities, matchAll, runPlan } from '../src/system-workshop/battle/capabilities.js';
import { verifyBattle } from '../src/system-workshop/battle/verify.js';

const site = () => ({ scene: { id: 'apostles', label: '十二门徒' }, meshes: 1, cells: 4170, land: 239, maxLevel: 8, houses: 4, scale: 5, gridRadius: 18, unitHeight: 1.7, plateauRaised: 0 });

test('能力库只含可执行条目且元数据完整', () => {
  const desc = describeBattleCapabilities();
  assert.ok(desc.length >= 3);
  for (const c of desc) { assert.ok(c.id && c.name && c.does && c.executable); assert.equal(c.domain, 'battle'); }
  assert.deepEqual(BATTLE_CAPABILITIES.map((c) => c.meta.id), ['battle.stage', 'battle.garrison', 'battle.waves']);
});

test('扫描：三个能力都匹配到有陆地和小屋的采样', () => {
  const m = matchAll(site());
  for (const r of m) assert.ok(r.count > 0, r.id + ' 应可作用');
});

test('扫描：没有小屋时守军布防不匹配，没有陆地时全不匹配', () => {
  const noHouse = { ...site(), houses: 0 };
  assert.equal(matchAll(noHouse).find((r) => r.id === 'battle.garrison').count, 0);
  const noLand = { ...site(), land: 0, houses: 0 };
  for (const r of matchAll(noLand)) assert.equal(r.count, 0, r.id);
});

test('执行：三步管线产出完整作战计划（私有副本）', () => {
  const input = site();
  const report = runPlan(input, [
    { id: 'battle.stage', params: { scale: 4, gridRadius: 20, unitHeight: 1.7 } },
    { id: 'battle.garrison', params: { squads: 2, size: 10, tier: 2, archer: true } },
    { id: 'battle.waves', params: { firstWave: 5, interval: 30 } },
  ]);
  assert.deepEqual(report.map((r) => r.status), ['applied', 'applied', 'applied']);
  assert.deepEqual(input.plan, {
    scale: 4, gridRadius: 20, unitHeight: 1.7,
    garrison: { squads: 2, size: 10, tier: 2, archer: true },
    waves: { first: 5, interval: 30 },
  });
});

test('参数规范化：越界收进范围、布尔按类型取', () => {
  const input = site();
  runPlan(input, [{ id: 'battle.stage', params: { scale: 99, gridRadius: -3 } }, { id: 'battle.garrison', params: { squads: 99 } }]);
  assert.equal(input.plan.scale, 10);
  assert.equal(input.plan.gridRadius, 10);
  assert.equal(input.plan.garrison.squads, 5);
});

test('验证：健全计划通过；无陆地 / 无小屋 / 参数缺失判失败', () => {
  const okPlan = { scale: 5, gridRadius: 18, garrison: { squads: 1, size: 8, tier: 1 }, waves: { first: 3, interval: 26 } };
  const steps = [{ id: 'battle.stage' }, { id: 'battle.garrison' }, { id: 'battle.waves' }];
  assert.equal(verifyBattle(site(), okPlan, { steps }).status, 'pass');
  assert.equal(verifyBattle({ ...site(), land: 10, houses: 0 }, okPlan, { steps }).status, 'fail');
  assert.equal(verifyBattle(site(), {}, { steps }).status, 'fail');
  const badWave = verifyBattle(site(), { ...okPlan, waves: { first: 3, interval: 2 } }, { steps });
  assert.equal(badWave.checks.find((c) => c.id === 'waves').status, 'fail');
});

test('验证：超编守军给 warn/fail 且归责 battle.garrison', () => {
  const steps = [{ id: 'battle.stage' }, { id: 'battle.garrison' }];
  const warn = verifyBattle(site(), { scale: 5, gridRadius: 18, garrison: { squads: 5, size: 14, tier: 3 } }, { steps }).checks.find((x) => x.id === 'garrison');
  assert.equal(warn.status, 'warn');
  const fail = verifyBattle(site(), { scale: 5, gridRadius: 18, garrison: { squads: 7, size: 14, tier: 3 } }, { steps }).checks.find((x) => x.id === 'garrison');
  assert.equal(fail.status, 'fail');
  assert.deepEqual(fail.blame, ['battle.garrison']);
});
