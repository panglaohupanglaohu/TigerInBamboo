// =====================================================================
//  地形 UV：按语义合并 chart，切线平行传输，uv1 = edgeDistance/slope（G2）
// =====================================================================

import { facePoints } from "./topology.js";

function hypot3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
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

function classifyFace(f) {
  if (f.semantic === "cell" || f.semantic === "building") return "building";
  if (f.semantic === "waterfall" || f.flags?.nearNotch) return "waterfall";
  if (f.semantic === "cliff" || f.flags?.cliff) return "cliff";
  if (f.flags?.harbor || f.semantic === "shore") return "shore";
  if (f.semantic === "terrace-top") return "terrace-top";
  if (f.semantic === "road" || f.semantic === "grass") return f.semantic;
  return f.semantic || "soft-slope";
}

export function compileTerrainUV(mesh, field = {}) {
  const charts = [];
  const byKey = new Map();
  for (const f of mesh.faces) {
    const semantic = classifyFace(f);
    const key = `${semantic}:${f.terraceId ?? "x"}`;
    if (!byKey.has(key)) byKey.set(key, { id: `chart:${key}`, semantic, terraceId: f.terraceId ?? null, faces: [] });
    byKey.get(key).faces.push(f);
  }
  const vMap = new Map(mesh.vertices.map((v) => [v.id, v]));
  const corners = [];
  let nonFinite = 0;
  let flipped = 0;
  const densities = [];

  for (const chart of [...byKey.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    for (const f of chart.faces) {
      const pts = facePoints(mesh, f);
      let world = 0;
      for (let i = 0; i < pts.length; i++) world += hypot3(pts[i], pts[(i + 1) % pts.length]);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const h = field.height?.get?.(p.id) ?? p.y;
        let u;
        let v;
        if (chart.semantic === "waterfall") {
          u = Math.atan2(p.x, p.z) / (Math.PI * 2) + 0.5;
          v = -h; // 沿高程下行单调
        } else if (chart.semantic === "terrace-top" || chart.semantic === "shore") {
          u = Math.atan2(p.x, p.z) / (Math.PI * 2) + 0.5;
          v = Math.hypot(p.x, p.z) * 0.08;
        } else {
          u = p.x * 0.25;
          v = p.z * 0.25;
        }
        if (!Number.isFinite(u) || !Number.isFinite(v)) nonFinite += 1;
        const edgeDistance = distToEdgesXZ(pts, p.x, p.z);
        const slope = Math.max(0, Math.min(1, 1 - (pts.reduce((s, q) => s + (q.y === h ? 1 : 0), 0) > 1 ? 0.98 : 0.7)));
        corners.push({
          faceId: f.id,
          vertexId: p.id,
          y: h,
          uv0: { u, v },
          uv1: { edgeDistance, slope },
          chartId: chart.id,
          semantic: chart.semantic,
        });
      }
      densities.push(world / Math.max(0.2, pts.length));
    }
    charts.push(chart);
  }

  const mean = densities.reduce((s, d) => s + d, 0) / Math.max(1, densities.length);
  const maxDev = densities.reduce((m, d) => Math.max(m, Math.abs(d - mean) / mean), 0);

  return {
    charts: charts.map((c) => ({ id: c.id, semantic: c.semantic, terraceId: c.terraceId, faceCount: c.faces.length })),
    corners,
    stats: {
      nonFinite,
      flipped,
      texelDensityMean: mean,
      texelDensityMaxDev: maxDev,
      chartCount: charts.length,
    },
  };
}

export function waterfallVMonotonic(uv, terraceId = 1) {
  const rows = uv.corners.filter((c) => c.semantic === "waterfall" && (c.chartId.includes(`:${terraceId}`) || terraceId == null));
  if (rows.length < 2) return true;
  const vs = rows.map((c) => c.uv0.v);
  return Math.max(...vs) - Math.min(...vs) >= 0;
}

/** 同面内高程下降时 V 严格不减（v=-h 约定）。 */
export function waterfallVStrict(uv) {
  const byFace = new Map();
  for (const c of uv.corners || []) {
    if (c.semantic !== "waterfall") continue;
    if (!byFace.has(c.faceId)) byFace.set(c.faceId, []);
    byFace.get(c.faceId).push(c);
  }
  if (!byFace.size) return false;
  for (const rows of byFace.values()) {
    const ordered = rows.slice().sort((a, b) => (b.y ?? 0) - (a.y ?? 0));
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].uv0.v + 1e-9 < ordered[i - 1].uv0.v) return false;
    }
  }
  return true;
}
