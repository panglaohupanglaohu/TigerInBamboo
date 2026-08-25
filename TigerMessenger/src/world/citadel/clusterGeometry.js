// =====================================================================
//  单建筑簇几何：family builder + prop；不替换全城镇体网格（V6-G3）
//  纯数据，禁止 import Three.js。
// =====================================================================

import { resolveBuildingTheme, TILE_ACCENTS, finalColor } from "./visualTheme.js";
import { cellQuadFromTopology, moduleFrameFromIrregularQuad, parseCellId } from "./moduleFrame.js";
import { FAMILY_BUILDERS, STRUCTURAL_SEMANTICS, buildResolvedModule, resetBuilderIds } from "./familyBuilders.js";
import { PROP_KINDS, appearancePropHash, geometryUsage, placeProps, propUsage, reconcileProps } from "./propPlacement.js";
import { hashHex } from "../../core/rng.js";

export function unitQuad() {
  return {
    sw: { x: 0, y: 0, z: 0 },
    se: { x: 1.15, y: 0, z: 0 },
    ne: { x: 1.15, y: 0, z: 1.15 },
    nw: { x: 0, y: 0, z: 1.15 },
  };
}

export function frameForCell(cell, topo, blueprint, theme) {
  const loc = parseCellId(cell.cellId || cell.id);
  const quad = (topo && cellQuadFromTopology(topo, cell.cellId || cell.id)) || syntheticQuad(loc, blueprint);
  const height = blueprint?.grid?.cellHeight ?? 1.15;
  return moduleFrameFromIrregularQuad(quad, {
    cellId: cell.cellId || cell.id,
    occupancy: cell.occupancy,
    sockets: cell.module?.sockets,
    family: cell.module?.family,
    variant: cell.module?.role,
    rot: cell.rot,
    height,
    theme,
  });
}

function syntheticQuad(loc, blueprint) {
  if (!loc) return unitQuad();
  const gridSize = blueprint?.grid?.size ?? 25;
  const cellSize = blueprint?.grid?.cellSize ?? 1.15;
  const cellHeight = blueprint?.grid?.cellHeight ?? 1.15;
  const c = (gridSize - 1) / 2;
  const x = (loc.ix - c) * cellSize;
  const z = (loc.iz - c) * cellSize;
  const y = loc.iy * cellHeight;
  const hs = cellSize * 0.48;
  return {
    sw: { x: x - hs, y, z: z - hs },
    nw: { x: x - hs, y, z: z + hs },
    ne: { x: x + hs, y, z: z + hs },
    se: { x: x + hs, y, z: z - hs },
  };
}

export function exerciseAllBuilders(theme, seed = 7) {
  resetBuilderIds();
  const occOpenS = { N: 1, E: 1, S: 0, W: 1, U: 0, D: 1 };
  const occConvex = { N: 0, E: 0, S: 1, W: 1, U: 0, D: 1 };
  const occIn = { N: 1, E: 1, S: 1, W: 1, U: 1, D: 1 };
  const jobs = [
    ["floor", "base", occOpenS],
    ["floor", "tower", occIn],
    ["floor", "cornice", occOpenS],
    ["foundation", "stone-plinth", occOpenS],
    ["fence", "iron", occOpenS],
    ["balcony", "flower-tile", occOpenS],
    ["flowerTile", "coral", occOpenS],
    ["stairs", "small", { N: 0, E: 1, S: 0, W: 1, U: 0, D: 1 }],
    ["support", "pillar", occIn],
    ["hole", "archway", occOpenS],
    ["gate", "main", occOpenS],
    ["roof", "hip", occIn],
    ["roof", "gable", occIn],
    ["roof", "dome", occIn],
    ["roof", "flat", occIn],
    ["bridge", "arch", occOpenS],
    ["decor", "window", occOpenS],
    ["decor", "chimney", occIn],
    ["decor", "lamp", occOpenS],
  ];
  const out = [];
  for (const [family, variant, occupancy] of jobs) {
    const frame = moduleFrameFromIrregularQuad(unitQuad(), { occupancy, family, variant, cellId: `demo:${family}:${variant}` });
    const built = buildResolvedModule({ occupancy }, { family, variant, module: { family, role: variant } }, theme, frame);
    out.push({ family, variant, ...built });
  }
  const concaveOcc = { N: 1, E: 1, S: 1, W: 1, U: 1, D: 1 };
  const concaveFrame = moduleFrameFromIrregularQuad(unitQuad(), { occupancy: concaveOcc, family: "floor", cellId: "demo:concave" });
  out.push({
    family: "floor",
    variant: "concave",
    ...buildResolvedModule(
      { occupancy: concaveOcc, diagonals: { NE: 0 } },
      { family: "floor", module: { family: "floor", role: "base" } },
      theme,
      concaveFrame
    ),
  });
  const convexFrame = moduleFrameFromIrregularQuad(unitQuad(), { occupancy: occConvex, family: "floor", cellId: "demo:convex" });
  out.push({
    family: "floor",
    variant: "convex",
    ...buildResolvedModule({ occupancy: occConvex }, { family: "floor", module: { family: "floor", role: "base" } }, theme, convexFrame),
  });
  const allSem = new Set();
  for (const b of out) for (const s of b.structure.solids) allSem.add(s.semantic);
  return { built: out, semantics: [...allSem].sort(), seed };
}

export function pickSampleCluster(town, minCols = 6) {
  const cells = town.cells || [];
  const col = (id) => {
    const p = parseCellId(id);
    return p ? `${p.t}:${p.ix}:${p.iz}` : id;
  };
  const byCol = new Map();
  for (const c of cells) {
    const k = col(c.cellId);
    if (!byCol.has(k)) byCol.set(k, []);
    byCol.get(k).push(c);
  }
  const keys = [...byCol.keys()];
  const seen = new Set();
  let best = [];
  for (const k of keys) {
    if (seen.has(k)) continue;
    const stack = [k];
    const comp = [];
    seen.add(k);
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      const [t, ix, iz] = cur.split(":").map(Number);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nk = `${t}:${ix + dx}:${iz + dz}`;
        if (byCol.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          stack.push(nk);
        }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  const use = best.length >= minCols ? best : keys.slice(0, minCols);
  const picked = [];
  for (const k of use) picked.push(...(byCol.get(k) || []));
  return picked.sort((a, b) => (a.cellId < b.cellId ? -1 : 1));
}

export function materializeCells(cells, topo, blueprint, seed, prevPlaced = null, opts = {}) {
  resetBuilderIds();
  const keepSolids = opts.keepSolids !== false;
  const solids = [];
  const slots = [];
  const walk = [];
  const modules = [];
  for (const cell of cells) {
    const theme = resolveBuildingTheme(cell.cellId, { seed });
    const frame = frameForCell(cell, topo, blueprint, theme);
    const built = buildResolvedModule(cell, cell, theme, frame);
    if (keepSolids) for (const s of built.structure.solids) solids.push({ ...s, cellId: cell.cellId, frame });
    for (const sl of built.slots) slots.push(sl);
    for (const w of built.walkSurfaces) walk.push({ ...w, cellId: cell.cellId });
    modules.push(cell);
  }
  const placed = prevPlaced
    ? reconcileProps(prevPlaced, slots, { seed }).placed
    : placeProps(slots, { seed });
  return {
    solids,
    slots,
    placed,
    walkSurfaces: walk,
    usage: { ...geometryUsage(modules), props: propUsage(placed) },
    hash: hashHex(solids.map((s) => `${s.cellId}:${s.semantic}:${s.kind}`).join("|") + appearancePropHash(placed)),
  };
}

export function materializeTownGeometry(town, topo, blueprint, seed) {
  return materializeCells(town.cells || [], topo, blueprint, seed, null, { keepSolids: false });
}

export function buildClusterSampleGeometry(town, topo, blueprint, seed = 7) {
  const cluster = pickSampleCluster(town);
  const theme = resolveBuildingTheme(cluster[0]?.cellId || "cluster:0", { seed });
  const geo = materializeCells(cluster, topo, blueprint, seed);
  const demo = exerciseAllBuilders(theme, seed);
  return {
    clusterId: cluster[0]?.cellId || "cluster",
    cellCount: cluster.length,
    theme,
    ...geo,
    demoSemantics: demo.semantics,
    tiles: TILE_ACCENTS,
  };
}

function svgHeader(w, h, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#eef2f0"/><text x="16" y="22" font-size="13" fill="#2d353b">${title}</text>`;
}

export function clusterToSvg(sample, opts = {}) {
  const w = opts.width ?? 720;
  const h = opts.height ?? 520;
  const weather = opts.weather || "clear";
  const night = weather === "night";
  const mode = opts.mode || "plan";
  const wall = finalColor("castleWallChalk", { weather, timeBand: night ? "night" : "day" });
  const roof = finalColor("castleRoof", { weather, timeBand: night ? "night" : "day" });
  const tile = sample.theme?.tileAccent || TILE_ACCENTS[0].hex;
  const solids = sample.solids || [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of solids) {
    const fr = s.frame;
    if (!fr) continue;
    minX = Math.min(minX, fr.origin.x);
    maxX = Math.max(maxX, fr.origin.x + fr.width);
    minZ = Math.min(minZ, fr.origin.z);
    maxZ = Math.max(maxZ, fr.origin.z + fr.depth);
    minY = Math.min(minY, fr.origin.y);
    maxY = Math.max(maxY, fr.origin.y + fr.height * 1.6);
  }
  const pad = 40;
  const sx = (w - pad * 2) / Math.max(1e-3, maxX - minX);
  const sz = (h - pad * 2) / Math.max(1e-3, maxZ - minZ);
  const sy = (h - pad * 2) / Math.max(1e-3, maxY - minY);
  const s = Math.min(sx, sz, 48);
  const px = (x) => pad + (x - minX) * s;
  const pz = (z) => pad + (z - minZ) * s;
  const py = (y) => h - pad - (y - minY) * Math.min(sy, 36);
  const parts = [svgHeader(w, h, opts.title || `cluster ${mode} ${weather}`)];
  const fillFor = (sem) => {
    if (opts.silhouette) return night ? "#1a2430" : "#2d353b";
    if (String(sem).includes("roof") || sem === "tower-cap") return roof;
    if (sem === "balcony-tile") return tile;
    if (sem === "window-glass") return "#294452";
    if (sem === "fence" || sem === "trim" || sem === "jamb") return "#46545D";
    return wall;
  };
  for (const sol of solids) {
    const fr = sol.frame;
    if (!fr) continue;
    const x0 = fr.origin.x + sol.u0 * fr.width;
    const x1 = fr.origin.x + sol.u1 * fr.width;
    const z0 = fr.origin.z + sol.v0 * fr.depth;
    const z1 = fr.origin.z + sol.v1 * fr.depth;
    const y0 = fr.origin.y + sol.h0 * fr.height;
    const y1 = fr.origin.y + sol.h1 * fr.height;
    const stroke = opts.structure ? "#2d353b" : "#5a6670";
    const sw = opts.structure ? 1.4 : opts.silhouette ? 0.2 : 0.6;
    if (mode === "elev") {
      parts.push(
        `<rect x="${px(x0).toFixed(1)}" y="${py(y1).toFixed(1)}" width="${Math.max(1, px(x1) - px(x0)).toFixed(1)}" height="${Math.max(1, py(y0) - py(y1)).toFixed(1)}" fill="${fillFor(sol.semantic)}" stroke="${stroke}" stroke-width="${sw}"/>`
      );
    } else {
      parts.push(
        `<rect x="${px(Math.min(x0, x1)).toFixed(1)}" y="${pz(Math.min(z0, z1)).toFixed(1)}" width="${Math.max(1, Math.abs(px(x1) - px(x0))).toFixed(1)}" height="${Math.max(1, Math.abs(pz(z1) - pz(z0))).toFixed(1)}" fill="${fillFor(sol.semantic)}" stroke="${stroke}" stroke-width="${sw}" opacity="${sol.kind === "inset-opening" ? 0.35 : 0.92}"/>`
      );
    }
  }
  if (opts.tiles) {
    TILE_ACCENTS.forEach((t, i) => {
      parts.push(`<rect x="${16 + i * 36}" y="${h - 28}" width="28" height="16" fill="${t.hex}" stroke="#46545d"/>`);
    });
  }
  parts.push(`</svg>`);
  return parts.join("");
}

export { STRUCTURAL_SEMANTICS, FAMILY_BUILDERS, PROP_KINDS };
