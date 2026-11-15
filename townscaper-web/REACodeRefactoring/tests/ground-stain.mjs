// 第 92 轮 · 地面染色（837027901853810688）纯逻辑验收：src/badnorth/ground-stain.js
// 曲线与系数全部来自帧量测，断言就是把实测点钉死，防止下一轮顺手改数字。
import assert from 'node:assert/strict';
import { GROUND_STAIN, stainProgress, stainTint, stainHex } from '../src/badnorth/ground-stain.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── 折线点必须直返（零容差）：r89 的坑是浮点插值让端点断言永远红
for (const [t, v] of GROUND_STAIN.ramp) assert.equal(stainProgress(t), v, `表点 ${t}s → ${v}`);

// ── 边界：负数/非数一律 0，超过末点饱和在 1（片子只到 13.4s，不外推）
assert.equal(stainProgress(-5), 0);
assert.equal(stainProgress(0), 0);
assert.equal(stainProgress(NaN), 0);
assert.equal(stainProgress(0.01) > 0 && stainProgress(0.01) < 0.25, true);   // 起爆前的空隙仍在爬坡
assert.equal(stainProgress(10.86), 1);
assert.equal(stainProgress(60), 1);

// ── 起爆当帧一步跳到 25%（片子里 f0082→f0083 是台阶，不是渐变）
assert.equal(stainProgress(0.05), 0.25);

// ── 单调不减 + 值域
let prev = -1;
for (let t = 0; t <= 12; t += 0.05) { const v = stainProgress(t); assert.ok(v >= prev - 1e-12, `单调 @${t.toFixed(2)}`); assert.ok(v >= 0 && v <= 1); prev = v; }

// ── 4–7s 平台：这一段只有烟在动，地面色不动（f0120–f0230 实测一格没挪）
for (const t of [4.2, 5.5, 6.5]) assert.ok(near(stainProgress(t), 0.44), `平台 0.44 @${t}`);

// ── 乘性系数：p=0 恒等（关掉就是没染），p=1 是实测的「R 不动 / G −6.6% / B −5.3%」
assert.deepEqual(stainTint(0), [1, 1, 1]);
const t1 = stainTint(1);
assert.ok(near(t1[0], 1.000) && near(t1[1], 0.934) && near(t1[2], 0.947, 1e-9), 'p=1 实测系数');
assert.equal(stainHex(0), '#ffffff');
assert.equal(stainHex(1), '#ffeef1');   // 255 / 238 / 241 = 实测系数的 8bit 版
// 爪子：任何 p 都不许把红通道往下压（否则就成了「加绿」的偏色，与片子相反）
for (const p of [0.2, 0.44, 0.75, 1]) assert.ok(stainTint(p)[0] >= stainTint(p)[1] && stainTint(p)[1] <= 1);

// ── tint 表与 stainTint 必须一致（防止有人只改一边）
assert.ok(near(stainTint(1)[1], 1 + GROUND_STAIN.tint.g) && near(stainTint(1)[2], 1 + GROUND_STAIN.tint.b));

console.log('ground-stain: ALL PASS');
console.log('  ramp 点数', GROUND_STAIN.ramp.length, '· p(0.05)=0.25 · p(6.6)=0.44 · p(10.86)=1');
console.log('  tint(1) =', stainTint(1).map((v) => v.toFixed(4)).join(', '), '=', stainHex(1));
