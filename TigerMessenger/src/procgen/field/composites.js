// =====================================================================
// 复合 SDF primitives（V7-G7 / TODO 1179）
// 由 sdf.js 基础体组合的地形/建筑过渡形体。符号约定不变：负值在内部。
// 这些是场函数（非精确距离），可与 union/subtract/smoothUnion 混用；
// 参数非法时拒绝（与基础体同一约定）。
// =====================================================================

import { sdBox, sdRoundedBox, sdfSubtract, sdCave } from "./sdf.js";

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function vec3(value, name) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((n) => !Number.isFinite(n))) throw new Error(`${name} must be a finite vec3`);
  return value;
}

// 台地肩部：自下而上逐级收缩的台阶状体（steps 级，到顶收缩至 shoulderScale）
export function sdTerraceShoulder(point, { center, halfSize, steps = 3, shoulderScale = 0.7 } = {}) {
  vec3(center, "center"); vec3(halfSize, "halfSize");
  if (!(steps >= 1) || !(shoulderScale > 0 && shoulderScale <= 1)) throw new Error("terrace shoulder requires steps >= 1 and 0 < shoulderScale <= 1");
  const baseY = center[1] - halfSize[1];
  const t = clamp01((point[1] - baseY) / (halfSize[1] * 2));
  const level = Math.min(steps - 1, Math.floor(t * steps));
  const scale = 1 - (1 - shoulderScale) * (level / Math.max(1, steps - 1));
  return sdBox(point, center, [halfSize[0] * scale, halfSize[1], halfSize[2] * scale]);
}

// 山体：幂次剖面锥（t=0 底面全半径，t=1 山顶收敛到点），近似场函数
export function sdMountain(point, { center, radius, height, exponent = 1.5 } = {}) {
  vec3(center, "center");
  if (!(radius > 0) || !(height > 0) || !(exponent > 0)) throw new Error("mountain requires positive radius/height/exponent");
  const radial = Math.hypot(point[0] - center[0], point[2] - center[2]) / radius;
  const tRaw = (point[1] - center[1]) / height;
  const t = clamp01(tRaw);
  const cone = radial - (1 - Math.pow(t, exponent));
  const topCap = (tRaw - 1) * height / Math.min(radius, height);
  return Math.max(cone, topCap) * Math.min(radius, height);
}

// 运河槽：沿 XZ 折线、宽 width、床面 floorY、向上深 depth 的开挖体（供 subtract）
export function sdCanalVolume(point, { path, width, floorY, depth } = {}) {
  if (!Array.isArray(path) || path.length < 2) throw new Error("canal path needs >= 2 points");
  if (!(width > 0) || !(depth > 0) || !Number.isFinite(floorY)) throw new Error("canal requires positive width/depth and finite floorY");
  let d = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i]; const [bx, bz] = path[i + 1];
    const abx = bx - ax; const abz = bz - az;
    const len2 = abx * abx + abz * abz;
    const t = len2 < 1e-12 ? 0 : clamp01(((point[0] - ax) * abx + (point[2] - az) * abz) / len2);
    d = Math.min(d, Math.hypot(point[0] - (ax + abx * t), point[2] - (az + abz * t)));
  }
  return Math.max(d - width / 2, floorY - point[1], point[1] - (floorY + depth));
}

// 瀑布缺口：贴崖面的圆角凹槽（供 subtract）
export function sdWaterfallNotch(point, { center, halfSize, radius = 0.15 } = {}) {
  vec3(center, "center"); vec3(halfSize, "halfSize");
  if (!(radius >= 0)) throw new Error("waterfall notch radius must be >= 0");
  return sdRoundedBox(point, center, halfSize, radius);
}

// 地基裙边：建筑 footprint 外扩 collar、高 height 的环状体（供 smoothUnion 到地形）
export function sdFoundationCollar(point, { center, halfSize, collar = 0.4, height = 0.5, radius = 0.1 } = {}) {
  vec3(center, "center"); vec3(halfSize, "halfSize");
  if (!(collar > 0) || !(height > 0)) throw new Error("foundation collar requires positive collar/height");
  const outer = sdRoundedBox(point, [center[0], center[1] + height / 2, center[2]], [halfSize[0] + collar, height / 2, halfSize[2] + collar], radius);
  const inner = sdBox(point, center, [halfSize[0], Math.max(halfSize[1], height), halfSize[2]]);
  return sdfSubtract(outer, inner);
}

// 洞穴已在 sdf.js 实现，这里统一出口便于 profile 单点引用
export { sdCave };

// 多 primitive 合成的 provenance：返回取到最小值的 primitive 名（切片导出/调试用，TODO 1185）
export function sampleWithProvenance(samplers, point) {
  let value = Infinity; let name = "none"; let index = -1;
  for (let i = 0; i < samplers.length; i++) {
    const v = samplers[i].fn(point);
    if (v < value) { value = v; name = samplers[i].name; index = i; }
  }
  return { value, name, index };
}
