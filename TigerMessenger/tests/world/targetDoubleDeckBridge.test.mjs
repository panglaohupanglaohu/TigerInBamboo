import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import { createTargetDoubleDeckBridge } from '../../src/world/citadel/targetDoubleDeckBridge.js';
import { createTargetCityBayBridge } from '../../src/world/citadel/targetCityBayBridge.js';
import { createTargetCliffTransitPlan } from '../../src/world/citadel/targetCliffTransitPlan.js';

class RadialArc extends T.Curve {
  constructor(radius = 161, angle = .36) { super(); this.radius = radius; this.angle = angle; }
  getPoint(t, out = new T.Vector3()) { const a = (t - .5) * this.angle; return out.set(Math.sin(a) * this.radius, Math.cos(a) * this.radius, 0); }
  getPointAt(t, out) { return this.getPoint(t, out); }
  getTangentAt(t, out = new T.Vector3()) { const a = (t - .5) * this.angle; return out.set(Math.cos(a), -Math.sin(a), 0); }
  getLength() { return this.angle * this.radius; }
}
function fixture(options = {}) {
  const castle = new T.Group(); castle.position.y = 160; castle.updateMatrixWorld(true);
  const path = [[-35, 8, 0], [35, 8, 0]], terrain = () => -20, sea = () => -10;
  const upper = createTargetCityBayBridge({ path, width: 4.4, maxSpan: 30, pierWidth: 1.8, groundHeightAt: terrain, oceanHeightAt: sea });
  castle.add(upper.group); castle.updateMatrixWorld(true);
  const input = { upperPath: path, upperDeck: upper.group, worldCurve: new RadialArc(), castleMatrix: castle.matrixWorld, sampleTerrain: terrain, sampleSea: sea, ...options };
  return { castle, upper, input, create: () => createTargetDoubleDeckBridge(input), close: () => upper.dispose() };
}

test('real twin-track structure is finite, the original walk deck stays byte-identical and supports require explicit replacement', () => {
  const f = fixture();
  const before = new Map(); f.upper.group.traverse(m => { if (m.isMesh) before.set(m.uuid, { visible: m.visible, parent: m.parent, position: Array.from(m.geometry.attributes.position.array), matrix: m.matrixWorld.toArray() }); });
  const h = f.create();
  try {
    assert.equal(h.group.parent, null);
    assert.equal(h.report.installed, false); assert.equal(h.report.accepted, false);
    assert.ok(Math.abs(h.report.dimensions.clearWidth - 8.74) < 1e-10);
    assert.equal(h.report.replacementApplied, false);
    assert.ok(h.report.replacementRequired.some(p => p.name.startsWith('bay-bridge-true-arch-')));
    assert.ok(h.report.replacementRequired.some(p => p.name.startsWith('bay-bridge-pier-')));
    assert.ok(h.report.replacementRequired.every(p => !p.name.includes('walking-deck') && !p.name.includes('handrail')));
    assert.ok(h.report.upperContacts.length >= 3);
    assert.equal(h.report.vehicleClearance.pass, true, JSON.stringify(h.report.vehicleClearance.collisions));
    assert.equal(h.report.foundationSampledPass, true);
    assert.equal(h.report.terrainClearance.pass, true);
    assert.equal(h.report.status, 'finite-geometry-checked-uninstalled');
    assert.ok(h.report.performance.triangles > 1000);
    h.group.traverse(m => { if (m.isMesh) { assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite)); assert.notEqual(m.userData.targetWalkable, true); assert.equal(m.material.userData.preserveCitadelMaterial, true); } });
    f.upper.group.traverse(m => { if (m.isMesh) { const old = before.get(m.uuid); assert.equal(m.visible, old.visible); assert.equal(m.parent, old.parent); assert.deepEqual(Array.from(m.geometry.attributes.position.array), old.position); assert.deepEqual(m.matrixWorld.toArray(), old.matrix); } });
    assert.deepEqual(h.report.upperPath, f.input.upperPath);
  } finally { h.dispose(); f.close(); }
});

test('the lower side arches have true transverse negative space with measured water headroom', () => {
  const f = fixture(), h = f.create();
  try {
    assert.equal(h.report.boatOpeningSampledPass, true);
    const opening = h.report.openings.find(o => o.navigableSampled);
    assert.ok(opening.clearAlongWidth > 4);
    assert.ok(opening.nominalHeadroom > 3);
    assert.deepEqual(opening.geometryHits, []);
    f.castle.add(h.group); f.castle.updateMatrixWorld(true);
    const world = new T.Vector3(...opening.centerWorld), up = world.clone().normalize();
    const point = world.clone().addScaledVector(up, opening.waterOffset + 1.5);
    const ray = new T.Raycaster(point.clone().add(new T.Vector3(0, 0, 20)), new T.Vector3(0, 0, -1), 0, 40);
    assert.equal(ray.intersectObject(h.group, true).length, 0, 'no solid wall pretending to be an arch opening');
  } finally { h.dispose(); f.close(); }
});

test('triangle tests detect a retained wall and reject an enclosed body, not merely overlapping mesh bounding boxes', () => {
  const f = fixture();
  const wall = new T.Mesh(new T.BoxGeometry(1, 12, 12), new T.MeshStandardMaterial()); wall.name = 'protected-test-solid-wall'; wall.position.set(0, 4, 0); f.upper.group.add(wall);
  const h = f.create();
  try {
    assert.equal(h.report.vehicleClearance.pass, false);
    assert.ok(h.report.vehicleClearance.collisions.some(c => c.hits.some(p => p.name === wall.name && p.type === 'triangle-obb')));
    assert.equal(h.report.status, 'rejected-or-unresolved-candidate');
  } finally { h.dispose(); f.upper.group.remove(wall); wall.geometry.dispose(); wall.material.dispose(); f.close(); }
  const g = fixture(), cube = new T.Mesh(new T.BoxGeometry(45, 35, 35), new T.MeshStandardMaterial()); cube.name = 'protected-enclosing-solid'; cube.position.y = 0; g.upper.group.add(cube); const second = g.create();
  try { assert.ok(second.report.vehicleClearance.collisions.some(c => c.hits.some(p => p.name === cube.name && p.type === 'closed-solid-containment'))); }
  finally { second.dispose(); g.upper.group.remove(cube); cube.geometry.dispose(); cube.material.dispose(); g.close(); }
});

test('adjacent closed roof prisms do not create false solid containment through their internal shared caps', () => {
  for (const angles of [[.6, .8, .4], [.9, .3, .5], [.3, 1.1, .7]]) {
    const f = fixture(), q = new T.Quaternion().setFromEuler(new T.Euler(...angles));
    f.castle.position.set(0, 160, 0).applyQuaternion(q); f.castle.quaternion.copy(q); f.castle.updateMatrixWorld(true);
    const original = f.input.worldCurve, curve = { getLength: () => original.getLength(), getPointAt: (u, out = new T.Vector3()) => original.getPointAt(u, out).applyQuaternion(q), getTangentAt: (u, out = new T.Vector3()) => original.getTangentAt(u, out).applyQuaternion(q) };
    f.input.worldCurve = curve; f.input.castleMatrix = f.castle.matrixWorld;
    const inv = f.castle.matrixWorld.clone().invert(), positions = [], faces = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
    const p = (u, x, y) => { const point = curve.getPointAt(u), tangent = curve.getTangentAt(u), right = point.clone().normalize().cross(tangent).normalize(), up = tangent.clone().cross(right).normalize(); return point.addScaledVector(right, x).addScaledVector(up, y).applyMatrix4(inv); };
    for (let i = 0; i < 20; i++) {
      const a = i / 20, b = (i + 1) / 20, points = [p(a, -7, 5), p(b, -7, 5), p(b, 7, 5), p(a, 7, 5), p(a, -7, 5.4), p(b, -7, 5.4), p(b, 7, 5.4), p(a, 7, 5.4)];
      for (const index of faces) positions.push(...points[index].toArray());
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    const roof = new T.Mesh(geometry, new T.MeshStandardMaterial()); roof.name = 'retained-compound-prism-roof'; f.upper.group.add(roof);
    const h = f.create();
    try { assert.equal(h.report.vehicleClearance.pass, true, JSON.stringify(h.report.vehicleClearance.collisions)); }
    finally { h.dispose(); f.upper.group.remove(roof); roof.geometry.dispose(); roof.material.dispose(); f.close(); }
  }
});

test('missing terrain produces unknown foundations, while raised terrain and an oversized body fail independently', () => {
  const f = fixture({ sampleTerrain: null }), h = f.create();
  try { assert.equal(h.report.foundationSampledPass, false); assert.equal(h.report.terrainClearance.pass, null); assert.ok(h.report.supports.every(s => s.bottomOffset === null)); assert.ok(!h.group.children.some(m => m.name.startsWith('double-deck-side-pier-'))); }
  finally { h.dispose(); f.close(); }
  const g = fixture({ sampleTerrain: () => 4, vehicleEnvelope: { top: 10 } }), second = g.create();
  try { assert.equal(second.report.terrainClearance.pass, false); assert.equal(second.report.vehicleClearance.pass, false); assert.equal(second.report.foundationSampledPass, false); }
  finally { second.dispose(); g.close(); }
});

test('borrowed resources survive repeated candidate disposal and exceptions clean only owned geometry', () => {
  const f = fixture(), h = f.create(); let borrowedDisposals = 0, ownDisposals = 0;
  f.upper.group.children[0].geometry.addEventListener('dispose', () => borrowedDisposals++);
  const geometry = h.group.children[0].geometry; geometry.addEventListener('dispose', () => ownDisposals++);
  h.dispose(); h.dispose(); assert.equal(ownDisposals, 1); assert.equal(borrowedDisposals, 0); assert.equal(h.group.children.length, 0);
  assert.throws(() => createTargetDoubleDeckBridge({ ...f.input, sampleTerrain: () => { throw new Error('surface failed'); } }), /surface failed/);
  assert.equal(borrowedDisposals, 0); assert.equal(f.upper.group.parent, f.castle);
  f.close();
});

test('invalid inputs are rejected without silently guessing a surface or accepting scaled metre units', () => {
  const f = fixture();
  try {
    assert.throws(() => createTargetDoubleDeckBridge({ ...f.input, sampleStep: 5 }), /sampling/);
    assert.throws(() => createTargetDoubleDeckBridge({ ...f.input, castleMatrix: new T.Matrix4().makeScale(2, 1, 1) }), /rigid/);
    assert.throws(() => createTargetDoubleDeckBridge({ ...f.input, vehicleEnvelope: { halfWidth: NaN } }), /envelope/);
    assert.throws(() => createTargetDoubleDeckBridge({ ...f.input, upperDeck: new T.Group() }), /walking/);
  } finally { f.close(); }
});

test('actual r47 curved upper path with advisor radial track is checked without relocating the deck or concealing unresolved banks', async () => {
  const source = new URL('../../artifacts/pipeline/', import.meta.url);
  const recorded = JSON.parse(fs.readFileSync(new URL('citadel-live-tram-clearance-20261006/global-tram-samples.json', source)));
  const saved = JSON.parse(fs.readFileSync(new URL('citadel-four-hour-20261005/r47-arches-clouds-target-front-plants-terrain.json', source)));
  const { createCastleOceanSampler } = await import('../../src/world/citadel/newCityRidgeCandidate.js');
  const { targetTerrainHeight, TARGET_CITY_PLATFORMS } = await import('../../src/world/citadel/targetTerrainCandidate.js');
  const { createTargetNewCityRetreatField } = await import('../../src/world/citadel/targetNewCityRetreatField.js');
  const matrix = new T.Matrix4().fromArray(recorded.castleMatrix), sea = createCastleOceanSampler(matrix, 160), retreat = createTargetNewCityRetreatField({ platforms: TARGET_CITY_PLATFORMS });
  const terrain = (x, z) => { const s = sea(x, z); return s === null ? null : retreat.height(x, z, targetTerrainHeight(x, z, s, { aprons: true, saddle: true, valleyBenches: true }), s); };
  const bridge = saved.cityDetail.bridge, upper = createTargetCityBayBridge({ path: bridge.path, width: bridge.width, maxSpan: 36, pierWidth: 1.8, groundHeightAt: terrain, oceanHeightAt: sea });
  upper.group.matrixAutoUpdate = false; upper.group.matrix.copy(matrix); upper.group.updateMatrixWorld(true);
  const plan = createTargetCliffTransitPlan({ castleMatrix: matrix, bridgeReport: upper.report, bridgeRoot: upper.group, sampleTerrain: terrain, sampleSea: sea, mode: 'radial' });
  const h = createTargetDoubleDeckBridge({ upperPath: bridge.path, upperDeck: upper.group, worldCurve: plan.worldCurve, castleMatrix: matrix, sampleTerrain: terrain, sampleSea: sea });
  try {
    assert.deepEqual(h.report.upperPath, bridge.path);
    assert.equal(h.report.lowerRadius.imposedByFactory, false);
    assert.ok(Math.abs(h.report.lowerRadius.min - plan.report.radialSolve.radius) < 1e-7);
    assert.ok(h.report.performance.triangles > 1000);
    assert.ok(h.report.replacementRequired.length > 5);
    assert.equal(h.report.terrainClearance.pass, false, 'known unresolved bank soil must stay rejected');
    assert.equal(h.report.accepted, false); assert.equal(h.report.installed, false);
    assert.equal(h.report.validation.globalRailConnected, false);
    console.log('actual-double-deck-candidate', JSON.stringify({ vehicleCollisions: h.report.vehicleClearance.collisions.length, upperContacts: h.report.upperContacts.length, issues: h.report.issues, foundations: h.report.foundationSampledPass, navigableOpenings: h.report.openings.filter(o => o.navigableSampled).length, lowerRadius: h.report.lowerRadius, meshes: h.report.performance.meshes, triangles: h.report.performance.triangles }));
    for (const radius of [169, 170, 171]) {
      class LoweredCurve extends T.Curve { getPoint(t, out = new T.Vector3()) { return plan.worldCurve.getPoint(t, out).normalize().multiplyScalar(radius); } }
      const lower = createTargetDoubleDeckBridge({ upperPath: bridge.path, upperDeck: upper.group, worldCurve: new LoweredCurve(), castleMatrix: matrix, sampleTerrain: terrain, sampleSea: sea });
      try {
        assert.ok(Math.abs(lower.report.lowerRadius.min - radius) < 1e-7);
        assert.deepEqual(lower.report.upperPath, bridge.path);
        assert.equal(lower.report.vehicleClearance.pass, true, `radius ${radius}: ${JSON.stringify(lower.report.vehicleClearance.collisions)}`);
        assert.equal(lower.report.accepted, false);
        console.log('lowered-central-bridge', JSON.stringify({ radius, upperContacts: lower.report.upperContacts.length, terrainIssues: lower.report.terrainClearance.issues.length, openings: lower.report.openings.filter(o => o.navigableSampled).length, status: lower.report.status }));
      } finally { lower.dispose(); }
    }
  } finally { h.dispose(); upper.dispose(); }
});
