import * as T from 'three';
import { createTargetDoubleDeckBridge } from './targetDoubleDeckBridge.js?revision=containment-v2';
import { TARGET_ARCHITECTURE_PALETTE } from './targetArchitecturePalette.js';

export const TARGET_CLIFF_RAIL_GALLERY_VERSION = 'target-cliff-rail-gallery-1';
const faces = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
const finite3 = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

/**
 * Open cliffside gallery, never a mountain tunnel. worldCurve is borrowed and
 * remains unchanged. All output meshes use castle-local coordinates; caller
 * explicitly attaches group to the castle after checking report.
 *
 * walkwayHeight: metres above the track frame, or ({u,world,local})=>metres.
 * seaSide: +1/-1 along radial-up CROSS curve tangent, or the same callback.
 * Height samplers: (castleX,castleZ)=>castleY|{height}|null, read-only.
 * endpointTargets optionally supplies {start:[worldXYZ],end:[worldXYZ]} for
 * upper-walkway endpoints; no automatic ramp or repositioning is performed.
 * No railway, vehicle, terrain, building or parent scene is changed.
 */
export function createTargetCliffRailGallery({
  worldCurve, castleMatrix, sampleTerrain = null, sampleSea = null,
  walkwayHeight = 5.2, walkwayWidth = 4.4, seaSide = 1,
  laneSpacing = 4.1, vehicleEnvelope = {}, maxSpan = 12, pierWidth = 1.2,
  sideRibThickness = .6, sampleStep = .75, roofWidth = null,
  endpointTargets = null, endpointTolerance = .15, maximumWalkingGrade = .12,
  palette = {},
} = {}) {
  if (!worldCurve?.getPointAt || !worldCurve?.getTangentAt || !worldCurve?.getLength) throw new TypeError('worldCurve is required');
  const matrix = castleMatrix?.isMatrix4 ? castleMatrix.clone() : new T.Matrix4().fromArray(castleMatrix ?? []);
  if (!matrix.elements.every(Number.isFinite) || Math.abs(matrix.determinant()) < 1e-12) throw new TypeError('finite invertible castleMatrix required');
  const inverse = matrix.clone().invert(), length = worldCurve.getLength();
  for (const [key, value] of Object.entries({ walkwayWidth, laneSpacing, maxSpan, pierWidth, sideRibThickness, sampleStep, endpointTolerance, maximumWalkingGrade })) if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${key} must be positive and finite`);
  if (!Number.isFinite(length) || length < 8 || length > 1000 || walkwayWidth < 2.4 || maxSpan < 8 || sampleStep > 2) throw new RangeError('gallery length, width, span or sampling outside supported range');
  if (typeof walkwayHeight !== 'function' && (!Number.isFinite(walkwayHeight) || walkwayHeight <= 0)) throw new TypeError('walkwayHeight must be positive metres or a function');
  if (typeof seaSide !== 'function' && ![-1, 1].includes(seaSide)) throw new TypeError('seaSide must be +1/-1 or a function');
  if (endpointTargets && ['start', 'end'].some(key => endpointTargets[key] !== undefined && !finite3(endpointTargets[key]))) throw new TypeError('endpointTargets use finite WORLD triples');
  const body = { halfWidth: 1.72, lateralMargin: .6, ...vehicleEnvelope };
  const clearHalf = laneSpacing / 2 + body.halfWidth + body.lateralMargin;
  const sideCenter = clearHalf + Math.max(pierWidth, sideRibThickness) / 2 + .35;
  const coverWidth = roofWidth ?? sideCenter * 2 + sideRibThickness;
  if (!Number.isFinite(coverWidth) || coverWidth < walkwayWidth || coverWidth < clearHalf * 2) throw new RangeError('roofWidth must cover both track envelopes and the walkway');
  const group = new T.Group(); group.name = 'citadel-target-cliff-rail-gallery'; group.userData.preserveCitadelMaterials = true;
  const upper = new T.Group(); upper.name = 'gallery-upper-public-walkway';
  const geometries = new Set(), materials = new Set(), colours = { stone: TARGET_ARCHITECTURE_PALETTE.stone, trim: TARGET_ARCHITECTURE_PALETTE.trim, deck: '#e5dccb', rail: '#8b7e69', ...palette }, mats = {};
  for (const [key, color] of Object.entries(colours)) { const m = new T.MeshStandardMaterial({ color, roughness: key === 'rail' ? .76 : .92 }); m.name = `cliff-gallery-${key}`; m.userData.preserveCitadelMaterial = true; mats[key] = m; materials.add(m); }
  let structure = null, disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; group.removeFromParent(); structure?.dispose(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); upper.clear(); group.clear(); };
  try {
    const frame = u => {
      const point = worldCurve.getPointAt(u, new T.Vector3()), tangent = worldCurve.getTangentAt(u, new T.Vector3()).normalize();
      const right = point.clone().normalize().cross(tangent).normalize(), up = tangent.clone().cross(right).normalize();
      if (![...point.toArray(), ...up.toArray()].every(Number.isFinite) || right.length() < .9) throw new RangeError('finite nonsingular radial track frame required');
      const args = { u, world: point.toArray(), local: point.clone().applyMatrix4(inverse).toArray() };
      const height = typeof walkwayHeight === 'function' ? walkwayHeight(args) : walkwayHeight;
      const side = typeof seaSide === 'function' ? seaSide(args) : seaSide;
      if (!Number.isFinite(height) || height <= 0 || ![-1, 1].includes(side)) throw new RangeError('height/seaSide callback returned invalid value');
      return { u, point, tangent, right, up, height, side };
    };
    const at = (f, x, y, z = 0) => f.point.clone().addScaledVector(f.right, x).addScaledVector(f.up, y).addScaledVector(f.tangent, z);
    function prism(points, positions, startCap = true, endCap = true) {
      for (let k = 0; k < faces.length; k++) {
        if (!endCap && k >= 18 && k < 24 || !startCap && k >= 30) continue;
        positions.push(...points[faces[k]].clone().applyMatrix4(inverse).toArray());
      }
    }
    function strip(a, b, x0, x1, a0, a1, b0, b1, positions, startCap = true, endCap = true) { prism([at(a, x0, a0), at(b, x0, b0), at(b, x1, b0), at(a, x1, a0), at(a, x0, a1), at(b, x0, b1), at(b, x1, b1), at(a, x1, a1)], positions, startCap, endCap); }
    function mesh(name, positions, role, walkable = false) {
      if (!positions.length || positions.some(v => !Number.isFinite(v))) throw new RangeError(`invalid gallery mesh ${name}`);
      const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals(); geometries.add(geometry);
      const object = new T.Mesh(geometry, mats[role]); object.name = name; object.castShadow = object.receiveShadow = true;
      object.userData.preserveCitadelMaterials = true; if (walkable) object.userData.targetWalkable = true;
      upper.add(object); return object;
    }
    const n = Math.ceil(length / sampleStep), frames = Array.from({ length: n + 1 }, (_, i) => frame(i / n));
    const deck = [], roof = [], curbs = [], handrails = [], posts = [], walkSurfaces = [];
    for (let i = 0; i < n; i++) {
      // A real 4cm endpoint apron keeps the declared attachment point inside
      // the Float32 top surface, rather than exactly on a rounded-away edge.
      const a = i === 0 ? { ...frames[i], point: at(frames[i], 0, 0, -.04) } : frames[i];
      const b = i === n - 1 ? { ...frames[i + 1], point: at(frames[i + 1], 0, 0, .04) } : frames[i + 1];
      strip(a, b, -walkwayWidth / 2, walkwayWidth / 2, a.height - .18, a.height, b.height - .18, b.height, deck, i === 0, i === n - 1);
      strip(a, b, -coverWidth / 2, coverWidth / 2, a.height - .48, a.height - .08, b.height - .48, b.height - .08, roof, i === 0, i === n - 1);
      for (const side of [-1, 1]) {
        const x = side * (walkwayWidth / 2 + .12);
        strip(a, b, x - .08, x + .08, a.height - .02, a.height + .16, b.height - .02, b.height + .16, curbs, i === 0, i === n - 1);
        strip(a, b, x - .045, x + .045, a.height + 1.01, a.height + 1.09, b.height + 1.01, b.height + 1.09, handrails, i === 0, i === n - 1);
      }
      const corners = [at(a, -walkwayWidth / 2, a.height), at(b, -walkwayWidth / 2, b.height), at(b, walkwayWidth / 2, b.height), at(a, walkwayWidth / 2, a.height)].map(p => p.applyMatrix4(inverse).toArray());
      walkSurfaces.push({ id: 'cliff-gallery-continuous-walk-deck', section: i, clearWidth: walkwayWidth, corners, polygon: corners.map(p => [p[0], p[2]]) });
    }
    const walkingMesh = mesh('cliff-gallery-continuous-walk-deck', deck, 'deck', true);
    mesh('cliff-gallery-track-protective-ceiling', roof, 'stone');
    mesh('cliff-gallery-edge-curbs', curbs, 'trim'); mesh('cliff-gallery-handrails', handrails, 'rail');
    const postCount = Math.ceil(length / 2.5);
    for (let i = 0; i <= postCount; i++) {
      // No crosswise end rails; posts remain strictly outside the clear lane.
      const f = frame(i / postCount);
      for (const side of [-1, 1]) {
        const x = side * (walkwayWidth / 2 + .12), a = { ...f, point: at(f, 0, 0, -.055) }, b = { ...f, point: at(f, 0, 0, .055) };
        strip(a, b, x - .055, x + .055, f.height + .12, f.height + 1.05, f.height + .12, f.height + 1.05, posts);
      }
    }
    mesh('cliff-gallery-rail-posts', posts, 'rail');

    const spanCount = Math.ceil(length / maxSpan), openings = [];
    for (let i = 0; i < spanCount; i++) {
      const start = i / spanCount, end = (i + 1) / spanCount, side = frame((start + end) / 2).side, arch = [], count = 24;
      const spanLength = length / spanCount;
      const bottom = (t, h) => {
        const s = T.MathUtils.clamp((t * spanLength - pierWidth / 2) / (spanLength - pierWidth), 0, 1);
        return .25 + Math.max(.1, h - .94) * Math.sqrt(Math.max(0, 1 - (2 * s - 1) ** 2));
      };
      for (let j = 0; j < count; j++) {
        const ta = j / count, tb = (j + 1) / count, a = frame(start + (end - start) * ta), b = frame(start + (end - start) * tb);
        strip(a, b, side * sideCenter - sideRibThickness / 2, side * sideCenter + sideRibThickness / 2, bottom(ta, a.height), a.height - .18, bottom(tb, b.height), b.height - .18, arch, j === 0, j === count - 1);
      }
      mesh(`cliff-gallery-open-seaward-arch-${i}`, arch, 'stone');
      openings.push({ span: i, startU: start, endU: end, seaSide: side, centerOffset: side * sideCenter, clearAlongWidth: spanLength - pierWidth, springHeightAboveTrack: .25, crownHeightAboveTrack: bottom(.5, frame((start + end) / 2).height), genuineOpening: true, rockExcavated: false });
    }

    // The bridge factory audits ALL generated upper meshes (including facade
    // arches), so an arch is never silently excluded from train clearance.
    upper.matrixAutoUpdate = false; upper.matrix.copy(matrix); upper.updateMatrixWorld(true);
    const upperPath = frames.map(f => at(f, 0, f.height).applyMatrix4(inverse).toArray());
    structure = createTargetDoubleDeckBridge({ upperPath, upperDeck: upper, worldCurve, castleMatrix: matrix, sampleTerrain, sampleSea, laneSpacing, vehicleEnvelope, maxSpan, pierWidth, sideRibThickness, sampleStep, palette: { stone: colours.stone, trim: colours.trim, deck: colours.deck } });
    upper.matrix.identity(); upper.matrixAutoUpdate = true; upper.updateMatrixWorld(true);
    group.add(structure.group, upper);

    let maximumGrade = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = at(frames[i - 1], 0, frames[i - 1].height), b = at(frames[i], 0, frames[i].height), delta = b.clone().sub(a), radial = a.clone().add(b).normalize(), vertical = Math.abs(delta.dot(radial));
      maximumGrade = Math.max(maximumGrade, vertical / Math.sqrt(Math.max(1e-12, delta.lengthSq() - vertical * vertical)));
    }
    const endpoint = f => ({ railWorld: f.point.toArray(), railLocal: f.point.clone().applyMatrix4(inverse).toArray(), walkWorld: at(f, 0, f.height).toArray(), walkLocal: at(f, 0, f.height).applyMatrix4(inverse).toArray(), tangentWorld: f.tangent.toArray(), clearWidth: walkwayWidth, open: true });
    const endpoints = { start: endpoint(frames[0]), end: endpoint(frames.at(-1)) };
    for (const key of ['start', 'end']) {
      const target = endpointTargets?.[key]; endpoints[key].targetWorld = target ? [...target] : null;
      endpoints[key].targetGap = target ? new T.Vector3(...target).distanceTo(new T.Vector3(...endpoints[key].walkWorld)) : null;
      endpoints[key].connected = target ? endpoints[key].targetGap <= endpointTolerance : false;
    }
    // Check actual triangle tops across the registered public width. These are
    // support samples only; gameplay body navigation is separately exercised by
    // the existing provider and is not claimed fully solved by these rays.
    upper.matrixAutoUpdate = false; upper.matrix.copy(matrix); upper.updateMatrixWorld(true);
    const ray = new T.Raycaster(), supportFailures = [];
    for (let i = 0; i < frames.length; i++) for (const x of [-walkwayWidth / 2 + .4, 0, walkwayWidth / 2 - .4]) {
      const f = frames[i], expected = at(f, x, f.height); ray.set(expected.clone().addScaledVector(f.up, .3), f.up.clone().negate()); ray.near = 0; ray.far = .65;
      const hits = ray.intersectObject(walkingMesh, false);
      if (!hits.length || Math.abs(hits[0].point.distanceTo(expected)) > .045) supportFailures.push({ i, u: f.u, x, expectedWorld: expected.toArray(), hitWorld: hits[0]?.point.toArray() ?? null });
    }
    upper.matrix.identity(); upper.matrixAutoUpdate = true; group.updateMatrixWorld(true);
    const issues = [...structure.report.issues];
    if (maximumGrade > maximumWalkingGrade) issues.push({ type: 'walkway-grade-exceeded', actual: maximumGrade, limit: maximumWalkingGrade });
    for (const key of ['start', 'end']) if (endpoints[key].targetWorld && !endpoints[key].connected) issues.push({ type: 'endpoint-gap', end: key, distance: endpoints[key].targetGap });
    if (supportFailures.length) issues.push({ type: 'walkway-support-failed', count: supportFailures.length });
    const report = {
      version: TARGET_CLIFF_RAIL_GALLERY_VERSION, installed: false, accepted: false,
      status: issues.length || !structure.report.vehicleClearance.pass || structure.report.terrainClearance.pass !== true ? 'rejected-or-unresolved-candidate' : 'finite-geometry-checked-uninstalled',
      frame: 'castle-local identity output; source curve and endpointTargets world-space',
      length, walkwayWidth, roofWidth: coverWidth, sideCenter, endpointApronExtension: .04, walkwayHeightMode: typeof walkwayHeight === 'function' ? 'callback' : 'constant-offset',
      upperPath, walkSurfaces, endpoints, openings, issues, maximumWalkingGrade: maximumGrade, walkingGradePass: maximumGrade <= maximumWalkingGrade,
      supportSamples: { count: frames.length * 3, failures: supportFailures, pass: supportFailures.length === 0, method: 'actual registered top triangles at center and both public edges' },
      vehicleClearance: structure.report.vehicleClearance, terrainClearance: structure.report.terrainClearance,
      foundations: structure.report.supports, foundationSampledPass: structure.report.foundationSampledPass,
      lowerRadius: structure.report.lowerRadius, lowerStructure: structure.report,
      navigation: { explicitTargetWalkable: walkingMesh.name, providerRefreshRequiredAfterAttach: true, integrated: false, continuousBodySweep: false },
      performance: { meshes: upper.children.length + structure.report.performance.meshes, triangles: [...geometries].reduce((sum, g) => sum + g.attributes.position.count / 3, 0) + structure.report.performance.triangles },
      validation: { gpuVerified: false, railInstalled: false, engineeringLoadCapacity: false, fullNavigation: false, finalRouteAccepted: false },
      limitations: ['Geometry and finite clearance only; no world curve, terrain, landmark or old scene is modified.', 'The sea-facing side is caller supplied; callbacks may vary it per span but do not discover coast orientation automatically.', 'Endpoint matching only compares supplied points; callers must construct any real connecting ramp or landing.', 'Protective roof spans both track envelopes; only the central guarded walkway is registered for player support.', 'Dynamic train separation, ship routes, wave crests and continuous body sweeps remain separate acceptance checks.'],
    };
    group.userData.bridgeCandidateReport = report;
    return { group, report, dispose };
  } catch (error) { dispose(); throw error; }
}
