import * as T from 'three';
import { createTargetOldCityWaterfall } from './targetOldCityWaterfall.js';

export const TARGET_WATERFALL_RAIL_REACH_VERSION = 'target-waterfall-rail-reach-1';
const finite3 = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const faceIndices = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];

// Clip the actual oriented box faces to an unbounded vertical X/Z prism. Its
// extrema remain on an original box face; no world-axis AABB replaces the OBB.
function clippedPoints(corners, bounds) {
  const planes = [];
  for (const axis of ['x', 'z']) {
    if (bounds[`${axis}Min`] !== undefined) planes.push({ axis, limit: bounds[`${axis}Min`], sign: 1 });
    if (bounds[`${axis}Max`] !== undefined) planes.push({ axis, limit: bounds[`${axis}Max`], sign: -1 });
  }
  const points = [];
  for (const face of faceIndices) {
    let polygon = face.map(i => corners[i]);
    for (const { axis, limit, sign } of planes) {
      const next = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = sign * (a[axis] - limit), db = sign * (b[axis] - limit);
        if (da >= -1e-9) next.push(a);
        if (da * db < 0) next.push(a.clone().lerp(b, da / (da - db)));
      }
      polygon = next;
      if (!polygon.length) break;
    }
    points.push(...polygon);
  }
  return points;
}

function bodyBox(spec) {
  if (!spec || !finite3(spec.min) || !finite3(spec.max) || spec.min.some((n, i) => n >= spec.max[i])) throw new TypeError('Measured bodyEnvelope needs finite min/max in vehicle-local +X longitudinal, +Y up, Z width');
  const lift = spec.bodyLift ?? .12;
  if (!Number.isFinite(lift)) throw new TypeError('bodyLift must be finite');
  return { bounds: new T.Box3(new T.Vector3(...spec.min), new T.Vector3(...spec.max)), lift };
}

/** Pure, finite old-shore reach survey; no scene or input curve mutations.
 * Each segment explicitly supplies {id,worldCurve,startU,endU,direction}; these
 * are caller-approved OLD shore ranges. A whole closed global curve is rejected.
 * bodyEnvelope is the measured vehicle union in the actual tram model axes.
 * waterfall={position:[castleXYZ],yawRadians,width}; no scale/pitch is inferred.
 * sampleSea/sampleTerrain: (castleX,castleZ)=>castleY|{height}|null.
 * On failure outboardReach/options are null; report retains required distance.
 * On success options can be passed to the waterfall factory, then its actual
 * receivingSurfaceHeightAt callback must still seat animated foam/ripples.
 */
export function solveTargetWaterfallRailReach({
  segments, castleMatrix, waterfall, bodyEnvelope, sampleSea, sampleTerrain = null,
  margin = .6, verticalMargin = .35, maxReach = 30, sampleStep = .5, maxSamples = 10000,
} = {}) {
  if (!Array.isArray(segments) || !segments.length) throw new TypeError('Explicit approved old-shore segments required');
  if (!waterfall || !finite3(waterfall.position) || !Number.isFinite(waterfall.yawRadians) || !Number.isFinite(waterfall.width) || waterfall.width <= 0) throw new TypeError('waterfall requires castle-local position, yawRadians and positive width');
  if (typeof sampleSea !== 'function' || sampleTerrain !== null && typeof sampleTerrain !== 'function') throw new TypeError('Actual sea sampler required; terrain sampler must be function or null');
  for (const [key, value] of Object.entries({ margin, verticalMargin, maxReach, sampleStep })) if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${key} must be positive`);
  if (maxReach > 30 || sampleStep > 2 || !Number.isInteger(maxSamples) || maxSamples < 2) throw new RangeError('Reach must respect factory 30m limit; finite sample budget required');
  const castle = castleMatrix?.isMatrix4 ? castleMatrix.clone() : new T.Matrix4().fromArray(castleMatrix ?? []);
  if (!castle.elements.every(Number.isFinite) || Math.abs(castle.determinant()) < 1e-12) throw new TypeError('finite invertible castleMatrix required');
  const basis = new T.Matrix3().setFromMatrix4(castle), axes = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)].map(v => v.applyMatrix3(basis));
  if (axes.some(v => Math.abs(v.length() - 1) > 1e-5) || Math.abs(axes[0].dot(axes[1])) > 1e-5 || Math.abs(axes[0].dot(axes[2])) > 1e-5 || Math.abs(axes[1].dot(axes[2])) > 1e-5) throw new RangeError('castleMatrix must be rigid metre units');
  const toCastle = new T.Matrix4().makeRotationY(waterfall.yawRadians); toCastle.setPosition(new T.Vector3(...waterfall.position));
  const toWorld = castle.clone().multiply(toCastle), fromWorld = toWorld.clone().invert();
  const measured = bodyBox(bodyEnvelope), width = waterfall.width, scale = width / 9;
  const bandHalfWidth = width * (.29 + .232 * 1.31 / 2) + .045 * scale;
  const minimumCurtainOffset = width * .053 - .095 * scale;
  const report = {
    version: TARGET_WATERFALL_RAIL_REACH_VERSION, accepted: false, installed: false,
    status: 'surveying', reasons: [], requiredReach: null, proposedReach: null,
    input: { waterfall: { position: [...waterfall.position], yawRadians: waterfall.yawRadians, width }, bodyEnvelope: { min: [...bodyEnvelope.min], max: [...bodyEnvelope.max], bodyLift: measured.lift }, margin, verticalMargin, maxReach, sampleStep },
    coordinates: 'world track/vehicle poses -> waterfall-local +Z seaward; samplers castle-local Y',
    selection: 'only explicitly supplied old-shore ranges; no global/XZ branch matching',
    curtainBand: { minX: -bandHalfWidth, maxX: bandHalfWidth, animationXEnvelope: .045 * scale, minimumAnimatedZWithoutReach: minimumCurtainOffset },
    segments: [], sampleCount: 0, relevantPoses: [], channelHeadroom: [], impactSamples: [], stoneContacts: [],
    validation: { continuousSweep: false, dynamicShips: false, galleryRoofIntegration: false, engineeringCantilever: false, gpuVerified: false },
    limitations: ['Finite supplied-segment poses, not a continuous whole-train sweep.', 'Only measured vehicle bounds are represented; future cargo outside them requires new bounds.', 'A sea sample alone does not exclude covering land; optional actual terrain samples test landing dryness.', 'Cantilever support, gallery roof joints and moving ships remain separate acceptance checks.', 'Waterfall dimensions/animation bounds follow the current real factory and are regression-tested against it.'],
  };
  const reject = () => { report.status = 'rejected'; return { outboardReach: null, options: null, report }; };
  const poses = [], allPoses = [];
  for (const segment of segments) {
    const { id, worldCurve: curve, startU, endU, direction } = segment;
    if (typeof id !== 'string' || !id || !curve?.getLength || !curve?.getPointAt || !curve?.getTangentAt || ![startU, endU].every(Number.isFinite) || startU < 0 || endU > 1 || startU >= endU || ![-1, 1].includes(direction)) throw new TypeError('Each named segment needs a world curve, explicit [startU,endU] and direction +/-1');
    if (curve.closed === true && startU === 0 && endU === 1) throw new RangeError('Whole closed global route forbidden: provide explicit old-shore subranges');
    const length = curve.getLength() * (endU - startU);
    if (!Number.isFinite(length) || length <= 0) throw new RangeError('positive segment arc length required');
    const count = Math.max(1, Math.ceil(length / sampleStep));
    if (report.sampleCount + count + 1 > maxSamples) { report.reasons.push({ type: 'sample-budget-exceeded', id, requested: report.sampleCount + count + 1 }); return reject(); }
    const ownBody = segment.bodyEnvelope ? bodyBox(segment.bodyEnvelope) : measured;
    report.segments.push({ id, startU, endU, direction, length, samples: count + 1, maximumStep: length / count, bodyEnvelope: { min: ownBody.bounds.min.toArray(), max: ownBody.bounds.max.toArray(), bodyLift: ownBody.lift } });
    for (let i = 0; i <= count; i++) {
      const u = startU + (endU - startU) * i / count, point = curve.getPointAt(u, new T.Vector3()), tangent = curve.getTangentAt(u, new T.Vector3()).normalize().multiplyScalar(direction);
      const right = point.clone().normalize().cross(tangent).normalize(), up = tangent.clone().cross(right).normalize();
      if (![...point.toArray(), ...tangent.toArray()].every(Number.isFinite) || right.length() < .9) throw new RangeError('Invalid world curve sample/frame');
      const poseWorld = new T.Matrix4().makeBasis(right, up, tangent).multiply(new T.Matrix4().makeRotationY(-Math.PI / 2));
      poseWorld.setPosition(point.clone().addScaledVector(up, ownBody.lift));
      const poseLocal = fromWorld.clone().multiply(poseWorld), corners = [];
      for (const x of [ownBody.bounds.min.x, ownBody.bounds.max.x]) for (const y of [ownBody.bounds.min.y, ownBody.bounds.max.y]) for (const z of [ownBody.bounds.min.z, ownBody.bounds.max.z]) corners.push(new T.Vector3(x, y, z).applyMatrix4(poseLocal));
      report.sampleCount++;
      const pose = { id, i, u, corners, poseLocal, body: ownBody.bounds };
      allPoses.push(pose);
      const clipped = clippedPoints(corners, { xMin: -bandHalfWidth, xMax: bandHalfWidth, zMin: -.5 * scale });
      if (!clipped.length) continue;
      const localBounds = new T.Box3().setFromPoints(clipped);
      if (localBounds.min.y > 2.8 * scale) continue;
      pose.localBounds = localBounds;
      poses.push(pose);
      report.relevantPoses.push({ id, i, u, min: localBounds.min.toArray(), max: localBounds.max.toArray() });
    }
  }
  if (!poses.length) { report.reasons.push({ type: 'no-old-shore-crossing-in-waterfall-band' }); return reject(); }
  const outermost = Math.max(...poses.map(p => p.localBounds.max.z));
  const required = Math.max(0, outermost + margin - minimumCurtainOffset), reach = Math.ceil(required * 1000) / 1000;
  report.maximumVehicleZWithinBand = outermost; report.requiredReach = required; report.proposedReach = reach;
  if (reach > maxReach) { report.reasons.push({ type: 'required-reach-exceeds-limit', required: reach, maximum: maxReach }); return reject(); }
  const centers = [-width * .29, 0, width * .29], radius = width * .12;
  for (const pose of poses) for (const center of centers) {
    // Exact projecting-sill dimensions in the current waterfall factory.
    const under = clippedPoints(pose.corners, { xMin: center - radius * 1.075, xMax: center + radius * 1.075, zMin: -1.105 * scale, zMax: reach + .745 * scale });
    if (!under.length) continue;
    const highestBodyY = Math.max(...under.map(p => p.y)), headroom = -.16 * scale - highestBodyY;
    report.channelHeadroom.push({ id: pose.id, i: pose.i, u: pose.u, outletX: center, highestBodyY, sillUndersideY: -.16 * scale, headroom });
    if (headroom < verticalMargin) report.reasons.push({ type: 'insufficient-channel-headroom', id: pose.id, i: pose.i, u: pose.u, headroom, required: verticalMargin });
  }
  if (!report.channelHeadroom.length) report.reasons.push({ type: 'rail-does-not-pass-under-any-outboard-channel' });
  const read = (fn, x, z, label) => { const value = fn(x, z), height = typeof value === 'number' ? value : value?.height; if (height == null) return null; if (!Number.isFinite(height)) throw new TypeError(`${label} must return finite castle-local Y or null`); return height; };
  const impactZ = reach + width * .163;
  for (const x of [-width * .66, -width * .495, ...centers, width * .495, width * .66]) for (const dz of [-2.13 * scale, 0, 2.63 * scale]) {
    const castlePoint = new T.Vector3(x, 0, impactZ + dz).applyMatrix4(toCastle), seaY = read(sampleSea, castlePoint.x, castlePoint.z, 'sampleSea'), landY = sampleTerrain ? read(sampleTerrain, castlePoint.x, castlePoint.z, 'sampleTerrain') : null;
    const sample = { localX: x, localZ: impactZ + dz, castleXZ: [castlePoint.x, castlePoint.z], seaY, receivingLocalY: seaY === null ? null : seaY - waterfall.position[1], terrainY: landY };
    report.impactSamples.push(sample);
    if (sampleTerrain && landY === null) report.reasons.push({ type: 'missing-receiving-terrain', localX: x, localZ: impactZ + dz });
    if (seaY === null) report.reasons.push({ type: 'missing-receiving-sea', localX: x, localZ: impactZ + dz });
    else if (landY !== null && landY >= seaY - .05) report.reasons.push({ type: 'impact-covered-by-land', localX: x, localZ: impactZ + dz, seaY, landY });
    if (sample.receivingLocalY !== null && sample.receivingLocalY >= -.1) report.reasons.push({ type: 'receiving-sea-not-below-outlet', localX: x, localZ: impactZ + dz });
  }
  const centerImpact = report.impactSamples.find(p => Math.abs(p.localX) < 1e-9 && Math.abs(p.localZ - impactZ) < 1e-9);
  const dropHeight = centerImpact?.receivingLocalY == null ? null : -centerImpact.receivingLocalY;
  report.receivingSea = { impactZ, dropHeight, sampled: report.impactSamples.filter(p => p.seaY !== null).length, requested: report.impactSamples.length, terrainChecked: sampleTerrain !== null };
  if (report.reasons.length) return reject();

  // Instantiate and immediately release the current real outlet/sill geometry;
  // do not substitute a proxy box for the three genuine outlet arches.
  const asset = createTargetOldCityWaterfall({ width, dropHeight, outboardReach: reach });
  try {
    const stone = asset.group.getObjectByName('target-waterfall-stone-three-arch-outlets'), p = stone.geometry.attributes.position, index = stone.geometry.index;
    const triangles = [];
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const vertices = [0, 1, 2].map(k => new T.Vector3().fromBufferAttribute(p, index ? index.getX(i + k) : i + k));
      triangles.push({ triangle: new T.Triangle(...vertices), box: new T.Box3().setFromPoints(vertices), face: i / 3 });
    }
    const stoneBounds = new T.Box3();
    for (const item of triangles) stoneBounds.union(item.box);
    report.stoneCheckPoseCount = allPoses.length;
    for (const pose of allPoses) {
      const bounds = new T.Box3().setFromPoints(pose.corners), inversePose = pose.poseLocal.clone().invert();
      let contact = null;
      for (const item of triangles) {
        if (!bounds.intersectsBox(item.box)) continue;
        const t = item.triangle.clone(); t.a.applyMatrix4(inversePose); t.b.applyMatrix4(inversePose); t.c.applyMatrix4(inversePose);
        if (pose.body.intersectsTriangle(t)) { contact = { type: 'triangle-obb', face: item.face }; break; }
      }
      // A body fully inside a closed stone solid need not cross any surface.
      // Signed crossings cancel coincident internal caps in merged masonry.
      const center = pose.body.getCenter(new T.Vector3()).applyMatrix4(pose.poseLocal);
      if (!contact && stoneBounds.containsPoint(center)) {
        const ray = new T.Ray(center, new T.Vector3(.731, .419, .539).normalize()), crossings = [];
        for (const item of triangles) {
          const point = ray.intersectTriangle(item.triangle.a, item.triangle.b, item.triangle.c, false, new T.Vector3());
          if (!point || point.distanceTo(center) <= 1e-7) continue;
          const sign = Math.sign(item.triangle.getNormal(new T.Vector3()).dot(ray.direction));
          if (sign) crossings.push({ distance: point.distanceTo(center), sign });
        }
        crossings.sort((a, b) => a.distance - b.distance);
        let winding = 0;
        for (let i = 0; i < crossings.length;) {
          const distance = crossings[i].distance; let signs = 0;
          while (i < crossings.length && Math.abs(crossings[i].distance - distance) <= 1e-6) signs += crossings[i++].sign;
          winding += Math.sign(signs);
        }
        if (winding !== 0) contact = { type: 'closed-solid-containment' };
      }
      if (contact) report.stoneContacts.push({ id: pose.id, i: pose.i, u: pose.u, mesh: stone.name, ...contact });
    }
    report.waterfallGeometryVersion = asset.report.version; report.stoneTriangleCount = triangles.length;
  } finally { asset.dispose(); }
  if (report.stoneContacts.length) { report.reasons.push({ type: 'actual-outlet-or-channel-stone-intersects-vehicle', count: report.stoneContacts.length }); return reject(); }
  report.minimumChannelHeadroom = Math.min(...report.channelHeadroom.map(p => p.headroom));
  report.minimumAnimatedCurtainSeparation = reach + minimumCurtainOffset - outermost;
  report.accepted = true; report.status = 'finite-reach-solved-not-installed';
  return { outboardReach: reach, options: { outboardReach: reach, dropHeight }, report };
}
