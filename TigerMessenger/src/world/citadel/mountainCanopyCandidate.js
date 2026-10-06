import * as THREE from 'three';

// Project-authored opaque 3D canopy experiment. It is not an Oskar impostor.
// The caller owns integration, visibility of legacy trees and the final surface index.
export const MOUNTAIN_CANOPY_VERSION = 'citadel-canopy-candidate-2';
const UP = new THREE.Vector3(0, 1, 0);
const hash = (x, z, salt) => {
  let h = (Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(salt | 0, 1274126177)) >>> 0;
  h = Math.imul(h ^ h >>> 13, 1274126177) >>> 0;
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
};

export function canopyHabitat(x, z) {
  // Broad continuous woodland masses with open gaps, not a row-by-row lottery.
  return .55 * Math.sin(x * .075 + .8 * Math.sin(z * .047)) +
    .42 * Math.cos(z * .094 - x * .025) + .16 * Math.sin((x + z) * .15);
}

function crownGeometry(variant, cypress = false) {
  const g = new THREE.SphereGeometry(1, 14, 9), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const r = 1 + .13 * Math.sin(a * 3 + variant * 1.9) * (1 - y * y) +
      .075 * Math.cos(a * 5 - y * 3 + variant);
    // A broad, slightly flattened crown; cypress remains an accent, not a cone row.
    p.setXYZ(i, x * r * (cypress ? .30 : 1), y * (cypress ? 1.25 : .78) + (cypress ? 1.65 : 1.28), z * r * (cypress ? .30 : .88));
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  return g;
}

function material(color, name) {
  const m = new THREE.MeshStandardMaterial({color, name, roughness: 1, metalness: 0});
  m.userData.preserveCitadelMaterial = true;
  return m;
}

// Conservative swept rail protection: a sampled rail segment must not intersect
// the whole plant world AABB expanded by the requested clearance. This includes
// overhanging crowns, not merely the root. Discontinuous lane jumps only over-reject.
export function canopyClearOfConstraints(box, protectedBoxes, rail, buildingMargin = 1, railClearance = 5) {
  if (protectedBoxes.some(b => b.clone().expandByScalar(buildingMargin).intersectsBox(box))) return false;
  const expanded = box.clone().expandByScalar(railClearance), ray = new THREE.Ray(), end = new THREE.Vector3();
  for (let i = 0; i < rail.length; i++) {
    if (expanded.containsPoint(rail[i])) return false;
    if (!i) continue;
    const delta = rail[i].clone().sub(rail[i - 1]), length = delta.length();
    if (length === 0) continue;
    ray.set(rail[i - 1], delta.multiplyScalar(1 / length));
    if (ray.intersectBox(expanded, end) && end.distanceTo(rail[i - 1]) <= length) return false;
  }
  return true;
}

/**
 * Builds detached castle-local geometry. Default disabled; no source mesh changes.
 * surfaceIndex.sample(ray,near,far) MUST query the final world-space mountain mesh.
 * protectedBoxes and rail are world-space. waterHeight(worldPoint) is optional.
 */
export function createMountainCanopyCandidate(castle, {
  enabled = false, surfaceIndex = null, protectedBoxes = [], rail = [], radius = 160,
  bounds = {x: [-112, 128], z: [-65, 98]}, seed = 54127, spacing = 2.8,
  maxTrees = 650, minSlope = .70, maxLocalHeight = 48, minAltitude = 2,
  buildingMargin = 1, railClearance = 5, waterHeight = () => 0,
} = {}) {
  const report = {version: MOUNTAIN_CANOPY_VERSION, enabled: !!enabled, method: 'opaque lobed 3D crowns; low-frequency woodland field; exact final-surface roots',
    accepted: 0, broadleaf: 0, cypress: 0, candidates: 0, rejected: {field: 0, surface: 0, slope: 0, height: 0, feet: 0, clearance: 0}, placements: [], truncated: false};
  if (!enabled) return {group: null, report, dispose() {}};
  if (!surfaceIndex?.sample) throw new TypeError('Canopy candidate requires the final surfaceIndex');
  if (!(spacing >= 2) || !(maxTrees >= 0 && maxTrees <= 1200)) throw new RangeError('Canopy candidate budget exceeded');
  if ((bounds.x[1] - bounds.x[0]) * (bounds.z[1] - bounds.z[0]) / (spacing * spacing) > 10000) throw new RangeError('Canopy candidate cell budget exceeded');
  castle.updateWorldMatrix(true, false);
  const inverse = castle.matrixWorld.clone().invert(), ray = new THREE.Ray(), V = () => new THREE.Vector3();
  const group = new THREE.Group();group.name = 'citadel-mountain-canopy-candidate';
  Object.assign(group.userData, {skipColliders: true, preserveCitadelMaterials: true, candidateVersion: MOUNTAIN_CANOPY_VERSION});
  const geometries = [0, 1, 2].map(i => crownGeometry(i));geometries.push(crownGeometry(0, true));
  const trunk = new THREE.CylinderGeometry(.085, .12, 1, 6, 1);trunk.translate(0, .5, 0);trunk.computeBoundingBox();
  const buckets = [[], [], [], []], trunkRows = [], radialRay = p => {
    const up = p.clone().normalize();ray.set(up.clone().multiplyScalar(radius + 160), up.negate());
    return surfaceIndex.sample(ray, 0, 330);
  };
  for (let iz = 0, z = bounds.z[0]; z < bounds.z[1]; z += spacing, iz++) {
    for (let ix = 0, x = bounds.x[0]; x < bounds.x[1]; x += spacing, ix++) {
      if (report.accepted >= maxTrees) {report.truncated = true;break;}
      const px = x + (hash(ix, iz, seed) - .5) * spacing * .65, pz = z + (hash(ix, iz, seed + 1) - .5) * spacing * .65;
      const field = canopyHabitat(px, pz);report.candidates++;
      if (field < -.05) {report.rejected.field++;continue;}
      const hit = radialRay(new THREE.Vector3(px, 0, pz).applyMatrix4(castle.matrixWorld));
      if (!hit) {report.rejected.surface++;continue;}
      const point = hit.point.clone(), up = point.clone().normalize(), normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
      const slope = Math.abs(normal.dot(up)), local = point.clone().applyMatrix4(inverse);
      if (slope < minSlope) {report.rejected.slope++;continue;}
      if (local.y > maxLocalHeight || point.length() < radius + waterHeight(point) + minAltitude) {report.rejected.height++;continue;}
      const isCypress = hash(ix, iz, seed + 2) > .925 && field > .3;
      const edge = THREE.MathUtils.smoothstep(field, -.05, .5), size = (1.8 + hash(ix, iz, seed + 3) * .9) * (.78 + .22 * edge);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, up).multiply(new THREE.Quaternion().setFromAxisAngle(UP, hash(ix, iz, seed + 4) * Math.PI * 2));
      // Six real trunk base vertices, plus the central root, all use final terrain.
      const feet = [];let bad = false;
      for (let j = 0; j < 6; j++) {
        const foot = new THREE.Vector3(Math.sin(j * Math.PI / 3) * .12 * size, 0, Math.cos(j * Math.PI / 3) * .12 * size).applyQuaternion(q).add(point);
        const support = radialRay(foot);
        if (!support || Math.abs(support.point.length() - point.length()) > .28) {bad = true;break;}
        feet.push(support.point.length());
      }
      if (bad) {report.rejected.feet++;continue;}
      const placed = point.clone().setLength(Math.min(point.length(), ...feet) - .012);
      const worldMatrix = new THREE.Matrix4().compose(placed, q, new THREE.Vector3(size, size, size));
      const baseGaps = [];
      for(let j = 0; j < 6; j++) {
        const base = new THREE.Vector3(Math.sin(j * Math.PI / 3) * .12, 0, Math.cos(j * Math.PI / 3) * .12).applyMatrix4(worldMatrix);
        const actual = radialRay(base), gap = actual ? base.length() - actual.point.length() : Infinity;
        if(gap > .002 || gap < -.3) {bad = true;break;}baseGaps.push(gap);
      }
      if(bad) {report.rejected.feet++;continue;}
      const variant = isCypress ? 3 : Math.min(2, Math.floor(hash(ix, iz, seed + 5) * 3));
      const box = geometries[variant].boundingBox.clone().applyMatrix4(worldMatrix).union(trunk.boundingBox.clone().applyMatrix4(worldMatrix));
      if (!canopyClearOfConstraints(box, protectedBoxes, rail, buildingMargin, railClearance)) {report.rejected.clearance++;continue;}
      const matrix = inverse.clone().multiply(worldMatrix), row = {matrix, tint: .94 + hash(ix, iz, seed + 6) * .12};
      buckets[variant].push(row);trunkRows.push(row);
      report.placements.push({id: `${ix},${iz}`, kind: isCypress ? 'cypress' : 'broadleaf', variant, world: placed.toArray(), surface: hit.object.name, faceIndex: hit.faceIndex, sourcePoint: point.toArray(), size, slope,
        baseGapMin: Math.min(...baseGaps), baseGapMax: Math.max(...baseGaps), baseRadius: .12 * size, footMin: Math.min(...feet), footMax: Math.max(...feet), bounds: {min: box.min.toArray(), max: box.max.toArray()}});
      report.accepted++;report[isCypress ? 'cypress' : 'broadleaf']++;
    }
    if (report.truncated) break;
  }
  const materials = [material('#668e89', 'canopy-slate-teal'), material('#70958d', 'canopy-sage-teal'), material('#5b817e', 'canopy-deep-teal'), material('#315f59', 'canopy-cypress'), material('#685f4e', 'canopy-bark')];
  function instances(geometry, mat, rows, name) {
    const mesh = new THREE.InstancedMesh(geometry, mat, rows.length);mesh.name = name;
    rows.forEach((r, i) => {mesh.setMatrixAt(i, r.matrix);mesh.setColorAt(i, new THREE.Color(r.tint, r.tint, r.tint));});
    mesh.instanceMatrix.needsUpdate = true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.castShadow = true;mesh.receiveShadow = true;
    Object.assign(mesh.userData, {skipColliders: true, skipInkOutline: true, preserveCitadelMaterials: true, ashleyPalette: 1, holyOldTownDone: true});group.add(mesh);
  }
  geometries.forEach((g, i) => instances(g, materials[i], buckets[i], `citadel-canopy-${i === 3 ? 'cypress' : 'broadleaf-' + i}`));
  instances(trunk, materials[4], trunkRows, 'citadel-canopy-root-trunks');
  report.triangles = group.children.reduce((sum, o) => sum + (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * o.count, 0);
  report.drawCalls = group.children.filter(o => o.count).length;report.seed = seed;report.constraints = {buildingMargin, railClearance, minSlope, maxLocalHeight, bounds, spacing, maxTrees};
  group.userData.canopyStudy = report;
  return {group, report, dispose() {group.removeFromParent();for(const g of [...geometries, trunk])g.dispose();for(const m of materials)m.dispose();}};
}
