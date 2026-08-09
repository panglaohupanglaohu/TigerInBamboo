// =====================================================================
//  高山圣城 · 瞭望塔（独立建筑）
//  原 citadelRange 前景防御塔：八角石塔 + 瞭望窗 + 雉堞。
//  底部局部 Y=0，可单独摆放，也可被圣城山脉场景复用。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";

const STONE = 0xd6dcd9;
const INK = 0x25292b;
const OUTLINE = 0x1c2523;

function part(geometry, material, name, outline = 0.04) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, outline, OUTLINE, 0);
  return mesh;
}

/**
 * 建造一座独立瞭望塔（局部坐标：底面在 Y=0，塔身沿 +Y）。
 * @param {{ seed?: number }} [opts]
 * @returns {THREE.Group}
 */
export function createCitadelWatchtower(opts = {}) {
  const stone = toonMat(STONE, { flatShading: true });
  const ink = toonMat(INK, { flatShading: true });

  const tower = new THREE.Group();
  tower.name = "citadel-watchtower";

  const lower = part(
    new THREE.CylinderGeometry(4.9, 4.9, 13.5, 8),
    stone,
    "watchtower-lower"
  );
  lower.position.y = 6.75;
  lower.rotation.y = Math.PI / 8;
  tower.add(lower);

  const upper = part(
    new THREE.CylinderGeometry(4.45, 4.45, 4.6, 8),
    stone,
    "watchtower-upper"
  );
  upper.position.y = 15.8;
  upper.rotation.y = Math.PI / 8;
  tower.add(upper);

  const windowGeometry = new THREE.BoxGeometry(1.35, 1.85, 0.12);
  for (const [x, z, rotationY] of [
    [0, 4.43, 0],
    [-4.43, 0, -Math.PI / 2],
    [4.43, 0, Math.PI / 2],
  ]) {
    const window = part(
      windowGeometry,
      ink,
      "watchtower-lookout-window",
      0.022
    );
    window.position.set(x, 15.8, z);
    window.rotation.y = rotationY;
    tower.add(window);
  }

  const parapet = part(
    new THREE.CylinderGeometry(4.72, 4.72, 0.42, 8),
    stone,
    "watchtower-octagonal-parapet",
    0.03
  );
  parapet.position.y = 18.18;
  parapet.rotation.y = Math.PI / 8;
  tower.add(parapet);

  const merlonGeo = new THREE.BoxGeometry(0.82, 0.95, 0.82);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const merlon = part(merlonGeo, stone, "watchtower-crenel", 0.024);
    merlon.position.set(Math.cos(angle) * 4.15, 18.82, Math.sin(angle) * 4.15);
    merlon.rotation.y = -angle;
    tower.add(merlon);
  }

  tower.userData.kind = "citadelWatchtower";
  tower.userData.assetType = "citadelWatchtower";
  tower.userData.collideRadius = 5.2;
  tower.userData.height = 19.3;
  tower.userData.seed = opts.seed ?? 0;
  return tower;
}

/** @deprecated 兼容旧名：前景防御塔 = 瞭望塔 */
export function createCitadelForegroundDefenseTower(opts = {}) {
  const tower = createCitadelWatchtower(opts);
  tower.name = "citadel-foreground-defense-tower";
  return tower;
}
