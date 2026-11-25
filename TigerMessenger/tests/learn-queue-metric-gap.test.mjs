// R40 创新 5：验证指标离阈值的差距接进补学队列得分（tools/refactor/metric-gap.mjs，export-learn-queue.mjs 调用）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { metricGap, lineBoosts, applyMetricGaps, METRIC_GAP_FORMULA, METRIC_GAP_CAP } from '../tools/refactor/metric-gap.mjs';

const q = () => [
  { id: 'a', line: 'navigation', score: 47, rank: 1, why: ['优先级 高'], alsoIn: [] },
  { id: 'b', line: 'terrain', score: 45, rank: 2, why: [], alsoIn: [] },
  { id: 'c', line: 'grid', score: 44, rank: 3, why: [], alsoIn: ['terrain'] },
  { id: 'd', line: 'fire', score: 20, rank: 4, why: [], alsoIn: [] },
];

test('公式：越过阈值 2 + 10·g（封顶 6）；临界一成内 0–1；离得远 0；方向区分上限 / 下限', () => {
  // 圣城竖崖占比 14%，阈值 12%（上限）：g = 1/6 → 2 + 1.667 = 3.67
  assert.deepEqual(metricGap({ value: 0.14, threshold: 0.12, direction: 'max' }), { gap: 0.1667, score: 3.67, state: 'over' });
  assert.equal(metricGap({ value: 0.5, threshold: 0.12, direction: 'max' }).score, METRIC_GAP_CAP);
  assert.equal(metricGap({ value: 0.115, threshold: 0.12, direction: 'max' }).state, 'near');
  assert.ok(Math.abs(metricGap({ value: 0.115, threshold: 0.12, direction: 'max' }).score - 10 * (-0.005 / 0.12 + 0.1)) < 0.01);
  assert.deepEqual(metricGap({ value: 0.05, threshold: 0.12, direction: 'max' }), { gap: -0.5833, score: 0, state: 'ok' });
  // 下限：覆盖率 0.9 < 0.98 → g = 0.0816 → 2.82
  assert.equal(metricGap({ value: 0.9, threshold: 0.98, direction: 'min' }).score, 2.82);
  assert.equal(metricGap({ value: 1, threshold: 0.98, direction: 'min' }).score, 0.8);
  assert.equal(metricGap({ value: 'x', threshold: 1, direction: 'max' }), null);
  assert.equal(metricGap({ value: 1, threshold: 1, direction: 'up' }), null);
  assert.match(METRIC_GAP_FORMULA, /2 \+ 10·g/);
});

test('按线取最高分（不累加），只收大于 0 的', () => {
  const b = lineBoosts([
    { line: 'terrain', name: '竖崖占比', value: 0.14, threshold: 0.12, direction: 'max' },
    { line: 'terrain', name: '峰高', value: 90, threshold: 100, direction: 'min' },
    { line: 'fire', name: '火光残留', value: 0.2, threshold: 0.35, direction: 'max' },
    { name: '没有线', value: 9, threshold: 1, direction: 'max' },
  ]);
  assert.deepEqual([...b.keys()], ['terrain']);
  assert.equal(b.get('terrain').score, 3.67); assert.equal(b.get('terrain').metrics.length, 2);
});

test('加分后重排：越线的线升到前面，alsoIn 交叉线也加分，原名次保留在 rankBefore', () => {
  const metrics = [{ line: 'terrain', name: '竖崖占比', value: 0.2, threshold: 0.12, direction: 'max', scene: 'citadel' }];
  const out = applyMetricGaps(q(), metrics);
  assert.deepEqual(out.map((r) => r.id), ['b', 'c', 'a', 'd']);
  assert.equal(out[0].score, 51); assert.equal(out[0].rankBefore, 2); assert.equal(out[0].rank, 1);
  assert.equal(out[1].metricGap.line, 'terrain'); assert.match(out[0].why.at(-1), /指标离阈值：竖崖占比/);
  assert.equal(out[2].metricGap, undefined);
  assert.equal(q()[1].score, 45, '不改入参');
});

test('没有指标 / 指标都没越线：队列原样（顺序、得分、名次）', () => {
  assert.deepEqual(applyMetricGaps(q(), []), q());
  assert.deepEqual(applyMetricGaps(q(), [{ line: 'terrain', name: 'x', value: 0, threshold: 1, direction: 'max' }]), q());
});

test('export-learn-queue.mjs 接上了：读 verification-metrics.json / --metrics，写 metricFormula 与 inputs.metrics', () => {
  const src = fs.readFileSync(new URL('../tools/refactor/export-learn-queue.mjs', import.meta.url), 'utf8');
  assert.match(src, /applyMetricGaps\(lineage\.queue, metrics\)/); assert.match(src, /verification-metrics\.json/); assert.match(src, /metricFormula: METRIC_GAP_FORMULA/);
  assert.match(fs.readFileSync(new URL('../tools/scene-authoring/test_workshops.py', import.meta.url), 'utf8'), /'learn-queue-metric-gap'/);
});
