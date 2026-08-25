// =====================================================================
//  Entropy — 加权 Shannon 熵与确定性选择（V7-G3）
//  · 真正的 Shannon 熵：H = log(sumW) - sumWLogW / sumW。
//    禁止把候选数（candidate count）标为 entropy——count 只用于
//    "是否已坍缩" 判断，不进入优先级公式。
//  · 同熵 tie-break 只加 hash(seed, cellId) 派生的 1e-9 级稳定噪声，
//    不消耗任何随机流：扫描/选 cell 前后 RNG state 不变。
//  · weightedChoiceFromDomain：按权重的累积分布从 BitSet 中选 variant，
//    遍历方向固定为置位升序，保证同 r 同结果。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { seedFromString } from "../../core/rng.js";

/** tie-break 噪声幅度：1e-9，远小于任何两个不同真实熵之间的差 */
export const TIE_NOISE_SCALE = 1e-9;

/**
 * 加权 Shannon 熵。
 * @param {number} count 候选数（仅用于坍缩判断，不冒充熵）
 * @param {number} sumW Σw
 * @param {number} sumWLogW Σ w·log(w)
 * @returns {number} count <= 1 返回 Infinity（不再参与最低熵竞争）
 */
export function shannonEntropy(count, sumW, sumWLogW) {
  if (count <= 1) return Infinity;
  return Math.log(sumW) - sumWLogW / sumW;
}

/**
 * 同熵 tie 稳定噪声：只由 (seed, cellId) 决定，范围 [0, 1e-9)。
 * 不读任何 RNG 流——重复扫描同一 wave 得到完全相同的优先级。
 */
export function tieNoise(seed, cellId) {
  const h = seedFromString(`${seed >>> 0}:${String(cellId)}`);
  return (h / 4294967296) * TIE_NOISE_SCALE;
}

/**
 * cell 的堆优先级 = Shannon 熵 + 稳定 tie 噪声。
 * 已坍缩 / 空域 cell 为 Infinity，永远不会被最低熵堆选中。
 */
export function cellPriority(count, sumW, sumWLogW, seed, cellId) {
  const h = shannonEntropy(count, sumW, sumWLogW);
  if (!Number.isFinite(h)) return Infinity;
  return h + tieNoise(seed, cellId);
}

/**
 * 从 BitSet domain 中按权重加权选择一个 variant。
 * @param {BitSet} domain 候选域（非空）
 * @param {Float64Array|number[]} weights 每 variant 权重（>0）
 * @param {number} sumW domain 内权重和（调用方增量维护，避免重扫）
 * @param {number} r [0,1) 随机值（通常 rng.next()，每次观察恰消耗一次）
 * @returns {number} 选中的 variant index
 */
export function weightedChoiceFromDomain(domain, weights, sumW, r) {
  let target = r * sumW;
  let chosen = -1;
  domain.forEachSetBit((v) => {
    if (chosen >= 0) return;
    target -= weights[v];
    if (target < 0) chosen = v;
  });
  // 浮点边界：r 极接近 1 时可能未命中，取最高位置位（确定性兜底）
  if (chosen < 0) {
    let last = -1;
    domain.forEachSetBit((v) => {
      last = v;
    });
    chosen = last;
  }
  return chosen;
}
