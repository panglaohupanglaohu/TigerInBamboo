// r56 C08 · 1670790425232175108 pure hex / square / triangle grids through the shared terrain pipeline
import assert from 'node:assert/strict';
import { PURE_GRIDS, gridKindSummary } from '../src/core/grid-kinds-c08.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { decorateCells } from '../src/core/spatial.js';
const expect = { hex: 6, square: 4, tri: 3 };
for (const [k, def] of Object.entries(PURE_GRIDS)) {
  const g = def.build(), s = gridKindSummary(g);
  assert.deepEqual(Object.keys(s.sides).map(Number), [expect[k]], k + ' is pure');
  // reciprocal half-edge adjacency (same contract as quad/mixed)
  for (const c of g.cells) c.edgeNeighbors.forEach((n, e) => { if (n < 0) return; const o = g.cells[n], j = c.edgeTwins?.[e] ?? o.edgeNeighbors.indexOf(c.id); assert.equal(o.edgeNeighbors[j], c.id); });
  decorateCells(g);
  const w = new World(g); generateTerrain(w, { seed: 7 });
  const land = g.cells.filter((c) => w.ground(c) > 0).length, levels = new Set(g.cells.map((c) => w.ground(c)));
  assert.ok(land > g.cells.length * .15 && land < g.cells.length * .95, k + ' island ' + land);
  assert.ok(levels.size >= 3, k + ' terraces');
  // radius keys never collide with quad(14)/mixed(22) share-link detection
  assert.ok(![14, 22].includes(def.radius));
  console.log(k, s, { land, levels: levels.size });
}
console.log('PASS grid-kinds-c08');
