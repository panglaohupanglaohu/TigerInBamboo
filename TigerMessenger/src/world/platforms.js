// =====================================================================
//  世界：球面曲面平台（同心球壳段贴合星球表面）
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "./planet.js";
import { flatXZToLatLon, latLonToDir, quatYToDir } from "./sphereMath.js";
import { createSphericalShellPatch } from "./sphereShell.js";
import { toonMat, outlineAs } from "../assets/toon.js";

/**
 * 平台定义（平面设计坐标）：pos=[x, yHeight, z]，size=半尺寸
 * yHeight = 台面相对星球表面的抬升
 * rock=true 的山石平台：暖灰岩色 + 侧壁/底面噪点（台面保持平整）
 */
export const PLATFORM_DEFS = [
  { pos: [0, 0.6, 0], size: [18, 0.35, 18], color: 0x4aa76c }, // 主岛草地（青绿，硬伤一）
  { pos: [6, 1.2, -4], size: [3.2, 0.3, 3.2], color: 0x8d8880, rock: true },
  { pos: [10, 2.4, -7], size: [2.8, 0.3, 2.8], color: 0x837d75, rock: true },
  { pos: [13, 3.6, -3], size: [2.6, 0.3, 2.6], color: 0x79736c, rock: true },
  { pos: [-7, 1.5, -2], size: [3.0, 0.3, 3.0], color: 0x8d8880, rock: true },
  { pos: [-11, 2.8, 2], size: [2.6, 0.3, 2.6], color: 0x837d75, rock: true },
  { pos: [-9, 4.2, 7], size: [3.4, 0.3, 3.4], color: 0x79736c, rock: true },
  { pos: [0, 2.0, -12], size: [5.0, 0.35, 4.0], color: 0x8a847c, rock: true },
  { pos: [4, 3.4, -15], size: [2.5, 0.3, 2.5], color: 0x7b756d, rock: true },
  { pos: [8, 1.0, 5], size: [2.4, 0.25, 2.4], color: 0x938d84, rock: true },
  { pos: [12, 2.2, 8], size: [2.4, 0.25, 2.4], color: 0x87817a, rock: true },
  { pos: [7, 3.5, 11], size: [3.0, 0.3, 3.0], color: 0x7b756d, rock: true },
  { pos: [-4, 4.8, -18], size: [3.2, 0.3, 3.2], color: 0x6f6a63, rock: true },
  { pos: [1, 5.6, -20], size: [2.4, 0.25, 2.4], color: 0x67625c, rock: true },
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
    const rock = def.rock === true;
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
      // 山石：侧壁/底面径向起伏，台面保持平整
      rockAmp: rock ? Math.max(0.08, thickness * 0.55) : 0,
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
      half: new THREE.Vector3(sx, thickness, sz),
      topHeight: topR,
      curved: true,
      min: new THREE.Vector3(fx - sx, fy - sy, fz - sz),
      max: new THREE.Vector3(fx + sx, fy + sy, fz + sz),
      flatPos: [fx, fy, fz],
      pulsePhase: Math.random() * Math.PI * 2,
      baseEmissive: rock ? 0.015 : 0.06,
      pulseAmp: rock ? 0.008 : 0.05, // 山石几乎不呼吸
    });
  }

  for (const def of PLATFORM_DEFS) addPlatform(def);

  // 日系木路标（与 street 资产同档描边）
  function addWoodPost(x, z, h = 1.5) {
    const group = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, h, 6),
      toonMat(0xc4a06a)
    );
    post.position.y = h / 2;
    post.castShadow = true;
    outlineAs(post, "street");
    group.add(post);
    // 小横板招牌
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.28, 0.06),
      toonMat(0xfff0d6)
    );
    board.position.set(0.2, h * 0.75, 0);
    outlineAs(board, "street");
    group.add(board);

    const { lat, lon } = flatXZToLatLon(x, z, PLANET_RADIUS);
    latLonToDir(lat, lon, _dir);
    group.position.copy(_dir).multiplyScalar(PLANET_RADIUS);
    quatYToDir(_dir, _quat);
    group.quaternion.copy(_quat);
    scene.add(group);
  }
  addWoodPost(-3, -3, 1.35);
  addWoodPost(4, 2, 1.15);
  addWoodPost(-2, 6, 1.45);
  addWoodPost(10, -6, 1.2);

  // 主岛浅青绿光环（白天感，弱 emissive）
  const ringR = PLANET_RADIUS + 0.65;
  const ringTheta = 17.2 / PLANET_RADIUS;
  const ringGeo = new THREE.TorusGeometry(ringR * Math.sin(ringTheta), 0.12, 8, 64);
  const islandRing = new THREE.Mesh(
    ringGeo,
    toonMat(0x7ed9b8, { emissive: 0x3aaa7a, emissiveIntensity: 0.18 })
  );
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
    const amp = p.pulseAmp ?? 0.05;
    p.mat.emissiveIntensity = base + amp * (0.5 + 0.5 * Math.sin(t * 1.2 + phase));
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
