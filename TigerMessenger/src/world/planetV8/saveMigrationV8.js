// Save V3/V7 anchors without rejecting old saves.  Every migrated anchor
// retains its old value for rollback and emits a deterministic warning.

export function migrateAnchorToV8(anchor, surface, { landmarkId = null } = {}) {
  if (!anchor) return { ok: false, reason: "missing-anchor" };
  const old = JSON.parse(JSON.stringify(anchor));
  const position = anchor.position || anchor.worldPosition || [0, 0, 0];
  const projected = surface.project(position);
  return {
    ok: true,
    old,
    anchor: {
      surfaceId: projected.surfaceId,
      position: projected.position,
      normal: projected.normal,
      height: projected.height,
      landmarkId,
      localYaw: anchor.yaw ?? anchor.localYaw ?? 0,
    },
    warning: "anchor-migrated-to-planet-v8-surface",
  };
}

export function migrateSaveV3ToV8(save, surface, routes = []) {
  const migrated = { ...save, version: 8, previousVersion: save?.version ?? 3, migrationWarnings: [], migrationToasts: [], legacy: { version: save?.version ?? 3 } };
  if (save?.player) {
    const result = migrateAnchorToV8(save.player, surface, { landmarkId: save.player.landmarkId });
    if (result.ok) {
      migrated.player = result.anchor;
      migrated.migrationToasts.push({ kind: "surface-migration", message: "已将玩家迁移到新的合法地表", surfaceId: result.anchor.surfaceId });
    } else migrated.migrationWarnings.push(result.reason);
  }
  migrated.boats = (save?.boats || []).map((boat) => {
    if (!routes.length) {
      migrated.migrationToasts.push({ kind: "boat-dock", message: "旧航线已失效，船只停靠在最近港口", boatId: boat.id ?? null });
      return { ...boat, dockedAt: boat.dockedAt || "nearest-port", migratedFrom: "canal" };
    }
    const route = routes[Math.abs(Math.floor(boat.routeIndex || 0)) % routes.length];
    migrated.migrationToasts.push({ kind: "boat-route", message: "船只已迁移到新的曲面航线", boatId: boat.id ?? null, routeId: route.id });
    return { ...boat, routeId: route.id, u: Math.max(0, Math.min(1, boat.u || 0)), migratedFrom: "canal" };
  });
  migrated.migrationWarnings.push("save-v3-to-v8-complete");
  return migrated;
}
