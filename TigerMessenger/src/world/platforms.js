// =====================================================================
//  世界：地面 + 悬空平台
// =====================================================================
import * as THREE from "three";

/** 平台定义：中心点 + 半尺寸（x,y,z） */
export const PLATFORM_DEFS = [
  // 主地面（大岛）
  { pos: [0, 0, 0], size: [18, 0.6, 18], color: 0x1a2740 },
  // 近处阶梯平台
  { pos: [6, 1.2, -4], size: [3.2, 0.35, 3.2], color: 0x243656 },
  { pos: [10, 2.4, -7], size: [2.8, 0.35, 2.8], color: 0x2a3d62 },
  { pos: [13, 3.6, -3], size: [2.6, 0.35, 2.6], color: 0x31486f },
  // 左侧浮岛链
  { pos: [-7, 1.5, -2], size: [3.0, 0.35, 3.0], color: 0x243656 },
  { pos: [-11, 2.8, 2], size: [2.6, 0.35, 2.6], color: 0x2a3d62 },
  { pos: [-9, 4.2, 7], size: [3.4, 0.35, 3.4], color: 0x31486f },
  // 前方高台
  { pos: [0, 2.0, -12], size: [5.0, 0.4, 4.0], color: 0x2c4160 },
  { pos: [4, 3.4, -15], size: [2.5, 0.35, 2.5], color: 0x35507a },
  // 右侧小跳台
  { pos: [8, 1.0, 5], size: [2.4, 0.3, 2.4], color: 0x243656 },
  { pos: [12, 2.2, 8], size: [2.4, 0.3, 2.4], color: 0x2a3d62 },
  { pos: [7, 3.5, 11], size: [3.0, 0.35, 3.0], color: 0x31486f },
  // 远北浮岛（第 4 封信）
  { pos: [-4, 4.8, -18], size: [3.2, 0.35, 3.2], color: 0x3a5588 },
  { pos: [1, 5.6, -20], size: [2.4, 0.3, 2.4], color: 0x4568a0 },
];

/** @type {{ min: THREE.Vector3, max: THREE.Vector3, mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial }[]} */
export function buildWorld(scene) {
  const platforms = [];

  function addPlatform(def) {
    const [sx, sy, sz] = def.size;
    const geo = new THREE.BoxGeometry(sx * 2, sy * 2, sz * 2);
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 0.06,
      roughness: 0.82,
      metalness: 0.08,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // 顶面边缘高光线（低多边“二次元”勾边感）
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 25),
      new THREE.LineBasicMaterial({ color: 0x6a8aba, transparent: true, opacity: 0.4 })
    );
    edge.position.copy(mesh.position);
    scene.add(edge);

    const half = new THREE.Vector3(sx, sy, sz);
    const center = mesh.position;
    platforms.push({
      min: new THREE.Vector3(center.x - half.x, center.y - half.y, center.z - half.z),
      max: new THREE.Vector3(center.x + half.x, center.y + half.y, center.z + half.z),
      mesh,
      mat,
      pulsePhase: Math.random() * Math.PI * 2,
      baseEmissive: 0.06,
    });
  }

  for (const def of PLATFORM_DEFS) addPlatform(def);

  // 主地面上的简单装饰柱（路标）
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
    mesh.position.set(x, h / 2 + 0.6, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  addPillar(-3, -3, 1.4);
  addPillar(4, 2, 1.1, 0x4a6088);
  addPillar(-2, 6, 1.6, 0x355070);
  addPillar(10, -6, 1.2, 0x406088);

  // 主岛边缘一圈矮栏（视觉层次）
  const islandRing = new THREE.Mesh(
    new THREE.TorusGeometry(17.2, 0.12, 6, 40),
    new THREE.MeshStandardMaterial({
      color: 0x4a6a9a,
      emissive: 0x2a5088,
      emissiveIntensity: 0.55,
      roughness: 0.6,
      flatShading: true,
    })
  );
  islandRing.rotation.x = Math.PI / 2;
  islandRing.position.y = 0.65;
  scene.add(islandRing);

  // 供脉动动画使用
  platforms._islandRing = islandRing;

  return platforms;
}

/** 平台 / 岛环 emissive 脉动 */
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
