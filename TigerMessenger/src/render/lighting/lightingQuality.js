// =====================================================================
// LightingQuality — V5-K7 质量分档唯一定义（TODO 574）
//
// low    ：无动态 voxel AO、无 bounce；
// medium ：动态 voxel AO，无 bounce；
// high   ：允许更高 AO 分辨率与单次色彩反弹（bounce 仍需
//          `voxelBounceV1` 开关 + K5 能力门控，见 voxelBounce.js）。
// 分档只是能力声明，不改运行时默认；实际生效仍由 FEATURES 开关决定。
// =====================================================================

export const LIGHTING_QUALITY_TIERS = Object.freeze({
  low: Object.freeze({
    name: "low",
    voxelAo: false,
    allowsBounce: false,
    aoResolution: "off",
    localLightBudget: "low",
  }),
  medium: Object.freeze({
    name: "medium",
    voxelAo: true,
    allowsBounce: false,
    aoResolution: "standard",
    localLightBudget: "medium",
  }),
  high: Object.freeze({
    name: "high",
    voxelAo: true,
    allowsBounce: true,
    aoResolution: "high",
    localLightBudget: "high",
  }),
});

export const LIGHTING_QUALITY_DEFAULT = "medium";

export function isLightingQualityName(name) {
  return typeof name === "string" && Object.hasOwn(LIGHTING_QUALITY_TIERS, name);
}

/** 非法/缺省输入回落默认档，绝不返回 undefined。 */
export function resolveLightingQuality(name) {
  return LIGHTING_QUALITY_TIERS[isLightingQualityName(name) ? name : LIGHTING_QUALITY_DEFAULT];
}
