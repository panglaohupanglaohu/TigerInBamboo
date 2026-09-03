// =====================================================================
//  模块几何规格化（2026-09-03，主人定案：按 Oskar 的同构模块做法）
//
//  合并块要支持「按 faceToCell 区间原地改写」，前提是每格模块的三角形数
//  恒定——否则新模块比旧的长或短，后续所有区间都得平移，复杂度爆炸。
//
//  Oskar 的做法是让模块本身同构。我们的模块不同构（拱窗与平墙顶点数不同），
//  所以在装配前把每个模块补齐到统一三角形数：不足的部分补退化三角形
//  （三个顶点重合，光栅化阶段直接丢弃，不产生任何像素）。
//
//  代价是显存换取原地替换能力：补出来的退化面不占填充率，只占顶点带宽。
// =====================================================================

/** 一个几何的三角形数（索引优先，与 renderer.info 的口径一致）。 */
export function triangleCount(geometry) {
  const position = geometry?.attributes?.position;
  if (!position) return 0;
  return Math.floor((geometry.index?.count ?? position.count) / 3);
}

/** 一组几何里最大的三角形数——即规格化后的统一槽位大小。 */
export function moduleSlotSize(geometries = []) {
  let max = 0;
  for (const geometry of geometries) {
    const n = triangleCount(geometry);
    if (n > max) max = n;
  }
  return max;
}

/**
 * 把几何补齐到 targetTris 个三角形。补出来的是退化三角形：三个索引都指向
 * 顶点 0，面积为零，光栅化阶段被丢弃。
 *
 * 只动索引不动顶点属性——这样所有属性数组保持原样，替换时只需覆盖索引区间，
 * 是整套方案里最省的一种补齐方式。
 *
 * @returns {boolean} 是否发生了改动
 */
export function padGeometryToTriangles(geometry, targetTris) {
  const position = geometry?.attributes?.position;
  if (!position || !(targetTris > 0)) return false;

  // 无索引几何先建一份显式索引，否则没法只靠索引补齐
  if (!geometry.index) {
    const count = position.count;
    const indices = new Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    geometry.setIndex(indices);
  }

  const current = triangleCount(geometry);
  if (current >= targetTris) return false;

  const oldIndex = geometry.index.array;
  const padded = new (oldIndex.constructor)(targetTris * 3);
  padded.set(oldIndex, 0);
  // 其余保持 0：三个索引都是顶点 0 → 退化三角形
  geometry.setIndex(new geometry.index.constructor(padded, 1));
  geometry.userData.paddedFrom = current;
  geometry.userData.slotSize = targetTris;
  return true;
}

/**
 * 规格化一组几何到同一槽位大小。返回槽位大小，供 faceToCell 计算区间：
 *   第 n 格的三角形区间 = [n * slot, (n + 1) * slot)
 */
export function normalizeModuleGeometries(geometries = []) {
  const slot = moduleSlotSize(geometries);
  for (const geometry of geometries) padGeometryToTriangles(geometry, slot);
  return slot;
}

/** 第 index 格在合并块里的三角形区间——原地替换的寻址依据。 */
export function slotRange(index, slotSize) {
  const start = index * slotSize;
  return { triStart: start, triCount: slotSize };
}
