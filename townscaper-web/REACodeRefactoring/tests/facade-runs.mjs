// surfacedeco (1181464374839521280 "an additional smaller WFC for surface decorations like windows and doors"):
// whole-facade runs across collinear wall segments of neighbouring cells, solved once by the shared WFC.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { validateFacade } = await import('../src/core/surface-decoration.js');
const isWin = s => s === 'window' || s === 'window2';
const badPair = (l, r) => (isWin(l) && l === r) || (l === 'shutterR' && !isWin(r)) || (r === 'shutterL' && !isWin(l));
const flags = { surfaceWFC: true, surfaceFacade: true };
let runs = 0, multi = 0, crossDrawn = 0, oldBoundaryBad = 0, newBoundaryBad = 0;
for (const kind of ['quad', 'mixed']) for (const [scene, seed] of [['town', 7], ['town', 11], ['town', 23], ['fusion', 7]]) {
  const w = F.world(kind, scene, seed), before = F.voxels(w);
  const old = F.build(w, flags), on = F.build(w, { ...flags, surfaceFacadeRuns: true });
  assert.deepEqual(F.voxels(w), before); assert.equal(F.build(w, flags).verts, old.verts, 'flag off restores geometry');
  assert.equal(on.r.decoFailures, 0);
  const at = (r, cell, edge, level, slot) => r.decoPlacements.find(p => p.cell === cell && p.edge === edge && p.level === level && p.slot === slot)?.style ?? 'none';
  for (const run of on.r.facadeRuns) {
    assert.ok(run.ok); assert.deepEqual(validateFacade(run.styles, { width: run.width, levels: run.levels }), []);
    assert.equal(run.spans.reduce((s, x) => s + x.width, 0), run.width); runs++; multi += run.spans.length >= 2;
    for (let k = 0; k + 1 < run.spans.length; k++) {
      const A = run.spans[k], B = run.spans[k + 1];
      assert.equal(w.cells[A.cell].pts[(A.edge + 1) % w.cells[A.cell].n].id, w.cells[B.cell].pts[B.edge].id, 'consecutive segments share a vertex');
      for (let lv = run.lo; lv <= run.hi; lv++) {
        if (badPair(at(old.r, A.cell, A.edge, lv, A.width - 1), at(old.r, B.cell, B.edge, lv, 0))) oldBoundaryBad++;
        // solved styles across the boundary obey the horizontal rule
        const row = run.styles.slice((lv - run.lo) * run.width, (lv - run.lo + 1) * run.width);
        if (badPair(row[B.offset - 1], row[B.offset])) newBoundaryBad++;
      }
    }
  }
  // every drawn cross-cell shutter has its partner window drawn in the same run and level
  for (const p of on.r.decoPlacements.filter(p => p.crossCell)) {
    const partner = on.r.decoPlacements.find(q => q.run === p.run && q.level === p.level && q.global === p.global + (p.style === 'shutterL' ? -1 : 1));
    assert.ok(partner && isWin(partner.style)); crossDrawn++;
  }
}
assert.equal(newBoundaryBad, 0); assert.ok(oldBoundaryBad > 0, 'per-segment solving did break the rule at cell boundaries');
assert.ok(runs > 50 && multi === runs && crossDrawn > 20);
console.log('PASS facade runs across cells', { runs, crossDrawn, oldBoundaryBad, newBoundaryBad });
