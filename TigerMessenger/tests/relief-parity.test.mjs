// R41–R45：原版当裁判（创新 1）成为制度——地貌枝六条线各有一条「原版 vs 重构」对照，差异必须全部登记。
//   ① 通用对照器 parity.js 的行为（容差 / 路径模式 / 登记外差异判红 / 截断不让结果变好）；
//   ② 六条对照在同一种子上实跑：登记外差异 = 0（有就红：要么修重构版，要么查明原因登记进 catalog/parity/<能力ID>.json）；
//   ③ 登记表格式；登记过 verdict 的，必须等于现在实算的 verdict（record-relief-evidence.mjs 写入后才有）。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/relief-parity.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { diffValues, classifyDiffs, tolFor, patternRe, runParityCase, registryShape, fingerprint } from '../src/system-workshop/terrain/parity.js';
import { PARITY_CASES, caseById, riverIsland } from '../src/system-workshop/terrain/parity-cases.js';
import * as OT from '../../townscaper-web/REACodeRefactoring/src/terrain/overhang-terrain.js';

const readJson = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const reg = (id) => readJson(`../src/scene-authoring/catalog/parity/${id}.json`);
const IDS = ['relief.soft', 'relief.cliff', 'relief.valley', 'relief.overhang', 'relief.ledge', 'relief.passes'];

test('对照器：容差、NaN、缺字段 / 多字段 / 长度 / 类型都算差异', () => {
  assert.equal(diffValues({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }).total, 0);
  assert.equal(diffValues({ a: NaN }, { a: NaN }).total, 0, 'NaN 与 NaN 相等');
  assert.equal(diffValues({ a: 1 }, { a: 1.00001 }, { tol: 1e-3 }).total, 0);
  const d = diffValues({ a: 1, b: [1, 2], c: 'x', e: 1 }, { a: 2, b: [1], c: 3, f: 1 }).diffs.map((x) => [x.path, x.kind]);
  assert.deepEqual(d, [['a', 'value'], ['b.length', 'length'], ['c', 'type'], ['e', 'missing'], ['f', 'extra']]);
  assert.equal(tolFor({ default: 0, 'x.*': 0.5, 'x.y*': 0.1 }, 'x.yz'), 0.1, '取最具体的模式');
  assert.ok(patternRe('seed*.measure.stackInWater').test('seed7.measure.stackInWater'));
  assert.ok(!patternRe('a.b').test('aXb'), '点是字面量');
  assert.equal(fingerprint([1, 2, 3]), fingerprint(new Float32Array([1, 2, 3])));
});
test('归类：登记外差异 → unregistered；全部登记 → diff-registered；无差异 → equivalent；kind 不符不算登记', () => {
  const diffs = [{ path: 'm.x', kind: 'extra' }, { path: 'lv[3]', kind: 'value' }];
  assert.equal(classifyDiffs([], []).verdict, 'equivalent');
  assert.equal(classifyDiffs(diffs, [{ path: 'm.x', kind: 'extra', reason: 'r' }, { path: 'lv*', reason: 'r' }]).verdict, 'diff-registered');
  const c = classifyDiffs(diffs, [{ path: 'm.x', kind: 'value', reason: 'r' }]);
  assert.equal(c.verdict, 'unregistered'); assert.equal(c.unregistered.length, 2);
});
test('截断不让结果变好：一万处差异里最后一处没登记，也判 unregistered', async () => {
  const a = Array.from({ length: 10000 }, (_, i) => i), b = a.map((v, i) => (i === 9999 ? -1 : v + 1));
  const r = await runParityCase({ id: 'x', run: async () => ({ original: { lv: a, z: 1 }, refactored: { lv: b, z: 2 } }) }, { diffs: [{ path: 'lv*', reason: 'r' }] });
  assert.equal(r.verdict, 'unregistered'); assert.equal(r.unregisteredCount, 1); assert.equal(r.total, 10001); assert.ok(r.diffs.length <= 40);
});
test('六条线都有对照 case 与登记表，登记表格式对、指向的原版 / 重构文件都存在', () => {
  assert.deepEqual(PARITY_CASES.map((c) => c.id).sort(), [...IDS].sort());
  for (const id of IDS) {
    const r = reg(id), c = caseById(id);
    assert.deepEqual(registryShape(r), [], id);
    assert.equal(r.capability, id); assert.equal(r.line, 'terrain'); assert.equal(r.original, c.original, id + ' 登记的原版文件要和 case 一致');
    for (const f of [r.original, ...(r.alsoOriginal || []), ...r.refactored]) assert.ok(fs.existsSync(new URL('../../' + f, import.meta.url)), f);
  }
});
for (const id of IDS) {
  test(`对照 ${id}：原版 vs 重构，同一种子 / 同一份输入，登记外差异 = 0`, async () => {
    const r = await runParityCase(caseById(id), reg(id));
    assert.notEqual(r.verdict, 'unregistered', `${id}：${r.unregisteredCount} 条登记外差异，例：${JSON.stringify(r.unregistered.slice(0, 3))}`);
    const recorded = reg(id).verdict;
    if (recorded != null) assert.equal(recorded, r.verdict, '登记表里的 verdict 和现在实算的不一样：重跑 record-relief-evidence.mjs 或查原因');
  });
}
test('悬垂：确实有悬垂（朝下面 > 0、悬出来的地板 > 0、海蚀洞走得进去），新增字段只多不少', () => {
  const T = OT.buildTerrain(7), m = OT.measure(T), mesh = OT.buildMesh(T);
  assert.ok(mesh.soffitAboveWater > 0 && m.overhangAboveWater > 0, '高度场画不出的岩檐要真的存在');
  assert.ok(m.caveDepth > 0 && m.airReach > 0); assert.equal(typeof m.stackInWater, 'boolean');
});
test('河谷对照岛：最高格是孤峰（原版 DFS 走不回源头），峰高 > 3 层', () => {
  const n = 40, lv = riverIsland(n, 20261123, OT.hash);
  let top = 0; for (let k = 1; k < n * n; k++) if (lv[k] > lv[top]) top = k;
  const i = top % n, j = (top - i) / n;
  assert.ok(lv[top] > 3);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(lv[top] >= lv[(j + dj) * n + i + di] + 2);
});
test('对齐别名：六个原版文件都登记了新落点（嫁接队列按导出名对账，不再算「只在原版」）', () => {
  const al = readJson('../tools/refactor/reacode-target-aliases.json');
  const want = { 'src/overhangterrain.js': 'src/terrain/overhang-terrain.js', 'src/islandpasses.js': 'src/terrain/island-passes.js', 'src/terracecliff.js': 'src/terrain/terrace-field.js', 'src/terraceladder.js': 'src/terrain/terrace-ladder.js', 'engine/rivers.js': 'src/terrain/river-valley.js', 'src/depfill.js': 'src/terrain/depfill-grid.js' };
  for (const [src, t] of Object.entries(want)) { assert.ok(al[src]?.targets?.includes(t), src); assert.ok(al[src].reason.length > 20); }
});
