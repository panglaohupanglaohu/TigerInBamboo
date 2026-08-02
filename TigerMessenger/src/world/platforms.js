// =====================================================================
//  世界：球面曲面平台（同心球壳段贴合星球表面）
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "./planet.js";
import { flatXZToLatLon, latLonToDir, quatYToDir } from "./sphereMath.js";
import { createSphericalShellPatch } from "./sphereShell.js";
import { toonMat, outlineAs } from "../assets/toon.js";
import { groundLiftAt, pondDepressionAt } from "./hills.js";

/**
 * 平台定义（平面设计坐标）：pos=[x, yHeight, z]，size=半尺寸
 * yHeight = 台面相对星球表面的抬升
 * 原浮空岩石平台已全部改为 hills.js 的连绵土坡（高度场，视觉=碰撞）
 */
export const PLATFORM_DEFS = [
  {
    pos: [0, 0.6, 0],
    size: [18, 0.35, 18],
    color: 0x55875f,
    // 主岛壳体和 hills.js 使用同一池盆高度场，水下不会再有一层平板地面。
    heightOffsetAt: pondDepressionAt,
    // 台面外缘向球面地面连续摊开，禁止出现垂直平台断墙。
    rampWidth: 4.5,
  },
];

const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _right = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _tmpPlatformDelta = new THREE.Vector3();

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
    const rock = def.rock === true;
    const rampWidth = Math.max(0, def.rampWidth ?? 0);
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
      // 山石：底面径向起伏；普通台面边缘统一使用土坡收口
      rockAmp: rock ? Math.max(0.08, thickness * 0.55) : 0,
      heightOffsetAt: def.heightOffsetAt || null,
      rampWidth,
      // 先给出岛面/土坡基础高度，再由 sphereShell 叠加池盆下挖量。
      rampRadiusAt: rampWidth > 0
        ? (u, v) => PLANET_RADIUS + groundLiftAt(u, v) - (def.heightOffsetAt?.(u, v) ?? 0)
        : null,
    });

    // Cel 卡通材质（2 阶梯渐变，明暗硬分界）；草地保留微光呼吸
    const mat = toonMat(def.color, {
      emissive: def.color,
      emissiveIntensity: rock ? 0.015 : 0.06,
    });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const edge = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial(
        rock
          ? { color: 0x453f38, transparent: true, opacity: 0.55 } // 岩缝暗线
          : { color: 0x6a8aba, transparent: true, opacity: 0.45 }
      )
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
      surfaceHalf: new THREE.Vector3(sx, thickness, sz),
      half: new THREE.Vector3(sx + rampWidth, thickness, sz + rampWidth),
      rampWidth,
      topHeight: topR,
      heightOffsetAt: def.heightOffsetAt || null,
      topHeightAt(pos) {
        const delta = _tmpPlatformDelta.copy(pos).sub(this.center);
        const u = delta.dot(this.right);
        const v = delta.dot(this.forward);
        const innerU = this.surfaceHalf.x;
        const innerV = this.surfaceHalf.z;
        const edgeU = THREE.MathUtils.clamp(u, -innerU, innerU);
        const edgeV = THREE.MathUtils.clamp(v, -innerV, innerV);
        const edgeHeight = this.topHeight + (this.heightOffsetAt?.(edgeU, edgeV) ?? 0);
        const outside = Math.max(Math.abs(u) - innerU, Math.abs(v) - innerV);
        if (outside <= 0 || this.rampWidth <= 0) return edgeHeight;
        const t = THREE.MathUtils.clamp(outside / this.rampWidth, 0, 1);
        const eased = t * t * (3 - 2 * t);
        const groundHeight = PLANET_RADIUS + groundLiftAt(u, v);
        return THREE.MathUtils.lerp(edgeHeight, groundHeight, eased);
      },
      curved: true,
      min: new THREE.Vector3(fx - sx - rampWidth, fy - sy, fz - sz - rampWidth),
      max: new THREE.Vector3(fx + sx + rampWidth, fy + sy, fz + sz + rampWidth),
      flatPos: [fx, fy, fz],
      pulsePhase: Math.random() * Math.PI * 2,
      baseEmissive: rock ? 0.015 : 0.06,
      pulseAmp: rock ? 0.008 : 0.05, // 山石几乎不呼吸
    });
  }

  for (const def of PLATFORM_DEFS) addPlatform(def);

  platforms.planetRadius = PLANET_RADIUS;

  return platforms;
}

export function updatePlatformPulse(platforms, t) {
  for (const p of platforms) {
    if (!p.mat) continue;
    const phase = p.pulsePhase || 0;
    const base = p.baseEmissive ?? 0.06;
    const amp = p.pulseAmp ?? 0.05;
    p.mat.emissiveIntensity = base + amp * (0.5 + 0.5 * Math.sin(t * 1.2 + phase));
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
