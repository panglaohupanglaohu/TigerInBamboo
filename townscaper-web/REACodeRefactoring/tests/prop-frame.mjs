// propframe (1205416648397721601): "place as many props as it can without overlap ... no longer skewed on skewed tiles".
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { placeProps, propOverlap, frameDeviationDeg } = await import('../src/core/opening-footprint.js');
const segD = (p, a, b) => { const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez, t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / L2)); return Math.hypot(p.x - a.x - ex * t, p.z - a.z - ez * t); };
// skewed quads like REACode tileCorners: std frames stay rectangular, local frames shear by the skew angle
let skewChecked = 0;
for (let i = 0; i < 40; i++) {
  const s = (i / 39 - .5) * .47, quad = [{ x: 0, z: 0 }, { x: 1, z: .02 * i % .05 }, { x: 1 + s, z: .88 }, { x: s, z: .88 }];
  const std = placeProps(quad, { seed: i, tries: 300, size: [.04, .09] }), loc = placeProps(quad, { seed: i, tries: 300, size: [.04, .09], frame: 'local' });
  assert.ok(std.props.length >= 8, 'greedy fills the cell'); assert.ok(std.frameDevMax < 1e-9);
  for (let a = 0; a < std.props.length; a++) for (let b = a + 1; b < std.props.length; b++) assert.ok(!propOverlap(std.props[a].poly, std.props[b].poly));
  for (const p of std.props) for (const q of p.poly) assert.ok(Math.min(...quad.map((a, k) => segD(q, a, quad[(k + 1) % 4]))) >= .02 - 1e-12);
  if (Math.abs(s) > .1) { assert.ok(loc.frameDevMax > 5, 'local sheared frames are skewed'); skewChecked++; }
  // saturation: after a 3000-try greedy pass, an independent 3000-try pass finds little room left
  const full = placeProps(quad, { seed: i, tries: 3000, size: [.04, .09] }), again = placeProps(quad, { seed: 1000 + i, tries: 3000, size: [.04, .09], obstacles: full.props });
  assert.ok(full.props.length >= std.props.length && again.props.length <= Math.ceil(full.props.length * .2), `near-saturated (${again.props.length} more after ${full.props.length})`);
}
assert.ok(skewChecked > 10); assert.ok(frameDeviationDeg([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1.3, z: 1 }, { x: .3, z: 1 }]) > 15);
assert.throws(() => placeProps([{ x: 0, z: 0 }], {}));
// World yards (quad + mixed): no prop overlaps another prop or a tree crown, all inside the cell, World unchanged
let props = 0, cellsUsed = 0;
for (const kind of ['quad', 'mixed']) for (const [scene, seed] of [['town', 7], ['town', 11], ['town', 23], ['fusion', 7]]) {
  const w = F.world(kind, scene, seed), before = F.voxels(w), off = F.build(w), on = F.build(w, { yardProps: true });
  assert.deepEqual(F.voxels(w), before); assert.equal(F.build(w).verts, off.verts);
  assert.equal(on.r.yards, off.r.yards);
  for (const y of on.r.yardProps) {
    const c = w.cells[y.cell];
    assert.ok(!on.r.pathCells.has(y.cell), 'paths stay clear'); assert.ok(y.frameDevMax < 1e-9);
    for (let a = 0; a < y.props.length; a++) { for (let b = a + 1; b < y.props.length; b++) assert.ok(!propOverlap(y.props[a].poly, y.props[b].poly)); for (const o of y.obstacles) assert.ok(!propOverlap(y.props[a].poly, o.poly)); for (const q of y.props[a].poly) assert.ok(Math.min(...c.pts.map((p, k) => segD(q, p, c.pts[(k + 1) % c.n]))) >= .02 - 1e-12); }
    props += y.count; cellsUsed += y.count > 0;
  }
  assert.ok(on.verts >= off.verts);
}
assert.ok(props > 50 && cellsUsed > 10);
console.log('PASS greedy rigid-frame props: 40 skewed quads (std 0 deg vs local sheared) + World yards', { props, cellsUsed });
