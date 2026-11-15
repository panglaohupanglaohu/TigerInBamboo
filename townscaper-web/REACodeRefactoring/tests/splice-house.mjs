// splice (1584623053061099520): houses spliced into terrain cells at will; ring cut in the cell's own domain.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { spliceRect, splicePolygon, footprintFor, spliceHouse, bilinear } = await import('../src/build/splice.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a.x * b.z - b.x * a.z; } return Math.abs(s) / 2; };
// original rectangle-in-quad: 4 patches + hole conserve area exactly on skewed quads
for (let k = 0; k < 50; k++) {
  const q = [{ x: 0, z: 0 }, { x: 1 + k * .01, z: .1 * Math.sin(k) }, { x: 1.2, z: 1 + .2 * Math.cos(k) }, { x: -.2 + .01 * k, z: .9 }];
  const r = spliceRect(q, { u0: .2, v0: .25, u1: .7, v1: .8 });
  assert.ok(Math.abs(r.patches.reduce((s, p) => s + area(p), 0) + area(r.hole) - area(q)) < 1e-12);
  const pf = splicePolygon(q, footprintFor(q, { inset: .2 }));
  assert.ok(Math.abs(pf.closure) < 1e-12 && pf.minSignedArea > 0, 'zipper ring: closed, no flipped triangle');
  // every outer edge used exactly once (unsplit), every hole edge exactly once -> no T-junctions
  assert.deepEqual(pf.tris.filter(t => t.kind === 'outer').map(t => t.edge).sort(), [0, 1, 2, 3]);
  assert.deepEqual(pf.tris.filter(t => t.kind === 'inner').map(t => t.edge).sort(), [0, 1, 2, 3]);
}
assert.deepEqual(bilinear([{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }], .5, .5), { x: 1, z: 1 });
assert.throws(() => spliceRect([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }], { u0: .1, v0: .1, u1: .9, v1: .9 }));
assert.throws(() => footprintFor([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }], { inset: .5 }));
// real terrain on both grids (triangles + quads), cage-deformed rings; World voxels untouched; off = old mesh
let spliced = 0, tri = 0, deformed = 0;
for (const kind of ['quad', 'mixed']) for (const seed of [7, 19]) {
  const w = new F.World(F.grid(kind)); generateTerrain(w, { seed });
  const before = F.voxels(w), base = new F.MeshWriter(), r0 = buildTerrain(base, w, { L: F.L });
  const candidates = w.cells.filter(c => spliceHouse(Object.create(w), c.id).ok).slice(0, 25);
  assert.ok(candidates.length >= 10);
  assert.equal(spliceHouse(w, w.cells.find(c => w.ground(c) === 0)?.id ?? -1).ok, false, 'sea cells refused');
  for (const c of candidates) assert.ok(spliceHouse(w, c.id, { inset: .22, stories: 1 + c.id % 2 }).ok);
  const shape = shapeTerrain(w, { enabled: true }), m = new F.MeshWriter(), r = buildTerrain(m, w, { L: F.L, shape });
  assert.deepEqual(F.voxels(w), before, 'splice is an overlay, voxels unchanged');
  assert.equal(r.splices.length, candidates.length);
  for (const s of r.splices) {
    const c = w.cells[s.cell];
    assert.ok(Math.abs(s.closure) < 1e-9 && s.minSignedArea > 0);
    assert.equal(s.tris.filter(t => t.kind === 'outer').length, c.n, 'cell edges stay unsplit for the neighbours');
    assert.ok(s.y0 < s.y && s.y1 > s.y, 'footprint sunk below the terrain top, house rises above');
    // ring follows the cage-deformed top (outer = shaped corner positions, not raw grid points)
    const g = w.ground(c), moved = c.pts.some((p, k) => { const [x, z] = shape.at(p, g); return Math.hypot(x - p.x, z - p.z) > 1e-6 && Math.abs(s.outer[k].x - x) < 1e-12 && Math.abs(s.outer[k].z - z) < 1e-12; });
    deformed += moved;
    tri += c.n === 3; spliced++;
  }
  w.splicedHouses.clear();
  const m2 = new F.MeshWriter(); buildTerrain(m2, w, { L: F.L });
  assert.equal(m2.pos.length, base.pos.length, 'removing the splice restores the old terrain mesh'); void r0;
}
assert.ok(spliced >= 60 && tri > 0 && deformed > spliced / 2);
console.log('PASS splice: 50 skewed quads rect+zipper closure, real terrain (quad/mixed) sunk houses', { spliced, tri, deformed });
