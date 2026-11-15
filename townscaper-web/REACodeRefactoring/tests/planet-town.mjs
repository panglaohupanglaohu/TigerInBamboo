// r53 G4: REACode engine/sphere.js + spherehouse.js + spheretown.js + spherefusion.js + engine/worldmap.js
// on the refactored planet: stereo round trip, spherical Delaunay check/flip repair after relax,
// planet as a shared World (rivers, houses as BUILT bits), houses deformed into relaxed prisms,
// 3D-noise sea/land without pole streaks, 1px coast, sand shore / dark slope roles.
import assert from 'node:assert/strict';
import { buildSphere, buildPlanet, cornerPositions, sphereTopologyReport } from '../src/sphere/planet.js';
import * as T from '../src/sphere/planet-town.js';
import * as M from '../src/sphere/worldmap.js';

const sphere = buildSphere({ n: 900, seed: 3, spacing: 25, relax: 20 });
// 1. stereographic projection round trip (same convention as buildSphere: pole +Y)
let rt = 0; for (const p of sphere.pts) if (1 - p[1] > 1e-3) rt = Math.max(rt, Math.hypot(...T.stereoUnproject(T.stereoProject(p)).map((v, i) => v - p[i])));
assert.ok(rt < 1e-12, 'project/unproject round trip ' + rt);
assert.throws(() => T.stereoProject([0, 1, 0]));
// 2. spherical Delaunay: relaxed points break it; flips repair, topology stays closed
// relax moves points after triangulation; the kept faces may stop being Delaunay
const relaxedBad = T.sphericalDelaunayViolations(sphere.pts, sphere.tris).length;
const relaxedFix = T.flipToDelaunay(sphere.pts, sphere.tris);
assert.equal(T.sphericalDelaunayViolations(sphere.pts, relaxedFix.tris).length, 0, 'flips repair the relaxed sphere');
// dynamic re-triangulation: move points (as a later relax/edit would) keeping old faces
let s = 9; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - .5);
const moved = sphere.pts.map((p) => { const q = p.map((v) => v + rnd() * .035); const l = Math.hypot(...q); return q.map((v) => v / l); });
assert.equal(sphereTopologyReport(moved, sphere.tris).inwardFaces, 0, 'perturbation keeps a valid embedding (no fold-over)');
const before = T.sphericalDelaunayViolations(moved, sphere.tris);
assert.ok(before.length > 0, 'perturbation breaks the Delaunay property');
const fixed = T.flipToDelaunay(moved, sphere.tris);
const after = T.sphericalDelaunayViolations(moved, fixed.tris);
assert.equal(after.length, 0, 'flips restore empty circumcircles');
const topo = sphereTopologyReport(moved, fixed.tris);
assert.ok(topo.closed && topo.euler === 2 && topo.inwardFaces === 0 && topo.duplicateFaces === 0 && topo.nonManifoldEdges === 0, JSON.stringify(topo));
const q0 = T.sphereQuality(moved, sphere.tris), q1 = T.sphereQuality(moved, fixed.tris);
assert.ok(q1.minAngle >= q0.minAngle - 1e-9, 'Delaunay flips never reduce the minimum angle');
assert.equal(q1.edges, 3 * sphere.pts.length - 6, 'Euler edge count');
console.log('PASS sphere Delaunay', { relaxedViolations: relaxedBad, relaxedFlips: relaxedFix.flips, violationsBefore: before.length, flips: fixed.flips, minAngle: [q0.minAngle.toFixed(1), q1.minAngle.toFixed(1)], valence: q1.valence });

// 3. 3D-noise heights + world map: poles not streaked; 2D uv sampling is
const m3 = M.buildWorldMap({ w: 192, h: 96, seed: 7 }), m2 = M.buildWorldMap({ w: 192, h: 96, seed: 7, mode: 'uv' });
const s3 = M.poleStretch(m3), s2 = M.poleStretch(m2);
assert.ok(s3.pole < s2.pole, `3D pole aspect ${s3.pole.toFixed(2)} < uv ${s2.pole.toFixed(2)}`);
assert.ok(m3.stats.landPct > 10 && m3.stats.landPct < 90);
for (let k = 0; k < m3.coast.length; k++) if (m3.coast[k]) { const i = k % 192, j = (k / 192) | 0; assert.ok(m3.land[k] !== m3.land[j * 192 + (i + 1) % 192] || (j + 1 < 96 && m3.land[k] !== m3.land[(j + 1) * 192 + i]), 'coast is exactly the threshold boundary'); }
const planet = buildPlanet(sphere, { R: 4, L: .32 });
const H = M.planetHeights3D(planet, { seed: 7, seaLevel: .47 });
assert.ok(H.some((h) => h === 0) && H.some((h) => h === 1) && H.some((h) => h >= 4), 'sea, shore and terraces');

// 4. planet as shared World + rivers draining to the sea
const world = T.planetWorld(planet, { heights: H });
assert.equal(world.cells.length, planet.cells.length);
assert.ok(world.cells.every((c) => c.edgeNeighbors.every((o) => o >= 0)), 'closed sphere: every edge has a neighbour');
const riv = T.planetRivers(world, { threshold: 5 });
assert.ok(riv.channels > 0, 'rivers carved ' + riv.channels);
for (const c of world.cells) if (world.ground(c) > 0) { let k = c.id, steps = 0; while (world.ground(world.cells[k]) > 0 && steps++ < 2000) { const d = riv.down[k]; assert.ok(d >= 0 && riv.level[d] < riv.level[k], 'strict descent of the filled level'); k = d; } assert.equal(world.ground(world.cells[k]), 0, 'every land cell drains to the sea'); }
for (const c of world.cells) if (world.river[c.id] && !riv.lake[c.id]) assert.ok(riv.area[c.id] >= 5);
let maxArea = 0; for (const c of world.cells) if (world.ground(c) > 0) maxArea = Math.max(maxArea, riv.area[c.id]);
assert.ok(maxArea > 8, 'tributaries accumulate (not one-cell rivers) ' + maxArea);
const roles = new Set(world.cells.map((c) => M.planetSurfaceColor(world, c).role));
assert.ok(['sea', 'sand', 'grass'].every((r) => roles.has(r)), [...roles].join());

// 5. fusion: houses are BUILT bits on flat dry cells, deformed into the same relaxed corners
const fusion = T.planetFusion(world, planet, { seed: 5, density: .9, floors: 1 });
const { placed, position, part, at } = fusion.houses;
assert.ok(placed.length > 3, 'houses placed ' + placed.length);
for (const p of placed) {
  const c = world.cells[p.cell];
  assert.ok(world.topIsBuilt(c) && world.ground(c) === p.ground && world.top(c) === p.top && !world.river[c.id]);
  assert.ok(c.edgeNeighbors.every((o) => world.ground(world.cells[o]) === p.ground), 'flat only');
}
assert.ok(world.regions().regions.length > 0, 'World building regions see planet houses');
// every wall/roof vertex: radius within [R+g·L, R+(top)·L + roof]; inside the cell's angular footprint
let vi = 0;
const R = planet.R, L = planet.L;
for (const [ti, p] of part.entries()) void ti, void p;
let houseIdx = 0, triInHouse = 0;
for (let t = 0; t < part.length; t++) {
  const pl = placed[fusion.houses.house[t]], c = world.cells[pl.cell], dir = planet.cells[pl.cell].c;   // r55: module has storeys/openings → per-triangle house index
  for (let k = 0; k < 3; k++, vi++) {
    const v = position.slice(vi * 3, vi * 3 + 3), r = Math.hypot(...v);
    assert.ok(r >= (R + pl.ground * L) * .98 && r <= R + pl.top * L + L + 1e-6, 'vertex inside the prism height range (chord sag only)');
    const cosToCentre = (v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / r;
    const cornerCos = Math.min(...c.ring.map((q) => { const a = at(q, pl.ground); return (a[0] * dir[0] + a[1] * dir[1] + a[2] * dir[2]) / Math.hypot(...a); }));
    assert.ok(cosToCentre >= cornerCos - 1e-9, 'vertex within the cell footprint cone');
  }
  void triInHouse; houseIdx = Math.max(houseIdx, fusion.houses.house[t] + 1);
}
assert.equal(houseIdx, placed.length);
// walls follow the radial direction (planet up), roofs face outward
vi = 0; let walls = 0, outward = 0;
for (let t = 0; t < part.length; t++) {
  const a = position.slice(vi * 9, vi * 9 + 3), b = position.slice(vi * 9 + 3, vi * 9 + 6), c3 = position.slice(vi * 9 + 6, vi * 9 + 9); vi++;
  if (part[t] === 'roof') { const n = [0, 1, 2].map((i) => ((b[(i + 1) % 3] - a[(i + 1) % 3]) * (c3[(i + 2) % 3] - a[(i + 2) % 3]) - (b[(i + 2) % 3] - a[(i + 2) % 3]) * (c3[(i + 1) % 3] - a[(i + 1) % 3]))); const ctr = [0, 1, 2].map((i) => (a[i] + b[i] + c3[i]) / 3); if (n[0] * ctr[0] + n[1] * ctr[1] + n[2] * ctr[2] > 0) outward++; }
  else walls++;
}
assert.ok(outward >= (part.length - walls) * .99, 'roof triangles face away from the planet');
// relaxed corners: the top ring of a house matches the terrain corners it is spliced into
const ex = placed[0], ring0 = world.cells[ex.cell].ring.map((q) => at(q, ex.ground));
const foot = T.deformIntoCell(at, world.cells[ex.cell], ex.ground, ex.top, [Math.cos(0), Math.sin(0), 0]);
assert.ok(Math.hypot(...foot.map((v, i) => v - ring0[0][i])) < 1e-9, 'module corner (u=1) lands exactly on the relaxed terrain corner');
assert.ok(fusion.terrain.position.length > 0 && fusion.terrain.position.length % 9 === 0);
assert.throws(() => T.deformIntoCell(at, world.cells[ex.cell], ex.ground, ex.top, [2, 0, 0]));
// relax vs no relax: house top rings are smaller when relaxed (anti-mushrooming applies to houses too)
const area = (atf, p) => { const ring = world.cells[p.cell].ring.map((q) => atf(q, p.top)); let s = 0; for (let i = 1; i + 1 < ring.length; i++) { const u = ring[i].map((v, k) => v - ring[0][k]), w = ring[i + 1].map((v, k) => v - ring[0][k]); s += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2; } return s; };
const raw = cornerPositions({ ...planet, H: world.cells.map((c) => world.top(c)) }, { relax: false });
const tall = placed.reduce((b, p) => p.top > b.top ? p : b);
assert.ok(area(at, tall) < area(raw, tall), 'relaxed house top smaller than radial (mushroomed) top');
console.log('PASS planet town', { cells: world.cells.length, rivers: riv.channels, houses: placed.length, roles: [...roles], poleAspect: [s3.pole.toFixed(2), s2.pole.toFixed(2)] });
