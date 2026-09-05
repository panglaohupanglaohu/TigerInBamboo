// =====================================================================
//  装饰 pass（C8 · G-11）
//  分类权威：docs/CITADEL_DECOR_BOUNDARY.md。本文件只认那份名单。
//  纯名字表不 import Three.js；decorateTown 由 citadelTown 传入 own/mesh。
// =====================================================================

/** 装饰网格名（skipDecor 时不得出现） */
export const DECOR_MESH_NAMES = Object.freeze(new Set([
  "town-window-awning",
  "town-balcony",
  "town-balcony-rail",
  "town-balcony-canopy",
  "town-balcony-flowerbox",
  "town-balcony-flower-tile",
  "town-fence",
  "town-garden-fence",
  "town-pilaster",
  "town-gable-oculus",
  "town-gable-diamond",
  "town-gable-diamond-glass",
  "town-roof-chimney",
  "town-roof-chimney-cap",
  "town-steeple-cross",
  "town-steeple-vane",
  "town-clothesline",
  "town-cloth",
  "town-bird",
  "town-lantern",
  "town-boat",
  "town-boat-hull",
  "town-boat-sail",
  "town-courtyard-well",
]));

export function isDecorName(name) {
  if (!name) return false;
  if (DECOR_MESH_NAMES.has(name)) return true;
  const s = String(name);
  if (s.startsWith("town-bird")) return true;
  if (s.startsWith("town-gable-diamond")) return true;
  return false;
}

/** 根节点本身是装饰（鸟/船整组可整棵丢掉）。混有体块的组不要用这个。 */
export function isDecorTree(object) {
  return !!(object && isDecorName(object.name));
}

/**
 * skipDecor 时从树上摘掉装饰网格。混装组（尖塔 = 塔身体块 + 十字装饰）
 * 只摘装饰孩子，留下体块；纯装饰根（town-bird / town-boat）返回 null。
 */
export function stripDecorMeshes(object) {
  if (!object) return null;
  if (isDecorName(object.name)) return null;
  const kids = object.children;
  if (kids && kids.length) {
    for (const child of [...kids]) {
      if (!stripDecorMeshes(child)) object.remove(child);
    }
  }
  return object;
}

/**
 * 装饰独立 pass。发射仍由调用方在体块循环里触发时走 skipDecor 闸；
 * 本函数是挂钩：归属必须用传入的 own，不得在此重写 stampOwner。
 */
export function decorateTown({ own, skipDecor } = {}) {
  if (skipDecor === true) return;
  own?.none?.();
}
