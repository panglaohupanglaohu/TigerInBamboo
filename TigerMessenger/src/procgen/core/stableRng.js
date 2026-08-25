// =====================================================================
//  StableRng — 可 fork / 可序列化 / 可恢复的稳定随机源（V7-G1）
//  mulberry32 内核（与 src/core/rng.js 同族，但支持导出/恢复内部 state）。
//  禁止依赖 Math.random()、Date.now() 或对象插入顺序。
//  流名（RNG_STREAMS）派生子源；同 seed + 同流名必得同序列。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { seedFromString } from "../../core/rng.js";

export class StableRng {
  /**
   * @param {number} seed 32 位种子
   * @param {number} [state] 内部状态（恢复用；缺省由 seed 派生）
   */
  constructor(seed, state) {
    this.seed = seed >>> 0;
    this.state = (state === undefined ? this.seed : state) >>> 0 || 1;
  }

  /** 下一个 [0,1) */
  next() {
    let a = this.state;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    this.state = a;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min,max) 浮点 */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** [min,max] 整数（含两端） */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** 命名子源：同母 seed 下各流互不干扰且可复现 */
  fork(streamName) {
    const extra =
      typeof streamName === "number" && Number.isFinite(streamName)
        ? streamName >>> 0
        : seedFromString(String(streamName ?? 0));
    return new StableRng(((this.seed ^ extra ^ 0x9e3779b9) >>> 0) || 1);
  }

  /** Fisher–Yates 稳定洗牌（不改入参） */
  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** 导出可序列化 state（JSON 安全） */
  exportState() {
    return { seed: this.seed, state: this.state };
  }

  /** 从导出的 state 恢复 */
  static fromState(saved) {
    if (!saved || !Number.isFinite(saved.seed) || !Number.isFinite(saved.state)) {
      throw new Error("StableRng.fromState: invalid state");
    }
    return new StableRng(saved.seed, saved.state);
  }

  /** 恢复到指定 state（同一实例继续用） */
  restoreState(saved) {
    if (!saved || !Number.isFinite(saved.seed) || saved.seed >>> 0 !== this.seed) {
      throw new Error("StableRng.restoreState: seed mismatch");
    }
    this.state = saved.state >>> 0;
    return this;
  }
}

/** 便利工厂：master seed + 流名（RNG_STREAMS 之一） */
export function createStableRng(masterSeed, streamName = "wfc") {
  const rng = new StableRng(masterSeed >>> 0);
  if (streamName === null || streamName === undefined) return rng;
  return rng.fork(streamName);
}
