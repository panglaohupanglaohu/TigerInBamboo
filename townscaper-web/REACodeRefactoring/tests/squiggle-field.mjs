// r53 G4: REACode squigglefield.js — four-way folded capsule SDF, animated wobble, bucket acceleration
// equal to brute force near ink, CPU edge probe and ink share stable over phase.
import assert from 'node:assert/strict';
import { squiggleSdf, bucketSegments, squiggleSdfBucketed, probeSquiggleEdge } from '../src/core/ornament-field.js';
const segs = [];
for (let k = 0; k < 40; k++) { const a0 = k / 40 * 4.5, a1 = (k + 1) / 40 * 4.5, r = (a) => .05 + a * .045; segs.push({ x0: .3 + Math.cos(a0) * r(a0), y0: .25 + Math.sin(a0) * r(a0), x1: .3 + Math.cos(a1) * r(a1), y1: .25 + Math.sin(a1) * r(a1), r: .008 }); }
segs.push({ x0: .02, y0: .05, x1: .5, y1: .05, r: .01 });
const bk = bucketSegments(segs, { width: .6, height: .6, cell: .05 });
let bruteTests = 0, bucketTests = 0, maxErr = 0, nearInk = 0, ink = [0, 0];
for (let j = 0; j < 120; j++) for (let i = 0; i < 120; i++) {
  const x = -.55 + 1.1 * i / 119, y = -.55 + 1.1 * j / 119;
  for (const [ti, t] of [0, 1.7].entries()) {
    const a = squiggleSdf(segs, x, y, { t }), b = squiggleSdfBucketed(segs, bk, x, y, { t });
    bruteTests += a.tests; bucketTests += b.tests;
    if (Math.abs(a.d) < .02) { nearInk++; maxErr = Math.max(maxErr, Math.abs(a.d - b.d)); }
    if (a.d < 0) ink[ti]++;
  }
}
assert.ok(maxErr < 1e-12, 'bucketed == brute force near the ink ' + maxErr);
assert.ok(bucketTests < bruteTests / 5, `buckets test far fewer segments ${bucketTests} vs ${bruteTests}`);
assert.equal(squiggleSdf(segs, .2, -.1).d, squiggleSdf(segs, -.2, .1).d, 'four-way mirror');
assert.ok(Math.abs(ink[0] - ink[1]) / ink[0] < .1, 'phase moves the edge, not the amount of ink');
const still = probeSquiggleEdge({ amp: 0 }), wob = probeSquiggleEdge({ amp: .01, t: .4 }), wob2 = probeSquiggleEdge({ amp: .01, t: 1.3 });
assert.ok(still.rmsPx < .01 && Math.abs(still.arcRatio - 1) < 1e-6, 'no wobble → straight edge');
assert.ok(wob.rmsPx > 2 && wob.maxPx <= .01 * 760 + 1e-6 && wob.arcRatio > 1.01, 'wobble bounded by amp, edge becomes wavy');
assert.notDeepEqual(wob, wob2, 'phase animates');
console.log('PASS squiggle field', { nearInk, bucketShare: +(bucketTests / bruteTests).toFixed(3), rmsPx: +wob.rmsPx.toFixed(2), arc: +wob.arcRatio.toFixed(3) });
