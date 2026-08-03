// =====================================================================
//  阿狸 · 国漫经典四足软萌（createClassicAliFox 全面重构）
//  - 二头身：大头 + 卵圆身（四足着地，非双足）
//  - 黑靴短腿对角碎步 + 全身颠簸
//  - 身后 45° 扬起火焰链式尾（S 形相位延迟）
//  - 黑亮圆眼 / 白眉 / 腮红 / 墨线描边
//  约定：脚底 y=0；正脸 +X；贴地行走见 updateFoxFollow
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";
import { placeObjectOnSphere } from "../world/sphereMath.js";
import { groundLiftAt, worldToFlatXZ } from "../world/hills.js";

export const FOX_ORANGE = 0xe96a36;
const FOX_CREAM = 0xf4f7ed;
const FOX_INK = 0x2a2a2a;
const FOX_BLUSH = 0xfadbd8;
const OUT = 0.04;

/** @typedef {'SLEEPING'|'FOLLOWING'} FoxState */

/**
 * @param {THREE.BufferGeometry} geo
 * @param {number|THREE.Material} colorOrMat
 * @param {number} [outline]
 */
function part(geo, colorOrMat, outline = OUT) {
  const mat =
    typeof colorOrMat === "number" || colorOrMat?.isColor
      ? toonMat(colorOrMat)
      : colorOrMat;
  const m = new THREE.Mesh(facet(geo), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  addOutline(m, outline);
  return m;
}

// ---------------------------------------------------------------------------
//  createClassicAliFox · 四足二头身洗髓重构
// ---------------------------------------------------------------------------

/**
 * 纯正四足阿狸（局部模型，未缩放前头半径 1.5）。
 * @returns {THREE.Group & { userData: object }}
 */
export function createClassicAliFox() {
  const g = new THREE.Group();
  g.name = "classic-ali-fox";

  // 枢轴：躯干中心，便于颠簸时整体上下
  const torso = new THREE.Group();
  torso.name = "fox-torso";
  g.add(torso);

  // ---------- 1. 横向卵圆身（头大身小）----------
  // 身长约 2.0；头 r=1.5 明显更大 → 二头身
  const body = part(new THREE.SphereGeometry(1.05, 8, 6), FOX_ORANGE, 0.05);
  body.name = "fox-body";
  body.scale.set(1.35, 0.85, 1.05); // 横向拉长卵形
  // 前胸微沉、后臀微翘
  body.rotation.z = -0.12;
  body.position.set(0.05, 1.05, 0);
  torso.add(body);

  // 乳白肚皮
  const belly = part(new THREE.SphereGeometry(0.72, 7, 5), FOX_CREAM, 0.03);
  belly.scale.set(1.1, 0.7, 0.85);
  belly.position.set(0.15, 0.78, 0);
  torso.add(belly);

  // ---------- 圆滚滚大头（r=1.5, segments=8）----------
  // 头底切入身体前上方约 0.25
  const headG = new THREE.Group();
  headG.name = "fox-head";
  // 身前上：身顶约 1.05+0.9≈1.95，头心 2.35 → 嵌套约 0.25+
  headG.position.set(1.05, 2.35, 0);
  torso.add(headG);

  const head = part(new THREE.SphereGeometry(1.5, 8, 8), FOX_ORANGE, 0.055);
  head.name = "fox-head-mesh";
  headG.add(head);

  // 尖耳
  for (const side of [-1, 1]) {
    const earG = new THREE.Group();
    earG.position.set(0.15, 1.15, side * 0.95);
    earG.rotation.order = "YXZ";
    earG.rotation.z = side * -0.35;
    earG.rotation.x = -0.15;
    earG.userData.baseRot = {
      x: earG.rotation.x,
      y: earG.rotation.y,
      z: earG.rotation.z,
    };
    const ear = part(new THREE.ConeGeometry(0.42, 0.95, 5), FOX_ORANGE, 0.03);
    ear.position.y = 0.4;
    ear.scale.set(1, 1, 0.55);
    earG.add(ear);
    const earIn = part(new THREE.ConeGeometry(0.22, 0.55, 4), FOX_CREAM, 0.014);
    earIn.position.set(0.06, 0.32, 0);
    earIn.scale.set(0.9, 0.9, 0.4);
    earG.add(earIn);
    const earTip = part(new THREE.ConeGeometry(0.14, 0.28, 4), FOX_INK, 0.012);
    earTip.position.y = 0.78;
    earG.add(earTip);
    headG.add(earG);
  }

  // ---------- 5. 清澈大圆眼 + 无辜五官 ----------
  for (const side of [-1, 1]) {
    // 黑亮大圆眼（扁圆贴片）
    const eye = part(new THREE.SphereGeometry(0.32, 8, 6), FOX_INK, 0.02);
    eye.scale.set(0.35, 1, 1);
    eye.position.set(1.28, 0.12, side * 0.62);
    headG.add(eye);
    // 高光小点
    const spark = part(new THREE.SphereGeometry(0.09, 5, 4), FOX_CREAM, 0.008);
    spark.position.set(1.38, 0.2, side * 0.55);
    headG.add(spark);

    // 乳白倒三角粗眉
    const brow = part(new THREE.ConeGeometry(0.2, 0.28, 3), FOX_CREAM, 0.012);
    brow.rotation.z = Math.PI;
    brow.scale.set(1.15, 0.9, 0.35);
    brow.position.set(1.05, 0.55, side * 0.58);
    brow.rotation.x = -0.25;
    headG.add(brow);

    // 腮红
    const cheek = part(new THREE.SphereGeometry(0.22, 6, 5), FOX_BLUSH, 0.01);
    cheek.scale.set(0.35, 0.85, 0.9);
    cheek.position.set(1.05, -0.25, side * 0.95);
    headG.add(cheek);
  }

  // 黑鼻头
  const nose = part(new THREE.SphereGeometry(0.14, 6, 5), FOX_INK, 0.012);
  nose.position.set(1.48, -0.15, 0);
  headG.add(nose);

  // ---------- 2. 四足 + 黑色小靴子 ----------
  // 顺序：0左前 1右前 2左后 3右后（面朝 +X）
  const legAnchors = [
    { x: 0.55, z: 0.48 }, // 左前
    { x: 0.55, z: -0.48 }, // 右前
    { x: -0.55, z: 0.48 }, // 左后
    { x: -0.55, z: -0.48 }, // 右后
  ];
  /** @type {THREE.Group[]} */
  const legs = [];
  const LEG_H = 0.55;
  const BOOT_H = 0.2;
  for (let i = 0; i < 4; i++) {
    const a = legAnchors[i];
    const legG = new THREE.Group();
    legG.name = `fox-leg-${i}`;
    // 髋：身体下缘
    legG.position.set(a.x, 0.62, a.z);
    // 橙大腿
    const thigh = part(new THREE.CylinderGeometry(0.18, 0.16, LEG_H, 5), FOX_ORANGE, 0.022);
    thigh.geometry.translate(0, -LEG_H * 0.5, 0);
    legG.add(thigh);
    // 焦黑短靴（下半 + 爪）
    const boot = part(new THREE.CylinderGeometry(0.17, 0.2, BOOT_H, 5), FOX_INK, 0.018);
    boot.position.y = -LEG_H - BOOT_H * 0.35;
    legG.add(boot);
    torso.add(legG);
    legs.push(legG);
  }

  // ---------- 3. 火焰大尾（体量 ~ 身体 1.2 倍，45° 扬起，5 节链式）----------
  const tailRoot = new THREE.Group();
  tailRoot.name = "fox-flame-tail";
  // 后臀
  tailRoot.position.set(-1.15, 1.15, 0);
  // 斜向上 45° 扬起，尾向 -X（身后）
  // 局部 +Y 为链延伸方向：先转到 -X 再抬 45°
  tailRoot.rotation.order = "ZYX";
  tailRoot.rotation.z = Math.PI / 2; // +Y → -X
  tailRoot.rotation.x = THREE.MathUtils.degToRad(45);
  torso.add(tailRoot);

  // 身体特征尺度 ~1.0；尾总长 1.2 倍
  const BODY_CHAR = 1.0;
  const TAIL_LEN = BODY_CHAR * 1.2 * 2.2; // 视觉上饱满修长
  // 5 节：先鼓后收，末节乳白
  const segs = [
    { w: 0.14, rMul: 0.7, color: FOX_ORANGE },
    { w: 0.18, rMul: 1.0, color: FOX_ORANGE },
    { w: 0.2, rMul: 0.85, color: FOX_ORANGE },
    { w: 0.22, rMul: 0.55, color: FOX_ORANGE },
    { w: 0.26, rMul: 0.32, color: FOX_CREAM },
  ];
  const baseR = 0.55; // 最粗节半径
  /** @type {THREE.Group[]} */
  const tailJoints = [];
  let parent = tailRoot;
  for (let i = 0; i < segs.length; i++) {
    const { w, rMul, color } = segs[i];
    const h = TAIL_LEN * w;
    const r = Math.max(0.08, baseR * rMul);
    const joint = new THREE.Group();
    joint.name = `fox-tail-j${i + 1}`;
    joint.position.y = i === 0 ? 0 : TAIL_LEN * segs[i - 1].w * 0.94;
    parent.add(joint);

    const geo = new THREE.ConeGeometry(r, h, 5);
    geo.translate(0, h * 0.5, 0);
    const mesh = part(geo, color, i === segs.length - 1 ? 0.028 : 0.035);
    mesh.name = i === segs.length - 1 ? "fox-tail-tip" : `fox-tail-seg-${i + 1}`;
    // 饱满火苗：不要压成纸片
    mesh.scale.set(0.85, 1, 0.75);
    if (i === segs.length - 1) mesh.scale.set(0.65, 1.15, 0.55);
    joint.add(mesh);

    joint.userData.baseRot = { x: 0, y: 0, z: 0 };
    joint.userData.segIndex = i;
    tailJoints.push(joint);
    parent = joint;
  }

  // 脚底贴 y=0
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  if (Number.isFinite(box.min.y)) g.position.y -= box.min.y;

  g.userData.classic = true;
  g.userData.torso = torso;
  g.userData.body = body;
  g.userData.head = headG;
  g.userData.legs = legs;
  g.userData.tailRoot = tailRoot;
  g.userData.tailJoints = tailJoints;
  g.userData.baseTorsoY = torso.position.y;

  return g;
}

// ---------------------------------------------------------------------------
//  createLowPolyFox · 状态机包装（睡 / 跟随）
// ---------------------------------------------------------------------------

/**
 * @param {{ scale?: number }} [opts]
 */
export function createLowPolyFox(opts = {}) {
  const g = new THREE.Group();
  g.name = "fox-ali";

  const classic = createClassicAliFox();
  // 与送信人体量相当（头 r1.5 缩放后约 0.42）
  const worldScale = opts.scale ?? 0.28;
  classic.scale.setScalar(worldScale);
  // 再贴一次地
  classic.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(classic);
  if (Number.isFinite(box.min.y)) classic.position.y -= box.min.y;
  g.add(classic);

  // 睡姿：蹲低 + 腿收
  const sleepPose = {
    torsoY: 0,
    legRotX: 0,
    headRotX: 0,
  };

  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.95, 28),
    new THREE.MeshBasicMaterial({
      color: 0x72d7e7,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.03;
  g.add(glowRing);

  /** @type {FoxState} */
  let foxState = "SLEEPING";

  function applySleepPose() {
    const u = classic.userData;
    // 趴低：躯干下沉、头埋、腿微屈
    u.torso.position.y = -0.12 * worldScale;
    u.torso.rotation.z = 0.25;
    u.head.rotation.x = 0.45;
    for (const leg of u.legs) {
      leg.rotation.x = 0.55;
      leg.rotation.z = 0;
    }
    // 尾平铺侧后
    u.tailRoot.rotation.order = "ZYX";
    u.tailRoot.rotation.z = Math.PI / 2;
    u.tailRoot.rotation.x = THREE.MathUtils.degToRad(8);
    for (const j of u.tailJoints) {
      j.rotation.set(0.05, 0.08, 0);
    }
    glowRing.visible = true;
  }

  function applyWalkPose() {
    const u = classic.userData;
    u.torso.position.y = 0;
    u.torso.rotation.z = -0.08; // 前胸微沉
    u.head.rotation.x = -0.05;
    for (const leg of u.legs) {
      leg.rotation.x = 0;
      leg.rotation.z = 0;
    }
    u.tailRoot.rotation.order = "ZYX";
    u.tailRoot.rotation.z = Math.PI / 2;
    u.tailRoot.rotation.x = THREE.MathUtils.degToRad(45);
    for (const j of u.tailJoints) {
      j.rotation.set(0, 0, 0);
    }
    glowRing.visible = false;
  }

  function standUp() {
    applyWalkPose();
    g.userData.sleeping = false;
    g.userData.following = true;
  }

  function lieDown() {
    applySleepPose();
    g.userData.sleeping = true;
    g.userData.following = false;
  }

  function switchState(next) {
    if (next !== "SLEEPING" && next !== "FOLLOWING") return;
    foxState = next;
    g.userData.foxState = next;
    if (next === "FOLLOWING") standUp();
    else lieDown();
  }

  // 初始睡姿
  applySleepPose();

  g.switchState = switchState;
  g.standUp = standUp;
  g.lieDown = lieDown;
  g.getState = () => foxState;

  // 兼容 foxNpc.parts
  const u = classic.userData;
  g.userData.kind = "fox";
  g.userData.displayName = "阿狸";
  g.userData.collideRadius = 0.55;
  g.userData.sleeping = true;
  g.userData.following = false;
  g.userData.foxState = "SLEEPING";
  g.userData.worldScale = worldScale;
  g.userData.glowRing = glowRing;
  g.userData.classicRoot = classic;
  g.userData.parts = {
    rig: classic,
    classic,
    torso: u.torso,
    body: u.body,
    hips: u.torso, // 颠簸用 torso
    chest: u.torso,
    head: u.head,
    walkHead: u.head,
    legs: u.legs,
    legMeshes: u.legs,
    tail: u.tailRoot,
    tailJoints: u.tailJoints,
    glowRing,
    base: { bodyY: 0, torsoY: 0 },
  };

  return g;
}

// 兼容旧名
export const createWalkingFox = createClassicAliFox;

// ---------------------------------------------------------------------------
//  地面尾随 + 四足碎步 + 颠簸 + 火焰尾相位延迟
// ---------------------------------------------------------------------------

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qCur = new THREE.Quaternion();
const _flatTmp = { x: 0, z: 0 };

export const FOX_FOLLOW_GAP = 2.2;
export const FOX_FOLLOW_LERP = 0.14;
export const FOX_FOOT_LIFT = 0.02;
export const FOX_TURN_SLERP = 0.18;
/** 颠簸振幅（沿法线，未乘 scale 前约 0.2，再按世界尺度感压一点） */
export const FOX_HOP_AMP = 0.12;

/**
 * 贴地跟随 + 四足碎步 + 全身颠簸 + 火焰尾 S 链延迟
 * @returns {boolean} moving
 */
export function updateFoxFollow(fox, playerPos, planetRadius, opts = {}) {
  if (!fox || !playerPos) return false;
  const state = fox.getState?.() ?? fox.userData?.foxState;
  if (state !== "FOLLOWING") return false;

  const gap = opts.gap ?? FOX_FOLLOW_GAP;
  const lerpK = opts.lerp ?? FOX_FOLLOW_LERP;
  const footLift = opts.footLift ?? FOX_FOOT_LIFT;
  const turnK = opts.turn ?? FOX_TURN_SLERP;
  const hopAmp = opts.hopAmp ?? FOX_HOP_AMP;
  const time = opts.time ?? performance.now() * 0.001;

  _prev.copy(fox.position);

  let flatFox = worldToFlatXZ(fox.position, planetRadius);
  let flatPl = worldToFlatXZ(playerPos, planetRadius);
  if (!flatFox) flatFox = approxFlatFromWorld(fox.position, planetRadius);
  if (!flatPl) flatPl = approxFlatFromWorld(playerPos, planetRadius);

  let fx = flatFox.x;
  let fz = flatFox.z;
  let moving = false;

  const dx = flatPl.x - fx;
  const dz = flatPl.z - fz;
  const dist = Math.hypot(dx, dz);

  if (dist > gap) {
    const ux = dx / dist;
    const uz = dz / dist;
    const tx = flatPl.x - ux * gap * 0.88;
    const tz = flatPl.z - uz * gap * 0.88;
    const k = Math.min(1, lerpK * (1 + (dist - gap) * 0.1));
    fx += (tx - fx) * k;
    fz += (tz - fz) * k;
    moving = dist > gap + 0.1;
  }

  // 贴地
  const groundY = groundLiftAt(fx, fz) + footLift;
  placeObjectOnSphere(fox, fx, fz, groundY, planetRadius);

  // 朝向（+X 正脸）
  _up.copy(fox.position).normalize();
  _fwd.subVectors(fox.position, _prev);
  _fwd.addScaledVector(_up, -_fwd.dot(_up));
  if (_fwd.lengthSq() < 1e-8) {
    _fwd.copy(playerPos).sub(fox.position);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
  }
  if (_fwd.lengthSq() < 1e-8) {
    _fwd.set(0, 0, 1).addScaledVector(_up, -_up.z);
    if (_fwd.lengthSq() < 1e-8) _fwd.set(1, 0, 0).addScaledVector(_up, -_up.x);
  }
  _fwd.normalize();
  _right.crossVectors(_fwd, _up).normalize();
  _fwd.crossVectors(_up, _right).normalize();
  _m.makeBasis(_fwd, _up, _right);
  _q.setFromRotationMatrix(_m);
  _qCur.copy(fox.quaternion).slerp(_q, turnK);
  fox.quaternion.copy(_qCur);

  // ---- 四足碎步 + 颠簸 + 火焰尾（在贴地之后）----
  animateClassicRun(fox, time, moving, hopAmp);

  // 颠簸：沿法线抬起（球面「Y」）
  if (moving) {
    const hop = Math.abs(Math.sin(time * 15)) * hopAmp;
    fox.position.addScaledVector(_up, hop);
  }

  fox.userData.flatX = fx;
  fox.userData.flatZ = fz;
  if (fox.userData?.collider?.position) {
    fox.userData.collider.position.copy(fox.position);
  }
  return moving;
}

/**
 * 经典阿狸跑步动画：对角碎步 + 火焰尾相位延迟
 */
export function animateClassicRun(fox, time, moving, hopAmp = FOX_HOP_AMP) {
  const p = fox.userData?.parts || fox.userData;
  const classic = fox.userData?.classicRoot?.userData || p;
  const legs = p.legMeshes || p.legs || classic.legs;
  const joints = p.tailJoints || classic.tailJoints;
  const torso = p.torso || classic.torso;
  const head = p.head || p.walkHead || classic.head;
  const tailRoot = p.tail || classic.tailRoot;

  if (!legs || !joints) return;

  const t15 = time * 15;

  if (moving) {
    // 对角：左前0 + 右后3；右前1 + 左后2
    const s = Math.sin(t15) * 0.4;
    if (legs[0]) legs[0].rotation.x = s;
    if (legs[3]) legs[3].rotation.x = s;
    if (legs[1]) legs[1].rotation.x = -s;
    if (legs[2]) legs[2].rotation.x = -s;

    // 躯干轻颠（局部，配合世界法线 hop）
    if (torso) {
      torso.position.y = Math.abs(Math.sin(t15)) * 0.06;
      torso.rotation.z = -0.08 + Math.sin(t15) * 0.04;
    }
    if (head) {
      head.rotation.x = -0.05 + Math.sin(t15 * 0.5) * 0.05;
      head.rotation.y = Math.sin(t15 * 0.35) * 0.06;
    }
  } else {
    for (const leg of legs) {
      if (leg) leg.rotation.x *= 0.85;
    }
    if (torso) {
      torso.position.y = Math.sin(time * 2) * 0.02;
      torso.rotation.z = -0.08;
    }
  }

  // 火焰尾 S 链延迟（规范相位）
  // tail1.y = sin(t*15)*0.2; tail2 = sin(t*15-0.2)*0.25; ...
  const phaseY = [0, 0.2, 0.4, 0.6, 0.8];
  const ampY = [0.2, 0.25, 0.3, 0.35, 0.4];
  const ampX = [0.08, 0.1, 0.14, 0.18, 0.22];
  const ampScale = moving ? 1 : 0.4;
  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    if (!j) continue;
    const py = phaseY[i] ?? i * 0.2;
    const ay = (ampY[i] ?? 0.25) * ampScale;
    const ax = (ampX[i] ?? 0.12) * ampScale;
    j.rotation.y = Math.sin(t15 - py) * ay;
    j.rotation.x = Math.cos(t15 - py * 1.1) * ax;
    j.rotation.z = Math.sin(t15 * 0.9 - py * 0.8) * ax * 0.4;
  }
  // 尾根保持 45° 扬起 + 轻随风
  if (tailRoot) {
    tailRoot.rotation.order = "ZYX";
    tailRoot.rotation.z = Math.PI / 2;
    tailRoot.rotation.x =
      THREE.MathUtils.degToRad(45) + Math.sin(time * 3) * (moving ? 0.05 : 0.025);
    tailRoot.rotation.y = Math.sin(time * 2.2) * (moving ? 0.06 : 0.03);
  }
}

function approxFlatFromWorld(worldPos, R) {
  const dir = worldPos.clone().normalize();
  const latDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)));
  const theta = THREE.MathUtils.degToRad(90 - latDeg);
  const phi = Math.atan2(dir.z, dir.x);
  const dist = theta * R;
  _flatTmp.x = Math.cos(phi) * dist;
  _flatTmp.z = Math.sin(phi) * dist;
  return _flatTmp;
}
