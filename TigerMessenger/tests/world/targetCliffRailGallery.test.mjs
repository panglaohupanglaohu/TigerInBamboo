import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import { createTargetCliffRailGallery } from '../../src/world/citadel/targetCliffRailGallery.js';
import { createTargetCityPlayerSupport } from '../../src/world/citadel/targetCityPlayerSupport.js';

class Arc extends T.Curve {
  constructor(radius = 166) { super(); this.radius = radius; }
  getPoint(t, out = new T.Vector3()) { const a = (t - .5) * .32; return out.set(Math.sin(a) * this.radius, Math.cos(a) * this.radius, 0); }
  getPointAt(t, out) { return this.getPoint(t, out); }
  getTangentAt(t, out = new T.Vector3()) { const a = (t - .5) * .32; return out.set(Math.cos(a), -Math.sin(a), 0); }
  getLength() { return this.radius * .32; }
}
const base = (extra = {}) => ({ worldCurve: new Arc(), castleMatrix: new T.Matrix4().makeTranslation(0, 160, 0), sampleTerrain: () => -20, sampleSea: () => -10, ...extra });
const frame = (curve, u) => { const p = curve.getPointAt(u), forward = curve.getTangentAt(u), right = p.clone().normalize().cross(forward).normalize(), up = forward.clone().cross(right).normalize(); return { p, forward, right, up }; };

test('gallery builds genuine open arches and continuous guarded walkway without installing or altering the borrowed curve', () => {
  const input = base(), original = input.worldCurve.getPointAt(.3), h = createTargetCliffRailGallery(input);
  try {
    assert.equal(h.group.parent, null); assert.equal(h.report.installed, false); assert.equal(h.report.accepted, false);
    assert.equal(h.report.vehicleClearance.pass, true, JSON.stringify(h.report.vehicleClearance.collisions));
    assert.equal(h.report.foundationSampledPass, true); assert.equal(h.report.terrainClearance.pass, true);
    assert.equal(h.report.supportSamples.pass, true, JSON.stringify(h.report.supportSamples.failures));
    assert.equal(h.report.walkingGradePass, true);
    assert.equal(h.report.status, 'finite-geometry-checked-uninstalled');
    assert.ok(h.report.roofWidth >= h.report.lowerStructure.dimensions.clearWidth);
    assert.ok(h.report.openings.length >= 4);
    assert.deepEqual(input.worldCurve.getPointAt(.3), original);
    assert.equal(h.report.endpoints.start.connected, false); assert.equal(h.report.endpoints.end.connected, false);
    let floors = 0;
    h.group.traverse(o => { if (o.isMesh) { assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite)); if (o.userData.targetWalkable) { floors++; assert.equal(o.name, 'cliff-gallery-continuous-walk-deck'); } } });
    assert.equal(floors, 1);
    const castle = new T.Group(); castle.matrixAutoUpdate = false; castle.matrix.copy(input.castleMatrix); castle.add(h.group); castle.updateMatrixWorld(true);
    const opening = h.report.openings[1], f = frame(input.worldCurve, (opening.startU + opening.endU) / 2);
    const arch = h.group.getObjectByName('cliff-gallery-open-seaward-arch-1');
    const ray = new T.Raycaster(f.p.clone().addScaledVector(f.up, 1).addScaledVector(f.right, h.report.sideCenter + 3), f.right.clone().negate(), 0, 6);
    assert.equal(ray.intersectObject(arch, false).length, 0, 'lower arch opening is actual empty geometry');
    ray.set(f.p.clone().addScaledVector(f.up, opening.crownHeightAboveTrack + .25).addScaledVector(f.right, h.report.sideCenter + 3), f.right.clone().negate());
    assert.ok(ray.intersectObject(arch, false).length > 0, 'masonry exists above the open intrados');
  } finally { h.dispose(); }
});

test('existing player provider recognizes the upper walkway, preserves open ends and does not attract feet to the lower railway roof', () => {
  const input = base(), h = createTargetCliffRailGallery(input), castle = new T.Group(), root = new T.Group();
  castle.matrixAutoUpdate = false; castle.matrix.copy(input.castleMatrix); castle.add(root); root.add(h.group);
  const terrain = new T.Mesh(new T.BoxGeometry(200, 1, 200), new T.MeshBasicMaterial()); terrain.position.y = -20.5; castle.add(terrain);
  const provider = createTargetCityPlayerSupport({ castle, candidateRoot: root, finalTerrain: terrain });
  try {
    for (let i = 1; i < 30; i++) {
      const f = frame(input.worldCurve, i / 30), point = f.p.clone().addScaledVector(f.up, 5.2);
      const supported = provider.ground(point); assert.ok(supported !== null); assert.ok(Math.abs(supported - point.length()) < .025);
      assert.equal(provider.report().lastGround.mesh, 'cliff-gallery-continuous-walk-deck');
      const next = point.clone().addScaledVector(f.forward, .5), velocity = f.forward.clone();
      assert.equal(provider.walls(point, next, velocity), false, `public centre blocked at ${i}`);
      const track = f.p.clone().addScaledVector(f.up, .2); assert.equal(provider.ground(track), null, 'lower railway not published as pedestrian ground');
    }
    const f = frame(input.worldCurve, 0), walk = f.p.clone().addScaledVector(f.up, 5.2);
    assert.equal(provider.walls(walk.clone().addScaledVector(f.forward, -.6), walk.clone().addScaledVector(f.forward, .6), f.forward.clone()), false, 'entry has no crosswise railing');
  } finally { provider.dispose(); h.dispose(); terrain.geometry.dispose(); terrain.material.dispose(); }
});

test('sea-side orientation and upper height are parameters, endpoint matching is explicit', () => {
  const input = base({ seaSide: -1, walkwayHeight: ({ u }) => 5 + .2 * u });
  const first = createTargetCliffRailGallery(input);
  try {
    assert.ok(first.report.openings.every(o => o.seaSide === -1 && o.centerOffset < 0));
    const targets = { start: first.report.endpoints.start.walkWorld, end: first.report.endpoints.end.walkWorld };
    const matching = createTargetCliffRailGallery({ ...input, endpointTargets: targets });
    try { assert.equal(matching.report.endpoints.start.connected, true); assert.equal(matching.report.endpoints.end.connected, true); }
    finally { matching.dispose(); }
    const wrong = createTargetCliffRailGallery({ ...input, endpointTargets: { end: [0, 0, 0] } });
    try { assert.equal(wrong.report.endpoints.end.connected, false); assert.ok(wrong.report.issues.some(i => i.type === 'endpoint-gap')); }
    finally { wrong.dispose(); }
  } finally { first.dispose(); }
});

test('too-low upper deck rejects actual train intersection; missing foundations and steep walk heights remain unresolved', () => {
  const low = createTargetCliffRailGallery(base({ walkwayHeight: 2.8 }));
  try { assert.equal(low.report.vehicleClearance.pass, false); assert.ok(low.report.vehicleClearance.collisions.some(c => c.hits.some(h => h.name === 'cliff-gallery-track-protective-ceiling'))); }
  finally { low.dispose(); }
  const missing = createTargetCliffRailGallery(base({ sampleTerrain: null }));
  try { assert.equal(missing.report.foundationSampledPass, false); assert.equal(missing.report.terrainClearance.pass, null); assert.equal(missing.report.status, 'rejected-or-unresolved-candidate'); }
  finally { missing.dispose(); }
  const steep = createTargetCliffRailGallery(base({ walkwayHeight: ({ u }) => 5.2 + u * 15 }));
  try { assert.equal(steep.report.walkingGradePass, false); assert.ok(steep.report.issues.some(i => i.type === 'walkway-grade-exceeded')); }
  finally { steep.dispose(); }
});

test('lower world rail radius is not fixed and sea-side callbacks can change only the supplied orientation', () => {
  for (const radius of [161.15, 169, 171]) {
    const h = createTargetCliffRailGallery(base({ worldCurve: new Arc(radius), seaSide: ({ u }) => u < .5 ? -1 : 1 }));
    try { assert.ok(Math.abs(h.report.lowerRadius.min - radius) < 1e-8); assert.ok(h.report.openings.some(o => o.seaSide === -1)); assert.ok(h.report.openings.some(o => o.seaSide === 1)); assert.equal(h.report.vehicleClearance.pass, true); }
    finally { h.dispose(); }
  }
});

test('invalid callbacks reject and dispose is idempotent without disposing source curve or external scene', () => {
  const input = base();
  assert.throws(() => createTargetCliffRailGallery({ ...input, seaSide: () => 0 }), /callback/);
  assert.throws(() => createTargetCliffRailGallery({ ...input, walkwayHeight: () => NaN }), /callback/);
  assert.throws(() => createTargetCliffRailGallery({ ...input, walkwayWidth: 2 }), /width/);
  assert.throws(() => createTargetCliffRailGallery({ ...input, roofWidth: 4 }), /cover/);
  const h = createTargetCliffRailGallery(input); const seen = new Map();
  h.group.traverse(o => { if (o.isMesh && !seen.has(o.geometry)) { seen.set(o.geometry, 0); o.geometry.addEventListener('dispose', () => seen.set(o.geometry, seen.get(o.geometry) + 1)); } });
  h.dispose(); h.dispose(); assert.ok([...seen.values()].every(count => count === 1)); assert.equal(h.group.children.length, 0);
  assert.ok(input.worldCurve.getPointAt(.5).y > 0);
});

test('measured new-east anchor neighbourhood uses the actual castle matrix and current final retreat terrain', async () => {
  const data = JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-live-tram-clearance-20261006/global-tram-samples.json', import.meta.url)));
  const { createCastleOceanSampler } = await import('../../src/world/citadel/newCityRidgeCandidate.js');
  const { targetTerrainHeight, TARGET_CITY_PLATFORMS } = await import('../../src/world/citadel/targetTerrainCandidate.js');
  const { createTargetRailCliffField } = await import('../../src/world/citadel/targetRailCliffField.js');
  const { createTargetNewCityRetreatField } = await import('../../src/world/citadel/targetNewCityRetreatField.js');
  const matrix = new T.Matrix4().fromArray(data.castleMatrix), sea = createCastleOceanSampler(matrix, 160), cliff = createTargetRailCliffField({ ...data, platforms: TARGET_CITY_PLATFORMS }), retreat = createTargetNewCityRetreatField({ platforms: TARGET_CITY_PLATFORMS });
  const terrain = (x, z) => { const s = sea(x, z); return s === null ? null : retreat.height(x, z, cliff.height(x, z, targetTerrainHeight(x, z, s, { aprons: true, saddle: true, valleyBenches: true }), s), s); };
  // A short CPU reconstruction from actual matched rail snapshots, NOT the
  // advisor's future whole shore route or a claim of exact live Catmull points.
  const centers = [1678, 1684, 1690].map(i => {
    const red = new T.Vector3(...data.lanes.red.samples[i].world);
    const blue = data.lanes.blue.samples.slice(1700, 1750).reduce((best, p) => !best || red.distanceTo(new T.Vector3(...p.world)) < red.distanceTo(new T.Vector3(...best.world)) ? p : best, null);
    return red.add(new T.Vector3(...blue.world)).multiplyScalar(.5);
  });
  const curve = new T.CatmullRomCurve3(centers, false, 'centripetal'); curve.arcLengthDivisions = 4096;
  const h = createTargetCliffRailGallery({ worldCurve: curve, castleMatrix: matrix, sampleTerrain: terrain, sampleSea: sea, seaSide: 1 });
  try {
    assert.equal(h.report.vehicleClearance.pass, true, JSON.stringify(h.report.vehicleClearance.collisions));
    assert.equal(h.report.terrainClearance.pass, true, JSON.stringify(h.report.terrainClearance));
    assert.equal(h.report.supportSamples.pass, true);
    assert.ok(h.report.lowerRadius.min > 168 && h.report.lowerRadius.max < 169);
    assert.equal(h.report.validation.finalRouteAccepted, false);
    console.log('actual-frame-east-gallery', JSON.stringify({ meshes: h.report.performance.meshes, triangles: h.report.performance.triangles, floorSamples: h.report.supportSamples.count, foundations: h.report.foundationSampledPass, status: h.report.status }));
  } finally { h.dispose(); }
});
