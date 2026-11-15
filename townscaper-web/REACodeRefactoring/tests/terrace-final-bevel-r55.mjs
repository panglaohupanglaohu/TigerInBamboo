// r55 G4 · src/islandpasses.js (1669315384619540487: contour pass / wire pass / final render share one set of edges):
// final-bevel consistency. core/terrace-edges.js finalSegments places every step/shore segment on the rim the
// terrain mesh actually draws (cage slice + soft-top corner heights); checked against the recorded top fans
// for 3 smoothing modes × soft tops on/off × both grids, plus the TerraceEdgeOverlay positions.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { terraceEdges, finalSegments, traceTerraceRings } = await import('../src/core/terrace-edges.js');
const { softCorners } = await import('../src/terrain/soft-tops.js');
const { TerraceEdgeOverlay } = await import('../src/world/terrace-edges.js');
const L = 0.5, GRIDS = { quad: () => buildQuadGrid({ radius: 14, hexSize: 1 }), mixed: () => buildMixedGrid({ radius: 22, hexSize: 0.62 }) };
const summary = {};
for (const kind of ['quad', 'mixed']) {
  const w = new World(decorateCells(GRIDS[kind]()));
  generateTerrain(w, { seed: 7, softSlopes: true });
  const rings = traceTerraceRings(w); assert.equal(rings.closed, rings.rings, 'contour rings closed (r53)');
  for (const mode of ['hierarchical', 'dumb', 'none']) for (const soft of [false, true]) {
    const shape = shapeTerrain(w, { mode });
    w.softTops = soft; w.terrainCollide = true; buildTerrain(new MeshWriter(), w, { L, shape });
    const top = new Map(); for (const t of w.terrainSurface.tops) top.set(t.cell * 64 + t.edge, t);
    const sc = soft ? softCorners(w, { L }) : null;
    const E = terraceEdges(w);
    for (const pass of ['steps', 'shore']) {
      const fin = finalSegments(w, E[pass], { at: (p, s) => shape.at(p, s), L, soft: sc });
      let checked = 0, maxErr = 0;
      for (const g of fin.segments) {
        const c = w.cells[g.s.cell]; if (w.river[c.id] || w.isSolid(c, w.ground(c) + 1)) continue;   // river caps sit 0.06 lower by design
        const t = top.get(g.s.cell * 64 + g.s.edge); assert.ok(t, 'a drawn top exists for every step');
        const A = t.t[1], B = t.t[2];
        maxErr = Math.max(maxErr, ...[0, 1, 2].map((i) => Math.abs(A[i] - g.a[i])), ...[0, 1, 2].map((i) => Math.abs(B[i] - g.b[i])));
        checked++;
      }
      assert.ok(checked > 50 && maxErr < 1e-9, `${kind}/${mode}/${soft}/${pass}: line pass sits on the final bevelled rim (max ${maxErr})`);
      if (!soft) assert.equal(fin.seamless.length, 0);
      // seamless steps really have no wall in the mesh
      for (const s of fin.seamless) assert.ok(!w.terrainSurface.walls.some((q) => q.cell === s.cell && q.edge === s.edge));
      summary[`${kind}/${mode}/${soft ? 'soft' : 'plain'}/${pass}`] = { segments: fin.segments.length, seamless: fin.seamless.length, checked, maxErr };
    }
  }
  // the overlay used by the View draws exactly these positions (+0.025 lift)
  const shape = shapeTerrain(w, {});
  w.softTops = true;
  const view = { town: w, levelHeight: L, worldMesh: { shape } };
  const ov = new TerraceEdgeOverlay(view); ov.setMode('steps');
  const pos = ov.lines.geometry.getAttribute('position').array, fin = finalSegments(w, terraceEdges(w).steps, { at: (p, s) => shape.at(p, s), L, soft: softCorners(w, { L }) });
  assert.equal(pos.length, fin.segments.length * 6);
  for (let i = 0; i < fin.segments.length; i++) { const g = fin.segments[i]; assert.ok(Math.abs(pos[i * 6 + 1] - (g.a[1] + 0.025)) < 1e-5 && Math.abs(pos[i * 6] - g.a[0]) < 1e-5); }
  w.softTops = false; ov.refresh();
  assert.equal(ov.lines.geometry.getAttribute('position').array.length, terraceEdges(w).steps.length * 6, 'soft off: every step drawn, as before');
}
console.log('terrace-final-bevel-r55 PASS', JSON.stringify(summary));
