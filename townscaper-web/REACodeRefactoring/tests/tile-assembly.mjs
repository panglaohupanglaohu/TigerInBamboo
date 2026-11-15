// tileplace (784847588893814785 / 784847933686575104 / 787319655648100352 / 784848286272327680):
// content-agnostic label tiles solved by the shared WFC on a 3D layered lattice over the real World grid.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const T = await import('../src/build/tile-assembly.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
// tile expansion: uniform sides -> 1 variant, one odd side -> n rotations, works for 3- and 4-sided cells
assert.equal(T.expandTiles(T.TILESET_RUIN, 3).filter(t => t.name === 'arch').length, 3);
assert.equal(T.expandTiles(T.TILESET_FORT, 4).filter(t => t.name === 'door').length, 4);
const cmp = T.labelCompatible(['A|D']);
assert.ok(cmp({ label: 'D', v: 0 }, { label: 'A', v: 0 }) && cmp({ label: 'A', v: 0 }, { label: 'D', v: 0 }) && !cmp({ label: 'W', v: 0 }, { label: 'A', v: 0 }) && !cmp({ label: 'A', v: 1 }, { label: 'A', v: 0 }));
let solved = 0, voxels = 0, diffSets = 0, triSites = 0;
for (const kind of ['quad', 'mixed']) for (const seed of [3, 7, 19]) {
  const w = new F.World(F.grid(kind)); generateTerrain(w, { seed: 7 });
  const site = T.assemblySite(w, { seed, size: 12, height: 3 }); assert.ok(site);
  triSites += site.cells.some(id => w.cells[id].n === 3);
  const sets = [];
  for (const tileset of [T.TILESET_FORT, T.TILESET_RUIN]) {
    const r = T.solveAssembly(w, site, { tileset, seed });
    assert.ok(r.ok, r.reason); assert.deepEqual(r.conflicts, []); assert.ok(!r.traceTruncated);
    assert.deepEqual(T.solveAssembly(w, site, { tileset, seed }).tiles, r.tiles, 'deterministic');
    // assembly playback: every piece fixed exactly once, ghosts end at zero
    const order = r.steps.flatMap(s => s.placed); assert.equal(order.length, r.lattice.cells.length); assert.equal(new Set(order).size, order.length);
    assert.equal(r.steps.at(-1).ghosts, 0); assert.ok(r.steps[0].ghosts > 0 || r.steps[0].placed.length === r.lattice.cells.length);
    // commit into a copy of the World: solid tiles become built voxels, all supported, World pipeline builds them
    const w2 = new F.World(F.grid(kind)); w2.palette = F.PALETTES.town; for (const k of ['solid', 'rock', 'color', 'river']) w2[k].set(w[k]);
    const c = T.commitAssembly(w2, site, r); assert.ok(c.ok);
    const solid = r.lattice.cells.filter(x => r.byId.get(r.tiles[x.id]).solid);
    assert.equal(c.voxels, solid.length);
    for (const x of solid) { const cell = w2.cells[x.cell], lv = site.ground + x.level; assert.ok(w2.isBuilt(cell, lv)); assert.ok(w2.isSolid(cell, lv - 1), 'no floating piece'); }
    assert.equal(T.commitAssembly(w2, site, r).ok, solid.length ? false : true, 'occupied voxels refused');
    if (solid.length) { const b = F.build(w2); assert.ok(b.verts > 0); }
    sets.push(solid.map(x => x.id).join(',')); solved++; voxels += solid.length;
  }
  diffSets += sets[0] !== sets[1];
}
assert.ok(solved === 12 && voxels > 50 && diffSets >= 5 && triSites > 0);
console.log('PASS content-agnostic 3D tile assembly on World grids (FORT/RUIN), playback + commit', { solved, voxels, diffSets, triSites });
