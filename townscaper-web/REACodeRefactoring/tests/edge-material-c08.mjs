// r56 C08 · 1670720537662836736 / 1670725072540106755: material (blue) borders take part in the hierarchy
import assert from 'node:assert/strict';
import { buildQuadGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { squareRelax, classifyWorldEdges, relaxMetrics, EDGE_ORDER } from '../src/terrain/edge-square-relax.js';
function makeWorld(seed, mat) {
  const g = buildQuadGrid({ radius: 8, seed, relaxPasses: 0 }), w = new World(g);
  for (const c of g.cells) { const r = Math.hypot(c.cx, c.cz); if (r < 6.6 + Math.sin(c.cz * 1.3 + seed) * .8) w.fill(c, r < 3.2 + Math.cos(c.cx * 1.1 + seed) ? 2 : 1, { rock: true }); }
  for (const c of g.cells) { const t = w.top(c); if (t === 1 && Math.sin(c.cx * 1.6 + seed) * Math.cos(c.cz * 1.25 - seed) > .42) { w.fill(c, 1, {}); w.color[c.id] = c.cx > 0 ? 1 : 2; } }
  if (mat) for (const c of g.cells) if (w.top(c) && !w.topIsBuilt(c)) w.color[c.id] = Math.sin(c.cx * .55 + seed * .7) + Math.cos(c.cz * .48 - seed) > .35 ? 5 : 0;
  return w;
}
for (const seed of [3, 7]) {
  const w0 = makeWorld(seed, false), w1 = makeWorld(seed, true);
  const c0 = classifyWorldEdges(w0), c1 = classifyWorldEdges(w1);
  const nMat = (c) => c.edges.filter((e) => e.order === EDGE_ORDER.MATERIAL).length;
  assert.ok(nMat(c1) > nMat(c0) + 20, 'material zones create blue edges');
  // default page world (no zones) unchanged by the new option
  assert.deepEqual(c0.edges.map((e) => e.order), classifyWorldEdges(makeWorld(seed, false)).edges.map((e) => e.order));
  const hi = squareRelax(w1, { mode: 'hierarchical', passes: 60, classification: c1 }), du = squareRelax(w1, { mode: 'dumb', passes: 60, classification: c1 });
  const mv = (r) => { let s = 0, n = 0; c1.vrank.forEach((k, v) => { if (k !== EDGE_ORDER.MATERIAL) return; s += Math.hypot(r.X[v] - w1.grid.verts[v].x, r.Z[v] - w1.grid.verts[v].z); n++; }); return s / n; };
  // material verts slide only along material edges -> smaller off-line drift than dumb smoothing; hard verts barely move
  const mh = relaxMetrics(w1, hi), md = relaxMetrics(w1, du);
  assert.ok(mh.hardShift < md.hardShift / 4, 'hard lines kept');
  assert.ok(mv(hi) < mv(du), 'material verts move less than in dumb mode');
  assert.ok(mh.regularityFree < relaxMetrics(w1, squareRelax(w1, { mode: 'none', classification: c1 })).regularityFree, 'free cells still regularise');
  console.log({ seed, blue: nMat(c1), matMove: [+mv(hi).toFixed(3), +mv(du).toFixed(3)], hard: [+mh.hardShift.toFixed(3), +md.hardShift.toFixed(3)] });
}
console.log('PASS edge-material-c08');
