// =====================================================================
//  球面 NPC：固定位置的彩色独特几何体 + 玩家距离检测
// =====================================================================
import * as THREE from "three";
import { placeOnSphere } from "../assets/lowPoly.js";
import { P } from "./params.js";

/** 固定位置（纬度/经度，度）；红色在出生点正前方约 7 单位 */
export const NPC_DEFS = [
  { name: "红方", color: 0xe76f51, lat: 80, lon: -90, shape: "cube" },
  { name: "绿方", color: 0x2a9d8f, lat: 78, lon: 40, shape: "cone" },
  { name: "蓝方", color: 0x4361ee, lat: 75, lon: -160, shape: "sphere" }, // 小蓝
];

/** 每种 NPC 一种独特几何体，底部中心对齐局部原点 */
function buildShape(def) {
  const mat = new THREE.MeshToonMaterial({ color: def.color });
  let mesh;
  if (def.shape === "cone") {
    mesh = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.3, 6), mat);
    mesh.position.y = 0.65;
  } else if (def.shape === "sphere") {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat);
    mesh.position.y = 0.55;
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    mesh.position.y = 0.5;
  }
  mesh.castShadow = true;
  return mesh;
}

/**
 * 在球面固定位置生成 NPC（底部贴地）。
 * @returns {{ def: object, group: THREE.Group, position: THREE.Vector3 }[]}
 */
export function createNpcs(scene, planetRadius) {
  return NPC_DEFS.map((def) => {
    const group = new THREE.Group();
    group.add(buildShape(def));
    placeOnSphere(group, def.lat, def.lon, planetRadius);
    scene.add(group);
    return { def, group, position: group.position };
  });
}

/**
 * 实时计算玩家与每个 NPC 的三维距离，返回距离小于 range 的最近一个。
 * @returns {{ def: object, dist: number } | null}
 */
export function findNearbyNpc(player, npcs, range = P.talkRange) {
  let best = null;
  let bestDist = range;
  for (const n of npcs) {
    const d = player.position.distanceTo(n.position);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best ? { def: best.def, dist: bestDist } : null;
}
