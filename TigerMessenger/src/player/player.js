// =====================================================================
//  玩家：状态 + 信使网格；球面视觉同步（法线对齐）
// =====================================================================
import * as THREE from "three";
import { buildMessenger } from "./messenger.js";
import { flatToWorld, surfaceNormal } from "../world/sphereMath.js";
import { PLANET_RADIUS } from "../world/planet.js";

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _quat = new THREE.Quaternion();

export function createPlayer(scene) {
  // 出生：旧平面 (0, 2, 6) → 球面
  const spawn = flatToWorld(0, 2, 6, PLANET_RADIUS);

  const player = {
    position: spawn.clone(),
    velocity: new THREE.Vector3(0, 0, 0),
    onGround: false,
    yaw: 0,
    facing: new THREE.Vector3(0, 0, 1),
    forward: new THREE.Vector3(0, 0, 1),
    holdingLetter: false,
    animPhase: 0,
    checkpoint: spawn.clone(),
    groundR: PLANET_RADIUS + 2,
  };

  const playerGroup = new THREE.Group();
  scene.add(playerGroup);

  const messengerMesh = buildMessenger();
  playerGroup.add(messengerMesh);

  const holdAura = new THREE.PointLight(0xffe08a, 0, 4, 2);
  holdAura.position.set(0, 1.6, 0);
  playerGroup.add(holdAura);

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
