// r55 G4 · src/depfill.js (1447488323845509121 "Erosion valid terrain with no local minimums"): lake water surface
// (water-mode fill → World.lakes → flat water polygons in terrain/terrainmesh.js) + integer stream-power erosion
// (core/depression-fill.js erodeHeights) on the shared World, both grids.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { fillTerrainDepressions, liveLakes } = await import('../src/terrain/drainage.js');
const { erodeHeights, depressionFill, localMinima } = await import('../src/core/depression-fill.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { TERRAIN } = await import('../src/core/palette.js');
const THREE = await import('three');
const L = 0.5, GRIDS = { quad: () => buildQuadGrid({ radius: 14, hexSize: 1 }), mixed: () => buildMixedGrid({ radius: 22, hexSize: 0.62 }) };
const riverHex = new THREE.Color(TERRAIN.river).getHexString();

// ---- erodeHeights on a synthetic ramp with a pit: lowers along flow, never creates pits, keeps level ≥1
{
  const nx = 12, nz = 5, cells = Array.from({ length: nx * nz }, (_, id) => { const x = id % nx, z = (id / nx) | 0; return { id, edgeNeighbors: [z ? id - nx : -1, x + 1 < nx ? id + 1 : -1, z + 1 < nz ? id + nx : -1, x ? id - 1 : -1] }; });
  const h = cells.map((c) => { const x = c.id % nx; return x === 0 ? 0 : Math.min(8, 1 + x); });
  h[5 + 2 * nx] = 2;   // pit
  const r = erodeHeights(cells, h, { passes: 4, k: 2 });
  assert.ok(r.lowered > 0 && r.volume === [...h].reduce((a, v, i) => a + v - r.heights[i], 0), 'volume bookkeeping');
  for (let i = 0; i < h.length; i++) { assert.ok(r.heights[i] <= h[i]); if (h[i] > 0) assert.ok(r.heights[i] >= 1); }
  assert.equal(r.minimaAfterFill, 0, 'eroded + filled surface has no local minima');
  assert.throws(() => erodeHeights(cells, h, { k: 0 }), RangeError);
}

const summary = {};
for (const kind of ['quad', 'mixed']) for (const seed of [7, 11, 23]) {
  // terrain-only scene with a dug basin → water-mode lakes; rock never raised
  const w = new World(decorateCells(GRIDS[kind]()));
  generateTerrain(w, { seed, basins: 1, rivers: 2 });
  const before = w.cells.map((c) => w.ground(c)), solid0 = w.solid.slice();
  const r = fillTerrainDepressions(w, { lakes: 'water' });
  assert.deepEqual(w.solid, solid0, 'water mode raises no rock');
  assert.equal(r.minimaAfter, 0, 'water surface (filled) has no local minima');
  const lakes = liveLakes(w);
  assert.ok(lakes.length >= 1 && lakes.length === r.lakes.length, 'every lake is live right after the fill');
  for (const lake of lakes) {
    for (const id of lake.cells) { assert.ok(before[id] < lake.level, 'bed below the water'); assert.equal(w.lakes.level[id], lake.level); }
    for (const id of lake.rim) assert.ok(w.ground(w.cells[id]) >= lake.level, 'rim holds the water');
  }
  // drawn: exactly one flat river-coloured polygon per lake cell at level·L − 0.07
  const shape = shapeTerrain(w, {}), m = new MeshWriter(); let water = 0;
  const poly = m.poly.bind(m); m.poly = (pts, dir, color, ...rest) => { if (color.getHexString && pts.every((p) => Math.abs(p[1] - pts[0][1]) < 1e-12) && lakes.some((l) => Math.abs(pts[0][1] - (l.level * L - 0.07)) < 1e-12)) water++; return poly(pts, dir, color, ...rest); };
  const out = buildTerrain(m, w, { L, shape });
  const cellsInLakes = lakes.reduce((a, l) => a + l.area, 0);
  assert.equal(out.lakeCells, cellsInLakes); assert.equal(water, cellsInLakes, 'one water polygon per lake cell');
  // editing a rim cell below the level drains the lake (snapshot no longer matches) → not drawn
  const big = [...lakes].sort((a, b) => b.area - a.area)[0], rimCell = w.cells[big.rim[0]];
  const snap = w.snapshot(); w.fill(rimCell, big.level - 1, { rock: true });
  assert.ok(!liveLakes(w).some((l) => l.id === big.id), 'breached lake disappears');
  assert.equal(buildTerrain(new MeshWriter(), w, { L, shape: shapeTerrain(w, {}) }).lakeCells, cellsInLakes - big.area);
  w.restore(snap);
  // rock mode (default) is unchanged: raises pits, no World.lakes
  const w2 = new World(decorateCells(GRIDS[kind]())); generateTerrain(w2, { seed, basins: 1, rivers: 2 }); const r2 = fillTerrainDepressions(w2);
  assert.equal(w2.lakes, null); assert.ok(r2.raised >= cellsInLakes, 'rock mode raises the same pits');
  assert.equal(buildTerrain(new MeshWriter(), w2, { L, shape: shapeTerrain(w2, {}) }).lakeCells, 0);

  // erosion on the real island (stream power + talus), then fill: no minima, only lowering, land stays land
  const w3 = new World(decorateCells(GRIDS[kind]())); generateTerrain(w3, { seed, caves: 0, features: false, rivers: 0 });
  const h3 = w3.cells.map((c) => w3.ground(c));
  const e = fillTerrainDepressions(w3, { lakes: 'water', erosion: { passes: 3, k: 3, talus: 4 } });
  const h4 = w3.cells.map((c) => w3.ground(c));
  assert.ok(e.erosion.lowered > 20, 'erosion cuts channels'); assert.equal(e.erosion.volume, h3.reduce((a, v, i) => a + v - h4[i], 0));
  for (let i = 0; i < h3.length; i++) { assert.ok(h4[i] <= h3[i]); if (h3[i] > 0) assert.ok(h4[i] >= 1, 'erosion never drowns land'); }
  const f = depressionFill(w3.cells, h4); assert.equal(localMinima(w3.cells, f.filled).length, 0); assert.equal(e.minimaAfter, 0);
  // eroded columns are still plain rock columns
  for (const c of w3.cells) { const g = w3.ground(c), mask = g ? (1 << g) - 1 : 0; assert.equal(w3.solid[c.id] & mask, mask); }
  summary[`${kind}-${seed}`] = { lakes: lakes.length, lakeCells: cellsInLakes, maxDepth: Math.max(...lakes.map((l) => l.depth)), eroded: e.erosion.lowered, erosionVolume: e.erosion.volume, talus: e.erosion.thermal };
}
// generateTerrain defaults: no lakes, no erosion, identical voxels with the new options explicitly off
{
  const a = new World(decorateCells(GRIDS.quad())), b = new World(decorateCells(GRIDS.quad()));
  generateTerrain(a, { seed: 7 }); generateTerrain(b, { seed: 7, lakes: false, erosion: null, basins: 0, riverRelax: false });
  assert.deepEqual(a.solid, b.solid); assert.deepEqual(a.river, b.river); assert.equal(a.lakes, null);
}
console.log('lakes-erosion-r55 PASS', JSON.stringify(summary));
