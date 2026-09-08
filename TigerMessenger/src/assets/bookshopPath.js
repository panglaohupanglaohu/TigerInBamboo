import * as THREE from 'three';
import data from '../../assets/models/optimized/bookshopPathData.js';
import { toonMat } from './toon.js';

// Four evaluated, bevelled stones from the saved Blender scene, not a new road kit.
export function fitBookshopPath(bookshop, sampleWorldRadius = null) {
  let path = bookshop.getObjectByName('bookshop-blender-entrance-path');
  if (!path) {
    path = new THREE.Mesh(new THREE.BufferGeometry(), toonMat(new THREE.Color().fromArray(data.color)));
    path.name = 'bookshop-blender-entrance-path';
    path.receiveShadow = true;
    path.userData.blenderPath = { source: data.source, sha256: data.sha256, stones: data.stones.length };
    bookshop.add(path);
  }
  bookshop.updateWorldMatrix(true, true);
  const berm = bookshop.getObjectByName('bookshop-soil-berm');
  const floors = new Map(), vertices = [], point = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0).transformDirection(bookshop.matrixWorld);
  const ray = new THREE.Raycaster();
  function floorAt(x, z) {
    const key = `${x},${z}`;
    if (floors.has(key)) return floors.get(key);
    point.set(x, 0, z);bookshop.localToWorld(point);
    let y = 0;
    if (sampleWorldRadius) {
      point.setLength(sampleWorldRadius(point));
      y = bookshop.worldToLocal(point).y;
    }
    point.set(x, 3, z);bookshop.localToWorld(point);
    ray.set(point, down);ray.far = 8;
    const hit = berm && ray.intersectObject(berm, true).find(h => !h.object.userData.isOutline);
    if (hit) y = Math.max(y, bookshop.worldToLocal(hit.point.clone()).y);
    floors.set(key, y);return y;
  }
  for (const stone of data.stones) {
    for (let i = 0; i < stone.position.length; i += 3) {
      const [x, y, z] = stone.position.slice(i, i + 3);
      vertices.push(x, floorAt(x, z) + y - stone.bottom + .008, z);
    }
  }
  path.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  path.geometry.computeVertexNormals();
  path.geometry.computeBoundingBox();path.geometry.computeBoundingSphere();
  path.userData.groundAdapted = !!sampleWorldRadius;
  // The thin decorative stones use the existing continuous walkable terrain.
  // Separate vertical collision lips on each slab would snag the player.
  return path;
}
