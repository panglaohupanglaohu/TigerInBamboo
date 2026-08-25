// =====================================================================
// G21-B hydrology field gate (DeepSeek TEST, pure Node).
// Covers: sea-level intersection, terrain-driven fill/spill for closed
// depressions, authored basin closure (no floating water / open basins),
// signed coast distance, drainage/flow tokens, stable shoreline boundary
// IDs in the WFC water-tile socket vocabulary, and 1000-seed NaN/leak
// freedom on real chain worlds.
// =====================================================================

import assert from "node:assert/strict";
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { solveHydrologyV10, shorelineEdgesV10, shoreTokenV10, angularDistance } from "../TigerMessenger/src/procgen/planet/hydrologyFieldV10.js";

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

const grid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 2, seed: 1 });
const north = [0, 1, 0];

// --- 1. all-land world: no water, coastDistance far away, positive ---
const landOnly = solveHydrologyV10({ grid, elevationAt: () => 3, seaLevel: 0 });
assert.ok(landOnly.cells.every((cell) => cell.water.landMask === 1), "flat land must be all land");
assert.ok(landOnly.cells.every((cell) => cell.water.coastDistance >= 0), "coast distance must be non-negative on land");
assert.equal(landOnly.openBasins.length, 0);
assert.ok(landOnly.cells.every((cell) => Number.isFinite(cell.water.coastDistance)));

// --- 2. tilted world: one hemisphere under water ---
const tilted = solveHydrologyV10({
  grid,
  elevationAt: (dir) => 6 * dot(dir, north), // +6 at north pole, -6 at south pole
  seaLevel: 0,
});
const waterCells = tilted.cells.filter((cell) => cell.water.landMask === 0);
const landCells = tilted.cells.filter((cell) => cell.water.landMask === 1);
assert.ok(waterCells.length > 0 && landCells.length > 0, "tilted world must have both land and water");
assert.ok(waterCells.every((cell) => cell.water.waterDepth > 0), "water cells must have positive depth");
assert.ok(waterCells.every((cell) => cell.water.coastDistance < 0), "coast distance must be negative under water");
assert.ok(landCells.every((cell) => cell.water.coastDistance >= 0), "coast distance must be non-negative on land");
// depth grows away from the shore: every water cell's deepest neighbor is at least as deep
for (const cell of waterCells) {
  const i = tilted.cells.indexOf(cell);
  const neighbors = grid.dual.neighborsOf(i);
  assert.ok(neighbors.length > 0);
  const maxNeighborDepth = Math.max(...neighbors.map((edge) => tilted.waterDepth[edge.to]));
  assert.ok(cell.water.waterDepth <= maxNeighborDepth + 1e-6, "water depth must not exceed the deepest neighbor (no floating water)");
}
// shoreline boundary IDs exist and are stable
const shores = shorelineEdgesV10(grid, tilted);
assert.ok(shores.length > 0, "shoreline edges must exist");
assert.equal(new Set(shores.map((edge) => edge.id)).size, shores.length, "shore ids unique");
assert.ok(shores.every((edge) => edge.landSide && edge.waterSide));
assert.ok(shores.every((edge) => edge.id.startsWith("shore:")));
const tokens = new Set(tilted.cells.map((cell) => shoreTokenV10(tilted, cell.id)));
assert.ok(tokens.has("ocean") && tokens.has("coast") && tokens.has("land"), `tokens ${[...tokens]}`);

// --- 3. closed depressions: fill/spill by terrain ---
// 3a. single bowl below sea level on flat land: a closed water body whose
// rim holds the water (no leak, no floating water).
const bowl = solveHydrologyV10({
  grid,
  elevationAt: (dir) => {
    const d = angularDistance(dir, north);
    return 3 + (d < 0.8 ? -10 * (1 - d / 0.8) : 0); // -7 dip at the north pole, rim 3
  },
  seaLevel: 0,
});
const bowlWater = bowl.cells.filter((cell) => cell.water.landMask === 0);
assert.ok(bowlWater.length > 0, "closed depression must hold water");
assert.ok(bowlWater.every((cell) => cell.water.waterDepth > 0));
for (const cell of bowlWater) {
  const i = bowl.cells.indexOf(cell);
  for (const edge of grid.dual.neighborsOf(i)) {
    const neighbor = bowl.cells[edge.to];
    if (neighbor.water.landMask === 1) {
      assert.ok(neighbor.terrain.elevation >= cell.terrain.elevation + cell.water.waterDepth - 1e-6, "rim must hold the water (spill >= level)");
    }
  }
}
assert.equal(bowl.openBasins.length, 0);
// 3b. ocean hemisphere + small isolated dip on land: the dip becomes a lake
// (lakeMask=1) with terrain-derived spill; the dominant body stays ocean.
const dipDir = normalize([0.6, 0.65, 0.45]);
const dipWorld = solveHydrologyV10({
  grid,
  elevationAt: (dir) => {
    const d = angularDistance(dir, dipDir);
    return 6 * dot(dir, north) + (d < 0.45 ? -12 * (1 - d / 0.45) : 0);
  },
  seaLevel: 0,
});
const lakeCells = dipWorld.cells.filter((cell) => cell.water.lakeMask === 1);
assert.ok(lakeCells.length > 0, "isolated below-sea dip must become a lake");
assert.ok(lakeCells.every((cell) => cell.water.landMask === 0 && cell.water.waterDepth > 0), "lake cells are water");
const oceanCells = dipWorld.cells.filter((cell) => cell.water.lakeMask === 0 && cell.water.landMask === 0);
assert.ok(oceanCells.length > lakeCells.length, "dominant component stays ocean");
assert.equal(dipWorld.openBasins.length, 0);

// --- 4. golden seeds on real chain worlds: no NaN, no leaks, closed authored basins ---
// The chain world compiles with subdivision=1 (coarse WFC pins cannot keep
// one land component at finer subdivisions); the terrain FIELD is a global
// continuous function, so the hydrology field samples it on a finer dual
// grid — exactly how production charts consume the same field.  The finer
// grid resolves the authored rift-lake cap (at subdivision=1 no cell center
// falls inside the basin cap by construction).
for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3, stopAfter: "routes" });
  assert.equal(world.ok, true, `seed=${seed}`);
  const fineGrid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 4, seed, preserve: world.manifest.map((entry) => entry.direction) });
  const locks = world.manifest
    .filter((entry) => entry.waterNeeds === "closed-lake-basin" || entry.waterNeeds === "lower-waterfall-basin")
    .map((entry) => ({
      id: entry.waterNeeds === "lower-waterfall-basin" ? "highland-waterfall-l1-basin" : entry.id,
      direction: entry.direction,
      angularRadius: entry.waterNeeds === "lower-waterfall-basin" ? Math.min(0.1, entry.angularRadius * 0.55) : entry.angularRadius,
      level: entry.waterNeeds === "lower-waterfall-basin" ? 0.02 : 0.08,
    }));
  const hydrology = solveHydrologyV10({ grid: fineGrid, elevationAt: (dir) => world.field.heightAt(dir), seaLevel: 0, basinLocks: locks });
  for (const cell of hydrology.cells) {
    for (const group of [cell.terrain, cell.water]) for (const value of Object.values(group)) assert.ok(Number.isFinite(value), `seed=${seed} ${cell.id} non-finite`);
    assert.ok(cell.water.landMask === 0 || cell.water.landMask === 1);
  }
  assert.equal(hydrology.openBasins.length, 0, `seed=${seed} open basins: ${hydrology.openBasins.map((b) => b.id).join(",")}`);
  // authored lake (swamp) must actually hold water on the chain terrain
  const swampBasin = hydrology.basins.find((basin) => basin.id === "swamp-lake");
  assert.ok(swampBasin.waterCellCount > 0, `seed=${seed} swamp must hold water`);
  assert.ok(swampBasin.closed || swampBasin.hasValidSpillOrLock, `seed=${seed} swamp closed`);
  const swampIndex = locks.findIndex((lock) => lock.id === "swamp-lake");
  const swampWater = hydrology.cells.filter((cell) => hydrology.basinOf[hydrology.cells.indexOf(cell)] === swampIndex);
  assert.equal(swampWater.length, swampBasin.waterCellCount);
}

// --- 5. 1000-seed field gate: no NaN, no open basins, water only where supported ---
for (let seed = 1; seed <= 1000; seed++) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3, stopAfter: "routes" });
  assert.equal(world.ok, true, `seed=${seed}`);
  const fineGrid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 4, seed, preserve: world.manifest.map((entry) => entry.direction) });
  const locks = world.manifest
    .filter((entry) => entry.waterNeeds === "closed-lake-basin")
    .map((entry) => ({ id: entry.id, direction: entry.direction, angularRadius: entry.angularRadius, level: 0.08 }));
  const hydrology = solveHydrologyV10({ grid: fineGrid, elevationAt: (dir) => world.field.heightAt(dir), seaLevel: 0, basinLocks: locks });
  assert.ok(hydrology.cells.every((cell) => Number.isFinite(cell.water.waterDepth) && Number.isFinite(cell.water.coastDistance)), `seed=${seed} NaN`);
  assert.equal(hydrology.openBasins.length, 0, `seed=${seed} open basins`);
  assert.ok(hydrology.surfaceEverywhereSupported, `seed=${seed} floating water`);
}
console.log(`✅ Hydrology field V10: sea-level/tilt sign, depression fill-spill, basin closure, shore ids, 4 golden + 1000 seeds`);
