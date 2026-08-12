// =====================================================================
//  星球：场景中心半径 40 的球体（南北双半球色彩结界）
//  北半球：沉绿草地（现实人文）；南半球：荒漠淡蓝（莫比斯幻想）
// =====================================================================
import * as THREE from "three";
import { toonMat } from "../assets/toon.js";
import { CANYON, applyCanyonToGeometry, canyonOffsetDir } from "./canyon.js";
import { WORLD_RADIUS } from "./worldScale.js";

export const PLANET_RADIUS = WORLD_RADIUS;
export const PLANET_COLOR = 0x3f7a58; // 北半球：沉绿
export const SOUTH_COLOR = 0xa5cad6; // 南半球：莫比斯荒漠淡蓝

const _n = new THREE.Color(PLANET_COLOR);
const _s = new THREE.Color(SOUTH_COLOR);
const _c = new THREE.Color();
const _canyonShade = new THREE.Color(0x789aa8);
const _dir = new THREE.Vector3();

/**
 * 场景中心星球：玩法在球「外表面」行走（平台/NPC 贴球面）。
 * 顶点色：赤道平滑过渡，南半球淡蓝结界；
 * 顶点位移：莫比斯大峡谷阶梯式塌陷（canyon.js）。
 */
export function createPlanet(scene) {
  const geo = new THREE.SphereGeometry(PLANET_RADIUS, 48, 32);
  // 先挖峡谷（阶梯台地），再重算法线
  applyCanyonToGeometry(geo, PLANET_RADIUS);
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || PLANET_RADIUS;
    _dir.set(x / len, y / len, z / len);
    // 南半球高架从约 -8° 开始；-5° 后即完全转为沙蓝，桥下不再露绿色草球。
    const t = THREE.MathUtils.smoothstep(-y / len, -0.02, 0.08);
    _c.copy(_n).lerp(_s, t);
    const canyonDrop = canyonOffsetDir(_dir);
    if (canyonDrop < 0) {
      const stepSize = CANYON.depth / CANYON.steps;
      const step = Math.round(Math.abs(canyonDrop) / stepSize);
      const depthFactor = Math.abs(canyonDrop) / CANYON.depth;
      // 交替深浅的沙蓝阶地，模拟莫比斯手绘排线与粗犷几何切面。
      const shade = 0.08 + depthFactor * 0.18 + (step % 2) * 0.055;
      _c.copy(_s).lerp(_canyonShade, shade);
    }
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const planet = new THREE.Mesh(
    geo,
    toonMat(0xffffff, { vertexColors: true, flatShading: true })
  );
  planet.name = "planet-surface";
  planet.position.set(0, 0, 0);
  planet.receiveShadow = true;
  scene.add(planet);
  return planet;
}
