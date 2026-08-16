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
const _uprightUp = new THREE.Vector3();
const _uprightFwd = new THREE.Vector3();
const _uprightRight = new THREE.Vector3();
const _uprightBasis = new THREE.Matrix4();

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
 * 球面直立四元数：局部 +Y = 径向 up，局部 +Z = forward 在切平面上的投影。
 * 建筑/城堡必须用这个。`setFromUnitVectors(+Z, fwd)` 只会把朝向拧到切向，
 * 局部 +Y 会离开法线，看起来整座城斜插在运河上。
 */
export function quatUprightOnSphere(upDir, forwardDir, out = new THREE.Quaternion()) {
  _uprightUp.copy(upDir).normalize();
  _uprightFwd.copy(forwardDir);
  _uprightFwd.addScaledVector(_uprightUp, -_uprightFwd.dot(_uprightUp));
  if (_uprightFwd.lengthSq() < 1e-8) {
    _uprightFwd.set(0, 0, 1).addScaledVector(_uprightUp, -_uprightUp.z);
    if (_uprightFwd.lengthSq() < 1e-8) {
      _uprightFwd.set(1, 0, 0).addScaledVector(_uprightUp, -_uprightUp.x);
    }
  }
  _uprightFwd.normalize();
  _uprightRight.crossVectors(_uprightUp, _uprightFwd).normalize();
  _uprightFwd.crossVectors(_uprightRight, _uprightUp).normalize();
  return out.setFromRotationMatrix(
    _uprightBasis.makeBasis(_uprightRight, _uprightUp, _uprightFwd)
  );
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
