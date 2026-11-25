// r53 G4: REACode propanim.js — springTrack/scaleAt/stagger + stable per-prop identity lifecycle.
import assert from 'node:assert/strict';
import { springValue, staggerAt, scaleAt, PropLifecycle, propScaleGLSL } from '../src/core/prop-anim.js';
// spring: ~10% overshoot, settles ≈ 0.3–0.5 s; disappear faster than appear
let peak = 0, settle = null;
for (let t = 0; t < 1.5; t += 1 / 240) { const v = springValue(t); peak = Math.max(peak, v); if (settle === null && t > .05 && Math.abs(v - 1) < .01 && Math.abs(springValue(t + .01) - v) < .002) settle = t; }
assert.ok(peak > 1.05 && peak < 1.2, 'overshoot ' + peak); assert.ok(settle > .25 && settle < .6, 'settle ' + settle);
const e = { delay: 0, hideAt: 1 };
assert.ok(scaleAt(e, 1.1) < .5 * scaleAt(e, 1), 'shrink is quick'); assert.ok(scaleAt(e, 1.4) < .02);
assert.equal(staggerAt(0, 5), 0); assert.ok(Math.abs(staggerAt(4, 5) - .2) < 1e-12);

const L = new PropLifecycle({ capacity: 16 });
const row = (n, x0 = 0) => Array.from({ length: n }, (_, i) => ({ key: 'door:' + (x0 + i), x: x0 + i, y: 1, z: 0 }));
L.sync(row(4), 0); L.update(0);
const slots = row(4).map((p) => L.slotOf(p.key));
assert.equal(new Set(slots).size, 4);
// stagger: left prop grows first
L.update(.1); const sc = (k) => L.records[L.slotOf(k) * 4 + 3];
assert.ok(sc('door:0') > sc('door:3'), 'left-to-right wave');
// rebuild re-emits the same props (World changed elsewhere): no restart, same slots
L.update(2); L.sync(row(4), 2); L.update(2.001);
assert.deepEqual(row(4).map((p) => L.slotOf(p.key)), slots, 'stable identity across rebuilds');
assert.ok(Math.abs(sc('door:0') - 1) < .01, 'no animation restart');
// remove door:3 → its slot keeps the old geometry and shrinks, then frees
L.sync(row(3), 3); L.update(3.012);   // 第 192 轮：片内消失只一帧 → 收缩中点在首个半帧内
assert.equal(L.slotOf('door:3'), slots[3]); assert.ok(sc('door:3') < 1 && sc('door:3') > 0, 'vanishing prop still drawn, shrinking');
L.update(3.05); assert.equal(sc('door:3'), 0, 'one-frame collapse, slot still held');
assert.ok(L.records[slots[3] * 4] === 3, 'root kept for the residual frames');
L.update(3.5); assert.equal(L.slotOf('door:3'), -1, 'slot released after shrink');
assert.equal(L.records[slots[3] * 4 + 3], 0);
// re-adding while vanishing regrows in the same slot
L.sync(row(2), 4); L.update(4.05); L.sync(row(3), 4.05); L.update(4.06);
assert.equal(L.slotOf('door:2'), slots[2]); assert.ok(sc('door:2') < 1, 'regrows');
assert.throws(() => L.sync([{ key: 'a', x: 0, y: 0, z: 0 }, { key: 'a', x: 0, y: 0, z: 0 }], 5));
const big = new PropLifecycle({ capacity: 2 }); assert.throws(() => big.sync(row(3), 0), /capacity/);
const c = PropLifecycle.uploadCost({ props: 400, vertsPerProp: 24 }); assert.ok(c.recordFloats * 10 < c.rebuildFloats);
assert.ok(propScaleGLSL.includes('propScaled'));
console.log('PASS prop lifecycle', { overshoot: +(peak - 1).toFixed(3), settle: +settle.toFixed(3), upload: c });
