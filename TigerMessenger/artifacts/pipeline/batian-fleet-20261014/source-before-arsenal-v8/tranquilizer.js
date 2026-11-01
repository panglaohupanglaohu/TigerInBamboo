// =====================================================================
//  气泡艇麻醉弹 · 命中与苏醒
//  - 飞鸟：坠落贴地，扑翅停，约 5s 后苏醒再飞
//  - 士兵：原地卧倒僵直，约 5s 后爬起继续
//  - 飞行器：攒满 20 发后像飞鸟坠地，贴地片刻再缓缓升空
//  时长够看清效果，又不会拖太久。
// =====================================================================
import * as THREE from "three";

/** 麻醉持续（秒）：士兵/生物默认 */
export const TRANQ_DURATION = 5.0;
/** 飞鸟麻醉更长（默认的 2 倍），坠落过程更易看清 */
export const TRANQ_DURATION_BIRD = TRANQ_DURATION * 2;
export const TRANQ_HIT_R_BIRD = 2.4;
export const TRANQ_HIT_R_SOLDIER = 2.9;
/** 莫比斯飞行器：攒满若干发麻醉弹后才像飞鸟一样坠地 */
export const TRANQ_HITS_AIRCRAFT = 20;
/** 机身约 7 长、中段半径 ~1.4，命中球略放宽 */
export const TRANQ_HIT_R_AIRCRAFT = 5.5;
/** 坠地速度与飞鸟 tickBirdSedation 一致 */
export const TRANQ_AIRCRAFT_FALL_SPEED = 22;
/** 苏醒后缓缓升回阵位 */
export const TRANQ_AIRCRAFT_RISE_SPEED = 3.2;
/** 贴地瘫软片刻，再开始爬升 */
export const TRANQ_AIRCRAFT_DOWN_SEC = 2.6;

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

const _acUp = new THREE.Vector3();
const _acTan = new THREE.Vector3();
const _acSide = new THREE.Vector3();
const _acMat = new THREE.Matrix4();
const _acQ = new THREE.Quaternion();
const _acTo = new THREE.Vector3();

function abortAircraftForage(member) {
  const fg = member?.userData?._forage;
  if (!fg) return;
  if (fg.flower) {
    fg.flower.userData.feeding = false;
    if (fg.flower.userData._feeder === member) fg.flower.userData._feeder = null;
  }
  fg.mode = "cruise";
  fg.t = 0;
  fg.flower = null;
  fg.targetPos = null;
}

/**
 * 气泡艇麻醉弹命中一架莫比斯飞行器。
 * 累计 TRANQ_HITS_AIRCRAFT 发后进入坠落；坠落中不再叠层。
 * @param {THREE.Object3D} member
 * @returns {{ hits: number, knocked: boolean } | null}
 */
export function applyAircraftTranqHit(member) {
  if (!member) return null;
  const tf = member.userData.tranqFall;
  if (tf?.phase === "fall" || tf?.phase === "down" || tf?.phase === "rise") {
    return { hits: member.userData.tranqHits || 0, knocked: true, already: true };
  }
  const hits = (member.userData.tranqHits || 0) + 1;
  member.userData.tranqHits = hits;
  member.userData.sedated = true;
  member.userData.sedateKind = "aircraft";
  member.userData.sedateT = Math.max(member.userData.sedateT || 0, TRANQ_DURATION_BIRD);
  if (hits >= TRANQ_HITS_AIRCRAFT) {
    member.userData.tranqFall = { phase: "fall", t: 0 };
    member.userData.sedateT = 40;
    abortAircraftForage(member);
    return { hits, knocked: true };
  }
  return { hits, knocked: false };
}

/** 飞行器是否正处于麻醉坠落 / 贴地 / 缓升 */
export function isAircraftKnocked(member) {
  const phase = member?.userData?.tranqFall?.phase;
  return phase === "fall" || phase === "down" || phase === "rise";
}

function poseAircraftKnocked(member, limp01, slotPos = null) {
  _acUp.copy(member.position).normalize();
  if (_acUp.lengthSq() < 1e-8) _acUp.set(0, 1, 0);
  if (slotPos) {
    _acTan.copy(slotPos).sub(member.position);
    _acTan.addScaledVector(_acUp, -_acTan.dot(_acUp));
  } else {
    _acTan.set(1, 0, 0);
    _acTan.addScaledVector(_acUp, -_acTan.dot(_acUp));
  }
  if (_acTan.lengthSq() < 1e-8) _acTan.set(0, 0, 1);
  _acTan.normalize();
  _acSide.crossVectors(_acUp, _acTan).normalize();
  _acTan.crossVectors(_acSide, _acUp).normalize();
  _acMat.makeBasis(_acSide, _acUp, _acTan);
  member.quaternion.setFromRotationMatrix(_acMat);
  const limp = THREE.MathUtils.clamp(limp01, 0, 1);
  if (limp > 0.01) {
    _acQ.setFromAxisAngle(_acTan, limp * 1.15);
    member.quaternion.premultiply(_acQ);
    _acQ.setFromAxisAngle(_acUp, limp * 0.28);
    member.quaternion.premultiply(_acQ);
  }
}

/**
 * 飞行器麻醉一帧：快速掉到地表（同飞鸟），贴地片刻，再缓缓升回阵位。
 * @param {THREE.Object3D} member
 * @param {number} dt
 * @param {number} groundR 星球半径
 * @param {THREE.Vector3} [slotPos] 巡航阵位（升空目标）
 * @returns {boolean} 仍处于坠落/贴地/缓升（调用方应跳过巡航 AI）
 */
export function tickAircraftTranqFall(member, dt, groundR, slotPos = null) {
  if (!member) return false;
  const tf = member.userData?.tranqFall;
  if (!tf) {
    if (member.userData?.sedated && member.userData?.sedateKind === "aircraft") {
      member.userData.sedateT = (member.userData.sedateT ?? 0) - dt;
      if (member.userData.sedateT <= 0) {
        member.userData.sedated = false;
        member.userData.sedateT = 0;
      }
    }
    return false;
  }

  const pos = member.position;
  const r = pos.length();
  const targetR = Math.max(groundR, 1) + 0.2;
  member.userData.sedated = true;
  member.userData.sedateKind = "aircraft";
  member.userData.sedateT = Math.max(member.userData.sedateT || 0, 1);

  if (tf.phase === "fall") {
    tf.t = (tf.t || 0) + dt;
    if (r > targetR + 0.35) {
      const next = Math.max(targetR, r - TRANQ_AIRCRAFT_FALL_SPEED * dt);
      pos.multiplyScalar(next / Math.max(r, 1e-6));
    } else {
      pos.multiplyScalar(targetR / Math.max(pos.length(), 1e-6));
      tf.phase = "down";
      tf.t = 0;
    }
    poseAircraftKnocked(member, 1, slotPos);
    return true;
  }

  if (tf.phase === "down") {
    tf.t = (tf.t || 0) + dt;
    pos.multiplyScalar(targetR / Math.max(pos.length(), 1e-6));
    poseAircraftKnocked(member, 1, slotPos);
    if (tf.t >= TRANQ_AIRCRAFT_DOWN_SEC) {
      tf.phase = "rise";
      tf.t = 0;
    }
    return true;
  }

  if (tf.phase === "rise") {
    tf.t = (tf.t || 0) + dt;
    const dest = slotPos || _acTo.copy(pos).normalize().multiplyScalar(targetR + 20);
    _acTo.copy(dest).sub(pos);
    const dist = _acTo.length();
    if (dist > 1e-4) {
      const step = Math.min(dist, TRANQ_AIRCRAFT_RISE_SPEED * dt);
      pos.addScaledVector(_acTo.multiplyScalar(1 / dist), step);
    }
    const limp = THREE.MathUtils.clamp(1 - tf.t / 3.2, 0, 1);
    poseAircraftKnocked(member, limp, dest);
    if (dist < 2.2 || tf.t > 28) {
      member.userData.tranqFall = null;
      member.userData.tranqHits = 0;
      member.userData.sedated = false;
      member.userData.sedateT = 0;
      return false;
    }
    return true;
  }

  return false;
}
