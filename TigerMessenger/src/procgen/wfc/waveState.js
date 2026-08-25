// =====================================================================
//  WaveState — WFC 波函数状态（V7-G3）
//  每 cell 的候选域是一个 BitSet；count / sumW / sumWLogW 随 ban
//  增量维护（O(1) 每次 ban），cellVersion 作为最低熵堆的版本戳。
//  ban 一律经 Trail 记录 undo 信息，回溯只回放 trail，不复制整张 wave；
//  restoreFromTrail 是 ban 的严格逆操作（版本戳同步减回），保证回滚后
//  domain、聚合量、版本戳、canonical hash 完全恢复。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { BitSet } from "../core/bitSet.js";
import { hashHex } from "../../core/rng.js";
import { cellPriority } from "./entropy.js";

export class WaveState {
  /**
   * @param {object} opts
   * @param {number} opts.cellCount 图 cell 数
   * @param {number} opts.variantCount 模块 variant 数
   * @param {Float64Array|number[]} opts.weights 每 variant 权重（>0）
   * @param {Float64Array|number[]} opts.weightLogWeights 每 variant w·log(w)
   * @param {string[]} opts.cellIds 稳定 cell ID（index → id）
   */
  constructor({ cellCount, variantCount, weights, weightLogWeights, cellIds }) {
    this.cellCount = cellCount;
    this.variantCount = variantCount;
    this.weights = weights;
    this.weightLogWeights = weightLogWeights;
    this.cellIds = cellIds;
    this._indexOfId = new Map(cellIds.map((id, i) => [id, i]));
    /** @type {BitSet[]} 每 cell 候选域 */
    this.domains = new Array(cellCount);
    this.counts = new Int32Array(cellCount);
    this.sumW = new Float64Array(cellCount);
    this.sumWLogW = new Float64Array(cellCount);
    /** 最低熵堆版本戳：每次 ban +1，每次 restore -1（回滚后完全恢复） */
    this.cellVersions = new Uint32Array(cellCount);
    let totalW = 0;
    let totalWLW = 0;
    for (let v = 0; v < variantCount; v++) {
      totalW += weights[v];
      totalWLW += weightLogWeights[v];
    }
    for (let i = 0; i < cellCount; i++) {
      this.domains[i] = new BitSet(variantCount, true);
      this.counts[i] = variantCount;
      this.sumW[i] = totalW;
      this.sumWLogW[i] = totalWLW;
    }
  }

  domain(cellIndex) {
    return this.domains[cellIndex];
  }

  count(cellIndex) {
    return this.counts[cellIndex];
  }

  cellId(cellIndex) {
    return this.cellIds[cellIndex];
  }

  cellVersion(cellIndex) {
    return this.cellVersions[cellIndex];
  }

  /** 最低熵堆优先级（Shannon 熵 + seed/cellId 稳定 tie 噪声） */
  priorityOf(cellIndex, seed) {
    return cellPriority(
      this.counts[cellIndex],
      this.sumW[cellIndex],
      this.sumWLogW[cellIndex],
      seed,
      this.cellIds[cellIndex]
    );
  }

  /**
   * ban 一个候选：写 trail（记录 ban 前聚合量）→ 清位 → 增量更新 → 版本 +1。
   * @returns {boolean} 是否真实移除（已不在域中返回 false，不写 trail）
   */
  ban(cellIndex, variant, trail, reason) {
    const dom = this.domains[cellIndex];
    if (!dom.has(variant)) return false;
    trail.push(
      this.cellIds[cellIndex],
      variant,
      {
        prevSumW: this.sumW[cellIndex],
        prevSumWLogW: this.sumWLogW[cellIndex],
        prevCount: this.counts[cellIndex],
      },
      reason
    );
    dom.clear(variant);
    this.counts[cellIndex]--;
    this.sumW[cellIndex] -= this.weights[variant];
    this.sumWLogW[cellIndex] -= this.weightLogWeights[variant];
    this.cellVersions[cellIndex]++;
    return true;
  }

  /**
   * trail 回放的逆操作：恢复位、聚合量与版本戳。
   * undoInfo 即 trail 记录里的 ban 前快照。
   */
  restoreFromTrail(cellId, variant, undoInfo) {
    const cellIndex = this._indexOfId.get(cellId);
    this.domains[cellIndex].set(variant);
    this.sumW[cellIndex] = undoInfo.prevSumW;
    this.sumWLogW[cellIndex] = undoInfo.prevSumWLogW;
    this.counts[cellIndex] = undoInfo.prevCount;
    this.cellVersions[cellIndex]--;
    return cellIndex;
  }

  /**
   * domain ∩= mask（传播用）：对所有被移除的位逐个 ban（逐个进 trail）。
   * @returns {number} 移除的候选数
   */
  intersectDomain(cellIndex, mask, trail, reason) {
    const dom = this.domains[cellIndex];
    const words = dom.words;
    let removed = 0;
    for (let w = 0; w < words.length; w++) {
      let gone = words[w] & ~mask.words[w];
      while (gone !== 0) {
        const b = 31 - Math.clz32(gone & -gone);
        this.ban(cellIndex, (w << 5) | b, trail, reason);
        removed++;
        gone &= gone - 1;
      }
    }
    return removed;
  }

  /** 是否全部坍缩（每 cell 恰 1 候选） */
  isSolved() {
    for (let i = 0; i < this.cellCount; i++) {
      if (this.counts[i] !== 1) return false;
    }
    return true;
  }

  /** 是否存在空域 cell（矛盾） */
  firstEmptyCell() {
    for (let i = 0; i < this.cellCount; i++) {
      if (this.counts[i] === 0) return i;
    }
    return -1;
  }

  /**
   *  canonical hash：全部 domain 位图 + 聚合量指纹。
   *  回滚一致性测试用它证明"完全恢复"（含 sumW/sumWLogW 的浮点精确值）。
   */
  waveHash() {
    const parts = new Array(this.cellCount);
    for (let i = 0; i < this.cellCount; i++) {
      parts[i] =
        `${this.cellIds[i]}#${this.counts[i]}#${this.sumW[i]}#${this.sumWLogW[i]}#` +
        this.domains[i].toHashString();
    }
    return hashHex(parts.join("|"));
  }
}
