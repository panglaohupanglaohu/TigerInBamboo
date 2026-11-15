// r55 G5 sphere group: engine/sphere.js stage timeline, spheretown multi-cell constraint conflict
// (component-similarity solver + conflict metric), spherehouse multi-storey houses, spherefusion
// World bookkeeping, engine/worldmap.js texture colours + direction lookup. Browser: planet.html
// (?stages=1 / ?stageT=x, ?solver=shape, ?fusion=1&floors=mixed&focus=1, ?map=1, ?stage=maptest).
import assert from 'node:assert/strict';
import { buildSphere, buildPlanet, cornerPositions, relaxConflictReport, moduleSizeReport } from '../src/sphere/planet.js';
import * as T from '../src/sphere/planet-town.js';
import * as M from '../src/sphere/worldmap.js';
import { prepareStages, sphereStageFrame, STAGES } from '../src/sphere/sphere-stages.js';

// ---- 1. stage timeline from real snapshots (history does not change the sphere) --------------
const plain = buildSphere({ n: 400, seed: 5, spacing: 12, relax: 10 }), hist = buildSphere({ n: 400, seed: 5, spacing: 12, relax: 10, history: true });
assert.deepEqual(hist.pts, plain.pts); assert.deepEqual(hist.tris, plain.tris);
assert.equal(hist.steps.spacingFrames.length, 12); assert.equal(hist.steps.relaxFrames.length, 10);
assert.deepEqual(hist.steps.spacingFrames.at(-1), hist.steps.spaced); assert.deepEqual(hist.steps.relaxFrames.at(-1), hist.steps.relaxed);
assert.throws(() => prepareStages(plain));
const prep = prepareStages(hist);
let last = -1;
for (let t = 1; t < 2; t += .05) { const f = sphereStageFrame(hist, prep, t); assert.equal(f.stage, 'triangulate'); assert.ok(f.tris.length >= last); last = f.tris.length; }
assert.equal(sphereStageFrame(hist, prep, 1).tris.length, 0); assert.equal(sphereStageFrame(hist, prep, 1.999).tris.length >= hist.tris.length * .98, true);
// the reveal follows the radial insertion order of the stereographic plane (pole faces last)
const pole = hist.steps.projection.pole, firstPole = prep.reveal.findIndex((i) => hist.tris[i].includes(pole));
assert.ok(hist.tris.filter((t) => t.includes(pole)).length && prep.reveal.slice(firstPole).every((i) => hist.tris[i].includes(pole)), 'pole fan closes the sphere last');
assert.equal(sphereStageFrame(hist, prep, .0).points, hist.steps.random);
assert.notDeepEqual(sphereStageFrame(hist, prep, .5).points, hist.steps.random);
const rep0 = sphereStageFrame(hist, prep, 3.2), rep1 = sphereStageFrame(hist, prep, 3.8);
assert.equal(rep0.red.length > 0, prep.bad.length > 0);
assert.equal(T.sphericalDelaunayViolations(hist.pts, rep1.tris).length, 0, 'repair stage ends Delaunay');
const has = (tris, [a, b]) => tris.some((t) => t.includes(a) && t.includes(b));
for (const e of rep0.red) assert.ok(!has(rep1.tris, e), 'red edge was flipped away');
for (const e of rep1.green) assert.ok(has(rep1.tris, e) && !has(hist.tris, e), 'green edge is new');
assert.equal(sphereStageFrame(hist, prep, 5).stage, 'planet'); assert.equal(STAGES.length, 5);
// the 900-point page sphere really has violations to show
const big = buildSphere({ history: true }), bigPrep = prepareStages(big);
assert.ok(bigPrep.bad.length > 0 && bigPrep.fixed.flips > 0 && bigPrep.newEdges.length === bigPrep.fixed.flips);

// ---- 2. multi-cell constraint conflict ---------------------------------------------------------
const planet = buildPlanet(big);
const spring = cornerPositions(planet), shape = cornerPositions(planet, { solver: 'shape' });
assert.deepEqual(cornerPositions(planet, { solver: 'spring' })(5, 3), spring(5, 3), 'spring stays the default');
const cs = relaxConflictReport(planet, spring), cz = relaxConflictReport(planet, shape), co = relaxConflictReport(planet, cornerPositions(planet, { relax: false }));
console.log('conflict', Object.fromEntries(['spring', 'shape', 'off'].map((k, i) => [k, [cs, cz, co][i]]).map(([k, r]) => [k, { dis: +r.disagreeMean.toFixed(3), disMax: +r.disagreeMax.toFixed(3), shape: +r.shapeErrMean.toFixed(4), size: +r.sizeErrMean.toFixed(3), lean: +r.leanMaxDeg.toFixed(1), unresolved: r.unresolved, capped: r.capped }])));
assert.ok(cs.disagreeMean > 5 * cz.disagreeMean && cs.disagreeMax > 5 * cz.disagreeMax, 'shared corners agree under the component solver');
assert.ok(cz.disagreeMean <= co.disagreeMean + 1e-3, 'no more disagreement than the un-relaxed (pure radial) grid');
assert.ok(cz.shapeErrMean < .005 && cz.shapeErrMax < .05, 'every module cell keeps its shape');
assert.ok(cz.leanMaxDeg <= 30 + 1e-6 && cs.leanMaxDeg > 40, 'wall lean capped (spring leans 44°)');
assert.ok(cz.sizeErrMean < co.sizeErrMean, 'still less mushrooming than no relax');
assert.equal(cz.folded, 0); assert.equal(cs.folded, 0);
for (let l = 0; l <= 6; l++) for (let k = 0; k < planet.corners.length; k += 37) assert.ok(Math.abs(Math.hypot(...shape(k, l)) - (planet.R + l * planet.L)) < 1e-9);
// a lone module cell: no conflict at all → exact desired size (the conflict only exists between neighbours)
const id = planet.H.indexOf(Math.max(...planet.H)), one = cornerPositions(planet, { solver: 'shape', moduleCells: [id], maxLean: 89 });
const r1 = relaxConflictReport(planet, one, { moduleCells: [id] }), s1 = relaxConflictReport(planet, cornerPositions(planet, { moduleCells: [id] }), { moduleCells: [id] });
assert.ok(r1.sizeErrMax < .001 && s1.sizeErrMax < .001, 'no neighbour → no conflict: both solvers reach the exact size');
// the lean cap is the priority: tighter cap → less lean, more size error
const tight = relaxConflictReport(planet, cornerPositions(planet, { solver: 'shape', maxLean: 15 }));
assert.ok(tight.leanMaxDeg <= 15 + 1e-6 && tight.sizeErrMean >= cz.sizeErrMean - 1e-9);
assert.throws(() => cornerPositions(planet, { solver: 'x' })); assert.throws(() => cornerPositions(planet, { solver: 'shape', maxLean: 90 }));
assert.ok(moduleSizeReport(planet, shape).maxEdgeError < moduleSizeReport(planet, spring).maxEdgeError, 'worst edge error also drops');

// ---- 3. multi-storey houses --------------------------------------------------------------------
const mod = T.storeyHouseModule(6, 3);
assert.ok(mod.every((t) => t.v.every(([u, v, h]) => Math.hypot(u, v) <= 1 + 1e-9 && h >= 0 && h <= 3.45 + 1e-9)));
assert.deepEqual([...new Set(mod.map((t) => t.part))].sort(), ['door', 'plinth', 'roof', 'trim', 'wall', 'window']);
assert.throws(() => T.storeyHouseModule(6, 0));
for (const solver of ['spring', 'shape']) {
  const world = T.planetWorld(planet); T.planetRivers(world, { threshold: 8 });
  const f = T.planetFusion(world, planet, { density: .8, seed: 5, floors: 'mixed', maxFloors: 3, solver });
  const { placed, position, part, house, at } = f.houses;
  assert.ok(placed.length > 5 && new Set(placed.map((p) => p.floors)).size >= 2, 'mixed storeys');
  let bits = 0; for (const c of world.cells) bits += world.top(c) - world.ground(c);
  assert.equal(bits, placed.reduce((s, p) => s + p.floors, 0), 'BUILT bits = storeys (spherefusion World)');
  for (const p of placed) assert.ok(world.topIsBuilt(world.cells[p.cell]) && world.top(world.cells[p.cell]) === p.ground + p.floors);
  assert.equal(house.length, part.length); assert.equal(position.length, part.length * 9);
  // each vertex lies in its house's radial range; storeys stack without gaps
  for (let t = 0; t < part.length; t++) {
    const p = placed[house[t]];
    for (let k = 0; k < 3; k++) { const r = Math.hypot(...position.slice((t * 3 + k) * 3, (t * 3 + k) * 3 + 3)); assert.ok(r >= (planet.R + p.ground * planet.L) * .98 && r <= planet.R + (p.top + .45) * planet.L + 1e-6); }
  }
  const tall = placed.find((p) => p.floors === 3) ?? placed.reduce((b, p) => p.floors > b.floors ? p : b), c = world.cells[tall.cell];
  for (let fl = 0; fl + 1 < tall.floors; fl++) for (const uv of [[.5, .2], [-.3, .4], [0, 0]]) {
    const a = T.deformIntoCell(at, c, tall.ground + fl, tall.ground + fl + 1, [...uv, 1]), b = T.deformIntoCell(at, c, tall.ground + fl + 1, tall.ground + fl + 2, [...uv, 0]);
    assert.ok(Math.hypot(...a.map((x, i) => x - b[i])) < 1e-12, 'storey seams coincide');
  }
  // upper storeys follow their own level's relaxed corners: ring area shrinks relative to radial growth
  const ringArea = (l) => { const ring = c.ring.map((q) => at(q, l)); let s = 0; for (let i = 1; i + 1 < ring.length; i++) { const u = ring[i].map((v, k) => v - ring[0][k]), w = ring[i + 1].map((v, k) => v - ring[0][k]); s += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2; } return s; };
  const radial = ((planet.R + tall.top * planet.L) / (planet.R + tall.ground * planet.L)) ** 2;
  assert.ok(ringArea(tall.top) / ringArea(tall.ground) < radial, solver + ': top storey tapers vs pure radial');
}

// ---- 4. world map texture ----------------------------------------------------------------------
const map = M.buildWorldMap({ w: 256, h: 128, seed: 7 }), col = M.worldMapColors(map);
for (const r of ['sea', 'sand', 'grass', 'slope', 'coast']) assert.ok(col.roles[r] > map.w * map.h * .005, 'role ' + r + ' present');
assert.equal(col.rgba.length, map.w * map.h * 4);
let seam = 0; for (let j = 0; j < map.h; j++) for (let c2 = 0; c2 < 3; c2++) seam += Math.abs(col.rgba[(j * map.w) * 4 + c2] - col.rgba[(j * map.w + map.w - 1) * 4 + c2]);
let inner = 0; for (let j = 0; j < map.h; j++) for (let c2 = 0; c2 < 3; c2++) inner += Math.abs(col.rgba[(j * map.w + 100) * 4 + c2] - col.rgba[(j * map.w + 101) * 4 + c2]);
assert.ok(seam <= inner * 1.6 + 50, 'no lon seam (' + seam + ' vs ' + inner + ')');
// direction → texel agrees with the GLSL formula and with the tile heights from the same field
const glsl = ([x, y, z]) => { let lon = Math.atan2(z, x); if (lon < 0) lon += Math.PI * 2; const u = lon / (Math.PI * 2), v = 1 - (.5 + Math.asin(y) / Math.PI); return Math.min(map.h - 1, Math.floor(v * map.h)) * map.w + Math.min(map.w - 1, Math.floor(u * map.w)); };
const H3 = M.planetHeights3D(planet, { seed: 7 });
let agree = 0;
for (const c of planet.cells) { const k = M.worldMapTexel(map, c.c); assert.equal(glsl(c.c), k); agree += (map.land[k] === 1) === (H3[c.id] > 0) ? 1 : 0; }
assert.ok(agree / planet.cells.length > .95, 'texture land/sea matches tile heights ' + (agree / planet.cells.length).toFixed(3));
assert.ok(M.WORLDMAP_GLSL.includes('worldMapUV'));
console.log('PASS r55 sphere: stages', { faces: hist.tris.length, bad: bigPrep.bad.length, flips: bigPrep.fixed.flips }, 'map agree', (agree / planet.cells.length).toFixed(3), 'roles', col.roles);
