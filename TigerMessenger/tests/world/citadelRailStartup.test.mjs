import test from 'node:test';
import assert from 'node:assert/strict';
import {Curve, Vector3} from 'three';
import {prepareCitadelRailStartup} from '../../src/world/citadel/citadelRailStartup.js';

class Circle extends Curve {
  constructor(radius) {super(); this.radius = radius;}
  getLength() {return 2 * Math.PI * this.radius;}
  getPointAt(u, out = new Vector3()) {const a = (u === 1 ? 0 : u) * 2 * Math.PI; return out.set(Math.cos(a) * this.radius, 0, Math.sin(a) * this.radius);}
  getTangentAt(u, out = new Vector3()) {const a = (u === 1 ? 0 : u) * 2 * Math.PI; return out.set(-Math.sin(a), 0, Math.cos(a));}
}
function fixture() {
  const curves = Object.fromEntries(['center', 'red', 'blue'].map((key, i) => [key, new Circle(100 + i * 4)]));
  const plans = Object.fromEntries(Object.entries(curves).map(([key, source]) => [key, {
    startU: .2, endU: .4,
    replacementCurve: {
      getLength: () => source.getLength() * .2,
      getPointAt: (u, out) => source.getPointAt(.2 + u * .2, out),
      getTangentAt: (u, out) => source.getTangentAt(.2 + u * .2, out),
    },
  }]));
  return {curves, plans};
}

test('ordinary startup keeps the exact three route references', () => {
  const {curves} = fixture(), result = prepareCitadelRailStartup(curves);
  for (const key of Object.keys(curves)) assert.equal(result.curves[key], curves[key]);
  assert.equal(result.report.status, 'original');
});

test('a broken second lane rejects the complete transaction without a partial replacement', () => {
  const {curves, plans} = fixture();
  plans.blue.replacementCurve.getPointAt = (u, out = new Vector3()) => out.set(0, 0, 0);
  const result = prepareCitadelRailStartup(curves, plans);
  assert.equal(result.report.status, 'rejected-original-preserved');
  assert.equal(result.report.error.code, 'JOIN_MISMATCH');
  for (const key of Object.keys(curves)) assert.equal(result.curves[key], curves[key]);
  assert.equal(result.splice, null);
});

test('center-only and inherited source-curve substitutions cannot silently alter global lanes', () => {
  const {curves, plans} = fixture();
  assert.equal(prepareCitadelRailStartup(curves, {center: plans.center}).report.status, 'rejected-original-preserved');
  plans.red.sourceCurve = new Circle(900);
  const result = prepareCitadelRailStartup(curves, plans);
  assert.equal(result.splice.lanes.red.sourceCurve, curves.red);
  assert.ok(result.curves.red.getPointAt(.8).distanceTo(curves.red.getPointAt(.8)) < 1e-8);
  assert.equal(result.report.routeClearanceVerified, false);
  assert.equal(result.report.installed, false);
});
