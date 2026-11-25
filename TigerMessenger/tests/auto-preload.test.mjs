// R22 场景自动预装：扫描后空管线按 match 结果预装能力（含前置），清空过的不再自动填。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planPreload, preloadNote } from '../src/system-workshop/auto-preload.js';
import { describeBattleCapabilities } from '../src/system-workshop/battle/capabilities.js';
import { describeMountainCapabilities } from '../src/system-workshop/mountain/capabilities.js';

const caps = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', requires: ['a'] }, { id: 'c', name: 'C' }, { id: 'd', name: 'D', requires: ['b'] }];
const scan = (m) => ({ matches: Object.entries(m).map(([id, count]) => ({ id, count })) });

test('preload: empty pipeline gets every matched capability, in registry order', () => {
  const r = planPreload({ nodes: [] }, scan({ c: 2, a: 1, b: 0 }), caps);
  assert.equal(r.reason, 'preload');
  assert.deepEqual(r.ids, ['a', 'c']);
});
test('preload: prerequisites come along even if they had no direct match', () => {
  const r = planPreload({ nodes: [] }, scan({ d: 3 }), caps);
  assert.deepEqual(r.ids, ['a', 'b', 'd']);
});
test('preload: never touches a pipeline that already has runnable nodes', () => {
  assert.deepEqual(planPreload({ nodes: [{ id: 'c', enabled: true }] }, scan({ a: 1 }), caps), { ids: [], reason: 'has-nodes' });
  // 只有待完成节点 / 已停用节点 不算有可执行节点
  assert.equal(planPreload({ nodes: [{ id: 'x', pending: true }, { id: 'c', enabled: false }] }, scan({ a: 1 }), caps).reason, 'preload');
});
test('preload: user clearing the pipeline is respected unless forced', () => {
  assert.equal(planPreload({ nodes: [], preloadDismissed: true }, scan({ a: 1 }), caps).reason, 'dismissed');
  assert.deepEqual(planPreload({ nodes: [], preloadDismissed: true }, scan({ a: 1 }), caps, { force: true }).ids, ['a']);
});
test('preload: no scan / nothing matches → nothing added', () => {
  assert.equal(planPreload({ nodes: [] }, null, caps).reason, 'no-scan');
  assert.equal(planPreload({ nodes: [] }, scan({ a: 0 }), caps).reason, 'nothing-matches');
  assert.equal(planPreload({ nodes: [] }, scan({ zzz: 4 }), caps).reason, 'nothing-matches');
  // requires 成环不死循环
  const loop = [{ id: 'p', requires: ['q'] }, { id: 'q', requires: ['p'] }];
  assert.deepEqual(planPreload({ nodes: [] }, scan({ p: 1 }), loop).ids.sort(), ['p', 'q']);
});
test('preload: note names the scene and the action', () => {
  const n = preloadNote(['a', 'c'], caps, '十二门徒');
  assert.match(n, /十二门徒/); assert.match(n, /2 个能力/); assert.match(n, /▶ 执行管线/);
  assert.equal(preloadNote([], caps, 'x'), '');
});
test('preload: real battle / mountain registries — every cap matched ⇒ all preloaded, requires satisfied', () => {
  for (const reg of [describeBattleCapabilities(), describeMountainCapabilities()]) {
    const all = scan(Object.fromEntries(reg.map((c) => [c.id, 1])));
    const r = planPreload({ nodes: [] }, all, reg);
    assert.equal(r.ids.length, reg.length);
    for (const c of reg) for (const q of c.requires || []) if (reg.some((x) => x.id === q)) assert.ok(r.ids.indexOf(q) < r.ids.indexOf(c.id), c.id + ' after ' + q);
  }
});
test('preload: scene-layer workshops opt in; planet / object do not', () => {
  const read = (f) => fs.readFileSync(new URL('../src/system-workshop/' + f, import.meta.url), 'utf8');
  for (const f of ['battle-workshop.js', 'mountain-workshop.js', 'fx-workshop.js', 'gscene-workshop.js']) assert.match(read(f), /autoPreload: true/, f);
  for (const f of ['planet-workshop.js', 'object-workshop.js']) assert.doesNotMatch(read(f), /autoPreload: true/, f);
  const tw = read('tier-workshop.js');
  assert.match(tw, /preloadFromScan\(\)/); assert.match(tw, /preloadDismissed = true/); assert.match(tw, /按场景预装/);
});
