// =====================================================================
//  Townscaper 模块目录（G3）
//  2450 = 组合空间指标，不是 2450 个独立 Mesh。
// =====================================================================

import { TOWNSCAPER_MODULE_FAMILIES, TOWNSCAPER_MODULE_VARIANTS } from "./moduleFamilies.js";

export const MODULE_COMBINATION_SPACE = TOWNSCAPER_MODULE_VARIANTS;

const SOCKET = Object.freeze({
  wall: "wall",
  open: "open",
  roof: "roof",
  support: "support",
  tile: "tile",
  water: "water",
});

const EXTRA_FAMILIES = Object.freeze({
  roof: Object.freeze(["hip", "gable", "dome", "flat"]),
  bridge: Object.freeze(["short", "arch"]),
  gate: Object.freeze(["main", "postern"]),
  flowerTile: Object.freeze(["coral", "teal", "mustard", "sage"]),
});

function socketsFor(family, variant) {
  const open = SOCKET.open;
  const wall = SOCKET.wall;
  if (family === "hole" || family === "gate") {
    return { N: open, E: wall, S: open, W: wall, U: SOCKET.roof, D: SOCKET.support };
  }
  if (family === "balcony" || family === "flowerTile") {
    return { N: open, E: wall, S: wall, W: wall, U: open, D: SOCKET.support };
  }
  if (family === "stairs") {
    return { N: open, E: wall, S: open, W: wall, U: open, D: SOCKET.support };
  }
  if (family === "foundation") {
    return { N: wall, E: wall, S: wall, W: wall, U: wall, D: SOCKET.support };
  }
  return { N: wall, E: wall, S: wall, W: wall, U: SOCKET.roof, D: SOCKET.support };
}

function rarityFor(family, variant) {
  if (family === "decor" && (variant === "clothesline" || variant === "oculus")) return "rare";
  if (family === "flowerTile") return "uncommon";
  if (family === "bridge") return "uncommon";
  return "common";
}

export function createModuleCatalog() {
  const modules = [];
  const families = { ...TOWNSCAPER_MODULE_FAMILIES, ...EXTRA_FAMILIES };
  for (const family of Object.keys(families).sort()) {
    for (const variant of families[family]) {
      const id = `${family}.${variant}.v1`;
      const rare = rarityFor(family, variant);
      modules.push(
        Object.freeze({
          id,
          family,
          role: variant,
          sockets: Object.freeze(socketsFor(family, variant)),
          requires: Object.freeze(
            family === "balcony" ? ["walkable-front", "support-below"] : family === "stairs" ? ["support-below"] : []
          ),
          forbids: Object.freeze(
            family === "gate" ? ["water-intersection"] : family === "flowerTile" ? ["grass-walk"] : []
          ),
          transforms: Object.freeze(["r0", "r90", "r180", "r270"]),
          paletteSlots: Object.freeze(
            family === "balcony" || family === "flowerTile"
              ? ["wall.main", "tile.accent", "trim.dark"]
              : ["wall.main", "trim.dark"]
          ),
          weight: rare === "rare" ? 0.35 : rare === "uncommon" ? 0.7 : 1,
          rarity: rare,
          meshFactory: `${family}:${variant}`,
          walkSurface: family === "balcony" || family === "flowerTile" ? "flower-tile" : null,
        })
      );
    }
  }
  modules.sort((a, b) => (a.id < b.id ? -1 : 1));
  return Object.freeze({
    combinationSpace: MODULE_COMBINATION_SPACE,
    modules: Object.freeze(modules),
    byId: Object.freeze(Object.fromEntries(modules.map((m) => [m.id, m]))),
    byFamily: Object.freeze(
      modules.reduce((acc, m) => {
        acc[m.family] = acc[m.family] || [];
        acc[m.family].push(m);
        return acc;
      }, {})
    ),
  });
}

export function encodeSignature(cell, world = {}) {
  const occ = cell.occupancy || { N: 0, E: 0, S: 0, W: 0, U: 0, D: 1 };
  const diag = cell.diagonals || 0;
  const semantic = cell.semantic || "block";
  const support = cell.support ?? 1;
  const exposure = cell.exposure ?? 0;
  const route = cell.routeClearance ?? 0;
  return [occ.N, occ.E, occ.S, occ.W, occ.U, occ.D, diag, semantic, support, exposure, route].join("|");
}

export function catalogMatch(catalog, signature, familyHint = null) {
  const list = familyHint && catalog.byFamily[familyHint] ? catalog.byFamily[familyHint] : catalog.modules;
  return list.filter((m) => {
    if (signature.includes("gate") && m.family !== "gate" && m.family !== "hole") return signature.includes("block");
    return true;
  });
}
