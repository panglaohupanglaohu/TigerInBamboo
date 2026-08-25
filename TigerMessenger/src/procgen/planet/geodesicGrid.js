// =====================================================================
// Geodesic main/dual grid for Planet V8.
// Main grid is a stable subdivided icosahedron.  WFC cells are the main
// triangles (dual metadata is attached to their centers), which keeps the
// graph irregular and avoids latitude/longitude pole distortion.
// =====================================================================

import { createHalfEdgeGraph } from "../graph/halfEdgeGraph.js";
import { createStableRng } from "../core/stableRng.js";
import { nearestBarycentricTriangle, tangentBasis } from "./barycentric.js";

const PHI = (1 + Math.sqrt(5)) * 0.5;
const BASE_VERTICES = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map(normalize);

const BASE_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function add(a, b, scale = 1) {
  return [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function keyOf(v) {
  return v.map((n) => Math.round(n * 1e8)).join(":");
}

function triangleCenter(vertices, face) {
  return normalize([
    vertices[face[0]][0] + vertices[face[1]][0] + vertices[face[2]][0],
    vertices[face[0]][1] + vertices[face[1]][1] + vertices[face[2]][1],
    vertices[face[0]][2] + vertices[face[1]][2] + vertices[face[2]][2],
  ]);
}

function subdivideIcosahedron(frequency) {
  const vertices = [];
  const vertexIndex = new Map();
  const addVertex = (value) => {
    const v = normalize(value);
    const key = keyOf(v);
    if (!vertexIndex.has(key)) {
      vertexIndex.set(key, vertices.length);
      vertices.push(v);
    }
    return vertexIndex.get(key);
  };
  const faces = [];
  for (let baseFace = 0; baseFace < BASE_FACES.length; baseFace++) {
    const [ia, ib, ic] = BASE_FACES[baseFace];
    const a = BASE_VERTICES[ia]; const b = BASE_VERTICES[ib]; const c = BASE_VERTICES[ic];
    const rows = [];
    for (let row = 0; row <= frequency; row++) {
      const line = [];
      for (let col = 0; col <= frequency - row; col++) {
        const u = row / frequency;
        const v = col / frequency;
        line.push(addVertex(normalize([
          a[0] * (1 - u - v) + b[0] * u + c[0] * v,
          a[1] * (1 - u - v) + b[1] * u + c[1] * v,
          a[2] * (1 - u - v) + b[2] * u + c[2] * v,
        ])));
      }
      rows.push(line);
    }
    for (let row = 0; row < frequency; row++) {
      const width = frequency - row;
      for (let col = 0; col < width; col++) {
        const p = rows[row][col];
        const q = rows[row][col + 1];
        const r = rows[row + 1][col];
        faces.push([p, r, q]);
        if (col < width - 1) {
          const s = rows[row + 1][col + 1];
          faces.push([q, r, s]);
        }
      }
    }
  }
  return { vertices, faces };
}

function relax(vertices, locked, seed, maxAngle = 0.006, iterations = 2) {
  const rng = createStableRng(seed, "geodesic-relax");
  for (let pass = 0; pass < iterations; pass++) {
    const next = vertices.map((v, i) => {
      if (locked.has(i)) return v;
      const axis = normalize([rng.next() - 0.5, rng.next() - 0.5, rng.next() - 0.5]);
      const tangent = add(axis, v, -axis[0] * v[0] - axis[1] * v[1] - axis[2] * v[2]);
      const l = Math.hypot(tangent[0], tangent[1], tangent[2]) || 1;
      const amount = (rng.next() - 0.5) * maxAngle / l;
      return normalize(add(v, tangent, amount));
    });
    vertices.splice(0, vertices.length, ...next);
  }
}

export function buildGeodesicMainAndDualGrid({ radius = 160, subdivision = 2, seed = 1, preserve = [] } = {}) {
  const frequency = Math.max(1, Math.min(5, subdivision | 0));
  const raw = subdivideIcosahedron(frequency);
  const positions = raw.vertices.map((v) => v.map((n) => n * radius));
  const locked = new Set();
  for (const direction of preserve) {
    if (!Array.isArray(direction)) continue;
    let best = -1; let score = -Infinity;
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const l = Math.hypot(p[0], p[1], p[2]) || 1;
      const s = p[0] / l * direction[0] + p[1] / l * direction[1] + p[2] / l * direction[2];
      if (s > score) { score = s; best = i; }
    }
    if (best >= 0) locked.add(best);
  }
  if (frequency >= 2) relax(positions, locked, seed, 0.003, 1);
  const vertexIds = positions.map((_, i) => `g:${i}`);
  const faceIds = raw.faces.map((_, i) => `cell:${i}`);
  const graph = createHalfEdgeGraph({ faces: raw.faces.map((face, i) => Object.assign(face.map((v) => vertexIds[v]), { id: faceIds[i] })) });
  const centers = raw.faces.map((face) => triangleCenter(positions, face));
  const faceById = new Map(faceIds.map((id, i) => [id, i]));
  const dualCells = centers.map((direction, index) => ({ id: faceIds[index], index, direction: normalize(direction), neighbors: graph.neighborsOf(index).map((edge) => ({ ...edge, id: faceIds[edge.to] })) }));
  const vertexNeighbors = positions.map(() => new Set());
  for (const face of raw.faces) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j) vertexNeighbors[face[i]].add(face[j]);
  const vertexDualCells = positions.map((position, index) => ({
    id: `dual-v:${index}`,
    index,
    direction: normalize(position),
    neighbors: [...vertexNeighbors[index]].sort((a, b) => a - b).map((to) => ({ to, id: `dual-v:${to}`, direction: `v:${index}:${to}` })),
  }));
  const stableEdges = graph.allEdges().map((edge) => ({ key: edge.key, owners: edge.owners.slice().sort() }));
  const charts = partitionCharts(dualCells, radius, frequency);
  return Object.freeze({
    kind: "planet-geodesic-grid-v8",
    radius,
    subdivision: frequency,
    main: Object.freeze({ positions, faces: raw.faces, vertexIds, faceIds }),
    dual: Object.freeze({
      kind: "planet-dual-graph-v8",
      cells: () => dualCells.map((cell) => ({ id: cell.id, index: cell.index })),
      cellCount: dualCells.length,
      cellId: (index) => faceIds[index],
      indexOfId: (id) => faceById.get(id) ?? -1,
      neighborsOf: (index) => dualCells[index]?.neighbors || [],
      directionOf: (index) => dualCells[index]?.direction.slice() || [0, 1, 0],
      validate: () => graph.validate(),
      vertexCells: () => vertexDualCells.map((cell) => ({ id: cell.id, index: cell.index })),
      vertexDirectionOf: (index) => vertexDualCells[index]?.direction.slice() || [0, 1, 0],
      vertexNeighborsOf: (index) => vertexDualCells[index]?.neighbors || [],
      vertexValidate: () => ({ ok: vertexDualCells.every((cell) => cell.neighbors.length === 5 || cell.neighbors.length === 6), errors: vertexDualCells.filter((cell) => cell.neighbors.length !== 5 && cell.neighbors.length !== 6).map((cell) => cell.id) }),
    }),
    edges: stableEdges,
    charts,
    hash: hashGrid(positions, raw.faces),
    tangentBasis,
  });
}

function partitionCharts(cells, radius, subdivision) {
  const groups = new Map();
  const chartSize = Math.max(0.17, 0.42 / subdivision);
  for (const cell of cells) {
    const bucket = `${Math.floor((cell.direction[0] + 1) / chartSize)}:${Math.floor((cell.direction[1] + 1) / chartSize)}:${Math.floor((cell.direction[2] + 1) / chartSize)}`;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(cell.index);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, cellIndices], index) => ({
    id: `chart:${index}`,
    key,
    cellIndices,
    radius,
    haloRings: 2,
  }));
}

function hashGrid(positions, faces) {
  let h = 2166136261;
  const update = (value) => { h ^= value; h = Math.imul(h, 16777619); };
  for (const p of positions) for (const n of p) update(Math.round(n * 1e5));
  for (const face of faces) for (const index of face) update(index);
  return `g${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export function sampleBarycentricDirection(grid, direction) {
  const cells = grid.dual.cells();
  const directions = cells.map((cell) => grid.dual.directionOf(cell.index));
  const sample = nearestBarycentricTriangle(directions, direction, directions.map((_, index) => index));
  const primary = sample.indices[sample.weights.indexOf(Math.max(...sample.weights))] ?? -1;
  return {
    cellIndex: primary,
    indices: sample.indices,
    weights: sample.weights,
    directions: sample.indices.map((index) => directions[index]),
    direction: primary >= 0 ? directions[primary] : [0, 1, 0],
    score: primary >= 0 ? directions[primary][0] * direction[0] + directions[primary][1] * direction[1] + directions[primary][2] * direction[2] : -1,
  };
}
