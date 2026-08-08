// =====================================================================
//  统一世界尺度：区分球体/布局尺度与玩家/资产局部单位
// =====================================================================

/** 旧版球体半径；用于明确表达布局迁移比例，不直接散落在业务模块。 */
export const BASE_WORLD_RADIUS = 40;
/** 目标球体半径：在当前 R=80 基础上再放大一倍。 */
export const WORLD_RADIUS = 160;
/** 平面 authored 布局相对旧世界的缩放比例。 */
export const WORLD_SCALE = WORLD_RADIUS / BASE_WORLD_RADIUS;

/** 缩放 authored 平面坐标；Y 高度属于局部单位，不在此函数中缩放。 */
export function scaleFlatCoord(value) {
  return value * WORLD_SCALE;
}

/** 缩放 authored 平面 X/Z，保留对象几何和高度单位。 */
export function scaleFlatXZ(x, z, out = {}) {
  out.x = x * WORLD_SCALE;
  out.z = z * WORLD_SCALE;
  return out;
}

/** 缩放 [x, y, z] 布局位置，仅缩放平面轴。 */
export function scaleFlatPosition([x, y = 0, z]) {
  return [x * WORLD_SCALE, y, z * WORLD_SCALE];
}

/** 缩放平面半径/间距；局部资产半径不要调用此函数。 */
export function scaleFlatDistance(value) {
  return value * WORLD_SCALE;
}
