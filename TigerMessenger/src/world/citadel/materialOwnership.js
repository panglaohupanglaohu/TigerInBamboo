// Imported props and living planting own their authored materials. Material-level
// ownership survives static batching, where tree/part ancestor names can disappear.
export function preservesCitadelMaterial(object, material) {
  if (material?.userData?.preserveCitadelMaterial) return true;
  for (let node = object; node; node = node.parent) {
    if (node.userData?.preserveCitadelMaterials) return true;
  }
  return false;
}
