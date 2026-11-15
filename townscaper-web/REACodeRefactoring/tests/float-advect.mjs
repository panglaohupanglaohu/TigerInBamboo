// 1664565063552847873: CPU-emulated storage precision for semi-Lagrangian advection (not a GPU test).
import assert from 'node:assert/strict';
import { roundHalf, STORAGE, advect, advectionQuality, storageRoundTrip, seedBlob } from '../src/core/float-advect.js';
// binary16 rounding against known values
const cases = [[1, 1], [1 / 3, 0.333251953125], [65504, 65504], [65520, Infinity], [2049, 2048], [2051, 2052], [-0.5, -0.5], [2 ** -24, 2 ** -24], [2 ** -26, 0], [1.00048828125, 1]];
for (const [v, h] of cases) assert.equal(roundHalf(v), h, `half(${v})`);
// Signed / HDR values survive float formats but not UNORM8 (velocity fields are signed)
const vals = [1.25, -0.5, 0.125, 0.75];
assert(storageRoundTrip(vals, 'f16').every((r) => r.exact)); assert(storageRoundTrip(vals, 'f32').every((r) => r.exact));
assert.deepEqual(storageRoundTrip(vals, 'u8').map((r) => r.stored), [1, 0, 0.12549019607843137, 0.7490196078431373]);
const q = advectionQuality({ size: 32, steps: 60 }), row = (s, f) => q.rows.find((r) => r.storage === s && r.filter === f);
assert(Math.abs(q.referenceMassDrift) < 0.01, 'reference nearly conserves mass');
assert(row('f32', 'linear').maxAbsError < 1e-5, 'f32 ≈ f64');
assert(row('f16', 'linear').meanAbsError > row('f32', 'linear').meanAbsError * 1000, 'f16 error measurable');
assert(Math.abs(row('f16', 'linear').massDrift) > Math.abs(row('f32', 'linear').massDrift) * 1.5, 'f16 drifts more mass');
assert(row('u8', 'linear').meanAbsMotion < q.referenceMotion * 0.3, 'UNORM8 stalls slow flow (sub-quantum updates round away)');
assert(row('f32', 'nearest').meanAbsMotion < q.referenceMotion * 1e-3, 'without float-linear filtering a sub-texel flow freezes');
assert(q.rows.every((r) => r.nonFinite === 0));
// deterministic, input preserved, finite-difference sanity: zero steps = identity in f64
const f = seedBlob(16), copy = f.slice(); assert.deepEqual(advect(f, { size: 16, steps: 0, storage: 'f64' }), f); assert.deepEqual(f, copy);
assert.deepEqual(advect(f, { size: 16, steps: 5 }), advect(f, { size: 16, steps: 5 }));
assert.throws(() => advect(f, { size: 16, storage: 'f8' }), RangeError); assert.throws(() => advect(f, { size: 17 }), RangeError);
assert.match(q.scope, /not a GPU/);
console.log('PASS half/float/unorm storage emulation + advection quality', JSON.stringify(q.rows.map((r) => ({ ...r, massDrift: +r.massDrift.toFixed(5), meanAbsError: +r.meanAbsError.toExponential(2), meanAbsMotion: +r.meanAbsMotion.toExponential(2) }))));
