// =====================================================================
//  不规则四边形骨架：Half-Edge ID 不变，视觉顶点受限扰动（V6-G2）
//  纯数据，禁止 import Three.js。门/梯/瀑布口/运河/道路/港口不抖动。
// =====================================================================

import { hashHex, seedFromString } from "../../core/rng.js";

export const SKELETON_AMP_CELL = 0.18;
export const SKELETON_AMP_RING = 0.11;

const CORNER_OFF = {
  sw: [0, 0],
  se: [1, 0],
  nw: [0, 1],
  ne: [1, 1],
};

export function parseCellVertexId(id) {
  const m = /^cell:(\d+):(\d+):(\d+):(\d+):(sw|se|nw|ne)$/.exec(id || "");
  if (!m) return null;
  return { t: +m[1], ix: +m[2], iy: +m[3], iz: +m[4], corner: m[5] };
}

export function parseRingVertexId(id) {
  const m = /^v:t(\d+):r(\d+):s(\d+)$/.exec(id || "");
  if (!m) return null;
  return { t: +m[1], ring: +m[2], seg: +m[3] };
}

function unitJitter(seed, key) {
  const a = seedFromString(`${seed}|${key}`);
  const b = seedFromString(`${seed}|${key}|z`);
  return { u: a / 4294967296, v: b / 4294967296 };
}

export function collectLockedVertices(faces) {
  const locked = new Map();
  const lock = (ids, reason) => {
    for (const id of ids || []) if (!locked.has(id)) locked.set(id, reason);
  };
  for (const f of faces) {
    const ch = f.flags?.char;
    if (f.semantic === "cell" && ch === "G") lock(f.vertexIds, "gate");
    else if (f.semantic === "cell" && (ch === "S" || f.semantic === "stairs-run")) lock(f.vertexIds, "stairs");
    else if (f.semantic === "cell" && (ch === "C" || f.semantic === "canal")) lock(f.vertexIds, "canal");
    else if (f.semantic === "cell" && (ch === "R" || f.semantic === "road")) lock(f.vertexIds, "road");
    if (f.flags?.nearNotch) lock(f.vertexIds, "waterfall");
    if (f.flags?.harbor) lock(f.vertexIds, "harbor");
  }
  return locked;
}

function cornerKey(t, ix, iz, corner) {
  const off = CORNER_OFF[corner] || [0, 0];
  return `c:${t}:${ix + off[0]}:${iz + off[1]}`;
}

export function perturbSkeletonVertices(mainSpec, blueprint, seed = 1) {
  const faces = mainSpec.faces || [];
  const locked = collectLockedVertices(faces);
  const lockedCorners = new Set();
  for (const f of faces) {
    if (!f.vertexIds) continue;
    const reason = f.vertexIds.map((id) => locked.get(id)).find(Boolean);
    if (!reason) continue;
    for (const id of f.vertexIds) {
      const p = parseCellVertexId(id);
      if (p) lockedCorners.add(cornerKey(p.t, p.ix, p.iz, p.corner));
    }
  }
  const cellSize = blueprint.grid?.cellSize ?? 1.15;
  const ampCell = cellSize * SKELETON_AMP_CELL;
  const vertices = (mainSpec.vertices || []).map((v) => {
    if (locked.has(v.id)) return { ...v, lockReason: locked.get(v.id) };
    const cell = parseCellVertexId(v.id);
    if (cell) {
      const ck = cornerKey(cell.t, cell.ix, cell.iz, cell.corner);
      if (lockedCorners.has(ck)) return { ...v, lockReason: "clearance" };
      const j = unitJitter(seed, ck);
      return {
        ...v,
        x: v.x + (j.u - 0.5) * ampCell,
        z: v.z + (j.v - 0.5) * ampCell,
        lockReason: null,
      };
    }
    const ring = parseRingVertexId(v.id);
    if (ring) {
      const j = unitJitter(seed, v.id);
      const amp = Math.hypot(v.x, v.z) * SKELETON_AMP_RING * 0.04 + 0.08;
      return {
        ...v,
        x: v.x + (j.u - 0.5) * amp,
        z: v.z + (j.v - 0.5) * amp,
        lockReason: null,
      };
    }
    return { ...v, lockReason: null };
  });
  return {
    vertices,
    faces,
    locked,
    seed,
    hash: skeletonHash(vertices),
  };
}

export function skeletonHash(vertices) {
  return hashHex(
    (vertices || [])
      .map((v) => `${v.id}:${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`)
      .join("|")
  );
}
