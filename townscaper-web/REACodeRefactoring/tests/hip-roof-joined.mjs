// hiproof (807256278154301441; README caption is swarm pathfinding, roofs read from frames only):
// metric audit interface + multi-cell hipped blocks on the shared equal-pitch eave field.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { hipRoofMetric, gableRoofMetric } = await import('../src/core/hip-roof.js');
// REACode TOWERS: ridge = long - short, apex on squares, overhang leaves ridge unchanged, area ties gable at equal pitch
for (const [w, d, rise] of [[4, 4, 2], [6, 4, 1.6], [8, 4, 1.4], [3, 3, 1.2], [3.4, 2.6, 1.1], [3, 3, 1.3]]) for (const o of [0, .28]) {
  const h = hipRoofMetric(w, d, rise, o), g = gableRoofMetric(w, d, rise, o);
  assert.ok(Math.abs(h.ridgeLength - Math.abs(w - d)) < 1e-12); assert.equal(h.apex, w === d);
  assert.equal(h.triCount + h.trapCount, 4); assert.equal(h.triCount, w === d ? 4 : 2); assert.equal(h.gableWalls, 0); assert.equal(g.gableWalls, 2);
  assert.equal(h.eaveSpread, 0); assert.ok(Math.abs(h.surfArea - g.surfArea) < 1e-9, 'equal pitch: hip and gable roof areas tie');
  assert.ok(Math.abs(g.gableWallArea - h.depth * rise) < 1e-12);
}
assert.throws(() => hipRoofMetric(1, 1, 1, -1));
// World: town + fusion, quad + mixed. Flag off = old geometry; hipRoofsJoined removes every gable wall.
let joinedMulti = 0, isolated = 0;
for (const kind of ['quad', 'mixed']) for (const [scene, seed] of [['town', 7], ['town', 11], ['fusion', 7]]) {
  const w = F.world(kind, scene, seed), before = F.voxels(w);
  const off = F.build(w), hip = F.build(w, { hipRoofs: true }), joined = F.build(w, { hipRoofsJoined: true });
  assert.deepEqual(F.voxels(w), before); assert.equal(F.build(w).verts, off.verts);
  assert.ok(off.r.roofStats.gables > 0, 'default keeps row-end gables');
  assert.equal(joined.r.roofStats.gables, 0); assert.equal(joined.r.roofStats.hipRegions, joined.r.roofStats.hipAudit.length);
  assert.ok(joined.r.roofStats.gables <= hip.r.roofStats.gables);
  for (const a of joined.r.roofStats.hipAudit) assert.ok(a.eaveHi - a.eaveLo < 1e-12 && Math.abs(a.eaveLo - (a.base - .02)) < 1e-9, 'all eaves level at base');
  joinedMulti += joined.r.roofStats.hipAudit.filter(a => a.cells > 1).length; isolated += joined.r.roofStats.isolatedHips ?? 0;
  assert.ok(joined.verts < off.verts, 'gable triangles/windows removed');
}
assert.ok(joinedMulti > 20 && isolated > 0);
console.log('PASS metric hip audit (12 towers) + World multi-cell hipped blocks', { joinedMulti, isolated });
