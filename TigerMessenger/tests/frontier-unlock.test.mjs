// R39 收尾（Guide §9 E 组验收）：重算能力树后，fire / hallway / sediment / projectiles 四条线都有 ⚙，解锁前沿为空，27/27 条线可执行。
// 用脚本口径（collectExecutables，与 build-capability-lineage / build-capability-maturity 同一份清单）+ 真实源码扫描 + 真实 JEV 归线结果。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeLineage, collectExecutables } from '../tools/refactor/build-capability-lineage.mjs';
import { buildCapabilityTree } from '../../townscaper-web/REACodeRefactoring/src/core/capability-tree.js';

const jev = JSON.parse(fs.readFileSync(new URL('../src/scene-authoring/catalog/capability-tree-jev.json', import.meta.url)));
const { manifest, lineage } = await computeLineage();
const executables = collectExecutables();
const tree = buildCapabilityTree(lineage, { alignment: manifest.alignment, executables, jev });
const FOUR = { fire: 'fx.fire', hallway: 'fx.hallway', sediment: 'fx.sediment', projectiles: 'fx.projectiles' };

test('四个新能力都在脚本口径的可执行清单里，且带 modules（归线靠它与 meta.line）', () => {
  for (const id of Object.values(FOUR)) { const e = executables.find((x) => x.id === id); assert.ok(e, id); assert.ok(e.modules?.length, id + ' 没有 modules'); }
});

test('fire / hallway / sediment / projectiles 四条线各自挂上了对应能力', () => {
  for (const [line, id] of Object.entries(FOUR)) { assert.ok(tree.nodes[line], '树上没有线 ' + line); assert.ok(tree.nodes[line].executables.includes(id), `${line} 线没有 ${id}：${tree.nodes[line].executables.join(',')}`); }
});

test('解锁前沿为空', () => {
  assert.deepEqual(tree.frontier.map((f) => f.id), [], '前沿还有：' + tree.frontier.map((f) => f.id).join(','));
});

test('27 / 27 条能力线带 ⚙', () => {
  const nodes = Object.values(tree.nodes);
  assert.equal(nodes.length, 27);
  assert.deepEqual(nodes.filter((n) => !n.executables.length).map((n) => n.id), []);
  assert.equal(tree.summary.fruit, 27);
});
