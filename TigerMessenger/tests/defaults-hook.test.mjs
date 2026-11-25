// R-A4 通用默认加载钩子：planHook 逐层状态、applyDefaultsForScene 汇总 status、层记录缺失如实报、mountain/building 核对各自 adopted.v1。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/defaults-hook.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { planHook, applyDefaultsForScene, layerCheck } from '../src/world/rea/defaultsHook.js';
import { setDefault } from '../src/system-workshop/defaults.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('planHook：每层结果带 capabilityId / adoptedBy / state / note', () => {
  const check = (layer) => ({ state: layer === 'mountain' ? 'ok' : 'no-apply-semantics', note: 'n-' + layer });
  const r = planHook({ mountain: { capabilityId: 'mountain.pipeline', adoptedBy: 'auto-test', at: 't' }, relief: { capabilityId: 'relief.soft' } }, 'citadel', check);
  assert.equal(r.mountain.state, 'ok'); assert.equal(r.mountain.adoptedBy, 'auto-test'); assert.equal(r.mountain.note, 'n-mountain');
  assert.equal(r.relief.state, 'no-apply-semantics');
});

test('applyDefaultsForScene：无场景 / 无记录 / 全 ok / 有缺失 四种 status', () => {
  const s = mem();
  assert.equal(applyDefaultsForScene('', { storage: s }).status, 'no-scene');
  assert.equal(applyDefaultsForScene('citadel', { storage: s }).status, 'empty');
  setDefault(s, 'citadel', 'mountain', { capabilityId: 'mountain.pipeline' });
  const ok = applyDefaultsForScene('citadel', { storage: s, check: () => ({ state: 'ok', note: '' }) });
  assert.equal(ok.status, 'applied'); assert.equal(ok.scene, 'citadel');
  const inc = applyDefaultsForScene('citadel', { storage: s, check: (l) => ({ state: l === 'mountain' ? 'missing-layer-record' : 'ok', note: '' }) });
  assert.equal(inc.status, 'incomplete');
  assert.equal(globalThis.__tmDefaultsHook.results.mountain.state, 'missing-layer-record');
});

test('layerCheck：mountain 看 tm.mountain.adopted.v1，building 看 tm.building.adopted.v1，其他层 no-apply-semantics', () => {
  const s = mem();
  assert.equal(layerCheck('mountain', 'citadel', s).state, 'missing-layer-record');
  s.setItem('tm.mountain.adopted.v1:citadel', JSON.stringify({ v: 2, plan: { h: [] } }));
  assert.equal(layerCheck('mountain', 'citadel', s).state, 'ok');
  assert.equal(layerCheck('building', 'citadel', s).state, 'missing-layer-record');
  s.setItem('tm.building.adopted.v1:citadel', JSON.stringify({ layout: {} }));
  assert.equal(layerCheck('building', 'citadel', s).state, 'adopted-no-autodeploy');
  assert.equal(layerCheck('battle', 'citadel', s).state, 'missing-layer-record');
  s.setItem('tm.battle.adopted.v1:citadel', JSON.stringify({ plan: {} }));
  assert.equal(layerCheck('battle', 'citadel', s).state, 'ok');
  assert.equal(layerCheck('fx', 'citadel', s).state, 'no-apply-semantics');
  s.setItem('tm.mountain.adopted.v1:citadel', '{bad');
  assert.equal(layerCheck('mountain', 'citadel', s).state, 'missing-layer-record');
});

// ── R-A5：pending-* 记录绝不能被当成可应用默认 ──
test('planHook：status!==active → skipped-pending，不进 check；全 pending → apply status pending-only', () => {
  const s = mem();
  let checked = 0;
  const check = () => { checked++; return { state: 'ok', note: '' }; };
  const r = planHook({ mountain: { capabilityId: 'mountain.plan', status: 'pending-user', pendingRef: 'P-R28-01' }, relief: { capabilityId: 'relief.plan' } }, 'citadel', check);
  assert.equal(r.mountain.state, 'skipped-pending');
  assert.equal(r.mountain.pendingRef, 'P-R28-01');
  assert.equal(r.relief.state, 'ok');
  assert.equal(checked, 1); // pending 记录不该触发层检查
  // 全 pending：applyDefaultsForScene 汇总 pending-only
  const s2 = mem();
  setDefault(s2, 'citadel', 'mountain', { capabilityId: 'mountain.plan', status: 'pending-user', pendingRef: 'P-R28-01' });
  const st = applyDefaultsForScene('citadel', { storage: s2, check });
  assert.equal(st.status, 'pending-only');
  assert.equal(st.results.mountain.state, 'skipped-pending');
});
