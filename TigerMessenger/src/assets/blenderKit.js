import * as THREE from 'three';
let assetsPromise;
const cached = new Map();
// Blender exports GLB for Godot and these Y-up buffers for the web runtime.
export async function loadBlenderAsset(id) {
  assetsPromise ??= fetch(new URL('../../assets/kit/meshes.json', import.meta.url))
    .then((r) => { if (!r.ok) throw new Error(`Blender kit HTTP ${r.status}`); return r.json(); });
  const catalog = await assetsPromise;
  if (catalog.version !== 1 || catalog.up !== 'Y') throw new Error('Unsupported Blender asset schema');
  if (!cached.has(id)) {
    const src = catalog.assets[id];
    if (!src) throw new Error(`Unknown Blender asset: ${id}`);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(src.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(src.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(src.colors, 3));
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, flatShading: true });
    cached.set(id, { geometry, material });
  }
  const { geometry, material } = cached.get(id);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `blender-${id}`; mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
