// =====================================================================
//  星球：场景中心半径 40 的淡青色球体（游戏星球）
// =====================================================================
import * as THREE from "three";

export const PLANET_RADIUS = 40;
export const PLANET_COLOR = 0xa8e6e3; // 淡青色

/**
 * 场景中心星球：玩法在球「外表面」行走（平台/NPC 贴球面）。
 */
export function createPlanet(scene) {
  const geo = new THREE.SphereGeometry(PLANET_RADIUS, 48, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: PLANET_COLOR,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: true,
  });
  const planet = new THREE.Mesh(geo, mat);
  planet.position.set(0, 0, 0);
  planet.receiveShadow = true;
  scene.add(planet);
  return planet;
}
