// Deterministic seam diagnostics for independently meshed charts.  Charts
// are allowed to have different local vertex ordering, but the canonical
// quantized world edge key must resolve to one position/normal/semantic.

function quantize(value, epsilon) { return Math.round(value / epsilon); }

export function canonicalBoundaryVertexKey(position, epsilon = 1e-5) {
  return position.map((value) => quantize(value, epsilon)).join(":");
}

export function canonicalBoundaryEdgeKey(a, b, epsilon = 1e-5) {
  const ka = canonicalBoundaryVertexKey(a, epsilon);
  const kb = canonicalBoundaryVertexKey(b, epsilon);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function normalError(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

export function validateChartSeams(meshes = [], { epsilon = 1e-5, normalTolerance = 1e-5 } = {}) {
  const seen = new Map();
  const errors = [];
  for (const mesh of meshes) {
    const positions = mesh?.positions || [];
    const normals = mesh?.normals || [];
    const semantics = mesh?.semantics || null;
    for (let i = 0; i < positions.length; i += 3) {
      const position = [positions[i], positions[i + 1], positions[i + 2]];
      const key = canonicalBoundaryVertexKey(position, epsilon);
      const normal = normals.length >= i + 3 ? [normals[i], normals[i + 1], normals[i + 2]] : null;
      const semantic = semantics?.[i / 3] ?? null;
      const previous = seen.get(key);
      if (previous) {
        const positionError = Math.hypot(position[0] - previous.position[0], position[1] - previous.position[1], position[2] - previous.position[2]);
        const nError = normal && previous.normal ? normalError(normal, previous.normal) : 0;
        if (positionError > epsilon || nError > normalTolerance || (semantic !== null && previous.semantic !== null && semantic !== previous.semantic)) {
          errors.push({ key, positionError, normalError: nError, semanticMismatch: semantic !== null && previous.semantic !== null && semantic !== previous.semantic });
        }
      } else seen.set(key, { position, normal, semantic });
    }
  }
  return { ok: errors.length === 0, errors, uniqueBoundaryVertices: seen.size };
}

export function exportChartDebug(meshes = [], { epsilon = 1e-5 } = {}) {
  return {
    kind: "planet-chart-debug-v8",
    epsilon,
    charts: meshes.map((mesh, index) => ({
      id: mesh?.id || `chart:${index}`,
      vertexCount: (mesh?.positions?.length || 0) / 3,
      triangleCount: (mesh?.indices?.length || 0) / 3,
      vertices: Array.from(mesh?.positions || []),
      indices: Array.from(mesh?.indices || []),
    })),
  };
}

