// =====================================================================
//  SurfaceProvider — 城堡范围内唯一落地/法线/台地查询（PLAN V4 G2）
//  纯数据，不 import Three.js。
// =====================================================================

import { facePoints } from "./topology.js";

const HASH = 4;

function key(ix, iz) {
  return `${ix},${iz}`;
}

function hashPoint(x, z) {
  return key(Math.floor(x / HASH), Math.floor(z / HASH));
}

function pointInPolyXZ(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const zi = pts[i].z;
    const xj = pts[j].x;
    const zj = pts[j].z;
    const hit = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function distToEdgesXZ(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz || 1e-8;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2));
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}

function interpY(pts, x, z) {
  let num = 0;
  let den = 0;
  for (const p of pts) {
    const w = 1 / (Math.hypot(x - p.x, z - p.z) + 1e-4);
    num += p.y * w;
    den += w;
  }
  return num / den;
}

function normalOf(pts) {
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

function tangentOf(n) {
  const tx = 1 - n.x * n.x;
  const ty = 0 - n.x * n.y;
  const tz = 0 - n.x * n.z;
  const len = Math.hypot(tx, ty, tz) || 1;
  return { x: tx / len, y: ty / len, z: tz / len };
}

function makeSurface(mesh, face, field) {
  const pts = facePoints(mesh, face).map((p) => ({
    x: p.x,
    y: field?.height?.get?.(p.id) ?? p.y,
    z: p.z,
  }));
  const n = normalOf(pts);
  const c = {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
  };
  return {
    id: face.id,
    semantic: face.semantic,
    terraceId: face.terraceId,
    regionId: face.entityId,
    entityId: face.entityId,
    flags: face.flags || {},
    pts,
    normal: n,
    tangent: tangentOf(n),
    centroid: c,
  };
}

/**
 * @param {object} mesh topology.halfEdge
 * @param {{ height?: Map<string, number> }} [field]
 */
export function createSurfaceProvider(mesh, field = {}) {
  const surfaces = mesh.faces.map((f) => makeSurface(mesh, f, field));
  const byId = new Map(surfaces.map((s) => [s.id, s]));
  const buckets = new Map();
  for (const s of surfaces) {
    for (const p of s.pts) {
      const k = hashPoint(p.x, p.z);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(s);
    }
  }

  function candidatesNear(x, z) {
    const seen = new Set();
    const out = [];
    const ix = Math.floor(x / HASH);
    const iz = Math.floor(z / HASH);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = buckets.get(key(ix + dx, iz + dz)) || [];
        for (const s of list) {
          if (seen.has(s.id)) continue;
          seen.add(s.id);
          out.push(s);
        }
      }
    }
    return out.length ? out : surfaces;
  }

  function hitOn(s, pos) {
    if (!pointInPolyXZ(s.pts, pos.x, pos.z)) return null;
    const y = interpY(s.pts, pos.x, pos.z);
    const edgeDistance = distToEdgesXZ(s.pts, pos.x, pos.z);
    const slope = 1 - s.normal.y;
    return {
      inside: true,
      point: { x: pos.x, y, z: pos.z },
      normal: s.normal,
      tangent: s.tangent,
      surfaceId: s.id,
      terraceId: s.terraceId,
      regionId: s.regionId,
      semantic: s.semantic,
      edgeDistance,
      slope,
      clearance: 2.0,
    };
  }

  return {
    surfaces,
    get: (id) => byId.get(id) || null,
    walkable: () => surfaces.filter((s) => s.semantic === "terrace-top" || s.semantic === "cell"),
    sample(worldPos, profile = {}) {
      const maxSlope = profile.maxSlope ?? 0.85;
      const list = candidatesNear(worldPos.x, worldPos.z);
      const hits = [];
      for (const s of list) {
        const h = hitOn(s, worldPos);
        if (!h || h.slope > maxSlope) continue;
        hits.push(h);
      }
      hits.sort((a, b) => Math.abs(a.point.y - worldPos.y) - Math.abs(b.point.y - worldPos.y));
      return hits[0] ?? null;
    },
    projectTo(surfaceId, worldPos) {
      const s = byId.get(surfaceId);
      if (!s) return null;
      return hitOn(s, worldPos);
    },
    /** 嵌套台地 walkLift：同一 XZ 取最高可走命中，高度只来自本 field。 */
    sampleWalkLift(x, z, profile = {}) {
      const maxSlope = profile.maxSlope ?? 0.85;
      const list = candidatesNear(x, z);
      let best = null;
      for (const s of list) {
        const h = hitOn(s, { x, y: 0, z });
        if (!h || h.slope > maxSlope) continue;
        if (!best || h.point.y > best.point.y) best = h;
      }
      return best;
    },
    /** 采样失败时落到最近面心，供 dirty 区占用者迁移。 */
    nearest(worldPos) {
      const hit = this.sample(worldPos);
      if (hit) return hit;
      let best = null;
      let bestD = Infinity;
      for (const s of surfaces) {
        const dx = s.centroid.x - worldPos.x;
        const dy = s.centroid.y - (worldPos.y || 0);
        const dz = s.centroid.z - worldPos.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      if (!best) return null;
      const on = hitOn(best, worldPos);
      if (on) return { ...on, projected: true };
      return {
        inside: false,
        projected: true,
        point: { ...best.centroid },
        normal: best.normal,
        tangent: best.tangent,
        surfaceId: best.id,
        terraceId: best.terraceId,
        regionId: best.regionId,
        semantic: best.semantic,
        edgeDistance: 0,
        slope: 1 - best.normal.y,
        clearance: 2.0,
      };
    },
    patch(surfaceIds = []) {
      return { patched: [...surfaceIds].sort() };
    },
  };
}
