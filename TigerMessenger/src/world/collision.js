// =====================================================================
//  球面物理：切向移动 + 径向重力 + 平台顶面 / 星球表面着陆
// =====================================================================
import * as THREE from "three";
import { PLAYER_RADIUS } from "../core/constants.js";
import { PLANET_RADIUS } from "./planet.js";
import { flatToWorld } from "./sphereMath.js";

const _up = new THREE.Vector3();
const _local = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _invQ = new THREE.Quaternion();

/**
 * @param {THREE.Vector3} pos 玩家脚底（会被修改）
 * @param {THREE.Vector3} vel 世界速度（会被修改）
 * @param {object[]} platforms 球面平台
 * @param {object} player 状态（onGround / checkpoint）
 * @param {() => void} onVoidFall
 */
export function resolveCollisions(pos, vel, dt, platforms, player, onVoidFall) {
  // 积分
  pos.addScaledVector(vel, dt);

  const up = _up.copy(pos).normalize();
  let grounded = false;
  let groundR = PLANET_RADIUS; // 脚底可站立的球心距离

  // ---- 平台顶面：在局部切向框内则抬到 topHeight ----
  for (const p of platforms) {
    if (!p.center || !p.quat) continue;
    _invQ.copy(p.quat).invert();
    _local.copy(pos).sub(p.center).applyQuaternion(_invQ);
    const hx = p.half.x;
    const hy = p.half.y;
    const hz = p.half.z;
    // 顶面在 local y = +hy；脚在顶面附近
    if (Math.abs(_local.x) <= hx + PLAYER_RADIUS * 0.4 && Math.abs(_local.z) <= hz + PLAYER_RADIUS * 0.4) {
      const topLocalY = hy;
      // 脚底相对中心
      if (_local.y < topLocalY + 0.55 && _local.y > topLocalY - 0.85) {
        // 径向速度朝球心（下落）或已贴地
        const radialVel = up.dot(vel);
        if (radialVel <= 0.5 || player.onGround) {
          // 把脚放在顶面：center + normal * (topHeight 用 centerR+hy)
          const topR = p.topHeight;
          pos.copy(p.normal).multiplyScalar(topR);
          // 切向微调保持在平台内（可选：夹紧 local xz）
          _local.y = topLocalY;
          _local.x = THREE.MathUtils.clamp(_local.x, -hx, hx);
          _local.z = THREE.MathUtils.clamp(_local.z, -hz, hz);
          // 从 local 重建：用 platform quat
          _tmp.set(_local.x, 0, _local.z).applyQuaternion(p.quat);
          pos.copy(p.normal).multiplyScalar(topR).add(_tmp);
          // 消去内向径向速度
          const n = _up.copy(pos).normalize();
          const vr = n.dot(vel);
          if (vr < 0) vel.addScaledVector(n, -vr);
          grounded = true;
          groundR = topR;
          break;
        }
      }
    }
  }

  // ---- 星球表面：未站在平台上时的默认地面 ----
  if (!grounded) {
    const r = pos.length();
    const surfaceR = PLANET_RADIUS; // 脚底在表面
    if (r < surfaceR + 0.08) {
      pos.setLength(surfaceR);
      const n = _up.copy(pos).normalize();
      const vr = n.dot(vel);
      if (vr < 0) vel.addScaledVector(n, -vr);
      grounded = true;
      groundR = surfaceR;
    }
  }

  // ---- 侧向：与平台体相交时沿切向推出（简易）----
  if (!grounded) {
    for (const p of platforms) {
      if (!p.center || !p.quat) continue;
      _invQ.copy(p.quat).invert();
      _local.copy(pos).sub(p.center).applyQuaternion(_invQ);
      const hx = p.half.x + PLAYER_RADIUS;
      const hy = p.half.y + 0.2;
      const hz = p.half.z + PLAYER_RADIUS;
      if (
        Math.abs(_local.x) < hx &&
        Math.abs(_local.y) < hy &&
        Math.abs(_local.z) < hz
      ) {
        // 推出最近面
        const dx = hx - Math.abs(_local.x);
        const dy = hy - Math.abs(_local.y);
        const dz = hz - Math.abs(_local.z);
        if (dx <= dy && dx <= dz) _local.x += Math.sign(_local.x || 1) * dx;
        else if (dz <= dy) _local.z += Math.sign(_local.z || 1) * dz;
        else _local.y += Math.sign(_local.y || 1) * dy;
        pos.copy(_local).applyQuaternion(p.quat).add(p.center);
      }
    }
  }

  // ---- 飞出太远 / 掉进球内过深 → 检查点 ----
  const rNow = pos.length();
  if (rNow < PLANET_RADIUS * 0.5 || rNow > PLANET_RADIUS + 80) {
    if (player.checkpoint) pos.copy(player.checkpoint);
    else flatToWorld(0, 2, 6, PLANET_RADIUS, pos);
    vel.set(0, 0, 0);
    grounded = true;
    onVoidFall();
  }

  player.onGround = grounded;
  player.groundR = groundR;
}
