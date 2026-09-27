import * as THREE from 'three';
import { COURIER_SCALE } from '../../core/characterScale.js';
import { COURIER_HEIGHT } from '../../core/characterScale.js';
import { buildWastelandCourier } from './courierWasteland.js';

// Preserve the caller's scale contract while fitting the revised silhouette.
// The original builder remains in courierCodrops.js for reference/recovery.
export function buildHumanCourier({ scale = COURIER_SCALE } = {}) {
  const root = buildWastelandCourier({ scale: 1 });
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root, true);
  const fittedScale = COURIER_HEIGHT / (bounds.max.y - bounds.min.y) * (scale / COURIER_SCALE);
  root.scale.setScalar(fittedScale);
  root.position.y = -bounds.min.y * fittedScale;
  root.userData.runtimeModel = 'wasteland-sloped-shoulders-pelvis';
  return root;
}

/**
 * Codrops 教程交互：光标 / 目标视线驱动头部与上半身程序化转向 (moveJoint)
 * @param {Object} player 玩家状态（包含 lookTarget: { x, y }）
 * @param {THREE.Group} root 信使根节点
 * @param {number} dt 时间增量
 */
export function updateCourierLookAt(player, root, dt) {
  const u = root.userData;
  if (!u || !u.head || !u.body) return;

  const blend = 1 - Math.exp(-8 * Math.min(dt, 0.1));
  const speed = player.velocity ? player.velocity.length() : 0;
  const sprinting = speed > 8;

  // 疾跑冲刺时视线收敛朝前，其余状态跟随光标注视
  const rawTarget = (!sprinting && player.lookTarget) ? player.lookTarget : { x: 0, y: 0 };
  const tx = THREE.MathUtils.clamp(rawTarget.x || 0, -1, 1);
  const ty = THREE.MathUtils.clamp(rawTarget.y || 0, -1, 1);

  // Codrops 角度约束：颈部最大左右 45°、上下 25°；腰部最大左右 20°、上下 10°
  const headTargetY = -tx * THREE.MathUtils.degToRad(45); // 左右偏转 yaw
  const headTargetX = -ty * THREE.MathUtils.degToRad(25); // 上下俯仰 pitch

  const bodyTargetY = -tx * THREE.MathUtils.degToRad(20);
  const bodyTargetX = -ty * THREE.MathUtils.degToRad(10);

  u.head.rotation.y = THREE.MathUtils.lerp(u.head.rotation.y, headTargetY, blend);
  u.head.rotation.x = THREE.MathUtils.lerp(u.head.rotation.x, headTargetX, blend);

  u.body.rotation.y = THREE.MathUtils.lerp(u.body.rotation.y, bodyTargetY, blend);
  u.body.rotation.x = THREE.MathUtils.lerp(u.body.rotation.x, bodyTargetX, blend);
}

export function animateHumanCourier(player, root, dt, moving) {
  const u = root.userData;
  if (!u) return;

  const blend = 1 - Math.exp(-12 * Math.min(dt, 0.1));
  const speed = player.velocity ? player.velocity.length() : 0;
  const seated = player.riding && !player.boardingOnFoot;
  const running = speed > 8;
  const walk = (moving || (player.boardingOnFoot && speed > 0.01)) && player.onGround && !seated;

  player.animPhase = (player.animPhase || 0) + dt * (walk ? (running ? 14 : 9) : 2.2);
  const phase = player.animPhase;

  // 摆幅与步态相位
  const strideAmp = running ? 0.62 : 0.36;
  const swing = walk ? Math.sin(phase) * strideAmp : 0;

  const pose = (o, x, y, z) => {
    if (!o) return;
    if (x !== undefined) o.rotation.x = THREE.MathUtils.lerp(o.rotation.x, x, blend);
    if (y !== undefined) o.rotation.y = THREE.MathUtils.lerp(o.rotation.y, y, blend);
    if (z !== undefined) o.rotation.z = THREE.MathUtils.lerp(o.rotation.z, z, blend);
  };

  // 双腿与膝关节
  if (seated) {
    pose(u.legL, -1.15, 0, 0);
    pose(u.legR, -1.15, 0, 0);
    pose(u.kneeL, 1.3, 0, 0);
    pose(u.kneeR, 1.3, 0, 0);
  } else if (!player.onGround) {
    // 腾空/跳跃
    pose(u.legL, -0.28, 0, 0);
    pose(u.legR, 0.22, 0, 0);
    pose(u.kneeL, 0.45, 0, 0);
    pose(u.kneeR, 0.65, 0, 0);
  } else {
    // 行走 / 跑步
    pose(u.legL, swing, 0, 0);
    pose(u.legR, -swing, 0, 0);
    pose(u.kneeL, Math.max(0, -swing) * (running ? 1.45 : 1.18), 0, 0);
    pose(u.kneeR, Math.max(0, swing) * (running ? 1.45 : 1.18), 0, 0);
  }

  // 手臂与手肘
  if (seated) {
    pose(u.armL, -0.48, 0, 0.05);
    pose(u.armR, player.holdingLetter ? -0.58 : -0.48, 0, -0.05);
    pose(u.elbowL, -0.68, 0, 0);
    pose(u.elbowR, player.holdingLetter ? -0.78 : -0.68, 0, 0);
  } else if (player.holdingLetter) {
    // 手持蜡封信展示姿势
    pose(u.armL, walk ? -swing * 0.55 : 0, 0, 0.05);
    pose(u.elbowL, walk ? -0.25 : -0.12, 0, 0);

    // 右臂平举展信
    pose(u.armR, -0.62, -0.15, -0.22);
    pose(u.elbowR, -0.72, 0.12, 0);
    pose(u.handR, 0.22, 0, 0);
  } else if (walk) {
    // 行走自然对向摆臂与手腕惯性延迟（Discourse 4247 & 人体解剖动力学）
    const armSwingAmp = running ? 0.82 : 0.62;
    pose(u.armL, -swing * armSwingAmp, 0, 0.05);
    pose(u.armR, swing * armSwingAmp, 0, -0.05);
    pose(u.elbowL, -0.18 - Math.max(0, -swing) * 0.26, 0, 0);
    pose(u.elbowR, -0.18 - Math.max(0, swing) * 0.26, 0, 0);
    if (u.handL) pose(u.handL, -Math.sin(phase - 0.42) * (running ? 0.26 : 0.16), 0, 0);
    if (u.handR) pose(u.handR, Math.sin(phase - 0.42) * (running ? 0.26 : 0.16), 0, 0);
  } else {
    // 待机自然呼吸微摆与重心微律动
    const breath = Math.sin(phase * 1.5);
    pose(u.armL, breath * 0.018, 0, 0.04 + breath * 0.010);
    pose(u.armR, breath * 0.018, 0, -0.04 - breath * 0.010);
    pose(u.elbowL, -0.10, 0, 0);
    pose(u.elbowR, -0.10, 0, 0);
    if (u.handL) pose(u.handL, 0, 0, 0);
    if (u.handR && !player.holdingLetter) pose(u.handR, 0, 0, 0);
  }

  // 骨盆横向重心转移（Pelvic Sway）、躯干起伏与胸腔对向扭转（Torso Counter-Rotation）
  const baseBounce = walk
    ? (running ? Math.abs(Math.sin(phase * 2)) * 0.026 : Math.abs(Math.sin(phase * 2)) * 0.014)
    : Math.sin(phase * 1.5) * 0.004;
  u.body.position.y = (u.bodyBaseY || 0.94) + baseBounce;

  // 骨盆横向重心转移与左右微倾（Trendelenburg 侧倾）
  const pelvicSway = walk
    ? Math.sin(phase) * (running ? 0.020 : 0.012)
    : Math.sin(phase * 0.75) * 0.003;
  u.body.position.x = (u.bodyBaseX || 0) + pelvicSway;

  const pelvicTiltZ = walk ? -Math.sin(phase) * (running ? 0.042 : 0.022) : 0;
  // 躯干对向微扭转
  const torsoCounterY = walk ? -Math.sin(phase) * (running ? 0.085 : 0.045) : 0;
  if (!player.lookTarget || Math.abs(player.lookTarget.x || 0) < 0.15) {
    u.body.rotation.y = THREE.MathUtils.lerp(u.body.rotation.y, torsoCounterY, blend);
  }
  u.body.rotation.z = THREE.MathUtils.lerp(u.body.rotation.z, pelvicTiltZ, blend);

  const capeTilt = walk
    ? (running ? 0.38 + Math.sin(phase * 2) * 0.10 : 0.12 + Math.sin(phase) * 0.035)
    : 0.02 + Math.sin(phase * 1.2) * 0.015;
  pose(u.cape, capeTilt, 0, Math.cos(phase * 0.8) * 0.015);

  // 蜡封信显隐与手持跟随
  if (u.letter) {
    u.letter.visible = !!player.holdingLetter;
  }

  // 程序化头部与腰部注视交互（Codrops 核心交互）
  updateCourierLookAt(player, root, dt);

  // 若处于信件检视状态，头部微微低头细看信封
  if (player.holdingLetter && player.inspectLetter && u.head) {
    u.head.rotation.x += 0.16;
    u.head.rotation.y -= 0.12;
  }
}
