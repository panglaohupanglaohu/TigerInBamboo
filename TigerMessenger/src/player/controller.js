// =====================================================================
//  玩家控制器：输入 → 相机相对移动 / 跳跃 / 重力
// =====================================================================
import * as THREE from "three";
import {
  MOVE_SPEED,
  SPRINT_MULT,
  AIR_CONTROL,
  JUMP_VELOCITY,
  GRAVITY,
} from "../core/constants.js";

const moveDir = new THREE.Vector3();
const camForward = new THREE.Vector3();
const camRight = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

/**
 * 每帧更新玩家水平速度与竖直速度（碰撞在 world/collision 中另行处理）。
 * @param {object} o.player 玩家状态
 * @param {object} o.keys 按键表（code → bool）
 * @param {THREE.PerspectiveCamera} o.camera 用于取相机水平朝向
 * @param {boolean} o.gameStarted 未开始前锁输入
 * @param {() => void} o.onJump 起跳回调（音效）
 */
export function updatePlayerControl({ player, keys, camera, dt, gameStarted, onJump }) {
  // ---- 输入 → 期望移动（相对相机水平朝向） ----
  // W/S 用 iz：W=-1（沿相机朝前），S=+1；A/D 用 ix
  let ix = 0;
  let iz = 0;
  if (gameStarted) {
    if (keys["KeyW"] || keys["ArrowUp"]) iz -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) iz += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) ix -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) ix += 1;
  }

  camera.getWorldDirection(camForward);
  camForward.y = 0;
  if (camForward.lengthSq() < 1e-6) camForward.set(0, 0, -1);
  camForward.normalize();
  camRight.crossVectors(camForward, worldUp).normalize();

  moveDir.set(0, 0, 0);
  if (ix !== 0 || iz !== 0) {
    // W → 沿 camForward；S → 反向；A/D → 左右
    moveDir.addScaledVector(camForward, -iz);
    moveDir.addScaledVector(camRight, ix);
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      player.yaw = Math.atan2(moveDir.x, moveDir.z);
    }
  }

  const sprinting =
    gameStarted && (keys["ShiftLeft"] || keys["ShiftRight"]);
  const speed = MOVE_SPEED * (sprinting ? SPRINT_MULT : 1);
  const targetVx = moveDir.x * speed;
  const targetVz = moveDir.z * speed;
  if (player.onGround) {
    player.velocity.x = targetVx;
    player.velocity.z = targetVz;
  } else {
    // 空中弱控制
    player.velocity.x = THREE.MathUtils.lerp(player.velocity.x, targetVx, AIR_CONTROL * dt * 8);
    player.velocity.z = THREE.MathUtils.lerp(player.velocity.z, targetVz, AIR_CONTROL * dt * 8);
  }

  // 跳跃
  if (gameStarted && (keys["Space"] || keys["KeyJ"]) && player.onGround) {
    player.velocity.y = JUMP_VELOCITY;
    player.onGround = false;
    onJump();
  }

  // 重力
  player.velocity.y -= GRAVITY * dt;
}
