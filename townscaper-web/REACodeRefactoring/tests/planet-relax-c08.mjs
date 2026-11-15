// r56 C08 · 1769641473895432220 relax-pass playback: frames are real spring iterations of the shared solver.
import assert from 'node:assert/strict';
import { buildSphere, buildPlanet, cornerPositions, mushroomRatio } from '../src/sphere/planet.js';
import { relaxFrames, cellOutlineSegments, RELAX_STEPS } from '../src/sphere/planet-relax-c08.js';
const p = buildPlanet(buildSphere({ n: 300, spacing: 8, relax: 8 }), { R: 3, L: .4 });
const fr = relaxFrames(p, { finalSolver: 'shape' });
assert.equal(fr.length, RELAX_STEPS.length + 1);
// frame 0 == radial; last spring frame == default cornerPositions (iters 40)
const off = cornerPositions(p, { relax: false }), def = cornerPositions(p);
for (let k = 0; k < p.corners.length; k += 7) for (let l = 0; l <= Math.max(...p.H); l++) {
  assert.deepEqual(fr[0].at(k, l), off(k, l));
  assert.deepEqual(fr[RELAX_STEPS.length - 1].at(k, l), def(k, l));
}
const ratios = fr.map((f) => f.ratio);
assert.ok(ratios[0] > 1.3, 'radial should mushroom');
assert.ok(ratios[RELAX_STEPS.length - 1] < ratios[0] - .2, 'spring relax contracts');
// contraction is progressive (cells visibly shrink across frames)
let mono = 0; for (let i = 1; i < RELAX_STEPS.length; i++) if (ratios[i] <= ratios[i - 1] + 1e-9) mono++;
assert.ok(mono >= RELAX_STEPS.length - 2, 'mostly monotone contraction ' + ratios.map((r) => r.toFixed(3)));
assert.equal(fr.at(-1).solver, 'shape');
const o0 = cellOutlineSegments(p, fr[0].at), o1 = cellOutlineSegments(p, fr.at(-1).at);
assert.ok(o0.position.every(Number.isFinite) && o0.position.length === o0.color.length);
assert.ok(o1.counts.red < o0.counts.red, 'fewer mushroomed cells after relax');
assert.throws(() => relaxFrames(p, { steps: [0, 3, 2] }));
assert.throws(() => relaxFrames(p, { steps: [] }));
console.log({ ratios: ratios.map((r) => +r.toFixed(3)), before: o0.counts, after: o1.counts });
console.log('PASS planet-relax-c08');
