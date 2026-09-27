import * as THREE from 'three';

// Authored local-space footprint, sign reading area and front walking approach.
// This belongs to the bookshop site, not the global forest or tree model.
export const BOOKSHOP_PLANTING_CLEARANCE = Object.freeze([
  { id: 'building', minX: -2.75, maxX: 2.75, minZ: -2.2, maxZ: 2.9 },
  { id: 'sign', minX: -4.55, maxX: -1.85, minZ: 1.5, maxZ: 18 },
  { id: 'approach', minX: -1.65, maxX: 1.65, minZ: 2.9, maxZ: 11 },
]);

export function createBookshopPlantingClearance(bookshop) {
  bookshop.updateWorldMatrix(true, false);
  const inverse = bookshop.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const report = { owner: 'world-bookshop', zones: BOOKSHOP_PLANTING_CLEARANCE, rejected: [] };
  return {
    report,
    accepts(tree) {
      tree.updateWorldMatrix(true, false);
      tree.getWorldPosition(local).applyMatrix4(inverse);
      // 树种自带冠幅（userData.pineCrownRadius，原料尺度）；走廊林带现为
      // 苔庭松（冠幅 3.6）。旧低模松等没有该字段，沿用 0.95 的冠幅估计。
      tree.getWorldScale(scale);
      const crownRadius = (tree.userData.pineCrownRadius ?? .95) * Math.max(scale.x, scale.z);
      const zone = BOOKSHOP_PLANTING_CLEARANCE.find(area =>
        local.x + crownRadius > area.minX && local.x - crownRadius < area.maxX &&
        local.z + crownRadius > area.minZ && local.z - crownRadius < area.maxZ);
      if (!zone) return true;
      report.rejected.push({ zone: zone.id, corridor: tree.userData.corridorId,
        position: tree.position.toArray(), local: local.toArray(), crownRadius });
      return false;
    },
  };
}
