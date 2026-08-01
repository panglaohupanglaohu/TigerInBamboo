// =====================================================================
//  世界：球面曲面平台（同心球壳段贴合星球表面）
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "./planet.js";
import { flatXZToLatLon, latLonToDir, quatYToDir } from "./sphereMath.js";
import { createSphericalShellPatch } from "./sphereShell.js";

/**
 * 平台定义（平面设计坐标）：pos=[x, yHeight, z]，size=半尺寸
 * yHeight = 台面相对星球表面的抬升
 */
export const PLATFORM_DEFS = [
  { pos: [0, 0.6, 0], size: [18, 0.35, 18], color: 0x1a2740 },
  { pos: [6, 1.2, -4], size: [3.2, 0.3, 3.2], color: 0x243656 },
  { pos: [10, 2.4, -7], size: [2.8, 0.3, 2.8], color: 0x2a3d62 },
  { pos: [13, 3.6, -3], size: [2.6, 0.3, 2.6], color: 0x31486f },
  { pos: [-7, 1.5, -2], size: [3.0, 0.3, 3.0], color: 0x243656 },
  { pos: [-11, 2.8, 2], size: [2.6, 0.3, 2.6], color: 0x2a3d62 },
  { pos: [-9, 4.2, 7], size: [3.4, 0.3, 3.4], color: 0x31486f },
  { pos: [0, 2.0, -12], size: [5.0, 0.35, 4.0], color: 0x2c4160 },
  { pos: [4, 3.4, -15], size: [2.5, 0.3, 2.5], color: 0x35507a },
  { pos: [8, 1.0, 5], size: [2.4, 0.25, 2.4], color: 0x243656 },
  { pos: [12, 2.2, 8], size: [2.4, 0.25, 2.4], color: 0x2a3d62 },
  { pos: [7, 3.5, 11], size: [3.0, 0.3, 3.0], color: 0x31486f },
  { pos: [-4, 4.8, -18], size: [3.2, 0.3, 3.2], color: 0x3a5588 },
  { pos: [1, 5.6, -20], size: [2.4, 0.25, 2.4], color: 0x4568a0 },
];

const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _right = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/**
 * 按平台半宽选择细分：大岛更密，小台够用即可
 */
function segsForHalf(half) {
  const s = Math.ceil(half * 0.7);
  return Math.min(28, Math.max(6, s));
}

export function buildWorld(scene) {
  const platforms = [];

  function addPlatform(def) {
    const [sx, sy, sz] = def.size;
    const [fx, fy, fz] = def.pos;
    const { lat, lon } = flatXZToLatLon(fx, fz, PLANET_RADIUS);
    latLonToDir(lat, lon, _dir);
    quatYToDir(_dir, _quat);

    const topR = PLANET_RADIUS + fy;
    const thickness = Math.max(0.12, sy);

    _right.set(1, 0, 0).applyQuaternion(_quat).normalize();
    _fwd.set(0, 0, 1).applyQuaternion(_quat).normalize();

    const segsW = segsForHalf(sx);
    const segsD = segsForHalf(sz);
    const { geometry, edgeGeometry } = createSphericalShellPatch({
      centerDir: _dir,
      right: _right,
      forward: _fwd,
      halfW: sx,
      halfD: sz,
      outerR: topR,
      thickness,
      segsW,
      segsD,
    });

    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 0.06,
      roughness: 0.82,
      metalness: 0.08,
      flatShading: true,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const edge = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({ color: 0x6a8aba, transparent: true, opacity: 0.45 })
    );
    scene.add(edge);

    // 碰撞用：中心取台面中心方向上的点（半径 topR）
    const center = _dir.clone().multiplyScalar(topR);

    platforms.push({
      mesh,
      mat,
      edge,
      center,
      normal: _dir.clone(),
      right: _right.clone(),
      forward: _fwd.clone(),
      quat: _quat.clone(),
      half: new THREE.Vector3(sx, thickness, sz),
      topHeight: topR,
      curved: true,
      min: new THREE.Vector3(fx - sx, fy - sy, fz - sz),
      max: new THREE.Vector3(fx + sx, fy + sy, fz + sz),
      flatPos: [fx, fy, fz],
      pulsePhase: Math.random() * Math.PI * 2,
      baseEmissive: 0.06,
    });
  }

  for (const def of PLATFORM_DEFS) addPlatform(def);

  function addPillar(x, z, h = 1.8, color = 0x3a5078) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, h, 6),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.12,
        roughness: 0.75,
        flatShading: true,
      })
    );
    const { lat, lon } = flatXZToLatLon(x, z, PLANET_RADIUS);
    latLonToDir(lat, lon, _dir);
    mesh.position.copy(_dir).multiplyScalar(PLANET_RADIUS + h / 2);
    quatYToDir(_dir, _quat);
    mesh.quaternion.copy(_quat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  addPillar(-3, -3, 1.4);
  addPillar(4, 2, 1.1, 0x4a6088);
  addPillar(-2, 6, 1.6, 0x355070);
  addPillar(10, -6, 1.2, 0x406088);

  // 主岛曲面光环：小纬度环贴在 R+0.65
  const ringR = PLANET_RADIUS + 0.65;
  const ringTheta = 17.2 / PLANET_RADIUS;
  const ringGeo = new THREE.TorusGeometry(ringR * Math.sin(ringTheta), 0.14, 8, 64);
  const islandRing = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({
      color: 0x4a6a9a,
      emissive: 0x2a5088,
      emissiveIntensity: 0.55,
      roughness: 0.6,
      flatShading: true,
    })
  );
  // 环中心在北极轴上，环平面水平 → 贴在北极附近球带
  islandRing.position.set(0, ringR * Math.cos(ringTheta), 0);
  islandRing.rotation.x = Math.PI / 2;
  scene.add(islandRing);

  platforms._islandRing = islandRing;
  platforms.planetRadius = PLANET_RADIUS;

  return platforms;
}

export function updatePlatformPulse(platforms, t) {
  for (const p of platforms) {
    if (!p.mat) continue;
    const phase = p.pulsePhase || 0;
    const base = p.baseEmissive ?? 0.06;
    p.mat.emissiveIntensity = base + 0.05 * (0.5 + 0.5 * Math.sin(t * 1.2 + phase));
  }
  const ring = platforms._islandRing;
  if (ring && ring.material) {
    ring.material.emissiveIntensity = 0.4 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.9));
  }
}

export function findPlatformTopAtFlat(platforms, x, z) {
  for (const p of platforms) {
    if (
      x >= p.min.x - 0.15 &&
      x <= p.max.x + 0.15 &&
      z >= p.min.z - 0.15 &&
      z <= p.max.z + 0.15
    ) {
      return p;
    }
  }
  return null;
}
