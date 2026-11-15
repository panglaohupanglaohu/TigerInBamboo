// 第 94 轮 · 837027901853810688 天光柱的**末端淡出**口径（纯逻辑，不 import three）。
// 原片逐帧量（掩膜 r>200 & g>210 & b<210 & r−b>45，x∈[240,320]、y<152 的柱身像素）：
//   f0358 3966 / f0359 3939 / f0360 3925 / f0361 3920（100%）
//   f0362 3701（93%）/ f0363 1662（42%）/ f0364 117（3%）/ f0365 归零
// → 是「一帧一跳」的阶梯，不是线性；本仓旧实现末端连着三帧 0.75/0.5/0.25。
import assert from 'node:assert/strict';
// battle-c01.js 顶部 import three → 走 G5 夹具的 resolve 钩子（本仓没有 node_modules/three，只有 vendor/three.module.js）
import './fixtures/g5-battle.mjs';
const { SKY_BEAM, SKY_BEAM_STEPS, beamFade, beamFadeStepped } = await import('../src/badnorth/battle-c01.js');
const out = [];
const t = (n, f) => { f(); out.push(n); };

t('① 阶梯表 = 五档，单调不增，起止有界', () => {
  assert.equal(SKY_BEAM_STEPS.length, 5);
  assert.deepEqual(SKY_BEAM_STEPS[0], [0, 1]);
  for (let i = 1; i < SKY_BEAM_STEPS.length; i++) {
    assert.ok(SKY_BEAM_STEPS[i][0] > SKY_BEAM_STEPS[i - 1][0], '时间必须递增');
    assert.ok(SKY_BEAM_STEPS[i][1] <= SKY_BEAM_STEPS[i - 1][1], 'α 只能降，不能回亮');
  }
  assert.ok(SKY_BEAM_STEPS.at(-1)[0] < SKY_BEAM.life, '表尾必须早于 life（最后一帧已经在 0.03，不是满亮到死不消失）');
});

t('② 原片五帧逐帧对得上（0.0304s/帧）', () => {
  const f = 1 / 32.885;
  const got = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => beamFadeStepped(i * f));
  // f0358..f0365 → 1,1,1,1,0.93,0.42,0.03,0
  assert.deepEqual(got, [1, 1, 1, 1, 0.93, 0.42, 0.03, 0]);
});

t('③ 与实测逐帧 α 比：阶梯档误差 ≈0，线性档最大偏差 ≥0.2', () => {
  const f = 1 / 32.885;
  const measured = [1, 1, 1, 1, 0.93, 0.42, 0.03, 0];
  let stepErr = 0, linErr = 0;
  measured.forEach((m, i) => {
    stepErr = Math.max(stepErr, Math.abs(beamFadeStepped(i * f) - m));
    linErr = Math.max(linErr, Math.abs(beamFade(i * f, SKY_BEAM.life) - m));
  });
  assert.ok(stepErr <= 0.01, '阶梯档应逐帧贴合：err=' + stepErr.toFixed(4));
  assert.ok(linErr >= 0.2, '线性档本来就贴不上原片：err=' + linErr.toFixed(4));
});

t('④ 边界：age<0 当 0；表尾之后归 0（不许留一条 3% 的柱子不消失）', () => {
  assert.equal(beamFadeStepped(-1), 1);
  assert.equal(beamFadeStepped(0.19), 0.03, '0.1824–0.2128 之间是最后那帧 3%');
  assert.equal(beamFadeStepped(SKY_BEAM_STEPS.at(-1)[0]), 0);
  assert.equal(beamFadeStepped(SKY_BEAM.life), 0);
  assert.equal(beamFadeStepped(99), 0);
});

console.log('sky-beam-fade ALL PASS × ' + out.length + '\n' + out.join('\n'));
