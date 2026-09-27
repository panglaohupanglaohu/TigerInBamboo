import * as THREE from 'three';

// Old-town plateau plinth (user 2026-09-24: the plateau read as a slab resting on
// the mountain with nothing beneath its east/south overhang). Extends the
// existing thin platform side down below sea level: a battered ivory retaining
// wall (6 m) under a cream coping, then flared weathered rock. Quads next to the
// harbour stair route are left open so the stair is never buried.
const WALL_BAND = 6, CAP = 0.35, STAIR_CLEAR = 3.2;

function hash(i, j) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function buildOldTownPlinth(castle, R = 160) {
  const foundation = castle?.getObjectByName('highland-town-foundation-platform');
  const side = foundation?.getObjectByName('highland-town-foundation-platform-side');
  if (!foundation || !side || foundation.getObjectByName('highland-town-foundation-plinth')) return null;
  const pos = side.geometry.attributes.position;
  const n0 = pos.count / 2;                      // ring at y=0, then ring at y=-thickness
  const ring = [];
  for (let i = n0; i < pos.count; i++) ring.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  // Resample the coarse outline to ~2 m so the stair gap stays narrow.
  const dense = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], steps = Math.max(1, Math.ceil(a.distanceTo(b) / 2));
    for (let k = 0; k < steps; k++) dense.push(a.clone().lerp(b, k / steps));
  }
  ring.length = 0; ring.push(...dense);
  const top = ring[0].y;
  const n = ring.length;
  foundation.updateWorldMatrix(true, false);
  const centre = ring.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
  const worldCentre = centre.clone().applyMatrix4(foundation.matrixWorld);
  const reach = Math.max(...ring.map(p => Math.hypot(p.x - centre.x, p.z - centre.z)));
  // Deep enough to pass below sea level at the rim, allowing for sphere curvature.
  const depth = (worldCentre.length() - R) + 4 + reach * reach / (2 * R);
  const levels = [0, WALL_BAND - CAP, WALL_BAND, WALL_BAND + 0.6];
  for (let d = WALL_BAND + 3.5; d < depth; d += 3.5) levels.push(d);
  levels.push(depth);
  const positions = [], colors = [], indices = [];
  const cream = new THREE.Color(0xe6dcc5), capC = new THREE.Color(0xf1e9d6), rockHi = new THREE.Color(0x4f6784), rockLo = new THREE.Color(0x344a63);
  levels.forEach((d, li) => {
    for (let i = 0; i < n; i++) {
      const p = ring[i];
      // Outward batter: ivory retaining wall leans out to 1.4 m, rock flares further.
      const out = d <= WALL_BAND ? 0.6 + 0.8 * d / WALL_BAND : 1.4 + 1.3 * Math.min(1, (d - WALL_BAND) / 14) + hash(i, li) * 0.7;
      const inward = -out;
      const dx = p.x - centre.x, dz = p.z - centre.z, len = Math.hypot(dx, dz) || 1;
      positions.push(p.x - dx / len * inward, top - d, p.z - dz / len * inward);
      const c = d < WALL_BAND - CAP ? cream : d <= WALL_BAND ? capC : rockHi.clone().lerp(rockLo, Math.min(1, d / depth) * 0.8 + hash(li, i) * 0.2);
      colors.push(c.r, c.g, c.b);
    }
  });
  const toLocal = foundation.matrixWorld.clone().invert().multiply(castle.matrixWorld);
  const route = (castle.userData.oldShoreApproach?.route || []).map(p => new THREE.Vector3(...p).applyMatrix4(toLocal));
  const nearStair = (i, li) => {
    const p = ring[i], y = top - levels[li];
    return route.some(r => Math.hypot(r.x - p.x, r.z - p.z) < STAIR_CLEAR && r.y > y - 3 && r.y < top + 1);
  };
  let skipped = 0;
  for (let li = 0; li < levels.length - 1; li++) {
    const a = li * n, b = (li + 1) * n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (nearStair(i, li) || nearStair(j, li) || nearStair(i, li + 1)) { skipped++; continue; }
      indices.push(a + i, a + j, b + j, a + i, b + j, b + i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const flat = geometry.toNonIndexed(); flat.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.97, metalness: 0, flatShading: true, side: THREE.DoubleSide});
  const mesh = new THREE.Mesh(flat, material);
  mesh.name = 'highland-town-foundation-plinth';
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.presentationOnly = true; mesh.userData.nonNavigable = true; mesh.userData.citadelSolidExterior = true;
  mesh.userData.plinth = {depth, levels: levels.length, ringVertices: n, stairQuadsSkipped: skipped};
  // The thin platform side becomes the wall's coping so slab edge and wall read as one mass.
  side.material = side.material.clone();
  side.material.color.setHex(0xefe6d2);
  foundation.add(mesh);
  return mesh;
}
