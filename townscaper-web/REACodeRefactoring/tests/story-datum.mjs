// storydatum (803190517534248960 / 806856212260278272, video only): storey lines on the global k*H grid.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { snapStoreyBands, measureFacade, windowRows, worldStoreyBands } = await import('../src/core/story-datum.js');
const { buildingComponents } = await import('../src/core/building-components.js');
// REACode demo: terrace step .65 = H/4 so local counting really staggers; datum mode aligns and truncates tops < 1 storey
const H = 2.6, bases = [3, 2, 1, 0, 1, 2].map(s => s * .65);
for (let seed = 0; seed < 50; seed++) {
  const floors = bases.map((_, i) => 2 + ((seed * 7 + i * 3) % 3));
  const datum = bases.map((b, i) => snapStoreyBands(b, floors[i], H)), local = bases.map((b, i) => snapStoreyBands(b, floors[i], H, { mode: 'local' }));
  const md = measureFacade(datum, H), ml = measureFacade(local, H);
  assert.ok(md.maxDevFromGrid < 1e-9); assert.ok(ml.maxDevFromGrid > .6);
  assert.ok(md.distinctLevels < ml.distinctLevels && md.reuse > ml.reuse && md.sharedLevels >= 2);
  for (const t of datum) { assert.ok(t.truncated >= -1e-9 && t.truncated < H); for (const y of windowRows(t)) assert.ok(y > t.base); }
}
assert.throws(() => snapStoreyBands(0, 0, 1));
// shared World: towers on different ground levels (fusion terraces) still share every storey line
let towers = 0, shared = 0, staggeredBases = 0;
for (const kind of ['quad', 'mixed']) for (const [scene, seed] of [['town', 7], ['fusion', 7], ['fusion', 11], ['fusion', 23]]) {
  const w = F.world(kind, scene, seed), comps = buildingComponents(w), t = worldStoreyBands(w, comps, F.L), m = measureFacade(t, F.L);
  assert.equal(m.maxDevFromGrid, 0); towers += t.length; shared += m.sharedLevels;
  staggeredBases += new Set(t.map(x => x.base)).size > 1;
  // windows actually drawn lie strictly between two consecutive storey lines of the global grid
  const glass = F.build(w, {}, { capture: [F.hexOf(F.BUILD.glass)] }).tris.map(x => x.p.map(p => p[1]));
  for (const ys of glass) { const lo = Math.min(...ys), hi = Math.max(...ys), k = Math.floor(lo / F.L + 1e-9); assert.ok(hi <= (k + 1) * F.L + 1e-9 || lo >= w.cells.reduce((m, c) => Math.max(m, w.top(c)), 0) * F.L - F.L, 'window inside one storey'); }
}
assert.ok(towers > 30 && shared > 10 && staggeredBases >= 4);
console.log('PASS global storey datum: 50 synthetic terraces (datum vs local) + World towers', { towers, shared, staggeredBases });
