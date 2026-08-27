// Building-owned prop slots: attach propPlacement to Townscaper cell bodies.
// Props stay on the occupying cell (userData), never as independent scene
// objects — that would violate PLAN 12.38 nonBuildingPropCount = 0.
import { createModuleCatalog } from "./citadel/moduleCatalog.js";
import { appearancePropHash, placeProps } from "./citadel/propPlacement.js";

const DIRS = Object.freeze([
  Object.freeze({ dx: 1, dz: 0, dir: "+x" }),
  Object.freeze({ dx: -1, dz: 0, dir: "-x" }),
  Object.freeze({ dx: 0, dz: 1, dir: "+z" }),
  Object.freeze({ dx: 0, dz: -1, dir: "-z" }),
]);

function charAt(levels, ix, iy, iz) {
  const row = levels?.[iy]?.[iz];
  if (typeof row !== "string") return ".";
  return row[ix] || ".";
}

function occupied(levels, ix, iy, iz) {
  const ch = charAt(levels, ix, iy, iz);
  return Boolean(ch) && ch !== ".";
}

export function emitBuildingOwnedPropSlots(layout = {}) {
  const terraces = Array.isArray(layout?.terraces) ? layout.terraces : [];
  const slots = [];
  for (const terrace of terraces) {
    const levels = terrace?.levels || [];
    const terraceIndex = Number.isFinite(terrace?.terraceIndex) ? terrace.terraceIndex : 0;
    for (let iy = 0; iy < levels.length; iy++) {
      const rows = levels[iy] || [];
      for (let iz = 0; iz < rows.length; iz++) {
        const row = String(rows[iz] || "");
        for (let ix = 0; ix < row.length; ix++) {
          const ch = row[ix];
          if (!ch || ch === ".") continue;
          const cellId = `${terraceIndex}:${ix},${iy},${iz}`;
          const roof = !occupied(levels, ix, iy + 1, iz);
          for (const { dx, dz, dir } of DIRS) {
            if (occupied(levels, ix + dx, iy, iz + dz)) continue;
            slots.push({
              id: `slot:${cellId}:facade:${dir}`,
              kind: "facade",
              cellId,
              dir,
              u: 0.5,
              v: 0.5,
              h: iy,
              slope: 0,
              clearance: 0.4,
              occluded: false,
              tags: ch === "G" ? ["lamp", "flag"] : ["window", "lamp"],
              buildingOwned: true,
            });
          }
          if (roof) {
            slots.push({
              id: `slot:${cellId}:roof`,
              kind: "roof",
              cellId,
              dir: "up",
              u: 0.5,
              v: 0.5,
              h: iy + 1,
              slope: 0.08,
              clearance: 0.5,
              occluded: false,
              tags: ["flag", "pot"],
              buildingOwned: true,
            });
          }
          if (ch === "G") {
            slots.push({
              id: `slot:${cellId}:doorway`,
              kind: "doorway",
              cellId,
              dir: "+z",
              u: 0.5,
              v: 0,
              h: iy,
              slope: 0,
              clearance: 0.6,
              occluded: false,
              tags: ["lamp", "flag"],
              buildingOwned: true,
            });
          }
        }
      }
    }
  }
  return slots;
}

export function tagPropsWithCatalogRarity(placed = [], catalog = createModuleCatalog()) {
  return placed.map((prop) => {
    const family = prop.kind === "window" || prop.kind === "lamp" || prop.kind === "flag" || prop.kind === "mailbox"
      ? "decor"
      : prop.kind === "pot" || prop.kind === "chimney"
        ? "flowerTile"
        : "decor";
    const match = catalog.byFamily[family]?.find((module) => module.role === prop.kind)
      || catalog.byFamily[family]?.[0]
      || catalog.modules[0];
    return {
      ...prop,
      rarity: match?.rarity || "common",
      catalogId: match?.id || null,
      buildingOwned: true,
    };
  });
}

export function attachBuildingOwnedProps(root, layout, { seed = 1 } = {}) {
  const slots = emitBuildingOwnedPropSlots(layout);
  const placed = tagPropsWithCatalogRarity(placeProps(slots, { seed }));
  const byCell = new Map();
  for (const prop of placed) {
    if (!byCell.has(prop.cellId)) byCell.set(prop.cellId, []);
    byCell.get(prop.cellId).push(prop);
  }
  if (root?.traverse) {
    root.traverse((object) => {
      const module = object.userData?.townModule;
      if (!module) return;
      const cellId = `${module.terraceIndex ?? 0}:${module.ix},${module.iy},${module.iz}`;
      const cellProps = byCell.get(cellId);
      if (cellProps) object.userData.buildingOwnedProps = cellProps;
    });
  }
  if (root?.userData) {
    root.userData.buildingOwnedPropSlots = slots;
    root.userData.buildingOwnedProps = placed;
    root.userData.buildingOwnedPropHash = appearancePropHash(placed);
    root.userData.nonBuildingPropCount = 0;
  }
  if (root?.userData?.highlandLatestDesignMetrics) {
    root.userData.highlandLatestDesignMetrics = {
      ...root.userData.highlandLatestDesignMetrics,
      nonBuildingPropCount: 0,
      buildingOwnedPropCount: placed.length,
    };
  }
  return { slots, placed, hash: appearancePropHash(placed) };
}
