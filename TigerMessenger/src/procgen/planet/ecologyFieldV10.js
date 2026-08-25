// =====================================================================
// V10 ecology field (G21-D, DeepSeek data layer).
//
// Turns hydrology + climate into vegetation density and species bands on
// the same semantic cells: ecologicalWetness blends base wetness with the
// generated precipitation climatology (never with runtime cloud
// instances), forestness uses slope as the strongest negative weight and
// hard keepouts (building/route/combat/camera, snow line, steep rock,
// ridge meadow) as zeroing terms, and speciesBand converts water depth +
// wetness + elevation into the 9-band vocabulary.  Pure Node data code.
// =====================================================================

import { createSemanticCellV10, DEFAULT_SEMANTIC_CELL_V10 } from "./semanticFieldV10.js";

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function smoothstep(a, b, value) { const t = clamp01((value - a) / Math.max(1e-6, b - a)); return t * t * (3 - 2 * t); }
export function angularDistance(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))))); }

export const SPECIES_BANDS_V10 = Object.freeze([
  "openWater", "shallowReed", "mudflat", "wetGrass", "broadleaf",
  "pine", "alpineMeadow", "bareRock", "snow",
]);

export const SPECIES_BAND_INDEX_V10 = Object.freeze(Object.fromEntries(SPECIES_BANDS_V10.map((name, index) => [name, index])));

/**
 * @param {object} options
 *   grid             geodesic grid
 *   hydrology        solveHydrologyV10 result
 *   climate          solveClimateV10 result
 *   elevationAt      (direction) => height  (same terrain source)
 *   baseForestnessAt (cellId) => 0..1  authored base forestness (tile)
 *   locksAt          (cellId) => {building,route,combat,camera,authoredBiome}
 *   snowlineElevation  elevation above which forestness is hard 0
 *   treeLineElevation  elevation above which only alpine meadow grows
 *   rockSlopeThreshold slope above which only bare rock grows
 *   ridgeSlope        slope above which ridges are meadow, not forest
 */
export function solveEcologyV10({
  grid, hydrology, climate, elevationAt = () => 0,
  baseForestnessAt = () => 0.5, locksAt = () => ({}),
  snowlineElevation = 5.2, treeLineElevation = 4.2, rockSlopeThreshold = 0.85, ridgeSlope = 0.55,
} = {}) {
  if (!grid?.dual || !hydrology?.cells || !climate?.cells) throw new Error("ecology-v10: grid/hydrology/climate required");
  const cells = grid.dual.cells();
  const count = cells.length;
  const shallow = hydrology.shallowWaterDepth ?? 0.5;
  const north = [0, 1, 0];

  // --- terrain metrics from the same elevation source ---
  const slope = new Array(count).fill(0);
  const northFacing = new Array(count).fill(0);
  const rockness = new Array(count).fill(0);
  const snowness = new Array(count).fill(0);
  for (let i = 0; i < count; i++) {
    const dir = grid.dual.directionOf(i);
    const elevation = elevationAt(dir);
    let maxRise = 0;
    let maxDrop = 0;
    for (const edge of grid.dual.neighborsOf(i)) {
      const nDir = grid.dual.directionOf(edge.to);
      const delta = elevationAt(nDir) - elevation;
      const step = angularDistance(dir, nDir) || 1e-6;
      if (delta > maxRise) maxRise = delta;
      if (-delta > maxDrop) maxDrop = delta;
    }
    slope[i] = clamp01(Math.max(maxRise, maxDrop) / 4);
    northFacing[i] = clamp01(dot(dir, north) * 0.5 + 0.5);
    rockness[i] = clamp01(slope[i] * 0.9);
    snowness[i] = clamp01(Math.max(0, (elevation - (snowlineElevation - 1.2)) / 1.2));
  }

  // --- ecology pass ---
  const cellsOut = cells.map((cell, i) => {
    const hyd = hydrology.cells[i].water;
    const clim = climate.cells[i].climate;
    const terrain = hydrology.cells[i].terrain;
    const locks = locksAt(cell.id) || {};
    const elevation = terrain.elevation;
    const nearWater = 1 - smoothstep(0, 0.9 * (hydrology.radius ?? 160), Math.abs(hyd.coastDistance));
    const ecologicalWetness = clamp01(hyd.baseWetness * 0.55 + clim.precipitationClimatology * 0.35 + nearWater * 0.10);

    // hard keepouts: authored locks zero the forest; snow line / steep rock /
    // ridge meadow keep the biome but forbid forest
    const authoredKeepout = clamp01((locks.building ?? 0) + (locks.route ?? 0) + (locks.combat ?? 0) + (locks.camera ?? 0) + (locks.authoredBiome ?? 0));
    const snowForbids = snowness[i] >= 0.5 || elevation >= snowlineElevation;
    const rockForbids = slope[i] >= rockSlopeThreshold;
    const ridgeMeadow = elevation >= treeLineElevation && slope[i] >= ridgeSlope;
    const baseForestness = clamp01(baseForestnessAt(cell.id));
    let forestness = clamp01(
      baseForestness * 0.55 + ecologicalWetness * 0.25 + northFacing[i] * 0.12 - slope[i] * 0.7 - authoredKeepout,
    );
    if (authoredKeepout >= 0.999 || snowForbids || rockForbids || ridgeMeadow) forestness = 0;

    // species band by priority (water first, then snow/rock/meadow/forest)
    let speciesBand;
    if (hyd.landMask === 0 && hyd.waterDepth >= shallow) speciesBand = SPECIES_BAND_INDEX_V10.openWater;
    else if (hyd.landMask === 0) speciesBand = SPECIES_BAND_INDEX_V10.shallowReed;
    else if (snowForbids) speciesBand = SPECIES_BAND_INDEX_V10.snow;
    else if (rockForbids) speciesBand = SPECIES_BAND_INDEX_V10.bareRock;
    else if (hyd.waterDepth > 0 || hyd.baseWetness >= 0.7) speciesBand = SPECIES_BAND_INDEX_V10.mudflat;
    else if (ridgeMeadow || elevation >= treeLineElevation) speciesBand = SPECIES_BAND_INDEX_V10.alpineMeadow;
    else if (forestness >= 0.55 && (northFacing[i] >= 0.6 || elevation >= 2.6)) speciesBand = SPECIES_BAND_INDEX_V10.pine;
    else if (forestness >= 0.32) speciesBand = SPECIES_BAND_INDEX_V10.broadleaf;
    else if (ecologicalWetness >= 0.55) speciesBand = SPECIES_BAND_INDEX_V10.wetGrass;
    else speciesBand = SPECIES_BAND_INDEX_V10.wetGrass;

    const waterShallow = hyd.landMask === 0 && hyd.waterDepth < shallow;
    const reedness = waterShallow ? clamp01(1 - hyd.waterDepth / shallow) : 0;
    const mudness = hyd.landMask === 1 && (hyd.waterDepth > 0 || hyd.baseWetness >= 0.7) ? clamp01(hyd.baseWetness) : 0;
    const grassness = (hyd.landMask === 1 && !snowForbids && !rockForbids) ? clamp01((1 - forestness) * (0.4 + ecologicalWetness * 0.6)) : 0;

    return createSemanticCellV10({
      id: cell.id,
      terrain: { ...terrain, slope: slope[i], northFacing: northFacing[i], rockness: rockness[i], snowness: snowness[i] },
      water: { ...hyd },
      climate: { ...clim },
      ecology: { ecologicalWetness, forestness, grassness, reedness, mudness, speciesBand },
      locks: {
        building: clamp01(locks.building ?? 0),
        route: clamp01(locks.route ?? 0),
        combat: clamp01(locks.combat ?? 0),
        camera: clamp01(locks.camera ?? 0),
        authoredBiome: clamp01(locks.authoredBiome ?? 0),
      },
    });
  });

  return Object.freeze({
    kind: "ecology-field-v10",
    cells: cellsOut,
    byId: new Map(cellsOut.map((cell) => [cell.id, cell])),
    slope,
    northFacing,
    rockness,
    snowness,
    speciesBands: SPECIES_BANDS_V10,
  });
}
