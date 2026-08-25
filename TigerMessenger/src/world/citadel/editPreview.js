// =====================================================================
//  编辑预览：dirty / domain 变化 / 冲突。不写 snapshot（V6-G6）
//  纯数据，禁止 import Three.js。
// =====================================================================

import { extractTownCells } from "./moduleResolver.js";
import {
  appearanceHash,
  buildNeighborMap,
  expandByTopology,
  parseTownCellId,
  solveDirtyRegion,
} from "./constraintSolver.js";
import { diffBlueprintCells } from "./incrementalBuilder.js";
import { validateAndNormalize } from "./blueprintStore.js";
import { hashHex } from "../../core/rng.js";

function cellIds(cells) {
  return cells.map((c) => c.id);
}

export function occupancyHash(cells) {
  return hashHex(
    cells
      .map((c) => {
        const o = c.occupancy || {};
        return `${c.id}:${c.char || ""}:${o.N}|${o.E}|${o.S}|${o.W}|${o.U}|${o.D}`;
      })
      .sort()
      .join(";")
  );
}

export function screenshotHash({ occupancy, modules, props }) {
  return hashHex(`${occupancy}|${modules}|${props || ""}`);
}

export function domainKeyList(domain) {
  return (domain || []).map((e) => e.key).sort();
}

export function previewEdit(blueprint, command, catalog, seed, previous = null) {
  const t0 = nowMs();
  const tx = validateAndNormalize(command, blueprint);
  if (!tx.ok) return { ok: false, errors: tx.errors, ms: nowMs() - t0, committed: false };
  const beforeCells = extractTownCells(blueprint, catalog);
  const afterCells = extractTownCells(tx.next, catalog);
  const beforeById = new Map(beforeCells.map((c) => [c.id, c]));
  // 被保护路线：带 lockModuleId 的格（城门/必经路线）禁止改写或拆除，
  // 直接返回冲突（含被保护路线清单与建议），不进入求解、不提交半成品 snapshot。
  if (command.type === "set-cell") {
    const targetId = `cell:${command.terrace}:${command.ix}:${command.iy}:${command.iz}`;
    const before = beforeById.get(targetId);
    const nextChar = String(command.char ?? ".");
    if (before?.lockModuleId && nextChar !== before.char) {
      const lockedRoutes = beforeCells.filter((c) => c.lockModuleId).map((c) => c.id).sort();
      return {
        ok: false,
        committed: false,
        dirtyIds: [],
        domainChanges: [],
        conflict: {
          kind: "locked-route",
          cellId: targetId,
          emptyCells: [],
          lockedRoutes,
          suggestions: [
            `${targetId} 属于被保护路线（${before.lockModuleId}），不可直接改写/拆除`,
            "如需调整城门/必经路线，请先在蓝图中迁移路线锚点",
          ],
        },
        ms: nowMs() - t0,
      };
    }
  }
  const changed = diffBlueprintCells(cellIds(beforeCells), cellIds(afterCells)).map((id) =>
    id.startsWith("cell:") ? id : `cell:${id}`
  );
  if (!changed.length) {
    const loc = command.type === "set-cell" ? `cell:${command.terrace}:${command.ix}:${command.iy}:${command.iz}` : null;
    if (loc) changed.push(loc);
  }
  const dirtyIds = expandByTopology(changed, 2).filter((id) => afterCells.some((c) => c.id === id) || beforeCells.some((c) => c.id === id));
  const afterById = new Map(afterCells.map((c) => [c.id, c]));
  const occSig = (c) => {
    if (!c) return "";
    const o = c.occupancy || {};
    return `${c.char || ""}:${o.N}${o.E}${o.S}${o.W}${o.U}${o.D}:${c.familyHint || ""}`;
  };
  const domainChanges = [];
  for (const id of dirtyIds) {
    const a = afterById.get(id);
    const b = beforeById.get(id);
    if (occSig(a) === occSig(b)) continue;
    domainChanges.push({
      cellId: id,
      before: b ? [occSig(b)] : [],
      after: a ? [occSig(a)] : [],
      propagate: neighborsOf(id, afterCells).filter((n) => dirtyIds.includes(n)),
    });
  }
  const world = {
    cells: afterCells,
    catalog,
    requiredRoutes: afterCells.filter((c) => c.routeClearance).map((c) => c.id),
    neighbors: buildNeighborMap(afterCells),
  };
  const solved = solveDirtyRegion(world, changed, seed, { previous, ring: 2, fast: true, maxBacktrack: 32 });
  const skip = new Set(solved.region || dirtyIds);
  const outsideBefore = appearanceHash(previous?.cells || beforeCells.map((c) => ({ cellId: c.id, module: c.module, rot: "r0" })), skip);
  const outsideAfter = appearanceHash(solved.cells, skip);
  const ms = nowMs() - t0;
  if (!solved.ok) {
    return {
      ok: false,
      committed: false,
      dirtyIds: dirtyIds.sort(),
      domainChanges,
      conflict: {
        emptyCells: solved.emptyCells || [],
        lockedRoutes: solved.lockedRoutes || world.requiredRoutes,
        suggestions: solved.suggestions || [],
        cellId: solved.conflict?.cellId,
      },
      ms,
      nextBlueprint: tx.next,
    };
  }
  return {
    ok: true,
    committed: false,
    dirtyIds: dirtyIds.sort(),
    domainChanges,
    propagate: (solved.log || []).filter((e) => e.type === "propagate").slice(0, 80),
    solved,
    outsideHash: outsideAfter,
    outsideUnchanged: !previous || outsideBefore === outsideAfter || skip.size >= afterCells.length,
    occupancy: occupancyHash(afterCells),
    modules: appearanceHash(solved.cells),
    ms,
    nextBlueprint: tx.next,
    patched: tx.patched,
  };
}

function neighborsOf(id, cells) {
  const p = parseTownCellId(id);
  if (!p) return [];
  const set = new Set(cells.map((c) => c.id));
  const out = [];
  for (const [dx, dy, dz] of [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]) {
    const nid = `cell:${p.t}:${p.ix + dx}:${p.iy + dy}:${p.iz + dz}`;
    if (set.has(nid)) out.push(nid);
  }
  return out;
}

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}
