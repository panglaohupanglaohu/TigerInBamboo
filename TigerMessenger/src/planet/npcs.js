// =====================================================================
//  球面 NPC：固定位置的彩色方块 + 玩家距离检测
// =====================================================================
import * as THREE from "three";
import { placeOnSphere } from "../assets/lowPoly.js";

export const NPC_TALK_RANGE = 5; // 对话提示触发距离（三维直线距离）

/** 固定位置（纬度/经度，度）；红色在出生点正前方约 7 单位 */
export const NPC_DEFS = [
  { name: "红方", color: 0xe76f51, lat: 80, lon: -90 },
  { name: "绿方", color: 0x2a9d8f, lat: 78, lon: 40 },
  { name: "蓝方", color: 0x4361ee, lat: 75, lon: -160 },
];

/**
 * 在球面固定位置生成 NPC 方块（底部贴地）。
 * @returns {{ def: object, group: THREE.Group, position: THREE.Vector3 }[]}
 */
export function createNpcs(scene, planetRadius) {
  return NPC_DEFS.map((def) => {
    const group = new THREE.Group();
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshToonMaterial({ color: def.color })
    );
    cube.position.y = 0.5; // 底部中心对齐局部原点
    cube.castShadow = true;
    group.add(cube);
    placeOnSphere(group, def.lat, def.lon, planetRadius);
    scene.add(group);
    return { def, group, position: group.position };
  });
}

/**
 * 实时计算玩家与每个 NPC 的三维距离，返回距离小于 range 的最近一个。
 * @returns {{ def: object, dist: number } | null}
 */
export function findNearbyNpc(player, npcs, range = NPC_TALK_RANGE) {
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
