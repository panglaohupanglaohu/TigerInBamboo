// =====================================================================
// ChunkField — 带 halo 的场分块（V7-G7）
// 每块多采样一圈边界，MC 接缝可由相邻块共享相同世界坐标采样保证。
// =====================================================================

import { ScalarField } from "./scalarField.js";

export function createChunkField({ origin, size, resolution, halo = 1, sample } = {}) {
  if (!Array.isArray(origin) || origin.length !== 3 || !Array.isArray(size) || size.length !== 3) throw new Error("ChunkField origin/size must be vec3");
  const baseResolution = typeof resolution === "number" ? [resolution, resolution, resolution] : [resolution.x, resolution.y, resolution.z];
  const expandedSize = baseResolution.map((n) => n + halo * 2);
  const spacing = size.map((extent, i) => extent / Math.max(1, baseResolution[i] - 1));
  const min = origin.map((value, i) => value - spacing[i] * halo);
  const max = min.map((value, i) => value + spacing[i] * (expandedSize[i] - 1));
  const field = new ScalarField({
    min, max,
    resolution: { x: expandedSize[0], y: expandedSize[1], z: expandedSize[2] },
    sample: (position, x, y, z) => sample(position, x - halo, y - halo, z - halo),
  });
  return Object.freeze({ kind: "chunk-field", origin: origin.slice(), size: size.slice(), halo, resolution: Object.freeze({ x: baseResolution[0], y: baseResolution[1], z: baseResolution[2] }), field, spacing });
}

export function chunkKey(x, y, z) { return `${x}:${y}:${z}`; }

export function chunkBounds({ chunk, origin, size }) {
  return { min: origin.map((v, i) => v + chunk[i] * size[i]), max: origin.map((v, i) => v + (chunk[i] + 1) * size[i]) };
}

export function dirtyAabbToChunks({ min, max, chunkSize, origin = [0, 0, 0], halo = 0 } = {}) {
  const out = [];
  const lo = min.map((value, i) => Math.floor((value - origin[i]) / chunkSize[i]) - halo);
  const hi = max.map((value, i) => Math.floor((value - origin[i]) / chunkSize[i]) + halo);
  for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) out.push({ key: chunkKey(x, y, z), coord: [x, y, z] });
  return out;
}

export function fieldSampleHash(field, { precision = 1e5 } = {}) {
  let hash = 2166136261;
  for (const value of field?.data || []) { hash ^= Math.round(value * precision); hash = Math.imul(hash, 16777619); }
  for (const value of [...(field?.min || []), ...(field?.max || [])]) { hash ^= Math.round(value * precision); hash = Math.imul(hash, 16777619); }
  return `field${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

// 缓存失效键（TODO 1184）：field 内容 hash 与 blueprint/module/recipe 版本联动，任一项变化即失效
export function fieldCacheKey({ field, blueprintVersion = 0, moduleVersion = 0, recipeVersion = 0 } = {}) {
  return `bp${blueprintVersion}:mod${moduleVersion}:rec${recipeVersion}:${fieldSampleHash(field)}`;
}

// V7.0 基准（TODO 1207）：24³ cells + 1 halo；相邻活动 chunk 必须同分辨率，不混合
export const MC_BASELINE_CELLS = 24;
export const MC_BASELINE_HALO = 1;

export function assertUniformChunkResolution(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) throw new Error("assertUniformChunkResolution requires a non-empty chunk array");
  const keyOf = (chunk) => {
    const r = chunk?.resolution;
    const axes = typeof r === "number" ? [r, r, r] : [r?.x, r?.y, r?.z];
    if (axes.some((n) => !Number.isInteger(n) || n < 2)) throw new Error("chunk resolution must be >= 2 on every axis");
    return axes.join("x");
  };
  const first = keyOf(chunks[0]);
  for (const chunk of chunks) {
    const key = keyOf(chunk);
    if (key !== first) throw new Error(`mixed chunk resolutions forbidden in V7.0: ${first} vs ${key}`);
  }
  return first;
}
