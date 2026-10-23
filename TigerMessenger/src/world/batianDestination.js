import * as THREE from 'three';

// World AABB corners are empty space, not roofs. Survey actual vertices near
// the destination footprint so a wide spherical town cannot lift the carrier
// hundreds of metres above the battle.
export function batianObstacleRadius(root, direction, radius = 160) {
  let highest = radius;
  const vertex = new THREE.Vector3(), normal = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse(o => {
    const points = o.geometry?.attributes?.position;
    if (!o.isMesh || !points || o.isInstancedMesh) return;
    for(let ancestor=o;ancestor;ancestor=ancestor.parent)if(!ancestor.visible)return;
    for (let i = 0; i < points.count; i++) {
      vertex.fromBufferAttribute(points, i).applyMatrix4(o.matrixWorld);
      const r = vertex.length();
      if (r > highest && normal.copy(vertex).normalize().dot(direction) >= Math.cos(.38)) highest = r;
    }
  });
  return highest;
}
