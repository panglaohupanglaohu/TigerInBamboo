// r55 housekit (781027725452648448 "House kit", REACode/housekit): 8-step pitch pool, FLOORS pool,
// ratioOK, scatterVillage on terrain platforms (World voxels + roofSpecs), procedural thatch courses
// on the exact skeleton roof, chimneys seated on the drawn roof, flags off = old geometry.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { PITCHES, FLOORS, THATCH, pitchPool, verifyHouseKit } = await import('../src/core/house-kit.js');
const { scatterVillage } = await import('../src/build/village.js');
assert.deepEqual(PITCHES, [26, 29, 32, 35, 38, 41, 42, 44]); assert.deepEqual(FLOORS, [1, 2, 3]);
for (const [wd, h] of [[.8, .5], [1, 1], [.6, 1.5]]) for (const p of pitchPool(wd, h)) { const r = wd / 2 * Math.tan(p * Math.PI / 180) / h; assert.ok(r >= .2 && r <= .95); }
const straw = new Set(THATCH.map(F.hexOf));
let houses = 0, thatched = 0, risers = 0, pitchesSeen = new Set(), slopeChecked = 0;
for (const kind of ['quad', 'mixed']) for (const seed of [3, 8]) {
  const w = F.world(kind, 'terrain', 7), before = F.voxels(w);
  const base = F.build(w);
  assert.equal(base.verts, 0, 'terrain scene has no buildings before scattering');
  const v = scatterVillage(w, { seed, count: 12 });
  assert.ok(v.houses.length >= 8, 'village placed');
  const taken = new Map(); for (const h of v.houses) for (const id of h.cells) taken.set(id, h.house);
  for (const h of v.houses) {
    assert.ok(FLOORS.includes(h.floors) && PITCHES.includes(h.pitch) && h.cells.length >= 1 && h.cells.length <= 3);
    for (const id of h.cells) {
      const c = w.cells[id], g = h.ground;
      assert.equal(w.ground(c), g); assert.equal(w.top(c), g + h.floors, 'storeys written as World voxels');
      for (let lv = g + 1; lv <= g + h.floors; lv++) assert.ok(w.isBuilt(c, lv), 'non-rock built voxel');
      assert.ok(!before[3][id], 'no house on a river cell');
      for (const nb of c.edgeNeighbors) if (nb >= 0 && taken.has(nb)) assert.equal(taken.get(nb), h.house, 'houses never touch → separate roof regions');
      assert.deepEqual(w.roofSpecs.get(id), { pitch: h.pitch, thatch: h.thatch, floors: h.floors, house: h.house });
    }
    houses++; if (h.thatch) thatched++; pitchesSeen.add(h.pitch);
  }
  // legacy roofs already read the pitch; skeleton roofs add thatch courses
  const capture = [...straw];
  const leg = F.build(w), sk = F.build(w, { hipSkeleton: true }, { capture });
  assert.ok(leg.verts > 0 && sk.r.roofStats.skeletons.length === v.houses.length, 'one skeleton roof per house');
  for (const s of sk.r.roofStats.skeletons) {
    const h = v.houses.find(x => x.cells.includes(s.minId) || x.cells.some(id => id === s.minId));
    assert.ok(h, 'region matches a village house'); assert.equal(s.pitch, h.pitch); assert.equal(s.thatch, h.thatch);
    assert.ok(Math.abs(s.slope - Math.tan(h.pitch * Math.PI / 180)) < 1e-12);
    assert.ok(s.areaErr < 1e-9 && s.planarErr < 1e-9);
    if (h.thatch) assert.ok(s.risers > 0, 'thatch courses have risers'); else assert.equal(s.risers, 0);
    risers += s.risers;
    if (!h.thatch) for (const t of s.tris3) { // every sloped tile triangle has exactly the pool pitch
      const ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2], vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz); if (l < 1e-9) continue;
      const ang = Math.acos(Math.abs(ny) / l) * 180 / Math.PI; if (ang < .5) continue;   // flat top at the cap
      assert.ok(Math.abs(ang - h.pitch) < 1e-6, 'roof face pitch = pool pitch'); slopeChecked++;
    }
  }
  assert.ok(sk.tris.length > 0 === v.houses.some(h => h.thatch), 'straw-coloured thatch triangles drawn');
  const tris = sk.r.roofStats.skeletons.flatMap(s => s.tris3), chk = verifyHouseKit({ chimneys: sk.r.chimneys, roofTris: tris, L: F.L });
  assert.equal(chk.unseated, 0); assert.ok(chk.chimneyFloat < 1e-9);
}
// hashed pool on the town (no village): flag off keeps the 1.3 slope / identical geometry
for (const kind of ['quad', 'mixed']) {
  const w = F.world(kind, 'town', 7), off = F.build(w), off2 = F.build(w, { housePitchPool: false, thatchRoofs: false }), pool = F.build(w, { housePitchPool: true }), both = F.build(w, { housePitchPool: true, hipSkeleton: true, thatchRoofs: true });
  assert.equal(off.verts, off2.verts); assert.notEqual(pool.verts, 0);
  const ps = new Set(both.r.roofStats.skeletons.map(s => s.pitch)); assert.ok(ps.size >= 4 && [...ps].every(p => PITCHES.includes(p)), 'regions spread over the 8-step pool');
  assert.ok(both.r.roofStats.skeletons.every(s => s.thatch && s.risers > 0));
}
assert.ok(houses >= 36 && thatched > 10 && risers > 200 && pitchesSeen.size >= 4 && slopeChecked > 50);
console.log('PASS house kit pitch pool / village scatter / thatch', { houses, thatched, risers, pitches: [...pitchesSeen].sort(), slopeChecked });
