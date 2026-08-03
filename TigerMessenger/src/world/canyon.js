// =====================================================================
//  莫比斯大峡谷（The Great Canyon）：南半球阶梯式塌陷地形
//  同一套数学供三方使用：planet 顶点改造 / 晶林扎根 / 高架桥墩落点
// =====================================================================
import * as THREE from "three";

export const CANYON = Object.freeze({
  lat: -50, // 谷心纬度
  lon: -112, // 谷心经度
  rim: 0.55, // 谷缘角半径（rad）
  depth: 11, // 最大塌陷深度
  steps: 5, // 阶梯层数（刀劈斧凿切面）
});

const _cLat = THREE.MathUtils.degToRad(CANYON.lat);
const _cLon = THREE.MathUtils.degToRad(CANYON.lon);

/** 经纬度 → 峡谷沉降量（0 = 谷缘外；负值 = 下陷，阶梯量化） */
export function canyonOffset(latDeg, lonDeg) {
  const la = THREE.MathUtils.degToRad(latDeg);
  const lo = THREE.MathUtils.degToRad(lonDeg);
  const cosd =
    Math.sin(la) * Math.sin(_cLat) +
    Math.cos(la) * Math.cos(_cLat) * Math.cos(lo - _cLon);
  const d = Math.acos(THREE.MathUtils.clamp(cosd, -1, 1));
  if (d > CANYON.rim) return 0;
  const t = 1 - d / CANYON.rim;
  const stepped = Math.floor(t * CANYON.steps) / CANYON.steps; // 阶梯式台地
  return -CANYON.depth * stepped;
}

/** 归一化方向 → 峡谷沉降量 */
export function canyonOffsetDir(dir) {
  const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(dir.z, dir.x));
  return canyonOffset(lat, lon);
}

/** 把球体几何顶点按峡谷函数内陷（调用后需 computeVertexNormals） */
export function applyCanyonToGeometry(geo, R) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    if (len < 1e-6) continue;
    v.multiplyScalar(1 / len); // 归一化得方向
    const off = canyonOffsetDir(v);
    if (off !== 0) {
      v.multiplyScalar(R + off);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
}
