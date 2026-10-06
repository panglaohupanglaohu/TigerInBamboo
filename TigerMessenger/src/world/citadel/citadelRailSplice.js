import { Curve, Vector3 } from 'three';

export const CITADEL_RAIL_SPLICE_VERSION = 'citadel-rail-splice-1';

export class CitadelRailSpliceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CitadelRailSpliceError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => { throw new CitadelRailSpliceError(code, message, details); };
const finite = Number.isFinite;
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180 / Math.PI;
function unitProgress(value, name = 'progress') {
  if (!finite(value) || value < 0 || value > 1) fail('INVALID_PROGRESS', `${name} must be in [0, 1]`);
  return value;
}
function vectorAt(curve, method, u, label) {
  const result = curve[method](u, new Vector3());
  if (!result || ![result.x, result.y, result.z].every(finite)) fail('NONFINITE_CURVE', `${label}.${method}(${u}) is not finite`);
  const vector = new Vector3(result.x, result.y, result.z);
  if (method === 'getTangentAt') {
    if (vector.lengthSq() < 1e-18) fail('ZERO_TANGENT', `${label} has a zero tangent at ${u}`);
    vector.normalize();
  }
  return vector;
}
function curveLength(curve, label) {
  if (!curve || !['getPointAt', 'getTangentAt', 'getLength'].every(key => typeof curve[key] === 'function')) {
    fail('INVALID_CURVE', `${label} requires getPointAt/getTangentAt/getLength`);
  }
  const length = curve.getLength();
  if (!finite(length) || length <= 1e-6) fail('INVALID_LENGTH', `${label} length must be finite and positive`);
  return length;
}
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Replace ONE non-wrapping interval of a closed, arc-length-addressable curve.
 * startU/endU are source.getPointAt coordinates, NOT Catmull-Rom getPoint t.
 * Outside the interval, queries delegate to the original curve (no refitting,
 * global sampling, smoothing or parallel-lane reconstruction). New getPointAt
 * progress uses the NEW total length: migrate positions with the map methods.
 *
 * Both input curves are borrowed and must remain immutable for this handle's
 * lifetime. There are no scene changes, owned GPU resources or dispose calls.
 * getLength/getPointAt may populate Three.js's normal lazy arc-length cache.
 * Validation is finite sampling plus boundary continuity, NOT route approval:
 * grade, track gauge, terrain, water curtain, piers, ships and vehicles need
 * separate checks before installation. A wrapping replacement is deliberately
 * rejected; the current real citadel anchors do not wrap the world seam.
 */
export function createCitadelRailSplice({
  sourceCurve, replacementCurve, startU, endU, id = 'citadel', sourceId = null,
  metadata = {}, validation = {},
} = {}) {
  unitProgress(startU, 'startU');
  unitProgress(endU, 'endU');
  if (endU <= startU || endU - startU >= 1) fail('INVALID_INTERVAL', 'Require 0 <= startU < endU <= 1 and a nonempty retained interval');
  const limits = {
    positionTolerance: 1e-4,
    tangentToleranceDegrees: 0.5,
    sampleStep: 1,
    maxSamples: 65536,
    lengthRelativeTolerance: 0.01,
    arcStepRelativeTolerance: 0.05,
    ...validation,
  };
  for (const key of ['positionTolerance', 'tangentToleranceDegrees', 'sampleStep', 'lengthRelativeTolerance', 'arcStepRelativeTolerance']) {
    if (!finite(limits[key]) || limits[key] <= 0) fail('INVALID_VALIDATION', `${key} must be finite and positive`);
  }
  if (limits.tangentToleranceDegrees >= 90 || limits.lengthRelativeTolerance >= 1 || limits.arcStepRelativeTolerance >= 1 ||
      !Number.isInteger(limits.maxSamples) || limits.maxSamples < 17) fail('INVALID_VALIDATION', 'Invalid tangent, length or sampling limits');
  const oldLength = curveLength(sourceCurve, 'source');
  const replacementLength = curveLength(replacementCurve, 'replacement');
  const prefixLength = startU * oldLength, oldSpanLength = (endU - startU) * oldLength;
  const suffixLength = (1 - endU) * oldLength;
  const length = prefixLength + replacementLength + suffixLength;
  if (!finite(length)) fail('INVALID_LENGTH', 'Combined length is not finite');

  const oldStart = vectorAt(sourceCurve, 'getPointAt', startU, 'source');
  const oldEnd = vectorAt(sourceCurve, 'getPointAt', endU, 'source');
  const oldStartTangent = vectorAt(sourceCurve, 'getTangentAt', startU, 'source');
  const oldEndTangent = vectorAt(sourceCurve, 'getTangentAt', endU, 'source');
  const joins = [
    { name: 'start', sourceU: startU, point: oldStart, tangent: oldStartTangent, newU: 0 },
    { name: 'end', sourceU: endU, point: oldEnd, tangent: oldEndTangent, newU: 1 },
  ].map(join => {
    const positionError = join.point.distanceTo(vectorAt(replacementCurve, 'getPointAt', join.newU, 'replacement'));
    const tangentAngleDegrees = angle(join.tangent, vectorAt(replacementCurve, 'getTangentAt', join.newU, 'replacement'));
    if (positionError > limits.positionTolerance || tangentAngleDegrees > limits.tangentToleranceDegrees) {
      fail('JOIN_MISMATCH', `${join.name} position or tangent mismatch`, { join: join.name, positionError, tangentAngleDegrees });
    }
    return { name: join.name, sourceU: join.sourceU, world: join.point.toArray(), tangent: join.tangent.toArray(), positionError, tangentAngleDegrees };
  });
  const seamPositionError = vectorAt(sourceCurve, 'getPointAt', 0, 'source').distanceTo(vectorAt(sourceCurve, 'getPointAt', 1, 'source'));
  const seamTangentAngleDegrees = angle(vectorAt(sourceCurve, 'getTangentAt', 0, 'source'), vectorAt(sourceCurve, 'getTangentAt', 1, 'source'));
  if (seamPositionError > limits.positionTolerance || seamTangentAngleDegrees > limits.tangentToleranceDegrees) {
    fail('SOURCE_NOT_CLOSED', 'Source world seam is not position/tangent continuous', { seamPositionError, seamTangentAngleDegrees });
  }

  // Sample only the new segment. The untouched world is never rebuilt.
  const divisions = Math.max(16, Math.ceil(replacementLength / limits.sampleStep));
  if (divisions + 1 > limits.maxSamples) fail('SAMPLE_BUDGET', 'Replacement exceeds validation sample budget', { requestedSamples: divisions + 1 });
  let previous = vectorAt(replacementCurve, 'getPointAt', 0, 'replacement'), chordLength = 0;
  let maxSampleChord = 0, minSampleChord = Infinity;
  for (let i = 1; i <= divisions; i++) {
    const point = vectorAt(replacementCurve, 'getPointAt', i / divisions, 'replacement');
    vectorAt(replacementCurve, 'getTangentAt', i / divisions, 'replacement');
    const chord = point.distanceTo(previous);
    if (chord <= 1e-9) fail('DEGENERATE_REPLACEMENT', 'Replacement contains a stationary sampled span', { sample: i });
    chordLength += chord;
    maxSampleChord = Math.max(maxSampleChord, chord);
    minSampleChord = Math.min(minSampleChord, chord);
    previous = point;
  }
  const lengthRelativeError = Math.abs(chordLength - replacementLength) / replacementLength;
  if (lengthRelativeError > limits.lengthRelativeTolerance) fail('LENGTH_MISMATCH', 'Replacement length disagrees with sampled getPointAt; refine its arc cache or validation step', { chordLength, replacementLength, lengthRelativeError });
  const expectedArcStep = replacementLength / divisions;
  const maxArcStepRelativeError = Math.max(Math.abs(maxSampleChord - expectedArcStep), Math.abs(minSampleChord - expectedArcStep)) / expectedArcStep;
  if (maxArcStepRelativeError > limits.arcStepRelativeTolerance) fail('NONUNIFORM_ARC_PARAMETER', 'getPointAt is not sufficiently uniform by arc length; refine its cache or reduce validation sampleStep for a tight bend', { expectedArcStep, minSampleChord, maxSampleChord, maxArcStepRelativeError });

  const newStartU = prefixLength / length, newEndU = (prefixLength + replacementLength) / length;
  function locate(u) {
    unitProgress(u);
    // Exact boundaries retain the original endpoint. Avoid re-evaluating the
    // approved anchors on the replacement's independently cached arc table.
    if (u === 0) return { curve: sourceCurve, u: 0 };
    if (u === 1) return { curve: sourceCurve, u: 1 };
    if (u === newStartU) return { curve: sourceCurve, u: startU };
    if (u === newEndU) return { curve: sourceCurve, u: endU };
    if (u < newStartU) return { curve: sourceCurve, u: u * length / oldLength };
    if (u > newEndU) return { curve: sourceCurve, u: endU + (u - newEndU) * length / oldLength };
    return { curve: replacementCurve, u: (u - newStartU) / (newEndU - newStartU) };
  }
  function mapProgress(u, reverse, { inside = 'reject' } = {}) {
    unitProgress(u);
    if (inside !== 'reject' && inside !== 'relative') fail('INVALID_MAPPING', 'inside must be reject or relative');
    const fromStart = reverse ? newStartU : startU, fromEnd = reverse ? newEndU : endU;
    const fromLength = reverse ? length : oldLength, toLength = reverse ? oldLength : length;
    const toStart = reverse ? startU : newStartU, toEnd = reverse ? endU : newEndU;
    let progress, region, positionPreserved = true;
    if (u === 0 || u === 1) { progress = u; region = 'seam'; }
    else if (u <= fromStart) { progress = u === fromStart ? toStart : u * fromLength / toLength; region = 'prefix'; }
    else if (u >= fromEnd) { progress = u === fromEnd ? toEnd : toEnd + (u - fromEnd) * fromLength / toLength; region = 'suffix'; }
    else {
      if (inside === 'reject') fail('VEHICLE_INSIDE_REPLACED_INTERVAL', 'Position in replaced interval requires explicit migration policy', { progress: u, reverse });
      progress = toStart + (u - fromStart) / (fromEnd - fromStart) * (toEnd - toStart);
      region = 'replacement'; positionPreserved = false;
    }
    // At source 0/1 which belongs to a seam-adjacent replacement, the common
    // endpoint is still preserved; no wrap or movement direction is inferred.
    return { progress, distance: progress * toLength, region, positionPreserved };
  }

  class SplicedCurve extends Curve {
    constructor() { super(); this.type = 'CitadelRailSpliceCurve'; this.closed = true; this.isCitadelRailSpliceCurve = true; }
    getPointAt(u, target = new Vector3()) { const at = locate(u); return at.curve.getPointAt(at.u, target); }
    getTangentAt(u, target = new Vector3()) { const at = locate(u); return at.curve.getTangentAt(at.u, target); }
    // This adapter's parameter is already normalized arc length. Inherited
    // getPoints/getSpacedPoints/computeFrenetFrames therefore use these methods.
    getPoint(t, target) { return this.getPointAt(t, target); }
    getTangent(t, target) { return this.getTangentAt(t, target); }
    getLength() { return length; }
    getLengths(divisions = this.arcLengthDivisions) {
      if (!Number.isInteger(divisions) || divisions < 1) fail('INVALID_DIVISIONS', 'divisions must be positive');
      return Array.from({ length: divisions + 1 }, (_, i) => i / divisions * length);
    }
    getUtoTmapping(u, distance) { return unitProgress(distance === undefined ? u : distance / length); }
    updateArcLengths() { /* Immutable composition; never rebuild borrowed curves. */ }
    clone() { return new SplicedCurve(); }
    toJSON() { fail('REFERENCE_ONLY', 'Persist handle.report plus versioned source/replacement descriptions, not a sampled global curve'); }
  }
  const curve = new SplicedCurve();
  const report = deepFreeze({
    version: CITADEL_RAIL_SPLICE_VERSION, id, sourceId,
    status: 'offline-composition-validated-not-installed',
    oldLength, length, oldSpanLength, replacementLength, prefixLength, suffixLength,
    sourceInterval: [startU, endU], replacementInterval: [newStartU, newEndU], joins,
    seam: { positionError: seamPositionError, tangentAngleDegrees: seamTangentAngleDegrees },
    validation: { ...limits, samples: divisions + 1, chordLength, lengthRelativeError, expectedArcStep, maxArcStepRelativeError, minSampleChord, maxSampleChord },
    untouchedGeometry: 'delegated to original getPointAt/getTangentAt, without resampling',
    mapping: 'new arc-length progress; replaced interiors reject by default; relative migration is explicit and not position preserving',
    rollback: { strategy: 'restore borrowed source curve reference and remap progress; rebuild dependent track/stop/interlocking state externally', sourceId },
    routeAcceptance: { installed: false, grade: false, terrain: false, structures: false, twinTrackGauge: false, dynamicVehicles: false },
    metadata: JSON.parse(JSON.stringify(metadata)),
  });
  return Object.freeze({
    curve, report, sourceCurve, replacementCurve,
    mapOriginalProgress: (u, options) => mapProgress(u, false, options),
    mapSplicedProgress: (u, options) => mapProgress(u, true, options),
    mapOriginalDistance: (distance, options) => mapProgress(unitProgress(distance / oldLength, 'distance/oldLength'), false, options),
    mapSplicedDistance: (distance, options) => mapProgress(unitProgress(distance / length, 'distance/newLength'), true, options),
    // Useful when callers retain old u anchors: exact original u outside the
    // edited interval, with no multiplication/division round-trip whatsoever.
    getPointAtOriginalProgress(u, target = new Vector3(), options) {
      unitProgress(u);
      if (u <= startU || u >= endU) return sourceCurve.getPointAt(u, target);
      return curve.getPointAt(mapProgress(u, false, options).progress, target);
    },
    rollback: () => sourceCurve,
  });
}

/** Validate all explicitly supplied center/red/blue lanes before returning any
 * handle. No centerline is inferred by averaging red/blue at equal u: they have
 * different lengths/anchors. Returns original references for atomic rollback. */
export function createCitadelRailSpliceSet({ lanes } = {}) {
  if (!lanes || typeof lanes !== 'object' || Array.isArray(lanes)) fail('INVALID_LANES', 'lanes must contain explicit curve specifications');
  const keys = Object.keys(lanes);
  if (!keys.length || keys.some(key => !['center', 'red', 'blue'].includes(key))) fail('INVALID_LANES', 'Only center/red/blue lane keys are supported');
  const handles = {}, curves = {}, originals = {};
  for (const key of keys) {
    handles[key] = createCitadelRailSplice({ ...lanes[key], id: key });
    curves[key] = handles[key].curve;
    originals[key] = handles[key].sourceCurve;
  }
  Object.freeze(handles); Object.freeze(curves); Object.freeze(originals);
  return Object.freeze({
    lanes: handles, curves,
    report: deepFreeze({ version: CITADEL_RAIL_SPLICE_VERSION, installed: false, lanes: Object.fromEntries(keys.map(key => [key, handles[key].report])), twinTrackClearanceVerified: false }),
    rollback: () => originals,
  });
}
