// =====================================================================
//  V4 调试 overlay（Three.js）：仅 citadelTownV4 开启时挂到城堡，不替换旧网格
// =====================================================================

import * as THREE from "three";
import { resolveBuildingTheme } from "./visualTheme.js";

export function createTownV4Overlay(v4) {
  const group = new THREE.Group();
  group.name = "citadel-v4-town-overlay";
  const cells = v4.town?.cells || [];
  const geo = new THREE.BoxGeometry(0.55, 0.18, 0.55);
  const mats = new Map();
  const max = Math.min(cells.length, 80);
  for (let i = 0; i < max; i++) {
    const cell = cells[i];
    const theme = resolveBuildingTheme(cell.cellId || cell.module?.id || String(i), { seed: v4.seed || 7 });
    const hex = theme.wallMain;
    let mat = mats.get(hex);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.88, metalness: 0 });
      mats.set(hex, mat);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((i % 10) * 0.7 - 3.5, 0.2, Math.floor(i / 10) * 0.7);
    mesh.userData.v4Cell = cell.cellId;
    group.add(mesh);
  }
  group.visible = true;
  group.userData.kind = "citadel-v4-overlay";
  return group;
}

/** 混合态调试层：V6 外观 + legacy 碰撞时才可见。合法 snapshot 入队前已断言，正常不会挂上。 */
export function syncMixedStateOverlay(castle, sources) {
  if (!castle) return null;
  const mixed = sources?.visual === "v6" && sources?.walk === "legacy";
  let g = castle.getObjectByName?.("citadel-mixed-state");
  if (!mixed) {
    if (g) g.removeFromParent();
    return null;
  }
  if (!g) {
    g = new THREE.Group();
    g.name = "citadel-mixed-state";
    castle.add(g);
  }
  g.visible = true;
  g.userData.kind = "citadel-mixed-state";
  g.userData.mixed = true;
  g.userData.sources = sources;
  return g;
}
