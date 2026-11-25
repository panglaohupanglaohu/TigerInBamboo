// R40 夜间重建第一版（创新 8）：tools/nightly/nightly-lib.mjs 的纯逻辑 + run-nightly.mjs / Guide 的静态接线。
// 真跑一遍是 Kiro 的事：cd TigerMessenger && $NODE tools/nightly/run-nightly.mjs --no-jev
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planSteps, unitTestList, parseTap, diffSnapshots, renderMorningReport, latestPointer, metricsFromVerify, syntheticStage, DRIFT_TESTS } from '../tools/nightly/nightly-lib.mjs';

const root = new URL('../../', import.meta.url), read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

test('步骤编排：顺序与工作目录按 Guide §5.1 / §5.2；JEV 在 ⑤ 之前；目标路径在 ⑤ 与 ⑥ 之间', () => {
  const s = planSteps({ node: '/n', python: 'py', unitFiles: ['TigerMessenger/tests/a.test.mjs'] });
  assert.deepEqual(s.map((x) => x.id), ['drift', 'r1', 'r2', 'r3', 'r4', 'jev', 'r5', 'goals', 'r6', 'r7', 'unit']);
  const by = Object.fromEntries(s.map((x) => [x.id, x]));
  assert.equal(by.drift.cwd, 'root'); assert.deepEqual(by.drift.args.slice(2), DRIFT_TESTS);
  assert.equal(by.r1.cwd, 'root'); assert.equal(by.r1.cmd, 'py'); assert.equal(by.r1.env.NODE_PATH_BIN, '/n');
  for (const id of ['r2', 'r3', 'r4', 'r5', 'r6', 'r7']) { assert.equal(by[id].cwd, 'tm', id); assert.equal(by[id].cmd, '/n'); }
  assert.match(by.r2.args.join(' '), /build-system-catalog\.mjs \.\.\/townscaper-web\/REACode \.\.\/townscaper-web\/REACodeRefactoring/);
  assert.match(by.r6.args[0], /export-learn-queue/); assert.match(by.r7.args[0], /build-capability-maturity/);
  assert.equal(by.jev.cwd, 'root'); assert.ok(by.jev.optional); assert.match(by.jev.args[0], /jev-classify-tree\.py$/);
  assert.ok(by.goals.inProcess); assert.ok(by.unit.args.includes('--test-reporter=tap'));
});

test('开关：--no-jev 记为跳过；--skip-recompute 只留漂移 / 目标路径 / 测试', () => {
  assert.equal(planSteps({ noJev: true }).find((x) => x.id === 'jev').skipped, '--no-jev');
  assert.deepEqual(planSteps({ noJev: true, skipRecompute: true, unitFiles: ['x'] }).map((x) => x.id), ['drift', 'jev', 'goals', 'unit']);
  assert.ok(!planSteps({ skipDrift: true, skipTests: true, unitFiles: ['x'] }).some((x) => x.id === 'drift' || x.id === 'unit'));
});

test('单元清单从 test_workshops.py 读，含本轮新增的测试', () => {
  const list = unitTestList(read('TigerMessenger/tools/scene-authoring/test_workshops.py'));
  assert.ok(list.length > 30);
  for (const n of ['fx-fire', 'fx-hallway', 'fx-sediment-projectiles', 'frontier-unlock', 'fx-camera-flight', 'nightly', 'learn-queue-metric-gap']) assert.ok(list.includes(`TigerMessenger/tests/${n}.test.mjs`), n);
});

test('TAP 解析：汇总行与 not ok 行', () => {
  const t = parseTap('TAP version 13\n# Subtest: a\nok 1 - a\nnot ok 2 - 坏了的用例\n  ---\n# tests 5\n# suites 0\n# pass 4\n# fail 1\n# skipped 0\n');
  assert.deepEqual(t, { tests: 5, pass: 4, fail: 1, skipped: 0, failures: ['坏了的用例'] });
  assert.equal(parseTap('').fail, null);
});

const snap = (o = {}) => ({ date: '2026-11-24', generatedAt: 't', steps: [{ id: 'r5', label: '⑤', status: 'pass' }], tests: { drift: { tests: 4, pass: 4, fail: 0, failures: [] }, unit: { tests: 10, pass: 10, fail: 0, failures: [] } },
  tree: { lines: 27, fruit: 27, frontier: [] }, capabilities: [{ id: 'fx.fire', line: 'fire', level: 5 }], lines: { fire: { name: '火焰', level: 5 } },
  goals: [{ id: 'fx', name: 'fx', status: 'run', verify: { status: 'pass', summary: 'ok' } }],
  metrics: [{ key: 'fx:fire-curve', goal: 'fx', name: '0.39s 火光残留', value: 0.226, threshold: 0.35, direction: 'max', scene: '合成舞台', gapScore: 0 }], learnQueue: { head: [] }, e2e: [], ...o });

test('快照对比：新增能力、线升级、指标变好 / 变差按方向判断、测试红绿翻转', () => {
  const prev = snap({ date: '2026-11-23', capabilities: [], lines: { fire: { name: '火焰', level: 0 } }, tree: { lines: 27, fruit: 23, frontier: ['fire', 'hallway', 'sediment', 'projectiles'] },
    metrics: [{ key: 'fx:fire-curve', value: 0.3 }, { key: 'fx:cover', value: 0.99 }], tests: { drift: { failures: [] }, unit: { fail: 1, failures: ['老红'] } } });
  const cur = snap({ metrics: [...snap().metrics, { key: 'fx:cover', goal: 'fx', name: '覆盖率', value: 0.95, threshold: 0.98, direction: 'min', scene: '合成舞台' }], tests: { drift: { failures: [] }, unit: { fail: 1, failures: ['新红'] } } });
  const d = diffSnapshots(prev, cur);
  assert.equal(d.first, false); assert.deepEqual(d.newCapabilities.map((c) => c.id), ['fx.fire']);
  assert.deepEqual(d.lineChanges, [{ line: 'fire', name: '火焰', from: 0, to: 5, up: true }]);
  const fire = d.metricDeltas.find((x) => x.key === 'fx:fire-curve'), cov = d.metricDeltas.find((x) => x.key === 'fx:cover');
  assert.equal(fire.better, true, '上限型指标变小 = 变好'); assert.equal(cov.better, false, '下限型指标变小 = 变差');
  assert.equal(d.metricDeltas[0].key, 'fx:cover', '变差的排前面');
  assert.deepEqual(d.testFlips.unit, { red: ['新红'], green: ['老红'] });
  assert.deepEqual(d.fruit, { from: 23, to: 27 });
  const first = diffSnapshots(null, cur); assert.ok(first.first); assert.deepEqual(first.newCapabilities, []);
});

test('晨报一页：四块（新增能力 / 哪条线升级 / 场景候选变好变差 / 测试红绿）都在；latest.json 摘要字段齐', () => {
  const prev = snap({ date: '2026-11-23', capabilities: [], lines: { fire: { name: '火焰', level: 0 } } });
  const cur = snap(), d = diffSnapshots(prev, cur), md = renderMorningReport(cur, d);
  for (const h of ['# 夜间重建晨报 · 2026-11-24', '## 新增能力', '## 哪条线升级', '## 场景候选变好 / 变差', '## 测试红绿', '## 步骤']) assert.ok(md.includes(h), h);
  assert.match(md, /`fx\.fire`/); assert.match(md, /火焰：L0 → L5/); assert.match(md, /NOT_RUN|浏览器端到端/);
  const L = latestPointer(cur, d, 'artifacts/nightly/2026-11-24');
  assert.equal(L.report, 'artifacts/nightly/2026-11-24/morning-report.md'); assert.equal(L.headline.newCapabilities, 1); assert.equal(L.headline.lineUp, 1);
  assert.equal(L.tests.unit.fail, 0); assert.deepEqual(L.tree.frontier, []);
});

test('指标收集：检查项上的 metric 带线与阈值，verify.metrics 的数只做对比', () => {
  const rows = metricsFromVerify('fx', { checks: [{ id: 'fire-curve', status: 'pass', blame: ['fx.fire'], metric: { name: 'n', value: 0.2, threshold: 0.35, direction: 'max' } }, { id: 'x', status: 'pass', blame: [] }], metrics: { after: { flat: 0.05 } } }, (id) => (id === 'fx.fire' ? 'fire' : null));
  assert.deepEqual(rows.map((r) => [r.key, r.line || null, !!r.untracked]), [['fx:fire-curve', 'fire', false], ['fx:metrics.after.flat', null, true]]);
  assert.ok(syntheticStage().grid.length > 100);
});

test('run-nightly.mjs 与 Guide §5 接线', () => {
  const src = read('TigerMessenger/tools/nightly/run-nightly.mjs');
  assert.match(src, /latest\.json/); assert.match(src, /morning-report\.md/); assert.match(src, /verification-metrics\.json/); assert.match(src, /spawnSync\(/);
  assert.match(src, /s\.cwd === 'root' \? ROOT : TM/);
  const guide = read('TigerMessenger/docs/CAPABILITY_PIPELINE_GUIDE.md'); assert.match(guide, /tools\/nightly\/run-nightly\.mjs/);
  assert.match(read('TigerMessenger/pipeline.html'), /nightly-report/);
});
