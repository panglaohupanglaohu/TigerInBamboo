// =====================================================================
// WFC → ScalarField → Marching Cubes bridge（V7-G9）
// WFC 只决定离散模块；场桥把 occupied/tag 投影到带 padding 的体素标量场，
// 由 MC 生成地形/岩壁表面。建筑模块本身仍由 builder 渲染，不被 MC 抹平。
// =====================================================================

import { createScalarField } from "../field/scalarField.js";
import { marchingCubes } from "../field/marchingCubes.js";

export function occupancyToScalarField({ graph, assignment, compiled, cellSize = 1, padding = 1, occupied = () => true, semanticOf } = {}) {
  if (!graph?.kind?.startsWith("voxel-grid-3d")) throw new Error("occupancyToScalarField requires voxel grid");
  const size = [graph.width, graph.height, graph.depth];
  const resolution = size.map((n) => n + padding * 2 + 1);
  const min = [-padding * cellSize, -padding * cellSize, -padding * cellSize];
  const max = [
    (size[0] + padding) * cellSize,
    (size[1] + padding) * cellSize,
    (size[2] + padding) * cellSize,
  ];
  const selectedVariant = (index) => compiled?.variants?.[assignment?.[index]];
  const occupiedCell = (x, y, z) => {
    if (x < 0 || y < 0 || z < 0 || x >= graph.width || y >= graph.height || z >= graph.depth) return false;
    const index = (y * graph.depth + z) * graph.width + x;
    return occupied({ x, y, z, index, variant: selectedVariant(index) });
  };
  const semanticAt = (x, y, z) => {
    if (!semanticOf) return 0;
    if (x < 0 || y < 0 || z < 0 || x >= graph.width || y >= graph.height || z >= graph.depth) return 0;
    const index = (y * graph.depth + z) * graph.width + x;
    return semanticOf({ x, y, z, index, variant: selectedVariant(index) }) ?? 0;
  };
  const field = createScalarField({
    min, max,
    resolution: { x: resolution[0], y: resolution[1], z: resolution[2] },
    sample: (position, gx, gy, gz) => {
      const cell = [Math.floor(position[0] / cellSize), Math.floor(position[1] / cellSize), Math.floor(position[2] / cellSize)];
      return occupiedCell(cell[0], cell[1], cell[2]) ? -1 : 1;
    },
  });
  if (semanticOf) {
    field.semantics = new Uint8Array(field.count);
    for (let z = 0; z < field.resolution.z; z++) for (let y = 0; y < field.resolution.y; y++) for (let x = 0; x < field.resolution.x; x++) {
      const p = field.worldPosition(x, y, z);
      const cell = [Math.floor(p[0] / cellSize), Math.floor(p[1] / cellSize), Math.floor(p[2] / cellSize)];
      field.semantics[field.index(x, y, z)] = Math.max(0, Math.min(255, Number(semanticAt(cell[0], cell[1], cell[2])) || 0));
    }
  }
  return field;
}

export function compileWfcSurface({ graph, result, compiled, isoLevel = 0, occupied, semanticOf, cellSize = 1, padding = 1 } = {}) {
  if (!result?.ok) return { ok: false, reason: result?.reason || "no-solution", solutionHash: result?.solutionHash ?? null };
  const field = occupancyToScalarField({ graph, assignment: result.assignment, compiled, occupied, semanticOf, cellSize, padding });
  const mesh = marchingCubes(field, { isoLevel });
  return { ok: true, solutionHash: result.solutionHash, field, mesh, stats: { ...mesh.stats, solutionHash: result.solutionHash } };
}
