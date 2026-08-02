// =====================================================================
//  球面玩家控制：切向 WASD + 法线跳跃 + 球心重力
// =====================================================================
import * as THREE from "three";
import { AIR_CONTROL } from "../core/constants.js";
import { P } from "../core/params.js";

const _up = new THREE.Vector3();
const _camF = new THREE.Vector3();
const _camR = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _target = new THREE.Vector3();
const _tang = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/**
 * 更新速度（位置积分与贴地在 collision 中处理）
 */
export function updatePlayerControl({ player, keys, camera, dt, gameStarted, onJump }) {
  const up = _up.copy(player.position).normalize();
  if (up.lengthSq() < 1e-8) up.set(0, 1, 0);

  let ix = 0;
  let iz = 0;
  if (gameStarted) {
    if (keys["KeyW"] || keys["ArrowUp"]) iz -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) iz += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) ix -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) ix += 1;
  }

  camera.getWorldDirection(_camF);
  _camF.addScaledVector(up, -_camF.dot(up));
  if (_camF.lengthSq() < 1e-6) {
    // 退化：用玩家朝向
    _camF.set(Math.sin(player.yaw || 0), 0, Math.cos(player.yaw || 0));
    _camF.addScaledVector(up, -_camF.dot(up));
  }
  _camF.normalize();
  _camR.crossVectors(_camF, up).normalize();

  _wish.set(0, 0, 0);
  if (ix !== 0 || iz !== 0) {
    _wish.addScaledVector(_camF, -iz).addScaledVector(_camR, ix);
    if (_wish.lengthSq() > 0) {
      _wish.normalize();
      // 记录朝向：用切向 wish 在本地构建 yaw 近似（视觉用 quaternion）
      player.facing = _wish.clone();
    }
  }

  const sprinting = gameStarted && (keys["ShiftLeft"] || keys["ShiftRight"]);
  const speed =
    P.moveSpeed * (sprinting ? P.sprintMult : 1) * (player.wadeFactor || 1); // 涉水减速
  _target.copy(_wish).multiplyScalar(gameStarted ? speed : 0);

  // 分离径向 / 切向速度
  const radial = up.dot(player.velocity);
  _tang.copy(player.velocity).addScaledVector(up, -radial);
  const blend = player.onGround
    ? 1 - Math.exp(-12 * dt)
    : 1 - Math.exp(-AIR_CONTROL * 8 * dt);
  _tang.lerp(_target, blend);
  player.velocity.copy(_tang).addScaledVector(up, radial);

  // 跳跃：沿 +up
  if (gameStarted && (keys["Space"] || keys["KeyJ"]) && player.onGround) {
    const vr = up.dot(player.velocity);
    if (vr < 0) player.velocity.addScaledVector(up, -vr);
    player.velocity.addScaledVector(up, P.jumpV);
    player.onGround = false;
    onJump();
  }

  // 重力：指向球心
  player.velocity.addScaledVector(up, -P.gravity * dt);

  // 维护 forward 供相机/动画
  if (player.facing && player.facing.lengthSq() > 0) {
    _fwd.copy(player.facing).addScaledVector(up, -player.facing.dot(up));
    if (_fwd.lengthSq() > 1e-6) {
      _fwd.normalize();
      player.forward = _fwd.clone();
    }
  }
  if (!player.forward) player.forward = new THREE.Vector3(0, 0, 1);
}
