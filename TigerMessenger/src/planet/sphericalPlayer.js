// =====================================================================
//  球面玩家：立方体 + 球心引力 + 沿球面滑行 + 径向跳跃
//  原理：
//    - 本地 Up = normalize(position)，始终垂直球面
//    - 引力方向 = -up（永远指向球心）
//    - 贴地时半径锁定在 R + half；空中自由径向，再落回
// =====================================================================
import * as THREE from "three";

export const CUBE_SIZE = 1.2;
export const MOVE_SPEED = 6.0;
export const SPRINT_MULT = 1.4;
export const GRAVITY = 22.0;
export const JUMP_VELOCITY = 9.0;
export const PLAYER_COLLIDE_R = 0.65;

// 模块级临时变量（避免每帧分配）
const _up = new THREE.Vector3();
const _camF = new THREE.Vector3();
const _camR = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _targetVel = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _push = new THREE.Vector3();
const _tangVel = new THREE.Vector3();

/**
 * 创建立方体玩家，出生在星球北极。
 */
export function createSphericalPlayer(scene, planetRadius) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
    new THREE.MeshStandardMaterial({
      color: 0xffb35c,
      roughness: 0.6,
      flatShading: true,
    })
  );
  mesh.castShadow = true;
  scene.add(mesh);

  const groundR = planetRadius + CUBE_SIZE / 2;
  const player = {
    mesh,
    groundR,
    position: new THREE.Vector3(0, groundR, 0),
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, -1),
    onGround: true,
  };
  mesh.position.copy(player.position);
  return player;
}

/**
 * 与球面贴地碰撞体（切向圆）推开。
 * @param {{ position: THREE.Vector3, radius: number }[]} colliders
 */
export function resolveSphericalColliders(player, colliders) {
  if (!colliders || !colliders.length) return;
  const up = _up.copy(player.position).normalize();
  for (const c of colliders) {
    _push.copy(player.position).sub(c.position);
    // 去掉径向分量 → 切平面分离
    _push.addScaledVector(up, -_push.dot(up));
    const dist = _push.length();
    const minDist = PLAYER_COLLIDE_R + (c.radius || 0.5);
    if (dist < 1e-6) {
      // 完全重合：沿前进切向推开
      _push.copy(player.forward).addScaledVector(up, -player.forward.dot(up));
      if (_push.lengthSq() < 1e-6) _push.set(1, 0, 0).addScaledVector(up, -up.x);
      _push.normalize().multiplyScalar(minDist);
    } else if (dist < minDist) {
      _push.multiplyScalar((minDist - dist) / dist);
    } else {
      continue;
    }
    player.position.add(_push);
    // 保持当前高度（贴地或空中）
    const r = player.position.length();
    // 不改变径向距离，只切向推
    if (r > 1e-6) {
      // already moved tangentially; re-normalize length to previous r approx
    }
  }
}

/**
 * 每帧更新：WASD / 跳 / 球心引力 / 球面约束 / 碰撞。
 * @param {object[]} [colliders]
 */
export function updateSphericalPlayer(player, keys, camera, dt, planetRadius, colliders = []) {
  const groundR = planetRadius + CUBE_SIZE / 2;
  player.groundR = groundR;

  // 本地 Up = 球面法线
  const up = _up.copy(player.position).normalize();

  // WASD（相机相对 → 切平面）
  let ix = 0;
  let iz = 0;
  if (keys["KeyW"] || keys["ArrowUp"]) iz -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) iz += 1;
  if (keys["KeyA"] || keys["ArrowLeft"]) ix -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) ix += 1;

  camera.getWorldDirection(_camF);
  _camF.addScaledVector(up, -_camF.dot(up));
  if (_camF.lengthSq() < 1e-6) _camF.copy(player.forward);
  _camF.normalize();
  _camR.crossVectors(_camF, up);
  _wish.set(0, 0, 0);
  if (ix !== 0 || iz !== 0) {
    _wish.addScaledVector(_camF, -iz).addScaledVector(_camR, ix).normalize();
  }

  const sprint = keys["ShiftLeft"] || keys["ShiftRight"];
  const speed = MOVE_SPEED * (sprint ? SPRINT_MULT : 1);

  // 切向速度：贴地时强跟手，空中弱控制
  _targetVel.copy(_wish).multiplyScalar(speed);
  // 保留现有径向速度分量
  const radialSpeed = up.dot(player.velocity);
  const blend = player.onGround ? 1 - Math.exp(-10 * dt) : 1 - Math.exp(-3 * dt);
  // 仅插值切向部分
  _tangVel.copy(player.velocity).addScaledVector(up, -radialSpeed);
  _tangVel.lerp(_targetVel, blend);
  player.velocity.copy(_tangVel).addScaledVector(up, radialSpeed);

  // 跳跃：沿 +up 冲量
  if (player.onGround && (keys["Space"] || keys["KeyJ"])) {
    // 先清内向径向，再给外向冲量
    const vr = up.dot(player.velocity);
    if (vr < 0) player.velocity.addScaledVector(up, -vr);
    player.velocity.addScaledVector(up, JUMP_VELOCITY);
    player.onGround = false;
  }

  // 引力：永远指向球心
  player.velocity.addScaledVector(up, -GRAVITY * dt);

  // 位置积分（空中不锁半径）
  player.position.addScaledVector(player.velocity, dt);

  // 球面约束：不可陷入；贴地时锁定
  const r = player.position.length();
  if (r < groundR || (player.onGround && Math.abs(r - groundR) < 0.08)) {
    player.position.setLength(groundR);
    const up2 = _up.copy(player.position).normalize();
    const vr = up2.dot(player.velocity);
    if (vr < 0) player.velocity.addScaledVector(up2, -vr);
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  // 资产碰撞推开（切向）
  resolveSphericalColliders(player, colliders);
  // 推开后再次保证不陷入
  if (player.position.length() < groundR) {
    player.position.setLength(groundR);
    player.onGround = true;
  }

  // 朝向
  const upN = _up.copy(player.position).normalize();
  if (_wish.lengthSq() > 0) player.forward.copy(_wish);
  _fwd.copy(player.forward).addScaledVector(upN, -player.forward.dot(upN));
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1).addScaledVector(upN, upN.z);
  _fwd.normalize();
  _right.crossVectors(upN, _fwd);
  _basis.makeBasis(_right, upN, _fwd);
  _quat.setFromRotationMatrix(_basis);
  player.mesh.quaternion.slerp(_quat, 1 - Math.exp(-10 * dt));
  player.mesh.position.copy(player.position);
}
