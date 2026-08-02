// =====================================================================
//  星球：场景中心半径 40 的球体（南北双半球色彩结界）
//  北半球：沉绿草地（现实人文）；南半球：荒漠淡蓝（莫比斯幻想）
// =====================================================================
import * as THREE from "three";
import { toonMat } from "../assets/toon.js";

export const PLANET_RADIUS = 40;
export const PLANET_COLOR = 0x3f7a58; // 北半球：沉绿
export const SOUTH_COLOR = 0xa5cad6; // 南半球：莫比斯荒漠淡蓝

const _n = new THREE.Color(PLANET_COLOR);
const _s = new THREE.Color(SOUTH_COLOR);
const _c = new THREE.Color();

/**
 * 场景中心星球：玩法在球「外表面」行走（平台/NPC 贴球面）。
 * 顶点色：赤道平滑过渡，南半球淡蓝结界。
 */
export function createPlanet(scene) {
  const geo = new THREE.SphereGeometry(PLANET_RADIUS, 48, 32);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // latFactor：0=北极，1=南极；赤道 ±12° 平滑过渡
    const t = THREE.MathUtils.smoothstep(-y / PLANET_RADIUS, -0.05, 0.3);
    _c.copy(_n).lerp(_s, t);
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const planet = new THREE.Mesh(
    geo,
    toonMat(0xffffff, { vertexColors: true })
  );
  planet.position.set(0, 0, 0);
  planet.receiveShadow = true;
  scene.add(planet);
  return planet;
}
