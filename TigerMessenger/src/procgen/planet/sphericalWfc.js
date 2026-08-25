// =====================================================================
// Spherical WFC compiler.  The graph supplies arbitrary edge tokens; the
// compatibility table is expanded for those tokens instead of assuming
// N/E/S/W.  Hard landmark pins are applied before solving.
// =====================================================================

import { BitSet } from "../core/bitSet.js";
import { solveWfc } from "../wfc/solver.js";
import { createTerrainTiles } from "./terrainTiles.js";
import { forceModulePatch } from "./forceModulePatch.js";

function canTouch(a, b) {
  // Hard profile pins are validated separately against the global field.  A
  // coarse icosphere can put two legitimate landmarks on adjacent cells, so
  // the tile table keeps a broad transition envelope rather than making the
  // whole solve unsatisfiable on subdivision=1.
  const shorelineTransition = a.id === "ocean.shelf" || b.id === "ocean.shelf" || a.family === "coast" || b.family === "coast";
  const authoredChainTransition = ["peak", "rift", "volcanic", "lake", "plain"].includes(a.family) || ["peak", "rift", "volcanic", "lake", "plain"].includes(b.family);
  if (Math.abs(a.elevation - b.elevation) > 5.4 && !shorelineTransition && !authoredChainTransition && a.family !== "canyon" && b.family !== "canyon") return false;
  if (a.family === "settlement" && b.family === "ocean" && b.id === "ocean.deep") return false;
  const aTags = new Set(a.transitionTags || []); const bTags = new Set(b.transitionTags || []);
  const incompatible = (aTags.has("deep-water") && b.family === "peak") || (bTags.has("deep-water") && a.family === "peak");
  if (incompatible) return false;
  return true;
}

export function compileSphericalTerrainTable(graph, tiles) {
  const variants = tiles.map((tile) => ({
    key: tile.key,
    protoId: tile.id,
    weight: tile.weight,
    tile,
  }));
  const variantIndex = new Map(variants.map((variant, index) => [variant.key, index]));
  const directions = new Set();
  for (let i = 0; i < graph.cellCount; i++) for (const edge of graph.neighborsOf(i)) directions.add(edge.direction);
  const compatible = {};
  for (const direction of [...directions].sort()) {
    compatible[direction] = variants.map(() => new BitSet(variants.length, false));
    for (let a = 0; a < variants.length; a++) for (let b = 0; b < variants.length; b++) {
      if (canTouch(variants[a].tile, variants[b].tile)) compatible[direction][a].set(b);
    }
  }
  return { variants, variantIndex, compatible, directions: [...directions].sort() };
}

function pinForProfile(landmark, graph, tiles, usedCells) {
  if (!landmark?.profile) return [];
  const desired = {
    "highland-citadel": ["mountain", "ridge", "saddle"],
    "crystal-canyon": ["canyon.wall", "canyon.floor"],
    "saihoji-hills": ["hill.rolling", "forest.edge", "wetland"],
    "swamp-lake": ["lake.basin", "wetland"],
    "bookshop-hill-chain": ["hill.low", "hill.rolling", "road.pass"],
    "triple-gate-highland": ["saddle", "ridge", "mountain"],
    "coastal-harbor-citadel": ["coast.convex", "ocean.shelf", "settlement.pad"],
    "highland-snow-massif": ["peak.glacier", "peak.snowline", "mountain"],
    "crystal-rift-canyon": ["rift.escarpment", "rift.floor", "rift.fault-step"],
    "saihoji-plain": ["plain.alluvial", "plain.moss", "plain.stream"],
    "swamp-rift-lake": ["lake.rift", "lake.reed-shore", "wetland"],
    "bookshop-auckland-hills": ["volcanic.cone", "volcanic.tuff", "hill.low"],
    "triple-gate-rift-shoulder": ["rift.fault-step", "saddle", "ridge"],
  }[landmark.profile] || ["plain.grass"];
  const landformDesired = {
    "volcanic-snow-massif": ["peak.glacier", "peak.snowline", "mountain"],
    "rift-shoulder-pass": ["rift.fault-step", "saddle", "ridge"],
    "rift-escarpment": ["rift.escarpment", "rift.floor", "rift.fault-step"],
    "rift-long-lake": ["lake.rift", "lake.reed-shore", "wetland"],
    "auckland-volcanic-hills": ["volcanic.cone", "volcanic.tuff", "hill.low"],
    "japanese-alluvial-plain": ["plain.alluvial", "plain.moss", "plain.stream"],
  }[landmark.landformClass];
  const desiredIds = landformDesired || desired;
  const wanted = desiredIds.map((id) => tiles.findIndex((tile) => tile.id === id)).filter((index) => index >= 0);
  if (!wanted.length) return [];
  const candidates = [];
  for (const cell of graph.cells()) {
    const d = graph.directionOf(cell.index);
    const score = d[0] * landmark.direction[0] + d[1] * landmark.direction[1] + d[2] * landmark.direction[2];
    candidates.push({ index: cell.index, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  const pins = [];
  const targetCount = landmark.profile === "highland-citadel" || landmark.profile === "crystal-canyon" ? 3 : 2;
  for (const candidate of candidates) {
    if (pins.length >= targetCount) break;
    if (usedCells.has(candidate.index)) continue;
    usedCells.add(candidate.index);
    pins.push({ cell: graph.cellId(candidate.index), variant: tiles[wanted[pins.length % wanted.length]].key, source: `landmark:${landmark.id}` });
  }
  return pins;
}

export function solveSphericalTerrain({ graph, landmarks = [], tiles = createTerrainTiles(), seed = 1, maxBacktrack = 64 } = {}) {
  const compiled = compileSphericalTerrainTable(graph, tiles);
  const usedCells = new Set();
  const patch = forceModulePatch({ graph, manifest: landmarks, tiles });
  const patchPins = patch.pins.map((pin) => ({ cell: pin.cell, variant: pin.variant, source: pin.source }));
  for (const index of patch.usedCells) usedCells.add(index);
  const pins = [...patchPins, ...landmarks.flatMap((landmark) => pinForProfile(landmark, graph, tiles, usedCells))];
  const table = { compatible: compiled.compatible };
  const result = solveWfc({
    graph,
    compiled,
    table,
    seed,
    pins,
    maxBacktrack,
    mode: "bitset",
  });
  if (result.ok) {
    repairDisconnectedDeepOcean({ result, graph, compiled, pins });
    enforceOceanCoverage({ result, graph, compiled, pins, landmarks });
  }
  return { ...result, conflict: result.ok ? null : {
    cell: result.cellId || result.cell || null,
    reason: result.reason,
    landmarkPins: pins,
    emptyCells: result.emptyCells || [],
    suggestions: result.suggestions || ["relax the smallest local patch", "inspect socket compatibility", "move the conflicting landmark pin"],
  }, compiled, pins };
}

function repairDisconnectedDeepOcean({ result, graph, compiled, pins }) {
  const pinnedCells = new Set(pins.map((pin) => pin.cell));
  const deep = new Set(Object.entries(result.assignmentByCellId).filter(([, key]) => String(key).startsWith("ocean.deep")).map(([id]) => id));
  if (!deep.size) return;
  const components = [];
  const remaining = new Set(deep);
  while (remaining.size) {
    const component = []; const stack = [remaining.values().next().value];
    while (stack.length) {
      const id = stack.pop(); if (!remaining.delete(id)) continue; component.push(id);
      const cell = graph.cells().find((entry) => entry.id === id);
      for (const edge of cell ? graph.neighborsOf(cell.index) : []) { const next = graph.cellId(edge.to); if (deep.has(next) && remaining.has(next)) stack.push(next); }
    }
    components.push(component);
  }
  if (components.length <= 1) return;
  components.sort((a, b) => b.length - a.length);
  const shelf = compiled.variants.find((variant) => variant.protoId === "ocean.shelf" && variant.tile.orientation === "base") || compiled.variants.find((variant) => variant.protoId === "ocean.shelf");
  if (!shelf) return;
  let repairCount = 0;
  for (const component of components.slice(1)) for (const cellId of component) {
    if (pinnedCells.has(cellId)) continue;
    result.assignmentByCellId[cellId] = shelf.key;
    repairCount++;
  }
  result.report = { ...(result.report || {}), repairCount, oceanComponentsBeforeRepair: components.length, repair: "deep-ocean-islands-to-shelf" };
}

// The planet is an ocean world, not a green sphere with a decorative water
// shell.  WFC still decides local continuity; this bounded post-pass only
// changes unpinned peripheral land cells to shelf/deep ocean until the global
// coverage contract is met.  Landmark pins and the cells selected for a
// landmark profile are never rewritten.
function enforceOceanCoverage({ result, graph, compiled, pins, landmarks = [], minimumOceanFraction = graph.cellCount < 40 ? 0.25 : 0.52 }) {
  const variantsByKey = new Map(compiled.variants.map((variant) => [variant.key, variant]));
  const shelf = compiled.variants.find((variant) => variant.protoId === "ocean.shelf" && variant.tile.orientation === "base") || compiled.variants.find((variant) => variant.protoId === "ocean.shelf");
  const deep = compiled.variants.find((variant) => variant.protoId === "ocean.deep" && variant.tile.orientation === "base") || compiled.variants.find((variant) => variant.protoId === "ocean.deep");
  if (!shelf || !deep) return;
  const pinned = new Set(pins.map((pin) => pin.cell));
  const required = new Set(landmarks
    .filter((landmark) => ["highland-citadel", "crystal-canyon", "saihoji-moss-garden", "bookshop-town", "triple-gate"].includes(landmark.id))
    .flatMap((landmark) => pins.filter((pin) => pin.source === `landmark:${landmark.id}`).map((pin) => pin.cell)));
  for (const cell of required) pinned.add(cell);
  const cells = graph.cells();
  const isLand = (id) => (variantsByKey.get(result.assignmentByCellId[id])?.tile?.land ?? 0) > 0.5;
  const landCount = () => cells.reduce((sum, cell) => sum + (isLand(cell.id) ? 1 : 0), 0);
  const targetLand = Math.floor(cells.length * (1 - minimumOceanFraction));
  const candidates = cells.filter((cell) => isLand(cell.id) && !pinned.has(cell.id)).map((cell) => {
    const landNeighbors = graph.neighborsOf(cell.index).filter((edge) => isLand(graph.cellId(edge.to))).length;
    const landmarkDistance = Math.min(...[...required].map((id) => {
      const target = cells.find((entry) => entry.id === id);
      return target ? Math.abs(target.index - cell.index) : 9999;
    }), 9999);
    return { cell, landNeighbors, landmarkDistance };
  }).sort((a, b) => a.landNeighbors - b.landNeighbors || b.landmarkDistance - a.landmarkDistance || a.cell.index - b.cell.index);
  let converted = 0;
  while (landCount() > targetLand && candidates.length) {
    const { cell } = candidates.shift();
    if (!isLand(cell.id)) continue;
    // Newly exposed cells are shelf.  Deep-ocean connectivity was repaired
    // before this pass; introducing isolated deep pockets here would undo it.
    result.assignmentByCellId[cell.id] = shelf.key;
    converted++;
  }
  result.report = { ...(result.report || {}), oceanCoverage: { minimumOceanFraction, converted, landFraction: landCount() / Math.max(1, cells.length) } };
}

export function terrainAssignmentMap(result) {
  if (!result?.ok) return null;
  const tileByKey = new Map(result.compiled.variants.map((variant) => [variant.key, variant.tile]));
  return Object.fromEntries(Object.entries(result.assignmentByCellId).map(([cell, key]) => [cell, tileByKey.get(key)]));
}
