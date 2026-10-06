import * as T from 'three';

export const TARGET_DOUBLE_DECK_BRIDGE_VERSION = 'target-double-deck-bridge-2';
const finite3 = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const v3 = p => new T.Vector3(...p);
const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const legacySupport = name => /^bay-bridge-(true-arch-|pier-|batched-arch-stones$)/.test(name);
const faces = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];

function collectTriangles(root, predicate = () => true) {
  root.updateWorldMatrix(true, true);
  const meshes = [];
  root.traverse(mesh => {
    if (!mesh.isMesh || !visible(mesh) || !predicate(mesh)) return;
    const p = mesh.geometry?.attributes.position, ix = mesh.geometry?.index;
    if (!p) return;
    const matrices = [];
    if (mesh.isInstancedMesh) for (let i = 0; i < mesh.count; i++) {
      const m = new T.Matrix4(); mesh.getMatrixAt(i, m);
      if (Math.abs(m.determinant()) > 1e-12) matrices.push(mesh.matrixWorld.clone().multiply(m));
    } else matrices.push(mesh.matrixWorld.clone());
    for (const matrix of matrices) {
      const triangles = [], box = new T.Box3();
      for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
        const points = [0, 1, 2].map(k => new T.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + k) : i + k).applyMatrix4(matrix));
        if (points.some(v => !v.toArray().every(Number.isFinite))) throw new TypeError(`Nonfinite mesh ${mesh.name}`);
        const triangle = new T.Triangle(...points), bounds = new T.Box3().setFromPoints(points);
        triangles.push({ triangle, box: bounds }); box.union(bounds);
      }
      meshes.push({ name: mesh.name, uuid: mesh.uuid, triangles, box });
    }
  });
  return meshes;
}

// Actual mesh triangles against the full oriented vehicle volume. The ray
// signed-crossing fallback catches a vehicle wholly enclosed in a closed solid.
function overlapsBody(meshes, body, matrix) {
  const inverse = matrix.clone().invert(), worldBox = body.clone().applyMatrix4(matrix), hits = [];
  const center = body.getCenter(new T.Vector3()).applyMatrix4(matrix);
  const ray = new T.Ray(center, new T.Vector3(.731, .419, .539).normalize());
  for (const mesh of meshes) {
    if (!mesh.box.intersectsBox(worldBox)) continue;
    let contact = null;
    for (const item of mesh.triangles) {
      if (!item.box.intersectsBox(worldBox)) continue;
      const triangle = item.triangle.clone();
      triangle.a.applyMatrix4(inverse); triangle.b.applyMatrix4(inverse); triangle.c.applyMatrix4(inverse);
      if (body.intersectsTriangle(triangle)) { contact = { name: mesh.name, uuid: mesh.uuid, type: 'triangle-obb' }; break; }
    }
    if (!contact && mesh.box.containsPoint(center)) {
      const crossings = [];
      for (const item of mesh.triangles) {
        const point = ray.intersectTriangle(item.triangle.a, item.triangle.b, item.triangle.c, false, new T.Vector3());
        if (point && point.distanceTo(center) > 1e-7) {
          const facing = item.triangle.getNormal(new T.Vector3()).dot(ray.direction);
          if (Math.abs(facing) > 1e-10) crossings.push({ distance: point.distanceTo(center), sign: Math.sign(facing) });
        }
      }
      crossings.sort((a, b) => a.distance - b.distance);
      let winding = 0;
      for (let i = 0; i < crossings.length;) {
        const distance = crossings[i].distance; let signs = 0;
        while (i < crossings.length && Math.abs(crossings[i].distance - distance) <= 1e-6) signs += crossings[i++].sign;
        // Two adjacent closed prisms have opposite internal caps at the same
        // distance: cancel them. Coplanar triangulation seams with the same
        // facing count once. Plain distance deduplication falsely counted an
        // internal cap as a boundary and marked exterior space as solid.
        winding += Math.sign(signs);
      }
      if (winding !== 0) contact = { name: mesh.name, uuid: mesh.uuid, type: 'closed-solid-containment' };
    }
    if (contact) hits.push(contact);
  }
  return hits;
}

/**
 * Independent, UNINSTALLED structure under an existing pedestrian bridge.
 * upperPath is castle-local; upperDeck is the actual existing bridge root with
 * current world transforms (targetWalkable meshes identify the retained deck).
 * worldCurve is a measured/proposed open centerline in world coordinates;
 * this factory does not change it, create rails, move the upper deck, excavate
 * terrain, or hide legacy supports. Return group has castle-local geometry and
 * must later be parented under the SAME castle matrix by the caller.
 *
 * sampleTerrain/sampleSea: (castleX,castleZ) -> castleY | {height} | null.
 * Missing foundations remain unknown, with no fake underwater column bottoms.
 * Caller owns upperDeck/worldCurve. dispose owns ONLY newly created resources.
 */
export function createTargetDoubleDeckBridge({
  upperPath, upperDeck, worldCurve, castleMatrix, sampleTerrain = null, sampleSea = null,
  laneSpacing = 4.1,
  vehicleEnvelope = {},
  maxSpan = 28, pierWidth = 1.6, sideRibThickness = .7, deckThickness = .55,
  deckTopOffset = -.75, beamThickness = .36, sampleStep = .75,
  maximumFoundationDepth = 90, requiredBoatWidth = 4, requiredBoatHeight = 3, requiredWaterDepth = .8,
  palette = {},
} = {}) {
  if (!Array.isArray(upperPath) || upperPath.length < 2 || !upperPath.every(finite3)) throw new TypeError('Actual finite upperPath required');
  if (!upperDeck?.isObject3D || !worldCurve?.getPointAt || !worldCurve?.getTangentAt || !worldCurve?.getLength) throw new TypeError('Actual upperDeck root and world curve required');
  const matrix = castleMatrix?.isMatrix4 ? castleMatrix.clone() : new T.Matrix4().fromArray(castleMatrix ?? []);
  if (!matrix.elements.every(Number.isFinite) || Math.abs(matrix.determinant()) < 1e-12) throw new TypeError('Invertible finite castleMatrix required');
  const inverse = matrix.clone().invert(), rotation = new T.Matrix3().setFromMatrix4(matrix);
  const axes = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)].map(v => v.applyMatrix3(rotation));
  if (axes.some(v => Math.abs(v.length() - 1) > 1e-5) || Math.abs(axes[0].dot(axes[1])) > 1e-5 || Math.abs(axes[1].dot(axes[2])) > 1e-5 || Math.abs(axes[0].dot(axes[2])) > 1e-5) throw new RangeError('castleMatrix must be rigid; dimensions are metres');
  for (const [key, value] of Object.entries({ laneSpacing, maxSpan, pierWidth, sideRibThickness, deckThickness, beamThickness, sampleStep, maximumFoundationDepth, requiredBoatWidth, requiredBoatHeight, requiredWaterDepth })) if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${key} must be positive`);
  if (!Number.isFinite(deckTopOffset) || deckTopOffset >= 0 || pierWidth >= maxSpan / 3) throw new RangeError('Invalid deck or pier dimensions');
  for (const fn of [sampleTerrain, sampleSea]) if (fn !== null && typeof fn !== 'function') throw new TypeError('Surface samplers must be functions or null');
  const bodySpec = { halfWidth: 1.72, halfLength: 3.49, bottom: -.5, top: 2.642, lateralMargin: .6, topMargin: .6, bottomMargin: .1, ...vehicleEnvelope };
  if (!Object.values(bodySpec).every(Number.isFinite) || bodySpec.halfWidth <= 0 || bodySpec.halfLength <= 0 || bodySpec.top <= bodySpec.bottom || ['lateralMargin', 'topMargin', 'bottomMargin'].some(k => bodySpec[k] < 0)) throw new RangeError('Invalid finite vehicle envelope');
  const clearHalfWidth = laneSpacing / 2 + bodySpec.halfWidth + bodySpec.lateralMargin;
  // Columns are farther out than the clear swept envelope. A small extra band
  // allows for frame rotation/vehicle overhang; actual collision is still tested.
  const sideCenter = clearHalfWidth + Math.max(pierWidth, sideRibThickness) / 2 + .35;
  const deckHalfWidth = sideCenter + pierWidth / 2;
  const length = worldCurve.getLength();
  if (!Number.isFinite(length) || length < 8 || length > 1000 || sampleStep > 2 || maxSpan < 8) throw new RangeError('Bridge length/sampling/span outside candidate bounds');
  const preserved = collectTriangles(upperDeck, mesh => !legacySupport(mesh.name));
  const walking = collectTriangles(upperDeck, mesh => mesh.userData.targetWalkable === true || mesh.name.startsWith('bay-bridge-walking-deck-'));
  if (!walking.length) throw new TypeError('upperDeck contains no actual walking meshes');
  const replacementRequired = [];
  upperDeck.traverse(mesh => { if (mesh.isMesh && legacySupport(mesh.name)) replacementRequired.push({ name: mesh.name, uuid: mesh.uuid }); });

  const group = new T.Group(); group.name = 'citadel-target-double-deck-bridge';
  group.userData.preserveCitadelMaterials = true;
  const geometries = new Set(), materials = new Set(), materialMap = {};
  const colours = { stone: '#ecdcc6', trim: '#fff1dc', deck: '#e3d7c4', ...palette };
  for (const [role, color] of Object.entries(colours)) {
    const material = new T.MeshStandardMaterial({ color, roughness: .93 });
    material.name = `double-deck-${role}`; material.userData.preserveCitadelMaterial = true;
    materials.add(material); materialMap[role] = material;
  }
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; group.removeFromParent(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); group.clear(); };
  try {
    function frame(u) {
      const point = worldCurve.getPointAt(u, new T.Vector3()), forward = worldCurve.getTangentAt(u, new T.Vector3()).normalize();
      if (![...point.toArray(), ...forward.toArray()].every(Number.isFinite) || point.length() < 1 || forward.length() < .9) throw new RangeError('Invalid world radial curve frame');
      const right = point.clone().normalize().cross(forward).normalize(), up = forward.clone().cross(right).normalize();
      if (right.length() < .9) throw new RangeError('Track tangent parallel to planetary up');
      return { u, point, forward, right, up };
    }
    const at = (f, x, y, z = 0) => f.point.clone().addScaledVector(f.right, x).addScaledVector(f.up, y).addScaledVector(f.forward, z);
    function prism(points, positions) { for (const i of faces) positions.push(...points[i].clone().applyMatrix4(inverse).toArray()); }
    function between(fa, fb, x0, x1, lowerA, upperA, lowerB, upperB, positions) {
      prism([at(fa, x0, lowerA), at(fb, x0, lowerB), at(fb, x1, lowerB), at(fa, x1, lowerA), at(fa, x0, upperA), at(fb, x0, upperB), at(fb, x1, upperB), at(fa, x1, upperA)], positions);
    }
    function mesh(name, positions, role, structuralRole) {
      if (!positions.length || positions.some(v => !Number.isFinite(v))) throw new RangeError(`Invalid generated mesh ${name}`);
      const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals(); geometries.add(geometry);
      const object = new T.Mesh(geometry, materialMap[role]); object.name = name; object.castShadow = object.receiveShadow = true;
      object.userData.preserveCitadelMaterials = true; object.userData.doubleDeckStructuralRole = structuralRole;
      // Lower rail structures/columns are deliberately not player walkables.
      group.add(object); return object;
    }
    function orientedBox(name, f, x0, x1, y0, y1, z0, z1, role, structuralRole) {
      if (y1 <= y0 || x1 <= x0 || z1 <= z0) throw new RangeError(`Nonpositive ${name}`);
      const positions = [];
      prism([at(f, x0, y0, z0), at(f, x0, y0, z1), at(f, x1, y0, z1), at(f, x1, y0, z0), at(f, x0, y1, z0), at(f, x0, y1, z1), at(f, x1, y1, z1), at(f, x1, y1, z0)], positions);
      return mesh(name, positions, role, structuralRole);
    }
    const sampleCounts = { terrain: 0, sea: 0 };
    function surface(kind, world) {
      const fn = kind === 'terrain' ? sampleTerrain : sampleSea;
      if (!fn) return null;
      const local = world.clone().applyMatrix4(inverse), value = fn(local.x, local.z), height = typeof value === 'number' ? value : value?.height;
      sampleCounts[kind]++;
      if (height == null) return null;
      if (!Number.isFinite(height)) throw new TypeError(`${kind} returned nonfinite height`);
      return new T.Vector3(local.x, height, local.z).applyMatrix4(matrix);
    }
    function footing(f, x, z) {
      let previousDistance = 0;
      for (let distance = 0; distance <= maximumFoundationDepth; distance += 2) {
        const probe = at(f, x, deckTopOffset - distance, z), ground = surface('terrain', probe);
        if (!ground) return null;
        const gap = probe.clone().sub(ground).applyMatrix3(new T.Matrix3().setFromMatrix4(inverse)).y;
        if (gap <= 0) {
          let lo = previousDistance, hi = distance;
          for (let n = 0; n < 16; n++) {
            const mid = (lo + hi) / 2, p = at(f, x, deckTopOffset - mid, z), g = surface('terrain', p);
            if (!g) return null;
            const difference = p.clone().sub(g).applyMatrix3(new T.Matrix3().setFromMatrix4(inverse)).y;
            if (difference > 0) lo = mid; else hi = mid;
          }
          return { offset: deckTopOffset - (lo + hi) / 2, world: at(f, x, deckTopOffset - (lo + hi) / 2, z).toArray(), terrainAboveDeck: distance === 0 };
        }
        previousDistance = distance;
      }
      return null;
    }
    function underside(f, x = 0, z = 0) {
      const ray = new T.Ray(at(f, x, 0, z), f.up), hits = [];
      for (const m of walking) for (const { triangle } of m.triangles) {
        const hit = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, new T.Vector3());
        if (hit) hits.push({ offset: hit.clone().sub(ray.origin).dot(f.up), world: hit.toArray(), mesh: m.name });
      }
      hits.sort((a, b) => a.offset - b.offset);
      return hits[0] ?? null;
    }

    const deck = [], count = Math.ceil(length / sampleStep), frames = Array.from({ length: count + 1 }, (_, i) => frame(i / count));
    for (let i = 0; i < count; i++) between(frames[i], frames[i + 1], -deckHalfWidth, deckHalfWidth, deckTopOffset - deckThickness, deckTopOffset, deckTopOffset - deckThickness, deckTopOffset, deck);
    mesh('double-deck-lower-slab', deck, 'deck', 'lower-track-deck');
    const spanCount = Math.ceil(length / maxSpan), supports = [], openings = [], upperContacts = [], issues = [];
    const springOffset = deckTopOffset - deckThickness - 3.6;
    for (let i = 0; i <= spanCount; i++) {
      // End piers sit half a metre inside the span. Symmetric bearing probes
      // at exactly the path endpoint would sample beyond the retained slab.
      const supportU = T.MathUtils.clamp(i / spanCount, .55 / length, 1 - .55 / length);
      const f = frame(supportU), probes = [-.28, 0, .28].map(z => underside(f, 0, z));
      const known = probes.every(Boolean), minimum = known ? Math.min(...probes.map(p => p.offset)) : null;
      if (!known) issues.push({ type: 'upper-bearing-missing', station: i });
      // Missing attachment is not invented; no beam/upper legs are drawn.
      const beamTop = known ? minimum - .08 : null;
      if (known) {
        orientedBox(`double-deck-over-track-beam-${i}`, f, -sideCenter - pierWidth / 2, sideCenter + pierWidth / 2, beamTop - beamThickness, beamTop, -.42, .42, 'trim', 'upper-walkway-crossbeam');
        // A short bearing at the ray-measured deck underside; centre contact
        // is explicit, broad load distribution/engineering remains unverified.
        orientedBox(`double-deck-upper-bearing-${i}`, f, -.3, .3, beamTop, probes[1].offset + .015, -.24, .24, 'stone', 'upper-bearing');
        upperContacts.push({ station: i, u: f.u, beamTop, measuredUnderside: probes, bearingWorld: probes[1].world });
      }
      for (const side of [-1, 1]) {
        const x = side * sideCenter, feet = [];
        for (const dx of [-pierWidth / 2, pierWidth / 2]) for (const z of [-pierWidth / 2, pierWidth / 2]) feet.push(footing(f, x + dx, z));
        feet.push(footing(f, x, 0));
        const seated = feet.every(p => p !== null && !p.terrainAboveDeck);
        const bottom = seated ? Math.min(...feet.map(p => p.offset)) - .12 : null;
        const top = known ? beamTop : deckTopOffset;
        if (bottom !== null && bottom < top) orientedBox(`double-deck-side-pier-${i}-${side}`, f, x - pierWidth / 2, x + pierWidth / 2, bottom, top, -pierWidth / 2, pierWidth / 2, 'stone', 'side-foundation-and-column');
        else if (known && top > deckTopOffset) orientedBox(`double-deck-unseated-upper-column-${i}-${side}`, f, x - pierWidth / 2, x + pierWidth / 2, deckTopOffset, top, -pierWidth / 2, pierWidth / 2, 'stone', 'unseated-upper-column');
        if (!seated) issues.push({ type: feet.some(p => p?.terrainAboveDeck) ? 'terrain-intrudes-deck' : 'foundation-unknown', station: i, side });
        supports.push({ station: i, side, u: f.u, centerWorld: at(f, x, deckTopOffset).toArray(), footingSamples: feet, bottomOffset: bottom, upperOffset: top, seated });
      }
    }
    for (let i = 0; i < spanCount; i++) {
      const a = i / spanCount, b = (i + 1) / spanCount, spanLength = length / spanCount;
      const segments = Math.max(24, Math.ceil(spanLength / sampleStep)), ribPositions = [];
      const intrados = t => {
        const normalized = T.MathUtils.clamp((t * spanLength - pierWidth / 2) / (spanLength - pierWidth), 0, 1);
        return springOffset + 3.2 * Math.sqrt(Math.max(0, 1 - (2 * normalized - 1) ** 2));
      };
      for (const side of [-1, 1]) for (let j = 0; j < segments; j++) {
        const ta = j / segments, tb = (j + 1) / segments;
        between(frame(a + (b - a) * ta), frame(a + (b - a) * tb), side * sideCenter - sideRibThickness / 2, side * sideCenter + sideRibThickness / 2, intrados(ta), deckTopOffset - deckThickness, intrados(tb), deckTopOffset - deckThickness, ribPositions);
      }
      mesh(`double-deck-longitudinal-open-arches-${i}`, ribPositions, 'stone', 'two-side-open-arch-ribs');
      const f = frame((a + b) / 2), water = surface('sea', f.point), bottom = surface('terrain', f.point);
      const waterOffset = water ? water.clone().sub(f.point).dot(f.up) : null;
      const depth = water && bottom ? water.clone().sub(bottom).dot(f.up) : null;
      openings.push({ span: i, fromU: a, toU: b, clearAlongWidth: spanLength - pierWidth, centerWorld: f.point.toArray(), intradosCenterOffset: intrados(.5), waterOffset, waterDepth: depth, nominalHeadroom: waterOffset === null ? null : intrados(.5) - waterOffset, navigableSampled: null });
    }

    // Audit in world-space without attaching to or modifying the caller scene.
    group.matrixAutoUpdate = false; group.matrix.copy(matrix); group.updateMatrixWorld(true);
    const structure = collectTriangles(group), candidateMeshes = [...structure, ...preserved];
    const body = new T.Box3(new T.Vector3(-bodySpec.halfWidth - bodySpec.lateralMargin, bodySpec.bottom - bodySpec.bottomMargin, -bodySpec.halfLength), new T.Vector3(bodySpec.halfWidth + bodySpec.lateralMargin, bodySpec.top + bodySpec.topMargin, bodySpec.halfLength));
    const collisions = [], terrainIssues = [], terrainUnknown = [];
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      for (const side of [-1, 1]) {
        const origin = at(f, side * laneSpacing / 2, 0), pose = new T.Matrix4().makeBasis(f.right, f.up, f.forward).setPosition(origin);
        const hits = overlapsBody(candidateMeshes, body, pose);
        if (hits.length) collisions.push({ i, u: f.u, side, hits });
        // Terrain remains a finite final-surface check, distinct from actual
        // bridge triangle checks; it must not be hidden by clean bridge OBBs.
        for (const x of [body.min.x, 0, body.max.x]) for (const z of [body.min.z, 0, body.max.z]) {
          const p = new T.Vector3(x, body.min.y, z).applyMatrix4(pose), land = surface('terrain', p);
          if (!land) { terrainUnknown.push({ i, side }); continue; }
          if (p.clone().sub(land).applyMatrix3(new T.Matrix3().setFromMatrix4(inverse)).y < -.02) terrainIssues.push({ i, side, local: p.clone().applyMatrix4(inverse).toArray() });
        }
      }
    }
    for (const opening of openings) {
      if (opening.waterOffset === null || opening.waterDepth === null) continue;
      const f = frame((opening.fromU + opening.toU) / 2), box = new T.Box3(new T.Vector3(-deckHalfWidth - 1, opening.waterOffset - requiredWaterDepth, -requiredBoatWidth / 2), new T.Vector3(deckHalfWidth + 1, opening.waterOffset + requiredBoatHeight, requiredBoatWidth / 2));
      const pose = new T.Matrix4().makeBasis(f.right, f.up, f.forward).setPosition(f.point);
      opening.geometryHits = overlapsBody(structure, box, pose);
      opening.navigableSampled = !opening.geometryHits.length && opening.waterDepth >= requiredWaterDepth && opening.clearAlongWidth >= requiredBoatWidth;
    }
    // Return identity castle-local group, not a secretly world-transformed root.
    group.matrix.identity(); group.matrixAutoUpdate = true; group.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(group);
    const report = {
      version: TARGET_DOUBLE_DECK_BRIDGE_VERSION, installed: false, accepted: false,
      status: issues.length || collisions.length || terrainIssues.length || terrainUnknown.length ? 'rejected-or-unresolved-candidate' : 'finite-geometry-checked-uninstalled',
      frame: 'group geometry castle-local; curve, body OBBs and contact evidence world-space',
      upperPath: upperPath.map(p => [...p]), upperDeckPreserved: true,
      dimensions: { length, laneSpacing, clearWidth: clearHalfWidth * 2, deckWidth: deckHalfWidth * 2, sideCenter, pierWidth, sideRibThickness, deckThickness, deckTopOffset, beamThickness, vehicleEnvelope: bodySpec, commonSectionBodyGap: laneSpacing - bodySpec.halfWidth * 2, structuralMarginEnvelopesOverlapBetweenLanes: laneSpacing < 2 * (bodySpec.halfWidth + bodySpec.lateralMargin) },
      lowerRadius: { min: Math.min(...frames.map(f => f.point.length())), max: Math.max(...frames.map(f => f.point.length())), imposedByFactory: false },
      replacementRequired, replacementApplied: false,
      retainedUpperMeshes: walking.map(m => ({ name: m.name, uuid: m.uuid })), upperContacts, supports, openings, issues,
      vehicleClearance: { method: 'actual visible mesh triangles vs oriented full body volume, plus signed-crossing closed-solid containment; finite sampled poses', sampleStepMaximum: length / count, poses: frames.length * 2, collisions, pass: collisions.length === 0, preservedUpperAndCandidateChecked: true, legacySupportsExcludedOnlyAsExplicitReplacementPlan: true },
      terrainClearance: { issues: terrainIssues, unknown: terrainUnknown.length, pass: terrainUnknown.length ? null : terrainIssues.length === 0, method: '9 underbody final-heightfield probes per lane pose, not triangle terrain sweep' },
      foundationSampledPass: supports.every(s => s.seated), boatOpeningSampledPass: openings.some(o => o.navigableSampled === true),
      performance: { meshes: structure.length, triangles: structure.reduce((sum, m) => sum + m.triangles.length, 0), materials: materials.size, sampleCounts },
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      validation: { gpuVerified: false, engineeringLoadCapacity: false, continuousVehicleSweep: false, movingTrainSeparation: false, dynamicShips: false, globalRailConnected: false, shoreConnections: false, navigationInstalled: false },
      limitations: ['Only an uninstalled candidate; no existing supports or upper geometry are modified.', 'Upper bearing probes and foundation corner sampling establish finite geometric contacts, not structural engineering.', 'Vehicle checks use inflated oriented body volumes at finite arc-length poses; bogies/cargo not in the supplied envelope are not certified.', 'Boat opening checks cover a static transverse envelope at each span midpoint, not approach channels or all ship poses.', 'Terrain/shore corridor and global rail splice must pass independently before any deployment.'],
    };
    group.userData.targetDoubleDeckBridgeReport = report;
    return { group, report, dispose };
  } catch (error) { dispose(); throw error; }
}
