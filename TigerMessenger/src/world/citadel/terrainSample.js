// =====================================================================
//  第一层瀑布 + 相邻台面样片：geometry / UV / surface / nav 叠图（V6-G4）
//  纯数据，禁止 import Three.js。不替换 citadelRange 生产网格。
// =====================================================================

import { buildHalfEdgeFromFaces } from "./topology.js";
import { createSurfaceProvider } from "./surfaceProvider.js";
import { compileTerrainUV, waterfallVStrict } from "./terrainUvCompiler.js";
import { compileSurfaceGraph } from "./surfaceGraph.js";
import { extractLowPolySurface, SEMANTIC_HEX, axisAlignedCoverPatches } from "./terrainExtract.js";
import { hashHex } from "../../core/rng.js";

export function isWaterfallL1Region(f) {
  const t = f.terraceId;
  if (t === 0 || t === 1) return true;
  if (f.flags?.nearNotch) return true;
  return false;
}

export function extractL1Sample(topo, field) {
  return extractLowPolySurface(topo, field, {
    region: isWaterfallL1Region,
    includeBuildings: false,
  });
}

export function surfaceFromExtract(extract) {
  const he = buildHalfEdgeFromFaces(extract.vertices, extract.faces);
  const height = new Map(extract.vertices.map((v) => [v.id, v.y]));
  return { halfEdge: he, provider: createSurfaceProvider(he, { height }) };
}

export function attachOnSemanticSurface(provider, pos, kind, tags = []) {
  const hit = provider.sample(pos) || provider.nearest(pos);
  if (!hit) return { ok: false, kind, tags };
  return {
    ok: true,
    kind,
    tags: tags.slice(),
    point: { ...hit.point },
    surfaceId: hit.surfaceId,
    semantic: hit.semantic,
    terraceId: hit.terraceId,
  };
}

export function buildTerrainSamplePack(topo, field, graph = null) {
  const extract = extractL1Sample(topo, field);
  const { halfEdge, provider } = surfaceFromExtract(extract);
  const uv = compileTerrainUV(halfEdge, { height: new Map(extract.vertices.map((v) => [v.id, v.y])) });
  const nav = graph
    ? {
        nodes: [...graph.nodes.values()].filter((n) => n.terrace === 0 || n.terrace === 1 || n.flags?.nearNotch),
        edges: [...graph.edges.values()].filter((e) => {
          const a = graph.nodes.get(e.a);
          const b = graph.nodes.get(e.b);
          return a && b && (a.terrace === 0 || a.terrace === 1 || b.terrace === 0 || b.terrace === 1);
        }),
      }
    : { nodes: [], edges: [] };
  const sampleGraph = compileSurfaceGraph({ halfEdge, report: { boundaryHe: 0 } }, provider);
  return {
    extract,
    provider,
    uv,
    nav,
    sampleGraph,
    waterfallStrict: waterfallVStrict(uv),
    aabb: axisAlignedCoverPatches(extract.faces, extract.vertices),
    hash: hashHex(`${extract.hash}|${uv.stats.chartCount}|${provider.surfaces.length}`),
  };
}

function svgOpen(w, h, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#eef2f0"/><text x="14" y="20" font-size="12" fill="#2d353b">${title}</text>`;
}

function project(verts, w, h) {
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
  const pad = 36;
  const s = Math.min((w - pad * 2) / Math.max(1e-3, maxX - minX), (h - pad * 2) / Math.max(1e-3, maxZ - minZ));
  return {
    px: (x) => pad + (x - minX) * s,
    pz: (z) => pad + (z - minZ) * s,
  };
}

export function terrainLayerSvg(pack, layer = "geometry", opts = {}) {
  const w = opts.width ?? 720;
  const h = opts.height ?? 640;
  const extract = pack.extract;
  const vMap = new Map(extract.vertices.map((v) => [v.id, v]));
  const { px, pz } = project(extract.vertices, w, h);
  const parts = [svgOpen(w, h, `L1 waterfall ${layer}`)];
  const uvOf = new Map();
  for (const c of pack.uv?.corners || []) uvOf.set(`${c.faceId}:${c.vertexId}`, c);
  for (const f of extract.faces) {
    const pts = (f.vertexIds || []).map((id) => vMap.get(id)).filter(Boolean);
    if (pts.length < 3) continue;
    const d = pts.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)},${pz(p.z).toFixed(1)}`).join(" ") + " Z";
    let fill = SEMANTIC_HEX[f.semantic] || "#ccc";
    if (layer === "geometry") {
      const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const t = Math.max(0, Math.min(1, (y - 2) / 12));
      fill = t > 0.6 ? "#c5d0c8" : t > 0.3 ? "#a9b2ab" : "#6f9ea4";
    } else if (layer === "uv") {
      const c0 = uvOf.get(`${f.id}:${pts[0].id}`);
      const u = c0?.uv0.u ?? 0.5;
      const v = ((c0?.uv0.v ?? 0) % 4) / 4;
      const ru = Math.round(120 + u * 100)
        .toString(16)
        .padStart(2, "0");
      const rv = Math.round(80 + Math.abs(v) * 120)
        .toString(16)
        .padStart(2, "0");
      fill = `#${ru}a0${rv}`;
    } else if (layer === "surface") {
      fill = SEMANTIC_HEX[f.semantic] || fill;
    } else if (layer === "nav") {
      fill = f.semantic === "terrace-top" ? "#d5dbdb" : "#e7ece7";
    }
    parts.push(`<path d="${d}" fill="${fill}" stroke="#46545d" stroke-width="0.5" opacity="0.92"/>`);
  }
  if (layer === "nav") {
    for (const n of pack.nav?.nodes || []) {
      parts.push(`<circle cx="${px(n.pos.x).toFixed(1)}" cy="${pz(n.pos.z).toFixed(1)}" r="2.2" fill="#416f91"/>`);
    }
    for (const e of (pack.nav?.edges || []).slice(0, 400)) {
      const a = pack.nav.nodes.find((n) => n.id === e.a);
      const b = pack.nav.nodes.find((n) => n.id === e.b);
      if (!a || !b) continue;
      parts.push(
        `<line x1="${px(a.pos.x).toFixed(1)}" y1="${pz(a.pos.z).toFixed(1)}" x2="${px(b.pos.x).toFixed(1)}" y2="${pz(b.pos.z).toFixed(1)}" stroke="#593b47" stroke-width="0.7" opacity="0.5"/>`
      );
    }
  }
  parts.push(`</svg>`);
  return parts.join("");
}

export function writeTerrainSampleSvgs(pack) {
  return {
    geometry: terrainLayerSvg(pack, "geometry"),
    uv: terrainLayerSvg(pack, "uv"),
    surface: terrainLayerSvg(pack, "surface"),
    nav: terrainLayerSvg(pack, "nav"),
  };
}
