// =====================================================================
//  球面物理：切向移动 + 径向重力 + 曲面平台 / 星球表面着陆
//  曲面平台：同心球壳台面（半径 topHeight），足迹用中心切平面投影判定
// =====================================================================
import * as THREE from "three";
import { PLAYER_RADIUS } from "../core/constants.js";
import { PLANET_RADIUS } from "./planet.js";
import { flatToWorld } from "./sphereMath.js";

const _up = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _delta = new THREE.Vector3();

/**
 * 点是否落在曲面平台足迹内（相对平台中心的切向 u/v）
 */
function inFootprint(pos, p, margin = 0) {
  // 从球心看：用位置与平台中心方向夹角 + 切向分解
  _delta.copy(pos).sub(p.center);
  // 投影到切平面（去掉沿平台中心法线分量 —— 对曲面用位置的径向）
  const n = p.normal;
  const u = _delta.dot(p.right);
  const v = _delta.dot(p.forward);
  const hx = p.half.x + margin;
  const hz = p.half.z + margin;
  return Math.abs(u) <= hx && Math.abs(v) <= hz;
}

/**
 * @param {THREE.Vector3} pos 玩家脚底
 * @param {THREE.Vector3} vel 世界速度
 * @param {object[]} platforms
 * @param {object} player
 * @param {() => void} onVoidFall
 */
export function resolveCollisions(pos, vel, dt, platforms, player, onVoidFall) {
  pos.addScaledVector(vel, dt);

  let grounded = false;
  let groundR = PLANET_RADIUS;

  // ---- 曲面平台：足迹内 → 脚底贴到同心球壳半径 topHeight ----
  for (const p of platforms) {
    if (!p.center || !p.normal || p.topHeight == null) continue;
    if (!inFootprint(pos, p, PLAYER_RADIUS * 0.35)) continue;

    const topR = p.topHeight;
    const r = pos.length();
    // 在台面附近（上方可落下，下方可顶）
    if (r < topR + 0.65 && r > topR - p.half.y - 0.9) {
      const n = _up.copy(pos).normalize();
      const radialVel = n.dot(vel);
      if (radialVel <= 0.55 || player.onGround || Math.abs(r - topR) < 0.25) {
        // 保持足迹内的角向位置，只改径向
        pos.setLength(topR);
        const n2 = _up.copy(pos).normalize();
        const vr = n2.dot(vel);
        if (vr < 0) vel.addScaledVector(n2, -vr);
        grounded = true;
        groundR = topR;
        break;
      }
    }
  }

  // ---- 星球表面 ----
  if (!grounded) {
    const r = pos.length();
    if (r < PLANET_RADIUS + 0.1) {
      pos.setLength(PLANET_RADIUS);
      const n = _up.copy(pos).normalize();
      const vr = n.dot(vel);
      if (vr < 0) vel.addScaledVector(n, -vr);
      grounded = true;
      groundR = PLANET_RADIUS;
    }
  }

  // ---- 侧向：贴在曲面足迹边缘时轻微推出（避免穿进壳侧）----
  if (!grounded) {
    for (const p of platforms) {
      if (!p.center || !p.normal) continue;
      const r = pos.length();
      const topR = p.topHeight;
      const botR = topR - p.half.y * 2;
      if (r < botR - 0.2 || r > topR + 0.5) continue;

      _delta.copy(pos).sub(p.center);
      const u = _delta.dot(p.right);
      const v = _delta.dot(p.forward);
      const hx = p.half.x + PLAYER_RADIUS;
      const hz = p.half.z + PLAYER_RADIUS;
      if (Math.abs(u) < hx && Math.abs(v) < hz) {
        // 在壳厚度内：推到足迹外最近边
        const du = hx - Math.abs(u);
        const dv = hz - Math.abs(v);
        if (du < dv) {
          const sign = u >= 0 ? 1 : -1;
          pos.addScaledVector(p.right, sign * du);
        } else {
          const sign = v >= 0 ? 1 : -1;
          pos.addScaledVector(p.forward, sign * dv);
        }
        // 保持当前半径
        pos.setLength(r);
      }
    }
  }

  // ---- 虚空 / 穿心复位 ----
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
