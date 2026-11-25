import test from 'node:test'; import assert from 'node:assert/strict';
import { breed, defaultGenome, mutate, mix, rng32, genomeKey, evaluate, describeGenome } from '../src/system-workshop/mountain/evolve.js';
import { MOUNTAIN_CAPABILITIES } from '../src/system-workshop/mountain/capabilities.js';
// 合成场地：方台阶岛 + 一座城 + 一条轨道（与 capability-tree.test 同形）
const field = () => { const n = 81, h = [], cls = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const d = Math.hypot(i - 40, j - 40); h.push(d > 36 ? null : d > 33 ? -1 : Math.floor((36 - d) / 6) * 6 + 2); cls.push(Math.hypot(i - 50, j - 50) < 5 ? 1 : j === 30 && i > 10 && i < 70 ? 2 : 0); } return { n, step: 3, h, cls, railY: [] }; };

test('变异与交叉：每个基因都落在能力声明的范围和步长上', () => {
  const r = rng32(3); let g = defaultGenome();
  for (let i = 0; i < 200; i++) { g = i % 5 ? mutate(g, r, 0.6) : mix([g, defaultGenome()], r);
    for (const c of MOUNTAIN_CAPABILITIES) for (const [k, p] of Object.entries(c.meta.params || {})) { const v = g[c.meta.id][k]; assert.ok(v >= p.min && v <= p.max, `${c.meta.id}.${k}=${v}`); assert.ok(v === p.default || Math.abs(v / (p.step || 0.01) - Math.round(v / (p.step || 0.01))) < 1e-6, `${c.meta.id}.${k}=${v} 既不是默认值也不在步长上`); } }
});
test('第一代：基线排第一、没有重复、同种子可复现、换种子不同', () => {
  const a = [...breed(field(), { count: 8, seed: 5 })], b = [...breed(field(), { count: 8, seed: 5 })], c = [...breed(field(), { count: 8, seed: 6 })];
  assert.equal(a.length, 8); assert.equal(a[0].origin, 'baseline'); assert.equal(genomeKey(a[0].genome), genomeKey(defaultGenome()));
  assert.equal(new Set(a.map((x) => genomeKey(x.genome))).size, 8);
  assert.deepEqual(a.map((x) => [genomeKey(x.genome), x.score]), b.map((x) => [genomeKey(x.genome), x.score]));
  assert.notDeepEqual(a.map((x) => genomeKey(x.genome)), c.map((x) => genomeKey(x.genome)));
  for (const x of a) { assert.ok(Array.isArray(x.plan.h) && x.plan.h.length === 81 * 81); assert.ok(x.score === -1 || x.score > 0); assert.equal(x.score === -1, x.hard.length > 0 || !x.metrics); }
});
test('精英保留：留种的亲本原样进下一代，所以每代最好成绩不会倒退', () => {
  const f = field(); let best = -Infinity, parents = [];
  for (let gen = 1; gen <= 3; gen++) {
    const pop = [...breed(f, { parents, count: 8, generation: gen, seed: 11 })], ok = pop.filter((x) => x.score >= 0).sort((p, q) => q.score - p.score);
    assert.ok(ok.length, '这一代至少有一个通过硬检查');
    if (gen > 1) { assert.deepEqual(pop.slice(0, parents.length).map((x) => x.origin), parents.map(() => 'parent')); assert.ok(ok[0].score >= best, `第 ${gen} 代 ${ok[0].score} < 上一代 ${best}`); }
    best = ok[0].score; parents = ok.slice(0, 2).map((x) => x.genome);
  }
});
test('默认参数在合成场地上通过硬检查；describeGenome 只列出变了的基因', () => {
  const ok = evaluate(field(), defaultGenome()); assert.ok(ok.score > 0, JSON.stringify(ok.hard)); assert.deepEqual(ok.hard, []);
  assert.equal(describeGenome(defaultGenome()).length, 0);
  const g = defaultGenome(); g['mountain.massif'].peak = 40; assert.deepEqual(describeGenome(g).map((d) => [d.k, d.from, d.to]), [['peak', 22, 40]]);
});
