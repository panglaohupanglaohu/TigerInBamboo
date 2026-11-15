// r55 piercefloor (802496920790777856, REACode/piercefloor): lintel geometry over every opening within
// the slab budget, and clearance under the drawn arch — archSoffitAt matches the captured soffit
// triangles, archPassage / archPassableWidth agree with a brute-force geometric check.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { archSoffitAt, archPassage, archPassableWidth } = await import('../src/core/arch-floor-budget.js');
const { roofHeightAt } = await import('../src/core/house-kit.js');
const { DOWN } = await import('../src/core/meshwriter.js');
function buildCapture(w, flags = {}) {
  const old = {}; for (const [k, v] of Object.entries(flags)) { old[k] = w[k]; w[k] = v; }
  const m = new F.MeshWriter(), soffit = [], q = m.quad.bind(m);
  m.quad = (a, b, c, d, dir, ...rest) => { if (dir && dir !== DOWN && dir[0] === 0 && dir[1] === -1 && dir[2] === 0) soffit.push([a, b, c], [a, c, d]); return q(a, b, c, d, dir, ...rest); };
  const r = F.buildBuildings(m, w, { L: F.L }); for (const k of Object.keys(flags)) w[k] = old[k];
  return { r, soffit, verts: m.pos.length / 3 };
}
// synthetic bridges: a floating voxel between two towers, floor on the ground or on a 1-level plinth
const worlds = [];
for (const kind of ['quad', 'mixed']) for (const plinth of [0, 1]) for (const top of [3, 4]) {
  const w = new F.World(F.grid(kind)); w.palette = F.PALETTES.town;
  const c = w.cells.filter(x => x.n === 4 && Math.hypot(x.cx, x.cz) < 4).sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz))[0];
  const A = w.cells[c.edgeNeighbors[0]], B = w.cells[c.edgeNeighbors[2]];
  w.fill(A, top); w.fill(B, top); if (plinth) w.fill(c, 1); w.setSolid(c, top, true); w.color[c.id] = 2;
  worlds.push({ w, tag: `${kind}/plinth${plinth}/top${top}` });
}
for (const [scene, seed] of [['town', 7], ['fusion', 7], ['town', 11]]) for (const kind of ['quad', 'mixed']) worlds.push({ w: F.world(kind, scene, seed), tag: `${kind}/${scene}${seed}` });
let arches = 0, samples = 0, passChecks = 0, lintelCount = 0;
const kinds = new Set();
for (const { w, tag } of worlds) {
  const off = buildCapture(w), off2 = buildCapture(w, { lintels: false }), on = buildCapture(w, { lintels: true });
  assert.equal(off.verts, off2.verts, 'lintels flag off = old geometry'); assert.equal(off.r.lintels.length, 0);
  for (const l of on.r.lintels) {
    kinds.add(l.kind); lintelCount++;
    assert.ok(l.thickness > 0 && l.thickness <= l.slab + 1e-12, 'lintel within the slab budget');
    if (l.kind !== 'arch') assert.ok(l.y1 <= l.storeyTop - l.slab + 1e-12, 'lintel stays below the next storey slab');
    else assert.ok(Math.abs(l.y1 - l.storeyTop) < 1e-12 && Math.abs(l.thickness - l.slab) < 1e-12, 'arch lintel = the slab band');
  }
  for (const rec of off.r.archBudgets) {
    arches++;
    const [A0, A1, B1, B0] = rec.quad, P = (u, v) => { const x0 = A0[0] + (B0[0] - A0[0]) * u, z0 = A0[1] + (B0[1] - A0[1]) * u, x1 = A1[0] + (B1[0] - A1[0]) * u, z1 = A1[1] + (B1[1] - A1[1]) * u; return [x0 + (x1 - x0) * v, z0 + (z1 - z0) * v]; };
    const mine = off.soffit.filter(t => t.every(p => p[1] >= rec.floor - 1e-9 && p[1] <= rec.base + 1e-9) && t.some(p => Math.hypot(p[0] - P(.5, .5)[0], p[2] - P(.5, .5)[1]) < rec.span));
    assert.ok(mine.length >= rec.segments * 2, tag + ' soffit captured');
    const geom = (u, v = .5) => { const [x, z] = P(u, v); const ys = mine.map(t => roofHeightAt([t], x, z)).filter(y => y !== null); return ys.length ? Math.min(...ys) : null; };
    for (let k = 1; k < 50; k++) for (const v of [.1, .5, .9]) { const u = k / 50, g = geom(u, v); assert.ok(g !== null && Math.abs(g - archSoffitAt(rec, u, v)) < 1e-9, tag + ' soffit query = drawn geometry'); samples++; }
    assert.ok(Math.abs(archSoffitAt(rec, .5) - rec.crown) < 1e-9, 'crown height');
    // brute-force passage from geometry
    for (const h of [.05, .2, .3, .45, rec.crown - rec.floor - 1e-6, rec.crown - rec.floor + .01]) for (const radius of [0, .05, .1, .2]) {
      const u0 = .5 - radius / rec.span, u1 = .5 + radius / rec.span; let low = Infinity;
      if (u0 >= 0 && u1 <= 1) for (let k = 0; k <= 120; k++) for (let j = 0; j <= 20; j++) { const g = geom(u0 + (u1 - u0) * k / 120, j / 20); if (g !== null) low = Math.min(low, g); }
      const got = archPassage(rec, { height: h, radius });
      if (u0 < 0 || u1 > 1) { assert.equal(got.ok, false); continue; }
      // exact minimum ≤ any sampled height, and the dense sampling gets within 2 mm of it
      assert.ok(got.headroom <= low - rec.floor + 1e-9 && low - rec.floor - got.headroom < 2e-3, `${tag} headroom exact vs sampled`);
      if (Math.abs(low - rec.floor - h) > 2e-3) assert.equal(got.ok, low - rec.floor >= h, `${tag} passage h=${h} r=${radius}`);
      passChecks++;
    }
    let prev = Infinity; for (const h of [.05, .15, .25, .35, .45, .6]) { const wd = archPassableWidth(rec, h); assert.ok(wd <= prev + 1e-12); prev = wd; if (wd > 0) { const ok = archPassage(rec, { height: h, radius: Math.max(0, wd / 2 - 1e-6) }).ok, bad = archPassage(rec, { height: h, radius: wd / 2 + 1e-4 }).ok; assert.ok(ok && !bad, 'passable width is tight'); } }
    assert.ok(!archPassage(rec, { height: rec.crown - rec.floor + .01 }).ok && archPassage(rec, { height: (rec.crown - rec.floor) * .5 }).ok);
  }
}
// nav hook (opt-in): walking under the arch only when the unit clears the drawn soffit
{
  const { buildNav, findNavPath } = await import('../src/world/navgraph.js');
  for (const kind of ['quad', 'mixed']) {
    const w = new F.World(F.grid(kind)); w.palette = F.PALETTES.town;
    const c = w.cells.filter(x => x.n === 4 && Math.hypot(x.cx, x.cz) < 4).sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz))[0];
    const A = w.cells[c.edgeNeighbors[0]], B = w.cells[c.edgeNeighbors[2]], D = w.cells[c.edgeNeighbors[1]], E = w.cells[c.edgeNeighbors[3]];
    w.fill(A, 4); w.fill(B, 4); w.fill(c, 1); w.fill(D, 1); w.fill(E, 1); w.setSolid(c, 4, true);
    const r = buildCapture(w).r, rec = r.archBudgets.find(a => a.cell === c.id); assert.ok(rec && rec.floorLevel === 1);
    const head = rec.crown - rec.floor, def = buildNav(w), lowU = buildNav(w, { underArches: { archBudgets: r.archBudgets, height: head * .6, radius: .05 } }), tall = buildNav(w, { underArches: { archBudgets: r.archBudgets, height: head + .02, radius: .05 } });
    assert.equal(def.walk[c.id], 0, 'default nav unchanged: no walking under arches'); assert.deepEqual(def.underArches, []);
    assert.equal(lowU.walk[c.id], 1); assert.equal(lowU.hgt[c.id], 1); assert.equal(tall.walk[c.id], 0);
    const pl = findNavPath(w, lowU, D, E), pt = findNavPath(w, tall, D, E);
    assert.ok(pl.path.length === 3 && (pl.path[1]?.id ?? pl.path[1]) === c.id, 'short unit walks under the arch'); assert.equal(pt.path.length, 0, 'tall unit is blocked by the soffit');
  }
}
assert.ok(arches >= 8 && samples > 300 && passChecks > 150 && lintelCount > 300 && ['window', 'door', 'arch'].every(k => kinds.has(k)));
console.log('PASS lintels + arch clearance', { arches, samples, passChecks, lintelCount, kinds: [...kinds] });
