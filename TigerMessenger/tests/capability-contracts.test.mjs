// R51 统一能力契约：每个可执行能力都有 reads / writes / preserves（meta 自带；P-R51-01 后过渡表已清空，仅作 contractOf 空壳兜底），词表外的名字、读不到的资源、requires 成环都报错。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateContracts, contractOf, OVERLAY, RESOURCES, PRESERVES, LAYER_INPUTS, contractLine } from '../src/system-workshop/contracts.js';
import { describeMountainCapabilities } from '../src/system-workshop/mountain/capabilities.js';
import { describeBattleCapabilities } from '../src/system-workshop/battle/capabilities.js';
import { describeFxCapabilities } from '../src/system-workshop/fx/capabilities.js';
import { describeApostlesTerrainCapabilities } from '../src/system-workshop/apostles-terrain/capabilities.js';
import { describeGsceneCapabilities } from '../src/system-workshop/gscene/capabilities.js';
import { describeObjectCapabilities } from '../src/system-workshop/object/capabilities.js';
import { describePlanetCapabilities } from '../src/system-workshop/planet/capabilities.js';
import { describeBuildingCapabilities } from '../src/system-workshop/building/capabilities.js';
const ALL_LAYERS = () => [
  { id: 'mountain', caps: describeMountainCapabilities() }, { id: 'building', caps: describeBuildingCapabilities() }, { id: 'apostles-terrain', caps: describeApostlesTerrainCapabilities() },
  { id: 'battle', caps: describeBattleCapabilities() }, { id: 'fx', caps: describeFxCapabilities() }, { id: 'gscene', caps: describeGsceneCapabilities() },
  { id: 'object', caps: describeObjectCapabilities() }, { id: 'planet', caps: describePlanetCapabilities() },
];

test('contracts: every executable capability in every layer has a valid contract, zero errors', () => {
  const v = validateContracts(ALL_LAYERS());
  assert.ok(v.total >= 45, 'total ' + v.total);
  assert.deepEqual(v.missing, [], 'capabilities without contract');
  assert.equal(v.errors, 0, JSON.stringify(v.problems.filter((p) => p.level === 'error'), null, 1));
  assert.equal(v.declared, v.total);
});
test('contracts: every layer declares in meta (P-R51-01: overlay emptied into mountain / battle / fx metas)', () => {
  for (const L of ALL_LAYERS()) for (const m of L.caps) {
    const c = contractOf(m, L.id);
    assert.equal(c.source, 'meta', m.id + ' should declare reads / writes / preserves in meta');
  }
  const ids = new Set(ALL_LAYERS().filter((L) => ['mountain', 'battle', 'fx'].includes(L.id)).flatMap((L) => L.caps.map((c) => c.id)));
  for (const id of Object.keys(OVERLAY)) assert.ok(ids.has(id), 'overlay entry for unknown capability ' + id);
});
test('contracts: meta fields win over the overlay (overlay now an empty shell)', () => {
  assert.equal(contractOf({ id: 'mountain.protect', reads: ['heightfield'], writes: ['protectMask'], preserves: [] }).source, 'meta');
  assert.equal(contractOf(describeMountainCapabilities().find((m) => m.id === 'mountain.protect'), 'mountain').source, 'meta');
  assert.equal(contractOf({ id: 'mountain.protect' }).source, 'none');   // 过渡表已清空，meta 缺失就是 'none'
  assert.equal(contractOf({ id: 'nobody.x' }).source, 'none');
});
test('contracts: the validator catches broken contracts', () => {
  const v = validateContracts([{ id: 'mountain', caps: [
    { id: 'x.a', name: 'A', domain: 'd', line: 'terrain', reads: ['nope'], writes: ['heightfield'], preserves: [] },
    { id: 'x.b', name: 'B', domain: 'd', line: 'terrain', reads: ['buildableMask'], writes: ['palette'], preserves: ['bogus'] },
    { id: 'x.c', name: 'C', domain: 'd', line: 'terrain', requires: ['x.d'], reads: [], writes: ['palette'], preserves: [] },
    { id: 'x.d', name: 'D', domain: 'd', line: 'terrain', requires: ['x.c'], reads: [], writes: ['palette'], preserves: [] },
    { id: 'x.e', name: 'E', domain: 'd', reads: [], writes: [], preserves: [], requires: ['ghost'] },
    { id: 'x.f', name: 'F', domain: 'd', line: 'terrain' },
  ] }]);
  const has = (id, re) => v.problems.some((p) => p.id === id && re.test(p.text));
  assert.ok(has('x.a', /不在词表/), 'unknown resource');
  assert.ok(has('x.a', /建筑保护带/), 'height writer must preserve building buffer');
  assert.ok(has('x.b', /扫描不给/), 'unmet read');
  assert.ok(has('x.b', /保护项/), 'unknown preserve');
  assert.ok(v.problems.some((p) => /成环/.test(p.text)), 'requires cycle');
  assert.ok(has('x.e', /line/) && has('x.e', /不存在/), '§5.3 field + dangling requires');
  assert.deepEqual(v.missing, ['x.f']);
});
test('contracts: vocabulary is Chinese-labelled and every layer input is a known resource', () => {
  for (const [k, v] of Object.entries(RESOURCES)) assert.ok(/[\u4e00-\u9fff]/.test(v), k);
  for (const v of Object.values(PRESERVES)) assert.ok(/[\u4e00-\u9fff]/.test(v));
  for (const list of Object.values(LAYER_INPUTS)) for (const r of list) assert.ok(RESOURCES[r], r);
  assert.match(contractLine(contractOf(describeBuildingCapabilities()[2], 'building')), /读 .*写 候选建筑群.*不动 .*已有建筑/);
});
test('contracts: the pipeline page mounts the contract panel (studio → auto-assemble-panel)', () => {
  const studio = fs.readFileSync(new URL('../src/scene-authoring/studio.js', import.meta.url), 'utf8');
  assert.match(studio, /auto-assemble-panel\.js\?v=assemble-r1/);
  const panel = fs.readFileSync(new URL('../src/system-workshop/auto-assemble-panel.js', import.meta.url), 'utf8');
  assert.match(panel, /validateContracts/); assert.match(panel, /contract-panel/);
  const html = fs.readFileSync(new URL('../pipeline.html', import.meta.url), 'utf8');
  assert.match(html, /studio\.js\?v=[\w-]+/);   // 版本号由最后改 studio.js 的一轮决定，这里只确认带了版本号
});
