// R-A1 共享默认登记处：读 / 写 / 覆盖 / 撤销 / 场景汇总 / 坏数据兜底 / 确定性。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/defaults-registry.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDefaults, getDefault, setDefault, clearDefault, clearScene, listDefaults, listAll, recordKey, DEFAULTS_KEY, defaultStorage } from '../src/system-workshop/defaults.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};

test('set / get / list：scene:layer 记录往返，带 adoptedBy / at / plan', () => {
  const s = mem();
  const rec = setDefault(s, 'citadel', 'mountain', { capabilityId: 'mountain.rolling', planId: 'p1', plan: { a: 1 }, adoptedBy: 'user', at: '2026-11-23T00:00:00Z', source: 'workshop', note: 'n' });
  assert.equal(rec.capabilityId, 'mountain.rolling');
  assert.equal(rec.adoptedBy, 'user');
  const got = getDefault(s, 'citadel', 'mountain');
  assert.equal(got.planId, 'p1');
  assert.deepEqual(got.plan, { a: 1 });
  const all = listDefaults(s, 'citadel');
  assert.deepEqual(Object.keys(all), ['mountain']);
});

test('同一 scene:layer 再设覆盖旧记录；不同层互不影响', () => {
  const s = mem();
  setDefault(s, 'citadel', 'mountain', { capabilityId: 'mountain.rolling', at: 't1' });
  setDefault(s, 'citadel', 'building', { capabilityId: 'building.joint-wfc', at: 't2' });
  setDefault(s, 'citadel', 'mountain', { capabilityId: 'mountain.ridge', at: 't3' });
  assert.equal(getDefault(s, 'citadel', 'mountain').capabilityId, 'mountain.ridge');
  assert.equal(getDefault(s, 'citadel', 'building').capabilityId, 'building.joint-wfc');
});

test('clearDefault / clearScene：撤销与场景级清空', () => {
  const s = mem();
  setDefault(s, 'citadel', 'mountain', { capabilityId: 'a' });
  setDefault(s, 'citadel', 'building', { capabilityId: 'b' });
  setDefault(s, 'crystal', 'building', { capabilityId: 'c' });
  assert.equal(clearDefault(s, 'citadel', 'mountain'), true);
  assert.equal(getDefault(s, 'citadel', 'mountain'), null);
  assert.equal(clearDefault(s, 'citadel', 'mountain'), false);
  assert.equal(clearScene(s, 'citadel'), 1);
  assert.deepEqual(Object.keys(listAll(s)), ['crystal:building']);
});

test('坏数据兜底：坏 JSON / 缺 records / 记录缺 capabilityId 都不抛、当空表', () => {
  const s = mem();
  s.setItem(DEFAULTS_KEY, '{bad json');
  assert.deepEqual(listAll(s), {});
  s.setItem(DEFAULTS_KEY, JSON.stringify({ v: 1 }));
  assert.deepEqual(listAll(s), {});
  s.setItem(DEFAULTS_KEY, JSON.stringify({ records: { 'a:b': { planId: 'x' }, 'c:d': { capabilityId: 'ok', adoptedBy: 'weird', junk: 1 } } }));
  const all = listAll(s);
  assert.deepEqual(Object.keys(all), ['c:d']);
  assert.equal(all['c:d'].adoptedBy, 'user');
  assert.equal(all['c:d'].junk, undefined);
});

test('auto-test 来源保留；adoptedBy 非法值归一为 user；at 缺省补当前时间', () => {
  const s = mem();
  const r = setDefault(s, 'old-port', 'relief', { capabilityId: 'relief.soft', adoptedBy: 'auto-test' });
  assert.equal(r.adoptedBy, 'auto-test');
  assert.ok(!Number.isNaN(Date.parse(r.at)));
  const r2 = setDefault(s, 'old-port', 'relief', { capabilityId: 'relief.cliff', adoptedBy: 'robot' });
  assert.equal(r2.adoptedBy, 'user');
});

test('确定性：同样操作序列两次产生逐字节相同的存储内容', () => {
  const run = () => { const s = mem(); setDefault(s, 'citadel', 'mountain', { capabilityId: 'a', at: 'fixed' }); setDefault(s, 'citadel', 'fx', { capabilityId: 'b', at: 'fixed' }); return s.getItem(DEFAULTS_KEY); };
  assert.equal(run(), run());
});

test('recordKey / parseDefaults 往返；defaultStorage 在 Node 里是内存表不抛', () => {
  assert.equal(recordKey('citadel', 'mountain'), 'citadel:mountain');
  const s = defaultStorage();
  s.setItem('k', 'v');
  assert.equal(s.getItem('k'), 'v');
});

// ── R-A5 status / pendingRef 扩展 ──────────────────────────────────────────
test('R-A5 status / pendingRef：setDefault 透传合法值，非法 status 回退 active，pendingRef 非字符串归 null', () => {
  const s = mem();
  const r = setDefault(s, 'apostles', 'apostles-terrain', { capabilityId: 'apostles.look', status: 'pending-measurement', pendingRef: 'P-R32-01', note: '待实测' });
  assert.equal(r.status, 'pending-measurement');
  assert.equal(r.pendingRef, 'P-R32-01');
  const got = getDefault(s, 'apostles', 'apostles-terrain');
  assert.equal(got.status, 'pending-measurement');
  assert.equal(got.pendingRef, 'P-R32-01');
  const bad = setDefault(s, 'citadel', 'mountain', { capabilityId: 'x', status: 'bogus', pendingRef: 42 });
  assert.equal(bad.status, 'active');
  assert.equal(bad.pendingRef, null);
  const none = setDefault(s, 'old-port', 'relief', { capabilityId: 'y' });
  assert.equal(none.status, 'active');
  assert.equal(none.pendingRef, null);
});

test('R-A5 parseDefaults：旧记录无 status 视为 active；pending-* 与 pendingRef 从存储里保留', () => {
  const s = mem();
  s.setItem(DEFAULTS_KEY, JSON.stringify({ records: {
    'citadel:mountain': { capabilityId: 'mountain.plan', status: 'pending-user', pendingRef: 'P-R27-01,P-R28-01' },
    'old-port:relief': { capabilityId: 'relief.plan' },                       // 旧格式：无 status
    'crystal:building': { capabilityId: 'b', status: 'weird', pendingRef: 'P-R57-01' }, // 非法 status
  } }));
  const all = listAll(s);
  assert.equal(all['citadel:mountain'].status, 'pending-user');
  assert.equal(all['citadel:mountain'].pendingRef, 'P-R27-01,P-R28-01');
  assert.equal(all['old-port:relief'].status, 'active');
  assert.equal(all['crystal:building'].status, 'active');   // 非法值回退
  assert.equal(all['crystal:building'].pendingRef, 'P-R57-01'); // pendingRef 独立透传
});
