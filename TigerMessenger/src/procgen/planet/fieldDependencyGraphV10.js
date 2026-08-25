// =====================================================================
// V10 field dependency graph (G21-A, DeepSeek data layer).
//
// Freezes the one-directional pipeline from PLAN 12.30.2:
//   terrain → hydrology → climate → { cloud, ecology }
// and explicitly rejects the forbidden reverse edge
//   cloud-renderer → ecology
// (runtime cloud instances must never feed the ecosystem back, otherwise
// per-frame cloud animation would change tree density non-deterministically).
// Pure data code: cycle detection and edge policy only.
// =====================================================================

export const FIELD_DEPENDENCY_GRAPH_VERSION = "fieldDependencyGraphV10";

export const FIELD_DEPENDENCY_GRAPH_V10 = Object.freeze({
  version: FIELD_DEPENDENCY_GRAPH_VERSION,
  nodes: Object.freeze(["terrain", "hydrology", "climate", "cloud", "ecology"]),
  edges: Object.freeze([
    Object.freeze({ from: "terrain", to: "hydrology" }),
    Object.freeze({ from: "hydrology", to: "climate" }),
    Object.freeze({ from: "climate", to: "cloud" }),
    Object.freeze({ from: "climate", to: "ecology" }),
  ]),
  forbiddenEdges: Object.freeze([
    Object.freeze({ from: "cloud", to: "ecology" }),
    Object.freeze({ from: "cloud", to: "terrain" }),
    Object.freeze({ from: "cloud", to: "hydrology" }),
    Object.freeze({ from: "cloud", to: "climate" }),
    Object.freeze({ from: "ecology", to: "climate" }),
    Object.freeze({ from: "ecology", to: "hydrology" }),
    Object.freeze({ from: "ecology", to: "terrain" }),
    Object.freeze({ from: "hydrology", to: "terrain" }),
  ]),
});

export function allowedDependencyEdgeV10(from, to, graph = FIELD_DEPENDENCY_GRAPH_V10) {
  return graph.edges.some((edge) => edge.from === from && edge.to === to);
}

export function validateDependencyGraphV10(graph = FIELD_DEPENDENCY_GRAPH_V10) {
  const errors = [];
  const nodes = new Set(graph.nodes || []);
  for (const expected of ["terrain", "hydrology", "climate", "cloud", "ecology"]) {
    if (!nodes.has(expected)) errors.push(`missing-node:${expected}`);
  }
  // DFS cycle detection over the edge list; unknown edges are rejected by
  // the strict frozen-edge policy below.
  const adjacency = new Map(nodes ? [...nodes].map((node) => [node, []]) : []);
  for (const edge of graph.edges || []) {
    if (!nodes.has(edge.from)) { errors.push(`unknown-edge-from:${edge.from}`); continue; }
    if (!nodes.has(edge.to)) { errors.push(`unknown-edge-to:${edge.to}`); continue; }
    if (!allowedDependencyEdgeV10(edge.from, edge.to, FIELD_DEPENDENCY_GRAPH_V10)) {
      // The graph is frozen: cloud→ecology, ecology→cloud and any other
      // non-frozen edge must be rejected, not merely cycles.
      errors.push(`edge-not-allowed:${edge.from}->${edge.to}`);
      continue;
    }
    adjacency.get(edge.from).push(edge.to);
  }
  const state = new Map([...nodes].map((node) => [node, 0])); // 0 unvisited, 1 in-stack, 2 done
  const stack = [];
  const visit = (node) => {
    state.set(node, 1);
    stack.push(node);
    for (const next of adjacency.get(node) || []) {
      if (state.get(next) === 1) {
        const cycle = [...stack.slice(stack.indexOf(next)), next].join("->");
        errors.push(`cycle:${cycle}`);
      } else if (state.get(next) === 0) visit(next);
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const node of nodes) if (state.get(node) === 0) visit(node);
  // Forbidden edges (explicitly reject cloud-renderer → ecology loops).
  for (const edge of graph.forbiddenEdges || []) {
    if (allowedDependencyEdgeV10(edge.from, edge.to, graph)) {
      errors.push(`forbidden-edge-allowed:${edge.from}->${edge.to}`);
    }
  }
  return { ok: errors.length === 0, errors, version: graph.version || FIELD_DEPENDENCY_GRAPH_VERSION, nodes: [...nodes] };
}

export function assertNoCloudEcologyFeedbackV10(graph = FIELD_DEPENDENCY_GRAPH_V10) {
  const report = validateDependencyGraphV10(graph);
  if (!report.ok) throw new Error(`field-dependency-graph-v10: ${report.errors.join("; ")}`);
  return report;
}
