// r56 C08 · 1768627849529893109 smoothed per-level coastlines on the shared planet sampler
import assert from 'node:assert/strict';
import { buildSphere, buildPlanet, cornerPositions, planetMesh, relaxConflictReport } from '../src/sphere/planet.js';
import { smoothCoastSampler, levelBoundaries, boundaryTurning, coastOutline } from '../src/sphere/planet-smooth-c08.js';
const p = buildPlanet(buildSphere({ n: 400, spacing: 10, relax: 10 }), { R: 3, L: .3 });
const at = cornerPositions(p, { solver: 'shape' }), s = smoothCoastSampler(p, at);
const B = levelBoundaries(p);
assert.ok(B.length >= 3 && B.every((b) => b.edges.length > 0));
const t0 = boundaryTurning(p, at), t1 = boundaryTurning(p, s);
assert.ok(t1 < t0 * .8, `turning ${t0} -> ${t1}`);
// non-boundary corners are untouched; radius preserved everywhere
const onB = new Set(B.flatMap((b) => [...b.nbr.keys()].map((k) => k + '@' + b.level)));
for (let k = 0; k < p.corners.length; k += 3) for (let l = 0; l <= Math.max(...p.H); l++) {
  const v = s(k, l); assert.ok(Math.abs(Math.hypot(...v) - (p.R + l * p.L)) < 1e-9);
  if (!onB.has(k + '@' + l)) assert.deepEqual(v, at(k, l));
}
const m = planetMesh(p, s); assert.ok(m.position.length > 0 && m.position.every(Number.isFinite));
const f0 = relaxConflictReport(p, at).folded, f1 = relaxConflictReport(p, s).folded;
assert.ok(f1 <= f0 + Math.ceil(.01 * p.cells.length), `folds ${f0} -> ${f1}`);
assert.equal(coastOutline(p, s).length, B.reduce((n, b) => n + b.edges.length, 0) * 6);
assert.throws(() => smoothCoastSampler(p, at, { iters: -1 }));
console.log({ levels: B.length, turning: [t0.toFixed(1), t1.toFixed(1)], folds: [f0, f1] });
console.log('PASS planet-smooth-c08');
