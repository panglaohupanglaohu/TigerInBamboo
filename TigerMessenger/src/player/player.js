// =====================================================================
//  玩家：状态 + 信使网格；球面视觉同步（法线对齐）
// =====================================================================
import * as THREE from "three";
import { buildAgentMessenger } from "./agentMessenger.js";
import { flatToWorld, surfaceNormal } from "../world/sphereMath.js";
import { PLANET_RADIUS } from "../world/planet.js";
import { WORLD_SCALE } from "../world/worldScale.js";
import { registerLocalLight } from "../render/lighting/localLightRegistry.js";

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _quat = new THREE.Quaternion();

export function createPlayer(scene) {
  // 出生：旧平面 (0, 2, 6) → 球面。2026-08-27 主人验收：默认视角必须看到
  // 高山城堡全貌 + 上方白云——原 z=24（湖边）离城堡太近，平视画面只到
  // 城堡 y≈15，城堡顶与白云（y≈43）都在画面顶部之外。出生点拉到湖对岸
  // z=60（湖 chart 末端），城堡全景与白云进入默认画面。
  const spawn = flatToWorld(0, 2, 15 * WORLD_SCALE, PLANET_RADIUS);

  const player = {
    position: spawn.clone(),
    velocity: new THREE.Vector3(0, 0, 0),
    onGround: false,
    yaw: 0,
    // 出生朝向：高山圣城（城堡/台地）在本地 -z 方向；默认视角应看到
    // 城堡而不是面向湖面（2026-08-27 主人验收：默认视角看不到城堡）。
    facing: new THREE.Vector3(0, 0, -1),
    forward: new THREE.Vector3(0, 0, -1),
    holdingLetter: false,
    animPhase: 0,
    checkpoint: spawn.clone(),
    groundR: PLANET_RADIUS + 2,
  };

  const playerGroup = new THREE.Group();
  scene.add(playerGroup);

  // 主人规格：送信人 = AgentsGroup2026 数字孪生智能体（非竹虎）
  const messengerMesh = buildAgentMessenger();
  playerGroup.add(messengerMesh);

  const holdAura = new THREE.PointLight(0x72d7e7, 0, 4, 2);
  holdAura.position.set(0, 0.75, 0); // 智能体工作核心高度（缩放后）
  playerGroup.add(holdAura);
  // K4：持信光环迁入 registry（玩家相关，优先级高于场景氛围灯）
  registerLocalLight(holdAura, {
    id: "player-hold-aura",
    owner: "player",
    kind: "point",
    color: 0x72d7e7,
    intensity: 0,
    radius: 4,
    priority: 8,
  });

  syncPlayerVisual(player, playerGroup);
  return { player, playerGroup, messengerMesh, holdAura };
}

/** 脚底位置 + 法线/朝向 → Group */
export function syncPlayerVisual(player, playerGroup) {
  playerGroup.position.copy(player.position);

  const up = surfaceNormal(player.position, _up);
  let fwd = player.forward || player.facing;
  if (!fwd || fwd.lengthSq() < 1e-6) fwd = new THREE.Vector3(0, 0, 1);
  _fwd.copy(fwd).addScaledVector(up, -fwd.dot(up));
  if (_fwd.lengthSq() < 1e-6) {
    // 任意切向
    _fwd.set(0, 0, 1).addScaledVector(up, -up.z);
    if (_fwd.lengthSq() < 1e-6) _fwd.set(1, 0, 0).addScaledVector(up, -up.x);
  }
  _fwd.normalize();
  _right.crossVectors(up, _fwd).normalize();
  // makeBasis(x,y,z) = columns; 信使默认面朝 +Z → 用 forward 作 Z
  _basis.makeBasis(_right, up, _fwd);
  _quat.setFromRotationMatrix(_basis);
  playerGroup.quaternion.copy(_quat);
}
