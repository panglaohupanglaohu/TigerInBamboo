// Shared water meaning for shader, collision, wading, boats and minimap.

export const WATER_SEMANTICS = Object.freeze(["shallow-ocean", "deep-ocean", "shallow-lake", "deep-lake", "wetland", "shore"]);

export function classifyWaterSurface({ semantic = "ocean", depth = 1, wetland = false } = {}) {
  if (wetland || semantic === "wetland") return "wetland";
  if (semantic === "inland-water" || semantic === "lake" || semantic === "local-cistern") return depth < 0.55 ? "shallow-lake" : "deep-lake";
  return depth < 0.55 ? "shallow-ocean" : "deep-ocean";
}

export function createWaterSurfaceSemantics(water) {
  return {
    kind: "water-semantics-v8",
    ocean: { id: "water:ocean", semantic: classifyWaterSurface({ semantic: "ocean", depth: 1 }), navigable: true, wadeDepth: 0.2 },
    lakes: (water?.lakes || []).map((lake, index) => ({ id: `water:lake:${index}`, semantic: classifyWaterSurface({ semantic: lake.semantic, depth: lake.depth ?? 0.7, wetland: lake.semantic === "wetland" }), navigable: true, wadeDepth: 0.2 })),
    routes: (water?.routes || []).map((route) => ({ id: route.id, semantic: "deep-ocean", minWidth: route.minWidth, maxDraft: route.maxDraft, navigable: true })),
  };
}

export function validateWaterSurfaceSemantics(semantics) {
  const errors = [];
  if (!WATER_SEMANTICS.includes(semantics?.ocean?.semantic)) errors.push("ocean-semantic");
  for (const lake of semantics?.lakes || []) if (!WATER_SEMANTICS.includes(lake.semantic)) errors.push(`lake-semantic:${lake.id}`);
  for (const route of semantics?.routes || []) if (!route.navigable || !Number.isFinite(route.maxDraft)) errors.push(`route:${route.id}`);
  return { ok: errors.length === 0, errors };
}
