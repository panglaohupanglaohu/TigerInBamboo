// =====================================================================
//  球面坐标工具：平面设计坐标 (x,y,z) → 北极附近球面贴地
//  约定：旧关卡以 (x,z) 为平面铺展，y 为离地高度；
//        映射到星球表面后，径向 = PLANET_RADIUS + y。
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "./planet.js";

const _yUp = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

/**
 * 平面 (x,z) → 地理纬度/经度（度）。北极 = 距离 0。
 * @returns {{ lat: number, lon: number }}
 */
export function flatXZToLatLon(x, z, radius = PLANET_RADIUS) {
  const dist = Math.hypot(x, z);
  const theta = dist / Math.max(1e-6, radius); // 沿表面弧度
  const lat = 90 - THREE.MathUtils.radToDeg(theta);
  const lon = THREE.MathUtils.radToDeg(Math.atan2(z, x || 1e-9));
  return { lat, lon };
}

/** 纬度经度（度）→ 单位方向 */
export function latLonToDir(latDeg, lonDeg, out = new THREE.Vector3()) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return out.set(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  );
}

/**
 * 平面点 (x, yHeight, z) → 世界位置（径向 = R + yHeight）
 */
export function flatToWorld(x, yHeight, z, radius = PLANET_RADIUS, out = new THREE.Vector3()) {
  const { lat, lon } = flatXZToLatLon(x, z, radius);
  latLonToDir(lat, lon, _dir);
  return out.copy(_dir).multiplyScalar(radius + yHeight);
}

/** 单位方向 → 让局部 +Y 对齐该方向的四元数 */
export function quatYToDir(dir, out = new THREE.Quaternion()) {
  _dir.copy(dir).normalize();
  return out.setFromUnitVectors(_yUp, _dir);
}

/**
 * 把 Object3D 贴到球面：底部在 R+height，局部 +Y = 法线。
 */
export function placeObjectOnSphere(obj, x, z, height = 0, radius = PLANET_RADIUS) {
  const { lat, lon } = flatXZToLatLon(x, z, radius);
  latLonToDir(lat, lon, _dir);
  obj.position.copy(_dir).multiplyScalar(radius + height);
  quatYToDir(_dir, _quat);
  obj.quaternion.copy(_quat);
  return obj;
}

/** 世界点到球心距离 */
export function radialLength(pos) {
  return pos.length();
}

/** 位置处的单位法线（向外） */
export function surfaceNormal(pos, out = new THREE.Vector3()) {
  return out.copy(pos).normalize();
}

/** 球面弦长近似水平距离（交互用） */
export function surfaceDist(a, b) {
  return a.distanceTo(b);
}

export { PLANET_RADIUS };
