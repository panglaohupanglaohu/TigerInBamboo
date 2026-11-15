// r53 G4: REACode smear.js — analytic tangential orbit smear (∝ radius), single frame, outer band loses sharpness.
import assert from 'node:assert/strict';
import { smearLengthPx, orbitVelocity, smearImage, sharpnessBand, ORBIT_SMEAR_GLSL, cameraAngularSpeed } from '../src/core/camera-motion.js';
const w = 96, h = 96, data = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = ((x >> 3) + (y >> 3)) & 1 ? 230 : 25; data.set([v, v, v, 255], (y * w + x) * 4); }
const img = { data, w, h };
assert.deepEqual([...smearImage(img, 0).data], [...data], 'still camera: identity (no ghosting)');
const s0 = sharpnessBand(img), s1 = sharpnessBand(smearImage(img, 1.2)), s2 = sharpnessBand(smearImage(img, 2.4));
assert.ok(s1.p95 < s0.p95 && s2.p95 < s1.p95, `outer band softens with ω: ${s0.p95.toFixed(1)} → ${s1.p95.toFixed(1)} → ${s2.p95.toFixed(1)}`);
const inner = (im) => { let e = 0; for (let y = 44; y < 52; y++) for (let x = 44; x < 52; x++) e += Math.abs(im.data[(y * w + x) * 4] - data[(y * w + x) * 4]); return e / 64; };
const outer = (im) => { let e = 0; for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) e += Math.abs(im.data[(y * w + x) * 4] - data[(y * w + x) * 4]); return e / 64; };
const sm = smearImage(img, 2.4);
assert.ok(inner(sm) < outer(sm) * .5, 'centre stays crisper than the rim (v ∝ r)');
const [vx, vy] = orbitVelocity(80, 48, 2, 1 / 60, 48, 48);
assert.ok(Math.abs(vx) < 1e-12 && vy > 0, 'tangential, not radial');
assert.ok(Math.abs(Math.hypot(vx, vy) - smearLengthPx(2, 32)) < 1e-12);
assert.ok(ORBIT_SMEAR_GLSL.includes('vec4 orbitSmear'));
// ω from the existing wrapped camera-delta helper drives the same model
const om = cameraAngularSpeed(Math.PI - .01, 0, -Math.PI + .01, 0, 1 / 60);
assert.ok(Math.abs(om - 1.2) < 1e-9, 'seam-safe ω feeds the smear');
console.log('PASS orbit smear', { p95: [s0.p95, s1.p95, s2.p95].map((v) => +v.toFixed(1)) });
