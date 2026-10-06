import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import { createCitadelRailSplice, createCitadelRailSpliceSet, CitadelRailSpliceError } from '../../src/world/citadel/citadelRailSplice.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const samePoint = (a, b, eps = 1e-9) => assert.ok(a.distanceTo(b) <= eps, `${a.toArray()} vs ${b.toArray()}`);
const throwsCode = (fn, code) => assert.throws(fn, error => error instanceof CitadelRailSpliceError && error.code === code);

class Circle extends T.Curve {
  constructor(radius = 50) { super(); this.radius = radius; this.calls = []; }
  getLength() { return 2 * Math.PI * this.radius; }
  getPointAt(u, out = new T.Vector3()) { this.calls.push(['point', u]); const t = (u === 1 ? 0 : u) * Math.PI * 2; return out.set(this.radius * Math.cos(t), 10, this.radius * Math.sin(t)); }
  getTangentAt(u, out = new T.Vector3()) { this.calls.push(['tangent', u]); const t = (u === 1 ? 0 : u) * Math.PI * 2; return out.set(-Math.sin(t), 0, Math.cos(t)); }
}
function replacement(source, startU, endU, handleLength = 30) {
  const a = source.getPointAt(startU), b = source.getPointAt(endU);
  const curve = new T.CubicBezierCurve3(a, a.clone().addScaledVector(source.getTangentAt(startU), handleLength), b.clone().addScaledVector(source.getTangentAt(endU), -handleLength), b);
  curve.arcLengthDivisions = 8192;
  curve.updateArcLengths();
  return curve;
}
function fixture(startU = .15, endU = .38) {
  const sourceCurve = new Circle(), replacementCurve = replacement(sourceCurve, startU, endU);
  const input = { sourceCurve, replacementCurve, startU, endU, sourceId: 'analytic-circle-v1', metadata: { testOnly: true } };
  return { ...input, handle: createCitadelRailSplice(input), input };
}

test('untouched world positions/tangents delegate the source and do not refit the global route', () => {
  const f = fixture(), { handle: h, sourceCurve: source } = f;
  assert.ok(h.curve instanceof T.Curve);
  assert.ok(source.calls.length < 20, 'validation must not globally sample the source');
  source.calls.length = 0;
  for (const u of [0, .0003, .13, f.startU, f.endU, .4, .79, .875, .97, .9999, 1]) {
    const original = source.getPointAt(u), originalTangent = source.getTangentAt(u);
    const mapped = h.mapOriginalProgress(u);
    assert.equal(mapped.positionPreserved, true);
    samePoint(h.curve.getPointAt(mapped.progress), original);
    samePoint(h.curve.getTangentAt(mapped.progress), originalTangent);
    assert.deepEqual(h.getPointAtOriginalProgress(u).toArray(), original.toArray());
    near(h.mapSplicedProgress(mapped.progress).progress, u);
    assert.ok(source.calls.some(([kind, value]) => kind === 'point' && value === u));
  }
  assert.equal(h.rollback(), source);
  assert.equal(h.report.routeAcceptance.installed, false);
  assert.equal(h.report.routeAcceptance.terrain, false);
  assert.ok(Object.isFrozen(h.report.joins[0].world));
});

test('new arc length preserves retained distances and supports meter-based vehicle spacing', () => {
  const { handle: h, sourceCurve: source, startU, endU } = fixture();
  near(h.curve.getLength(), source.getLength() * (1 - endU + startU) + h.replacementCurve.getLength());
  const suffix = h.mapOriginalProgress(.8), next = h.mapOriginalDistance(.8 * source.getLength() + 7);
  near(next.distance - suffix.distance, 7);
  near(h.mapSplicedDistance(next.distance).distance, .8 * source.getLength() + 7);
  const a = h.report.replacementInterval[0] * h.curve.getLength();
  for (const distance of [a - .1, a, a + .1, a + 20]) {
    const p = h.curve.getPointAt(distance / h.curve.getLength());
    const q = h.curve.getPointAt((distance + .01) / h.curve.getLength());
    near(p.distanceTo(q), .01, 1e-5);
  }
  assert.equal(h.curve.getUtoTmapping(.25), .25);
  assert.equal(h.curve.getUtoTmapping(.25, 0), 0);
  near(h.curve.getLengths(8)[8], h.curve.getLength());
});

test('interior migration rejects by default and only explicit relative migration loses position identity', () => {
  const { handle: h, startU, endU } = fixture(), middle = (startU + endU) / 2;
  throwsCode(() => h.mapOriginalProgress(middle), 'VEHICLE_INSIDE_REPLACED_INTERVAL');
  throwsCode(() => h.getPointAtOriginalProgress(middle), 'VEHICLE_INSIDE_REPLACED_INTERVAL');
  const mapped = h.mapOriginalProgress(middle, { inside: 'relative' });
  assert.equal(mapped.positionPreserved, false);
  samePoint(h.curve.getPointAt(mapped.progress), h.replacementCurve.getPointAt(.5));
  throwsCode(() => h.mapSplicedProgress(mapped.progress), 'VEHICLE_INSIDE_REPLACED_INTERVAL');
  near(h.mapSplicedProgress(mapped.progress, { inside: 'relative' }).progress, middle);
  throwsCode(() => h.mapOriginalProgress(.1, { inside: 'teleport' }), 'INVALID_MAPPING');
});

test('closed seam and the Three.js Curve consumer contract remain continuous', () => {
  for (const [a, b] of [[.15, .38], [0, .2], [.8, 1]]) {
    const h = fixture(a, b).handle, curve = h.curve;
    samePoint(curve.getPointAt(0), curve.getPointAt(1), 0);
    samePoint(curve.getTangentAt(0), curve.getTangentAt(1), 0);
    samePoint(curve.getPointAt(1 - 1e-8), curve.getPointAt(1e-8), 1e-4);
    const clone = curve.clone();
    samePoint(clone.getPoint(.45), curve.getPointAt(.45));
    const tube = new T.TubeGeometry(curve, 128, .3, 5, true);
    assert.ok([...tube.attributes.position.array].every(Number.isFinite));
    tube.dispose();
    throwsCode(() => curve.toJSON(), 'REFERENCE_ONLY');
  }
});

test('bad join, wrong tangent, nonclosed source, invalid interval and sample budget reject without mutating inputs', () => {
  const { input } = fixture(), saved = input.replacementCurve.v0.toArray();
  const broken = input.replacementCurve.clone(); broken.v0.x += 1;
  throwsCode(() => createCitadelRailSplice({ ...input, replacementCurve: broken }), 'JOIN_MISMATCH');
  const reversed = input.replacementCurve.clone(); reversed.v1.copy(reversed.v0).sub(input.sourceCurve.getTangentAt(input.startU));
  throwsCode(() => createCitadelRailSplice({ ...input, replacementCurve: reversed }), 'JOIN_MISMATCH');
  assert.deepEqual(input.replacementCurve.v0.toArray(), saved);
  const source = new Circle(); const point = source.getPointAt.bind(source);
  source.getPointAt = (u, out) => point(u, out).add(new T.Vector3(u === 1 ? .1 : 0, 0, 0));
  throwsCode(() => createCitadelRailSplice({ ...input, sourceCurve: source }), 'SOURCE_NOT_CLOSED');
  for (const [startU, endU] of [[.8, .2], [.3, .3], [0, 1]]) throwsCode(() => createCitadelRailSplice({ ...input, startU, endU }), 'INVALID_INTERVAL');
  throwsCode(() => createCitadelRailSplice({ ...input, startU: NaN }), 'INVALID_PROGRESS');
  throwsCode(() => createCitadelRailSplice({ ...input, validation: { sampleStep: .0001, maxSamples: 17 } }), 'SAMPLE_BUDGET');
  throwsCode(() => input.sourceCurve && fixture().handle.curve.getPointAt(Infinity), 'INVALID_PROGRESS');
});

test('nonfinite interior, zero tangent, stationary segment and false arc length cannot pass finite validation', () => {
  const { input } = fixture(), original = input.replacementCurve;
  const proxy = () => ({ getPointAt: original.getPointAt.bind(original), getTangentAt: original.getTangentAt.bind(original), getLength: original.getLength.bind(original) });
  let bad = proxy(); bad.getPointAt = (u, out) => u > .4 && u < .6 ? new T.Vector3(NaN, 0, 0) : original.getPointAt(u, out);
  throwsCode(() => createCitadelRailSplice({ ...input, replacementCurve: bad }), 'NONFINITE_CURVE');
  bad = proxy(); bad.getTangentAt = (u, out) => u > .4 && u < .6 ? new T.Vector3() : original.getTangentAt(u, out);
  throwsCode(() => createCitadelRailSplice({ ...input, replacementCurve: bad }), 'ZERO_TANGENT');
  bad = proxy(); bad.getPointAt = (u, out) => original.getPointAt(u > .3 && u < .7 ? .5 : u, out);
  throwsCode(() => createCitadelRailSplice({ ...input, replacementCurve: bad }), 'DEGENERATE_REPLACEMENT');
  bad = proxy(); bad.getLength = () => original.getLength() * 1.5;
  throwsCode(() => createCitadelRailSplice({ ...input, replacementCurve: bad }), 'LENGTH_MISMATCH');
});

test('a finite correctly joined but nonuniform getPointAt is rejected instead of changing vehicle speed', () => {
  const { input } = fixture(), original = input.replacementCurve;
  const bad = {
    getLength: () => original.getLength(),
    getPointAt: (u, out) => original.getPointAt(u * u, out),
    getTangentAt: (u, out) => original.getTangentAt(u * u, out),
  };
  throwsCode(() => createCitadelRailSplice({ ...input, replacementCurve: bad }), 'NONUNIFORM_ARC_PARAMETER');
});

// Hermite interpolation of recorded world points/tangents is a CPU fixture, NOT
// a reconstruction of the live Catmull-Rom control polygon. Exact anchor data
// and recorded lane length are retained; intermediate fixture values are only
// used to check delegation/mapping. No generated path here is a route proposal.
class CapturedLane extends T.Curve {
  constructor(lane) { super(); this.lane = lane; }
  getLength() { return this.lane.length; }
  segment(u) {
    const samples = this.lane.samples, scaled = (u === 1 ? 0 : u) * samples.length;
    const i = Math.floor(scaled), t = scaled - i;
    return { a: samples[i], b: samples[(i + 1) % samples.length], t, h: this.lane.arcStep };
  }
  getPointAt(u, out = new T.Vector3()) {
    const { a, b, t, h } = this.segment(u), t2 = t * t, t3 = t2 * t;
    return out.fromArray(a.world).multiplyScalar(2 * t3 - 3 * t2 + 1)
      .addScaledVector(new T.Vector3(...a.tangent), h * (t3 - 2 * t2 + t))
      .addScaledVector(new T.Vector3(...b.world), -2 * t3 + 3 * t2)
      .addScaledVector(new T.Vector3(...b.tangent), h * (t3 - t2));
  }
  getTangentAt(u, out = new T.Vector3()) {
    const { a, b, t, h } = this.segment(u), t2 = t * t;
    return out.fromArray(a.world).multiplyScalar(6 * t2 - 6 * t)
      .addScaledVector(new T.Vector3(...a.tangent), h * (3 * t2 - 4 * t + 1))
      .addScaledVector(new T.Vector3(...b.world), -6 * t2 + 6 * t)
      .addScaledVector(new T.Vector3(...b.tangent), h * (3 * t2 - 2 * t)).normalize();
  }
}

test('actual separately measured red/blue anchors retain both global outer segments and excluded lower return branch', () => {
  const base = new URL('../../artifacts/pipeline/citadel-live-tram-clearance-20261006/', import.meta.url);
  const recorded = JSON.parse(fs.readFileSync(new URL('global-tram-samples.json', base)));
  const anchors = JSON.parse(fs.readFileSync(new URL('CLIFF_ROUTE_SPLICE_ANCHORS.json', base)));
  const lanes = {};
  for (const key of ['red', 'blue']) {
    const sourceCurve = new CapturedLane(recorded.lanes[key]);
    const { eastUpperTransition: a, oldWestTransition: b } = anchors.candidates[key];
    samePoint(sourceCurve.getPointAt(a.u), new T.Vector3(...a.world));
    samePoint(sourceCurve.getPointAt(b.u), new T.Vector3(...b.world));
    samePoint(sourceCurve.getTangentAt(a.u), new T.Vector3(...a.tangent));
    const replacementCurve = replacement(sourceCurve, a.u, b.u, 55);
    lanes[key] = { sourceCurve, replacementCurve, startU: a.u, endU: b.u, sourceId: `actual-${key}-${recorded.at}` };
  }
  const set = createCitadelRailSpliceSet({ lanes });
  assert.notEqual(lanes.red.startU, lanes.blue.startU);
  for (const key of ['red', 'blue']) {
    const h = set.lanes[key], lane = recorded.lanes[key];
    near(h.report.oldSpanLength, anchors.candidates[key].oldSpanLength);
    for (const sample of lane.samples.filter(p => p.u <= lanes[key].startU || p.u >= lanes[key].endU)) {
      const newU = h.mapOriginalProgress(sample.u).progress;
      samePoint(h.curve.getPointAt(newU), new T.Vector3(...sample.world), 1e-8);
      samePoint(h.curve.getTangentAt(newU), new T.Vector3(...sample.tangent), 1e-8);
    }
    for (const u of [.875, .90, .97]) samePoint(h.curve.getPointAt(h.mapOriginalProgress(u).progress), lanes[key].sourceCurve.getPointAt(u));
    assert.equal(set.rollback()[key], lanes[key].sourceCurve);
  }
  assert.equal(set.report.twinTrackClearanceVerified, false);
});

test('center/red/blue family validates independently and a failed lane publishes no partial set or source mutation', () => {
  const center = fixture(.1, .3), red = fixture(.12, .34), blue = fixture(.14, .36);
  const lanes = { center: center.input, red: red.input, blue: blue.input };
  const set = createCitadelRailSpliceSet({ lanes });
  assert.deepEqual(Object.keys(set.curves), ['center', 'red', 'blue']);
  for (const key of Object.keys(lanes)) assert.equal(set.rollback()[key], lanes[key].sourceCurve);
  const broken = blue.replacementCurve.clone(); broken.v3.y += 2;
  let published = null;
  throwsCode(() => { published = createCitadelRailSpliceSet({ lanes: { ...lanes, blue: { ...blue.input, replacementCurve: broken } } }); }, 'JOIN_MISMATCH');
  assert.equal(published, null);
  samePoint(set.curves.red.getPointAt(0), red.sourceCurve.getPointAt(0));
  throwsCode(() => createCitadelRailSpliceSet({ lanes: {} }), 'INVALID_LANES');
  throwsCode(() => createCitadelRailSpliceSet({ lanes: { typo: red.input } }), 'INVALID_LANES');
});
