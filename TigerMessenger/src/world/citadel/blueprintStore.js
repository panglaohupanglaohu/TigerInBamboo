// =====================================================================
//  Blueprint 事务存储：undo/redo、schema、重放记录（G9）
// =====================================================================

import {
  createCitadelBlueprint,
  validateCitadelBlueprint,
  migrateCitadelBlueprint,
  citadelBlueprintCanonicalHash,
  citadelBlueprintEntityIds,
} from "../citadelBlueprint.js";

export function createBlueprintStore(initial) {
  let current = initial;
  let version = 1;
  const undo = [];
  const redo = [];
  const replay = [];
  return {
    current: () => current,
    version: () => version,
    hash: () => citadelBlueprintCanonicalHash(current),
    apply(command, opts = {}) {
      const tx = validateAndNormalize(command, current);
      if (!tx.ok) return tx;
      undo.push({ before: current, command: tx.command, inverse: tx.inverse });
      if (!opts.keepRedo) redo.length = 0;
      current = tx.next;
      version += 1;
      replay.push({ version, command: tx.command });
      return { ok: true, version, hash: citadelBlueprintCanonicalHash(current), patched: tx.patched };
    },
    undo() {
      const rec = undo.pop();
      if (!rec) return { ok: false, errors: ["empty-undo"] };
      redo.push(rec);
      current = rec.before;
      version += 1;
      return { ok: true, version, hash: citadelBlueprintCanonicalHash(current) };
    },
    redo() {
      const rec = redo.pop();
      if (!rec) return { ok: false, errors: ["empty-redo"] };
      return this.apply(rec.command, { keepRedo: true });
    },
    replay: () => replay.slice(),
  };
}

export function validateAndNormalize(command, current) {
  if (!command || typeof command !== "object") return { ok: false, errors: ["invalid-command"] };
  const type = command.type;
  if (type === "set-floors") {
    const floors = Math.min(20, Math.max(1, command.floors | 0));
    const next = createCitadelBlueprint({
      spec: current.town.layout,
      contour: current.terrain.config,
      floors,
      instanceId: current.instanceId,
      skipOuterTerrain: current.terrain.skipOuterTerrain,
      townBaseLift: current.presentation.townBaseLift,
      terrainObjects: current.objects,
    });
    const v = validateCitadelBlueprint(next);
    if (!v.ok) return { ok: false, errors: v.errors };
    return {
      ok: true,
      next,
      command: { type, floors },
      inverse: { type: "set-floors", floors: current.floors },
      patched: ["town", "uv", "surface", "nav"],
    };
  }
  if (type === "replace") {
    const next = migrateCitadelBlueprint(command.blueprint || {});
    const v = validateCitadelBlueprint(next);
    if (!v.ok) return { ok: false, errors: v.errors };
    return { ok: true, next, command: { type }, inverse: { type: "replace", blueprint: current }, patched: ["all"] };
  }
  if (type === "set-cell") {
    const patch = patchTownCell(current, command);
    if (!patch.ok) return patch;
    const next = createCitadelBlueprint({
      spec: patch.layout,
      contour: current.terrain.config,
      floors: current.floors,
      instanceId: current.instanceId,
      skipOuterTerrain: current.terrain.skipOuterTerrain,
      townBaseLift: current.presentation.townBaseLift,
      terrainObjects: current.objects,
    });
    const v = validateCitadelBlueprint(next);
    if (!v.ok) return { ok: false, errors: v.errors };
    return {
      ok: true,
      next,
      command: { type: "set-cell", terrace: patch.terrace, ix: patch.ix, iy: patch.iy, iz: patch.iz, char: patch.char },
      inverse: { type: "set-cell", terrace: patch.terrace, ix: patch.ix, iy: patch.iy, iz: patch.iz, char: patch.prevChar },
      patched: ["town", "uv", "surface", "nav"],
    };
  }
  return { ok: false, errors: [`unknown-command:${type}`] };
}

export function readTownChar(blueprint, terrace, ix, iy, iz) {
  const terr = (blueprint.town?.layout?.terraces || []).find((t) => t.terraceIndex === terrace);
  const row = String((terr?.levels?.[iy] || [])[iz] || "");
  return row[ix] && row[ix] !== " " ? row[ix] : ".";
}

export function patchTownCell(blueprint, command) {
  const terrace = command.terrace | 0;
  const ix = command.ix | 0;
  const iy = command.iy | 0;
  const iz = command.iz | 0;
  const char = String(command.char ?? command.color ?? ".")[0] || ".";
  const layout = blueprint.town?.layout;
  if (!layout?.terraces) return { ok: false, errors: ["no-layout"] };
  const gridSize = layout.gridSize || blueprint.grid?.size || 25;
  if (ix < 0 || iz < 0 || ix >= gridSize || iz >= gridSize || iy < 0 || iy >= (blueprint.floors || 5)) {
    return { ok: false, errors: ["out-of-bounds"] };
  }
  const prevChar = readTownChar(blueprint, terrace, ix, iy, iz);
  const floors = blueprint.floors || 5;
  const terraces = layout.terraces.map((t) => {
    const levels = t.levels.map((rows) => rows.map((row) => String(row)));
    while (levels.length < floors) levels.push(Array.from({ length: gridSize }, () => ".".repeat(gridSize)));
    if (t.terraceIndex !== terrace) return { terraceIndex: t.terraceIndex, levels };
    while (levels[iy].length <= iz) levels[iy].push(".".repeat(gridSize));
    let row = String(levels[iy][iz] || "");
    if (row.length < gridSize) row = row.padEnd(gridSize, ".");
    levels[iy][iz] = row.slice(0, ix) + char + row.slice(ix + 1);
    return { terraceIndex: t.terraceIndex, levels };
  });
  return {
    ok: true,
    layout: { version: 2, gridSize, terraces },
    terrace,
    ix,
    iy,
    iz,
    char,
    prevChar,
  };
}
