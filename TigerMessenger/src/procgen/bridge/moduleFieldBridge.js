// =====================================================================
// 模块 placement → terrain field 转换接口（V7-G9，TODO 1213/1215/1216）
// foundation collar 与 door/gate/canal/waterfall/cave clearance 统一为
// 带 aabb + sdf 的纯数据 volume descriptor；collar 走 smooth-union 消缝，
// clearance 走 hard subtract 保持 hard route。建筑主体不进 MC 场。
// =====================================================================

import { sdBox, sdCapsule, sdCave, smoothUnion, sdfSubtract } from "../field/sdf.js";

const vec3 = (value, name) => {
  if (!Array.isArray(value) || value.length !== 3 || value.some((n) => !Number.isFinite(n))) throw new Error(`${name} must be a finite vec3`);
  return value.slice();
};

const aabbOf = (min, max) => Object.freeze({ min: vec3(min, "min"), max: vec3(max, "max") });
const aabbFromCenterHalf = (center, half) => aabbOf(center.map((c, i) => c - half[i]), center.map((c, i) => c + half[i]));

/** placement: { moduleId?, cell: [x,y,z], size?: [sx,sy,sz] }（格子坐标）→ 世界 AABB */
export function placementWorldAabb(placement, cellSize = 1) {
  const cell = vec3(placement?.cell, "placement.cell");
  const size = placement.size ? vec3(placement.size, "placement.size") : [1, 1, 1];
  if (!(cellSize > 0)) throw new Error("cellSize must be > 0");
  return aabbOf(cell.map((c) => c * cellSize), cell.map((c, i) => (c + size[i]) * cellSize));
}

/**
 * 地基裙边（foundation collar）：模块底 footprint 水平外扩 margin、
 * 自基面向下嵌入 height 的盒子，smooth-union 到 terrain 消悬空/硬方块缝。
 */
export function foundationCollarVolume(placement, { cellSize = 1, margin = 1, height = 1 } = {}) {
  const base = placementWorldAabb(placement, cellSize);
  const min = [base.min[0] - margin, base.min[1] - height, base.min[2] - margin];
  const max = [base.max[0] + margin, base.min[1] + margin, base.max[2] + margin];
  const center = min.map((v, i) => (v + max[i]) / 2);
  const half = min.map((v, i) => (max[i] - v) / 2);
  return Object.freeze({
    kind: "foundation-collar",
    moduleId: placement.moduleId ?? null,
    aabb: aabbOf(min, max),
    sdf: (point) => sdBox(point, center, half),
  });
}

/** 门/门洞净空：世界坐标 origin + size 的盒体，hard subtract 保持通行。 */
export function doorGateClearanceVolume(placement, opening) {
  const kind = opening?.kind;
  if (kind !== "door" && kind !== "gate") throw new Error(`unknown clearance kind: ${kind}`);
  const origin = vec3(opening.origin, "opening.origin");
  const size = vec3(opening.size, "opening.size");
  if (size.some((n) => !(n > 0))) throw new Error("opening.size must be positive");
  const half = size.map((n) => n / 2);
  const center = origin.map((v, i) => v + half[i]);
  return Object.freeze({
    kind: "clearance",
    subtype: kind,
    moduleId: placement?.moduleId ?? null,
    aabb: aabbOf(origin, origin.map((v, i) => v + size[i])),
    sdf: (point) => sdBox(point, center, half),
  });
}

/** 运河段：中心线两点 + 半径的胶囊体（河槽 subtract）。 */
export function canalSegmentVolume({ from, to, radius }) {
  const a = vec3(from, "canal.from");
  const b = vec3(to, "canal.to");
  if (!(radius > 0)) throw new Error("canal radius must be > 0");
  const min = a.map((v, i) => Math.min(v, b[i]) - radius);
  const max = a.map((v, i) => Math.max(v, b[i]) + radius);
  return Object.freeze({ kind: "clearance", subtype: "canal", aabb: aabbOf(min, max), sdf: (point) => sdCapsule(point, a, b, radius) });
}

/** 瀑布缺口：世界坐标盒体。 */
export function waterfallNotchVolume({ center, halfSize }) {
  const c = vec3(center, "waterfall.center");
  const half = vec3(halfSize, "waterfall.halfSize");
  if (half.some((n) => !(n > 0))) throw new Error("waterfall.halfSize must be positive");
  return Object.freeze({ kind: "clearance", subtype: "waterfall", aabb: aabbFromCenterHalf(c, half), sdf: (point) => sdBox(point, c, half) });
}

/** 洞穴：带开口的圆角盒腔体（复用 sdCave）。 */
export function caveVolume({ center, halfSize, openingRadius = 0.8 }) {
  const c = vec3(center, "cave.center");
  const half = vec3(halfSize, "cave.halfSize");
  if (half.some((n) => !(n > 0))) throw new Error("cave.halfSize must be positive");
  return Object.freeze({ kind: "clearance", subtype: "cave", aabb: aabbFromCenterHalf(c, half.map((n) => n + 0.35)), sdf: (point) => sdCave(point, c, half, openingRadius) });
}

/** 把 foundation collar 逐个 smooth-union 进场；k<=0 退化为硬 union。 */
export function smoothUnionVolumes(field, volumes, { k = 0.5 } = {}) {
  if (!field?.map) throw new Error("smoothUnionVolumes requires a ScalarField-like input");
  if (!Array.isArray(volumes) || volumes.some((v) => typeof v?.sdf !== "function")) throw new Error("volumes with sdf required");
  return field.map((value, position) => volumes.reduce((acc, volume) => smoothUnion(acc, volume.sdf(position), k), value));
}

/** 把 clearance（运河/瀑布/洞穴/门洞）逐个 hard subtract 出场，保持 hard route。 */
export function subtractVolumes(field, volumes) {
  if (!field?.map) throw new Error("subtractVolumes requires a ScalarField-like input");
  if (!Array.isArray(volumes) || volumes.some((v) => typeof v?.sdf !== "function")) throw new Error("volumes with sdf required");
  return field.map((value, position) => volumes.reduce((acc, volume) => sdfSubtract(acc, volume.sdf(position)), value));
}
