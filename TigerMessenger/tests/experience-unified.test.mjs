// 统一经验存储（§6-1）：v2 单键写入、旧分层键合并读、跨机导出导入复算。
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { experienceStore, unifiedStore, summaryFor, EXP_V2_KEY, LEGACY_EXP_KEYS } from '../src/scene-authoring/agent/experience.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

test('写只进 v2 键，旧分层键不动', () => {
  const s = mem(), st = experienceStore('tm.battle.experience.v1', s);
  st.add({ outcome: 'previewed', verify: 'fail', why: '测试失败', blame: ['battle.waves'], steps: [{ id: 'battle.waves', status: 'applied' }] });
  assert.equal(JSON.parse(s.getItem(EXP_V2_KEY)).length, 1);
  assert.equal(s.getItem('tm.battle.experience.v1'), null);
  const r = JSON.parse(s.getItem(EXP_V2_KEY))[0];
  assert.equal(r.tier, 'battle'); assert.ok(r.capabilityId === 'battle.waves');
});

test('旧键记录合并进读侧，去重并按时间排序', () => {
  const s = mem();
  s.setItem('tm.planet.experience.v1', JSON.stringify([{ at: 10, outcome: 'committed', steps: [{ id: 'planet.sea-level', status: 'applied' }] }]));
  s.setItem('tm.capability.experience.v1', JSON.stringify([{ at: 5, outcome: 'previewed', verify: 'pass', steps: [{ id: 'terrain.arch', status: 'applied' }] }]));
  const st = experienceStore('tm.mountain.experience.v1', s);
  st.add({ at: 20, outcome: 'previewed', verify: 'warn', steps: [{ id: 'mountain.rolling', status: 'applied' }] });
  const rows = st.read();
  assert.deepEqual(rows.map((r) => r.steps[0].id), ['terrain.arch', 'planet.sea-level', 'mountain.rolling']);
  assert.equal(st.summary('planet.sea-level').committed, 1);
});

test('汇总语义：失败按 blame 归属，committed 只算采用', () => {
  const rows = [
    { at: 1, outcome: 'previewed', verify: 'fail', why: '波次节奏超标', blame: ['battle.waves'], steps: [{ id: 'battle.stage', status: 'applied' }, { id: 'battle.waves', status: 'applied' }] },
    { at: 2, outcome: 'previewed', verify: 'pass', steps: [{ id: 'battle.stage', status: 'applied' }] },
    { at: 3, outcome: 'committed', steps: [{ id: 'battle.stage', status: 'applied' }] },
  ];
  assert.deepEqual({ ...summaryFor('battle.stage', rows), lastAt: undefined }, { runs: 2, applied: 2, passed: 1, failed: 1, committed: 1, lastFailure: '', lastAt: undefined });
  assert.equal(summaryFor('battle.waves', rows).lastFailure, '波次节奏超标');
});

test('导出文件导入另一台机器（全新存储）：记录与汇总一致，重复导入不产生重复', () => {
  const a = mem(), b = mem(), sa = experienceStore('tm.mountain.experience.v1', a);
  sa.add({ at: 1, outcome: 'previewed', verify: 'fail', why: '竖崖超标', blame: ['mountain.talus'], fingerprint: 'ph1', steps: [{ id: 'mountain.rolling', status: 'applied' }, { id: 'mountain.talus', status: 'applied' }] });
  sa.add({ at: 2, outcome: 'committed', fingerprint: 'ph1', steps: [{ id: 'mountain.rolling', status: 'applied' }] });
  const file = sa.export();
  const sb = unifiedStore({ storage: b });
  assert.equal(sb.import(file).added, 2);
  assert.equal(sb.import(file).added, 0);            // 重复导入去重
  assert.deepEqual(sb.read(), sa.read());
  assert.equal(sb.summary('mountain.talus').failed, 1);
  assert.equal(sb.summary('mountain.talus').lastFailure, '竖崖超标');
});

test('验证失败写入后，同一存储读出的 failed 立即 +1（队列重算的输入）', () => {
  const s = mem(), st = experienceStore('tm.gscene.experience.v1', s);
  st.add({ outcome: 'previewed', verify: 'pass', steps: [{ id: 'sea.tint', status: 'applied' }] });
  assert.equal(st.summary('sea.tint').failed, 0);
  st.add({ outcome: 'previewed', verify: 'fail', why: '倒影检查失败', blame: ['sea.tint'], steps: [{ id: 'sea.tint', status: 'applied' }] });
  const rows = st.read();
  assert.equal(st.summary('sea.tint', rows).failed, 1);
});
