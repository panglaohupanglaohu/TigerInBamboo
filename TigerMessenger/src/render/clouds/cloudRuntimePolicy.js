// Runtime policy keeps cloud shadows and LOD cheap and deterministic.

export function cloudLodForDistance(distance, { near = 45, far = 150 } = {}) {
  if (distance <= near) return "cluster-detail";
  if (distance <= far) return "octa-impostor";
  return "weather-band";
}

export function createCloudShadowProjection({ resolution = 256, cascades = 1, strength = 0.18 } = {}) {
  return { kind: "cloud-shadow-projection-v8", resolution, cascades, strength, perInstanceShadowMap: false };
}

export function validateCloudRuntimePolicy(policy) {
  const errors = [];
  if (policy?.perInstanceShadowMap) errors.push("per-instance-shadow-map");
  if (!(policy?.resolution > 0)) errors.push("shadow-resolution");
  return { ok: errors.length === 0, errors };
}
