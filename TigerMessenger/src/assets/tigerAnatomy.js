import * as THREE from 'three';
import data from '../../assets/models/optimized/moebiusTigerAnatomyData.js';

// The existing actor, lights and animated pivots remain live. The saved Blender
// candidate provides only shape, materials and rest transforms.
export function prepareTigerAnatomy(root) {
  if (root.userData.tigerAnatomyController) return root.userData.tigerAnatomyController;
  const originals = [];
  root.traverse(node => originals.push(node));
  if (originals.length !== data.originalNodes.length) return null;
  const nodes = new Map();
  for (let i = 0; i < originals.length; i++) {
    const node = originals[i], spec = data.originalNodes[i];
    if (node.name !== spec.name || node.type !== spec.type) return null;
    nodes.set(spec.id, node);
  }
  for (let i = 0; i < originals.length; i++) {
    const spec = data.originalNodes[i];
    if (spec.parentId !== null && originals[i].parent !== nodes.get(spec.parentId)) return null;
  }
  const specs = new Map(data.nodes.map(spec => [spec.id, spec]));
  if (specs.size !== data.nodes.length || data.originalNodes.some(spec => !specs.has(spec.id))) return null;
  for (const spec of data.nodes) {
    if (!spec.matrix || spec.matrix.length !== 16 || spec.matrix.some(v => !Number.isFinite(v))) return null;
    if (spec.parentId !== null && !specs.has(spec.parentId)) return null;
    if (spec.geometry) {
      const attrs = spec.geometry.attributes;
      if (!attrs?.position || attrs.position.length % 3 !== 0 ||
          Object.values(attrs).some(values => values.some(v => !Number.isFinite(v)))) return null;
      if (spec.materialIndices?.some(index => !data.materials[index])) return null;
    }
  }

  const textures = [], pending = [];
  for (const spec of data.textures) {
    let resolve, reject;
    pending.push(new Promise((yes, no) => { resolve = yes; reject = no; }));
    const texture = new THREE.TextureLoader().load(spec.dataURL, resolve, undefined, reject);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    const wrapModes = { 10497: THREE.RepeatWrapping, 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping };
    texture.wrapS = wrapModes[spec.sampler?.wrapS] ?? THREE.RepeatWrapping;
    texture.wrapT = wrapModes[spec.sampler?.wrapT] ?? THREE.RepeatWrapping;
    textures.push(texture);
  }
  const materials = data.materials.map(spec => {
    const pbr = spec.pbrMetallicRoughness || {};
    const factor = pbr.baseColorFactor || [1, 1, 1, 1];
    const unlit = !!spec.extensions?.KHR_materials_unlit;
    const parameters = {
      name: spec.name || 'tiger-anatomy-material',
      color: new THREE.Color().fromArray(factor), opacity: factor[3],
      side: spec.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      transparent: spec.alphaMode === 'BLEND',
      alphaTest: spec.alphaMode === 'MASK' ? (spec.alphaCutoff ?? 0.5) : 0,
      map: pbr.baseColorTexture ? textures[pbr.baseColorTexture.index] : null,
    };
    if (unlit) return new THREE.MeshBasicMaterial(parameters);
    return new THREE.MeshStandardMaterial({ ...parameters,
      metalness: pbr.metallicFactor ?? 1, roughness: pbr.roughnessFactor ?? 1,
      emissive: new THREE.Color().fromArray(spec.emissiveFactor || [0, 0, 0]),
      emissiveIntensity: spec.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1,
    });
  });
  const replacements = new Map();
  for (const spec of data.nodes) {
    const geometry = spec.geometry ? new THREE.BufferGeometry() : null;
    if (geometry) {
      for (const [name, values] of Object.entries(spec.geometry.attributes)) {
        geometry.setAttribute(name, new THREE.Float32BufferAttribute(values,
          spec.geometry.attributeItemSizes?.[name] ?? (name === 'uv' ? 2 : 3)));
      }
      if (spec.geometry.index) geometry.setIndex(spec.geometry.index);
      for (const group of spec.geometry.groups || []) geometry.addGroup(group.start, group.count, group.materialIndex);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
    const material = (spec.materialIndices || []).map(index => materials[index]);
    replacements.set(spec.id, { geometry, material: material.length === 1 ? material[0] : material });
    if (!nodes.has(spec.id)) {
      const node = geometry ? new THREE.Mesh(geometry, material.length === 1 ? material[0] : material) : new THREE.Group();
      node.name = spec.name;
      node.castShadow = true;
      node.receiveShadow = true;
      nodes.set(spec.id, node);
    }
  }
  const backup = new Map(originals.map(node => [node, {
    position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(),
    geometry: node.geometry, material: node.material, visible: node.visible,
    intensity: node.isPointLight ? node.intensity : undefined,
  }]));
  const additions = data.nodes.filter(spec => !data.originalNodes.some(original => original.id === spec.id));
  let active = false;
  let disposed = false;
  const ready = Promise.all(pending);
  // Keep rejection observable to callers without an unhandled-promise event.
  const metadata = {
    version: data.version, source: data.source, sha256: data.sha256,
    originalNodeCount: originals.length, addedNodeCount: additions.length,
    active: false, textureStatus: 'loading', ready,
  };
  root.userData.tigerAnatomy = metadata;
  ready.catch(() => {
    metadata.textureStatus = 'failed';
    if (!disposed && root.userData.tigerAnatomy === metadata) root.userData.setTigerAnatomy?.(false);
  });
  ready.then(() => { metadata.textureStatus = 'ready'; }, () => {});
  const matrix = new THREE.Matrix4();
  const controller = {
    ready,
    dispose() {
      if (disposed) return;
      controller.setEnabled(false);
      disposed = true;
      for (const replacement of replacements.values()) replacement.geometry?.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      // Shared toon materials and original fallback geometries belong to the
      // original actor, not to this candidate controller.
      delete root.userData.tigerAnatomyController;
      root.userData.tigerAnatomy.active = false;
      root.userData.tigerAnatomy.disposed = true;
    },
    setEnabled(enabled) {
      if (disposed) return false;
      enabled = !!enabled;
      if (enabled && metadata.textureStatus === 'failed') return false;
      if (enabled === active) return true;
      if (enabled) {
        for (const spec of data.nodes) {
          const node = nodes.get(spec.id);
          node.userData.blenderSourceNode = spec.id;
          // World placement and the original root scale belong to the actor.
          if (node !== root) {
            matrix.fromArray(spec.matrix).decompose(node.position, node.quaternion, node.scale);
          }
          const replacement = replacements.get(spec.id);
          if (replacement.geometry) {
            node.geometry = replacement.geometry;
            node.material = replacement.material;
          }
          // The actor/gameplay and local-light pool own root/light visibility.
          if (node !== root && !node.isLight) node.visible = !spec.hiddenOutline && !spec.emptyGeometry;
          // PBR skin receives the old eye lamps far more strongly than toon
          // skin. Keep their identities/registry entries but retain small red
          // eyes instead of washing the whole muzzle in red light.
          if (node.isPointLight) node.intensity = backup.get(node).intensity * 0.04;
        }
        for (const spec of additions) nodes.get(spec.parentId).add(nodes.get(spec.id));
      } else {
        for (const spec of additions) nodes.get(spec.id).removeFromParent();
        for (const [node, saved] of backup) {
          if (node !== root) {
            node.position.copy(saved.position); node.quaternion.copy(saved.quaternion); node.scale.copy(saved.scale);
          }
          if (saved.geometry) node.geometry = saved.geometry;
          if (saved.material) node.material = saved.material;
          if (node !== root && !node.isLight) node.visible = saved.visible;
          if (node.isPointLight) node.intensity = saved.intensity;
        }
      }
      active = enabled;
      root.userData.tigerAnatomy.active = active;
      root.updateMatrixWorld(true);
      return true;
    },
  };
  root.userData.tigerAnatomyController = controller;
  return controller;
}
