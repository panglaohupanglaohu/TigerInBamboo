// 1786014232594485497: none / baked / runtime mountain shading measured on the shared World.
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { decorateCells, buildCellIndex } from '../src/core/spatial.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { worldMountainField, mountainNormalAt, renderMountainShade, mountainShadeStats, compareMountainModes, bakeNormalLight } from '../src/core/mountain-bake.js';
const out = {};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 10 })], ['mixed', buildMixedGrid({ radius: 13 })]]) {
  const w = new World(decorateCells(grid)); generateTerrain(w, { seed: 7, rivers: 0, caves: 0 });
  const idx = buildCellIndex(w.grid), f = worldMountainField(w, idx);
  // field really reads the World: a sampled texel's cell matches index lookup
  const k = f.cellOf.findIndex((c) => c >= 0 && w.ground(w.cells[c]) > 3); assert(k >= 0);
  for (let i = 0; i < f.w * f.h; i += 97) { const n = mountainNormalAt(f, i % f.w, Math.floor(i / f.w)); assert(Math.abs(Math.hypot(...n) - 1) < 1e-9 && n[2] > 0); }
  const cmp = compareMountainModes(f);
  assert(cmp.none.px > 200, 'rock texels from real terrain');
  assert(Math.abs(cmp.none.rVsNL) < 0.35, 'flat albedo carries ~no volume');
  assert(cmp.baked.rVsNL > 0.75, 'baked brightness recovers most of N·L');
  assert(cmp.runtime.rVsNL >= cmp.baked.rVsNL - 0.02, 'runtime normals at least as good');
  assert(cmp.baked.stdLuma > cmp.none.stdLuma, 'bake adds light variation');
  const baked = renderMountainShade(f, 'baked'), runtime = renderMountainShade(f, 'runtime');
  assert.equal(baked.runtimeTaps, 0); assert(runtime.runtimeTaps > 0, 'runtime pays per-texel taps');
  assert.equal(cmp.cost.extraPct, 25); assert.equal(cmp.cost.bakedExtraPct, 0);
  // Ridge outline is a sparse percentile (≤ ~0.5% of terrain), not freckles everywhere
  let dark = 0, terr = 0; for (let i = 0; i < f.w * f.h; i++) if (f.terrain[i]) { terr++; if (Number.isFinite(baked.luma[i]) && baked.luma[i] < 0.25) dark++; }
  assert(dark / terr < 0.01);
  // Editing the World changes the field (no stale separate mountain)
  const c = w.cells[f.cellOf[k]]; w.fill(c, 0, { rock: true }); const f2 = worldMountainField(w, idx); assert.notEqual(f2.version, f.version); assert.notDeepEqual(f2.z, f.z);
  out[name] = { size: [f.w, f.h], none: +cmp.none.rVsNL.toFixed(3), baked: +cmp.baked.rVsNL.toFixed(3), runtime: +cmp.runtime.rVsNL.toFixed(3), bakedStd: +cmp.baked.stdLuma.toFixed(3) };
}
assert.equal(bakeNormalLight([0, 1, 0]).length, 1, 'existing vertex bake API intact');
assert.throws(() => renderMountainShade({ w: 3, h: 3, z: new Float32Array(9), terrain: new Uint8Array(9) }, 'shiny'), RangeError);
console.log('PASS mountain none/baked/runtime on shared World height field', JSON.stringify(out));
