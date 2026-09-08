import * as THREE from "three";

// The original crater lives below the general planet shell. Sample its actual
// authored wall, floor and entry steps along radial gravity, not its decorations.
export function createSwampGroundSampler(zone, meshes) {
  const inverse = new THREE.Matrix4();
  const ray = new THREE.Ray();
  const origin = new THREE.Vector3(), direction = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const hit = new THREE.Vector3(), local = new THREE.Vector3();
  return function sampleGroundRadius(position) {
    zone.updateWorldMatrix(true, false);
    local.copy(position).applyMatrix4(inverse.copy(zone.matrixWorld).invert());
    // Restrict this override to this crater, including its authored entry steps.
    if (Math.hypot(local.x, local.z) > 42 || local.y < -20 || local.y > 120) return null;
    direction.copy(position).normalize().negate();
    origin.copy(position).normalize().multiplyScalar(position.length() + 100);
    let highest = -Infinity;
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      inverse.copy(mesh.matrixWorld).invert();
      ray.set(origin, direction).applyMatrix4(inverse);
      const geometry = mesh.geometry, vertices = geometry.attributes.position, indices = geometry.index;
      const count = indices ? indices.count : vertices.count;
      for (let i = 0; i < count; i += 3) {
        a.fromBufferAttribute(vertices, indices ? indices.getX(i) : i);
        b.fromBufferAttribute(vertices, indices ? indices.getX(i + 1) : i + 1);
        c.fromBufferAttribute(vertices, indices ? indices.getX(i + 2) : i + 2);
        if (ray.intersectTriangle(a, b, c, false, hit)) {
          hit.applyMatrix4(mesh.matrixWorld);
          highest = Math.max(highest, hit.length());
        }
      }
    }
    return Number.isFinite(highest) ? highest : null;
  };
}
