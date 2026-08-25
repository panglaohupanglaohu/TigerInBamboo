// =====================================================================
// Overlapping Model — 从样例像素/标签网格提取 N×N pattern（V7-G4）
// 兼容关系按重叠区域逐格比较；输出仍消费通用 WFC solver。
// =====================================================================

import { BitSet } from "../core/bitSet.js";
import { createRectGrid2D } from "../graph/rectGrid2d.js";
import { solveWfc } from "./solver.js";

const DIRS = ["N", "E", "S", "W"];

function assertSample(sample) {
  if (!Array.isArray(sample) || sample.length === 0 || !Array.isArray(sample[0]) || sample[0].length === 0) {
    throw new Error("OverlappingModel2D sample must be a non-empty rectangular array");
  }
  const width = sample[0].length;
  if (sample.some((row) => !Array.isArray(row) || row.length !== width)) throw new Error("sample must be rectangular");
  return { width, height: sample.length };
}

function keyOf(pattern) {
  return JSON.stringify(pattern);
}

function rotate(pattern) {
  const n = pattern.length;
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => pattern[n - 1 - x][y]));
}

function mirror(pattern) {
  return pattern.map((row) => row.slice().reverse());
}

function patternTransforms(pattern, augmentSymmetry) {
  if (!augmentSymmetry) return [pattern];
  const out = [];
  let p = pattern;
  for (let i = 0; i < 4; i++) {
    out.push(p);
    out.push(mirror(p));
    p = rotate(p);
  }
  return out;
}

function equalOverlap(a, b, direction, n) {
  if (direction === "E") {
    for (let y = 0; y < n; y++) for (let x = 1; x < n; x++) if (a[y][x] !== b[y][x - 1]) return false;
  } else if (direction === "W") {
    for (let y = 0; y < n; y++) for (let x = 0; x < n - 1; x++) if (a[y][x] !== b[y][x + 1]) return false;
  } else if (direction === "S") {
    for (let y = 1; y < n; y++) for (let x = 0; x < n; x++) if (a[y][x] !== b[y - 1][x]) return false;
  } else {
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n; x++) if (a[y][x] !== b[y + 1][x]) return false;
  }
  return true;
}

function sampleAt(sample, x, y, periodic) {
  const h = sample.length;
  const w = sample[0].length;
  if (periodic) return sample[(y % h + h) % h][(x % w + w) % w];
  return sample[y]?.[x];
}

/**
 * @param {object} opts
 * @param {unknown[][]} opts.sample
 * @param {number} opts.N pattern 边长
 * @param {number} [opts.outWidth] 输出宽度，缺省 sample width
 * @param {number} [opts.outHeight] 输出高度，缺省 sample height
 * @param {boolean} [opts.periodic=false] 样例/输出是否周期
 * @param {boolean} [opts.augmentSymmetry=true] 旋转+镜像增广
 */
export function createOverlappingModel2D({ sample, N, outWidth, outHeight, periodic = false, augmentSymmetry = true } = {}) {
  const { width, height } = assertSample(sample);
  N = N >>> 0;
  if (N < 1 || (N > width || N > height) && !periodic) throw new Error(`invalid overlap size N=${N}`);
  const patternMap = new Map();
  const patterns = [];
  const add = (pattern, weight = 1) => {
    const key = keyOf(pattern);
    const existing = patternMap.get(key);
    if (existing !== undefined) {
      patterns[existing].weight += weight;
      return existing;
    }
    const id = patterns.length;
    patternMap.set(key, id);
    patterns.push({ key: `pattern:${id}`, pattern: pattern.map((row) => row.slice()), weight });
    return id;
  };
  const maxX = periodic ? width : width - N + 1;
  const maxY = periodic ? height : height - N + 1;
  for (let sy = 0; sy < maxY; sy++) for (let sx = 0; sx < maxX; sx++) {
    const p = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => sampleAt(sample, sx + x, sy + y, periodic)));
    for (const transformed of patternTransforms(p, augmentSymmetry)) add(transformed);
  }
  if (patterns.length === 0) throw new Error("no patterns extracted");
  const compatible = Object.fromEntries(DIRS.map((dir) => [dir, patterns.map(() => new BitSet(patterns.length, false))]));
  for (let a = 0; a < patterns.length; a++) for (let b = 0; b < patterns.length; b++) {
    for (const dir of DIRS) if (equalOverlap(patterns[a].pattern, patterns[b].pattern, dir, N)) compatible[dir][a].set(b);
  }
  const graph = createRectGrid2D({
    width: (outWidth ?? width) >>> 0,
    height: (outHeight ?? height) >>> 0,
    boundary: periodic ? "periodic-both" : "non-periodic",
  });
  const compiled = {
    variants: patterns.map((p, index) => Object.freeze({ ...p, index, protoId: p.key, builderKey: "pattern" })),
    variantIndex: new Map(patterns.map((p, i) => [p.key, i])),
    stats: { prototypes: patterns.length, variants: patterns.length, deduped: 0 },
  };
  const table = {
    directions: DIRS,
    compatible,
    neighborsOf(index, direction) { return compatible[direction][index]; },
    isCompatible(a, direction, b) { return compatible[direction][a].has(b); },
  };
  return Object.freeze({ kind: "overlapping-2d", N, graph, compiled, table, sampleSize: { width, height }, periodic });
}

export function solveOverlapping2D({ model, seed, pins = [], ...options } = {}) {
  if (!model || model.kind !== "overlapping-2d") throw new Error("solveOverlapping2D requires an overlapping model");
  return solveWfc({ graph: model.graph, compiled: model.compiled, table: model.table, seed, pins, ...options });
}

/** 将 pattern assignment 的左上角标签恢复成二维网格。 */
export function renderOverlappingAssignment(model, result) {
  if (!result?.ok) return null;
  const { width, height } = model.graph;
  const out = Array.from({ length: height + model.N - 1 }, () => Array(width + model.N - 1).fill(undefined));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const id = result.assignmentByCellId[`r:${x}:${y}`];
    const p = model.compiled.variants[model.compiled.variantIndex.get(id)].pattern;
    for (let py = 0; py < model.N; py++) for (let px = 0; px < model.N; px++) {
      const ox = x + px; const oy = y + py;
      if (out[oy][ox] === undefined) out[oy][ox] = p[py][px];
    }
  }
  return out;
}
