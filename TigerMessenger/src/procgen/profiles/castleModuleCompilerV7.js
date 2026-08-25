// ============================================================================
// V7 profile compiler: one data-only entry point for the three castle families.
// 2D WFC fills footprint/banks, 3D WFC fills vertical structure, and the
// WFC→field→MC bridge owns terrain/foundation surfaces.  No renderer or
// random fallback is allowed here; a failed phase is returned as a report.
// ============================================================================

import { createModuleCatalog } from "../../world/citadel/moduleCatalog.js";
import { buildCastleModuleSets } from "../wfc/moduleSets.js";
import { createRectGrid2D } from "../graph/rectGrid2d.js";
import { createVoxelGrid3D } from "../graph/voxelGrid3d.js";
import { createSimpleTiledModel, solveSimpleTiled } from "../wfc/simpleTiledModel.js";
import { createVoxelModuleModel, solveVoxelModel } from "../wfc/voxelModel3d.js";
import { compileWfcSurface } from "../bridge/wfcFieldBridge.js";
import { createCastleProfile } from "./castleProfiles.js";

const PROFILE_ALIASES = Object.freeze({ ancient: "ancient", "ancient-fortress": "ancient", canal: "canal", "canal-citadel": "canal", highland: "highland", "highland-citadel": "highland" });

function canonicalKind(kind) {
  const value = PROFILE_ALIASES[kind];
  if (!value) throw new Error(`unknown V7 castle module profile: ${kind}`);
  return value;
}

function structuralPrototype(id, family, weight = 1) {
  const face = (portal = family) => ({ connector: "stack", parity: "symmetric", walkable: true, support: 1, portal });
  return { id, family, weight, orientationGroup: "NONE", tags: [family, "surface-owned"], faces: { N: face(), E: face(), S: face(), W: face(), U: face("floor-portal"), D: face("support") } };
}

function structuralSet(kind) {
  const families = kind === "highland"
    ? ["foundation", "floor", "tower", "balcony", "support", "stairs", "bridge", "roof", "waterfall-gap"]
    : kind === "ancient"
      ? ["wall", "corner", "tower", "gate", "floor", "support", "stairs", "bridge", "roof", "damage-pin"]
      : ["bank", "bridge", "pier", "water-gate", "balcony", "support", "stairs", "roof", "dock"];
  return families.map((family, index) => structuralPrototype(`${kind}.${family}`, family, 1 + index * 0.01));
}

function twoDPrototypes(kind, sets) {
  // The legacy catalog supplies the actual Townscaper family choices.  WFC
  // only sees horizontal sockets in this phase; U/D are consumed by 3D WFC.
  const source = sets[kind].prototypes;
  return source.map((prototype) => ({
    ...prototype,
    faces: Object.fromEntries(["N", "E", "S", "W"].map((direction) => [direction, prototype.faces[direction]])),
  }));
}

function recipeFor(kind) {
  if (kind === "highland") return ["mountain", "terrace-shoulder", "cliff", "lake-shore", "waterfall-gap", "foundation-collar"];
  if (kind === "ancient") return ["rock-base", "moat-slope", "trench", "damage-subtract", "tunnel-collar", "foundation-collar"];
  return ["river-bank", "island-base", "bridge-abutment", "water-gate", "canal-foundation", "foundation-collar"];
}

function keepoutsFor(kind, plan) {
  if (kind === "highland") return [{ id: "wood-horse:l1-basin", kind: "wood-horse", surfaceId: "lower-waterfall-basin", radius: 3.2 }, ...(plan.anchorIds || []).filter((id) => id.includes("waterfall") || id.includes("harbor")).map((id) => ({ id, kind: "hard-anchor" }))];
  if (kind === "ancient") return plan.damagePins.map((pin) => ({ id: `damage:${pin.id}`, kind: "damage-pin", position: pin.at || null }));
  return plan.bridges.map((bridge) => ({ id: bridge.id, kind: "bridge-clearance", clearance: bridge.clearance, waterRoute: bridge.waterRoute }));
}

export function compileCastleProfileV7({ kind, seed = 1, width = 4, height = 4, depth = 2 } = {}) {
  const canonical = canonicalKind(kind);
  const profileId = canonical === "highland" ? "highland-citadel" : canonical === "ancient" ? "ancient-fortress" : "canal-citadel";
  const profile = createCastleProfile(profileId, { seed, skipOuterTerrain: true });
  const catalog = createModuleCatalog();
  const sets = buildCastleModuleSets(catalog.modules);
  const horizontalGraph = createRectGrid2D({ width, height });
  const horizontalModel = createSimpleTiledModel({ prototypes: twoDPrototypes(canonical, sets), graph: horizontalGraph });
  const horizontal = solveSimpleTiled({ model: horizontalModel, seed, maxBacktrack: 64 });
  if (!horizontal.ok) return { ok: false, stage: "wfc-2d", profileId, profile, horizontal, recipe: recipeFor(canonical) };

  const verticalGraph = createVoxelGrid3D({ width: Math.max(2, Math.min(3, width - 1)), height: Math.max(2, Math.min(3, depth + 1)), depth: Math.max(2, Math.min(3, height - 1)) });
  const verticalModel = createVoxelModuleModel({ prototypes: structuralSet(canonical), graph: verticalGraph });
  const vertical = solveVoxelModel({ model: verticalModel, seed, maxBacktrack: 64 });
  if (!vertical.ok) return { ok: false, stage: "wfc-3d", profileId, profile, horizontal, vertical, recipe: recipeFor(canonical) };
  const surface = compileWfcSurface({
    graph: verticalGraph,
    result: vertical,
    compiled: verticalModel.compiled,
    occupied: () => true,
    semanticOf: ({ variant }) => variant?.family || "foundation",
  });
  if (!surface.ok) return { ok: false, stage: "mc", profileId, profile, horizontal, vertical, surface, recipe: recipeFor(canonical) };
  const plan = profile.routePlan;
  const routes = plan.routes || (plan.route ? [plan.route] : []);
  const routeErrors = routes.flatMap((route) => (route.edges || []).filter((edge) => edge.kind === "air").map((edge) => `${route.id}:air:${edge.id}`));
  return {
    ok: routeErrors.length === 0,
    stage: routeErrors.length ? "route" : "complete",
    profileId,
    profile,
    horizontal: { ...horizontal, model: horizontalModel, graph: horizontalGraph },
    vertical: { ...vertical, model: verticalModel, graph: verticalGraph },
    surface,
    recipe: recipeFor(canonical),
    keepouts: keepoutsFor(canonical, plan),
    routes,
    routeErrors,
    sourceContract: { field: "wfc-field-mc-v7", surface: "wfc-field-mc-v7", collision: "wfc-field-mc-v7", nav: "hard-route-plan-v1" },
  };
}

export function validateCastleProfileV7(compiled) {
  const errors = [];
  if (!compiled?.ok) errors.push(`compile:${compiled?.stage || "unknown"}`);
  if (!compiled?.horizontal?.solutionHash && !compiled?.horizontal?.solution?.solutionHash) errors.push("missing-2d-solution-hash");
  if (!compiled?.vertical?.solutionHash && !compiled?.vertical?.solution?.solutionHash) errors.push("missing-3d-solution-hash");
  if (!compiled?.surface?.mesh?.stats || compiled.surface.mesh.stats.degenerateTriangles !== 0) errors.push("mc-degenerate");
  if (compiled?.sourceContract?.field !== compiled?.sourceContract?.surface || compiled?.sourceContract?.surface !== compiled?.sourceContract?.collision) errors.push("mixed-surface-source");
  return { ok: errors.length === 0, errors };
}

export function compileCastleProfileMatrix({ kind, seeds = [1, 7, 42, 884], ...options } = {}) {
  const results = seeds.map((seed) => compileCastleProfileV7({ kind, seed, ...options }));
  return { kind: canonicalKind(kind), seeds: results.map((result, index) => ({ seed: seeds[index], ok: result.ok, stage: result.stage, horizontal: result.horizontal?.stats || null, vertical: result.vertical?.stats || null, triangles: result.surface?.mesh?.stats?.triangleCount || 0 })), ok: results.every((result) => result.ok) };
}
