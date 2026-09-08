import * as THREE from 'three';

function fingerprint(values) {
  const bytes = new DataView(new ArrayBuffer(4));
  let hash = 2166136261;
  for (const value of values) {
    // JSON source snapshots normalize negative zero to zero.
    bytes.setFloat32(0, value === 0 ? 0 : value, true);
    for (let i = 0; i < 4; i++) hash = Math.imul(hash ^ bytes.getUint8(i), 16777619) >>> 0;
  }
  return hash;
}

// Validate the entire factory result before changing any geometry. Variants
// with different authored geometry or future authored details keep their original mesh.
export function applyBlenderTopology(root, data) {
  const nodes = [];
  root.traverse(node => nodes.push(node));
  if (nodes.length !== data.nodes.length) return false;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i], spec = data.nodes[i];
    if (node.name !== spec.name || node.type !== spec.type) return false;
    if (!spec.geometry) { if (node.geometry) return false; continue; }
    const geometry = node.geometry, expected = data.geometries[spec.geometry].expected;
    if (!geometry || Object.keys(geometry.attributes).length !== Object.keys(expected.attributes).length) return false;
    for (const [name, attr] of Object.entries(expected.attributes)) {
      const actual = geometry.attributes[name];
      if (!actual || actual.itemSize !== attr.itemSize || actual.normalized !== attr.normalized || actual.array.length !== attr.length) return false;
      if (fingerprint(actual.array) !== attr.fingerprint) return false;
    }
    if (expected.index === null ? geometry.index !== null : !geometry.index || expected.index.length !== geometry.index.count || expected.index.some((v, j) => v !== geometry.index.array[j])) return false;
    if (JSON.stringify(geometry.groups) !== JSON.stringify(data.geometries[spec.geometry].groups)) return false;
  }
  const replacements = new Map(), old = new Set();
  for (let i = 0; i < nodes.length; i++) {
    const key = data.nodes[i].geometry;
    if (!key) continue;
    if (!replacements.has(key)) {
      const record = data.geometries[key], geometry = new THREE.BufferGeometry();
      // Blender supplies the welded topology; keep authored float values from
      // the factory, including UV/normal seams and the ink shader inputs.
      for (const [name, attr] of Object.entries(nodes[i].geometry.attributes)) {
        const values = record.vertexSources.flatMap(index => Array.from(attr.array.slice(index * attr.itemSize, (index + 1) * attr.itemSize)));
        geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attr.itemSize, attr.normalized));
      }
      geometry.setIndex(record.index);
      for (const group of record.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      replacements.set(key, geometry);
    }
    old.add(nodes[i].geometry);
    nodes[i].geometry = replacements.get(key);
  }
  for (const geometry of old) geometry.dispose();
  root.userData.blenderGeometry = { version: data.version, ...data.stats };
  return true;
}
