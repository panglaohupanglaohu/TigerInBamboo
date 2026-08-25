// =====================================================================
// Surface pipeline facade（V7-G9）
// 保持 WFC、场和 MC 三个阶段可单独重放；失败阶段不产生半成品 mesh。
// =====================================================================

import { solveWfc } from "../wfc/solver.js";
import { compileWfcSurface } from "./wfcFieldBridge.js";

export function runProcgenSurface({ graph, compiled, table, seed, pins = [], wfc = {}, surface = {} } = {}) {
  const solution = solveWfc({ graph, compiled, table, seed, pins, ...wfc });
  if (!solution.ok) return { ok: false, phase: "wfc", solution };
  const result = compileWfcSurface({ graph, result: solution, compiled, ...surface });
  if (!result.ok) return { ok: false, phase: "surface", solution, result };
  return { ok: true, phase: "complete", solution, ...result };
}
