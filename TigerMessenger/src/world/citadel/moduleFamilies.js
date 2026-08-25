// =====================================================================
//  Townscaper 模块家族常量（纯数据，不 import Three.js）
//  citadelTown.js 只再导出，避免 V4 目录/Worker 编译拖进渲染层。
// =====================================================================

export const TOWNSCAPER_MODULE_VARIANTS = 2450;
export const TOWNSCAPER_MODULE_FAMILIES = Object.freeze({
  foundation: Object.freeze(["path", "stone-plinth", "pillar", "cantilever"]),
  floor: Object.freeze(["base", "split-band", "cornice", "top-band", "tower"]),
  fence: Object.freeze(["iron", "wood", "painted", "garden"]),
  balcony: Object.freeze(["flower-tile", "flower-box", "awning", "overhang"]),
  stairs: Object.freeze(["small", "large", "beach", "switchback"]),
  support: Object.freeze(["pillar", "v-brace", "arch-post", "cantilever"]),
  hole: Object.freeze(["archway", "door-tunnel", "garden-door", "water-gate"]),
  decor: Object.freeze(["window", "oculus", "chimney", "clothesline", "topiary", "lamp"]),
});
