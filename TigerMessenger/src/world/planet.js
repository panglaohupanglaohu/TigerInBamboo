// =====================================================================
//  星球：场景中心半径 40 的淡青色球体（游戏星球）
// =====================================================================
import * as THREE from "three";

export const PLANET_RADIUS = 40;
export const PLANET_COLOR = 0xa8e6e3; // 淡青色

/**
 * 在场景中心 (0,0,0) 创建星球球体。
 * 注意：当前玩法世界（±20 范围）位于球体内部，默认 FrontSide 材质
 * 从球内观察会被背面剔除（不可见）；作为世界外壳/远景基底存在。
 */
export function createPlanet(scene) {
  const geo = new THREE.SphereGeometry(PLANET_RADIUS, 32, 24);
  const mat = new THREE.MeshStandardMaterial({
    color: PLANET_COLOR,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true, // 与全场景低多边风格一致
  });
  const planet = new THREE.Mesh(geo, mat);
  planet.position.set(0, 0, 0);
  planet.receiveShadow = true;
  scene.add(planet);
  return planet;
}
