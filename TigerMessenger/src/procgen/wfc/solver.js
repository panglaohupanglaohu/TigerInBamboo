// =====================================================================
//  Solver — WFC 主循环（V7-G3）
//  观察（最低 Shannon 熵堆 + 加权选择）→ 传播（bitset / support-count）
//  → 冲突时限界回溯（Trail 回放，不复制 wave）→ 全部坍缩输出解。
//  确定性契约：同 seed + 同模块集 + 同图 → 同解同 solutionHash；
//  遍历顺序全部来自图适配器的稳定序与 BitSet 升序置位迭代；
//  tie-break 噪声只由 (seed, cellId) 派生，不消耗随机流。
//  禁止 while-restart：所有失败路径要么回溯（有限上限），要么返回
//  结构化 failure，要么取消——不存在无界重试。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { VersionedMinHeap } from "../core/priorityQueue.js";
import { Trail } from "../core/trail.js";
import { hashHex } from "../../core/rng.js";
import { createStableRng } from "../core/stableRng.js";
import { WaveState } from "./waveState.js";
import { weightedChoiceFromDomain } from "./entropy.js";
import { createPropagator, createPropagateStats, SupportCountState } from "./propagator.js";
import { Backtracker, resolveMaxBacktrack } from "./backtracker.js";
import { explainFailure } from "./conflictExplain.js";

/** 传播模式候选集阈值：variant 数达到该值时默认启用 support-count */
export const SUPPORT_COUNT_VARIANT_THRESHOLD = 256;

/** 传播模式选择：显式指定优先，否则按 variant 数阈值自适应 */
export function selectPropagateMode(variantCount, explicit) {
  if (explicit === "bitset" || explicit === "support-count") return explicit;
  return variantCount >= SUPPORT_COUNT_VARIANT_THRESHOLD ? "support-count" : "bitset";
}

/**
 * 求解。
 * @param {object} opts
 * @param {object} opts.graph 图适配器（cells()/neighborsOf()/cellId()）
 * @param {object} opts.compiled compileVariants() 输出（variants 含 weight/key）
 * @param {object} opts.table compileCompatibilityTable() 输出
 * @param {number} opts.seed 种子
 * @param {Array<{cell:string|number, variant:string|number, source?:string}>} [opts.pins]
 *   hard lock：cell（ID 或 index）预坍缩到 variant（key 或 index）
 * @param {Array<{cell:string|number, variant:string|number, reason?:string}>} [opts.bans]
 *   预约束 ban：求解前剔除单个候选（level 0，回溯永不撤销），
 *   用于楼层谓词/支撑/边界模板等"求解前必不满足"的候选（V7-G5）
 * @param {number} [opts.maxBacktrack] 回溯上限（有限；缺省 32 或 profile 指定）
 * @param {object} [opts.profile] 完整生成 profile（profile.maxBacktrack）
 * @param {"bitset"|"support-count"} [opts.mode] 传播模式（缺省按 variant 数自适应）
 * @param {()=>boolean} [opts.shouldCancel] 取消检查（传播每 256 ops 一次）
 * @param {(direction:string)=>import("../core/bitSet.js").BitSet[]} [opts.compatibleFor]
 *   自定义方向 → 兼容表（默认 table.compatible[direction]）
 */
export function solveWfc(opts) {
  const {
    graph,
    compiled,
    table,
    seed,
    pins = [],
    bans = [],
    profile,
    shouldCancel,
    compatibleFor = (dir) => table.compatible[dir],
  } = opts;
  const variants = compiled.variants;
  const variantCount = variants.length;
  const maxBacktrack = resolveMaxBacktrack({ maxBacktrack: opts.maxBacktrack, profile });
  const mode = selectPropagateMode(variantCount, opts.mode);

  // —— 权重与 w·log(w)（schema 已保证 weight 有限 >0，熵不产生 NaN） ——
  const weights = new Float64Array(variantCount);
  const weightLogWeights = new Float64Array(variantCount);
  for (let v = 0; v < variantCount; v++) {
    weights[v] = variants[v].weight;
    weightLogWeights[v] = variants[v].weight * Math.log(variants[v].weight);
  }
  const variantKeyOf = (v) => variants[v].key;

  const cells = graph.cells();
  const cellIds = cells.map((c) => c.id);
  const wave = new WaveState({
    cellCount: cells.length,
    variantCount,
    weights,
    weightLogWeights,
    cellIds,
  });
  const trail = new Trail();
  const rng = createStableRng(seed, "wfc");
  const backtracker = new Backtracker(maxBacktrack);
  const propagator = createPropagator({ graph, compatibleFor });
  const support = mode === "support-count" ? new SupportCountState(graph, compatibleFor, variantCount) : null;
  const stats = createPropagateStats();
  stats.observations = 0;
  stats.backtracks = 0;
  const hooks = { stats, shouldCancel, changedCells: [] };

  const propagate = (seedCells) =>
    support
      ? support.propagate(wave, seedCells, trail, hooks)
      : propagator.propagateBitset(wave, seedCells, trail, hooks);

  // —— hard locks（level 0，先于一切 choice point，回溯永不撤销） ——
  const hardLocks = [];
  for (const pin of pins) {
    const cellIndex = typeof pin.cell === "number" ? pin.cell : graph.indexOfId(pin.cell);
    const variantIndex =
      typeof pin.variant === "number" ? pin.variant : compiled.variantIndex.get(pin.variant);
    if (cellIndex < 0 || variantIndex === undefined || variantIndex < 0) {
      return failure("invalid-pin", Math.max(cellIndex, -1));
    }
    hardLocks.push({ cell: wave.cellId(cellIndex), variant: variantKeyOf(variantIndex), source: pin.source ?? "pin" });
    // 坍缩到指定 variant：ban 掉其余全部
    const others = wave.domain(cellIndex).toArray().filter((v) => v !== variantIndex);
    for (const v of others) wave.ban(cellIndex, v, trail, "hard-lock");
    if (wave.count(cellIndex) === 0 || !wave.domain(cellIndex).has(variantIndex)) {
      return failure("unsatisfiable", cellIndex);
    }
  }

  // —— 预约束 bans（level 0，与 hard lock 同级，回溯永不撤销） ——
  for (const entry of bans) {
    const cellIndex = typeof entry.cell === "number" ? entry.cell : graph.indexOfId(entry.cell);
    const variantIndex =
      typeof entry.variant === "number" ? entry.variant : compiled.variantIndex.get(entry.variant);
    if (cellIndex < 0 || variantIndex === undefined || variantIndex < 0) {
      return failure("invalid-ban", Math.max(cellIndex, -1));
    }
    wave.ban(cellIndex, variantIndex, trail, entry.reason ?? "pre-ban");
    if (wave.count(cellIndex) === 0) {
      return failure("unsatisfiable", cellIndex);
    }
  }

  function failure(reason, cellIndex) {
    return attachInternals({
      ...explainFailure({ reason, cellIndex, wave, trail, backtracker, hardLocks, variantKeyOf }),
      stats,
      solutionHash: null,
    });
  }

  /** 测试/调试：暴露内部状态（choice point 栈、trail、heap、wave） */
  function attachInternals(result) {
    if (opts.exposeInternals) {
      result.internals = { wave, trail, backtracker, heap, support };
    }
    return result;
  }

  // —— 初始传播：全部 cell 入队（稳定升序），求 AC 闭包 ——
  {
    const all = cells.map((c) => c.index);
    const r = propagate(all);
    if (r && r.cancelled) return { ok: false, reason: "cancelled", stats, solutionHash: null };
    if (r && r.contradiction !== undefined) {
      return failure("unsatisfiable", r.contradiction);
    }
  }

  // —— 最低熵堆：版本戳 = cellVersion，陈旧项 pop 时静默丢弃 ——
  const heap = new VersionedMinHeap();
  const pushCell = (i) => {
    if (wave.count(i) > 1) heap.push(i, wave.priorityOf(i, seed), wave.cellVersion(i));
  };
  for (let i = 0; i < wave.cellCount; i++) pushCell(i);
  const pushChanged = () => {
    for (const i of hooks.changedCells) pushCell(i);
  };
  const popMinEntropy = () => {
    for (;;) {
      const e = heap.popValid(0); // 版本校验在下方（等值比较，回滚后旧版本重新生效）
      if (!e) return -1;
      if (e.version !== wave.cellVersion(e.cellId)) continue; // 陈旧
      if (wave.count(e.cellId) <= 1) continue; // 已坍缩/空
      return e.cellId;
    }
  };

  // —— 主循环：观察 → 传播 → （冲突）回溯 ——
  for (;;) {
    if (shouldCancel && shouldCancel()) {
      return { ok: false, reason: "cancelled", stats, solutionHash: null };
    }
    const cellIndex = popMinEntropy();
    if (cellIndex < 0) break; // 堆空 = 全部坍缩
    const cp = backtracker.beginChoice(wave, cellIndex, trail, rng);
    // 观察：加权选择恰消耗一次随机流
    const chosen = weightedChoiceFromDomain(
      wave.domain(cellIndex),
      weights,
      wave.sumW[cellIndex],
      rng.next()
    );
    cp.chosenVariant = chosen;
    stats.observations++;
    const dom = wave.domain(cellIndex).toArray();
    for (const v of dom) {
      if (v !== chosen && wave.ban(cellIndex, v, trail, `observation:chosen=${variantKeyOf(chosen)}`)) {
        stats.bans++;
      }
    }
    if (support) support.dirty = true; // 观察 ban 发生在传播外，计数器需重建
    let conflict = propagate([cellIndex]);
    pushChanged();
    // 冲突 → 限界回溯（回放 trail，不复制 wave）
    while (conflict) {
      if (conflict.cancelled) return { ok: false, reason: "cancelled", stats, solutionHash: null };
      const step = backtracker.undoToAlternative(wave, trail, rng);
      if (step === null) return failure("unsatisfiable", conflict.contradiction);
      if (step.exceeded) return failure("max-backtrack", conflict.contradiction);
      stats.backtracks++;
      stats.bans++; // 失败 variant 的 backtrack ban
      if (support) support.dirty = true; // 回滚后计数器重建（读恢复后的域）
      conflict = propagate([step.cellIndex]);
      for (const i of step.restoredCells) pushCell(i);
      pushChanged();
      pushCell(step.cellIndex);
    }
  }

  // —— 解提取与 canonical hash ——
  const assignment = new Int32Array(wave.cellCount);
  for (let i = 0; i < wave.cellCount; i++) assignment[i] = wave.domain(i).firstSetBit();
  const solutionHash = hashHex(
    cellIds.map((id, i) => `${id}=${variantKeyOf(assignment[i])}`).join("|")
  );
  return attachInternals({
    ok: true,
    reason: "solved",
    assignment,
    assignmentByCellId: Object.fromEntries(cellIds.map((id, i) => [id, variantKeyOf(assignment[i])])),
    solutionHash,
    mode,
    stats,
  });
}
