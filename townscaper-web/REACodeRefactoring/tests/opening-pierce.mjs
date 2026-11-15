// piercefloor (802496920790777856, video only): the opening eats only its own storey; slab/cornice above stays continuous.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { archFloorBudget, openingPierce } = await import('../src/core/arch-floor-budget.js');
// REACode CFG contrast: storey 3.2, slab .42, rise 4.4 from ground -> raw cutter crosses the first slab, clipped does not
const b0 = archFloorBudget({ base: 3.2, floor: 0, storey: 3.2, slab: .42 });
const clip = openingPierce(b0, { storey: 3.2 }), raw = openingPierce({ ...b0, spring: 0 }, { storey: 3.2, raw: true, rawRise: 4.4 });
assert.equal(clip.slabsCut, 0); assert.ok(clip.corniceContinuous && clip.overSlab <= 0);
assert.equal(raw.slabsCut, 1); assert.ok(!raw.corniceContinuous && Math.abs(raw.overSlab - (4.4 - 2.78)) < 1e-9);
for (let i = 1; i <= 500; i++) {
  const storey = .2 + i / 500, floor = (i % 5) * storey, base = floor + (1 + i % 4) * storey, slab = storey * (.05 + (i % 9) / 20);
  const b = archFloorBudget({ base, floor, storey, slab }), p = openingPierce(b, { storey });
  assert.equal(p.slabsCut, 0); assert.ok(p.corniceContinuous);
  const r = openingPierce(b, { storey, raw: true, rawRise: base - floor + storey * .5 });
  assert.ok(r.slabsCut >= 1 && !r.corniceContinuous);
}
assert.throws(() => openingPierce(b0, { storey: 0 }));
// real World: every drawn arch soffit vertex stays under base-slab, the storey wall above is drawn in full
let arches = 0, rawCuts = 0;
for (const kind of ['quad', 'mixed']) for (const seed of [7, 11, 23]) for (const slab of [.05, .2]) {
  const w = F.world(kind, 'fusion', seed), before = F.voxels(w);
  const { r } = F.build(w, { archSlab: slab });
  assert.deepEqual(F.voxels(w), before);
  for (const b of r.archBudgets) {
    assert.equal(b.slabsCut, 0); assert.ok(b.corniceContinuous); assert.ok(b.crown <= b.base - slab + 1e-12);
    assert.ok(Math.abs(b.base - (b.level - 1) * F.L) < 1e-9, 'supported voxel base is the global level line');
    if (openingPierce(b, { storey: F.L, raw: true, rawRise: b.base - b.floor }).slabsCut) rawCuts++;
    arches++;
  }
}
assert.ok(arches >= 10 && rawCuts > 0);
console.log('PASS pierce budget clipped vs raw cutter (500 logic) and World arches', { arches, rawCuts });
