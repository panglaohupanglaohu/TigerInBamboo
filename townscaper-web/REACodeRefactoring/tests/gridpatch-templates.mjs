// r55 gridpatch (1301816247479345152 "sprinkling the current generated grid with random patches of hand crafted
// grid, like little gems"): template library (radial / block / rhombus / courtyard) + holed boundary (courtyard keeps
// the original cells inside its hole). Closure, no flips, exact boundary vertex sharing, hole untouched.
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid, signedArea, isConvex } from '../src/core/grid.js';
import { PATCH_TEMPLATES, insertTemplatePatch, fitTemplatePatch, insertRadialPatches, migrateWorldToPatch } from '../src/core/radial-patch.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { selfCheck } from '../src/core/adjacency.js';
const area = (cells) => cells.reduce((s, c) => s + Math.abs(signedArea(c.pts)), 0);
const angleAt = (pts, i) => { const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length]; const u = [a.x - b.x, a.z - b.z], v = [c.x - b.x, c.z - b.z]; return Math.acos((u[0] * v[0] + u[1] * v[1]) / Math.hypot(...u) / Math.hypot(...v)) * 180 / Math.PI; };
const stats = Object.fromEntries(PATCH_TEMPLATES.map((t) => [t, { ok: 0, tries: 0, tris: 0, holeCells: 0 }]));
for (const [kind, build] of [['quad', buildQuadGrid], ['mixed', buildMixedGrid]]) for (let seed = 1; seed <= 8; seed++) for (const template of PATCH_TEMPLATES) {
  const g = build({ radius: 10, hexSize: 1, seed }), before = JSON.stringify(g.cells.map((c) => c.pts.map((p) => [p.id, p.x, p.z])));
  const p = fitTemplatePatch(g, { template, x: .3, z: -.2, radius: 3, holeRadius: 1.3 });
  const st = stats[template]; st.ok++; st.tries += p.patch.tries;
  assert.equal(JSON.stringify(g.cells.map((c) => c.pts.map((q) => [q.id, q.x, q.z]))), before, 'source grid untouched');
  assert.equal(p.patch.template, template);
  // closure: area conserved, every new cell convex with positive area, half-edges reciprocal
  assert.ok(Math.abs(area(p.cells) - area(g.cells)) < 1e-7, 'area conserved');
  const patchCells = p.patch.cellIds.map((id) => p.cells[id]);
  assert.ok(Math.abs(area(patchCells) - area(p.patch.removedIds.map((id) => g.cells[id]))) < 1e-7, 'patch area = removed area');
  for (const c of patchCells) { assert.ok(isConvex(c.pts) && Math.abs(signedArea(c.pts)) > 1e-8, 'no flipped/degenerate cell'); assert.ok(c.n === 4 || c.n === 3); st.tris += c.n === 3; }
  assert.equal(selfCheck(p, new World(p)).mismatched, 0);
  for (const c of p.cells) for (let i = 0; i < c.n; i++) { const o = c.edgeNeighbors[i]; if (o >= 0) assert.equal(p.cells[o].edgeNeighbors[c.edgeTwins[i]], c.id); }
  // outside + hole cells keep their exact geometry; boundary vertices are shared (same coordinates, used on both sides)
  for (const c of p.cells) if (p.sourceCellOf[c.id] >= 0) assert.deepEqual(c.pts.map((q) => [q.x, q.z]), g.cells[p.sourceCellOf[c.id]].pts.map((q) => [q.x, q.z]));
  const patchSet = new Set(p.patch.cellIds);
  for (const vid of [...p.patch.boundaryIds, ...p.patch.holeBoundaryIds]) {
    const users = p.vertexCells.get(vid);
    assert.ok(users.some((id) => patchSet.has(id)) && users.some((id) => !patchSet.has(id)), 'seam vertex shared by patch and kept cells');
  }
  // patch cells are reachable from the kept outside through the seam (no T-junction: every seam edge has a twin)
  let seam = 0; for (const c of patchCells) for (let i = 0; i < c.n; i++) { const o = c.edgeNeighbors[i]; assert.ok(o >= 0, 'no open edge inside the grid'); if (!patchSet.has(o)) seam++; }
  assert.equal(seam, p.patch.boundaryIds.length + p.patch.holeBoundaryIds.length, 'one twin edge per seam edge');
  if (template === 'courtyard') {
    // holed boundary: the hole keeps the original cells, untouched and still connected only through the seam
    assert.ok(p.patch.holeCellIds.length > 0); st.holeCells += p.patch.holeCellIds.length;
    for (const id of p.patch.holeCellIds) { assert.ok(!patchSet.has(id)); const src = g.cells[p.sourceCellOf[id]]; assert.ok(Math.hypot(src.cx - p.patch.x, src.cz - p.patch.z) < p.patch.holeRadius); }
    assert.ok(p.patch.holeBoundaryIds.length >= 3);
  } else assert.equal(p.patch.holeCellIds.length, 0);
  if (template === 'block' || template === 'rhombus') {
    // the core is a regular lattice: a×b congruent cells with 90° (block) or 60/120° (rhombus) corners
    const want = template === 'block' ? [90] : [60, 120];
    const core = patchCells.filter((c) => c.n === 4 && c.pts.every((_, i) => want.some((w) => Math.abs(angleAt(c.pts, i) - w) < 1e-6)));
    const [a, b] = p.patch.lattice;
    assert.ok(core.length >= a * b, `${template} core lattice ${core.length} >= ${a * b}`);
    const ar = core.map((c) => Math.abs(signedArea(c.pts)));
    assert.ok(Math.max(...ar) - Math.min(...ar) < 1e-9, 'congruent lattice cells');
  }
  if (template === 'radial') { const N = p.patch.boundaryIds.length; const valence = [...p.vertexCells.values()].filter((l) => l.length === N / 2 && l.every((id) => patchSet.has(id))); assert.equal(valence.length, 1, 'one radial centre of valence N/2'); }
}
for (const t of PATCH_TEMPLATES) assert.equal(stats[t].ok, 16, t);
// migrating a populated World onto a courtyard patch: hole cells are copied (not resampled)
{
  const g = buildQuadGrid({ radius: 10, hexSize: 1, seed: 3 }), w = new World(g); generateTerrain(w, { seed: 3 });
  const p = fitTemplatePatch(g, { template: 'courtyard', radius: 3, holeRadius: 1.3 }), m = migrateWorldToPatch(w, p, World);
  for (const id of p.patch.holeCellIds) assert.equal(m.world.solid[id], w.solid[p.sourceCellOf[id]]);
  assert.equal(m.resampled, p.patch.cellIds.length);
}
// several gems with different templates on one grid; overlap / bad input rejected
{
  const g = buildQuadGrid({ radius: 12, hexSize: 1, seed: 5 });
  let multi = null; for (const r of [2.6, 2.4, 2.8, 2.2]) { try { multi = insertRadialPatches(g, [{ template: 'block', x: -4.5, z: 0, radius: r, rings: 1 }, { template: 'courtyard', x: 4.5, z: 1, radius: r + .3, holeRadius: 1.1, rings: 1 }]); break; } catch (e) { assert.ok(e instanceof RangeError); } }
  assert.ok(multi, 'two templated gems fit'); assert.equal(multi.patches.length, 2); assert.equal(selfCheck(multi, new World(multi)).mismatched, 0);
  assert.throws(() => insertRadialPatches(g, [{ template: 'block', radius: 3 }, { template: 'radial', x: 1, radius: 3 }]), RangeError);
  assert.throws(() => insertTemplatePatch(g, { template: 'nope' }), RangeError);
  assert.throws(() => insertTemplatePatch(g, { template: 'courtyard', radius: 2, holeRadius: 2.5 }), RangeError);
  assert.throws(() => insertTemplatePatch(g, { template: 'block', radius: 30 }), RangeError, 'reaching the grid boundary is refused');
}
console.log('PASS gridpatch templates + holed boundary:', JSON.stringify(stats));
