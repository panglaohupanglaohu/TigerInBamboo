// =====================================================================
// BufferGeometry adapter（V7-G10）
// 不 import Three.js：由调用方传入其 THREE namespace，便于 CDN/importmap、
// mock 单测和 Worker 分离。mesh 只消费 positions/normals/indices/semantics。
// =====================================================================

export function createBufferGeometryFromMesh(THREE, mesh, { material = null, semanticAttribute = "procgenSemantic", groups = [] } = {}) {
  if (!THREE?.BufferGeometry || !THREE?.BufferAttribute) throw new Error("THREE.BufferGeometry/BufferAttribute required");
  if (!mesh?.positions || !mesh?.normals || !mesh?.indices) throw new Error("indexed mesh positions/normals/indices required");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  if (mesh.semantics) geometry.setAttribute(semanticAttribute, new THREE.BufferAttribute(mesh.semantics, 1));
  if (mesh.uv) geometry.setAttribute("uv", new THREE.BufferAttribute(mesh.uv, 2));
  if (mesh.colors) geometry.setAttribute("color", new THREE.BufferAttribute(mesh.colors, mesh.colorStride || 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  for (const group of groups.length ? groups : (mesh.groups || [])) geometry.addGroup?.(group.start, group.count, group.materialIndex ?? 0);
  geometry.computeBoundingSphere?.();
  geometry.computeBoundingBox?.();
  return material && THREE.Mesh ? new THREE.Mesh(geometry, material) : geometry;
}

export function updateBufferGeometryFromMesh(target, mesh, { semanticAttribute = "procgenSemantic" } = {}) {
  const geometry = target?.isBufferGeometry ? target : target?.geometry;
  if (!geometry) throw new Error("BufferGeometry target required");
  // Update helper is intentionally small; consumers with a different THREE realm
  // should use createBufferGeometryFromMesh to avoid cross-realm constructor issues.
  if (mesh.positions && geometry.getAttribute("position")) { geometry.getAttribute("position").array.set(mesh.positions); geometry.getAttribute("position").needsUpdate = true; }
  if (mesh.normals && geometry.getAttribute("normal")) { geometry.getAttribute("normal").array.set(mesh.normals); geometry.getAttribute("normal").needsUpdate = true; }
  if (mesh.semantics && geometry.getAttribute(semanticAttribute)) { geometry.getAttribute(semanticAttribute).array.set(mesh.semantics); geometry.getAttribute(semanticAttribute).needsUpdate = true; }
  if (mesh.uv && geometry.getAttribute("uv")) { geometry.getAttribute("uv").array.set(mesh.uv); geometry.getAttribute("uv").needsUpdate = true; }
  if (mesh.colors && geometry.getAttribute("color")) { geometry.getAttribute("color").array.set(mesh.colors); geometry.getAttribute("color").needsUpdate = true; }
  if (mesh.indices && geometry.index) { geometry.index.array.set(mesh.indices); geometry.index.needsUpdate = true; }
  geometry.computeBoundingSphere?.(); geometry.computeBoundingBox?.();
  return target;
}

export function disposeBufferGeometry(target) { const geometry = target?.isBufferGeometry ? target : target?.geometry; geometry?.dispose?.(); }
