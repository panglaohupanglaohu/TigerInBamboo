// surface-bounce-referee.mjs — 1580835075629133825 残差核销：裁判 2.5D 形因子 gather / 暴力参考接口对拍。
// 裁判=只读 ../REACode/src/bouncegi.js（makeCanyon + directLight + bounce + bruteForce + audit）。
// 本侧=src/light/surface-bounce.js：model:'legacy' 应与裁判逐位同口径（同采样圈、同 F=cosI·cosJ·A/(r²+pitch²/4)、
// 同可见性行进、同余弦重要性采样）；model:'split'（第 55 批校准）在裁判自己的峡谷场上应更接近暴力参考。
// 结论（2026-11-24 实测）：E0 与 bruteForce 逐位一致（maxDiff=0）；bounce gather 最大差 1.2e-7（裁判写回
// 多一次 Float32 舍入，1 ulp）；split 相关 0.50→0.83、形状误差 90%→43%。
import assert from 'node:assert/strict';
const REF = await import('../../REACode/src/bouncegi.js');
const S = await import('../src/light/surface-bounce.js');

// 裁判场 {res,h,albedo,pitch} → 本侧场 {nx,nz,pitch,minX,minZ,h,albedo}。
// 裁判 worldAt 以格心为原点：(x+0.5-res/2)·pitch ⇔ minX=-res·pitch/2，两边世界坐标逐位相同。
const toShared = (field) => ({
  nx: field.res, nz: field.res, pitch: field.pitch,
  minX: -field.res * field.pitch / 2, minZ: -field.res * field.pitch / 2,
  h: field.h, albedo: field.albedo,
});
const maxDiff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };
const corr = (x, y) => { let ca = 0, cb = 0; const m = x.length; for (let q = 0; q < m; q++) { ca += x[q]; cb += y[q]; } ca /= m; cb /= m; let cab = 0, caa = 0, cbb = 0; for (let q = 0; q < m; q++) { const u = x[q] - ca, v = y[q] - cb; cab += u * v; caa += u * u; cbb += v * v; } return cab / Math.sqrt(caa * cbb || 1); };

const field = REF.makeCanyon({ res: 40 });
const f = toShared(field);

// ① 直接光逐位一致（同一套法线/太阳行进/天空仰角）
const E0r = REF.directLight(field, {});
const E0s = S.directLight(f, {});
assert.ok(maxDiff(E0r, E0s) < 1e-9, 'directLight should match referee bitwise ' + maxDiff(E0r, E0s));

// ② 形因子 gather：本侧 legacy 档与裁判 bounce 同式同序，只多一次写回舍入
const g1r = REF.bounce(field, E0r, { maxRad: 10, spacing: 1.2, bounces: 1 });
const g1s = S.bounce(f, E0r, { maxRad: 10, spacing: 1.2, bounces: 1, model: 'legacy' });
assert.ok(maxDiff(g1r.added, g1s.added) < 1e-6, 'legacy gather ≈ referee form-factor gather, d=' + maxDiff(g1r.added, g1s.added));
// 裁判第 2 跳起 src===E 别名（就地 Gauss–Seidel），本侧默认 Jacobi —— 同一批 src 下
// 逐 pass 对拍逐位一致，bounces:2 需 inPlace 复现裁判语义（默认档差实测 0.13）。
const g2r = REF.bounce(field, E0r, { maxRad: 10, spacing: 1.2, bounces: 2 });
const g2s = S.bounce(f, E0r, { maxRad: 10, spacing: 1.2, bounces: 2, model: 'legacy', inPlace: true });
assert.ok(maxDiff(g2r.added, g2s.added) < 1e-6, 'two-bounce in-place parity ' + maxDiff(g2r.added, g2s.added));
const g2Jacobi = S.bounce(f, E0r, { maxRad: 10, spacing: 1.2, bounces: 2, model: 'legacy' });
assert.ok(maxDiff(g2r.added, g2Jacobi.added) > 0.01, 'Jacobi default should measurably differ from referee in-place second pass');

// ③ 暴力参考接口：同一 LCG 种子、同一余弦重要性采样与行进 → 逐位一致
const bfr = REF.bruteForce(field, E0r, { samples: 96 });
const bfs = S.bruteForce(f, E0r, { samples: 96 });
assert.ok(maxDiff(bfr, bfs) < 1e-9, 'bruteForce reference identical ' + maxDiff(bfr, bfs));
assert.ok(maxDiff(bfr.hitRate, bfs.hitRate) < 1e-9, 'hitRate identical');

// ④ audit 表头对拍：裁判 audit() vs 本侧 audit(f,{model:'legacy'})
const ar = REF.audit({ res: 40, samples: 64 });
const as = S.audit(f, { samples: 64, maxRad: 10, model: 'legacy' });
assert.ok(Math.abs(ar.shadowGain1 - as.shadowGain1) < 0.01, `shadowGain1 ${ar.shadowGain1} vs ${as.shadowGain1}`);
assert.ok(Math.abs(ar.warmthOneBounce - as.warmthOneBounce) < 0.01, `warmth ${ar.warmthOneBounce} vs ${as.warmthOneBounce}`);
assert.ok(Math.abs(ar.bestFitScale - as.bestFitScale) < 0.01, `bestFitScale ${ar.bestFitScale} vs ${as.bestFitScale}`);
// 如实口径：裁判 errShape 用 a·scale，本侧用 a/scale（方向相反的同一量），此处不比绝对值。

// ⑤ 校准增益在裁判自己的峡谷场上同样成立：split 相关与形状误差都应显著优于 legacy
const asSplit = S.audit(f, { samples: 64, maxRad: 10, model: 'split' });
assert.ok(asSplit.correlation > as.correlation + 0.2, `referee canyon: split r ${as.correlation.toFixed(3)} -> ${asSplit.correlation.toFixed(3)}`);
assert.ok(asSplit.vsBruteForceShapeErrPct < as.vsBruteForceShapeErrPct - 20, `shapeErr ${as.vsBruteForceShapeErrPct.toFixed(1)} -> ${asSplit.vsBruteForceShapeErrPct.toFixed(1)}`);
assert.ok(asSplit.bestFitScale > 0.75 && asSplit.bestFitScale < 1.3, 'split bestFitScale ~1 ' + asSplit.bestFitScale);
assert.ok(corr(asSplit.b1.added, asSplit.bf) > corr(as.b1.added, as.bf) + 0.2, 'raw corr improves');

console.log('PASS referee parity: E0/bruteForce 逐位一致, gather ≤1ulp; referee canyon legacy r', as.correlation.toFixed(3), '-> split r', asSplit.correlation.toFixed(3),
  'shapeErr%', as.vsBruteForceShapeErrPct.toFixed(1), '->', asSplit.vsBruteForceShapeErrPct.toFixed(1), 'gain1', ar.shadowGain1);
