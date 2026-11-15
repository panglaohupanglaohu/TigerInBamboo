// r56 C08 · 1490068909042642944 banded adjacency graph: bridges, region components, BFS layers
import assert from 'node:assert/strict';
import { findBridges, twoEdgeComponents, bandedGraph, bfsLayers } from '../src/core/graph-bands-c08.js';
// small known graphs
const mk = (E) => { const m = new Map(); for (const [a, b] of E) { (m.get(a) || m.set(a, []).get(a)).push(b); (m.get(b) || m.set(b, []).get(b)).push(a); } return { ids: [...m.keys()].sort((a, b) => a - b), nb: (v) => m.get(v) || [] }; };
{ // two triangles joined by one edge + a pendant: bridges = {2,3} and {5,6}
  const g = mk([[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3], [5, 6]]);
  assert.deepEqual([...findBridges(g.ids, g.nb)].sort(), ['2,3', '5,6']);
  const c = twoEdgeComponents(g.ids, g.nb); assert.deepEqual(c.sizes, [3, 3, 1]);
}
{ const g = mk([[0, 1], [1, 2], [2, 3], [3, 0]]); assert.equal(findBridges(g.ids, g.nb).size, 0); }
{ // long path: every edge is a bridge, iterative (no recursion overflow)
  const E = []; for (let i = 0; i < 20000; i++) E.push([i, i + 1]); const g = mk(E); assert.equal(findBridges(g.ids, g.nb).size, 20000);
}
// banded graph on the shared mixed grid
const G = bandedGraph();
const portals = new Set(G.spokeEdges.map(([a, b]) => (a < b ? a + ',' + b : b + ',' + a)));
const R = twoEdgeComponents(G.ids, G.nb, portals);
assert.equal(G.spokeEdges.length, 16, '3 band gaps x 4 spokes + 4 pendants');
assert.equal(R.sizes.slice(0, 4).length, 4); assert.ok(R.sizes[3] > 10, 'four real bands');
assert.equal(R.sizes.length, 8, '4 bands + 4 pendant nodes');
// each band region is a single band, nested by radius
const meanR = R.groups.slice(0, 4).map((g) => g.reduce((s, v) => s + Math.hypot(...G.pos.get(v)), 0) / g.length).sort((a, b) => a - b);
for (let i = 1; i < 4; i++) assert.ok(meanR[i] > meanR[i - 1] + .5);
for (const g of R.groups.slice(0, 4)) assert.equal(new Set(g.map((v) => G.band.get(v))).size, 1);
// pendant spokes are bridges; inter-band spokes (4 parallel) are not
const B = findBridges(G.ids, G.nb);
for (const [a, b] of G.spokeEdges) { const k = a < b ? a + ',' + b : b + ',' + a; if (a < 0 || b < 0) assert.ok(B.has(k)); else assert.ok(!B.has(k)); }
const L = bfsLayers(G.ids, G.nb, G.center);
assert.equal(L.depth.size, G.ids.length, 'connected');
console.log({ nodes: G.ids.length, regions: R.sizes, bridges: B.size, layers: L.layers.length - 1 });
console.log('PASS graph-bands-c08');
