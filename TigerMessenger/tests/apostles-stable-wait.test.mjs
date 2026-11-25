// R29：等十二门徒岩体网格「稳定出现」再读状态（src/world/rea/stable-wait.js）。用假帧模拟场景重建：换场景那一帧读到 0、旧场景读到一半、采样抛错。
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { createStableTracker, waitForStable, sampleApostleScene } from '../src/world/rea/stable-wait.js';

const frame = (sceneKey, count, look = 'soft') => ({ sceneKey, count, look });
/** 假时钟：sleep 只推进时间，不真等 */
const fakeClock = () => { let t = 0; return { now: () => t, sleep: async (ms) => { t += ms; } }; };
const feed = (frames) => { let i = 0; return async () => { const f = frames[Math.min(i, frames.length - 1)]; i++; if (f instanceof Error) throw f; return f; }; };

test('连续 need 次「同一场景 + 同样网格数」才算稳定', () => {
  const t = createStableTracker({ need: 3 });
  assert.equal(t.observe(frame('A', 9)), false); assert.equal(t.observe(frame('A', 9)), false); assert.equal(t.observe(frame('A', 9)), true);
  assert.equal(t.stable, true); assert.equal(t.streak, 3);
});
test('重建间隙：读到 0 / null / 场景换了 / 网格数在涨，都清零重数，不下「没有岩体」的结论', () => {
  const t = createStableTracker({ need: 3 });
  for (const f of [frame('A', 9), frame('A', 9), frame('B', 0)]) t.observe(f);
  assert.equal(t.streak, 0, '换场景那一帧 0 个网格：清零');
  t.observe(frame('B', 4)); t.observe(frame('B', 4)); t.observe(frame('B', 9));
  assert.equal(t.streak, 1, '网格数还在涨：从新的数重新数'); assert.equal(t.stable, false);
  t.observe(null); assert.equal(t.streak, 0, '采样失败：清零');
  t.observe(frame('B', 9)); t.observe(frame('C', 9)); assert.equal(t.streak, 1, '网格数相同但场景对象换了：重新数');
  t.observe({ sceneKey: 'C', count: NaN }); assert.equal(t.streak, 0);
  assert.ok(t.resets >= 3);
});
test('换候选（look 变了）也要重新数', () => {
  const t = createStableTracker({ need: 2 });
  t.observe(frame('A', 9, 'approved')); assert.equal(t.observe(frame('A', 9, 'soft')), false); assert.equal(t.observe(frame('A', 9, 'soft')), true);
});
test('waitForStable：场景重建（0 → 一半 → 全部）后返回稳定的那次采样；抛错只算一次失败', async () => {
  const c = fakeClock(), frames = [frame('old', 9), frame('old', 9), Error('页面导航中'), frame('new', 0), frame('new', 5), frame('new', 9), frame('new', 9), frame('new', 9)];
  const r = await waitForStable(feed(frames), { need: 3, interval: 500, timeout: 60000, ...c });
  assert.equal(r.ok, true); assert.deepEqual(r.sample, frame('new', 9)); assert.equal(r.samples, 8);
  assert.ok(r.history.some((h) => h.error === '页面导航中'));
  assert.ok(r.resets >= 2);
});
test('waitForStable：一直不稳定 → 超时返回 ok:false 与最后一次采样，不编数', async () => {
  const c = fakeClock(); let n = 0;
  const r = await waitForStable(async () => frame('S' + (n++), 9), { need: 3, interval: 1000, timeout: 10000, ...c });
  assert.equal(r.ok, false); assert.match(r.reason, /没有连续 3 次稳定/); assert.equal(r.sample.count, 9); assert.ok(r.ms >= 10000);
});
test('min：网格数低于下限不算稳定（例如只等到 1 块岩体）', async () => {
  const c = fakeClock(); const r = await waitForStable(feed([frame('A', 1)]), { need: 2, min: 9, interval: 100, timeout: 1000, ...c }); assert.equal(r.ok, false);
});
test('sampleApostleScene：只数 userData.apostleMass 的网格，返回场景 uuid', () => {
  const objs = [{ isMesh: true, userData: { apostleMass: 'bay-1' } }, { isMesh: true, userData: {} }, { isMesh: false, userData: { apostleMass: 'x' } }, { isMesh: true, userData: { apostleMass: 'back-left' } }];
  const scene = { uuid: 'U1', traverse: (fn) => objs.forEach(fn) };
  assert.deepEqual(sampleApostleScene(scene, 'soft'), { sceneKey: 'U1', count: 2, look: 'soft', massIds: ['back-left', 'bay-1'] });
  assert.equal(sampleApostleScene(null), null);
});
