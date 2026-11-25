// 能力树：两库合并计算（真实源码扫描 + 真实 JEV 归线结果）与山形能力库的纯数据行为。
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { computeLineage } from '../tools/refactor/build-capability-lineage.mjs';
import { buildCapabilityTree, BRANCHES } from '../../townscaper-web/REACodeRefactoring/src/core/capability-tree.js';
import { describeMountainCapabilities, runPlan, matchAll, MOUNTAIN_CAPABILITIES } from '../src/system-workshop/mountain/capabilities.js';
import { verifyMountain } from '../src/system-workshop/mountain/verify.js';
const jev = JSON.parse(fs.readFileSync(new URL('../src/scene-authoring/catalog/capability-tree-jev.json', import.meta.url)));
const { manifest, lineage } = await computeLineage();
const tree = buildCapabilityTree(lineage, { alignment: manifest.alignment, executables: describeMountainCapabilities().map((c) => ({ ...c, tier: 'scene' })), jev });

test('每条能力线恰好挂在一个枝上，枝的合计等于各线之和', () => {
  const ids = tree.branches.flatMap((b) => b.lines); assert.equal(new Set(ids).size, ids.length); assert.equal(ids.length, tree.summary.lines);
  assert.ok(!tree.branches.some((b) => b.id === 'other'), '有能力线没有分枝：' + ids.filter((id) => !BRANCHES.some((b) => b.lines.includes(id))));
  for (const b of tree.branches) assert.equal(b.breadth, b.lines.reduce((s, id) => s + tree.nodes[id].breadth, 0));
});
test('双源对账：每个原版叶子状态与对齐数据一致', () => {
  const align = new Map(manifest.alignment.map((a) => [a.source, a]));
  for (const n of Object.values(tree.nodes)) { assert.equal(n.wild + n.partial + n.grafted, n.breadth);
    for (const leaf of n.leaves) { const a = align.get(leaf.source); assert.ok(a, leaf.source); if (leaf.state === 'wild') assert.equal(a.status, 'missing-target'); if (leaf.state === 'grafted') assert.equal(a.unmatchedExports.length, 0); } }
});
test('JEV 归线只采纳置信度 ≥ 0.85 的结果', () => {
  for (const n of Object.values(tree.nodes)) for (const x of [...n.leaves.map((l) => ['o:' + l.source, l.by]), ...n.modules.map((m) => ['m:' + m.path, m.by])]) if (x[1] === 'jev') { const a = jev.assignments[x[0]]; assert.ok(a.confidence >= 0.85 && a.line === n.id); }
  assert.equal(tree.summary.jevPlaced, Object.values(jev.assignments).filter((a) => a.accepted && tree.nodes[a.line]).length);
});
test('嫁接队列按分排序，条目都是只在原版或接口没带全', () => {
  assert.ok(tree.grafts.length > 0); for (let i = 1; i < tree.grafts.length; i++) assert.ok(tree.grafts[i - 1].score >= tree.grafts[i].score);
  for (const g of tree.grafts) assert.ok(g.state === 'wild' || g.unmatched > 0);
});
test('解锁前沿：自己不能执行、前置都能执行', () => { for (const f of tree.frontier) { assert.equal(tree.nodes[f.id].executables.length, 0); for (const r of f.requires) assert.ok(tree.nodes[r].executables.length); } });
test('目标路径「圣城山形」：6 个能力都挂在存在的能力线上，声明调用的库模块真实存在', () => {
  const g = tree.goals.find((x) => x.id === 'mountain'); assert.equal(g.needs.length, 6);
  for (const n of g.needs) { assert.ok(tree.nodes[n.line], n.line); assert.ok(tree.nodes[n.line].executables.includes(n.id));
    for (const s of n.sources) assert.ok(fs.existsSync(new URL(`../../townscaper-web/${s.repo === 'original' ? 'REACode' : 'REACodeRefactoring'}/${s.path}`, import.meta.url)), s.path); }
  const src = fs.readFileSync(new URL('../src/system-workshop/mountain/capabilities.js', import.meta.url), 'utf8');
  for (const s of g.needs.flatMap((n) => n.sources).filter((x) => x.used)) assert.ok(src.includes(s.path), '声明调用但没有 import：' + s.path);
});

// 山形能力库：合成场地（方台阶岛 + 一座城 + 一条轨道）
const field = () => { const n = 81, h = [], cls = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const d = Math.hypot(i - 40, j - 40); h.push(d > 36 ? null : d > 33 ? -1 : Math.floor((36 - d) / 6) * 6 + 2); cls.push(Math.hypot(i - 50, j - 50) < 5 ? 1 : j === 30 && i > 10 && i < 70 ? 2 : 0); } return { n, step: 3, h, cls, railY: [] }; };
const all = MOUNTAIN_CAPABILITIES.map((c) => ({ id: c.meta.id }));
test('山形：六步管线把方台变成山，保护区 / 轨道 / 海岸一格不动', () => {
  const f = field(), site = { field: structuredClone(f) }; for (const m of matchAll(site)) assert.ok(m.count, m.id);
  const rep = runPlan(site, all); assert.deepEqual(rep.map((r) => r.status), ['applied', 'applied', 'applied', 'applied', 'applied', 'applied']);
  const v = verifyMountain(f, site.plan, { steps: rep }), c = Object.fromEntries(v.checks.map((x) => [x.id, x]));
  for (const id of ['protected', 'rail', 'shore', 'surface']) assert.equal(c[id].status, 'pass', c[id].detail);
  assert.ok(v.metrics.after.flat < 0.1 && v.metrics.before.flat > 0.5, '平顶应从过半降到很少'); assert.ok(v.metrics.after.mid > v.metrics.before.mid);
});
test('山形：同样输入结果确定；步骤乱序也按固定顺序执行', () => {
  const a = { field: field() }, b = { field: field() }; runPlan(a, all); runPlan(b, [...all].reverse()); assert.deepEqual(a.plan.h, b.plan.h); assert.deepEqual(a.plan.mat, b.plan.mat);
});
test('验证：改动保护区 / 淹掉海岸 / 山体压到轨旁都判失败', () => {
  const f = field(), site = { field: structuredClone(f) }, rep = runPlan(site, all), bad = (mut) => { const p = structuredClone(site.plan); mut(p); return Object.fromEntries(verifyMountain(f, p, { steps: rep }).checks.map((x) => [x.id, x.status])); };
  const q = 50 * 81 + 50, rail = 30 * 81 + 40, coast = f.h.findIndex((v, i) => v > 0.3 && f.cls[i] === 0);
  assert.equal(bad((p) => { p.h[q] += 2; }).protected, 'fail'); assert.equal(bad((p) => { p.h[rail] += 1; }).rail, 'fail'); assert.equal(bad((p) => { p.h[rail + 81 * 4] += 60; }).rail, 'fail'); assert.equal(bad((p) => { p.h[coast] = 0; }).shore, 'fail');
  assert.equal(verifyMountain(f, { h: [1, 2] }).status, 'fail');
});
