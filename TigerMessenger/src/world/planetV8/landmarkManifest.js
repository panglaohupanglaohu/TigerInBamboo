// =====================================================================
// Stable landmark contract for the spherical world.  Positions are angular
// directions, never legacy flat x/z values, so resizing the planet does not
// move the hard locks.  The values are intentionally art-directed anchors.
// =====================================================================

import { createStableRng } from "../../procgen/core/stableRng.js";
import { compileLandformChain, LANDFORM_CHAIN_VERSION, landformChainHash } from "../../procgen/planet/landformChainV8.js";

export const LANDMARK_IDS = Object.freeze([
  "highland-citadel", "crystal-canyon", "saihoji-moss-garden",
  "swamp-lake", "bookshop-town", "triple-gate", "old-harbor",
  "moon-lake", "white-whale-lake", "navona-water-court",
]);

const vec = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

export const DEFAULT_LANDMARK_MANIFEST = Object.freeze([
  { id: "highland-citadel", direction: vec(0.15, 0.83, -0.54), angularRadius: 0.18, forward: vec(0.1, 0, 1), profile: "highland-citadel", routeAnchors: ["terrace-1", "terrace-5", "waterfall-1"], keepouts: ["wood-horse", "waterfall-1"], waterNeeds: "lower-waterfall-basin", cameraKeepouts: ["citadel-panorama"], heroCloud: "highlandCitadel" },
  { id: "crystal-canyon", direction: vec(-0.68, 0.55, 0.48), angularRadius: 0.14, forward: vec(1, 0, 0), profile: "crystal-canyon", routeAnchors: ["canyon-mouth", "canyon-floor", "canyon-saddle"], keepouts: ["tram-corridor"], waterNeeds: "canyon-stream", cameraKeepouts: ["crystal-canyon-wide"] },
  { id: "saihoji-moss-garden", direction: vec(0.55, 0.69, -0.46), angularRadius: 0.12, forward: vec(-0.4, 0, 0.9), profile: "saihoji-hills", routeAnchors: ["moss-entry", "master-stones", "pine-grove"], keepouts: ["battlefield", "pine-grove"], waterNeeds: "moss-wetland", cameraKeepouts: ["saihoji-battle"] },
  { id: "swamp-lake", direction: vec(-0.3, 0.76, -0.58), angularRadius: 0.13, forward: vec(-1, 0, 0), profile: "swamp-lake", routeAnchors: ["swamp-shore", "swamp-islet"], keepouts: ["special-event"], waterNeeds: "closed-lake-basin", cameraKeepouts: ["swamp-overview"] },
  { id: "bookshop-town", direction: vec(0.77, 0.58, 0.25), angularRadius: 0.10, forward: vec(-0.8, 0, 0.4), profile: "bookshop-hill-chain", routeAnchors: ["bookshop-door", "hill-saddle"], keepouts: ["bookshop-door"], waterNeeds: "none", cameraKeepouts: ["bookshop-town"] },
  { id: "triple-gate", direction: vec(-0.46, 0.88, 0.09), angularRadius: 0.08, forward: vec(0, 0, 1), profile: "triple-gate-highland", routeAnchors: ["gate-mouth", "gate-saddle"], keepouts: ["gate-bird-corridor"], waterNeeds: "none", cameraKeepouts: ["triple-gate"] },
  { id: "old-harbor", direction: vec(0.92, 0.34, -0.16), angularRadius: 0.10, forward: vec(0, 0, 1), profile: "coastal-harbor-citadel", routeAnchors: ["harbor-mouth"], keepouts: ["harbor-basin"], waterNeeds: "coast", cameraKeepouts: ["old-harbor"] },
  { id: "moon-lake", direction: vec(0.25, 0.94, 0.23), angularRadius: 0.055, forward: vec(1, 0, 0), profile: "curved-lake", routeAnchors: ["moon-lake-shore"], keepouts: ["lake-interior"], waterNeeds: "closed-lake-basin", cameraKeepouts: ["moon-lake"] },
  { id: "white-whale-lake", direction: vec(-0.82, 0.48, 0.27), angularRadius: 0.07, forward: vec(0, 0, 1), profile: "curved-lake", routeAnchors: ["whale-lake-shore"], keepouts: ["lake-interior"], waterNeeds: "closed-lake-basin", cameraKeepouts: ["whale-lake"] },
  { id: "navona-water-court", direction: vec(0.13, 0.91, 0.39), angularRadius: 0.035, forward: vec(1, 0, 0), profile: "navona-water-court", routeAnchors: ["court-fountain"], keepouts: ["court-water"], waterNeeds: "local-cistern", cameraKeepouts: ["navona-court"] },
]);

function cloneManifest(manifest) {
  return manifest.map((entry) => ({ ...entry, direction: entry.direction.slice(), routeAnchors: [...entry.routeAnchors], keepouts: [...entry.keepouts], cameraKeepouts: [...entry.cameraKeepouts], hardLocks: entry.hardLocks ? JSON.parse(JSON.stringify(entry.hardLocks)) : null }));
}

function hardLocksFor(id) {
  if (id === "highland-citadel") return { terraces: [1, 2, 3, 4, 5], waterfalls: ["waterfall-1", "waterfall-2", "waterfall-3", "waterfall-4"], horse: { surface: "lower-waterfall-basin", heading: "canal" }, portals: ["stairs-1-2", "stairs-2-3", "stairs-3-4", "stairs-4-5"] };
  if (id === "crystal-canyon") return { corridor: ["canyon-mouth", "canyon-floor", "canyon-saddle"], keepout: ["tram", "sighing-gate"] };
  if (id === "saihoji-moss-garden") return { battleWidth: 18, pineGrove: "pine-grove", assembly: "battlefield", retreat: "southwest" };
  if (id === "triple-gate") return { highGround: true, saddle: "gate-saddle", birdCorridor: "gate-bird-corridor" };
  return null;
}

export function createLandmarkManifest({ entries = DEFAULT_LANDMARK_MANIFEST, seed = 1 } = {}) {
  const result = cloneManifest(entries);
  const ids = new Set();
  for (const entry of result) {
    if (!LANDMARK_IDS.includes(entry.id)) throw new Error(`unknown landmark id: ${entry.id}`);
    if (ids.has(entry.id)) throw new Error(`duplicate landmark id: ${entry.id}`);
    ids.add(entry.id);
    if (!Array.isArray(entry.direction) || entry.direction.length !== 3) throw new Error(`invalid direction: ${entry.id}`);
    if (!(entry.angularRadius > 0 && entry.angularRadius < Math.PI)) throw new Error(`invalid angular radius: ${entry.id}`);
  }
  const rng = createStableRng(seed, "landmark-manifest");
  // Stable, bounded micro-jitter changes only non-hard visual orientation;
  // direction, IDs and hard route anchors remain reproducible.
  for (const entry of result) {
    entry.visualPhase = rng.next();
    entry.hardLocks = entry.hardLocks || hardLocksFor(entry.id);
  }
  return Object.freeze(result.map((entry) => Object.freeze(entry)));
}

// Opt-in continuous geography.  Legacy callers keep the original directions
// and profile IDs; V8 chain callers get a versioned, migratable manifest.
export function createContinuousLandformManifest({ entries = DEFAULT_LANDMARK_MANIFEST, seed = 1, anchor, terminal } = {}) {
  const base = createLandmarkManifest({ entries, seed });
  const chain = compileLandformChain({ anchor, terminal, seed, baseEntries: base });
  const byId = new Map(chain.map((entry) => [entry.id, entry]));
  const result = base.map((entry) => {
    const chainEntry = byId.get(entry.id);
    return chainEntry ? { ...entry, ...chainEntry, routeAnchors: entry.routeAnchors.slice(), keepouts: entry.keepouts.slice(), cameraKeepouts: entry.cameraKeepouts.slice(), hardLocks: entry.hardLocks ? JSON.parse(JSON.stringify(entry.hardLocks)) : null } : entry;
  });
  const chainIds = new Set(chain.map((entry) => entry.id));
  const ordered = [...result.filter((entry) => chainIds.has(entry.id)).sort((a, b) => a.chainOrder - b.chainOrder), ...result.filter((entry) => !chainIds.has(entry.id))];
  return Object.freeze(ordered.map((entry) => Object.freeze({ ...entry, chainVersion: LANDFORM_CHAIN_VERSION, landformChainHash: landformChainHash(chain) })));
}

export function validateLandmarkManifest(manifest) {
  const errors = [];
  const ids = new Set();
  for (const entry of manifest || []) {
    if (!entry?.id) errors.push("missing-id");
    if (ids.has(entry.id)) errors.push(`duplicate-id:${entry.id}`);
    ids.add(entry.id);
    if (!Array.isArray(entry.direction) || entry.direction.length !== 3) errors.push(`direction:${entry.id}`);
    if (!(entry.angularRadius > 0)) errors.push(`angular-radius:${entry.id}`);
    if (!entry.profile) errors.push(`profile:${entry.id}`);
    if (!entry.routeAnchors?.length) errors.push(`route-anchors:${entry.id}`);
    if (entry.hardLocks?.terraces && entry.hardLocks.terraces.length !== 5) errors.push(`terrace-locks:${entry.id}`);
    if (entry.hardLocks?.corridor && entry.hardLocks.corridor.length < 2) errors.push(`corridor-locks:${entry.id}`);
    if (entry.chainVersion && entry.chainVersion !== LANDFORM_CHAIN_VERSION) errors.push(`chain-version:${entry.id}`);
    if (entry.chainOrder != null && (!Number.isInteger(entry.chainOrder) || entry.chainOrder < 0)) errors.push(`chain-order:${entry.id}`);
  }
  const byId = new Map((manifest || []).map((entry) => [entry.id, entry]));
  const overlapPairs = [];
  for (let i = 0; i < manifest.length; i++) for (let j = i + 1; j < manifest.length; j++) {
    const a = manifest[i]; const b = manifest[j];
    const dot = a.direction.reduce((sum, v, k) => sum + v * b.direction[k], 0);
    const distance = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (distance < Math.min(a.angularRadius, b.angularRadius) * 0.2) overlapPairs.push([a.id, b.id]);
  }
  if (overlapPairs.length) errors.push(`angular-overlap:${overlapPairs.map((pair) => pair.join("/" )).join(",")}`);
  for (const id of ["highland-citadel", "crystal-canyon", "saihoji-moss-garden", "swamp-lake", "bookshop-town", "triple-gate"]) {
    if (!byId.has(id)) errors.push(`missing-required:${id}`);
  }
  return { ok: errors.length === 0, errors, count: manifest?.length || 0 };
}

export function landmarkManifestHash(manifest = DEFAULT_LANDMARK_MANIFEST) {
  const canonical = manifest.map((entry) => ({ id: entry.id, direction: entry.direction, angularRadius: entry.angularRadius, profile: entry.profile, routeAnchors: entry.routeAnchors, hardLocks: entry.hardLocks })).sort((a, b) => a.id.localeCompare(b.id));
  let hash = 2166136261;
  for (const character of JSON.stringify(canonical)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `lm${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
