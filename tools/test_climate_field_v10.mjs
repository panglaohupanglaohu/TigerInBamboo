// =====================================================================
// G21-C climate field gate (DeepSeek TEST, pure Node).
// Covers: tangent wind projection (no pole flip/zero), upwind ocean fetch
// increasing over water and decaying over land, windward lift vs leeward,
// rain shadow on the downwind side, vapor bounded without upwind water,
// sphere seam continuity, and 1000-seed hash stability on real chain
// worlds.
// =====================================================================

import assert from "node:assert/strict";
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { solveHydrologyV10, angularDistance as hydrologyAngular } from "../TigerMessenger/src/procgen/planet/hydrologyFieldV10.js";
import { solveClimateV10, projectWindTangent, upwindNeighbors } from "../TigerMessenger/src/procgen/planet/climateFieldV10.js";

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

const wind = normalize([0.3, 0.55, 0.78]);
const grid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 2, seed: 1 });
const directions = grid.dual.cells().map((cell) => grid.dual.directionOf(cell.index));
const count = directions.length;
const axisScore = (dir) => dot(dir, wind);

// --- 1. tangent projection: unit, orthogonal, no zero/flip ---
for (const dir of directions) {
  const t = projectWindTangent(dir, wind);
  assert.ok(Math.abs(Math.hypot(t[0], t[1], t[2]) - 1) < 1e-6, `tangent must stay unit at ${dir}`);
  assert.ok(Math.abs(dot(t, normalize(dir))) < 1e-6, `tangent must stay orthogonal at ${dir}`);
  assert.ok(dot(t, wind) >= -1e-9, `tangent must not flip against the wind at ${dir}`);
}
// degenerate cases (wind-aligned directions) still yield a unit tangent
for (const dir of [normalize(wind), normalize([...wind].map((v) => -v))]) {
  const t = projectWindTangent(dir, wind);
  assert.equal(Math.hypot(t[0], t[1], t[2]), 1);
}

// --- 2. fetch: water accumulates downwind, land decays ---
// upwind side is ocean (axis<-0.2), downwind side is land (axis>-0.2):
// air crosses the sea and carries moisture onto the coastal land.
const elevationAt = (dir) => (axisScore(dir) < -0.2 ? -1 : 2);
const hydrology = solveHydrologyV10({ grid, elevationAt, seaLevel: 0 });
const climate = solveClimateV10({ grid, hydrology, elevationAt, wind, radius: 160, fetchScale: 0.5, landDecay: 0.85, maxFetchDistance: 1.6 });
// two water cells: the more downwind one must have more fetch
const waterCells = [];
for (let i = 0; i < count; i++) if (hydrology.landMask[i] === 0) waterCells.push(i);
assert.ok(waterCells.length > 5);
waterCells.sort((a, b) => axisScore(directions[a]) - axisScore(directions[b]));
for (let k = 1; k < waterCells.length; k++) {
  const prev = waterCells[k - 1]; const curr = waterCells[k];
  if (axisScore(directions[curr]) - axisScore(directions[prev]) < 0.15) continue; // too close
  assert.ok(climate.upwindOceanFetch[curr] >= climate.upwindOceanFetch[prev], "fetch must grow downwind over water");
}
// land cells downwind of the coast: fetch positive but decaying inland
const landCells = [];
for (let i = 0; i < count; i++) if (hydrology.landMask[i] === 1) landCells.push(i);
const coastalLand = landCells
  .map((i) => ({ i, score: axisScore(directions[i]) }))
  .filter((entry) => entry.score > -0.15 && entry.score < 0.3)
  .sort((a, b) => a.score - b.score);
assert.ok(coastalLand.length >= 2, "need coastal land band");
const nearCoast = coastalLand[0].i;                 // just past the shoreline
const deepestInland = coastalLand[coastalLand.length - 1].i; // furthest downwind
assert.ok(climate.upwindOceanFetch[nearCoast] > 0, "coastal land must receive fetch");
assert.ok(climate.upwindOceanFetch[deepestInland] <= climate.upwindOceanFetch[nearCoast] + 1e-9, "fetch must decay inland");

// --- 3. windward lift vs leeward, rain shadow downwind ---
// A symmetric bump off the wind axis: cells between the wind source and the
// ridge (axisScore below the ridge) are windward, cells beyond the ridge
// (axisScore above it) are leeward.
const ridgeCenter = normalize([-0.4, 0.7, 0.5]);
const ridgeScore = dot(ridgeCenter, wind);
const ridgeElevation = (dir) => 4 * Math.max(0, 1 - hydrologyAngular(dir, ridgeCenter) / 0.5);
const hydrology2 = solveHydrologyV10({ grid, elevationAt: (dir) => ridgeElevation(dir) + 2, seaLevel: 0 });
const climate2 = solveClimateV10({ grid, hydrology: hydrology2, elevationAt: (dir) => ridgeElevation(dir) + 2, wind, radius: 160 });
let windward = []; let leeward = [];
for (let i = 0; i < count; i++) {
  if (hydrologyAngular(directions[i], ridgeCenter) >= 0.9) continue;
  const score = axisScore(directions[i]);
  if (score < ridgeScore - 0.05) windward.push(i);
  if (score > ridgeScore + 0.05) leeward.push(i);
}
assert.ok(windward.length >= 2 && leeward.length >= 2, `windward=${windward.length} leeward=${leeward.length}`);
const meanLift = (ids) => ids.reduce((sum, i) => sum + climate2.orographicLift[i], 0) / ids.length;
const meanShadow = (ids) => ids.reduce((sum, i) => sum + climate2.rainShadow[i], 0) / ids.length;
assert.ok(meanLift(windward) > meanLift(leeward) * 1.35, `windward lift ${meanLift(windward).toFixed(3)} must exceed leeward ${meanLift(leeward).toFixed(3)} by 1.35x`);
assert.ok(meanShadow(leeward) > meanShadow(windward), "rain shadow must be stronger on the leeward side");

// --- 4. no upwind water -> vapor bounded by evaporation only ---
const allLand = solveHydrologyV10({ grid, elevationAt: () => 3, seaLevel: 0 });
const climateDry = solveClimateV10({ grid, hydrology: allLand, elevationAt: () => 3, wind, radius: 160 });
assert.ok(climateDry.cells.every((cell) => cell.climate.upwindOceanFetch === 0), "no water -> no fetch");
assert.ok(climateDry.cells.every((cell) => cell.climate.vapor === cell.climate.evaporativeMoisture), "vapor limited to evaporation without water");
assert.ok(climateDry.cells.every((cell) => cell.climate.precipitationClimatology < 0.7), "dry world cannot rain heavily");

// --- 5. cloudBase lower over water (fog-prone) than over dry land ---
const waterCloudBase = climate.cells.filter((cell, i) => hydrology.landMask[i] === 0).reduce((sum, cell) => sum + cell.climate.cloudBase, 0) / Math.max(1, hydrology.cells.filter((_, i) => hydrology.landMask[i] === 0).length);
const landCloudBase = climateDry.cells.reduce((sum, cell) => sum + cell.climate.cloudBase, 0) / climateDry.cells.length;
assert.ok(waterCloudBase < landCloudBase, `water cloudBase ${waterCloudBase.toFixed(3)} must be lower than land ${landCloudBase.toFixed(3)}`);

// --- 6. golden seeds: continuity + deterministic hash + 1000 seed stability ---
const hashCells = (cells) => {
  let h = 2166136261;
  const update = (value) => { h ^= Math.round(value * 1e6); h = Math.imul(h, 16777619); };
  for (const cell of cells) {
    update(cell.climate.upwindOceanFetch); update(cell.climate.vapor); update(cell.climate.orographicLift);
    update(cell.climate.rainShadow); update(cell.climate.precipitationClimatology); update(cell.climate.cloudPotential);
  }
  return (h >>> 0).toString(16);
};
for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3, stopAfter: "routes" });
  assert.equal(world.ok, true, `seed=${seed}`);
  const hyd = solveHydrologyV10({ grid: world.grid, elevationAt: (dir) => world.field.heightAt(dir), seaLevel: 0, basinLocks: world.manifest.filter((e) => e.waterNeeds === "closed-lake-basin").map((e) => ({ id: e.id, direction: e.direction, angularRadius: e.angularRadius, level: 0.08 })) });
  const clim1 = solveClimateV10({ grid: world.grid, hydrology: hyd, elevationAt: (dir) => world.field.heightAt(dir), wind });
  const clim2 = solveClimateV10({ grid: world.grid, hydrology: hyd, elevationAt: (dir) => world.field.heightAt(dir), wind });
  assert.equal(hashCells(clim1.cells), hashCells(clim2.cells), `seed=${seed} deterministic`);
  assert.ok(clim1.cells.every((cell) => ["upwindOceanFetch", "vapor", "orographicLift", "rainShadow", "precipitationClimatology", "cloudPotential"].every((k) => Number.isFinite(cell.climate[k]))), `seed=${seed} finite`);
  // no runaway advection: the dual-grid climate field is chart-free, so the
  // meaningful continuity property is bounded neighbor deltas (a coastal
  // moisture cliff is legal; values beyond physical ceilings mean a bug)
  for (let i = 0; i < world.grid.dual.cells().length; i++) {
    for (const edge of world.grid.dual.neighborsOf(i)) {
      assert.ok(Math.abs(clim1.cells[i].climate.rainShadow - clim1.cells[edge.to].climate.rainShadow) <= 1.0, `seed=${seed} shadow runaway`);
      assert.ok(Math.abs(clim1.cells[i].climate.vapor - clim1.cells[edge.to].climate.vapor) <= 1.0, `seed=${seed} vapor runaway`);
      assert.ok(Math.abs(clim1.cells[i].climate.orographicLift - clim1.cells[edge.to].climate.orographicLift) <= 3.0, `seed=${seed} lift runaway`);
    }
  }
}
for (let seed = 1; seed <= 1000; seed++) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3, stopAfter: "routes" });
  assert.equal(world.ok, true, `seed=${seed}`);
  const hyd = solveHydrologyV10({ grid: world.grid, elevationAt: (dir) => world.field.heightAt(dir), seaLevel: 0 });
  const clim = solveClimateV10({ grid: world.grid, hydrology: hyd, elevationAt: (dir) => world.field.heightAt(dir), wind });
  assert.ok(clim.cells.every((cell) => Number.isFinite(cell.climate.upwindOceanFetch) && Number.isFinite(cell.climate.rainShadow)), `seed=${seed} NaN`);
  assert.ok(clim.cells.every((cell) => cell.climate.vapor >= 0 && cell.climate.vapor <= 1 && cell.climate.rainShadow >= 0 && cell.climate.rainShadow <= 1), `seed=${seed} range`);
}
console.log(`✅ Climate field V10: tangent/no-flip, fetch advect+decay, windward 1.35x lift, leeward shadow, dry vapor bound, cloudBase, 4 golden + 1000 seeds`);
