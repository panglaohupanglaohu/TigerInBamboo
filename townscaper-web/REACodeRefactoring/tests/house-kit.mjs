// housekit (781027725452648448 "This is so much fun"; REACode labelled it a house kit):
// chimneys seated on the drawn roof slope, level eaves, window rows on the global storey grid.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { roofHeightAt, seatChimney, verifyHouseKit } = await import('../src/core/house-kit.js');
// logic: a gable plane y = 1 + (0.5 - |z|) ; seat on the +z slope never floats
const tris = [[[-1, 1, 0], [1, 1, 0], [1, .5, .5]], [[-1, 1, 0], [1, .5, .5], [-1, .5, .5]]];
assert.equal(roofHeightAt(tris, 0, .25), .75); assert.equal(roofHeightAt(tris, 0, 2), null);
const seat = seatChimney(tris, [0, 1, 0], [0, .5, .5], { t: .5, half: .05 });
assert.ok(Math.abs(seat.centre - .75) < 1e-12 && Math.abs(seat.base - .7) < 1e-12 && Math.abs(seat.top - .8) < 1e-12);
assert.equal(seatChimney(tris, [0, 1, 0], [0, .5, .5], { t: .99, half: .2 }), null, 'footprint off the roof is rejected');
assert.throws(() => seatChimney(tris, [0, 1, 0], [0, .5, .5], { t: 1 }));
const roofHex = [F.hexOf(F.BUILD.roof), F.hexOf(F.BUILD.roofAlt)], glassHex = F.hexOf(F.BUILD.glass);
let total = 0;
for (const kind of ['quad', 'mixed']) for (const [scene, seed] of [['town', 7], ['town', 11], ['town', 23], ['fusion', 7]]) for (const extra of [{}, { hipRoofsJoined: true }]) {
  const w = F.world(kind, scene, seed), before = F.voxels(w);
  const off = F.build(w, extra), on = F.build(w, { houseKit: true, ...extra }, { capture: [...roofHex, glassHex] });
  assert.deepEqual(F.voxels(w), before); assert.equal(F.build(w, extra).verts, off.verts, 'flag off restores geometry');
  assert.equal(on.r.chimneys.length, off.r.chimneys.length, 'same chimney cells');
  const roof = on.tris.filter(t => roofHex.includes(t.hex)).map(t => t.p), glass = on.tris.filter(t => t.hex === glassHex).map(t => Math.min(...t.p.map(p => p[1])));
  const seated = on.r.chimneys.filter(c => c.seat);
  const v = verifyHouseKit({ chimneys: seated, roofTris: roof, eaves: on.r.roofStats.hipAudit, windowBottoms: glass, L: F.L });
  assert.equal(v.unseated, 0); assert.ok(v.chimneyFloat <= 1e-9, 'no chimney corner floats above the roof'); assert.ok(v.chimneyCentreErr < 1e-9);
  assert.ok(v.eaveSkew < 1e-12); assert.ok(v.windows > 100 && v.offGrid <= 2 * on.r.roofStats.gables, `storey windows snap to grid; only gable windows off (${v.offGrid}/${on.r.roofStats.gables})`);
  assert.ok(seated.length >= on.r.chimneys.length * .8, `most chimneys on slopes (${seated.length}/${on.r.chimneys.length})`);
  total += seated.length;
}
assert.ok(total > 40);
console.log('PASS house kit: seated chimneys / level eaves / storey window rows on World', { total });
