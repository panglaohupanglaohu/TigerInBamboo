// =====================================================================
//  Town WFC selection — 把 citadel 格图喂给 V7 solveWfc，
//  输出与 townscaperModuleSelection 同形的按格选型表。
//  失败不回退哈希路径（S20④ 静默失败：只标格）。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { compileVariants } from "../../procgen/wfc/socketCompiler.js";
import { compileCompatibilityTable, compileSidePairCompatibilityTable } from "../../procgen/wfc/compatibilityTable.js";
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

const compiledMemo = new WeakMap();
function compileTown(prototypes) {
  let hit = compiledMemo.get(prototypes);
  if (hit) return hit;
  const compiled = compileVariants(prototypes);
  const table = compileCompatibilityTable(compiled, { onDeadVariant: "throw" });
  hit = { compiled, table };
  compiledMemo.set(prototypes, hit);
  return hit;
}

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
// When both inputs are present they must describe the same occupied cells.
// Face-native callers may omit grid; legacy geometry callers may not silently
// solve stale face occupancy while building a different ASCII layout.
export function assertTownGraphMatchesGrid(graph, grid) {
  if (!graph || grid == null) return;
  if (!(grid instanceof Map) || graph.cellCount !== grid.size) throw new Error("Town graph/grid occupancy mismatch");
  for (const {id,index} of graph.cells()) {
    if (!grid.has(id) || graph.charOf(index) !== grid.get(id)) throw new Error(`Town graph/grid cell mismatch: ${id}`);
    const legacyCoordinates = /^-?\d+,-?\d+,-?\d+$/.test(id) ? id.split(",").map(Number) : null;
    if (legacyCoordinates && graph.levelOf(index) !== legacyCoordinates[1]) throw new Error(`Town graph/grid level mismatch: ${id}`);
  }
}

export function solveTownSelection({
  grid,
  graph: suppliedGraph = null,
  prototypes = TOWN_MODULE_PROTOTYPES,
  seed,
  pins = [],
  banPolicy = defaultBanPolicy,
  maxBacktrack = 64,
} = {}) {
  const graph = suppliedGraph ?? createCitadelCellGraph(grid);
  if (suppliedGraph) {
    for (const method of ["levelOf", "charOf", "exposure", "columnHeight", "columnIsolated", "validate"]) {
      if (typeof graph[method] !== "function") throw new Error(`Town graph missing ${method}`);
    }
    const validation = graph.validate();
    if (!validation.ok) throw new Error(`Invalid Town graph: ${validation.errors.join(", ")}`);
    assertTownGraphMatchesGrid(graph, grid);
  }
  const base = compileTown(prototypes);
  const compiled = base.compiled;
  const table = graph.sidePairs ? compileSidePairCompatibilityTable(compiled, graph.sidePairs) : base.table;
  const bans = [];
  for (const { id, index } of graph.cells()) {
    const exposure = graph.exposure(index);
    const iy = graph.levelOf ? graph.levelOf(index) : Number(id.split(",")[1]);
    const columnHeight = graph.columnHeight(index);
    const columnIsolated = graph.columnIsolated(index);
    const char = graph.charOf(index);
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
    topologyHash: graph.topologyHash ?? null,
    roleAtFace(faceId, level) {
      const index = graph.indexOfFaceLevel?.(faceId, level) ?? -1;
      return index < 0 ? null : byCell[graph.cellId(index)]?.variant ?? null;
    },
    graph,
    compiled,
    table,
  };
}
