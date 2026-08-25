// Data-only vegetation compiler.  Runtime adapters can put each bucket into
// an InstancedMesh; the generator never creates a mesh or a per-tree object.

import { sampleForestInstances } from "./terrainSemanticBake.js";

const PROFILE_BUCKETS = Object.freeze({
  "saihoji-hills": ["pine", "broadleaf"],
  "saihoji-plain": ["pine", "broadleaf"],
  "swamp-lake": ["wetland", "broadleaf"],
  "swamp-rift-lake": ["wetland", "broadleaf"],
  "highland-citadel": ["pine", "rock"],
  "highland-snow-massif": ["pine", "rock"],
  "bookshop-hill-chain": ["broadleaf", "pine"],
  "bookshop-auckland-hills": ["broadleaf", "pine"],
  default: ["broadleaf"],
});

const PROFILE_SCALE_MULTIPLIERS = Object.freeze({
  // Saihoji's ancient pine grove is an authored landmark: its volume is
  // three times the ordinary forest proxy, while placement still comes from
  // final-surface barycentric sampling and forestness.
  "saihoji-hills": Object.freeze({ pine: 3 }),
  "saihoji-plain": Object.freeze({ pine: 3 }),
});

export function vegetationScaleMultiplier(profile, species) {
  return PROFILE_SCALE_MULTIPLIERS[profile]?.[species] ?? 1;
}

export function compileVegetationV8({ triangles = [], profile = "default", seed = 1, keepouts = [], maxInstances = 2000 } = {}) {
  const buckets = new Map((PROFILE_BUCKETS[profile] || PROFILE_BUCKETS.default).map((species) => [species, []]));
  const instances = sampleForestInstances({ triangles, seed, keepouts, maxInstances });
  for (const instance of instances) {
    const species = buckets.has(instance.species) ? instance.species : [...buckets.keys()][0];
    buckets.get(species).push({
      ...instance,
      species,
      scale: instance.scale * vegetationScaleMultiplier(profile, species),
    });
  }
  return {
    kind: "planet-vegetation-v8",
    profile,
    buckets: Object.fromEntries([...buckets].map(([species, values]) => [species, values])),
    instanceCount: instances.length,
    maxInstances,
    keepoutCount: keepouts.length,
    scaleMultipliers: PROFILE_SCALE_MULTIPLIERS[profile] || {},
  };
}

export function validateVegetationKeepouts(compiled, keepouts = []) {
  const errors = [];
  for (const [species, instances] of Object.entries(compiled?.buckets || {})) for (const instance of instances) {
    for (const keepout of keepouts) if (keepout.position && Math.hypot(...instance.position.map((value, index) => value - keepout.position[index])) < (keepout.radius || 0)) errors.push(`${species}:keepout`);
  }
  return { ok: errors.length === 0, errors };
}
