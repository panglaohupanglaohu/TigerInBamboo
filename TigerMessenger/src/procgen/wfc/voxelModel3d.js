// =====================================================================
// Voxel Module Model — WFC 三维六向模型（V7-G5）
// 只负责把模块集和 VoxelGrid3D 接到通用 solver。
// 结构规则两道闸：
//   1. 预约束（求解前）：模型构建期把 requiresBelow/requiresSupport/
//      portalAbove/portalBelow 收紧进兼容表；求解期把楼层谓词
//      （minFloor/maxFloor）和底层无支撑 variant 作为 level-0 ban 剔除，
//      回溯永不撤销。
//   2. 解后校验（保留）：validateVoxelAssignment 的支撑/净空检查 +
//      validateFloorPortals / validateDoorways / validateRoofOrientation
//      语义校验，防止"socket 合法但结构悬空/门洞被堵"的假解进入渲染层。
// =====================================================================

import { compileVariants } from "./socketCompiler.js";
import { compileCompatibilityTable } from "./compatibilityTable.js";
import { solveWfc } from "./solver.js";
import { BitSet } from "../core/bitSet.js";
import { OPP3 } from "../graph/voxelGrid3d.js";

export function createVoxelModuleModel({ prototypes, graph, compatibilityOptions, requireAllFaces = false } = {}) {
  if (!Array.isArray(prototypes) || prototypes.length === 0) throw new Error("VoxelModuleModel requires prototypes");
  if (!graph || graph.kind !== "voxel-grid-3d") throw new Error("VoxelModuleModel requires a voxel-grid-3d graph");
  const missing = [];
  for (const p of prototypes) {
    for (const face of requireAllFaces ? ["N", "E", "S", "W", "U", "D"] : ["U", "D"]) {
      if (!p.faces?.[face]) missing.push(`${p.id}.${face}`);
    }
  }
  if (missing.length) throw new Error(`voxel modules missing faces: ${missing.join(",")}`);
  const compiled = compileVariants(prototypes);
  const table = compileCompatibilityTable(compiled, compatibilityOptions);
  applyStructuralRules(compiled, table);
  return Object.freeze({ kind: "voxel-module-3d", graph, compiled, table });
}

/**
 * 预约束（模型构建期）：把结构规则收紧进兼容表。
 *  · rules.requiresBelow = "bearing>=N"：D 行只保留 U 面 support ≥ N 的 variant；
 *    其他字符串：D 行只保留 protoId/key 精确匹配的 variant（与解后校验同语义）。
 *  · rules.requiresSupport === true：D 行只保留 U 面 support > 0 的 variant。
 *  · rules.portalAbove = [portal…]：U 行只保留 D 面 portal ∈ 集合的 variant。
 *  · rules.portalBelow = [portal…]：D 行只保留 U 面 portal ∈ 集合的 variant。
 */
function applyStructuralRules(compiled, table) {
  const variants = compiled.variants;
  const n = variants.length;
  const maskOf = (pred) => {
    const mask = new BitSet(n, false);
    for (let i = 0; i < n; i++) if (pred(variants[i])) mask.set(i);
    return mask;
  };
  for (const v of variants) {
    const rules = v.rules || {};
    if (rules.requiresBelow) {
      const req = parseRequiresBelow(rules.requiresBelow);
      const mask =
        req.kind === "bearing"
          ? maskOf((u) => (u.faces?.U?.support ?? 0) >= req.min)
          : maskOf((u) => u.protoId === req.id || u.key === req.id);
      table.compatible["D"][v.index].andInto(mask);
    }
    if (rules.requiresSupport === true) {
      table.compatible["D"][v.index].andInto(maskOf((u) => (u.faces?.U?.support ?? 0) > 0));
    }
    if (Array.isArray(rules.portalAbove)) {
      const allowed = rules.portalAbove;
      table.compatible["U"][v.index].andInto(maskOf((u) => allowed.includes(u.faces?.D?.portal)));
    }
    if (Array.isArray(rules.portalBelow)) {
      const allowed = rules.portalBelow;
      table.compatible["D"][v.index].andInto(maskOf((u) => allowed.includes(u.faces?.U?.portal)));
    }
  }
}

/** requiresBelow 解析："bearing>=N" 谓词形式；否则 protoId/key 精确匹配。 */
function parseRequiresBelow(rule) {
  const m = /^bearing>=(\d+(?:\.\d+)?)$/.exec(rule);
  if (m) return { kind: "bearing", min: Number(m[1]) };
  return { kind: "id", id: rule };
}

/**
 * 预约束（求解期 level-0 ban，回溯不撤销）：
 *  · 楼层谓词：rules.minFloor/maxFloor（0 起 y 层）外的 cell 禁选该 variant；
 *  · 支撑：无 D 邻居（地面层）禁选 requiresBelow/requiresSupport/portalBelow variant；
 *  · portal：无 U 邻居（顶层）禁选 portalAbove variant。
 */
export function structuralBans(model) {
  if (!model || model.kind !== "voxel-module-3d") throw new Error("structuralBans requires a voxel module model");
  const { graph, compiled } = model;
  const bans = [];
  const layerSize = graph.width * graph.depth;
  for (const cell of graph.cells()) {
    const y = Math.floor(cell.index / layerSize);
    const dirs = new Set(graph.neighborsOf(cell.index).map((e) => e.direction));
    for (const v of compiled.variants) {
      const rules = v.rules || {};
      if ((rules.minFloor !== undefined && y < rules.minFloor) ||
          (rules.maxFloor !== undefined && y > rules.maxFloor)) {
        bans.push({ cell: cell.id, variant: v.index, reason: `pre-ban:floor-range:${y}` });
        continue;
      }
      if (!dirs.has("D") && (rules.requiresBelow || rules.requiresSupport === true || rules.portalBelow)) {
        bans.push({ cell: cell.id, variant: v.index, reason: "pre-ban:missing-support" });
        continue;
      }
      if (!dirs.has("U") && rules.portalAbove) {
        bans.push({ cell: cell.id, variant: v.index, reason: "pre-ban:missing-portal" });
      }
    }
  }
  return bans;
}

export function solveVoxelModel({ model, seed, pins = [], bans = [], structuralPreConstraints = true, ...options } = {}) {
  if (!model || model.kind !== "voxel-module-3d") throw new Error("solveVoxelModel requires a voxel module model");
  const preBans = structuralPreConstraints ? structuralBans(model) : [];
  return solveWfc({
    graph: model.graph,
    compiled: model.compiled,
    table: model.table,
    seed,
    pins,
    bans: [...bans, ...preBans],
    ...options,
  });
}

/**
 * 解后支撑/净空校验。所有规则都是显式的：没有 requiresBelow 的模块不会被
 * 推断为“必须有地基”，避免把桥、悬挑和水面模块误判成错误。
 */
export function validateVoxelAssignment(model, result, { clearanceAt, minClearance = 0 } = {}) {
  const issues = [];
  if (!result?.ok) return { ok: false, issues: [{ code: "no-solution" }] };
  const graph = model.graph;
  const variantAt = (index) => model.compiled.variants[result.assignment[index]];
  const neighbor = (index, direction) => graph.neighborsOf(index).find((e) => e.direction === direction);
  for (const cell of graph.cells()) {
    const variant = variantAt(cell.index);
    const below = neighbor(cell.index, "D");
    const rule = variant.rules || {};
    if (rule.requiresBelow) {
      if (!below) {
        issues.push({ code: "missing-support", cell: cell.id, variant: variant.key, reason: "no-D-neighbor" });
      } else {
        const belowVariant = variantAt(below.to);
        const req = parseRequiresBelow(rule.requiresBelow);
        const okBelow =
          req.kind === "bearing"
            ? (belowVariant.faces?.U?.support ?? 0) >= req.min
            : belowVariant.protoId === req.id || belowVariant.key === req.id;
        if (!okBelow) {
          issues.push({ code: "wrong-support", cell: cell.id, variant: variant.key, expected: rule.requiresBelow, actual: belowVariant.protoId });
        }
      }
    }
    if (rule.requiresSupport === true && (!below || (variantAt(below.to).faces?.U?.support ?? 0) <= 0)) {
      issues.push({ code: "insufficient-load-support", cell: cell.id, variant: variant.key });
    }
    for (const direction of Object.keys(variant.faces || {})) {
      const required = variant.faces[direction].clearance ?? 0;
      if (required <= 0 || typeof clearanceAt !== "function") continue;
      const actual = clearanceAt(cell.index, direction, variant);
      if (!Number.isFinite(actual) || actual < Math.max(required, minClearance)) {
        issues.push({ code: "clearance", cell: cell.id, direction, required: Math.max(required, minClearance), actual });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

/**
 * 楼梯 portal 对接校验（V7-G5）：声明 rules.portalAbove/portalBelow 的
 * variant（楼梯体积）上/下端必须接合法 floor portal。
 *   portalAbove：U 邻居的 D 面 portal ∈ 允许集；
 *   portalBelow：D 邻居的 U 面 portal ∈ 允许集。
 */
export function validateFloorPortals(model, result) {
  const issues = [];
  if (!result?.ok) return { ok: false, issues: [{ code: "no-solution" }] };
  const graph = model.graph;
  const variantAt = (index) => model.compiled.variants[result.assignment[index]];
  const neighbor = (index, direction) => graph.neighborsOf(index).find((e) => e.direction === direction);
  for (const cell of graph.cells()) {
    const variant = variantAt(cell.index);
    const rules = variant.rules || {};
    for (const [ruleKey, direction, oppositeFace] of [
      ["portalAbove", "U", "D"],
      ["portalBelow", "D", "U"],
    ]) {
      const allowed = rules[ruleKey];
      if (!Array.isArray(allowed)) continue;
      const next = neighbor(cell.index, direction);
      if (!next) {
        issues.push({ code: "missing-floor-portal", cell: cell.id, variant: variant.key, direction });
        continue;
      }
      const portal = variantAt(next.to).faces?.[oppositeFace]?.portal ?? null;
      if (!allowed.includes(portal)) {
        issues.push({
          code: "wrong-floor-portal",
          cell: cell.id,
          variant: variant.key,
          direction,
          expected: allowed,
          actual: portal,
        });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

/**
 * 门洞校验（V7-G5）：任何 face.portal === "doorway" 的面必须通向可走邻居
 * （对面 walkable 或同为 doorway），封死即报 door-blocked。
 */
export function validateDoorways(model, result) {
  const issues = [];
  if (!result?.ok) return { ok: false, issues: [{ code: "no-solution" }] };
  const graph = model.graph;
  const variantAt = (index) => model.compiled.variants[result.assignment[index]];
  for (const cell of graph.cells()) {
    const variant = variantAt(cell.index);
    for (const [direction, face] of Object.entries(variant.faces || {})) {
      if (face.portal !== "doorway") continue;
      const next = graph.neighborsOf(cell.index).find((e) => e.direction === direction);
      const oppFace = next ? variantAt(next.to).faces?.[OPP3[direction]] : null;
      const open = !!oppFace && (oppFace.walkable === true || oppFace.portal === "doorway");
      if (!open) {
        issues.push({ code: "door-blocked", cell: cell.id, variant: variant.key, direction });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

/**
 * 屋顶朝向校验（V7-G5）：rules.roof === true 的 variant 必须 U 面朝天空
 * （faces.U.connector === "sky"）且 D 面承重；倒置（U 面非 sky 或 D 面
 * 朝 sky）报 inverted-roof。
 */
export function validateRoofOrientation(model, result) {
  const issues = [];
  if (!result?.ok) return { ok: false, issues: [{ code: "no-solution" }] };
  for (const cell of model.graph.cells()) {
    const variant = model.compiled.variants[result.assignment[cell.index]];
    if (variant.rules?.roof !== true) continue;
    const up = variant.faces?.U?.connector ?? null;
    const down = variant.faces?.D?.connector ?? null;
    if (up !== "sky" || down === "sky") {
      issues.push({ code: "inverted-roof", cell: cell.id, variant: variant.key, up, down });
    }
  }
  return { ok: issues.length === 0, issues };
}

/** 返回没有邻居的外边方向，供 profile 生成 boundary pin/墙面。 */
export function boundaryFaces(graph, cellIndex) {
  const present = new Set(graph.neighborsOf(cellIndex).map((e) => e.direction));
  return ["N", "E", "S", "W", "U", "D"].filter((direction) => !present.has(direction));
}
