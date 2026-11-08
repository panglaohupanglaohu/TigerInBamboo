// 代码能力：登记、与旧配方节点合并、配方携带描述可在游戏页恢复、经验汇总。
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES, makeRecipe, validateRecipe, registerCodeCapabilities, codeMetaOf } from '../src/scene-authoring/pipeline-model.js';
import { classifyCapability } from '../src/scene-authoring/capability-library.js';
import { experienceFor } from '../src/scene-authoring/agent/orchestrator.js';
const metas = [
  { id: 'terrain.arch', layer: 'terrain', kind: '地形', name: '石拱 / 天桥', summary: 's', kind2: 'geometry', sources: ['1670794261669769217'], keywords: ['拱'], params: { count: { min: 1, max: 6, default: 2 } } },
  { id: 'effects.smoke', layer: 'effects', kind: '烟', name: '特效层 · 烟（烟囱炊烟）', summary: 's', kind2: 'layer', layer3d: 'smoke', sources: ['1015140880666300416'], keywords: ['烟'] },
];
test('code capabilities register as executable nodes; existing recipe node is upgraded, not duplicated', () => {
  const before = CAPABILITIES.length;
  registerCodeCapabilities(CAPABILITIES, metas);
  assert.equal(CAPABILITIES.length, before + 1);
  const smoke = CAPABILITIES.filter((c) => c.id === 'effects.smoke');
  assert.equal(smoke.length, 1); assert.equal(smoke[0].mode, 'code'); assert.ok(smoke[0].provenance, '保留原来源说明');
  assert.deepEqual(classifyCapability(CAPABILITIES.find((c) => c.id === 'terrain.arch')), ['terrain', '改体素 · 代码能力']);
  assert.ok(!makeRecipe().nodes.some((n) => n.id === 'terrain.arch'), '默认配方不自动插入新能力');
});
test('recipe carries code metadata so another page can validate it; params must be numbers', () => {
  const r = makeRecipe(); r.nodes.push({ id: 'terrain.arch', enabled: true, params: { count: 3 } }); r.code = codeMetaOf(r);
  assert.equal(r.code.length >= 1, true);
  assert.doesNotThrow(() => validateRecipe(structuredClone(r)));
  r.nodes.at(-1).params.count = 'x';
  assert.throws(() => validateRecipe(r), /参数/);
  assert.throws(() => registerCodeCapabilities([], [{ id: 'Bad Id', name: 'x' }]), /字段/);
});
test('experience counts runs, verification and commits per capability', () => {
  const rows = [
    { outcome: 'previewed', verify: 'pass', steps: [{ id: 'terrain.arch', status: 'applied' }] },
    { outcome: 'committed', verify: 'pass', steps: [{ id: 'terrain.arch', status: 'applied' }] },
    { outcome: 'previewed', verify: 'fail', why: '结构承托：新增 3 个悬空体素', steps: [{ id: 'terrain.arch', status: 'applied' }] },
  ];
  const x = experienceFor('terrain.arch', rows);
  assert.deepEqual([x.runs, x.applied, x.passed, x.failed, x.committed], [2, 2, 1, 1, 1]);
  assert.match(x.lastFailure, /悬空/);
});
