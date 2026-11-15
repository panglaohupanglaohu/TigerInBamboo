// 能力谱系：代际切分、方向（先向前再回补）、组合前置、补学队列得分、经验与管线需求回流。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCapabilityEvolution } from '../../townscaper-web/REACodeRefactoring/src/core/capability-evolution.js';
import { buildCapabilityLineage, describeDirection, STEP_RELATIONS } from '../../townscaper-web/REACodeRefactoring/src/core/capability-lineage.js';
import { parseLearningDeclaration } from '../src/scene-authoring/learning-declaration.js';
import { describeCapabilities } from '../../townscaper-web/REACodeRefactoring/src/capabilities/registry.js';

// 合成来源：帖子 ID 的高位就是发布时间，t(年) 生成一个落在该年的 ID
const idAt = (iso, n = 0) => String(((BigInt(Date.parse(iso)) - 1288834974657n) << 22n) + BigInt(n));
const A = idAt('2017-03-01'), A1 = idAt('2019-06-01'), A2 = idAt('2022-09-01'), B = idAt('2018-01-01'), REF = idAt('2020-01-01');
const item = (id, project, status, where, text) => ({ id, project, status, where, text, note: '', topic: 'water' });
const learn = { items: [item(A, 'badnorth', 'done', 'src/water/a.js', 'first'), item(A1, 'townscaper', 'partial', 'src/water/a.js · src/water/a-plus.js', 'better'), item(A2, 'next', 'partial', '', 'best'), item(B, 'badnorth', 'done', 'src/core/grid.js', 'grid'), item(REF, 'townscaper', 'ref', '', 'showcase')] };
const review = (id, priority) => ({ priority, workType: '机制', reason: 'r', nextAction: '补 ' + id, acceptance: '验收', sourceGap: '缺口 ' + id, sourceEvidence: { status: 'partial', note: '', where: learn.items.find((i) => i.id === id).where } });
const pipeline = { lanes: [], evolution: { schemaVersion: 1, families: [{ id: 'shore', name: '岸线：A → A+', clips: [A, A1, A2, REF], preferred: [] }, { id: 'grid', name: '网格：基础', clips: [B], preferred: [] }],
  relations: [{ fromId: A, toId: A1, type: 'improves', reason: 'A 变 A+', evidence: [{ id: A1, field: 'text', value: 'better' }] }], completionReviews: { [A1]: review(A1, '中'), [A2]: review(A2, '高') } } };
const modules = [{ path: 'src/water/a.js', dependencies: [{ path: 'src/core/grid.js' }, { path: 'src/core/grid-util.js' }] }, { path: 'src/water/a-plus.js', dependencies: [{ path: 'src/core/grid.js' }] }, { path: 'src/core/grid.js', dependencies: [{ path: 'src/core/grid-util.js' }] }, { path: 'src/core/grid-util.js', dependencies: [] }, { path: 'src/misc/orphan.js', dependencies: [] }];

test('代际按关系与阶段切分，方向先向前', () => {
  const L = buildCapabilityLineage(buildCapabilityEvolution(learn, pipeline), { modules });
  const shore = L.lines.find((l) => l.id === 'shore');
  assert.deepEqual(shore.generations.map((g) => g.label), ['A', 'A+', 'A++']);
  assert.equal(shore.generations[1].via.type, 'improves'); assert.equal(shore.generations[2].via.type, 'phase');
  assert.deepEqual(shore.generations.map((g) => g.state), ['complete', 'building', 'learning']);
  assert.equal(shore.frontier, 0); assert.equal(shore.solid, 0);
  assert.deepEqual(shore.target, { generation: 1, label: 'A+', clip: A1, mode: 'advance' });
  assert.equal(shore.generations[1].members.find((m) => m.id === REF).level, null, '参考记录不上阶梯');
  assert.match(describeDirection(shore, L), /代码已到 A.*向前下一步是 A\+/);
  assert.ok(STEP_RELATIONS.has('improves') && !STEP_RELATIONS.has('explains'));
});

test('模块归线、import 推断与组合前置', () => {
  const L = buildCapabilityLineage(buildCapabilityEvolution(learn, pipeline), { modules, alignment: [{ source: 'engine/shore.js', status: 'requires-parity-review', targets: [{ path: 'src/water/a.js' }], clips: [] }, { source: 'tools/x.js', status: 'missing-target', targets: [], clips: [] }] });
  assert.equal(L.moduleOwners['src/water/a.js'].line, 'shore');
  assert.deepEqual(L.moduleOwners['src/core/grid-util.js'], { line: 'grid', basis: 'import-inference' });
  assert.deepEqual(L.unownedModules, ['src/misc/orphan.js']);
  const shore = L.lines.find((l) => l.id === 'shore');
  assert.deepEqual(shore.requires.map((r) => r.id), ['grid']);
  assert.deepEqual(L.combinations.find((c) => c.line === 'shore').order, ['grid', 'shore']);
  assert.equal(L.combinations.find((c) => c.line === 'shore').readiness, 'needs-adapter');
  assert.equal(L.originals.classified, 1); assert.deepEqual(L.originals.unclassified.map((o) => o.source), ['tools/x.js']);
  assert.deepEqual(L.adaptQueue.map((a) => a.line).sort(), ['grid', 'shore']);
});

test('补学队列：得分、理由，以及经验 / 管线需求回流', () => {
  const evolution = buildCapabilityEvolution(learn, pipeline);
  const base = buildCapabilityLineage(evolution, { modules });
  assert.deepEqual(base.queue.map((q) => q.id), [A2, A1], '高优先级在前');
  assert.equal(base.queue.find((q) => q.id === A1).score, 20 + 6); assert.equal(base.queue.find((q) => q.id === A2).score, 30);
  const executables = [{ id: 'water.shore', name: '岸浪', tier: 'scene', sources: [A] }];
  const fed = buildCapabilityLineage(evolution, { modules, executables, experience: { 'water.shore': { runs: 3, passed: 1, failed: 2, committed: 1 } }, demand: [{ id: 'node.x', name: '新岸浪', clips: [A1] }] });
  const q = fed.queue.find((x) => x.id === A1);
  assert.equal(q.score, 20 + 6 + 2 + 8 + 8); assert.equal(fed.queue[0].id, A1, '系统需要的缺口升到队首');
  assert.ok(q.why.some((w) => w.includes('管线已放入')) && q.why.some((w) => w.includes('验证失败 2 次')));
  const shore = fed.lines.find((l) => l.id === 'shore');
  assert.equal(shore.generations[0].level, 5, '执行并采用过'); assert.deepEqual(shore.executables, ['water.shore']);
  assert.equal(fed.combinations.find((c) => c.line === 'shore').readiness, 'runnable');
  assert.deepEqual(fed.adaptQueue.map((a) => a.line), ['grid']);
  assert.equal(fed.demand[0].needs, 'learning'); assert.equal(fed.loop.failed, 2); assert.equal(fed.loop.committed, 1);
});

test('被后续方案替代的缺口不进队列；先完成更新一代时旧代回补后置', () => {
  const l2 = { items: [item(A, 'badnorth', 'partial', 'src/water/a.js', 'first'), item(A1, 'townscaper', 'done', 'src/water/a-plus.js', 'better'), item(B, 'badnorth', 'partial', 'src/water/b.js', 'side')] };
  const mk = (type) => ({ lanes: [], evolution: { schemaVersion: 1, families: [{ id: 'shore', name: '岸线', clips: [A, A1, B], preferred: [] }], relations: [{ fromId: A, toId: A1, type, reason: 'x', evidence: [{ id: A1, field: 'text', value: 'better' }] }],
    completionReviews: { [A]: { ...review(A1, '中'), sourceEvidence: { status: 'partial', note: '', where: 'src/water/a.js' } }, [B]: { ...review(A1, '低'), sourceEvidence: { status: 'partial', note: '', where: 'src/water/b.js' } } } } });
  const sup = buildCapabilityLineage(buildCapabilityEvolution(l2, mk('supersedes')));
  assert.deepEqual(sup.queue.map((q) => q.id), [B], '被替代的 A 不再排队');
  const imp = buildCapabilityLineage(buildCapabilityEvolution(l2, mk('improves'))), shore = imp.lines[0];
  assert.equal(shore.frontier, 1); assert.equal(shore.target.mode, 'backfill'); assert.equal(shore.backfillGaps, 2);
  assert.ok(imp.queue.find((q) => q.id === B).why.some((w) => w.includes('回补可后置')));
});

test('真实资料：全部来源入线，队列覆盖全部未被替代的缺口，结果确定', () => {
  const root = new URL('../../townscaper-web/REACodeRefactoring/', import.meta.url);
  const read = (name, key) => parseLearningDeclaration(fs.readFileSync(new URL(name, root), 'utf8'), key);
  const evolution = buildCapabilityEvolution(read('learn/data.js', 'LEARN'), read('learn/pipeline.js', 'PIPELINE'));
  const library = JSON.parse(fs.readFileSync(new URL('../src/scene-authoring/catalog/system-catalog.json', import.meta.url), 'utf8'));
  const options = { modules: library.modules, alignment: library.alignment, executables: describeCapabilities().map((c) => ({ ...c, tier: 'scene' })) };
  const L = buildCapabilityLineage(evolution, options);
  assert.equal(L.lines.reduce((n, l) => n + l.generations.reduce((k, g) => k + g.members.length, 0) + l.loose.length, 0), evolution.events.reduce((n, e) => n + e.families.length, 0));
  const gaps = new Set(evolution.events.filter((e) => e.status === 'partial' && e.families.some((f) => L.lines.find((l) => l.id === f).kind === 'line') && !e.outgoing.some((k) => { const r = evolution.relations.find((x) => x.id === k); return r.valid && r.type === 'supersedes'; })).map((e) => e.id));
  assert.deepEqual(new Set(L.queue.map((q) => q.id)), gaps);
  assert.equal(L.queue.length, gaps.size, '同一来源只排一次'); assert.ok(L.queue.some((q) => q.alsoIn.length));
  assert.ok(L.queue.every((q, i) => i === 0 || L.queue[i - 1].score >= q.score));
  for (const l of L.lines.filter((x) => x.kind === 'line')) { assert.ok(l.generations.length >= 1, l.id); assert.ok(l.generations.every((g, i) => i === 0 || g.from >= l.generations[i - 1].from), l.id + ' 代际按时间'); if (l.target) assert.ok(l.target.mode === 'backfill' || l.target.generation > l.frontier); }
  assert.ok(L.executables.every((x) => x.lines.length), '能力库 registry 的能力都能排进能力线');
  assert.ok(L.loop.ownedModules > L.loop.modules / 2);
  assert.deepEqual(JSON.stringify(buildCapabilityLineage(evolution, options)), JSON.stringify(L));
});
