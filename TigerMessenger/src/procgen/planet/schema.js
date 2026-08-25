// =====================================================================
// Planet V8 versioned data contracts.  These objects stay Three-free so
// generation can run in Node or a browser Worker and be hashed/migrated.
// =====================================================================

export const PLANET_GRAPH_SCHEMA_VERSION = 1;
export const TERRAIN_TILESET_VERSION = "terrain-tiles-v8.1";
export const PLANET_FIELD_VERSION = "planet-field-v8.1";
export const CURVED_WATER_VERSION = "curved-water-v8.1";
export const CLOUD_ATLAS_VERSION = "cloud-atlas-v8.1";
export const WORLD_SNAPSHOT_VERSION = 8;

export const TERRAIN_SEMANTICS = Object.freeze([
  "ocean-deep", "ocean-shelf", "coast", "grass", "hill", "ridge",
  "cliff", "canyon", "lake", "wetland", "mud", "forest-edge",
  "forest-core", "snow", "foundation", "road", "waterfall",
]);

export function assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

export function assertVec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((n) => !Number.isFinite(n))) {
    throw new Error(`${label} must be a finite vec3`);
  }
  return value.slice();
}

export function createPlanetVersionManifest(overrides = {}) {
  return Object.freeze({
    graph: PLANET_GRAPH_SCHEMA_VERSION,
    tiles: TERRAIN_TILESET_VERSION,
    field: PLANET_FIELD_VERSION,
    water: CURVED_WATER_VERSION,
    clouds: CLOUD_ATLAS_VERSION,
    snapshot: WORLD_SNAPSHOT_VERSION,
    ...overrides,
  });
}

export function validatePlanetSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || snapshot.version !== WORLD_SNAPSHOT_VERSION) errors.push("version");
  if (!Number.isInteger(snapshot?.seed)) errors.push("seed");
  for (const key of ["graph", "land", "water", "nav", "vegetation", "clouds", "versions"]) {
    if (!snapshot?.[key] || typeof snapshot[key] !== "object") errors.push(key);
  }
  return { ok: errors.length === 0, errors };
}

export function createEmptyPlanetSnapshot({ seed = 0, versions = createPlanetVersionManifest() } = {}) {
  return {
    version: WORLD_SNAPSHOT_VERSION,
    seed: seed >>> 0,
    graph: { mainHash: null, dualHash: null, landmarkPins: [], terrainEdges: [] },
    land: { chunkManifest: [], meshHash: null, semanticHash: null, biomeStats: {} },
    water: { oceanLevel: 0, lakeBasins: [], shorelineHash: null, routeHash: null },
    nav: { surfaceHash: null, portalHash: null, routeHash: null },
    vegetation: { clusterHash: null, instanceCounts: {} },
    clouds: { atlasVersion: versions.clouds, clusterHash: null, climateHash: null, heroHash: null, heroCount: 0, instanceCount: 0 },
    versions,
  };
}
