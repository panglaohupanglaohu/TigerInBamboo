// 1482346496460828674: OKLab contrast relaxation on triangles of the shared World.
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { decorateCells } from '../src/core/spatial.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { worldContrastMesh, solveContrastColors, measureContrastColors, cellContrastColors, featureBaseColors } from '../src/core/contrast-field.js';
import { srgbToOklab, oklabToSrgb, clampOklabToGamut, inGamut } from '../src/core/oklab.js';
// OKLab round trip + gamut clip
for (const c of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [.2, .5, .7]]) { const back = oklabToSrgb(...srgbToOklab(...c)); assert(back.every((v, i) => Math.abs(v - c[i]) < 1e-5)); }
const wild = [0.7, 0.4, 0.4]; assert(!inGamut(oklabToSrgb(...wild))); const clipped = clampOklabToGamut(wild); assert(inGamut(clipped) && inGamut(oklabToSrgb(...wild)));
const out = {};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 10 })], ['mixed', buildMixedGrid({ radius: 12 })]]) {
  const w = new World(decorateCells(grid)); generateTerrain(w, { seed: 7, rivers: 0, caves: 0 });
  const tall = w.cells.find((c) => w.top(c) >= 2 && w.top(c) < 10); w.setSolid(tall, w.top(tall) + 1, true); // one built voxel → its own feature
  const mesh = worldContrastMesh(w);
  assert.equal(mesh.tris.length, w.cells.reduce((s, c) => s + c.n, 0), 'one fan triangle per cell edge');
  assert(mesh.features.some((f) => f.startsWith('built:')), 'built feature from shared World');
  const shared = mesh.edges.filter((e) => mesh.tris[e.i].cell !== mesh.tris[e.j].cell);
  assert(shared.every((e) => e.contrast === (mesh.tris[e.i].feature !== mesh.tris[e.j].feature)));
  const a = solveContrastColors(mesh, { iters: 220, seed: 3 }), b = solveContrastColors(mesh, { iters: 220, seed: 3 });
  assert.deepEqual(a.rgb, b.rgb, 'deterministic');
  assert(a.rgb.every((c) => c.every((v) => v >= 0 && v <= 1)), 'all in sRGB gamut');
  assert(a.after.sameDE < a.before.sameDE * 0.05, 'non-contrast edges smoothed');
  assert(a.after.contrastDE >= a.before.contrastDE * 0.9 && a.after.minContrastDE > a.before.minContrastDE * 2, 'contrast edges stay apart');
  assert(a.after.contrastDE > a.after.sameDE * 50, 'lines readable');
  assert(a.after.withinFeatureSpread > 0.3, 'gradient byproduct, not dead flat colour');
  const zero = solveContrastColors(mesh, { iters: 0 }); assert.deepEqual(zero.before, zero.after);
  const cells = cellContrastColors(mesh, a, w.cells.length); assert.equal(cells.length, w.cells.length * 3);
  // Editing the World re-derives a different mesh (no cached separate decal)
  const v0 = mesh.version; w.setSolid(tall, w.top(tall), false); assert.notEqual(worldContrastMesh(w).version, v0);
  out[name] = { tris: mesh.tris.length, features: mesh.features.length, before: +a.before.sameDE.toFixed(2), after: +a.after.sameDE.toFixed(3), contrastDE: +a.after.contrastDE.toFixed(1), minContrastDE: +a.after.minContrastDE.toFixed(1) };
}
assert.throws(() => solveContrastColors({ tris: [{ feature: 0 }], edges: [{ i: 0, j: 3 }], features: ['a'] }), RangeError);
assert.throws(() => featureBaseColors(['a'], { baseOf: () => [NaN, 0, 0] }), RangeError);
console.log('PASS OKLab contrast relaxation on real World triangles', JSON.stringify(out));
