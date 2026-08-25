// =====================================================================
//  Propagator — 约束传播（V7-G3）
//  两种模式，解语义完全一致（同一 AC 闭包）：
//  · bitset（默认）：对每个出边把源 cell 域内所有 variant 的兼容集做
//    BitSet union，再与目标域 intersection。方向 token 一律来自
//    graph edge（neighborsOf 的 direction），不写死 N/E/S/W。
//  · support-count（可选，候选集大时启用，对应文献 AC-4/ModuleHealth
//    思路）：为每条入边维护“目标 variant 还有多少源候选支持”的整数
//    计数；源 ban 一个 variant 只做 BitSet 置位遍历 + 计数递减，
//    计数归零才 ban——不做 O(A×B) 对象两两比较。
//  热循环每 256 ops 检查一次取消；统计 bans / queue pushes /
//  bitset words / 峰值 queue。空域立即返回矛盾（不继续传播）。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { BitSet } from "../core/bitSet.js";

/** 传播统计（bans 含 observe/pin，传播内外统一计数由 solver 汇总） */
export function createPropagateStats() {
  return { bans: 0, queuePushes: 0, bitsetWords: 0, peakQueue: 0, propagations: 0 };
}

/**
 * 构建传播器。
 * @param {object} opts
 * @param {object} opts.graph 图适配器（neighborsOf(i) → [{to, direction}]）
 * @param {(direction: string) => BitSet[]} opts.compatibleFor
 *   方向 token → compatible[direction][variant] = BitSet<邻居 variant>
 */
export function createPropagator({ graph, compatibleFor }) {
  const cellCount = graph.cellCount;
  // 预取每 cell 出边（稳定序由图适配器保证）
  const outEdges = new Array(cellCount);
  for (let i = 0; i < cellCount; i++) outEdges[i] = graph.neighborsOf(i);
  // 方向 → 兼容表缓存（缺失方向立即报错，不静默跳过）
  const compatCache = new Map();
  const compatOf = (dir) => {
    let c = compatCache.get(dir);
    if (c === undefined) {
      c = compatibleFor(dir);
      if (!c) throw new Error(`propagator: no compatibility table for direction "${dir}"`);
      compatCache.set(dir, c);
    }
    return c;
  };

  /**
   * bitset 模式传播。
   * @param {WaveState} wave
   * @param {number[]} seedCells 起始队列（域刚缩小的 cell index，稳定升序）
   * @param {Trail} trail
   * @param {object} hooks { stats, shouldCancel, scratch }
   * @returns {null | {contradiction:number} | {cancelled:true}}
   *   同时通过 hooks.changedCells 回填域发生变化的 cell（按发现序，确定）。
   */
  function propagateBitset(wave, seedCells, trail, hooks) {
    const { stats, shouldCancel } = hooks;
    const scratch = hooks.scratch || (hooks.scratch = new BitSet(wave.variantCount, false));
    const changed = hooks.changedCells || (hooks.changedCells = []);
    changed.length = 0;
    const queue = seedCells.slice();
    let head = 0;
    let ops = 0;
    stats.propagations++;
    if (queue.length > stats.peakQueue) stats.peakQueue = queue.length;
    while (head < queue.length) {
      if ((++ops & 255) === 0 && shouldCancel && shouldCancel()) return { cancelled: true };
      const c = queue[head++];
      const edges = outEdges[c];
      for (let e = 0; e < edges.length; e++) {
        const { to, direction } = edges[e];
        const compat = compatOf(direction);
        // support = ⋃_{v ∈ dom(c)} compatible[direction][v]
        scratch.clearAll();
        wave.domain(c).forEachSetBit((v) => {
          scratch.orInto(compat[v]);
          stats.bitsetWords += compat[v].words.length;
        });
        const reason = `neighbor-support:from=${wave.cellId(c)}:dir=${direction}`;
        const before = wave.count(to);
        const removed = wave.intersectDomain(to, scratch, trail, reason);
        stats.bitsetWords += scratch.words.length;
        if (removed > 0) {
          stats.bans += removed;
          if (wave.count(to) === 0) return { contradiction: to };
          if (wave.count(to) < before) {
            queue.push(to);
            stats.queuePushes++;
            changed.push(to);
            if (queue.length - head > stats.peakQueue) stats.peakQueue = queue.length - head;
          }
        }
      }
    }
    return null;
  }

  return { propagateBitset, compatOf, outEdges };
}

/**
 * SupportCountState — support-count 模式（AC-4 风格计数器）。
 * cnt[slot*V + v] = 目标 cell 的 variant v 在该入边方向上还拥有的源候选数。
 * 计数只在 propagate 内部随 ban 增量递减；observe / 回滚之后必须
 * rebuild（dirty 标记），重建只读当前域（BitSet 遍历），不做对象比较。
 */
export class SupportCountState {
  /**
   * @param {object} graph 图适配器
   * @param {(direction:string)=>BitSet[]} compatibleFor
   * @param {number} variantCount
   */
  constructor(graph, compatibleFor, variantCount) {
    this.graph = graph;
    this.variantCount = variantCount;
    const cellCount = graph.cellCount;
    // outSlot[c][e] = 出边 e（c→to）在目标 cell 入边槽位表中的全局槽位号
    this.outEdges = new Array(cellCount);
    this.outSlot = new Array(cellCount);
    this.outCompat = new Array(cellCount);
    let slotTotal = 0;
    const slotOfTarget = new Map(); // `${to}|${from}` → slot
    for (let c = 0; c < cellCount; c++) {
      const edges = graph.neighborsOf(c);
      this.outEdges[c] = edges;
      this.outCompat[c] = edges.map((e) => {
        const t = compatibleFor(e.direction);
        if (!t) throw new Error(`support-count: no compatibility table for direction "${e.direction}"`);
        return t;
      });
      this.outSlot[c] = edges.map((e) => {
        const key = `${e.to}|${c}`;
        let s = slotOfTarget.get(key);
        if (s === undefined) {
          s = slotTotal++;
          slotOfTarget.set(key, s);
        }
        return s;
      });
    }
    this.slotCount = slotTotal;
    this.counters = new Int32Array(slotTotal * variantCount);
    this.dirty = true;
  }

  /** 从当前 wave 域全量重建计数（observe/回滚后调用；BitSet 遍历，非对象比较） */
  rebuild(wave) {
    this.counters.fill(0);
    const V = this.variantCount;
    const cnt = this.counters;
    for (let c = 0; c < this.outEdges.length; c++) {
      const edges = this.outEdges[c];
      for (let e = 0; e < edges.length; e++) {
        const base = this.outSlot[c][e] * V;
        const compat = this.outCompat[c][e];
        wave.domain(c).forEachSetBit((u) => {
          compat[u].forEachSetBit((v) => {
            cnt[base + v]++;
          });
        });
      }
    }
    this.dirty = false;
  }

  /**
   * support-count 模式传播。队列元素为 (cell, bannedVariant) 对——
   * 源 cell 每 ban 一个 variant，只沿出边递减受影响计数，归零才级联。
   * 语义与 propagateBitset 相同（同一 AC 闭包），返回值约定一致。
   */
  propagate(wave, seedCells, trail, hooks) {
    const { stats, shouldCancel } = hooks;
    const changed = hooks.changedCells || (hooks.changedCells = []);
    changed.length = 0;
    if (this.dirty) this.rebuild(wave);
    const V = this.variantCount;
    const cnt = this.counters;
    const queue = []; // {cell, variant}
    let head = 0;
    let ops = 0;
    stats.propagations++;
    // 种子阶段：检查每个种子 cell 的邻居中失去全部支持的 variant
    for (const s of seedCells) {
      const edges = this.outEdges[s];
      for (let e = 0; e < edges.length; e++) {
        const { to } = edges[e];
        const base = this.outSlot[s][e] * V;
        const reason = `neighbor-support:from=${wave.cellId(s)}:dir=${edges[e].direction}`;
        const dom = wave.domain(to);
        const toBan = [];
        dom.forEachSetBit((v) => {
          if (cnt[base + v] === 0) toBan.push(v);
        });
        for (const v of toBan) {
          if (wave.ban(to, v, trail, reason)) {
            stats.bans++;
            queue.push({ cell: to, variant: v });
            stats.queuePushes++;
            changed.push(to);
          }
        }
        if (wave.count(to) === 0) return { contradiction: to };
      }
    }
    if (queue.length > stats.peakQueue) stats.peakQueue = queue.length;
    // 级联阶段：消费 (cell, bannedVariant) 对
    while (head < queue.length) {
      if ((++ops & 255) === 0 && shouldCancel && shouldCancel()) return { cancelled: true };
      const { cell, variant } = queue[head++];
      const edges = this.outEdges[cell];
      for (let e = 0; e < edges.length; e++) {
        const { to } = edges[e];
        const base = this.outSlot[cell][e] * V;
        const compat = this.outCompat[cell][e];
        const reason = `neighbor-support:from=${wave.cellId(cell)}:dir=${edges[e].direction}`;
        // variant 曾支持的全部目标 variant：计数递减，归零即 ban
        const zeroHits = [];
        compat[variant].forEachSetBit((v) => {
          stats.bitsetWords += compat[variant].words.length;
          if (cnt[base + v] > 0) {
            cnt[base + v]--;
            if (cnt[base + v] === 0 && wave.domain(to).has(v)) zeroHits.push(v);
          }
        });
        for (const v of zeroHits) {
          if (wave.ban(to, v, trail, reason)) {
            stats.bans++;
            queue.push({ cell: to, variant: v });
            stats.queuePushes++;
            changed.push(to);
            if (queue.length - head > stats.peakQueue) stats.peakQueue = queue.length - head;
          }
        }
        if (wave.count(to) === 0) return { contradiction: to };
      }
    }
    return null;
  }
}
