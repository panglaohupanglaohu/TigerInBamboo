// =====================================================================
//  LightingDebugView — V5-K7 调试视图模式（TODO 573）
//  FEATURES 风格的可变状态：模式名白名单 + 当前模式。
//  注意：本模块只持有模式状态与校验；各模式如何改渲染
//  （材质 override / shader 视图矩阵）属于浏览器 GPU 阶段，
//  由 lightingDirector.setDebugViewMode 的应用钩子承担，此处不伪造。
// =====================================================================

export const LIGHTING_DEBUG_VIEW_MODES = Object.freeze([
  "final",
  "albedo",
  "direct",
  "shadow",
  "sky",
  "ao",
  "bounce",
  "emissive",
  "luminance",
  "voxel",
  "active-lights",
]);

export const LIGHTING_DEBUG_VIEW_DEFAULT = "final";

/** FEATURES 风格可变状态（运行时可被 devPanel / director 改写，不进持久化） */
export const lightingDebugView = { mode: LIGHTING_DEBUG_VIEW_DEFAULT };

export function isLightingDebugViewMode(mode) {
  return typeof mode === "string" && LIGHTING_DEBUG_VIEW_MODES.includes(mode);
}

/** 非法输入回落 final，绝不留下未定义模式；返回实际生效模式 */
export function setLightingDebugViewMode(mode) {
  lightingDebugView.mode = isLightingDebugViewMode(mode) ? mode : LIGHTING_DEBUG_VIEW_DEFAULT;
  return lightingDebugView.mode;
}

export function getLightingDebugViewMode() {
  return lightingDebugView.mode;
}
