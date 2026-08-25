// V9 vegetation presentation schema.  When an ecology field is present the
// compiler copies density/species/grass/reed/mud from ecologyFieldV10 and
// never re-guesses wetness.  Without ecology it still wraps the V8 sampler
// so legacy unit tests keep a payload.

import { compileVegetationV8, vegetationScaleMultiplier } from "./vegetationCompilerV8.js";
import { sampleBarycentricDirection } from "./geodesicGrid.js";
import { SPECIES_BANDS_V10 } from "./ecologyFieldV10.js";

const ECOLOGY_BUCKETS = Object.freeze(["pine", "broadleaf", "wetland", "grass", "rock"]);

const BAND_TO_SPECIES = Object.freeze({
  openWater: null,
  shallowReed: "wetland",
  mudflat: "wetland",
  wetGrass: "grass",
  broadleaf: "broadleaf",
  pine: "pine",
  alpineMeadow: "grass",
  bareRock: "rock",
  snow: null,
});

function normalize(position) {
  const length = Math.hypot(...position) || 1;
  return position.map((value) => value / length);
}

function hashInstance(token) {
  let hash = 2166136261;
  for (const character of token) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `veg${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function rngAt(seed, triangleIndex) {
  let state = (Math.imul((seed >>> 0) ^ 0x9e3779b9, (triangleIndex + 1) >>> 0) + 1013904223) >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function lodForSpecies(species) {
  if (species === "grass") return [0, 90];
  if (species === "wetland") return [0, 140];
  if (species === "rock") return [0, 120];
  return [0, 220];
}

function renderTierForSpecies(species) {
  if (species === "rock") return "trunk";
  if (species === "pine" || species === "broadleaf") return "canopy";
  return "canopy";
}

function enrichInstance(instance, { profile, triangleIndex, kind }) {
  const species = instance.species;
  const lodRange = lodForSpecies(species);
  const normal = normalize(instance.position || [0, 1, 0]);
  const windWeight = species === "rock" ? 0 : Math.max(0.05, Math.min(1, instance.phase ?? 0.5));
  return {
    ...instance,
    instanceId: hashInstance(`${species}:${instance.cellId || "none"}:${triangleIndex}:${kind}:${(instance.position || []).map((value) => Number(value).toFixed(3)).join(",")}`),
    normal,
    windWeight,
    lodRange,
    renderTier: renderTierForSpecies(species),
    clusterId: `${profile || "default"}:${species}:${Math.floor(triangleIndex / 6)}`,
  };
}

function rebuildLodBuckets(buckets) {
  const lodBuckets = { near: [], mid: [], far: [] };
  for (const instances of Object.values(buckets)) {
    for (const instance of instances) {
      lodBuckets.near.push(instance);
      if (instance.lodRange[1] >= 120) lodBuckets.mid.push(instance);
      if (instance.lodRange[1] >= 200) lodBuckets.far.push(instance);
    }
  }
  return lodBuckets;
}

function insideKeepout(position, keepouts) {
  return keepouts.some((keepout) => keepout.position && Math.hypot(
    position[0] - keepout.position[0],
    position[1] - keepout.position[1],
    position[2] - keepout.position[2],
  ) < (keepout.radius || 0));
}

export function readEcologySample(cell, ecology) {
  if (!ecology) return null;
  const packed = ecology.byId?.get?.(cell.id)
    || (Number.isInteger(cell.index) ? ecology.cells?.[cell.index] : null);
  const fields = packed?.ecology;
  if (!fields) return null;
  return {
    ecologicalWetness: Number(fields.ecologicalWetness) || 0,
    forestness: Number(fields.forestness) || 0,
    grassness: Number(fields.grassness) || 0,
    reedness: Number(fields.reedness) || 0,
    mudness: Number(fields.mudness) || 0,
    speciesBand: Number.isInteger(fields.speciesBand) ? fields.speciesBand : 3,
    cellId: packed.id,
    cellIndex: Number.isInteger(cell.index) ? cell.index : ecology.cells?.indexOf?.(packed),
  };
}

export function speciesFromEcologyBand(speciesBand) {
  const name = SPECIES_BANDS_V10[speciesBand] || "wetGrass";
  return BAND_TO_SPECIES[name] ?? null;
}

function sampleTrianglePoint(triangle, next) {
  const u = next();
  const v = next();
  const su = Math.sqrt(u);
  const bary = [1 - su, su * (1 - v), su * v];
  const a = triangle.a;
  const b = triangle.b;
  const c = triangle.c;
  return [
    a[0] * bary[0] + b[0] * bary[1] + c[0] * bary[2],
    a[1] * bary[0] + b[1] * bary[1] + c[1] * bary[2],
    a[2] * bary[0] + b[2] * bary[1] + c[2] * bary[2],
  ];
}

function compileVegetationFromEcology({
  triangles = [],
  profile = "default",
  seed = 1,
  keepouts = [],
  maxInstances = 2000,
  maxGrass = 800,
  ecology,
  grid,
  chartId = null,
} = {}) {
  const buckets = Object.fromEntries(ECOLOGY_BUCKETS.map((species) => [species, []]));
  let treeCount = 0;
  let grassCount = 0;
  for (let triangleIndex = 0; triangleIndex < triangles.length; triangleIndex++) {
    const triangle = triangles[triangleIndex];
    const next = rngAt(seed, triangleIndex);
    const position = sampleTrianglePoint(triangle, next);
    if (insideKeepout(position, keepouts)) continue;
    const hit = sampleBarycentricDirection(grid, normalize(position));
    const sample = readEcologySample({ id: grid.dual.cellId(hit.cellIndex), index: hit.cellIndex }, ecology);
    if (!sample) continue;
    const species = speciesFromEcologyBand(sample.speciesBand);
    const copied = {
      ecologicalWetness: sample.ecologicalWetness,
      forestness: sample.forestness,
      grassness: sample.grassness,
      reedness: sample.reedness,
      mudness: sample.mudness,
      speciesBand: sample.speciesBand,
      cellId: sample.cellId,
      cellIndex: sample.cellIndex,
      ecologySource: "ecology-v10",
    };
    if (species === "pine" || species === "broadleaf") {
      const treeRoll = next();
      if (treeCount < maxInstances && treeRoll <= sample.forestness) {
        const instance = enrichInstance({
          position,
          species,
          scale: (0.8 + next() * 0.45) * vegetationScaleMultiplier(profile, species),
          phase: next(),
          ...copied,
        }, { profile, triangleIndex, kind: "tree" });
        buckets[species].push(instance);
        treeCount += 1;
      } else {
        next();
        next();
      }
      if (grassCount < maxGrass && sample.grassness > 0.08 && next() <= sample.grassness * 0.55) {
        const instance = enrichInstance({
          position,
          scale: 0.55 + next() * 0.35,
          phase: next(),
          ...copied,
          species: "grass",
        }, { profile, triangleIndex, kind: "grass" });
        buckets.grass.push(instance);
        grassCount += 1;
      }
    } else if (species === "grass") {
      if (grassCount < maxGrass && next() <= Math.max(0.04, sample.grassness)) {
        const instance = enrichInstance({
          position,
          species: "grass",
          scale: 0.55 + next() * 0.35,
          phase: next(),
          ...copied,
        }, { profile, triangleIndex, kind: "grass" });
        buckets.grass.push(instance);
        grassCount += 1;
      }
    } else if (species === "wetland") {
      const density = Math.max(sample.reedness, sample.mudness * 0.45, 0.12);
      if (treeCount < maxInstances && next() <= density) {
        const instance = enrichInstance({
          position,
          species: "wetland",
          scale: (0.7 + next() * 0.35) * vegetationScaleMultiplier(profile, "wetland"),
          phase: next(),
          ...copied,
        }, { profile, triangleIndex, kind: "reed" });
        buckets.wetland.push(instance);
        treeCount += 1;
      }
    } else if (species === "rock") {
      if (treeCount < maxInstances && next() <= 0.28) {
        const instance = enrichInstance({
          position,
          species: "rock",
          scale: (0.7 + next() * 0.4) * vegetationScaleMultiplier(profile, "rock"),
          phase: next(),
          ...copied,
        }, { profile, triangleIndex, kind: "rock" });
        buckets.rock.push(instance);
        treeCount += 1;
      }
    }
  }
  const instanceCount = ECOLOGY_BUCKETS.reduce((sum, species) => sum + buckets[species].length, 0);
  return {
    kind: "planet-vegetation-v9",
    profile,
    chartId,
    ecologySource: "ecology-v10",
    ecologyHash: ecology.hash || null,
    buckets,
    lodBuckets: rebuildLodBuckets(buckets),
    clusterSchema: "trunk/canopy/octa-impostor",
    instanceCount,
    maxInstances,
    keepoutCount: keepouts.length,
    scaleMultipliers: {},
  };
}

function wrapVegetationV8(options = {}) {
  const base = compileVegetationV8(options);
  const buckets = {};
  let index = 0;
  for (const [species, values] of Object.entries(base.buckets || {})) {
    buckets[species] = values.map((instance) => {
      const enriched = enrichInstance({
        ...instance,
        cellId: instance.cellId || null,
        ecologySource: "missing-ecology",
      }, { profile: options.profile, triangleIndex: index, kind: "tree" });
      index += 1;
      return enriched;
    });
  }
  return {
    ...base,
    kind: "planet-vegetation-v9",
    chartId: options.chartId || null,
    ecologySource: "missing-ecology",
    ecologyHash: null,
    buckets,
    lodBuckets: rebuildLodBuckets(buckets),
    clusterSchema: "trunk/canopy/octa-impostor",
  };
}

export function compileVegetationV9(options = {}) {
  if (options.ecology && options.grid?.dual) return compileVegetationFromEcology(options);
  return wrapVegetationV8(options);
}

export function vegetationInstanceHash(compiled, { excludeCellIds = [] } = {}) {
  const exclude = new Set(excludeCellIds);
  const tokens = [];
  for (const instances of Object.values(compiled?.buckets || {})) {
    for (const instance of instances) {
      if (exclude.has(instance.cellId)) continue;
      tokens.push(instance.instanceId);
    }
  }
  return tokens.sort().join("|");
}

export function mergeVegetationChunks(previousByChart = [], nextByChart = [], dirtyCellIds = []) {
  const dirty = new Set(dirtyCellIds);
  return nextByChart.map((next, index) => {
    const previous = previousByChart[index];
    if (!previous || dirty.size === 0) return next;
    const speciesNames = new Set([
      ...Object.keys(previous.buckets || {}),
      ...Object.keys(next.buckets || {}),
    ]);
    const buckets = {};
    for (const species of speciesNames) {
      buckets[species] = [
        ...(previous.buckets?.[species] || []).filter((instance) => !dirty.has(instance.cellId)),
        ...(next.buckets?.[species] || []).filter((instance) => dirty.has(instance.cellId)),
      ];
    }
    const instanceCount = Object.values(buckets).reduce((sum, list) => sum + list.length, 0);
    return {
      ...next,
      buckets,
      lodBuckets: rebuildLodBuckets(buckets),
      instanceCount,
    };
  });
}
