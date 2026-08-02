// =====================================================================
//  星球：场景中心半径 40 的球体（游戏星球 · 青绿草地）
// =====================================================================
import * as THREE from "three";
import { toonMat } from "../assets/toon.js";

export const PLANET_RADIUS = 40;
export const PLANET_COLOR = 0x3d9a5f; // 偏深青绿（与薄荷天空形成插画对比）

/**
 * 场景中心星球：玩法在球「外表面」行走（平台/NPC 贴球面）。
 * Cel 卡通材质 + 接收投影。
 */
export function createPlanet(scene) {
  const geo = new THREE.SphereGeometry(PLANET_RADIUS, 48, 32);
  const planet = new THREE.Mesh(geo, toonMat(PLANET_COLOR));
  planet.position.set(0, 0, 0);
  planet.receiveShadow = true;
  scene.add(planet);
  return planet;
}
