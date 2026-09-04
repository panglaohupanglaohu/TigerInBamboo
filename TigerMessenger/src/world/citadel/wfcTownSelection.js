// =====================================================================
//  Town WFC selection — 把 citadel 格图喂给 V7 solveWfc，
//  输出与 townscaperModuleSelection 同形的按格选型表。
//  失败不回退哈希路径（S20④ 静默失败：只标格）。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { compileVariants } from "../../procgen/wfc/socketCompiler.js";
import { compileCompatibilityTable } from "../../procgen/wfc/compatibilityTable.js";
import { solveWfc } from "../../procgen/wfc/solver.js";
import { createCitadelCellGraph, CITADEL_DIRS } from "./wfcGraphAdapter.js";
import { TOWN_MODULE_PROTOTYPES, townBanPolicy } from "./townModulePrototypes.js";

/**
 * 缺省策略 = `townBanPolicy`（`townModulePrototypes.js`）。
 * 它只看该格自己的暴露情况与柱高，不看邻居选了什么——邻居之间的约束
 * 全部由 compatibilityTable 负责，两边不能互相越权。
 * @returns {boolean} true = 该 variant 在该格可用
 */
export const defaultBanPolicy = townBanPolicy;

/** 保留旧名字，避免外部引用断裂 */
export { CITADEL_DIRS };

function protoFamilyOf(protoId, prototypes) {
  const hit = prototypes.find((p) => p.id === protoId);
  if (hit?.family) return hit.family;
  const dot = String(protoId ?? "").indexOf(".");
  return dot >= 0 ? protoId.slice(0, dot) : protoId;
}

/**
 * @param {object} opts
 * @param {Map<string,string>} opts.grid
 * @param {object[]} opts.prototypes ModulePrototype[]
 * @param {number} opts.seed
 * @param {Array} [opts.pins]
 * @param {Function} [opts.banPolicy]
 * @param {number} [opts.maxBacktrack]
 */
export function solveTownSelection({
  grid,
  prototypes = TOWN_MODULE_PROTOTYPES,
  seed,
  pins = [],
  banPolicy = defaultBanPolicy,
  maxBacktrack = 64,
} = {}) {
  const graph = createCitadelCellGraph(grid);
  const compiled = compileVariants(prototypes);
  const table = compileCompatibilityTable(compiled, { onDeadVariant: "throw" });
  const bans = [];
  for (const { id, index } of graph.cells()) {
    const exposure = graph.exposure(index);
    const iy = Number(id.split(",")[1]);
    const columnHeight = graph.columnHeight(index);
    const columnIsolated = graph.columnIsolated(index);
    const char = grid.get(id);
    for (const v of compiled.variants) {
      if (!banPolicy({ cellId: id, char, iy, exposure, columnHeight, columnIsolated, variant: v })) {
        bans.push({ cell: index, variant: v.index, reason: "policy" });
      }
    }
  }
  const r = solveWfc({ graph, compiled, table, seed, pins, bans, maxBacktrack });
  const byCell = {};
  if (r.ok) {
    for (const [id, key] of Object.entries(r.assignmentByCellId)) {
      const vi = compiled.variantIndex.get(key);
      const v = compiled.variants[vi];
      byCell[id] = {
        family: protoFamilyOf(v.protoId, prototypes),
        variant: v.builderKey,
        rot: v.transformName,
        key,
      };
    }
  }
  return {
    ok: r.ok === true,
    byCell,
    hash: r.solutionHash ?? null,
    stats: r.stats,
    failure: r.ok ? null : r,
    unresolved: r.ok
      ? []
      : [typeof r.cell === "number" ? graph.cellId(r.cell) : r.cell].filter((x) => x != null && x !== ""),
    graph,
    compiled,
    table,
  };
}
