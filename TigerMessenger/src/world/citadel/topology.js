// =====================================================================
//  Citadel topology — Half-Edge + 主网格 / 对偶网格（PLAN V4 G1）
//  纯数据：不得 import Three.js。蓝图实体经稳定 ID 追溯。
// =====================================================================

import { perturbSkeletonVertices } from "./irregularSkeleton.js";

function freezeArr(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

function undirectedKey(a, b) {
  return a < b ? `${a}\t${b}` : `${b}\t${a}`;
}

export function destVertex(hes, hi) {
  return hes[hes[hi].next].vertex;
}

function newellNormal(pts) {
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
  return { x: nx, y: ny, z: nz };
}

function centroid(pts) {
  const n = pts.length || 1;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return { x: x / n, y: y / n, z: z / n };
}

function angleWrap(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/**
 * 由多边形面构建 Half-Edge。
 * @param {{id:string,x:number,y:number,z:number}[]} vertices
 * @param {{id:string,vertexIds:string[],semantic?:string,terraceId?:number|null,entityId?:string,flags?:object}[]} faces
 */
export function buildHalfEdgeFromFaces(vertices, faces) {
  const vMap = new Map();
  for (const v of vertices) {
    vMap.set(v.id, { id: v.id, x: v.x, y: v.y, z: v.z, he: -1, entityId: v.entityId || v.id });
  }
  const halfEdges = [];
  const faceRecs = [];
  const bundles = new Map();

  for (const f of faces) {
    const ids = f.vertexIds;
    const n = ids.length;
    if (n < 3) throw new Error(`face ${f.id} needs ≥3 vertices`);
    for (const id of ids) {
      if (!vMap.has(id)) throw new Error(`face ${f.id} missing vertex ${id}`);
    }
    const start = halfEdges.length;
    for (let i = 0; i < n; i++) {
      const va = ids[i];
      const vb = ids[(i + 1) % n];
      halfEdges.push({
        id: `he:${f.id}:${i}`,
        vertex: va,
        next: start + ((i + 1) % n),
        prev: start + ((i + n - 1) % n),
        twin: -1,
        face: f.id,
        edge: "",
      });
      const ukey = undirectedKey(va, vb);
      if (!bundles.has(ukey)) bundles.set(ukey, []);
      bundles.get(ukey).push(halfEdges.length - 1);
    }
    faceRecs.push({
      id: f.id,
      he: start,
      n,
      semantic: f.semantic || "field",
      terraceId: f.terraceId ?? null,
      entityId: f.entityId || f.id,
      flags: Object.freeze({ ...(f.flags || {}) }),
    });
  }

  for (let i = 0; i < halfEdges.length; i++) {
    const v = vMap.get(halfEdges[i].vertex);
    if (v.he < 0) v.he = i;
  }

  const edges = [];
  const nonManifold = [];
  const sortedKeys = [...bundles.keys()].sort();
  for (const ukey of sortedKeys) {
    const hes = bundles.get(ukey);
    const eId = `e:${ukey.replace("\t", "|")}`;
    edges.push({ id: eId, he: hes[0], count: hes.length, boundary: hes.length === 1 });
    for (const hi of hes) halfEdges[hi].edge = eId;
    if (hes.length === 2) {
      halfEdges[hes[0]].twin = hes[1];
      halfEdges[hes[1]].twin = hes[0];
    } else if (hes.length > 2) {
      nonManifold.push(eId);
    }
  }

  return {
    vertices: [...vMap.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    halfEdges,
    faces: faceRecs,
    edges,
    nonManifold,
  };
}

export function faceVertexIds(mesh, face) {
  const ids = [];
  let h = face.he;
  for (let i = 0; i < face.n; i++) {
    ids.push(mesh.halfEdges[h].vertex);
    h = mesh.halfEdges[h].next;
  }
  return ids;
}

export function facePoints(mesh, face) {
  const vMap = new Map(mesh.vertices.map((v) => [v.id, v]));
  return faceVertexIds(mesh, face).map((id) => vMap.get(id));
}

export function validateHalfEdge(mesh, opts = {}) {
  const requireManifold = opts.manifold !== false;
  const winding = opts.winding || "ccw";
  const errors = [];
  if (requireManifold && mesh.nonManifold.length) {
    errors.push(`non-manifold edges: ${mesh.nonManifold.join(",")}`);
  }
  for (const f of mesh.faces) {
    let h = f.he;
    for (let i = 0; i < f.n; i++) {
      const he = mesh.halfEdges[h];
      if (mesh.halfEdges[he.next].prev !== h) errors.push(`next/prev mismatch ${he.id}`);
      h = he.next;
    }
    if (h !== f.he) errors.push(`face ${f.id} cycle broken`);
    const nrm = newellNormal(facePoints(mesh, f));
    if (winding === "ccw" && (f.semantic === "terrace-top" || f.semantic === "cell") && nrm.y < -1e-8) {
      errors.push(`face ${f.id} winding not ccw-from-+Y`);
    }
  }
  const isolated = mesh.vertices.filter((v) => v.he < 0).map((v) => v.id);
  return {
    ok: errors.length === 0,
    errors,
    isolated,
    boundaryHe: mesh.halfEdges.filter((h) => h.twin < 0).length,
    nonManifold: mesh.nonManifold.slice(),
  };
}

/** 边界环：沿未配对半边走一圈。 */
export function boundaryLoops(mesh) {
  const hes = mesh.halfEdges;
  const byOrigin = new Map();
  for (let i = 0; i < hes.length; i++) {
    if (hes[i].twin >= 0) continue;
    const list = byOrigin.get(hes[i].vertex) || [];
    list.push(i);
    byOrigin.set(hes[i].vertex, list);
  }
  const seen = new Set();
  const loops = [];
  for (let i = 0; i < hes.length; i++) {
    if (hes[i].twin >= 0 || seen.has(i)) continue;
    const loop = [];
    let cur = i;
    let guard = 0;
    do {
      seen.add(cur);
      loop.push(hes[cur].id);
      const dest = destVertex(hes, cur);
      const outs = byOrigin.get(dest) || [];
      const next = outs.find((idx) => !seen.has(idx)) ?? outs[0];
      if (next == null) break;
      cur = next;
    } while (cur !== i && guard++ < hes.length + 2);
    loops.push(Object.freeze(loop));
  }
  return loops;
}

/**
 * 对偶网格：主面 → 对偶顶点（重心）；内部主顶点 → 对偶面。
 */
export function buildDualGrid(mesh) {
  const vMap = new Map(mesh.vertices.map((v) => [v.id, v]));
  const dualVerts = [];
  const faceToDualV = new Map();
  for (const f of mesh.faces) {
    const c = centroid(facePoints(mesh, f));
    const id = `dv:${f.id}`;
    dualVerts.push({
      id,
      x: c.x,
      y: c.y,
      z: c.z,
      he: -1,
      entityId: f.entityId,
      mainFaceId: f.id,
    });
    faceToDualV.set(f.id, id);
  }

  const dualFaces = [];
  const vertexToDualFace = new Map();
  const heOf = new Map(mesh.vertices.map((v) => [v.id, []]));
  for (let i = 0; i < mesh.halfEdges.length; i++) {
    heOf.get(mesh.halfEdges[i].vertex).push(i);
  }

  for (const v of mesh.vertices) {
    const outgoing = heOf.get(v.id) || [];
    if (!outgoing.length) {
      vertexToDualFace.set(v.id, null);
      continue;
    }
    const interior = outgoing.every((hi) => mesh.halfEdges[hi].twin >= 0);
    if (!interior) {
      vertexToDualFace.set(v.id, null);
      continue;
    }
    const start = outgoing[0];
    const ids = [];
    let cur = start;
    let guard = 0;
    do {
      ids.push(faceToDualV.get(mesh.halfEdges[cur].face));
      cur = mesh.halfEdges[mesh.halfEdges[cur].twin].next;
    } while (cur !== start && guard++ < 64);
    const dfId = `df:${v.id}`;
    dualFaces.push({
      id: dfId,
      vertexIds: ids,
      semantic: "dual-field",
      terraceId: null,
      entityId: v.entityId,
      flags: { mainVertexId: v.id },
    });
    vertexToDualFace.set(v.id, dfId);
  }

  const dualHe = dualFaces.length
    ? buildHalfEdgeFromFaces(dualVerts, dualFaces)
    : { vertices: dualVerts, halfEdges: [], faces: [], edges: [], nonManifold: [] };

  return {
    vertices: dualHe.vertices,
    faces: dualHe.faces,
    halfEdges: dualHe.halfEdges,
    edges: dualHe.edges,
    faceToDualVertex: Object.fromEntries(faceToDualV),
    vertexToDualFace: Object.fromEntries(vertexToDualFace),
  };
}

export function buildStableCrossGridIds(main, dual) {
  const entityToFaces = {};
  for (const f of main.faces) {
    const k = f.entityId;
    if (!entityToFaces[k]) entityToFaces[k] = [];
    entityToFaces[k].push(f.id);
  }
  for (const k of Object.keys(entityToFaces)) entityToFaces[k].sort();
  return Object.freeze({
    faceToDualVertex: dual.faceToDualVertex,
    vertexToDualFace: dual.vertexToDualFace,
    entityToFaces: Object.freeze(entityToFaces),
  });
}

function ringVertexId(terrace, ring, seg) {
  return `v:t${terrace}:r${ring}:s${seg}`;
}

function cellCenter(ix, iz, gridSize, cellSize) {
  const c = (gridSize - 1) / 2;
  return { x: (ix - c) * cellSize, z: (iz - c) * cellSize };
}

function inNotch(angle, center, half) {
  return Math.abs(angleWrap(angle - center)) < half;
}

function polar(r, y, a) {
  return { x: r * Math.sin(a), y, z: r * Math.cos(a) };
}

/**
 * 主网格：台地环带（field）+ 占格四边形（房屋/导航）。
 * 瀑布缺口扇区不生成面，形成边界环。
 */
export function buildMainGrid(blueprint) {
  const terrain = blueprint.terrain.config;
  const metrics = blueprint.terrain.metrics;
  const N = Math.max(8, terrain.radialSegments || 12);
  const coreR = terrain.coreRadius ?? 9;
  const notchCenter = terrain.notchCenter ?? 0.17;
  const notchHalf = terrain.notchHalf ?? 0;
  const notchedLayers = terrain.notchedLayers ?? 0;
  const vertices = [];
  const faces = [];
  const vSeen = new Set();

  const addV = (id, p, entityId) => {
    if (vSeen.has(id)) return;
    vSeen.add(id);
    vertices.push({ id, x: p.x, y: p.y, z: p.z, entityId: entityId || id });
  };

  for (let t = 0; t < metrics.length; t++) {
    const y = metrics[t].top;
    const rOuter = metrics[t].radius;
    const rInner = t === 0 ? Math.min(coreR, rOuter * 0.55) : metrics[t - 1].radius;
    for (let s = 0; s < N; s++) {
      const a = (s / N) * Math.PI * 2;
      addV(ringVertexId(t, 0, s), polar(rInner, y, a), `terrace:${t}`);
      addV(ringVertexId(t, 1, s), polar(rOuter, y, a), `terrace:${t}`);
    }
    for (let s = 0; s < N; s++) {
      const s1 = (s + 1) % N;
      const a0 = (s / N) * Math.PI * 2;
      const a1 = (s1 / N) * Math.PI * 2;
      const mid = angleWrap((a0 + a1) * 0.5);
      const notched = t > 0 && t <= notchedLayers && notchHalf > 0 && inNotch(mid, notchCenter, notchHalf);
      if (notched) continue;
      const midP = polar((rInner + rOuter) * 0.5, y, mid);
      const nearNotch =
        notchHalf > 0 &&
        t > 0 &&
        t <= notchedLayers &&
        Math.abs(angleWrap(mid - notchCenter)) < notchHalf + (Math.PI * 2) / N;
      const harbor = t === metrics.length - 1 && (nearNotch || midP.z > 0);
      faces.push({
        id: `f:t${t}:s${s}`,
        vertexIds: [
          ringVertexId(t, 0, s),
          ringVertexId(t, 1, s),
          ringVertexId(t, 1, s1),
          ringVertexId(t, 0, s1),
        ],
        semantic: "terrace-top",
        terraceId: t,
        entityId: `terrace:${t}`,
        flags: { harbor, nearNotch, seg: s },
      });
    }
  }

  const layout = blueprint.town?.layout;
  const gridSize = blueprint.grid?.size ?? 25;
  const cellSize = blueprint.grid?.cellSize ?? 1.15;
  const cellHeight = blueprint.grid?.cellHeight ?? 1.15;
  const terraces = layout?.terraces || [];
  for (const terr of terraces) {
    const t = terr.terraceIndex;
    const metric = metrics[t];
    if (!metric) continue;
    const levels = terr.levels || [];
    levels.forEach((rows, iy) => {
      (rows || []).forEach((row, iz) => {
        const chars = [...String(row)];
        chars.forEach((ch, ix) => {
          if (!ch || ch === ".") return;
          const c = cellCenter(ix, iz, gridSize, cellSize);
          const y = metric.top + iy * cellHeight;
          const hs = cellSize * 0.48;
          const entityId = `cell:${t}:${ix}:${iy}:${iz}`;
          const corners = [
            { id: `${entityId}:sw`, x: c.x - hs, y, z: c.z - hs },
            { id: `${entityId}:nw`, x: c.x - hs, y, z: c.z + hs },
            { id: `${entityId}:ne`, x: c.x + hs, y, z: c.z + hs },
            { id: `${entityId}:se`, x: c.x + hs, y, z: c.z - hs },
          ];
          for (const p of corners) addV(p.id, p, entityId);
          faces.push({
            id: `f:${entityId}`,
            vertexIds: corners.map((p) => p.id),
            semantic: "cell",
            terraceId: t,
            entityId,
            flags: { char: ch, ix, iy, iz },
          });
        });
      });
    });
  }

  vertices.sort((a, b) => (a.id < b.id ? -1 : 1));
  faces.sort((a, b) => (a.id < b.id ? -1 : 1));
  return { vertices, faces };
}

export function compileTopology(blueprint, seed = 1) {
  const mainSpec = buildMainGrid(blueprint);
  const skeleton = perturbSkeletonVertices(mainSpec, blueprint, seed);
  const halfEdge = buildHalfEdgeFromFaces(skeleton.vertices, mainSpec.faces);
  const report = validateHalfEdge(halfEdge, { manifold: true, winding: "ccw" });
  const dual = buildDualGrid(halfEdge);
  const idMap = buildStableCrossGridIds(halfEdge, dual);
  return Object.freeze({
    main: Object.freeze({
      vertices: freezeArr(halfEdge.vertices),
      faces: freezeArr(halfEdge.faces),
      edges: freezeArr(halfEdge.edges),
    }),
    dual: Object.freeze({
      vertices: freezeArr(dual.vertices),
      faces: freezeArr(dual.faces),
      faceToDualVertex: Object.freeze({ ...dual.faceToDualVertex }),
      vertexToDualFace: Object.freeze({ ...dual.vertexToDualFace }),
    }),
    halfEdge,
    idMap,
    report,
    skeleton: Object.freeze({ seed, hash: skeleton.hash, locked: skeleton.locked.size }),
  });
}

export function assertStableCrossIds(main, dual) {
  for (const f of main.faces) {
    const dv = dual.faceToDualVertex[f.id];
    if (!dv) throw new Error(`missing dual vertex for face ${f.id}`);
  }
  return true;
}

/** XZ 投影 SVG：主边实线、对偶虚线、半边箭头。 */
export function topologyToSvg(topo, opts = {}) {
  const w = opts.width ?? 900;
  const h = opts.height ?? 900;
  const verts = topo.halfEdge.vertices;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const v of verts) {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minZ = Math.min(minZ, v.z);
    maxZ = Math.max(maxZ, v.z);
  }
  const pad = 24;
  const sx = (w - pad * 2) / Math.max(1e-6, maxX - minX);
  const sz = (h - pad * 2) / Math.max(1e-6, maxZ - minZ);
  const s = Math.min(sx, sz);
  const px = (x) => pad + (x - minX) * s;
  const pz = (z) => h - pad - (z - minZ) * s;
  const vMap = new Map(verts.map((v) => [v.id, v]));
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="100%" height="100%" fill="#f4f1ea"/>`,
    `<g fill="none" stroke-linecap="round">`,
  ];
  for (const f of topo.halfEdge.faces) {
    const pts = facePoints(topo.halfEdge, f);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)},${pz(p.z).toFixed(1)}`).join(" ") + " Z";
    const fill =
      f.semantic === "cell"
        ? "#d9b48c"
        : f.flags?.harbor
          ? "#8eb8c8"
          : f.flags?.nearNotch
            ? "#c9d6c2"
            : "#e7ece7";
    parts.push(`<path d="${d}" fill="${fill}" stroke="#46545d" stroke-width="0.7"/>`);
  }
  for (const dv of topo.dual.vertices) {
    parts.push(`<circle cx="${px(dv.x).toFixed(1)}" cy="${pz(dv.z).toFixed(1)}" r="1.6" fill="#8d4b52"/>`);
  }
  const hes = topo.halfEdge.halfEdges;
  for (let i = 0; i < hes.length; i++) {
    if (hes[i].twin >= 0 && i > hes[i].twin) continue;
    const a = vMap.get(hes[i].vertex);
    const b = vMap.get(destVertex(hes, i));
    const x1 = px(a.x);
    const y1 = pz(a.z);
    const x2 = px(b.x);
    const y2 = pz(b.z);
    const mx = x1 + (x2 - x1) * 0.62;
    const my = y1 + (y2 - y1) * 0.62;
    parts.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="#2d353b" stroke-width="0.5"/>`
    );
  }
  parts.push(`</g></svg>`);
  return parts.join("");
}

export function transformVertices(vertices, fn) {
  return vertices.map((v) => {
    const p = fn(v);
    return { ...v, x: p.x, y: p.y, z: p.z };
  });
}
