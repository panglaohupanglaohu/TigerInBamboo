// r56 C08 · 1471817524148940807 rocky island: corner cuts only on per-level region boundaries
import assert from 'node:assert/strict';
import { buildQuadGrid, buildSquareGrid, buildMixedGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { rockIslandMesh } from '../src/core/rock-island-c08.js';
for (const g of [buildQuadGrid({ radius: 8, hexSize: 1, seed: 1337 }), buildSquareGrid({ radius: 12, cellSize: .8 })]) {
  const w = new World(g); generateTerrain(w, { seed: 4 });
  const before = JSON.stringify(g.cells.map((c) => [w.ground(c), w.top(c)]));
  const on = rockIslandMesh(w, { cut: .5, L: .3 }), off = rockIslandMesh(w, { cut: 0, L: .3 });
  assert.ok(on.position.every(Number.isFinite) && on.position.length === on.color.length);
  assert.ok(on.walls > off.walls * 1.4, 'chamfers add zig-zag wall segments');
  assert.ok(on.cutCorners > 50);
  // top area shrinks only a little (corners cut on boundaries only, interior squares intact)
  const topArea = (m) => { let a = 0; for (let i = 0; i < m.position.length; i += 9) { const y = m.position[i + 1]; if (Math.abs(y - m.position[i + 4]) > 1e-9 || Math.abs(y - m.position[i + 7]) > 1e-9) continue; const ax = m.position[i + 3] - m.position[i], az = m.position[i + 5] - m.position[i + 2], bx = m.position[i + 6] - m.position[i], bz = m.position[i + 8] - m.position[i + 2]; a += Math.abs(ax * bz - az * bx) / 2; } return a; };
  const ra = topArea(on) / topArea(off);
  assert.ok(ra > .8 && ra < .99, 'top area ratio ' + ra);
  assert.equal(JSON.stringify(g.cells.map((c) => [w.ground(c), w.top(c)])), before, 'World unchanged');
  console.log({ cells: g.cells.length, walls: [off.walls, on.walls], cutCorners: on.cutCorners, topAreaRatio: +ra.toFixed(3) });
}
assert.throws(() => { const g = buildMixedGrid({ radius: 6, seed: 5 }), w = new World(g); generateTerrain(w, { seed: 4 }); rockIslandMesh(w); }, /bipartite/);
console.log('PASS rock-island-c08');
