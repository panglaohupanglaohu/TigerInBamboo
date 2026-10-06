// CPU ONLY. No browser, scene mutation, live route edits or hidden-rail fallback.
import * as T from 'three';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { buildTargetTerrainHeightfield } from '../../src/world/citadel/targetTerrainHeightfield.js';
import { targetTerrainHeight, TARGET_CITY_PLATFORMS } from '../../src/world/citadel/targetTerrainCandidate.js';
import { createTargetRailCliffField } from '../../src/world/citadel/targetRailCliffField.js';
import { createTargetNewCityRetreatField } from '../../src/world/citadel/targetNewCityRetreatField.js';
import { createCastleOceanSampler } from '../../src/world/citadel/newCityRidgeCandidate.js';
import { officialOceanLevelAt } from '../../src/world/waterV8/officialOcean.js';

const root = new URL('../../', import.meta.url), source = new URL('artifacts/pipeline/citadel-live-tram-clearance-20261006/', root);
const read = name => JSON.parse(fs.readFileSync(new URL(name, source)));
const actual = read('global-tram-samples.json'), frozen = read('actual-final-terrain.json');
const matrix = new T.Matrix4().fromArray(actual.castleMatrix), inverse = matrix.clone().invert();
const sea = createCastleOceanSampler(matrix, 160), cliff = createTargetRailCliffField({ ...actual, platforms: TARGET_CITY_PLATFORMS });
const retreat = createTargetNewCityRetreatField({ platforms: TARGET_CITY_PLATFORMS });
const latest = buildTargetTerrainHeightfield({ bounds: { minX: -143, maxX: 143, minZ: -72, maxZ: 107 }, step: 1.7,
  floorAt(x, z) { const s = sea(x, z); return s === null ? null : s - 12; },
  heightAt(x, z) { const s = sea(x, z); if (s === null) return null; const before = targetTerrainHeight(x, z, s, { aprons: true, saddle: true, valleyBenches: true }); return retreat.height(x, z, cliff.height(x, z, before, s), s); },
});
const oldGeometry = new T.BufferGeometry(); oldGeometry.setAttribute('position', new T.Float32BufferAttribute(frozen.positions, 3)); if (frozen.index) oldGeometry.setIndex(frozen.index);
oldGeometry.applyMatrix4(inverse.clone().multiply(new T.Matrix4().fromArray(frozen.matrixWorld)));

function buildIndex(geometry) {
  const p = geometry.attributes.position, ix = geometry.index, triangles = [];
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const points = [0, 1, 2].map(j => new T.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + j) : i + j));
    const triangle = new T.Triangle(...points), box = new T.Box3().setFromPoints(points).expandByScalar(1e-7);
    triangles.push({ triangle, box, center: box.getCenter(new T.Vector3()), face: i / 3 });
  }
  function tree(items) {
    const box = new T.Box3(); for (const item of items) box.union(item.box);
    if (items.length <= 12) return { box, items };
    const size = box.getSize(new T.Vector3()), axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
    items.sort((a, b) => a.center[axis] - b.center[axis]); const middle = items.length >> 1;
    return { box, left: tree(items.slice(0, middle)), right: tree(items.slice(middle)) };
  }
  const bvh = tree(triangles);
  function contact(body, pose) {
    const bound = body.clone().applyMatrix4(pose), inv = pose.clone().invert(), stack = [bvh];
    while (stack.length) {
      const node = stack.pop(); if (!node.box.intersectsBox(bound)) continue;
      if (!node.items) { stack.push(node.left, node.right); continue; }
      for (const item of node.items) if (item.box.intersectsBox(bound)) {
        const t = item.triangle.clone(); t.a.applyMatrix4(inv); t.b.applyMatrix4(inv); t.c.applyMatrix4(inv);
        if (body.intersectsTriangle(t)) return { face: item.face, localTriangle: [item.triangle.a.toArray(), item.triangle.b.toArray(), item.triangle.c.toArray()] };
      }
    }
    return null;
  }
  function inside(point) {
    if (!bvh.box.containsPoint(point)) return false;
    // Vertical parity uses both actual top AND floor. A missing radial top hit
    // is never reinterpreted as clear. Duplicate hits on shared edges collapse.
    const ray = new T.Ray(point, new T.Vector3(0, 1, 0)), stack = [bvh], distances = [], scratch = new T.Vector3();
    while (stack.length) {
      const node = stack.pop(); if (!ray.intersectsBox(node.box)) continue;
      if (!node.items) { stack.push(node.left, node.right); continue; }
      for (const item of node.items) {
        const t = item.triangle, hit = ray.intersectTriangle(t.a, t.b, t.c, false, scratch);
        if (hit) distances.push(hit.y - point.y);
      }
    }
    distances.sort((a, b) => a - b);
    const unique = distances.filter((d, i) => !i || Math.abs(d - distances[i - 1]) > 1e-5);
    return unique.some(d => Math.abs(d) < 1e-6) || unique.length % 2 === 1;
  }
  return { contact, inside, triangles: triangles.length };
}
console.log('Building CPU triangle trees for recorded terrain and current post-retreat factory mesh…');
const oldIndex = buildIndex(oldGeometry), latestIndex = buildIndex(latest.geometry);
const margins = { longitudinal: .5, lateral: .3, above: .3, below: .1 };
const windows = { east: [.61, .679], west: [.76, .872] }, laneResults = {};
for (const [lane, data] of Object.entries(actual.lanes)) {
  const body = new T.Box3(); for (const part of actual.bodyBounds[lane]) { body.expandByPoint(new T.Vector3(...part.min)); body.expandByPoint(new T.Vector3(...part.max)); }
  const inflated = body.clone(); inflated.min.sub(new T.Vector3(margins.longitudinal, margins.below, margins.lateral)); inflated.max.add(new T.Vector3(margins.longitudinal, margins.above, margins.lateral));
  const rows = [];
  for (const sample of data.samples) {
    if (!Object.values(windows).some(([a, b]) => sample.u >= a && sample.u <= b)) continue;
    const p = new T.Vector3(...sample.world), forward = new T.Vector3(...sample.tangent).multiplyScalar(actual.vehiclePlacement.directions[lane]), radial = p.clone().normalize();
    const right = radial.clone().cross(forward).normalize(), up = forward.clone().cross(right).normalize();
    const poseWorld = new T.Matrix4().makeBasis(right, up, forward).multiply(new T.Matrix4().makeRotationY(-Math.PI / 2));
    poseWorld.setPosition(p.clone().addScaledVector(up, actual.vehiclePlacement.bodyLift));
    const poseLocal = inverse.clone().multiply(poseWorld), middle = inflated.getCenter(new T.Vector3());
    const probes = [];
    for (const x of [inflated.min.x, middle.x, inflated.max.x]) for (const y of [inflated.min.y, middle.y, inflated.max.y]) for (const z of [inflated.min.z, middle.z, inflated.max.z]) probes.push(new T.Vector3(x, y, z).applyMatrix4(poseLocal));
    const audit = index => {
      const contact = index.contact(inflated, poseLocal), railBuried = index.inside(new T.Vector3(...sample.local));
      const interiorProbe = probes.find(probe => index.inside(probe));
      return { clear: !contact && !railBuried && !interiorProbe, railBuried, bodyEnvelopeTerrainContact: !!contact, bodyInteriorProbe: interiorProbe?.toArray() ?? null, contact };
    };
    const radialSlope = radial.dot(new T.Vector3(...sample.tangent));
    const waterGaps = probes.map(local => { const world = local.clone().applyMatrix4(matrix); return world.length() - 160 - officialOceanLevelAt(world.clone().normalize()); });
    rows.push({ ...sample, worldRadius: p.length(), signedRadialGrade: radialSlope / Math.sqrt(Math.max(1e-12, 1 - radialSlope * radialSlope)), inflatedBodyMinimumOceanGap: Math.min(...waterGaps), recordedTerrain: audit(oldIndex), currentFactoryTerrain: audit(latestIndex) });
  }
  laneResults[lane] = { length: data.length, sampleStep: data.arcStep, body: { min: body.min.toArray(), max: body.max.toArray() }, inflatedBody: { min: inflated.min.toArray(), max: inflated.max.toArray() }, rows };
  console.log(lane, 'audited', rows.length, 'clear current:', rows.filter(r => r.currentFactoryTerrain.clear).length);
}
function runs(rows, side) {
  const [min, max] = windows[side], result = []; let run = null;
  for (const row of rows.filter(r => r.u >= min && r.u <= max)) {
    if (!row.currentFactoryTerrain.clear) { run = null; continue; }
    if (!run || run.lastIndex + 1 !== row.i) { run = { firstIndex: row.i, lastIndex: row.i, startU: row.u, endU: row.u, count: 1 }; result.push(run); }
    else { run.lastIndex = row.i; run.endU = row.u; run.count++; }
  }
  return result;
}
const pairs = {};
for (const side of Object.keys(windows)) {
  const [start, end] = windows[side], red = laneResults.red.rows.filter(r => r.u >= start && r.u <= end), blue = laneResults.blue.rows.filter(r => r.u >= start && r.u <= end);
  const redMap = new Map(red.map(row => [row.i, row])), blueMap = new Map(blue.map(row => [row.i, row]));
  const collarRows = (row, map) => Array.from({ length: 13 }, (_, i) => map.get(row.i + i - 6));
  const hasCollar = (row, map) => collarRows(row, map).every(p => p?.currentFactoryTerrain.clear && p.inflatedBodyMinimumOceanGap > 0);
  const candidates = [];
  for (const r of red) {
    if (!r.currentFactoryTerrain.clear || !hasCollar(r, redMap)) continue;
    const p = new T.Vector3(...r.world), tangent = new T.Vector3(...r.tangent);
    // Match in WORLD distance and forward tangent within the same named branch,
    // not equal normalized progress and not castle XZ nearest neighbour.
    const b = blue.reduce((nearest, row) => {
      const distance = p.distanceTo(new T.Vector3(...row.world));
      return !nearest || distance < nearest.distance ? { row, distance } : nearest;
    }, null);
    if (!b || b.distance > 6 || !b.row.currentFactoryTerrain.clear || !hasCollar(b.row, blueMap)) continue;
    const angle = tangent.angleTo(new T.Vector3(...b.row.tangent)) * 180 / Math.PI;
    if (angle > 10) continue;
    candidates.push({ side, worldSeparation: b.distance, tangentAngleDegrees: angle, collar: { beforeSamples: 6, afterSamples: 6, approximateMetresEachSide: 6, minimumInflatedBodyOceanGap: Math.min(...[...collarRows(r, redMap), ...collarRows(b.row, blueMap)].map(p => p.inflatedBodyMinimumOceanGap)) }, red: r, blue: b.row });
  }
  const relevant = candidates.filter(p => side === 'east' ? p.red.local[0] >= 115 && p.red.local[0] <= 130 : p.red.u >= .79);
  relevant.sort((a, b) => a.red.i - b.red.i);
  const gradeCompatible = relevant.filter(p => Math.abs(p.red.signedRadialGrade) <= .04 && Math.abs(p.blue.signedRadialGrade) <= .04);
  const recommended = side === 'east'
    ? [...gradeCompatible].sort((a, b) => Math.max(Math.abs(a.red.signedRadialGrade), Math.abs(a.blue.signedRadialGrade)) - Math.max(Math.abs(b.red.signedRadialGrade), Math.abs(b.blue.signedRadialGrade)))[0]
    : gradeCompatible[0];
  const spaced = []; for (const pair of relevant) if (!spaced.length || pair.red.i - spaced.at(-1).red.i >= (side === 'east' ? 3 : 10)) spaced.push(pair);
  const stable = gradeCompatible.find(p => Math.abs(p.red.signedRadialGrade) <= .005 && Math.abs(p.blue.signedRadialGrade) <= .005 && p.collar.minimumInflatedBodyOceanGap >= .12);
  pairs[side] = { totalMatched: candidates.length, relevantMatched: relevant.length, firstClearWithCollar: relevant[0] ?? null, recommendedForFourPercentEndpoint: recommended ?? null, preferredStableLowGrade: stable ?? null, candidates: spaced.slice(0, 8), clearRuns: { red: runs(red, side), blue: runs(blue, side) } };
}
const hashes = {};
for (const name of ['targetTerrainCandidate.js', 'targetNewCityRetreatField.js', 'targetRailCliffField.js', 'targetTerrainHeightfield.js']) hashes[name] = crypto.createHash('sha256').update(fs.readFileSync(new URL(`src/world/citadel/${name}`, root))).digest('hex');
// Regression assertions exercise the failure mode this search must not repeat.
const lookup = (lane, i) => laneResults[lane].rows.find(row => row.i === i);
assert.equal(lookup('red', 2058).currentFactoryTerrain.bodyEnvelopeTerrainContact, false);
assert.equal(lookup('red', 2058).currentFactoryTerrain.railBuried, true);
assert.equal(lookup('red', 2058).currentFactoryTerrain.clear, false);
assert.equal(lookup('red', 1991).currentFactoryTerrain.clear, false);
assert.equal(lookup('blue', 2039).currentFactoryTerrain.clear, false);
assert.equal(lookup('red', 1684).recordedTerrain.clear, false);
assert.equal(lookup('red', 1684).currentFactoryTerrain.clear, true);
for (const side of Object.keys(pairs)) {
  const pair = pairs[side].recommendedForFourPercentEndpoint;
  assert.ok(pair, `No complete two-lane ${side} endpoint`);
  for (const lane of ['red', 'blue']) { assert.equal(pair[lane].currentFactoryTerrain.clear, true); assert.ok(Math.abs(pair[lane].signedRadialGrade) <= .04); }
  assert.notEqual(pair.red.u, pair.blue.u);
}
const report = {
  version: 'citadel-splice-anchor-survey-1', generatedAt: new Date().toISOString(), sourceAt: actual.at,
  method: 'Actual recorded red/blue world samples and measured locomotive/wagon union envelopes. OBB versus actual terrain triangles plus 27 inside-solid probes and rail-centre parity. Separately check archived terrain and exact current factory CPU remesh.',
  actualCaptureMethod: 'Prior recorded shell headless export, preserved with its disclosure; this survey is CPU-only and uses no browser.',
  currentTerrain: { status: 'CPU rebuild of latest source, not a newly captured GPU surface', sourceHashes: hashes, geometry: latest.audit, appliesRailCliff: true, appliesNewCityRetreat: true },
  castleMatrix: actual.castleMatrix, margins, laneResults, pairs,
  limits: ['Finite original stations about 1m apart, not a continuous sweep; collar uses six stations on each side.', 'Envelope is conservative union of measured current vehicles; future cargo/robots outside it need new measurement.', 'Ocean gap uses official static directional sea level plus planet radius 160, not time-varying wave crests.', 'Only citadel mountain geometry is tested, not city buildings, rails, pylons, water-curtain structures, ships or the rest of the planet.', 'New connecting segment, derivative handle, grade, radius and foundations are NOT implied clear by a clean endpoint.', 'Recorded terrain and current CPU-remeshed terrain are different evidence epochs; keep both, and recapture actual installed final geometry before publication.'],
};
const output = new URL('artifacts/pipeline/citadel-splice-anchors-20261006/', root); fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(new URL('survey.json', output), JSON.stringify(report, null, 2));
const compactPair = pair => pair ? ({ worldSeparation: pair.worldSeparation, tangentAngleDegrees: pair.tangentAngleDegrees, collar: pair.collar, ...Object.fromEntries(['red', 'blue'].map(lane => [lane, { i: pair[lane].i, u: pair[lane].u, world: pair[lane].world, tangent: pair[lane].tangent, local: pair[lane].local, radius: pair[lane].worldRadius, signedRadialGrade: pair[lane].signedRadialGrade, inflatedBodyMinimumOceanGap: pair[lane].inflatedBodyMinimumOceanGap, recordedClear: pair[lane].recordedTerrain.clear, currentFactoryClear: pair[lane].currentFactoryTerrain.clear }])) }) : null;
const compact = Object.fromEntries(Object.entries(pairs).map(([side, result]) => [side, { totalMatched: result.totalMatched, relevantMatched: result.relevantMatched, clearRuns: result.clearRuns, firstClearWithCollar: compactPair(result.firstClearWithCollar), recommendedForFourPercentEndpoint: compactPair(result.recommendedForFourPercentEndpoint), preferredStableLowGrade: compactPair(result.preferredStableLowGrade), candidates: result.candidates.map(compactPair) }]));
fs.writeFileSync(new URL('candidates.json', output), JSON.stringify({ version: report.version, sourceAt: actual.at, terrainHashes: hashes, pairs: compact, limits: report.limits }, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(compact).map(([side, result]) => [side, { firstFourPercent: result.recommendedForFourPercentEndpoint, stable: result.preferredStableLowGrade }])), null, 2));
oldGeometry.dispose(); latest.geometry.dispose();
