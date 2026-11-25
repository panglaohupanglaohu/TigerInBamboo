// R28 用户采用后进游戏自动换上新山形：只认用户亲手「采用」写下的 v2 记录；?mountainAdopted=0 / 场景变了 / 旧记录都不换；一键回原山形。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/mountain-adopt.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { ADOPT_VERSION, adoptKey, adoptRecord, fieldSignature, sameSite, shouldAutoDeploy } from '../src/system-workshop/mountain/adopt.js';
import { arenaIsland, ARENA_GENERATIONS, runArenaGeneration } from '../src/system-workshop/mountain/arena.js';
const field = arenaIsland(), plan = runArenaGeneration(ARENA_GENERATIONS.at(-1), field).plan, sig = fieldSignature(field);

test('采用记录：v2、autoDeploy、带采用时的场景指纹；计划和网格对不上就拒绝', () => {
  const r = adoptRecord(plan, field, 123);
  assert.equal(r.v, ADOPT_VERSION); assert.equal(r.v, 2); assert.equal(r.autoDeploy, true); assert.equal(r.at, 123); assert.deepEqual(r.sig, sig);
  assert.equal(adoptKey('citadel'), 'tm.mountain.adopted.v1:citadel', '存储键不变：老的采用记录还在原位，只是不会被自动部署');
  assert.throws(() => adoptRecord({ h: [1, 2, 3] }, field), /不一致/);
  assert.ok(sig.land > 1000 && sig.structure > 50 && sig.rail > 30, JSON.stringify(sig));
});

test('自动部署的闸门：只有 v2 采用记录 + 场景对得上才换', () => {
  const rec = adoptRecord(plan, field);
  assert.equal(shouldAutoDeploy(null).deploy, false, '没有采用 = 原山形（不会悄悄变成默认）');
  assert.equal(shouldAutoDeploy({ plan, at: 1 }).deploy, false, 'R25 之前的旧记录只存档不部署');
  assert.equal(shouldAutoDeploy({ ...rec, autoDeploy: false }).deploy, false);
  assert.equal(shouldAutoDeploy({ ...rec, plan: null }).deploy, false);
  assert.equal(shouldAutoDeploy(rec, { search: '?mountainAdopted=0' }).deploy, false, '网址 ?mountainAdopted=0 = 一键看原山形');
  assert.equal(shouldAutoDeploy(rec, { search: '?mountainAdopted=0', sig }).deploy, false);
  assert.equal(shouldAutoDeploy(rec, { search: '?foo=1' }).deploy, true, '还没采样时先放行，等实景就绪后核对指纹');
  assert.equal(shouldAutoDeploy(rec, { sig }).deploy, true);
  const moved = { ...sig, structure: sig.structure + 40 }; const d = shouldAutoDeploy(rec, { sig: moved });
  assert.equal(d.deploy, false, '场景里多了建筑：不换，免得山压到新建筑上'); assert.match(d.reason, /场景和采用时不一样/);
});

test('同一场景的判定：网格一致、陆地 / 建筑 / 轨道格数各差 ≤ max(2, 1%)', () => {
  assert.ok(sameSite(sig, { ...sig })); assert.ok(sameSite(sig, { ...sig, land: sig.land + 2 }));
  assert.ok(!sameSite(sig, { ...sig, n: sig.n + 1 })); assert.ok(!sameSite(sig, { ...sig, step: 2 }));
  assert.ok(!sameSite(sig, { ...sig, rail: sig.rail + Math.max(3, Math.ceil(sig.rail * 0.01) + 1) }));
  assert.ok(!sameSite(null, sig)); assert.ok(!sameSite(sig, undefined));
});

test('游戏接线：main.js 启动时调自动部署；采用写 v2；有「回到原山形」；不碰存档与湖区', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), mc = fs.readFileSync(new URL('../src/world/rea/mountainCandidate.js', import.meta.url), 'utf8');
  assert.match(main, /mountainCandidate\.js\?v=[\w.-]+'\)\.then\(m=>m\.autoDeployAdoptedMountain\(/);
  assert.match(mc, /export function autoDeployAdoptedMountain\(/); assert.match(mc, /export function unadoptMountain\(/); assert.match(mc, /export function adoptedState\(/);
  assert.match(mc, /rec = adoptRecord\(plan,/, '采用时写 v2 记录');
  const auto = mc.slice(mc.indexOf('export function autoDeployAdoptedMountain'), mc.indexOf('export function paletteMountain'));
  assert.match(auto, /shouldAutoDeploy\(rec, \{ search, sig: fieldSignature\(r\.field\) \}\)/, '每次都用这次实景采样的指纹核对');
  assert.doesNotMatch(auto, /localStorage\.setItem|tm\.save|swamp|lake/i, '自动部署只读采用记录，不写任何存档、不碰湖区');
});
