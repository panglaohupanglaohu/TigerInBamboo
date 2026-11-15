// r56 C08 · 1458921394855718917 half-edge region loops + gap triangulation on the shared halfedge/trigraph
import assert from 'node:assert/strict';
import { scatterGroups, fillGaps, gapLoops, fullMesh } from '../src/core/halfedge-patch-c08.js';
for (const seed of [1, 2, 3, 4, 5]) {
  const G = scatterGroups({ seed });
  assert.ok(G.length >= 8, 'enough groups');
  const F = fillGaps(G, { seed });
  assert.equal(F.missingConstraints, 0, 'every group/circle outline edge is a mesh edge');
  const L = gapLoops(F);
  assert.equal(L.errors.length, 0);
  // remaining region: circle + one loop per connected cluster of groups (groups are separated by a gap)
  assert.equal(L.loops.length, G.length + 1);
  const M = fullMesh(F);
  assert.deepEqual(M.errors, []);
  assert.equal(M.H.euler, 1, 'disk');
  assert.equal(M.H.boundaryLoops.length, 1, 'single outer loop after filling');
  // every vertex fan covers its outgoing half-edges and every quad is still a quad
  assert.equal(M.cells.filter((c) => c.kind === 'quad').length, F.quads.length);
  assert.ok(M.cells.filter((c) => c.kind === 'tri').every((c) => c.n === 3));
}
// constraint recovery path: sparse gap points force flips but still conform
const G = scatterGroups({ seed: 9 }), F = fillGaps(G, { seed: 9, spacing: 2.2, ring: 40 });
assert.equal(F.missingConstraints, 0);
const M = fullMesh(F); assert.deepEqual(M.errors, []); assert.equal(M.H.euler, 1);
console.log({ sparseForcedFlips: F.forced, tris: F.tris.length });
console.log('PASS halfedge-patch-c08');
