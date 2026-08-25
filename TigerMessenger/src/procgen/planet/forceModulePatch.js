// Art-directed local pins.  A patch is selected from angular distance first,
// then only its declared semantic variants are pinned; neighbouring cells
// remain available to WFC.  This is the V8 equivalent of a hand-authored
// terrain tile pushed into a procedural map.

const PROFILE_TILE_IDS = Object.freeze({
  "highland-citadel": ["mountain", "ridge", "saddle"],
  "crystal-canyon": ["canyon.wall", "canyon.floor"],
  "saihoji-hills": ["hill.rolling", "forest.edge", "wetland"],
  "swamp-lake": ["lake.basin", "wetland"],
  "bookshop-hill-chain": ["hill.low", "hill.rolling", "road.pass"],
  "triple-gate-highland": ["saddle", "ridge", "mountain"],
  "coastal-harbor-citadel": ["coast.convex", "ocean.shelf", "settlement.pad"],
  "highland-snow-massif": ["peak.glacier", "peak.snowline", "mountain", "ridge"],
  "crystal-rift-canyon": ["rift.escarpment", "rift.floor", "rift.fault-step", "canyon.floor"],
  "saihoji-plain": ["plain.alluvial", "plain.moss", "plain.stream"],
  "swamp-rift-lake": ["lake.rift", "lake.reed-shore", "wetland"],
  "bookshop-auckland-hills": ["volcanic.cone", "volcanic.tuff", "hill.low"],
  "triple-gate-rift-shoulder": ["rift.fault-step", "saddle", "ridge"],
});

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

export function forceModulePatch({ graph, manifest = [], tiles = [], radius = 1 } = {}) {
  const used = new Set();
  const pins = [];
  for (const landmark of manifest) {
    const landformWanted = {
      "volcanic-snow-massif": ["peak.glacier", "peak.snowline", "mountain"],
      "rift-shoulder-pass": ["rift.fault-step", "saddle", "ridge"],
      "rift-escarpment": ["rift.escarpment", "rift.floor", "rift.fault-step"],
      "rift-long-lake": ["lake.rift", "lake.reed-shore", "wetland"],
      "auckland-volcanic-hills": ["volcanic.cone", "volcanic.tuff", "hill.low"],
      "japanese-alluvial-plain": ["plain.alluvial", "plain.moss", "plain.stream"],
    }[landmark.landformClass];
    const wanted = landformWanted || PROFILE_TILE_IDS[landmark.profile] || ["plain.grass"];
    const candidates = [...graph.cells()].map((cell) => ({
      cell,
      distance: Math.acos(Math.max(-1, Math.min(1, dot(graph.directionOf(cell.index), landmark.direction)))),
    })).sort((a, b) => a.distance - b.distance || a.cell.index - b.cell.index);
    const limit = landmark.profile === "highland-citadel" ? 5 : landmark.profile === "crystal-canyon" ? 4 : 3;
    let added = 0;
    for (const candidate of candidates) {
      const allowance = landmark.waterNeeds === "coast" ? Math.max((landmark.angularRadius || 0.1) * radius * 1.35, 0.65) : (landmark.angularRadius || 0.1) * radius * 1.35;
      if (candidate.distance > allowance || used.has(candidate.cell.index)) continue;
      const tileId = wanted[added % wanted.length];
      const tile = tiles.find((entry) => entry.id === tileId && entry.orientation === "base") || tiles.find((entry) => entry.id === tileId);
      if (!tile) continue;
      used.add(candidate.cell.index);
      pins.push({ cell: candidate.cell.id, cellIndex: candidate.cell.index, variant: tile.key, source: `patch:${landmark.id}`, landmarkId: landmark.id });
      added++;
      if (added >= limit) break;
    }
  }
  return { pins, usedCells: used, patchCount: new Set(pins.map((pin) => pin.landmarkId)).size };
}
