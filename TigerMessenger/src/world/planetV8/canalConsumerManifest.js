// Migration inventory for the former global canal.  Keeping this as data
// makes retirement auditable: every consumer names its adapter and the gate
// that permits deletion of the legacy path.

export const CANAL_CONSUMERS = Object.freeze([
  { id: "quest-anchors", consumer: "quest", adapter: "saveMigrationV8.anchor", deleteWhen: "quest-anchor-v8-regression" },
  { id: "tram-route", consumer: "tram", adapter: "waterRouteGraph.route-or-tram-nav", deleteWhen: "tram-surface-v8" },
  { id: "boat-fleet", consumer: "boat", adapter: "waterRouteFleet", deleteWhen: "boat-route-v8" },
  { id: "harbor-logistics", consumer: "harbor", adapter: "waterRouteFleet.assignBoat", deleteWhen: "harbor-logistics-v8" },
  { id: "combat-reinforcement", consumer: "combat", adapter: "waterRouteFleet.directionFor", deleteWhen: "siege-route-v8" },
  { id: "camera-keepouts", consumer: "camera", adapter: "landmarkManifest.cameraKeepouts", deleteWhen: "camera-manifest-v8" },
  { id: "minimap", consumer: "map", adapter: "planetSnapshot.water.routes", deleteWhen: "minimap-v8" },
]);

export function validateCanalConsumerManifest(consumers = CANAL_CONSUMERS) {
  const errors = [];
  const ids = new Set();
  for (const consumer of consumers) {
    if (!consumer.id || ids.has(consumer.id)) errors.push(`consumer-id:${consumer.id || "missing"}`);
    ids.add(consumer.id);
    for (const key of ["consumer", "adapter", "deleteWhen"]) if (!consumer[key]) errors.push(`${key}:${consumer.id}`);
  }
  return { ok: errors.length === 0, errors, count: consumers.length };
}

