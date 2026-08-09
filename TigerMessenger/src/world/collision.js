// =====================================================================
//  球面物理：切向移动 + 径向重力 + 曲面平台 / 星球表面着陆
//  曲面平台：同心球壳台面 + 外扩土坡（半径按位置变化），足迹用中心切平面投影判定
// =====================================================================
import * as THREE from "three";
import { PLAYER_RADIUS, PLAYER_HEIGHT } from "../core/constants.js";
import { PLANET_RADIUS } from "./planet.js";
import { flatToWorld } from "./sphereMath.js";
import { groundLiftAt, worldToFlatXZ } from "./hills.js";
import { canyonOffsetDir } from "./canyon.js";
import { citadelWalkLiftDir } from "./citadelRange.js";

const _up = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _delta = new THREE.Vector3();

/**
 * 点是否落在曲面平台足迹内（相对平台中心的切向 u/v）
 * 注意：切向投影只在同一半球有效——球面对跖点附近投影会重新变小，
 * 形成"幽灵足迹"，必须用角距守卫排除。
 */
function inFootprint(pos, p, margin = 0) {
  // 半球守卫：与平台中心角距超过 ~87° 时一律判为足迹外
  _tmp.copy(pos).normalize();
  if (_tmp.dot(p.normal) <= 0.05) return false;
  // 从球心看：用位置与平台中心方向夹角 + 切向分解
  _delta.copy(pos).sub(p.center);
  // 投影到切平面（去掉沿平台中心法线分量 —— 对曲面用位置的径向）
  const u = _delta.dot(p.right);
  const v = _delta.dot(p.forward);
  const hx = p.half.x + margin;
  const hz = p.half.z + margin;
  return Math.abs(u) <= hx && Math.abs(v) <= hz;
}

function platformTopAt(p, pos) {
  return typeof p.topHeightAt === "function" ? p.topHeightAt(pos) : p.topHeight;
}

/**
 * @param {THREE.Vector3} pos 玩家脚底
 * @param {THREE.Vector3} vel 世界速度
 * @param {object[]} platforms
 * @param {object} player
 * @param {() => void} onVoidFall
 * @param {object|null} [hills] buildHills 返回对象；存在时山区地面按高度场吸附
 */
export function resolveCollisions(pos, vel, dt, platforms, player, onVoidFall, hills = null) {
  pos.addScaledVector(vel, dt);

  let grounded = false;
  let groundR = PLANET_RADIUS;

  // ---- 山区高度场（连绵土坡）：视觉与碰撞共用 groundLiftAt，斜坡平滑吸附 ----
  if (hills) {
    const flat = worldToFlatXZ(pos, PLANET_RADIUS);
    if (flat) {
      const surfaceR = PLANET_RADIUS + groundLiftAt(flat.x, flat.z);
      const r = pos.length();
      if (r < surfaceR + 0.1 && r > surfaceR - 1.5) {
        const n0 = _up.copy(pos).normalize();
        const vr0 = n0.dot(vel);
        // 下落/贴地行走/已贴坡面（低速）时可吸附；正向上起跳（径向速度大）不拦截
        if (vr0 <= 0.6 || (vr0 < 1.5 && (player.onGround || Math.abs(r - surfaceR) < 0.3))) {
          pos.setLength(surfaceR);
          const n = _up.copy(pos).normalize();
          const vr = n.dot(vel);
          if (vr < 0) vel.addScaledVector(n, -vr);
          grounded = true;
          groundR = surfaceR;
        }
      }
    }
  }

  // ---- 曲面平台：登台步升 / 高台阻挡 / 下方顶头 ----
  // 判定分两步：
  // ① 收集所有可着陆平台（足迹内 + 脚底在台面 STEP_UP 高差内），取最高台面
  //    —— 支持 岛(0.6) → 石(1.2) → 石(2.4) 的链式登台；
  // ② 对其余台体：台面太高迈不上且身体与台体相交 → 侧向推出或下方顶头。
  const STEP_UP = 0.75;   // 可直接迈上的台面高差上限

  // ① 着陆选择：最高优先；吸附后用新高度重选，直到没有更高台面
  //    —— 单帧内即可完成 岛(0.6) → 石(1.2) 的链式登台
  for (let pass = 0; pass < 3; pass++) {
    let landing = null;
    let landingTopR = -Infinity;
    const rNow = pos.length();
    for (const p of platforms) {
      if (!p.center || !p.normal || p.topHeight == null) continue;
      const topR = platformTopAt(p, pos);
      if (landing && topR <= landingTopR) continue;
      if (!inFootprint(pos, p, PLAYER_RADIUS * 0.35)) continue;
      if (rNow < topR - STEP_UP || rNow > topR + 0.65) continue;
      const n = _up.copy(pos).normalize();
      const vr = n.dot(vel);
      // 下落、贴地行走、或已贴台面（低速）时可吸附；正向上起跳（径向速度大）则放行
      if (!(vr <= 0.6 || (vr < 1.5 && (player.onGround || Math.abs(rNow - topR) < 0.3)))) continue;
      if (!landing || topR > landingTopR) {
        landing = p;
        landingTopR = topR;
      }
    }
    if (!landing) break;
    pos.setLength(landingTopR); // 保持角向位置，只改径向
    const n2 = _up.copy(pos).normalize();
    const vr2 = n2.dot(vel);
    if (vr2 < 0) vel.addScaledVector(n2, -vr2);
    grounded = true;
    groundR = landingTopR;
  }

  // ② 台体阻挡：足迹内（含身体半径余量）且身体与台体厚度相交
  for (const p of platforms) {
    if (!p.center || !p.normal || p.topHeight == null) continue;
    const topR = platformTopAt(p, pos);
    const botR = topR - p.half.y * 2;
    const r = pos.length();
    if (!inFootprint(pos, p, PLAYER_RADIUS)) continue;

    const bodyTop = r + PLAYER_HEIGHT;
    const tooTallToStep = r < topR - STEP_UP;
    const intersectsSlab = tooTallToStep && bodyTop > botR + 0.05;
    if (!intersectsSlab) continue;

    const n = _up.copy(pos).normalize();
    const vr = n.dot(vel);
    if (vr > 0.5 && r < botR) {
      // 从下方跳起顶头：压回壳底之下，消去向外径向速度
      pos.setLength(botR - PLAYER_HEIGHT);
      vel.addScaledVector(n, -vr);
    } else {
      // 侧面走入：沿最近边推出足迹外，并抵消继续侵入的切向分量
      _delta.copy(pos).sub(p.center);
      const u = _delta.dot(p.right);
      const v = _delta.dot(p.forward);
      const hx = p.half.x + PLAYER_RADIUS;
      const hz = p.half.z + PLAYER_RADIUS;
      const du = hx - Math.abs(u);
      const dv = hz - Math.abs(v);
      const rKeep = pos.length();
      if (du < dv) {
        const s = u >= 0 ? 1 : -1;
        pos.addScaledVector(p.right, s * du);
        const va = vel.dot(p.right);
        if (va * s < 0) vel.addScaledVector(p.right, -va);
      } else {
        const s = v >= 0 ? 1 : -1;
        pos.addScaledVector(p.forward, s * dv);
        const va = vel.dot(p.forward);
        if (va * s < 0) vel.addScaledVector(p.forward, -va);
      }
      pos.setLength(rKeep); // 只推切向，保持当前径向高度
    }
    break;
  }

  // ---- 星球表面（南半球叠加峡谷地形 + 圣城山脉双峰，谷底/山坡可行走） ----
  // 圣城区域用 citadelWalkLiftDir：自然坡面之上再叠加五层台地与折返石阶，
  // 送信人可沿石阶一路走上圣城正门门廊。
  if (!grounded) {
    const r = pos.length();
    const surfR =
      PLANET_RADIUS +
      canyonOffsetDir(_up.copy(pos).normalize()) +
      citadelWalkLiftDir(_up);
    if (r < surfR + 0.1) {
      pos.setLength(surfR);
      const n = _up.copy(pos).normalize();
      const vr = n.dot(vel);
      if (vr < 0) vel.addScaledVector(n, -vr);
      grounded = true;
      groundR = surfR;
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

/**
 * 场景资产（树/房/岩）切向推开：防止玩家走进模型内部。
 * 与实验页 resolveSphericalColliders 同一手法：只推切向，不改径向高度。
 * @param {THREE.Vector3} pos 玩家位置（会被原地修改）
 * @param {{ position: THREE.Vector3, radius: number }[]} colliders
 * @param {number} [radius] 玩家碰撞半径
 */
export function resolveAssetColliders(pos, colliders, radius = PLAYER_RADIUS) {
  if (!colliders || !colliders.length) return;
  _up.copy(pos).normalize();
  for (const c of colliders) {
    const colliderRadius = c.radius || 0.4;
    const min = radius + colliderRadius;
    const colliderLen = c.position?.length?.() || 0;
    if (colliderLen < 1e-6) continue;

    // 球面近场守卫：只允许角距在碰撞半径附近的资产参与。
    // 旧算法直接投影世界差向量；对跖点附近的远端资产会投影为 0，
    // 因而产生“走到某处就被无形墙推回”的幽灵碰撞。
    _tmp.copy(c.position).multiplyScalar(1 / colliderLen);
    const angularReach = Math.min(Math.PI / 2, (min + 1.0) / PLANET_RADIUS);
    if (_up.dot(_tmp) < Math.cos(angularReach)) continue;

    _delta.copy(pos).sub(c.position);
    _delta.addScaledVector(_up, -_delta.dot(_up)); // 去掉径向 → 切向分离向量
    const d = _delta.length();
    if (d < 1e-6) {
      // 完全重合：沿任意切向推开
      _delta.set(1, 0, 0).addScaledVector(_up, -_up.x);
      if (_delta.lengthSq() < 1e-6) _delta.set(0, 0, 1).addScaledVector(_up, -_up.z);
      _delta.normalize().multiplyScalar(min);
      pos.add(_delta);
    } else if (d < min) {
      pos.addScaledVector(_delta, (min - d) / d);
    }
  }
}
