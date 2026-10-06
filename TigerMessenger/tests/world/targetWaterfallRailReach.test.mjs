import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { solveTargetWaterfallRailReach } from '../../src/world/citadel/targetWaterfallRailReach.js';
import { createTargetOldCityWaterfall } from '../../src/world/citadel/targetOldCityWaterfall.js';

const envelope = { min: [-3.49000001, -.5, -1.72000003], max: [3.49000001, 2.52200008, 1.72000003], bodyLift: .12 };
function fixture({ z = 7, y = 168, rotation = 0, yaw = 0 } = {}) {
  const castle = new T.Matrix4().makeRotationZ(rotation);
  castle.setPosition(new T.Vector3(0, 160, 0).applyMatrix4(castle));
  const waterfall = { position: [0, 15, 0], yawRadians: yaw, width: 9 };
  const transform = castle.clone().multiply(new T.Matrix4().makeRotationY(yaw));
  const curve = new T.LineCurve3(new T.Vector3(-15, y - 160, z).applyMatrix4(transform), new T.Vector3(15, y - 160, z).applyMatrix4(transform));
  return { segments: [{ id: 'old-red', worldCurve: curve, startU: 0, endU: 1, direction: 1 }], castleMatrix: castle, waterfall, bodyEnvelope: envelope, sampleSea: () => 0, sampleTerrain: () => -5 };
}
const reasons = result => result.report.reasons.map(r => r.type);

test('actual vehicle OBB sets finite reach, real animated curtain stays seaward, and input geometry is untouched', () => {
  const input = fixture(), before = input.segments[0].worldCurve.v1.toArray(), result = solveTargetWaterfallRailReach(input);
  assert.equal(result.report.accepted, true, JSON.stringify(result.report.reasons));
  assert.ok(result.outboardReach > 8 && result.outboardReach < 10);
  assert.ok(result.report.minimumChannelHeadroom > 3);
  assert.equal(result.report.impactSamples.length, 21);
  assert.equal(result.report.stoneContacts.length, 0);
  assert.ok(result.report.stoneTriangleCount > 100);
  assert.equal(result.options.dropHeight, 15);
  assert.equal(result.report.installed, false);
  assert.equal(result.report.validation.continuousSweep, false);
  assert.deepEqual(input.segments[0].worldCurve.v1.toArray(), before);
  const asset = createTargetOldCityWaterfall(result.options);
  try {
    for (const time of [0, .3, 2, 9, 31]) {
      asset.update(time);
      for (const name of ['target-waterfall-aqua-three-stream-curtain', 'target-waterfall-silver-flow-ribbons']) {
        const p = asset.group.getObjectByName(name).geometry.attributes.position;
        for (let i = 0; i < p.count; i++) assert.ok(p.getZ(i) >= result.report.maximumVehicleZWithinBand + .6 - 1e-5);
      }
    }
  } finally { asset.dispose(); }
});

test('world rotation and waterfall yaw preserve local reach and sea footprint', () => {
  const base = solveTargetWaterfallRailReach(fixture());
  for (const rotation of [.5, 1.2]) {
    const next = solveTargetWaterfallRailReach(fixture({ rotation, yaw: .7 }));
    assert.equal(next.report.accepted, true, JSON.stringify(next.report.reasons));
    assert.ok(Math.abs(next.outboardReach - base.outboardReach) < 1e-8);
    assert.equal(next.options.dropHeight, 15);
    assert.ok(next.report.impactSamples.some(p => Math.abs(p.castleXZ[0]) > 3));
  }
});

test('two supplied lanes use their actual measured body envelopes and both travel directions', () => {
  const one = fixture(), outer = fixture({ z: 11 });
  const result = solveTargetWaterfallRailReach({ ...one, segments: [...one.segments, { ...outer.segments[0], id: 'old-blue', direction: -1, bodyEnvelope: { ...envelope, min: [-3.49, -.5, -2.1], max: [3.49, 2.522, 2.1] } }] });
  assert.equal(result.report.accepted, true, JSON.stringify(result.report.reasons));
  assert.ok(result.outboardReach > solveTargetWaterfallRailReach(one).outboardReach + 4);
  assert.ok(result.report.relevantPoses.some(p => p.id === 'old-blue'));
  assert.deepEqual(result.report.segments[1].bodyEnvelope.min, [-3.49, -.5, -2.1]);
});

test('insufficient under-sill clearance and overlong cantilever reject without usable options', () => {
  const tooHigh = solveTargetWaterfallRailReach(fixture({ y: 174 }));
  assert.equal(tooHigh.outboardReach, null);
  assert.ok(reasons(tooHigh).includes('insufficient-channel-headroom'));
  const tooFar = solveTargetWaterfallRailReach(fixture({ z: 35 }));
  assert.equal(tooFar.options, null);
  assert.ok(reasons(tooFar).includes('required-reach-exceeds-limit'));
});

test('all receiving sea samples must exist and known land over sea is rejected', () => {
  const missing = solveTargetWaterfallRailReach({ ...fixture(), sampleSea: x => x > 0 ? null : 0 });
  assert.ok(reasons(missing).includes('missing-receiving-sea'));
  assert.equal(missing.options, null);
  const missingLand = solveTargetWaterfallRailReach({ ...fixture(), sampleTerrain: () => null });
  assert.ok(reasons(missingLand).includes('missing-receiving-terrain'));
  const land = solveTargetWaterfallRailReach({ ...fixture(), sampleTerrain: x => x > 0 ? 1 : -5 });
  assert.ok(reasons(land).includes('impact-covered-by-land'));
  const noTerrain = solveTargetWaterfallRailReach({ ...fixture(), sampleTerrain: null });
  assert.equal(noTerrain.report.accepted, true);
  assert.equal(noTerrain.report.receivingSea.terrainChecked, false);
});

test('explicit selected old-shore subrange excludes a distant return branch; whole closed global route rejected', () => {
  const input = fixture(), first = input.segments[0].worldCurve;
  const curve = {
    closed: true, getLength: () => 60,
    getPointAt(u, target = new T.Vector3()) { return u <= .5 ? first.getPointAt(u * 2, target) : target.set((u - .75) * 120, 168, 80); },
    getTangentAt(u, target = new T.Vector3()) { return target.set(1, 0, 0); },
  };
  const selected = solveTargetWaterfallRailReach({ ...input, segments: [{ id: 'explicit-old-section', worldCurve: curve, startU: 0, endU: .5, direction: 1 }] });
  assert.equal(selected.report.accepted, true);
  assert.ok(selected.outboardReach < 10);
  assert.throws(() => solveTargetWaterfallRailReach({ ...input, segments: [{ id: 'global', worldCurve: curve, startU: 0, endU: 1, direction: 1 }] }), /Whole closed/);
});

test('no crossing and sample budget are explicit unsuccessful surveys', () => {
  const input = fixture(); input.segments[0].worldCurve.v1.x += 100; input.segments[0].worldCurve.v2.x += 100;
  assert.ok(reasons(solveTargetWaterfallRailReach(input)).includes('no-old-shore-crossing-in-waterfall-band'));
  const budget = solveTargetWaterfallRailReach({ ...fixture(), maxSamples: 5 });
  assert.ok(reasons(budget).includes('sample-budget-exceeded'));
});

test('reject malformed geometry contracts and samplers instead of silently supplying guessed heights', () => {
  for (const patch of [{ castleMatrix: [] }, { sampleSea: null }, { bodyEnvelope: { min: [0, 0, 0], max: [0, 1, 1] } }, { sampleStep: 3 }, { maxReach: 31 }, { waterfall: { position: [0, 0, 0], yawRadians: NaN, width: 9 } }]) assert.throws(() => solveTargetWaterfallRailReach({ ...fixture(), ...patch }));
  assert.throws(() => solveTargetWaterfallRailReach({ ...fixture(), sampleSea: () => NaN }), /finite/);
  assert.throws(() => solveTargetWaterfallRailReach({ ...fixture(), castleMatrix: new T.Matrix4().makeScale(2, 1, 1) }), /rigid/);
});

test('all selected poses test actual stone, including a body wholly enclosed behind the curtain band', () => {
  const input = fixture();
  const insideCoping = new T.LineCurve3(new T.Vector3(-.05, 177.60, -.7), new T.Vector3(.05, 177.60, -.7));
  input.segments.push({ id: 'invalid-coping-pose', worldCurve: insideCoping, startU: 0, endU: 1, direction: 1, bodyEnvelope: { min: [-.01, -.01, -.01], max: [.01, .01, .01], bodyLift: 0 } });
  const result = solveTargetWaterfallRailReach(input);
  assert.equal(result.options, null);
  assert.ok(reasons(result).includes('actual-outlet-or-channel-stone-intersects-vehicle'));
  assert.ok(result.report.stoneContacts.some(c => c.id === 'invalid-coping-pose' && c.type === 'closed-solid-containment'));
  assert.equal(result.report.stoneCheckPoseCount, result.report.sampleCount);
  assert.ok(!result.report.relevantPoses.some(p => p.id === 'invalid-coping-pose'));
});
