// archvoid (806904557502464000 / 802496920790777856): wedge ring + keystone + measure + deformed-space error on real buildings.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { archVoussoirs, measureArch, archProfile, deformedArchError, archClearance } = await import('../src/core/arch-profile.js');
// 1) analytic ring: shared joints, no overlap, keystone at crown, semicircle wedges identical, flat arches uneven
for (const [ratio, count] of [[.5, 15], [.38, 15], [.28, 15], [.5, 9], [.33, 7]]) {
  const span = 2, ring = archVoussoirs(span, span * ratio, { thickness: .1, count }), m = measureArch(ring);
  assert.ok(m.jointGapMax < 1e-12); assert.equal(m.overlapPairs, 0); assert.equal(m.keystone, (count - 1) / 2);
  const k = ring.keystone; assert.ok(k.t0 < Math.PI / 2 && k.t1 > Math.PI / 2);
  { const top = Math.max(...ring.wedges.flatMap(w => w.quad.map(q => q.y))); assert.ok(top <= ring.crownOuter + 1e-12 && top > ring.rise * .9); }
  if (ratio === .5) assert.ok(m.aspectSpread < 1 + 1e-9); else assert.ok(m.aspectSpread > 1.05);
  assert.ok(Math.abs(m.clearCenter - span * ratio) < 1e-12 && m.clearQuarter < m.clearCenter);
  for (const w of ring.wedges) for (const q of w.quad) assert.ok(q.u >= -1e-12 - .1 / span && q.u <= 1 + .1 / span + 1e-12);
}
assert.equal(archVoussoirs(1, .5, { count: 8 }).keystone, null);
for (const bad of [[0, 1], [1, 1, { count: 2 }], [1, 1, { thickness: -1 }]]) assert.throws(() => archVoussoirs(...bad));
// 2) deformed-space chord error: affine skew keeps error within the profile bound scaled by the face/span ratio
const prof = archProfile(1, .4, { tolerance: .002 });
const flat = deformedArchError(prof, .4, (u, y) => [u, y, 0]);
assert.ok(flat <= prof.errorBound + 1e-12 && flat > 0);
assert.equal(archClearance(1, .4, .6), 0);
// 3) real World: town + fusion, quad + mixed, 3 seeds
let arches = 0, wedges = 0, keys = 0;
for (const kind of ['quad', 'mixed']) for (const scene of ['town', 'fusion']) for (const seed of [7, 11, 23]) {
  const w = F.world(kind, scene, seed), before = F.voxels(w);
  const off = F.build(w), on = F.build(w, { archVoussoirs: true });
  assert.deepEqual(F.voxels(w), before, 'build must not edit World');
  assert.equal(F.build(w).verts, off.verts, 'flag off restores geometry');
  assert.equal(on.r.archCount, off.r.archCount);
  for (const b of off.r.archBudgets) assert.ok(b.deformedError <= b.errorBound + 1e-12, 'world-space error within bound');
  const faces = new Set(on.r.archVoussoirLog.map(v => v.cell + ':' + v.face));
  assert.equal(on.r.archWedges, faces.size * 9);
  for (const v of on.r.archVoussoirLog) assert.ok(v.maxY <= v.base + 1e-9, 'ring stays under the supported slab');
  keys += on.r.archVoussoirLog.filter(v => v.keystone).length; arches += on.r.archCount; wedges += on.r.archWedges;
  assert.ok(on.verts > off.verts || on.r.archCount === 0);
}
assert.ok(arches >= 10 && wedges > 0 && keys * 9 === wedges);
console.log('PASS voussoir ring/keystone/measure/deformed error; World', { arches, wedges, keys });
