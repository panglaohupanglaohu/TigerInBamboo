// 第 56 批 C11：1712088611934371876 色带菜单 OkHsl —— src/core/okhsl.js（Ottosson 参考实现移植）
import assert from 'node:assert/strict';
import { okhslToSrgb, srgbToOkhsl, findCusp, computeMaxSaturation, mixOkhsl, toe, toeInv } from '../src/core/okhsl.js';
import { srgbToOklab } from '../src/core/oklab.js';
// ① 参考值：Ottosson 色板上纯红 = okhsl(29.23°, 100%, 56.8%)、纯蓝 l≈36.7%、灰 s=0
const red = srgbToOkhsl(1, 0, 0); assert.ok(Math.abs(red[0] * 360 - 29.23) < 0.1 && Math.abs(red[1] - 1) < 2e-3 && Math.abs(red[2] - 0.568) < 2e-3, '纯红 ' + red);
const blue = srgbToOkhsl(0, 0, 1); assert.ok(Math.abs(blue[2] - 0.3666) < 2e-3 && Math.abs(blue[1] - 1) < 2e-3, '纯蓝 ' + blue);
const gray = srgbToOkhsl(.5, .5, .5); assert.ok(gray[1] < 1e-6, '灰色饱和度 0');
assert.ok(Math.abs(gray[2] - toe(srgbToOklab(.5, .5, .5)[0])) < 1e-9 && Math.abs(toeInv(toe(.37)) - .37) < 1e-12, 'toe / toeInv 互逆');
// ② 往返：20000 个随机 sRGB → OkHsl → sRGB
let worst = 0, seed = 7; const rnd = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
for (let i = 0; i < 20000; i++) { const c = [rnd(), rnd(), rnd()], b = okhslToSrgb(...srgbToOkhsl(...c)); worst = Math.max(worst, ...b.map((v, k) => Math.abs(v - c[k]))); }
assert.ok(worst < 3e-3, '往返误差 ' + worst);
// ③ s=1 落在色域边界（某通道≈0 或≈1）；cusp 合法
let edge = 0; for (let i = 0; i < 2000; i++) { const r = okhslToSrgb(rnd(), 1, .2 + .6 * rnd()); edge = Math.max(edge, Math.min(Math.min(...r), 1 - Math.max(...r))); }
assert.ok(edge < 6e-3, 's=1 到边界 ' + edge);
for (let i = 0; i < 64; i++) { const h = i / 64, a = Math.cos(2 * Math.PI * h), b = Math.sin(2 * Math.PI * h), S = computeMaxSaturation(a, b), cusp = findCusp(a, b); assert.ok(S > 0 && cusp.L > 0 && cusp.L < 1 && cusp.C > 0, 'cusp ' + h); }
// ④ 色相最短弧插值、灰端沿用另一端色相
const m = mixOkhsl([.95, .5, .5], [.05, .5, .5], .5)[0]; assert.ok(Math.min(m, 1 - m) < 1e-9, '跨 0 走短弧 ' + m);
assert.ok(Math.abs(mixOkhsl([0, 0, .5], [.3, .8, .5], .5)[0] - .3) < 1e-12);
assert.throws(() => okhslToSrgb(NaN, 0, 0), RangeError);
console.log('PASS okhsl：参考值（红 29.23°/1/0.568）、2 万色往返 ' + worst.toExponential(2) + '、s=1 贴边界 ' + edge.toExponential(2) + '、cusp、短弧插值');
