// r159 · 1714613599035863191 田纹第三档（uFields>=3「宽软带」）：
//   ① 模式 1 的条纹体逐字节没动（r56 承诺）；模式 2（拼贴）也没动；
//   ② 三档分派严格：>2.5 带 / >1.5 拼贴 / 其余条纹；
//   ③ 带的周期 == 条纹周期（0.2 世界单位）→ 格向不变，只改占空比与边沿；
//   ④ 占空比 ≈ 1:1（条纹是细线：亮区 ~44%），边沿软（10%–90% 过渡约占 1/3 周期）；
//   ⑤ 对比度比条纹大（幅度 0.28 vs 0.18），但仍是有界的 albedo 调制（0.8–1.2 之间）。
import assert from 'node:assert/strict';
import { FIELD_GLSL, fieldBandTone, fieldStripeTone } from '../src/terrain/field-pattern.js';

// ① 旧条纹体原样保留
const OLD = `  float phase = p.x * 5.0 + .22 * sin(p.y * 3.0);
  float fw = max(fwidth(phase), .0001);
  float d = abs(fract(phase) - .5);
  float stripe = 1.0 - smoothstep(.22 - fw, .22 + fw, d);
  // Fade unresolved stripes toward their mean instead of high-frequency flicker.
  stripe = mix(stripe, .44, smoothstep(.35, .9, fw));
  return mix(1.0, .90 + .18 * stripe, clamp(p.z, 0.0, 1.0));`;
assert.ok(FIELD_GLSL.includes('float fieldToneStripes(vec3 p) {\n' + OLD), '模式 1 条纹体被改动');
assert.ok(/float fieldTonePlots\(vec3 p\)/.test(FIELD_GLSL));

// ② 分派
assert.ok(/uFields > 2\.5 \? fieldToneBands\(p\)/.test(FIELD_GLSL));
assert.equal((FIELD_GLSL.match(/float fieldTone\(/g) || []).length, 1);
assert.equal((FIELD_GLSL.match(/\{/g) || []).length, (FIELD_GLSL.match(/\}/g) || []).length);

// ③④⑤ 数值读数：沿 u 轴（p.x = 世界 u）扫两个周期
const N = 4000, span = 0.4;          // 0.2 单位周期 → 两个周期
const band = [], stripe = [];
for (let i = 0; i < N; i++) {
  const x = i / N * span;
  band.push(fieldBandTone(x, 0, 1));
  stripe.push(fieldStripeTone(x, 0, 1));
}
const st = (a) => {
  const s = [...a].sort((p, q) => p - q);
  const mean = a.reduce((p, q) => p + q, 0) / a.length;
  const sd = Math.sqrt(a.reduce((p, q) => p + (q - mean) ** 2, 0) / a.length);
  return { min: s[0], max: s[s.length - 1], mean, sd, p10: s[(N * .1) | 0], p90: s[(N * .9) | 0] };
};
const B = st(band), S = st(stripe);
// 占空比：亮带（> 中位）样本占比
const mid = (B.min + B.max) / 2;
const dutyBand = band.filter((v) => v > mid).length / N;
const dutyStripe = stripe.filter((v) => v > (S.min + S.max) / 2).length / N;
assert.ok(Math.abs(dutyBand - .5) < .04, '带的占空比不是 1:1：' + dutyBand.toFixed(3));
assert.ok(dutyStripe < .5 && dutyStripe > .3, '条纹占空比越界：' + dutyStripe.toFixed(3));
assert.ok(B.sd > S.sd * 1.3, '带的对比度没有明显大于细线：' + [B.sd.toFixed(4), S.sd.toFixed(4)]);
assert.ok(B.min > .78 && B.max < 1.2, '带的 albedo 调制越界：' + [B.min.toFixed(3), B.max.toFixed(3)]);

// 边沿软度：从 10% 到 90% 的过渡宽度占周期比
function edgeWidth(sig) {
  const lo = Math.min(...sig), hi = Math.max(...sig);
  const t10 = lo + .1 * (hi - lo), t90 = lo + .9 * (hi - lo);
  // 找第一次跨越（上升沿）
  let i10 = -1, i90 = -1;
  for (let i = 1; i < sig.length; i++) {
    if (i10 < 0 && sig[i - 1] <= t10 && sig[i] > t10) i10 = i;
    if (i10 >= 0 && i90 < 0 && sig[i] > t90) { i90 = i; break; }
  }
  return i10 >= 0 && i90 >= i10 ? Math.max(1, i90 - i10) / N : null;   // N 样本 = 两个周期
}
const eB = edgeWidth(band), eS = edgeWidth(stripe);
assert.ok(eB !== null && eB > .03, '带没有软边沿：' + eB);
assert.ok(eB > eS * 10, '带的边沿不比细线软：' + [eB?.toFixed(3), eS?.toFixed(3)]);

// 周期：零点/峰间隔 == 0.2（在两个周期内应有 2 个亮峰）
const peaks = [];
for (let i = 1; i < N - 1; i++) if (band[i] > band[i - 1] && band[i] >= band[i + 1] && band[i] > mid) peaks.push(i / N * span);
const period = peaks.length >= 2 ? (peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1) : null;
assert.ok(period !== null && Math.abs(period - .2) < .01, '带周期不是 0.2 世界单位：' + period);

// mask = 0（非顶面）时三档都必须返回 1.0（不污染崖壁/河道）
for (const t of [fieldBandTone, fieldStripeTone]) assert.equal(+t(0.123, 0.4, 0).toFixed(9), 1);

console.log('PASS field-pattern-bands', {
  duty: [+dutyBand.toFixed(3), +dutyStripe.toFixed(3)],
  sd: [+B.sd.toFixed(4), +S.sd.toFixed(4)],
  edge: [+eB.toFixed(3), +eS.toFixed(3)],
  period: +period.toFixed(4),
  range: [+B.min.toFixed(3), +B.max.toFixed(3)],
});
