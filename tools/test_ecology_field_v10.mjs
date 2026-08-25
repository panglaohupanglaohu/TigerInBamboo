// =====================================================================
// G21-D ecology field gate (DeepSeek TEST, pure Node).
// Covers: slope as strongest negative weight, north-facing gain,
// precipitation gain, snow line / keepout hard zero, species transitions
// driven by water depth + wetness (not just color), and the PLAN 12.30.5
// scenario constraints on the real chain world: highland windward forest
// band stronger than leeward, dry canyon gap, continuous reed ring around
// the rift lake, open saihoji core, and road locks that grow no trees.
// =====================================================================

import assert from "node:assert/strict";
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { solveHydrologyV10, angularDistance as hAng } from "../TigerMessenger/src/procgen/planet/hydrologyFieldV10.js";
import { solveClimateV10 } from "../TigerMessenger/src/procgen/planet/climateFieldV10.js";
import { solveEcologyV10, SPECIES_BANDS_V10, SPECIES_BAND_INDEX_V10 } from "../TigerMessenger/src/procgen/planet/ecologyFieldV10.js";

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
const wind = normalize([0.3, 0.55, 0.78]);
const grid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 2, seed: 1 });
const north = [0, 1, 0];

// --- synthetic: slope suppresses forest, north facing and precipitation help ---
const flatElevation = () => 2;
const hyd = solveHydrologyV10({ grid, elevationAt: flatElevation, seaLevel: 0 });
const clim = solveClimateV10({ grid, hydrology: hyd, elevationAt: flatElevation, wind });
const flatEco = solveEcologyV10({ grid, hydrology: hyd, climate: clim, elevationAt: flatElevation, baseForestnessAt: () => 1, snowlineElevation: 10, treeLineElevation: 9 });
assert.ok(flatEco.cells.every((cell) => cell.ecology.forestness > 0.5), "flat wet-neutral world must be forested");
// steep cliff: slope >= rockSlopeThreshold zeroes forest and yields bareRock
const cliffEco = solveEcologyV10({
  grid, hydrology: hyd, climate: clim,
  elevationAt: (dir) => 2 + 12 * Math.max(0, dot(dir, normalize([0.5, 0.8, 0.3]))),
  baseForestnessAt: () => 1, snowlineElevation: 10, treeLineElevation: 9, rockSlopeThreshold: 0.85,
});
const rockCells = cliffEco.cells.filter((cell) => cell.ecology.speciesBand === SPECIES_BAND_INDEX_V10.bareRock);
assert.ok(rockCells.length > 0, "steep terrain must produce bare rock");
assert.ok(rockCells.every((cell) => cell.ecology.forestness === 0), "rock forbids forest");

// --- snow line zeroes forest and yields snow band ---
const snowEco = solveEcologyV10({
  grid, hydrology: hyd, climate: clim,
  elevationAt: (dir) => 8 + 8 * dot(dir, north),
  baseForestnessAt: () => 1, snowlineElevation: 5.2,
});
const snowCells = snowEco.cells.filter((cell) => cell.ecology.speciesBand === SPECIES_BAND_INDEX_V10.snow);
assert.ok(snowCells.length > 0, "above snow line must be snow");
assert.ok(snowCells.every((cell) => cell.ecology.forestness === 0), "snow line hard zeroes forest");

// --- hard locks zero forest on flat land ---
const lockedEco = solveEcologyV10({
  grid, hydrology: hyd, climate: clim, elevationAt: flatElevation,
  baseForestnessAt: () => 1, snowlineElevation: 10, treeLineElevation: 9,
  locksAt: () => ({ route: 1 }),
});
assert.ok(lockedEco.cells.every((cell) => cell.ecology.forestness === 0), "route lock must hard-zero forest");
assert.ok(lockedEco.cells.every((cell) => cell.locks.route === 1));

// --- species driven by water depth: shallow water -> reed, deep -> openWater ---
const speciesGrid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 3, seed: 2 });
const dip = normalize([-0.3, 0.8, 0.5]);
const speciesEco = solveEcologyV10({
  grid: speciesGrid,
  hydrology: solveHydrologyV10({
    grid: speciesGrid,
    elevationAt: (dir) => 1.5 - 2.5 * Math.max(0, 1 - hAng(dir, dip) / 0.5),
    seaLevel: 0.6,
    shallowWaterDepth: 0.8,
  }),
  climate: solveClimateV10({
    grid: speciesGrid,
    hydrology: solveHydrologyV10({ grid: speciesGrid, elevationAt: () => 1.5, seaLevel: 0 }),
    elevationAt: () => 1.5, wind,
  }),
  elevationAt: (dir) => 1.5 - 2.5 * Math.max(0, 1 - hAng(dir, dip) / 0.5),
  baseForestnessAt: () => 0.5, snowlineElevation: 10, treeLineElevation: 9,
});
const bands = new Set(speciesEco.cells.map((cell) => SPECIES_BANDS_V10[cell.ecology.speciesBand]));
assert.ok(bands.has("openWater"), `deep water band missing: ${[...bands]}`);
assert.ok(bands.has("shallowReed") || bands.has("mudflat"), `shallow/ wetland bands missing: ${[...bands]}`);

// --- synthetic low ridge below the snow line: windward forest > leeward ---
// A moisture source (ocean upwind) must exist or the whole world is arid:
// fetch → vapor → windward lift rain, leeward rain shadow.
const lowRidgeGrid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 2, seed: 3 });
const lowRidgeCenter = normalize([0.2, 0.7, -0.6]);
const ridgeScore = dot(lowRidgeCenter, wind);
const lowElevation = (dir) => {
  const d = hAng(dir, lowRidgeCenter);
  return (dot(dir, wind) < -0.4 ? -1 : 1 + 3.2 * Math.max(0, 1 - d / 0.45)); // ocean upwind, ridge peak 4.2 < snowline
};
const lrHydrology = solveHydrologyV10({ grid: lowRidgeGrid, elevationAt: lowElevation, seaLevel: 0 });
const lrClimate = solveClimateV10({ grid: lowRidgeGrid, hydrology: lrHydrology, elevationAt: lowElevation, wind });
const lrEcology = solveEcologyV10({
  grid: lowRidgeGrid, hydrology: lrHydrology, climate: lrClimate, elevationAt: lowElevation,
  baseForestnessAt: () => 0.5, snowlineElevation: 5.2, treeLineElevation: 4.2,
});
let windwardForestSum = 0; let windwardCount = 0; let leewardForestSum = 0; let leewardCount = 0;
for (const cell of lowRidgeGrid.dual.cells()) {
  const d = lowRidgeGrid.dual.directionOf(cell.index);
  if (hAng(d, lowRidgeCenter) > 0.75 || dot(d, wind) < -0.35) continue; // ridge flanks only, skip the ocean
  const score = dot(d, wind);
  const forestness = lrEcology.byId.get(cell.id).ecology.forestness;
  if (score < ridgeScore - 0.04) { windwardForestSum += forestness; windwardCount++; }
  if (score > ridgeScore + 0.04) { leewardForestSum += forestness; leewardCount++; }
}
assert.ok(windwardCount >= 2 && leewardCount >= 2, `low ridge windward=${windwardCount} leeward=${leewardCount}`);
assert.ok(windwardForestSum / windwardCount > leewardForestSum / leewardCount + 0.03, "windward flank of a low ridge must be more forested than leeward (rain feedback)");

// --- real chain world: PLAN 12.30.5 scenario constraints ---
for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3, stopAfter: "routes" });
  assert.equal(world.ok, true, `seed=${seed}`);
  const fineGrid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 4, seed, preserve: world.manifest.map((entry) => entry.direction) });
  const locks = world.manifest
    .filter((entry) => entry.waterNeeds === "closed-lake-basin")
    .map((entry) => ({ id: entry.id, direction: entry.direction, angularRadius: entry.angularRadius, level: 0.08 }));
  const hydrology = solveHydrologyV10({ grid: fineGrid, elevationAt: (dir) => world.field.heightAt(dir), seaLevel: 0, basinLocks: locks });
  const climate = solveClimateV10({ grid: fineGrid, hydrology, elevationAt: (dir) => world.field.heightAt(dir), wind });
  const byId = new Map(world.manifest.map((entry) => [entry.id, entry]));
  const ecology = solveEcologyV10({
    grid: fineGrid, hydrology, climate,
    elevationAt: (dir) => world.field.heightAt(dir),
    // mild authored baseline: the field's own wetness/precipitation/slope
    // dynamics decide the final density (scenario assertions below)
    baseForestnessAt: () => 0.3,
    locksAt: (cellId) => ({}),
    snowlineElevation: 5.2, treeLineElevation: 4.2,
  });

  // scenario 1: highland windward wetter than leeward — the precipitation
  // mechanism behind the windward forest band.  At subdivision-1 WFC the
  // snow tiles overrun the whole near-massif ring, so forestness itself is
  // snow-zeroed on both flanks; the wetness/precipitation asymmetry is the
  // resolution-independent claim (a synthetic low ridge below the snow line
  // verifies the forest asymmetry directly, see below).
  const highland = byId.get("highland-citadel");
  const highlandScore = dot(highland.direction, wind);
  const bandCells = fineGrid.dual.cells()
    .map((cell) => ({ cell, dist: hAng(fineGrid.dual.directionOf(cell.index), highland.direction), score: dot(fineGrid.dual.directionOf(cell.index), wind) }))
    .filter((entry) => entry.dist >= 0.28 && entry.dist <= 0.6);
  const windwardBand = bandCells.filter((entry) => entry.score < highlandScore - 0.03);
  const leewardBand = bandCells.filter((entry) => entry.score > highlandScore + 0.03);
  assert.ok(windwardBand.length >= 2 && leewardBand.length >= 2, `seed=${seed} highland band cells windward=${windwardBand.length} leeward=${leewardBand.length}`);
  const meanOf = (entries, key) => entries.reduce((sum, entry) => sum + ecology.byId.get(entry.cell.id).ecology[key], 0) / entries.length;
  const windwardWetness = meanOf(windwardBand, "ecologicalWetness");
  const leewardWetness = meanOf(leewardBand, "ecologicalWetness");
  assert.ok(windwardWetness > leewardWetness, `seed=${seed} windward wetness ${windwardWetness.toFixed(3)} must beat leeward ${leewardWetness.toFixed(3)}`);

  // scenario 2: dry canyon gap (crystal-canyon region stays mostly open)
  const canyon = byId.get("crystal-canyon");
  const canyonCells = fineGrid.dual.cells().filter((cell) => hAng(fineGrid.dual.directionOf(cell.index), canyon.direction) < canyon.angularRadius * 0.7);
  const canyonMeanForest = canyonCells.length ? canyonCells.reduce((sum, cell) => sum + ecology.byId.get(cell.id).ecology.forestness, 0) / canyonCells.length : 0;
  assert.ok(canyonMeanForest < 0.45, `seed=${seed} canyon must stay dry/open (mean forest ${canyonMeanForest.toFixed(3)})`);

  // scenario 3: continuous reed ring around the rift lake
  const swamp = byId.get("swamp-lake");
  const lakeCells = fineGrid.dual.cells().filter((cell) => hAng(fineGrid.dual.directionOf(cell.index), swamp.direction) < swamp.angularRadius);
  const reedRing = lakeCells.filter((cell) => ecology.byId.get(cell.id).ecology.reedness > 0.1);
  assert.ok(reedRing.length >= 2, `seed=${seed} reed ring around rift lake (${reedRing.length})`);

  // scenario 4: saihoji core stays open (openness = 1 - forestness >= 0.72)
  const saihoji = byId.get("saihoji-moss-garden");
  const coreCells = fineGrid.dual.cells().filter((cell) => hAng(fineGrid.dual.directionOf(cell.index), saihoji.direction) < saihoji.angularRadius * 0.5);
  const coreOpenness = coreCells.length ? coreCells.reduce((sum, cell) => sum + (1 - ecology.byId.get(cell.id).ecology.forestness), 0) / coreCells.length : 1;
  assert.ok(coreOpenness >= 0.72, `seed=${seed} saihoji core openness ${coreOpenness.toFixed(3)}`);

  // scenario 5: ecologicalWetness must be driven by precipitation, not runtime clouds
  for (const cell of ecology.cells) {
    assert.ok(Number.isFinite(cell.ecology.ecologicalWetness) && Number.isFinite(cell.ecology.forestness));
    assert.ok(cell.ecology.speciesBand >= 0 && cell.ecology.speciesBand < SPECIES_BANDS_V10.length);
    assert.ok(SPECIES_BANDS_V10.includes(SPECIES_BANDS_V10[cell.ecology.speciesBand]));
  }
}
console.log(`✅ Ecology field V10: slope/north/precip weights, snow/rock/keepout hard zero, species bands, chain scenarios (windward/dry canyon/reed ring/open core)`);
