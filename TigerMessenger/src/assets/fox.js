// =====================================================================
//  阿狸 · 低多边形卡通小狐狸
//  SLEEPING / FOLLOWING 状态 · standUp 四短腿 · 球面尾随由 foxNpc 驱动
//  约定：底部贴局部 Y=0；世界朝向由 Group 四元数控制（+Y 法线，+X 正脸）
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

/** 动漫橙 · 主体 / 耳根 / 尾根 / 腿 */
export const FOX_ORANGE = 0xe96a36;
/** 乳白 · 下巴脸颊 / 逗号眉 / 尾尖 */
const FOX_CREAM = 0xf4f7ed;
/** 焦黑 · 鼻尖 / 耳尖 / 小爪 */
const FOX_INK = 0x2a2a2a;

const OUT = 0.03;

/** @typedef {'SLEEPING'|'FOLLOWING'} FoxState */

/**
 * @param {THREE.BufferGeometry} geo
 * @param {THREE.Material} mat
 * @param {number} [outline=OUT]
 */
function part(geo, mat, outline = OUT) {
  const mesh = new THREE.Mesh(facet(geo), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, outline);
  return mesh;
}

/**
 * 蜷缩熟睡的低多边形小狐狸「阿狸」。
 * @param {{ scale?: number }} [opts]
 * @returns {THREE.Group & {
 *   switchState: (s: FoxState) => void,
 *   standUp: () => void,
 *   lieDown: () => void,
 *   getState: () => FoxState,
 * }}
 */
export function createLowPolyFox(opts = {}) {
  const g = new THREE.Group();
  g.name = "fox-ali";

  const orange = toonMat(FOX_ORANGE);
  const cream = toonMat(FOX_CREAM);
  const ink = toonMat(FOX_INK);

  const rig = new THREE.Group();
  rig.name = "fox-rig";
  g.add(rig);

  // ========== 1. 身体主体：拉长扁平盒，趴卧 ==========
  const body = part(new THREE.BoxGeometry(1.15, 0.38, 0.68), orange);
  body.name = "fox-body";
  body.position.set(0.05, 0.19, 0.02);
  body.rotation.z = -0.08;
  body.rotation.x = 0.04;
  rig.add(body);

  const belly = part(new THREE.BoxGeometry(0.55, 0.16, 0.42), cream, 0.022);
  belly.name = "fox-belly-cream";
  belly.position.set(0.22, 0.1, 0.04);
  rig.add(belly);

  // ========== 2. 大尾巴（关节链：根→中→尖，便于自然甩尾） ==========
  // 睡姿：尾环抱身侧；站姿：整条链翘向后上方（-X / +Y）
  const tailG = new THREE.Group();
  tailG.name = "fox-tail";
  rig.add(tailG);

  // joint0 在髋部；子关节沿局部 +Y 串联（旋转后 +Y ≈ 后上）
  const tailJoint0 = new THREE.Group();
  tailJoint0.name = "fox-tail-j0";
  tailG.add(tailJoint0);
  const tailJoint1 = new THREE.Group();
  tailJoint1.name = "fox-tail-j1";
  tailJoint0.add(tailJoint1);
  const tailJoint2 = new THREE.Group();
  tailJoint2.name = "fox-tail-j2";
  tailJoint1.add(tailJoint2);

  const tailRoot = part(new THREE.IcosahedronGeometry(0.36, 1), orange);
  tailRoot.name = "fox-tail-root";
  tailRoot.scale.set(1.25, 1.05, 1.1);
  tailJoint0.add(tailRoot);

  const tailMid = part(new THREE.IcosahedronGeometry(0.28, 1), orange, 0.026);
  tailMid.name = "fox-tail-mid";
  tailMid.scale.set(1.15, 1.0, 1.05);
  tailJoint1.add(tailMid);

  const tailTip = part(new THREE.IcosahedronGeometry(0.22, 1), cream, 0.024);
  tailTip.name = "fox-tail-tip";
  tailTip.scale.set(1.1, 0.95, 1.0);
  tailJoint2.add(tailTip);

  /** 睡姿：蓬松尾绕到身体右侧 */
  function applySleepTailPose() {
    tailG.position.set(0, 0, 0);
    tailG.rotation.set(0, 0, 0);
    tailJoint0.position.set(-0.42, 0.28, 0.28);
    tailJoint0.rotation.set(0.2, -0.45, 0.3);
    tailJoint1.position.set(0.12, 0.08, 0.22);
    tailJoint1.rotation.set(0.15, -0.2, 0.1);
    tailJoint2.position.set(0.14, 0.06, 0.18);
    tailJoint2.rotation.set(0.2, 0.15, -0.05);
    tailRoot.position.set(0, 0, 0);
    tailMid.position.set(0, 0, 0);
    tailTip.position.set(0, 0, 0);
  }

  /** 站姿：尾从臀后斜斜翘起，关节沿 +Y 串成弧 */
  function applyStandTailPose() {
    // 附着点：身体后臀
    tailG.position.set(-0.4, 0.36, 0);
    // 整链朝后上方（局部 +Y 指向 -X/+Y 世界向）
    tailG.rotation.set(0, 0, 0.95);
    tailJoint0.position.set(0, 0, 0);
    tailJoint0.rotation.set(0, 0, 0);
    tailJoint1.position.set(0, 0.28, 0);
    tailJoint1.rotation.set(0.12, 0, 0.08); // 略弯
    tailJoint2.position.set(0, 0.24, 0);
    tailJoint2.rotation.set(0.1, 0, 0.06);
    tailRoot.position.set(0, 0.08, 0);
    tailMid.position.set(0, 0.06, 0);
    tailTip.position.set(0, 0.08, 0);
  }

  applySleepTailPose();

  // ========== 3. 头部 ==========
  const headG = new THREE.Group();
  headG.name = "fox-head";
  headG.position.set(0.62, 0.28, 0.06);
  headG.rotation.set(0.35, 0.15, -0.12);

  const head = part(new THREE.IcosahedronGeometry(0.28, 0), orange);
  head.name = "fox-head-shell";
  head.scale.set(1.35, 0.95, 0.95);
  head.position.set(0.06, 0.02, 0);
  headG.add(head);

  const muzzle = part(new THREE.BoxGeometry(0.28, 0.16, 0.32), cream, 0.022);
  muzzle.name = "fox-muzzle";
  muzzle.position.set(0.22, -0.06, 0);
  muzzle.rotation.z = -0.15;
  headG.add(muzzle);

  const nose = part(new THREE.BoxGeometry(0.07, 0.055, 0.07), ink, 0.016);
  nose.name = "fox-nose";
  nose.position.set(0.38, -0.02, 0);
  headG.add(nose);

  for (const side of [-1, 1]) {
    const brow = part(new THREE.BoxGeometry(0.1, 0.045, 0.06), cream, 0.014);
    brow.name = side < 0 ? "fox-brow-L" : "fox-brow-R";
    brow.position.set(0.08, 0.14, side * 0.12);
    brow.rotation.z = side * 0.35;
    brow.rotation.y = side * -0.2;
    headG.add(brow);
  }

  const lids = [];
  for (const side of [-1, 1]) {
    const lid = part(new THREE.BoxGeometry(0.09, 0.02, 0.035), ink, 0.01);
    lid.name = side < 0 ? "fox-lid-L" : "fox-lid-R";
    lid.position.set(0.18, 0.06, side * 0.11);
    lid.rotation.z = 0.1;
    headG.add(lid);
    lids.push(lid);
  }

  const ears = [];
  for (const side of [-1, 1]) {
    const earG = new THREE.Group();
    earG.name = side < 0 ? "fox-ear-L" : "fox-ear-R";
    const earOuter = part(new THREE.ConeGeometry(0.14, 0.36, 4), orange, 0.026);
    earOuter.position.y = 0.16;
    earG.add(earOuter);
    const earTip = part(new THREE.ConeGeometry(0.07, 0.12, 3), ink, 0.016);
    earTip.position.y = 0.32;
    earG.add(earTip);
    const earIn = part(new THREE.ConeGeometry(0.08, 0.22, 3), cream, 0.014);
    earIn.position.set(0.02, 0.12, 0);
    earIn.scale.set(0.7, 0.85, 0.55);
    earG.add(earIn);
    earG.position.set(-0.02, 0.18, side * 0.16);
    earG.rotation.order = "YXZ";
    earG.rotation.x = -0.25;
    earG.rotation.z = side * -0.55;
    earG.rotation.y = side * 0.2;
    earG.userData.baseRot = {
      x: earG.rotation.x,
      y: earG.rotation.y,
      z: earG.rotation.z,
    };
    headG.add(earG);
    ears.push(earG);
  }
  rig.add(headG);

  // ========== 5. 睡姿爪垫（站立后隐藏） ==========
  const sleepPaws = [];
  for (const side of [-1, 1]) {
    const paw = part(new THREE.BoxGeometry(0.14, 0.08, 0.12), ink, 0.016);
    paw.position.set(0.48, 0.04, side * 0.14);
    paw.rotation.y = side * 0.25;
    rig.add(paw);
    sleepPaws.push(paw);
  }
  for (const side of [-1, 1]) {
    const hind = part(new THREE.BoxGeometry(0.12, 0.07, 0.1), orange, 0.014);
    hind.position.set(-0.28, 0.04, side * 0.22);
    rig.add(hind);
    sleepPaws.push(hind);
  }

  // ========== 地面淡蓝光圈（跟随后隐藏） ==========
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.78, 28),
    new THREE.MeshBasicMaterial({
      color: 0x72d7e7,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  glowRing.name = "fox-glow-ring";
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.04;
  g.add(glowRing);

  // 站立短腿容器（standUp 时生成）
  const legsG = new THREE.Group();
  legsG.name = "fox-legs";
  legsG.visible = false;
  rig.add(legsG);

  // 缩放与贴地
  const worldScale = opts.scale ?? 0.52;
  rig.scale.setScalar(worldScale);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  if (Number.isFinite(box.min.y) && Math.abs(box.min.y) > 1e-4) {
    rig.position.y -= box.min.y;
  }

  // 睡姿基线（standUp / lieDown 读写）
  const sleepPose = {
    bodyY: body.position.y,
    bodyRotX: body.rotation.x,
    bodyRotZ: body.rotation.z,
    bellyY: belly.position.y,
    headPos: headG.position.clone(),
    headRot: headG.rotation.clone(),
  };

  // 站姿关节零点（动画在此之上叠加）
  const standTailRest = {
    j0: { x: 0, y: 0, z: 0 },
    j1: { x: 0.12, y: 0, z: 0.08 },
    j2: { x: 0.1, y: 0, z: 0.06 },
    g: { x: 0, y: 0, z: 0.95 },
  };

  // 动画叠加用 base
  const base = {
    bodyY: sleepPose.bodyY,
    bodyRotX: sleepPose.bodyRotX,
    headRot: {
      x: sleepPose.headRot.x,
      y: sleepPose.headRot.y,
      z: sleepPose.headRot.z,
    },
    tailRot: { x: 0, y: 0, z: 0 },
    tailStand: standTailRest,
  };

  /** @type {FoxState} */
  let foxState = "SLEEPING";
  let legsBuilt = false;

  /**
   * 极简四短腿：细长 BoxGeometry + 橙色 toon + addOutline
   */
  function buildLegs() {
    if (legsBuilt) return;
    legsBuilt = true;
    // 局部：身体下方，前二后二
    const legGeo = new THREE.BoxGeometry(0.08, 0.28, 0.08);
    const spots = [
      [0.28, 0.14, 0.18],
      [0.28, 0.14, -0.18],
      [-0.22, 0.14, 0.2],
      [-0.22, 0.14, -0.2],
    ];
    for (let i = 0; i < 4; i++) {
      const leg = part(legGeo, orange, OUT);
      leg.name = `fox-leg-${i}`;
      leg.position.set(spots[i][0], spots[i][1], spots[i][2]);
      legsG.add(leg);
    }
  }

  /**
   * 站立：抬高身体、显短腿、尾巴斜斜翘向后上方
   */
  function standUp() {
    buildLegs();
    legsG.visible = true;
    for (const p of sleepPaws) p.visible = false;
    for (const lid of lids) lid.visible = false;

    // 身体上抬（局部 Y）
    body.position.y = sleepPose.bodyY + 0.22;
    body.rotation.x = -0.08;
    body.rotation.z = 0;
    belly.position.y = sleepPose.bellyY + 0.18;
    belly.position.x = 0.12;

    // 头抬起朝前（+X 正脸）
    headG.position.set(0.58, 0.48, 0);
    headG.rotation.set(-0.05, 0, 0);

    // 尾巴：关节链斜斜翘向后上方
    applyStandTailPose();

    // 腿挂在抬高后的身体下
    legsG.position.y = 0;

    // 动画基线切到站姿
    base.bodyY = body.position.y;
    base.bodyRotX = body.rotation.x;
    base.headRot = { x: headG.rotation.x, y: headG.rotation.y, z: headG.rotation.z };
    base.tailStand = {
      j0: { x: tailJoint0.rotation.x, y: tailJoint0.rotation.y, z: tailJoint0.rotation.z },
      j1: { x: tailJoint1.rotation.x, y: tailJoint1.rotation.y, z: tailJoint1.rotation.z },
      j2: { x: tailJoint2.rotation.x, y: tailJoint2.rotation.y, z: tailJoint2.rotation.z },
      g: { x: tailG.rotation.x, y: tailG.rotation.y, z: tailG.rotation.z },
    };

    glowRing.visible = false;
    g.userData.sleeping = false;
    g.userData.following = true;
  }

  /** 躺回睡姿 */
  function lieDown() {
    legsG.visible = false;
    for (const p of sleepPaws) p.visible = true;
    for (const lid of lids) lid.visible = true;

    body.position.y = sleepPose.bodyY;
    body.rotation.x = sleepPose.bodyRotX;
    body.rotation.z = sleepPose.bodyRotZ;
    belly.position.set(0.22, sleepPose.bellyY, 0.04);

    headG.position.copy(sleepPose.headPos);
    headG.rotation.copy(sleepPose.headRot);

    applySleepTailPose();

    base.bodyY = sleepPose.bodyY;
    base.bodyRotX = sleepPose.bodyRotX;
    base.headRot = {
      x: sleepPose.headRot.x,
      y: sleepPose.headRot.y,
      z: sleepPose.headRot.z,
    };

    glowRing.visible = true;
    g.userData.sleeping = true;
    g.userData.following = false;
  }

  /**
   * 状态切换：SLEEPING ↔ FOLLOWING
   * @param {FoxState} next
   */
  function switchState(next) {
    if (next !== "SLEEPING" && next !== "FOLLOWING") return;
    if (foxState === next) {
      // 仍同步姿势
      if (next === "FOLLOWING") standUp();
      else lieDown();
      return;
    }
    foxState = next;
    g.userData.foxState = next;
    if (next === "FOLLOWING") standUp();
    else lieDown();
  }

  function getState() {
    return foxState;
  }

  // 绑到 Group，便于外部 fox.switchState / standUp
  g.switchState = switchState;
  g.standUp = standUp;
  g.lieDown = lieDown;
  g.getState = getState;

  g.userData.kind = "fox";
  g.userData.displayName = "阿狸";
  g.userData.collideRadius = 0.38;
  g.userData.sleeping = true;
  g.userData.following = false;
  g.userData.foxState = "SLEEPING";
  g.userData.worldScale = worldScale;
  g.userData.glowRing = glowRing;
  g.userData.parts = {
    rig,
    body,
    belly,
    head: headG,
    tail: tailG,
    tailJoint0,
    tailJoint1,
    tailJoint2,
    tailRoot,
    tailMid,
    tailTip,
    ears,
    lids,
    paws: sleepPaws,
    legs: legsG,
    glowRing,
    base,
  };

  return g;
}

// ---------------------------------------------------------------------------
//  球面尾随 + 双轴朝向（可从主循环直接调用）
// ---------------------------------------------------------------------------

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _target = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qCur = new THREE.Quaternion();

/** 跟随时与玩家的最小距离（大于此才 lerp 靠近） */
export const FOX_FOLLOW_GAP = 3.5;
/** lerp 系数 · 空气感滑行 */
export const FOX_FOLLOW_LERP = 0.05;
/** 贴地高度偏移（相对球半径） */
export const FOX_SURFACE_LIFT = 0.12;
/** 朝向 slerp 速度 */
export const FOX_TURN_SLERP = 0.14;

/**
 * 每帧：FOLLOWING 时球面平滑尾随 + 四元数朝向纠偏。
 * 模型约定：本地 +Y 为上，+X 为正脸（头在 +X）。
 *
 * @param {THREE.Object3D} fox
 * @param {THREE.Vector3} playerPos
 * @param {number} planetRadius
 * @param {{ gap?: number, lerp?: number, lift?: number, turn?: number }} [opts]
 * @returns {boolean} 本帧是否在移动
 */
export function updateFoxFollow(fox, playerPos, planetRadius, opts = {}) {
  if (!fox || !playerPos) return false;
  const state = fox.getState?.() ?? fox.userData?.foxState;
  if (state !== "FOLLOWING") return false;

  const gap = opts.gap ?? FOX_FOLLOW_GAP;
  const lerpK = opts.lerp ?? FOX_FOLLOW_LERP;
  const lift = opts.lift ?? FOX_SURFACE_LIFT;
  const turnK = opts.turn ?? FOX_TURN_SLERP;
  const R = planetRadius + lift;

  _prev.copy(fox.position);
  const dist = fox.position.distanceTo(playerPos);
  let moving = false;

  if (dist > gap) {
    // 带空气感的平滑靠近
    fox.position.lerp(playerPos, lerpK);
    moving = true;
  }

  // 确保贴合球面：归一化 × (R+lift)
  const len = fox.position.length();
  if (len > 1e-6) {
    fox.position.multiplyScalar(R / len);
  } else {
    fox.position.copy(playerPos).normalize().multiplyScalar(R);
  }

  // ---- 双轴朝向 ----
  // Up：球心 → 狐狸
  _up.copy(fox.position).normalize();

  // Forward：优先本帧位移切线，否则朝向玩家的切向投影
  _fwd.subVectors(fox.position, _prev);
  _fwd.addScaledVector(_up, -_fwd.dot(_up));
  if (_fwd.lengthSq() < 1e-8) {
    _fwd.subVectors(playerPos, fox.position);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
  }
  if (_fwd.lengthSq() < 1e-8) {
    // 退化：任意切向
    _fwd.set(0, 0, 1).addScaledVector(_up, -_up.z);
    if (_fwd.lengthSq() < 1e-8) _fwd.set(1, 0, 0).addScaledVector(_up, -_up.x);
  }
  _fwd.normalize();

  // 模型 +X = 正脸前进，+Y = 上，+Z = 右侧
  _right.crossVectors(_up, _fwd).normalize();
  // 重正交：fwd = right × up?  want X=fwd, Y=up, Z=right
  // right = up × fwd  →  makeBasis(fwd, up, right) 需要 right = fwd × up
  _right.crossVectors(_fwd, _up).normalize();
  _fwd.crossVectors(_up, _right).normalize(); // 再正交

  _m.makeBasis(_fwd, _up, _right);
  _q.setFromRotationMatrix(_m);
  _qCur.copy(fox.quaternion);
  _qCur.slerp(_q, turnK);
  fox.quaternion.copy(_qCur);

  // 碰撞球
  if (fox.userData?.collider?.position) {
    fox.userData.collider.position.copy(fox.position);
  }

  return moving;
}
