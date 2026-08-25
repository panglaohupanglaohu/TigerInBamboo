// =====================================================================
//  Module Set Manifests — 古堡 / 高山 / 运河三套 versioned 模块集（V7-G2）
//  共用同一套 solver/schema；差异只在 prototype 子集与版本号，
//  不复制 solver（PLAN 11.11）。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { createModuleSetManifest } from "./moduleSchema.js";
import { migrateCatalogModule } from "./migrateCatalog.js";

/** 从旧 catalog 模块列表构建三类城堡的 module-set manifest */
export function buildCastleModuleSets(oldModules) {
  const byFamily = new Map();
  for (const m of oldModules) {
    if (!byFamily.has(m.family)) byFamily.set(m.family, []);
    byFamily.get(m.family).push(m);
  }
  const pick = (families) =>
    families.flatMap((f) => byFamily.get(f) || []).map(migrateCatalogModule).sort((a, b) => (a.id < b.id ? -1 : 1));

  const highland = createModuleSetManifest({
    id: "highland-citadel",
    moduleSetVersion: "highland-1",
    prototypes: pick([
      "floor",
      "wall",
      "corner",
      "roof",
      "balcony",
      "flowerTile",
      "fence",
      "support",
      "stairs",
      "hole",
      "gate",
      "chimney",
      "drain",
      "decor",
      "tower",
      "bridge",
      "waterside",
    ]),
  });

  const ancient = createModuleSetManifest({
    id: "ancient-fortress",
    moduleSetVersion: "ancient-1",
    prototypes: pick(["wall", "corner", "tower", "gate", "foundation", "roof", "stairs", "hole", "fence", "support"]),
  });

  const canal = createModuleSetManifest({
    id: "canal-citadel",
    moduleSetVersion: "canal-1",
    prototypes: pick(["wall", "bridge", "waterside", "gate", "foundation", "roof", "fence", "support", "drain", "decor"]),
  });

  return { highland, ancient, canal };
}
