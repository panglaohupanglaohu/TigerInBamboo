// =====================================================================
//  不规则 quad → 模块 frame（V6-G3）
//  纯数据，禁止 import Three.js。
// =====================================================================

import { facePoints } from "./topology.js";
import { DIRS, parseTownCellId } from "./constraintSolver.js";

export function classifyFootprint(occupancy = {}, diagonals = {}) {
  const open = DIRS.filter((d) => !occupancy[d]);
  const n = open.length;
  if (n === 0) {
    const emptyDiag = ["NE", "NW", "SE", "SW"].some((k) => diagonals[k] === 0);
    return emptyDiag ? "concave" : "interior";
  }
  if (n === 1) return "straight";
  if (n >= 3) return "end";
  const a = open[0];
  const b = open[1];
  const adj = (a === "N" && (b === "E" || b === "W")) || (a === "S" && (b === "E" || b === "W")) || (a === "E" && (b === "N" || b === "S")) || (a === "W" && (b === "N" || b === "S"));
  return adj ? "convex" : "through";
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
function len(a) {
  return Math.hypot(a.x, a.y, a.z) || 1;
}
function norm(a) {
  const L = len(a);
  return scale(a, 1 / L);
}

export function moduleFrameFromIrregularQuad(quad, meta = {}) {
  const sw = quad.sw;
  const se = quad.se;
  const nw = quad.nw;
  const xAxis = sub(se, sw);
  const zAxis = sub(nw, sw);
  const yAxis = { x: 0, y: 1, z: 0 };
  const width = len(xAxis);
  const depth = len(zAxis);
  const height = meta.height ?? 1.15;
  return {
    cellId: meta.cellId || null,
    quad: { sw, se, ne: quad.ne, nw },
    origin: sw,
    xAxis: norm(xAxis),
    yAxis,
    zAxis: norm(zAxis),
    width,
    depth,
    height,
    occupancy: meta.occupancy || {},
    sockets: meta.sockets || {},
    family: meta.family || "floor",
    variant: meta.variant || "base",
    rot: meta.rot || "r0",
  };
}

export function cellQuadFromTopology(topo, cellId) {
  const face = topo?.halfEdge?.faces?.find((f) => f.entityId === cellId || f.id === `f:${cellId}`);
  if (!face) return null;
  const pts = facePoints(topo.halfEdge, face);
  if (pts.length < 4) return null;
  return { sw: pts[0], nw: pts[1], ne: pts[2], se: pts[3] };
}

export function frameToWorld(frame, u, v, h) {
  const o = frame.origin;
  return {
    x: o.x + frame.xAxis.x * u * frame.width + frame.zAxis.x * v * frame.depth + frame.yAxis.x * h * frame.height,
    y: o.y + frame.xAxis.y * u * frame.width + frame.zAxis.y * v * frame.depth + frame.yAxis.y * h * frame.height,
    z: o.z + frame.xAxis.z * u * frame.width + frame.zAxis.z * v * frame.depth + frame.yAxis.z * h * frame.height,
  };
}

export function exposedDirs(occ = {}) {
  return DIRS.filter((d) => !occ[d]);
}

export function edgeUv(dir) {
  if (dir === "S") return { u0: 0, u1: 1, v0: 0, v1: 0.08 };
  if (dir === "N") return { u0: 0, u1: 1, v0: 0.92, v1: 1 };
  if (dir === "W") return { u0: 0, u1: 0.08, v0: 0, v1: 1 };
  return { u0: 0.92, u1: 1, v0: 0, v1: 1 };
}

export function parseCellId(id) {
  return parseTownCellId(id);
}

export { add, sub, scale, len, norm };
