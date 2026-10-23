import * as THREE from 'three';

// Keep geometry in original petal coordinates. In particular, toon.js hashes
// position and extrudes along normal BEFORE the standard instance transform.
// Baking petals into flower space would change the authored ink; instancing
// the five identical rigid petals preserves that shader and its shared material.
function identicalGeometry(a, b) {
  if (a.morphAttributes && Object.keys(a.morphAttributes).length) return false;
  if (b.morphAttributes && Object.keys(b.morphAttributes).length) return false;
  if (JSON.stringify(a.groups) !== JSON.stringify(b.groups) || a.drawRange.start !== b.drawRange.start || a.drawRange.count !== b.drawRange.count) return false;
  const keys = Object.keys(a.attributes);
  if (keys.join() !== Object.keys(b.attributes).join()) return false;
  const pairs = keys.map(key => [a.attributes[key], b.attributes[key]]);
  if (!!a.index !== !!b.index) return false;
  if (a.index) pairs.push([a.index, b.index]);
  return pairs.every(([x, y]) => !x.isInterleavedBufferAttribute && !y.isInterleavedBufferAttribute && x.itemSize === y.itemSize && x.normalized === y.normalized && x.array.constructor === y.array.constructor && x.array.length === y.array.length && x.array.every((value, i) => value === y.array[i]));
}
function sameRenderState(a, b) {
  return a.material === b.material && a.layers.mask === b.layers.mask && a.renderOrder === b.renderOrder && a.castShadow === b.castShadow && a.receiveShadow === b.receiveShadow && a.onBeforeRender === THREE.Object3D.prototype.onBeforeRender && b.onBeforeRender === THREE.Object3D.prototype.onBeforeRender && a.onAfterRender === THREE.Object3D.prototype.onAfterRender && b.onAfterRender === THREE.Object3D.prototype.onAfterRender && identicalGeometry(a.geometry, b.geometry);
}
function opaqueBasic(material) {
  return material?.isMeshBasicMaterial && !material.transparent && material.opacity === 1 && material.blending === THREE.NormalBlending && !material.displacementMap;
}
function makeBatch(flower, sources, matrices, name) {
  const first = sources[0];
  const batch = new THREE.InstancedMesh(first.geometry, first.material, sources.length);
  batch.name = name;
  batch.layers.mask = first.layers.mask;
  batch.renderOrder = first.renderOrder;
  batch.castShadow = first.castShadow;
  batch.receiveShadow = first.receiveShadow;
  batch.userData.isOutline = !!first.userData.isOutline;
  batch.userData.glowFlowerRenderBatch = true;
  // Original nodes remain the semantic/raycast interfaces, even while hidden.
  batch.raycast = () => {};
  matrices.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
  batch.instanceMatrix.needsUpdate = true;
  batch.computeBoundingBox(); batch.computeBoundingSphere();
  flower.add(batch);
  return batch;
}

/** Install AFTER flower construction/art styling. Whole-flower transforms and
 * halo animation remain live. If a petal is subsequently edited, dispose this
 * report and reinstall instead of mutating the retained source in place. */
export function installSwampGlowFlowerRenderBatch(inner) {
  if (inner.userData.glowFlowerRenderBatch) return inner.userData.glowFlowerRenderBatch;
  const flowers = [], records = [], skipped = [];
  inner.traverse(node => { if (node.name === 'swamp-glow-flower') flowers.push(node); });
  for (const flower of flowers) {
    const petals = flower.children.filter(node => node.isMesh && !node.isInstancedMesh && node.material?.side === THREE.DoubleSide && node.geometry?.attributes.position?.count === 6 && !node.geometry.index);
    const outlines = petals.map(node => node.children.find(child => child.isMesh && child.userData.isOutline));
    const supported = petals.length === 5 && petals.every(node => node.visible && opaqueBasic(node.material) && node.material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile && sameRenderState(petals[0], node)) && outlines.every(node => node?.visible && opaqueBasic(node.material) && node.material.onBeforeCompile.toString().includes('vBrushPos = position') && sameRenderState(outlines[0], node));
    if (!supported) { skipped.push({flower, reason: 'five unchanged opaque petals and compatible original toon outlines required'}); continue; }
    const petalMatrices = [], outlineMatrices = [];
    petals.forEach((petal, i) => {
      petal.updateMatrix(); outlines[i].updateMatrix();
      petalMatrices.push(petal.matrix.clone());
      outlineMatrices.push(petal.matrix.clone().multiply(outlines[i].matrix));
    });
    if ([...petalMatrices, ...outlineMatrices].some(matrix => matrix.determinant() <= 0)) { skipped.push({flower, reason: 'unsupported reflected/degenerate instance'}); continue; }
    const batch = makeBatch(flower, petals, petalMatrices, 'swamp-glow-flower-petal-batch');
    const inkBatch = makeBatch(flower, outlines, outlineMatrices, 'swamp-glow-flower-ink-batch');
    const visibility = petals.map(node => node.visible);
    petals.forEach(node => { node.visible = false; });
    records.push({flower, petals, outlines, batch, inkBatch, visibility});
  }
  let disposed = false;
  const report = {version: 1, records, skipped, drawsSaved: records.length * 8,
    scope: 'five rigid petals and five opaque original ink shells per flower; stem/core/halo unchanged',
    dispose() {
      if (disposed) return; disposed = true;
      for (const record of records) {
        record.petals.forEach((node, i) => { node.visible = record.visibility[i]; });
        for (const batch of [record.batch, record.inkBatch]) { batch.removeFromParent(); batch.dispose(); }
      }
      // Geometry and materials belong to the original flowers, never this batch.
      if (inner.userData.glowFlowerRenderBatch === report) delete inner.userData.glowFlowerRenderBatch;
    }};
  inner.userData.glowFlowerRenderBatch = report;
  return report;
}
