// Optional V8 player/rider projection. It is intentionally independent from
// combat and building-floor logic; callers enable it only after choosing the
// V8 terrain flag.

function asArray(value) {
  return Array.isArray(value) ? value : [value?.x ?? 0, value?.y ?? 0, value?.z ?? 0];
}

export function projectObjectToPlanetSurface(provider, object, { lift = 0.18, allowWater = true } = {}) {
  if (!provider?.sample || !object?.position) return { ok: false, reason: "missing-provider-or-object" };
  const hit = provider.sample(asArray(object.position));
  if (!hit || (!allowWater && hit.isWater)) return { ok: false, reason: hit?.isWater ? "water-disallowed" : "no-surface", hit };
  const point = asArray(hit.point || hit.position);
  const normal = asArray(hit.normal || hit.position);
  const length = Math.hypot(...normal) || 1;
  const projected = point.map((value, index) => value + normal[index] / length * lift);
  if (typeof object.position.set === "function") object.position.set(...projected);
  else object.position = projected;
  return { ok: true, hit, position: projected };
}

// Same projection contract for an Object3D that may be parented under a boat,
// cohort, or combat root. The provider owns the world-space sample; the
// adapter converts the result back to the object's local parent space.
export function projectWorldObjectToPlanetSurface(provider, object, { lift = 0.08, allowWater = false } = {}) {
  if (!provider?.sample || !object?.position) return { ok: false, reason: "missing-provider-or-object" };
  const world = object.position.clone?.() || { x: object.position.x ?? 0, y: object.position.y ?? 0, z: object.position.z ?? 0 };
  object.getWorldPosition?.(world);
  const sample = provider.sample([world.x ?? 0, world.y ?? 0, world.z ?? 0]);
  if (!sample || (!allowWater && sample.isWater)) {
    return { ok: false, reason: sample?.isWater ? "water-disallowed" : "no-surface", hit: sample };
  }
  const point = asArray(sample.point || sample.position);
  const normal = asArray(sample.normal || sample.position);
  const length = Math.hypot(...normal) || 1;
  const projected = point.map((value, index) => value + normal[index] / length * lift);
  if (object.parent?.worldToLocal && object.position.clone && object.position.copy) {
    const local = object.position.clone();
    local.set(...projected);
    object.parent.worldToLocal(local);
    object.position.copy(local);
  } else if (typeof object.position.set === "function") {
    object.position.set(...projected);
  } else {
    object.position = projected;
  }
  return { ok: true, hit: sample, position: projected };
}
