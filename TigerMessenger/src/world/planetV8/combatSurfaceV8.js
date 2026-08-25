// Shared combat surface data. The legacy soldier state machine can consume
// this contract during migration; it never owns a second terrain height field.

function normalize(value) {
  const values = Array.isArray(value) ? value : [value?.x ?? 0, value?.y ?? 0, value?.z ?? 0];
  const length = Math.hypot(...values) || 1;
  return values.map((entry) => entry / length);
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function offsetDirection(direction, tangent, amount) {
  const base = normalize(direction);
  const projected = tangent.map((value, index) => value - base[index] * dot(base, tangent));
  const length = Math.hypot(...projected) || 1;
  return normalize(base.map((value, index) => value + projected[index] / length * amount));
}

export function compileCombatSurfaceV8({ manifest = [], surface, radius = 160 } = {}) {
  const zones = [];
  for (const landmark of manifest) {
    if (landmark.id !== "saihoji-moss-garden" && landmark.id !== "highland-citadel") continue;
    const center = normalize(landmark.direction);
    const height = surface?.field?.heightAt?.(center) ?? 0;
    const keepouts = [];
    for (const name of landmark.keepouts || []) {
      const tangent = landmark.forward || [1, 0, 0];
      const direction = name === "pine-grove" ? offsetDirection(center, tangent, 0.045) : center;
      keepouts.push({
        id: name,
        position: direction.map((value) => value * (radius + height)),
        radius: name === "pine-grove" ? landmark.angularRadius * radius * 0.25 : landmark.angularRadius * radius * 0.45,
        semantic: name === "battlefield" ? "combat-assembly" : "combat-keepout",
      });
    }
    zones.push({
      id: "combat:" + landmark.id,
      landmarkId: landmark.id,
      center,
      angularRadius: landmark.angularRadius,
      surfaceId: "planet-land:" + landmark.id,
      keepouts,
      retreat: landmark.hardLocks?.retreat || "nearest-portal",
      offSurfacePolicy: "reject-and-reproject",
    });
  }
  return { kind: "planet-combat-surface-v8", zones, hash: hashCombatZones(zones) };
}

export function projectCombatUnitToSurface(surface, unit, { zoneId = null, lift = 0.08 } = {}) {
  if (!surface?.sample || !unit?.position) return { ok: false, reason: "missing-surface-or-unit" };
  const position = Array.isArray(unit.position) ? unit.position : [unit.position.x, unit.position.y, unit.position.z];
  const hit = surface.sample(position);
  if (!hit || !hit.position) return { ok: false, reason: "surface-miss" };
  const normal = hit.normal || [0, 1, 0];
  const projected = hit.position.map((value, index) => value + normal[index] * lift);
  return {
    ok: true,
    zoneId,
    surfaceId: hit.surfaceId,
    isWater: !!hit.isWater,
    offSurface: false,
    position: projected,
    normal: normal.slice(),
  };
}

function hashCombatZones(zones) {
  let hash = 2166136261;
  for (const zone of zones) {
    for (const character of zone.id + ":" + zone.keepouts.map((keepout) => keepout.id).join(",")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
  }
  return "combat-surface-" + (hash >>> 0).toString(16).padStart(8, "0");
}
