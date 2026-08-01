// =====================================================================
//  物理：平台 AABB 碰撞（胶囊简化为垂直圆柱 AABB）
// =====================================================================
import { PLAYER_HEIGHT, PLAYER_RADIUS } from "../core/constants.js";

/**
 * 水平推开 + 垂直落地/撞头 + 坠落复位。
 * @param {THREE.Vector3} pos 玩家脚底位置（会被原地修改）
 * @param {THREE.Vector3} vel 速度（会被原地修改）
 * @param {object[]} platforms 世界平台 AABB 列表
 * @param {object} player 玩家状态（回写 onGround）
 * @param {() => void} onVoidFall 坠落复位回调（用于 toast 提示）
 */
export function resolveCollisions(pos, vel, dt, platforms, player, onVoidFall) {
  // 水平移动
  pos.x += vel.x * dt;
  pos.z += vel.z * dt;

  // 与平台侧面推开（防止穿墙）
  for (const p of platforms) {
    const feetY = pos.y;
    const headY = pos.y + PLAYER_HEIGHT;
    // 垂直范围有重叠才处理水平
    if (headY <= p.min.y + 0.05 || feetY >= p.max.y - 0.05) continue;

    const px = Math.max(p.min.x, Math.min(pos.x, p.max.x));
    const pz = Math.max(p.min.z, Math.min(pos.z, p.max.z));
    const dx = pos.x - px;
    const dz = pos.z - pz;
    const distSq = dx * dx + dz * dz;
    const r = PLAYER_RADIUS;
    if (distSq < r * r && distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      const push = (r - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    } else if (distSq < 1e-8) {
      // 完全在柱体内：推出最近面
      const left = pos.x - p.min.x + r;
      const right = p.max.x - pos.x + r;
      const back = pos.z - p.min.z + r;
      const front = p.max.z - pos.z + r;
      const m = Math.min(left, right, back, front);
      if (m === left) pos.x = p.min.x - r;
      else if (m === right) pos.x = p.max.x + r;
      else if (m === back) pos.z = p.min.z - r;
      else pos.z = p.max.z + r;
    }
  }

  // 垂直
  pos.y += vel.y * dt;
  let grounded = false;
  const skin = 0.08;

  if (vel.y <= 0) {
    for (const p of platforms) {
      // 脚在平台顶面附近，且水平落在平台上
      const top = p.max.y;
      if (pos.y > top + skin || pos.y < top - 0.55) continue;
      if (
        pos.x + PLAYER_RADIUS * 0.55 < p.min.x ||
        pos.x - PLAYER_RADIUS * 0.55 > p.max.x ||
        pos.z + PLAYER_RADIUS * 0.55 < p.min.z ||
        pos.z - PLAYER_RADIUS * 0.55 > p.max.z
      ) {
        continue;
      }
      pos.y = top;
      vel.y = 0;
      grounded = true;
      break;
    }
  } else {
    // 头顶撞平台底
    for (const p of platforms) {
      const bottom = p.min.y;
      const head = pos.y + PLAYER_HEIGHT;
      if (head < bottom - skin || head > bottom + 0.4) continue;
      if (
        pos.x + PLAYER_RADIUS * 0.5 < p.min.x ||
        pos.x - PLAYER_RADIUS * 0.5 > p.max.x ||
        pos.z + PLAYER_RADIUS * 0.5 < p.min.z ||
        pos.z - PLAYER_RADIUS * 0.5 > p.max.z
      ) {
        continue;
      }
      pos.y = bottom - PLAYER_HEIGHT;
      vel.y = 0;
      break;
    }
  }

  // 虚空坠落复位：回到最近检查点（接信/送达时刷新，初始为出生点）
  if (pos.y < -12) {
    if (player.checkpoint) pos.copy(player.checkpoint);
    else pos.set(0, 2, 6);
    vel.set(0, 0, 0);
    onVoidFall();
  }

  player.onGround = grounded;
}
