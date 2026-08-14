// =====================================================================
//  气泡艇麻醉弹 · 命中与苏醒
//  - 飞鸟：坠落贴地，扑翅停，约 5s 后苏醒再飞
//  - 士兵：原地卧倒僵直，约 5s 后爬起继续
//  时长够看清效果，又不会拖太久。
// =====================================================================
import * as THREE from "three";

/** 麻醉持续（秒）：士兵/生物默认 */
export const TRANQ_DURATION = 5.0;
/** 飞鸟麻醉更长（默认的 2 倍），坠落过程更易看清 */
export const TRANQ_DURATION_BIRD = TRANQ_DURATION * 2;
export const TRANQ_HIT_R_BIRD = 2.4;
export const TRANQ_HIT_R_SOLDIER = 2.9;

const _up = new THREE.Vector3();
const _qLie = new THREE.Quaternion();
const _axis = new THREE.Vector3();

/**
 * 给 Object3D 生物上麻醉（士兵 / 单只 Boids 鸟组）。
 * @param {THREE.Object3D} obj
 * @param {number} [duration]
 * @param {'bird'|'soldier'} [kind]
 */
export function sedateObject(obj, duration = TRANQ_DURATION, kind = "soldier") {
  if (!obj) return false;
  const was = !!obj.userData.sedated;
  obj.userData.sedated = true;
  obj.userData.sedateT = duration;
  obj.userData.sedateKind = kind;
  if (!was) {
    obj.userData._sedateBaseQuat = obj.quaternion.clone();
    if (kind === "soldier") {
      // 卧倒：绕前进轴（局部 X）侧翻约 90°
      _axis.set(1, 0, 0).applyQuaternion(obj.quaternion).normalize();
      _qLie.setFromAxisAngle(_axis, Math.PI * 0.5);
      obj.quaternion.premultiply(_qLie);
      limpSoldierPose(obj);
    } else if (kind === "creature" || kind === "bird") {
      // 生物侧倒
      _axis.set(0, 0, 1).applyQuaternion(obj.quaternion).normalize();
      if (_axis.lengthSq() < 1e-6) _axis.set(1, 0, 0);
      _qLie.setFromAxisAngle(_axis, Math.PI * 0.45);
      obj.quaternion.premultiply(_qLie);
    }
  }
  return true;
}

function limpSoldierPose(soldier) {
  const parts = soldier.userData?.parts;
  if (!parts) return;
  if (parts.legL?.rotation) parts.legL.rotation.z = 0.12;
  if (parts.legR?.rotation) parts.legR.rotation.z = -0.08;
  if (parts.armL?.rotation) parts.armL.rotation.z = 0.35;
  if (parts.armR?.rotation) parts.armR.rotation.z = 0.35;
  if (parts.body?.rotation) parts.body.rotation.z = 0;
}

/**
 * 每帧倒计时；仍麻醉返回 true（调用方应跳过 AI）。
 * @param {THREE.Object3D} obj
 * @param {number} dt
 */
export function tickObjectSedation(obj, dt) {
  if (!obj?.userData?.sedated) return false;
  obj.userData.sedateT = (obj.userData.sedateT ?? 0) - dt;
  if (obj.userData.sedateT > 0) return true;
  // 苏醒
  obj.userData.sedated = false;
  obj.userData.sedateT = 0;
  if (obj.userData._sedateBaseQuat) {
    // 不硬还原姿态：下一帧 AI 会重新 orient / 摆腿
    obj.userData._sedateBaseQuat = null;
  }
  return false;
}

/** 是否处于麻醉（鸟/兵共用） */
export function isSedated(obj) {
  return !!(obj?.userData?.sedated && (obj.userData.sedateT ?? 0) > 0);
}

/**
 * Boids 鸟坠落一帧：朝球心掉、翅膀瘫软、肚子朝上。
 * @param {{ group: THREE.Group, model?: THREE.Object3D, wingL?: THREE.Object3D, wingR?: THREE.Object3D, vel: THREE.Vector3, sedateT?: number }} bird
 * @param {number} dt
 * @param {number} groundR 贴地半径（球心距）
 */
export function tickBirdSedation(bird, dt, groundR) {
  if (!bird) return false;
  if (!(bird.sedateT > 0) && !bird.group?.userData?.sedated) return false;

  if (bird.group?.userData?.sedated) {
    bird.sedateT = bird.group.userData.sedateT;
  }
  bird.sedateT = (bird.sedateT ?? 0) - dt;
  if (bird.group) {
    bird.group.userData.sedated = bird.sedateT > 0;
    bird.group.userData.sedateT = bird.sedateT;
  }
  if (bird.sedateT <= 0) {
    bird.sedateT = 0;
    if (bird.model) bird.model.rotation.x = 0;
    return false;
  }

  const pos = bird.group.position;
  const r = pos.length();
  const targetR = Math.max(groundR, 1);
  // 坠落：快速掉到地表附近
  if (r > targetR + 0.35) {
    const next = Math.max(targetR + 0.2, r - 22 * dt);
    pos.multiplyScalar(next / Math.max(r, 1e-6));
  }
  bird.vel.set(0, 0, 0);

  // 肚皮朝上、翅膀耷拉
  _up.copy(pos).normalize();
  const m = new THREE.Matrix4().lookAt(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0).addScaledVector(_up, -_up.x).normalize(),
    _up
  );
  bird.group.quaternion.setFromRotationMatrix(m);
  if (bird.model) bird.model.rotation.x = Math.PI * 0.55;
  if (bird.wingL?.rotation) bird.wingL.rotation.z = 0.55;
  if (bird.wingR?.rotation) bird.wingR.rotation.z = -0.55;
  // 长翼护航鸟
  if (bird.innerL?.rotation) bird.innerL.rotation.z = 0.4;
  if (bird.innerR?.rotation) bird.innerR.rotation.z = -0.4;
  if (bird.outerL?.rotation) bird.outerL.rotation.z = 0.25;
  if (bird.outerR?.rotation) bird.outerR.rotation.z = -0.25;
  return true;
}

/**
 * 麻醉单只 Boids 鸟
 * @param {object} bird flock/escort bird record
 * @param {number} [duration]
 */
export function sedateBirdRecord(bird, duration = TRANQ_DURATION_BIRD) {
  if (!bird) return false;
  bird.sedateT = duration;
  if (bird.group) {
    bird.group.userData.sedated = true;
    bird.group.userData.sedateT = duration;
  }
  bird.vel?.set(0, 0, 0);
  return true;
}
