// =====================================================================
//  terrain field → 低多边形表面（V6-G4）
//  纯数据，禁止 import Three.js。硬边保留；草坡/苔庭不得留下轴对齐方块边。
// =====================================================================

import { facePoints, faceVertexIds } from "./topology.js";
import { hashHex } from "../../core/rng.js";

export const HEIGHT_EPS = 0.05;
export const COLOR_DE00 = 8;
export const COVER_SEMANTICS = Object.freeze(["grass", "moss", "battlefield", "soft-slope"]);
export const HARD_SEMANTICS = Object.freeze(["cliff", "waterfall"]);

export const SEMANTIC_HEX = Object.freeze({
  "terrace-top": "#A9B2AB",
  waterfall: "#6F9EA4",
  shore: "#C5D0C8",
  cliff: "#B7C2BC",
  grass: "#88A779",
  road: "#8A8580",
  building: "#D5DBDB",
  "soft-slope": "#A7BE9C",
});

export function classifyTerrainFace(f) {
  if (f.semantic === "cell" || f.semantic === "building") return "building";
  if (f.semantic === "waterfall" || f.flags?.nearNotch) return "waterfall";
  if (f.semantic === "cliff" || f.flags?.cliff) return "cliff";
  if (f.semantic === "road") return "road";
  if (f.semantic === "grass" || f.semantic === "moss" || f.semantic === "battlefield") return f.semantic;
  if (f.flags?.harbor) return "shore";
  if (f.semantic === "terrace-top") return "terrace-top";
  return f.semantic || "soft-slope";
}

export function hexToRgb(hex) {
  const h = String(hex || "#888888").replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
}

function rgbToLab({ r, g, b }) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / 0.95047);
  const fy = f(y);
  const fz = f(z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function deltaE76(hexA, hexB) {
  const A = rgbToLab(hexToRgb(hexA));
  const B = rgbToLab(hexToRgb(hexB));
  return Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b);
}

export function isAxisAlignedQuad(pts) {
  if (!pts || pts.length !== 4) return false;
  let axis = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const dx = Math.abs(b.x - a.x);
    const dz = Math.abs(b.z - a.z);
    if (dx < 1e-4 && dz > 1e-4) axis += 1;
    else if (dz < 1e-4 && dx > 1e-4) axis += 1;
    else return false;
  }
  return axis === 4;
}

export function axisAlignedCoverPatches(faces, vertices) {
  const vMap = new Map((vertices || []).map((v) => [v.id, v]));
  const hits = [];
  for (const f of faces || []) {
    const sem = classifyTerrainFace(f);
    if (!COVER_SEMANTICS.includes(sem)) continue;
    const pts = (f.vertexIds || []).map((id) => vMap.get(id)).filter(Boolean);
    if (isAxisAlignedQuad(pts)) hits.push(f.id);
  }
  return hits;
}

function newell(pts) {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

function applyHeight(v, field) {
  return { id: v.id, x: v.x, y: field.height?.get?.(v.id) ?? v.y, z: v.z };
}

function ringId(t, r, s) {
  return `v:t${t}:r${r}:s${s}`;
}

function emitBandFaces(vset, tUpper, tLower, segs, semantic, flags) {
  const out = [];
  for (let s = 0; s < segs; s++) {
    const s1 = (s + 1) % segs;
    const ids = [ringId(tUpper, 1, s), ringId(tUpper, 1, s1), ringId(tLower, 0, s1), ringId(tLower, 0, s)];
    if (ids.some((id) => !vset.has(id))) continue;
    out.push({
      id: `f:${semantic}:t${tUpper}:s${s}`,
      vertexIds: ids,
      semantic,
      terraceId: tUpper,
      entityId: `band:${tUpper}:${s}`,
      flags: { ...flags, seg: s, cliff: semantic === "cliff" },
    });
  }
  return out;
}

export function extractLowPolySurface(topo, field = {}, opts = {}) {
  const mesh = topo.halfEdge;
  const region = opts.region || (() => true);
  const vset = new Set(mesh.vertices.map((v) => v.id));
  const vertices = mesh.vertices.map((v) => applyHeight(v, field));
  const faces = [];
  for (const f of mesh.faces) {
    if (f.semantic === "cell" && !opts.includeBuildings) continue;
    if (!region(f) && f.semantic !== "cell") continue;
    const semantic = classifyTerrainFace(f);
    faces.push({
      id: f.id,
      vertexIds: faceVertexIds(mesh, f),
      semantic,
      terraceId: f.terraceId ?? null,
      entityId: f.entityId,
      flags: { ...(f.flags || {}) },
    });
  }

  const terraces = [...new Set(mesh.faces.filter((f) => f.semantic === "terrace-top").map((f) => f.terraceId))].sort((a, b) => a - b);
  let maxSeg = 0;
  for (const f of mesh.faces) {
    if (f.semantic === "terrace-top" && Number.isFinite(f.flags?.seg)) maxSeg = Math.max(maxSeg, f.flags.seg);
  }
  const segs = Math.max(8, maxSeg + 1);
  const notchSeg = new Set(
    mesh.faces.filter((f) => f.flags?.nearNotch).map((f) => `${f.terraceId}:${f.flags.seg}`)
  );
  for (let i = 0; i < terraces.length - 1; i++) {
    const t0 = terraces[i];
    const t1 = terraces[i + 1];
    if (opts.region && !(opts.region({ terraceId: t0, semantic: "cliff", flags: {} }) && opts.region({ terraceId: t1, semantic: "cliff", flags: {} }))) {
      continue;
    }
    const band = emitBandFaces(vset, t0, t1, segs, "cliff", {});
    for (const f of band) {
      const key = `${t1}:${f.flags.seg}`;
      if (notchSeg.has(key) || notchSeg.has(`${t0}:${f.flags.seg}`)) {
        f.semantic = "waterfall";
        f.id = f.id.replace(":cliff:", ":waterfall:");
        f.flags.nearNotch = true;
      }
      faces.push(f);
    }
  }

  const vMap = new Map(vertices.map((v) => [v.id, v]));
  for (const f of faces) {
    f.color = SEMANTIC_HEX[f.semantic] || SEMANTIC_HEX["terrace-top"];
    const pts = f.vertexIds.map((id) => vMap.get(id)).filter(Boolean);
    f.normal = pts.length >= 3 ? newell(pts) : { x: 0, y: 1, z: 0 };
  }

  const report = inspectExtract(faces, vertices);
  return {
    vertices,
    faces,
    report,
    hash: hashHex(faces.map((f) => `${f.id}:${f.semantic}`).join("|") + vertices.map((v) => `${v.id}:${v.y.toFixed(4)}`).join("|")),
  };
}

export function inspectExtract(faces, vertices) {
  const vMap = new Map(vertices.map((v) => [v.id, v]));
  const edgeFaces = new Map();
  const ukey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  let hanging = 0;
  let heightJump = 0;
  let colorJump = 0;
  let normalJump = 0;
  const aabb = axisAlignedCoverPatches(faces, vertices);
  for (const f of faces) {
    const ids = f.vertexIds || [];
    for (let i = 0; i < ids.length; i++) {
      const k = ukey(ids[i], ids[(i + 1) % ids.length]);
      if (!edgeFaces.has(k)) edgeFaces.set(k, []);
      edgeFaces.get(k).push(f);
    }
  }
  for (const [, pair] of edgeFaces) {
    if (pair.length === 1) hanging += 1;
    if (pair.length !== 2) continue;
    const [a, b] = pair;
    const hard = HARD_SEMANTICS.includes(a.semantic) || HARD_SEMANTICS.includes(b.semantic);
    const na = a.normal || { x: 0, y: 1, z: 0 };
    const nb = b.normal || { x: 0, y: 1, z: 0 };
    const dot = na.x * nb.x + na.y * nb.y + na.z * nb.z;
    if (!hard && dot < 0.82) normalJump += 1;
    if (!hard && deltaE76(a.color, b.color) > COLOR_DE00) colorJump += 1;
    if (!hard) {
      const ha = (a.vertexIds || []).map((id) => vMap.get(id)?.y).filter((y) => Number.isFinite(y));
      const hb = (b.vertexIds || []).map((id) => vMap.get(id)?.y).filter((y) => Number.isFinite(y));
      const da = Math.abs((ha.reduce((s, y) => s + y, 0) / ha.length || 0) - (hb.reduce((s, y) => s + y, 0) / hb.length || 0));
      if (da > HEIGHT_EPS + 0.35) heightJump += 1;
    }
  }
  const degenerate = faces.filter((f) => {
    const pts = (f.vertexIds || []).map((id) => vMap.get(id)).filter(Boolean);
    if (pts.length < 3) return true;
    const n = newell(pts);
    return !Number.isFinite(n.x);
  }).length;
  return {
    hangingBoundary: hanging,
    heightJump,
    colorJump,
    normalJump,
    aabbPatches: aabb.length,
    aabbIds: aabb,
    degenerate,
    faceCount: faces.length,
    vertCount: vertices.length,
    semantics: [...new Set(faces.map((f) => f.semantic))].sort(),
  };
}

export function triangulateFace(face) {
  const ids = face.vertexIds || [];
  const tris = [];
  for (let i = 1; i < ids.length - 1; i++) tris.push([ids[0], ids[i], ids[i + 1]]);
  return tris;
}

export { facePoints, faceVertexIds };
