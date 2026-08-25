// =====================================================================
//  九类调试层：只读快照，稳定 ID，不改变算法结果（G9）
// =====================================================================

export const DEBUG_LAYER_IDS = Object.freeze([
  "grid-main-dual",
  "terrain-passes",
  "uv",
  "modules",
  "navigation",
  "agents",
  "combat",
  "performance",
  "half-edge",
]);

export function snapshotDebugLayers(v4, extras = {}) {
  const topo = v4.topo;
  const layers = {
    "grid-main-dual": {
      mainFaces: topo.halfEdge.faces.map((f) => f.id),
      dualVertices: topo.dual.vertices.map((v) => v.id),
    },
    "half-edge": {
      boundaryHe: topo.report.boundaryHe,
      nonManifold: topo.report.nonManifold,
    },
    "terrain-passes": v4.terrain?.log || [],
    uv: v4.uv?.stats || {},
    modules: {
      fallback: v4.town?.fallbackCount ?? 0,
      gates: v4.town?.gateLocks ?? 0,
      backtracks: v4.town?.backtracks ?? extras.solver?.backtracks ?? 0,
      contradiction: v4.town?.contradiction ?? 0,
    },
    navigation: {
      nodes: v4.graph?.nodes.size ?? 0,
      edges: v4.graph?.edges.size ?? 0,
    },
    agents: (extras.agents || []).map((a) => ({
      id: a.id,
      intent: a.intent.name,
      surfaceId: a.path.currentSurfaceId,
    })),
    combat: extras.combatEvents || [],
    performance: extras.performance || {},
  };
  return { layers, ids: DEBUG_LAYER_IDS, mixedState: extras.mixedState || null };
}
