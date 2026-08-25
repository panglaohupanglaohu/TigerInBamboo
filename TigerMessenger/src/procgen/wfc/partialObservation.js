// =====================================================================
//  Partial Observation — 模型层部分观察 debug 数据（V7-G4）
//  应用 pins/bans 后只做一次初始 AC 传播，导出每个 cell 的
//  候选投票（variant + weight + share）、domain size、Shannon 熵。
//  输出纯 JSON 数据，不依赖 Three.js；供 Inspector / 调试工具消费。
// =====================================================================

import { Trail } from "../core/trail.js";
import { WaveState } from "./waveState.js";
import { createPropagator } from "./propagator.js";

/**
 * 部分观察快照：pins/bans 坍缩 + 初始传播后的 wave 状态导出。
 * @param {object} opts
 * @param {object} opts.model 任意带 graph/compiled/table 的模型
 *   （simple-tiled-2d / overlapping-2d / voxel-module-3d）
 * @param {Array} [opts.pins] 同 solveWfc 的 pins（预坍缩）
 * @param {Array} [opts.bans] 同 solveWfc 的 bans（预约束剔除）
 * @returns {{kind:string, ok:boolean, contradiction?:string,
 *   cells:Array<{id:string, index:number, domainSize:number, collapsed:boolean,
 *     entropy:number, candidates:Array<{variant:string, weight:number, share:number}>},
 *   >, stats:object}}
 */
export function partialObservation({ model, pins = [], bans = [] } = {}) {
  if (!model || !model.graph || !model.compiled || !model.table) {
    throw new Error("partialObservation requires a model with graph/compiled/table");
  }
  const { graph, compiled, table } = model;
  const variants = compiled.variants;
  const variantCount = variants.length;
  const weights = new Float64Array(variantCount);
  const weightLogWeights = new Float64Array(variantCount);
  for (let v = 0; v < variantCount; v++) {
    weights[v] = variants[v].weight;
    weightLogWeights[v] = variants[v].weight * Math.log(variants[v].weight);
  }
  const cells = graph.cells();
  const wave = new WaveState({
    cellCount: cells.length,
    variantCount,
    weights,
    weightLogWeights,
    cellIds: cells.map((c) => c.id),
  });
  const trail = new Trail();

  // pins：坍缩到指定 variant；bans：剔除单个候选
  for (const pin of pins) {
    const cellIndex = typeof pin.cell === "number" ? pin.cell : graph.indexOfId(pin.cell);
    const variantIndex =
      typeof pin.variant === "number" ? pin.variant : compiled.variantIndex.get(pin.variant);
    if (cellIndex < 0 || variantIndex === undefined || variantIndex < 0) {
      throw new Error(`partialObservation: invalid pin ${JSON.stringify(pin)}`);
    }
    for (const v of wave.domain(cellIndex).toArray()) {
      if (v !== variantIndex) wave.ban(cellIndex, v, trail, "hard-lock");
    }
  }
  for (const entry of bans) {
    const cellIndex = typeof entry.cell === "number" ? entry.cell : graph.indexOfId(entry.cell);
    const variantIndex =
      typeof entry.variant === "number" ? entry.variant : compiled.variantIndex.get(entry.variant);
    if (cellIndex < 0 || variantIndex === undefined || variantIndex < 0) {
      throw new Error(`partialObservation: invalid ban ${JSON.stringify(entry)}`);
    }
    wave.ban(cellIndex, variantIndex, trail, entry.reason ?? "pre-ban");
  }

  // 初始 AC 传播（bitset 模式，无取消钩子——debug 数据必须完整）
  const propagator = createPropagator({ graph, compatibleFor: (dir) => table.compatible[dir] });
  const stats = { bans: 0, queuePushes: 0, bitsetWords: 0, peakQueue: 0, propagations: 0 };
  const hooks = { stats, shouldCancel: undefined, changedCells: [] };
  const r = propagator.propagateBitset(wave, cells.map((c) => c.index), trail, hooks);
  const contradiction = r && r.contradiction !== undefined ? wave.cellId(r.contradiction) : null;

  // 导出：domain size / Shannon 熵 / 候选投票（weight share）
  const out = [];
  for (let i = 0; i < wave.cellCount; i++) {
    const count = wave.count(i);
    const sumW = wave.sumW[i];
    const entropy = count <= 1 ? 0 : Math.log(sumW) - wave.sumWLogW[i] / sumW;
    const candidates = [];
    wave.domain(i).forEachSetBit((v) => {
      candidates.push({
        variant: variants[v].key,
        weight: weights[v],
        share: sumW > 0 ? weights[v] / sumW : 0,
      });
    });
    out.push({
      id: wave.cellId(i),
      index: i,
      domainSize: count,
      collapsed: count === 1,
      entropy,
      candidates,
    });
  }
  return {
    kind: "partial-observation",
    ok: contradiction === null,
    contradiction,
    cells: out,
    stats,
  };
}
