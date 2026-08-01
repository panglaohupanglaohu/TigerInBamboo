// =====================================================================
//  玩家：状态对象 + 场景挂载
// =====================================================================
import * as THREE from "three";
import { buildMessenger } from "./messenger.js";

export function createPlayer(scene) {
  const player = {
    position: new THREE.Vector3(0, 2, 6),
    velocity: new THREE.Vector3(0, 0, 0),
    onGround: false,
    yaw: 0, // 面朝方向（弧度）
    holdingLetter: false,
    animPhase: 0,
    checkpoint: new THREE.Vector3(0, 2, 6), // 坠落复位点（接信/送达时刷新）
  };

  const playerGroup = new THREE.Group();
  scene.add(playerGroup);

  const messengerMesh = buildMessenger();
  playerGroup.add(messengerMesh);

  // 持信时头部光环
  const holdAura = new THREE.PointLight(0xffe08a, 0, 4, 2);
  holdAura.position.set(0, 1.6, 0);
  playerGroup.add(holdAura);

  return { player, playerGroup, messengerMesh, holdAura };
}

// 同步视觉：逻辑位置/朝向 → 场景节点
export function syncPlayerVisual(player, playerGroup) {
  playerGroup.position.copy(player.position);
  playerGroup.rotation.y = player.yaw;
}
