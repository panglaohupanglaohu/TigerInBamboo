// V9 vegetation presentation schema.  V8 sampling remains the deterministic
// source; this pass adds the cluster/LOD payload consumed by InstancedMesh and
// impostor adapters without creating renderer objects in generation.

import { compileVegetationV8 } from "./vegetationCompilerV8.js";

function normalize(position) {
  const length = Math.hypot(...position) || 1;
  return position.map((value) => value / length);
}

function hashInstance(instance, index) {
  let hash = 2166136261;
  for (const character of `${instance.species}:${index}:${instance.position.join(",")}:${instance.phase}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `veg${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function compileVegetationV9(options = {}) {
  const base = compileVegetationV8(options);
  const buckets = {};
  const lodBuckets = { near: [], mid: [], far: [] };
  let index = 0;
  for (const [species, values] of Object.entries(base.buckets || {})) {
    buckets[species] = values.map((instance) => {
      const normal = normalize(instance.position || [0, 1, 0]);
      const enriched = {
        ...instance,
        instanceId: hashInstance(instance, index++),
        normal,
        windWeight: species === "rock" ? 0 : Math.max(0.05, Math.min(1, instance.phase ?? 0.5)),
        lodRange: species === "rock" ? [0, 120] : [0, 220],
        renderTier: species === "rock" ? "trunk" : "canopy",
        clusterId: `${options.profile || "default"}:${species}:${Math.floor(index / 6)}`,
      };
      lodBuckets.near.push(enriched);
      if (enriched.lodRange[1] >= 120) lodBuckets.mid.push(enriched);
      if (enriched.lodRange[1] >= 200) lodBuckets.far.push(enriched);
      return enriched;
    });
  }
  return {
    ...base,
    kind: "planet-vegetation-v9",
    buckets,
    lodBuckets,
    clusterSchema: "trunk/canopy/octa-impostor",
  };
}
