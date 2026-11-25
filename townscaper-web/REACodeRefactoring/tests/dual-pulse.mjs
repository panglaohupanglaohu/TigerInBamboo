/** 959752525867036672「pulsating vertex cells」：脉动曲线按片内量的，不留手调常数。
 * 片内量测：31 帧 / 21.53fps，同一机位同一裁剪框里白线像素数（亮度>200）逐帧。
 * 面积 ∝ 线性²，所以对序列做 a·cos(ωt)+b 最小二乘（扫周期），
 * 周期取残差最小的那个，峰谷比取 √((b+a)/(b−a))，再和 DUAL_PULSE 比 —— 不一致就红。
 */
import assert from'node:assert/strict';
import{DUAL_PULSE,dualPulse,vertexDual}from'../src/core/vertex-dual.js';

const FPS = 21.52777777777778;
// artifacts/coverage/959752525867036672/frame-0000..0030.jpg 的亮度>200 像素数（裁剪框 150,200,330,330）
const AREA = [3035, 3068, 3069, 3011, 2939, 2845, 2789, 2668, 2581, 2490, 2367, 2217, 2208, 2154, 2167, 2159,
  2195, 2210, 2287, 2384, 2530, 2630, 2688, 2800, 2938, 3038, 3107, 3153, 3136, 3139, 3120];
assert.equal(AREA.length, 31);
assert.deepEqual(AREA.slice(0, 3), [3035, 3068, 3069], 'measurement series changed — re-measure before trusting the constants');

/** 拟合 a·cos+b；返回 {period, amp, mid, rms}。纯手写 3×3 正规方程，不引依赖。 */
function fit(series, fps, from = 0.6, to = 2.5, step = 0.002) {
  const t = series.map((_, i) => i / fps);
  let best = null;
  for (let P = from; P <= to + 1e-12; P += step) {
    const w = (2 * Math.PI) / P;
    // 基向量 [cos, sin, 1] 的正规方程
    let cc = 0, ss = 0, cs = 0, c1 = 0, s1 = 0, cy = 0, sy = 0, y1 = 0;
    for (let i = 0; i < series.length; i++) {
      const c = Math.cos(w * t[i]), s = Math.sin(w * t[i]), y = series[i];
      cc += c * c; ss += s * s; cs += c * s; c1 += c; s1 += s; cy += c * y; sy += s * y; y1 += y;
    }
    const n = series.length;
    // 解 [[cc,cs,c1],[cs,ss,s1],[c1,s1,n]]·[A,B,C] = [cy,sy,y1]（克拉默）
    const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[2][1] * m[1][2])
      - m[0][1] * (m[1][0] * m[2][2] - m[2][0] * m[1][2])
      + m[0][2] * (m[1][0] * m[2][1] - m[2][0] * m[1][1]);
    const M = [[cc, cs, c1], [cs, ss, s1], [c1, s1, n]];
    const d = det3(M);
    if (Math.abs(d) < 1e-9) continue;
    const withCol = (k, v) => M.map((row, i) => row.map((x, j) => (j === k ? v[i] : x)));
    const A = det3(withCol(0, [cy, sy, y1])) / d, B = det3(withCol(1, [cy, sy, y1])) / d, C = det3(withCol(2, [cy, sy, y1])) / d;
    let err = 0;
    for (let i = 0; i < n; i++) err += (A * Math.cos(w * t[i]) + B * Math.sin(w * t[i]) + C - series[i]) ** 2;
    if (!best || err < best.err) best = { err, period: P, amp: Math.hypot(A, B), mid: C, phase: Math.atan2(B, A) };
  }
  assert(best, 'fit failed');
  return { ...best, rms: Math.sqrt(best.err / series.length) };
}

const f = fit(AREA, FPS);
const ratio = Math.sqrt((f.mid + f.amp) / (f.mid - f.amp));   // 线性峰谷比（面积 ∝ 线性²）
assert(f.rms < 60, 'sinusoid fit is poor, rms=' + f.rms.toFixed(1));   // 序列本身有 ±2% 噪声

// 1) 常数必须是片内拟合出来的（容差：峰谷比 0.03、周期 0.08s）
assert(Math.abs(DUAL_PULSE.max / DUAL_PULSE.min - ratio) < 0.03,
  `pulse ratio ${(DUAL_PULSE.max / DUAL_PULSE.min).toFixed(3)} vs measured ${ratio.toFixed(3)}`);
assert(Math.abs(DUAL_PULSE.period - f.period) < 0.08,
  `pulse period ${DUAL_PULSE.period}s vs measured ${f.period.toFixed(3)}s`);
assert.equal(DUAL_PULSE.max, 1, 'peak must map to the true dual size (uPulse=1)');
// 拟合相位说明片内 f0000 已经在峰上，故 t=0 = 峰
assert(Math.abs(Math.cos(f.phase)) > 0.9, 'clip does not start at the peak, re-anchor the curve');

// 2) 曲线形状：t=0 峰、半周期谷、整周期回峰；端点跨度 = 量测比
const P = DUAL_PULSE.period;
assert(Math.abs(dualPulse(0) - DUAL_PULSE.max) < 1e-9, 't=0 must be the peak');
assert(Math.abs(dualPulse(P / 2) - DUAL_PULSE.min) < 1e-9, 'half period must be the trough');
assert(Math.abs(dualPulse(P) - DUAL_PULSE.max) < 1e-12, 'must be periodic');
assert(Math.abs(dualPulse(0) / dualPulse(P / 2) - ratio) < 0.03, 'endpoints must span the measured ratio');

// 3) 单调段：前半个周期只降、后半个周期只升
let prev = dualPulse(0), down = 0;
for (let k = 1; k <= 200; k++) { const v = dualPulse((P * k) / 400); if (v <= prev + 1e-12) down++; prev = v; }
assert.equal(down, 200, 'first half must be monotone decreasing');
prev = dualPulse(P / 2);
let up = 0;
for (let k = 1; k <= 200; k++) { const v = dualPulse(P / 2 + (P * k) / 400); if (v >= prev - 1e-12) up++; prev = v; }
assert.equal(up, 200, 'second half must be monotone increasing');
assert.throws(() => dualPulse(NaN), RangeError);

// 4) 缩放真的作用在顶点格上：同一对偶格峰/谷两档的面积比 = 量测比
const pts = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: .5, z: .9 }, { x: 1.6, z: .9 }];
const d = vertexDual(pts, [[0, 1, 2], [1, 3, 2]]);
const cell = d.cells.find((c) => c.pts.length >= 3);
const areaOf = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p.x * q.z - q.x * p.z; }, 0) / 2);
const scaled = (s) => cell.pts.map((p) => ({ x: cell.source.x + (p.x - cell.source.x) * s, z: cell.source.z + (p.z - cell.source.z) * s }));
const aMax = areaOf(scaled(DUAL_PULSE.max)), aMin = areaOf(scaled(DUAL_PULSE.min));
assert(Math.abs(Math.sqrt(aMax / aMin) - ratio) < 0.03, 'dual area ratio must match the measured pulse ratio');

console.log({ period: +f.period.toFixed(3), rms: +f.rms.toFixed(1), ratio: +ratio.toFixed(3), DUAL_PULSE, dualPulse0: dualPulse(0), dualPulseHalf: dualPulse(P / 2) },
  'PASS pulsating vertex cells calibrated to the clip');
