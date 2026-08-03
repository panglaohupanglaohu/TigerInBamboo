// =====================================================================
//  阿狸 · 低多边形卡通小狐狸
//  - SLEEPING：蜷缩熟睡
//  - FOLLOWING / 行走：createWalkingFox 形态
//      前胸+后臀分段 · 双锥舒展尾 · 眯眯眼+白眉 · 扭臀甩尾
//  约定：底部贴局部 Y=0；世界朝向 +Y 法线、+X 正脸
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";
import { placeObjectOnSphere } from "../world/sphereMath.js";
import { groundLiftAt, worldToFlatXZ } from "../world/hills.js";

/** 动漫橙 */
export const FOX_ORANGE = 0xe96a36;
/** 乳白 */
const FOX_CREAM = 0xf4f7ed;
/** 焦黑 */
const FOX_INK = 0x2a2a2a;

const OUT = 0.03;

/** @typedef {'SLEEPING'|'FOLLOWING'} FoxState */

/**
 * @param {THREE.BufferGeometry} geo
 * @param {THREE.Material} mat
 * @param {number} [outline=OUT]
 */
function part(geo, mat, outline = OUT) {
  // MeshToonMaterial 无 flatShading 字段；facet() = 硬边等价
  const mesh = new THREE.Mesh(facet(geo), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, outline);
  return mesh;
}

// ---------------------------------------------------------------------------
//  行走形态：前胸 / 后臀 / 双锥尾 / 四腿 / 五官
// ---------------------------------------------------------------------------

/**
 * 构建「行走/尾随」形态的局部 rig（未缩放）。
 * 身体长约 1.0、宽约 0.62（相对送信人体量再乘 worldScale）。
 *
 * @param {{ orange: THREE.Material, cream: THREE.Material, ink: THREE.Material }} mats
 * @returns {object} walking parts
 */
export function createWalkingFox(mats) {
  const { orange, cream, ink } = mats;

  // ---- 尺寸指标 ----
  const BODY_W = 0.62; // 身体宽度 ≈ 玩家宽度参照
  const BODY_LEN = 1.0; // 前胸+后臀
  const CHEST_LEN = 0.55;
  const HIPS_LEN = 0.45;
  const BODY_H = 0.42;
  // 火焰尾：体量约身体 1/2，5 节链式串联
  const TAIL_TOTAL = BODY_LEN * 0.55; // 约半个身长，修长火苗感
  const LEG_H = 0.3;
  const LEG_T = 0.075;

  const root = new THREE.Group();
  root.name = "fox-walk-root";

  // 躯干离地：腿高 + 半身，脚底落在 y≈0
  const bodyY = LEG_H + BODY_H * 0.5;
  const legLocalY = -BODY_H * 0.5 - LEG_H * 0.5 + 0.02;

  // ---- 后臀（扭动主体，尾巴+后腿挂在这里）----
  const hips = new THREE.Group();
  hips.name = "fox-hips";
  hips.position.set(-HIPS_LEN * 0.35, bodyY, 0);
  root.add(hips);

  const hipsMesh = part(
    new THREE.BoxGeometry(HIPS_LEN, BODY_H * 0.95, BODY_W * 0.98),
    orange
  );
  hipsMesh.name = "fox-hips-mesh";
  hips.add(hipsMesh);

  // 后臀乳白小腹
  const hipsBelly = part(
    new THREE.BoxGeometry(HIPS_LEN * 0.55, BODY_H * 0.35, BODY_W * 0.55),
    cream,
    0.022
  );
  hipsBelly.position.set(0.05, -BODY_H * 0.22, 0);
  hips.add(hipsBelly);

  // ---- 前胸（紧挨后臀前方，前腿挂在这里）----
  const chest = new THREE.Group();
  chest.name = "fox-chest";
  chest.position.set(CHEST_LEN * 0.4, bodyY, 0);
  root.add(chest);

  const chestMesh = part(
    new THREE.BoxGeometry(CHEST_LEN, BODY_H, BODY_W),
    orange
  );
  chestMesh.name = "fox-chest-mesh";
  chest.add(chestMesh);

  const chestCream = part(
    new THREE.BoxGeometry(CHEST_LEN * 0.5, BODY_H * 0.38, BODY_W * 0.58),
    cream,
    0.022
  );
  chestCream.position.set(0.08, -BODY_H * 0.2, 0);
  chest.add(chestCream);

  // ---- 头（挂前胸）----
  const headG = new THREE.Group();
  headG.name = "fox-walk-head";
  headG.position.set(CHEST_LEN * 0.42, BODY_H * 0.28, 0);
  chest.add(headG);

  const head = part(new THREE.IcosahedronGeometry(0.26, 0), orange);
  head.name = "fox-walk-head-shell";
  head.scale.set(1.35, 0.95, 0.95);
  headG.add(head);

  const muzzle = part(new THREE.BoxGeometry(0.26, 0.15, 0.3), cream, 0.022);
  muzzle.position.set(0.2, -0.05, 0);
  headG.add(muzzle);

  const nose = part(new THREE.BoxGeometry(0.065, 0.05, 0.065), ink, 0.016);
  nose.position.set(0.34, -0.02, 0);
  headG.add(nose);

  // 眯眯眼：焦黑扁条折线（每侧两小块）
  const lids = [];
  for (const side of [-1, 1]) {
    const eyeG = new THREE.Group();
    eyeG.name = side < 0 ? "fox-squint-L" : "fox-squint-R";
    eyeG.position.set(0.16, 0.05, side * 0.12);
    // 主条
    const a = part(new THREE.BoxGeometry(0.1, 0.022, 0.032), ink, 0.012);
    a.rotation.z = side * 0.22; // 外高内低 → 弯弯笑眼
    eyeG.add(a);
    // 折线第二段
    const b = part(new THREE.BoxGeometry(0.06, 0.02, 0.028), ink, 0.01);
    b.position.set(0.055, -0.012, 0);
    b.rotation.z = side * -0.35;
    eyeG.add(b);
    headG.add(eyeG);
    lids.push(a, b);
  }

  // 白色倒三角眉毛（扁平锥 / 扁盒拼三角感）
  for (const side of [-1, 1]) {
    const brow = part(new THREE.ConeGeometry(0.055, 0.07, 3), cream, 0.012);
    brow.name = side < 0 ? "fox-brow-tri-L" : "fox-brow-tri-R";
    // 倒三角：尖朝下
    brow.rotation.z = Math.PI;
    brow.position.set(0.1, 0.16, side * 0.11);
    brow.scale.set(1.1, 0.85, 0.35); // 极扁贴脸
    headG.add(brow);
  }

  // 耳朵
  for (const side of [-1, 1]) {
    const earG = new THREE.Group();
    earG.position.set(-0.02, 0.2, side * 0.15);
    earG.rotation.order = "YXZ";
    earG.rotation.x = -0.2;
    earG.rotation.z = side * -0.5;
    earG.rotation.y = side * 0.15;
    earG.userData.baseRot = {
      x: earG.rotation.x,
      y: earG.rotation.y,
      z: earG.rotation.z,
    };
    const earOuter = part(new THREE.ConeGeometry(0.12, 0.32, 4), orange, 0.024);
    earOuter.position.y = 0.14;
    earG.add(earOuter);
    const earTip = part(new THREE.ConeGeometry(0.06, 0.1, 3), ink, 0.014);
    earTip.position.y = 0.28;
    earG.add(earTip);
    const earIn = part(new THREE.ConeGeometry(0.07, 0.18, 3), cream, 0.012);
    earIn.position.set(0.02, 0.1, 0);
    earIn.scale.set(0.65, 0.85, 0.5);
    earG.add(earIn);
    headG.add(earG);
    earG.userData.isEar = true;
  }

  // ---- 火炬火焰尾：5 节 Cone 链式嵌套 hips → j1 → j2 → j3 → j4 → j5(乳白) ----
  // 局部 +Y 为尾向；整链转到身后 -X，像一簇向上蹿、向后飘的火苗
  const tailRoot = new THREE.Group();
  tailRoot.name = "fox-flame-tail-root";
  tailRoot.position.set(-HIPS_LEN * 0.48, BODY_H * 0.05, 0);
  tailRoot.rotation.order = "ZYX";
  tailRoot.rotation.z = Math.PI / 2; // +Y → -X（身后）
  tailRoot.rotation.x = THREE.MathUtils.degToRad(18); // 火苗上抬
  hips.add(tailRoot);

  /** 火焰剖面：根细 → 中段鼓 → 尖细长 */
  function flameRadiusAt(s) {
    const peak = 1.0;
    const rootR = 0.62;
    const tip = 0.1;
    if (s < 0.3) {
      const k = s / 0.3;
      return rootR + (peak - rootR) * (1 - (1 - k) * (1 - k));
    }
    const k = (s - 0.3) / 0.7;
    return peak + (tip - peak) * (k * k);
  }

  // 5 节：后段更修长，总长 ≈ 半个身长
  const SEG_W = [0.16, 0.18, 0.2, 0.22, 0.24];
  const SEG_N = 5;
  /** @type {THREE.Group[]} */
  const tailJoints = [];
  /** @type {THREE.Mesh[]} */
  const tailMeshes = [];
  /** 每节实际高度，供下一节挂点 */
  const segH = SEG_W.map((w) => TAIL_TOTAL * w);

  let parent = tailRoot;
  let s0 = 0;
  for (let i = 0; i < SEG_N; i++) {
    const s1 = s0 + SEG_W[i];
    const sMid = (s0 + s1) * 0.5;
    const h = segH[i];
    const r = Math.max(0.035, flameRadiusAt(sMid) * BODY_W * 0.42);
    const isTip = i === SEG_N - 1;
    const mat = isTip ? cream : orange;

    const joint = new THREE.Group();
    joint.name = `fox-tail-j${i + 1}`;
    // 挂在上一节末端（沿局部 +Y）
    joint.position.set(0, i === 0 ? 0 : segH[i - 1] * 0.95, 0);
    parent.add(joint);

    const geo = new THREE.ConeGeometry(r, h, 5);
    geo.translate(0, h * 0.5, 0);
    const mesh = part(geo, mat, isTip ? 0.02 : OUT);
    mesh.name = isTip ? "fox-tail-flame-tip" : `fox-tail-flame-${i + 1}`;
    // 火焰截面：略扁，但保留体积（勿压成纸片棉花糖）
    if (i === 0) mesh.scale.set(0.85, 1, 0.72);
    else if (isTip) mesh.scale.set(0.55, 1.2, 0.42);
    else mesh.scale.set(0.72, 1, 0.58);
    joint.add(mesh);

    // 静止预弯：轻微 S，像火苗定格
    joint.userData.baseRot = {
      x: THREE.MathUtils.degToRad([6, 3, 0, -3, -5][i]),
      y: 0,
      z: THREE.MathUtils.degToRad([4, -3, 3, -2, 1][i]),
    };
    joint.userData.segLen = h;
    joint.rotation.x = joint.userData.baseRot.x;
    joint.rotation.z = joint.userData.baseRot.z;

    tailJoints.push(joint);
    tailMeshes.push(mesh);
    parent = joint;
    s0 = s1;
  }

  // ---- 四条小短腿：前→chest，后→hips（扭臀时后腿一起甩）----
  const legGeo = new THREE.BoxGeometry(LEG_T, LEG_H, LEG_T);
  const legDefs = [
    { x: 0.12, z: 0.18, front: true },
    { x: 0.12, z: -0.18, front: true },
    { x: -0.08, z: 0.2, front: false },
    { x: -0.08, z: -0.2, front: false },
  ];
  const legMeshes = [];
  for (let i = 0; i < 4; i++) {
    const d = legDefs[i];
    const leg = part(legGeo, orange);
    leg.name = `fox-walk-leg-${i}`;
    leg.position.set(d.x, legLocalY, d.z);
    leg.userData.baseY = legLocalY;
    if (d.front) chest.add(leg);
    else hips.add(leg);
    legMeshes.push(leg);
  }
  // 兼容旧代码：legs 指向数组容器感
  const legsG = { children: legMeshes, visible: true };

  // 贴地：整体最低点 → 0
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box.min.y)) {
    root.position.y -= box.min.y;
  }

  return {
    root,
    hips,
    chest,
    head: headG,
    /** 火焰尾根（hips 子节点，含链式 5 节） */
    tail: tailRoot,
    /** @type {THREE.Group[]} 链式关节 j1…j5，动画相位延迟用 */
    tailJoints,
    tailMeshes,
    legs: legsG,
    legMeshes,
    lids,
    dims: { BODY_W, BODY_LEN, BODY_H, TAIL_TOTAL, LEG_H },
  };
}

// ---------------------------------------------------------------------------
//  完整阿狸：睡姿 + 行走形态切换
// ---------------------------------------------------------------------------

/**
 * @param {{ scale?: number }} [opts]
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

  // ========== 睡姿层（默认可见）==========
  const sleepG = new THREE.Group();
  sleepG.name = "fox-sleep-layer";
  rig.add(sleepG);

  const body = part(new THREE.BoxGeometry(1.15, 0.38, 0.68), orange);
  body.name = "fox-sleep-body";
  body.position.set(0.05, 0.19, 0.02);
  body.rotation.z = -0.08;
  body.rotation.x = 0.04;
  sleepG.add(body);

  const belly = part(new THREE.BoxGeometry(0.55, 0.16, 0.42), cream, 0.022);
  belly.position.set(0.22, 0.1, 0.04);
  sleepG.add(belly);

  // 睡姿环抱尾（保留简洁蓬松感）
  const sleepTail = new THREE.Group();
  const st0 = part(new THREE.IcosahedronGeometry(0.32, 1), orange, 0.026);
  st0.position.set(-0.38, 0.26, 0.32);
  st0.scale.set(1.2, 0.9, 1.1);
  sleepTail.add(st0);
  const st1 = part(new THREE.IcosahedronGeometry(0.24, 1), cream, 0.022);
  st1.position.set(-0.12, 0.22, 0.55);
  sleepTail.add(st1);
  sleepG.add(sleepTail);

  const headG = new THREE.Group();
  headG.position.set(0.62, 0.28, 0.06);
  headG.rotation.set(0.35, 0.15, -0.12);
  const head = part(new THREE.IcosahedronGeometry(0.28, 0), orange);
  head.scale.set(1.35, 0.95, 0.95);
  headG.add(head);
  const muzzle = part(new THREE.BoxGeometry(0.28, 0.16, 0.32), cream, 0.022);
  muzzle.position.set(0.22, -0.06, 0);
  headG.add(muzzle);
  const nose = part(new THREE.BoxGeometry(0.07, 0.055, 0.07), ink, 0.016);
  nose.position.set(0.38, -0.02, 0);
  headG.add(nose);

  // 睡姿也带眯眯眼 + 白眉（二次元辨识）
  for (const side of [-1, 1]) {
    const eyeG = new THREE.Group();
    eyeG.position.set(0.18, 0.06, side * 0.11);
    const a = part(new THREE.BoxGeometry(0.09, 0.02, 0.03), ink, 0.01);
    a.rotation.z = side * 0.2;
    eyeG.add(a);
    const b = part(new THREE.BoxGeometry(0.055, 0.018, 0.026), ink, 0.01);
    b.position.set(0.05, -0.01, 0);
    b.rotation.z = side * -0.32;
    eyeG.add(b);
    headG.add(eyeG);
  }
  for (const side of [-1, 1]) {
    const brow = part(new THREE.ConeGeometry(0.05, 0.065, 3), cream, 0.012);
    brow.rotation.z = Math.PI;
    brow.position.set(0.1, 0.15, side * 0.11);
    brow.scale.set(1.1, 0.85, 0.35);
    headG.add(brow);
  }

  for (const side of [-1, 1]) {
    const earG = new THREE.Group();
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
    const earOuter = part(new THREE.ConeGeometry(0.14, 0.36, 4), orange, 0.026);
    earOuter.position.y = 0.16;
    earG.add(earOuter);
    const earTip = part(new THREE.ConeGeometry(0.07, 0.12, 3), ink, 0.016);
    earTip.position.y = 0.32;
    earG.add(earTip);
    headG.add(earG);
  }
  sleepG.add(headG);

  for (const side of [-1, 1]) {
    const paw = part(new THREE.BoxGeometry(0.14, 0.08, 0.12), ink, 0.016);
    paw.position.set(0.48, 0.04, side * 0.14);
    sleepG.add(paw);
  }
  for (const side of [-1, 1]) {
    const hind = part(new THREE.BoxGeometry(0.12, 0.07, 0.1), orange, 0.014);
    hind.position.set(-0.28, 0.04, side * 0.22);
    sleepG.add(hind);
  }

  // ========== 行走层（createWalkingFox）==========
  const walk = createWalkingFox({ orange, cream, ink });
  walk.root.visible = false;
  rig.add(walk.root);

  // 光圈
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

  // 缩放
  const worldScale = opts.scale ?? 0.52;
  rig.scale.setScalar(worldScale);

  // 睡姿贴地
  sleepG.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(sleepG);
  if (Number.isFinite(box.min.y) && Math.abs(box.min.y) > 1e-4) {
    sleepG.position.y -= box.min.y;
  }

  const base = {
    bodyY: body.position.y,
    bodyRotX: body.rotation.x,
    headRot: { x: headG.rotation.x, y: headG.rotation.y, z: headG.rotation.z },
    hipsY: 0,
  };

  /** @type {FoxState} */
  let foxState = "SLEEPING";

  function standUp() {
    sleepG.visible = false;
    walk.root.visible = true;
    glowRing.visible = false;
    // 行走层贴地（相对 rig）
    walk.root.position.y = 0;
    walk.hips.rotation.y = 0;
    walk.chest.rotation.y = 0;
    g.userData.sleeping = false;
    g.userData.following = true;
  }

  function lieDown() {
    sleepG.visible = true;
    walk.root.visible = false;
    glowRing.visible = true;
    walk.hips.rotation.y = 0;
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

  function getState() {
    return foxState;
  }

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
    sleepG,
    body,
    belly,
    head: headG,
    // 行走形态
    walkRoot: walk.root,
    hips: walk.hips,
    chest: walk.chest,
    walkHead: walk.head,
    tail: walk.tail,
    tailJoints: walk.tailJoints,
    tailMeshes: walk.tailMeshes,
    legs: walk.legs,
    legMeshes: walk.legMeshes,
    lids: walk.lids,
    glowRing,
    base,
  };

  return g;
}

// ---------------------------------------------------------------------------
//  球面尾随 + 双轴朝向
// ---------------------------------------------------------------------------

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qCur = new THREE.Quaternion();
const _flatTmp = { x: 0, z: 0 };

export const FOX_FOLLOW_GAP = 2.2; // 地面跟随时距（平面单位）
export const FOX_FOLLOW_LERP = 0.12; // 地面插值（贴地走更跟手）
/** 脚底相对地面高度场的额外抬升（避免陷草） */
export const FOX_FOOT_LIFT = 0.03;
export const FOX_TURN_SLERP = 0.16;

/**
 * 在「地面」上尾随玩家：平面坐标插值 + groundLiftAt 贴地 + 双轴朝向。
 * （不再用固定球半径 normalize，避免悬空/穿地）
 *
 * @param {THREE.Object3D} fox
 * @param {THREE.Vector3} playerPos
 * @param {number} planetRadius
 * @param {{ gap?: number, lerp?: number, footLift?: number, turn?: number }} [opts]
 * @returns {boolean} 本帧是否在走
 */
export function updateFoxFollow(fox, playerPos, planetRadius, opts = {}) {
  if (!fox || !playerPos) return false;
  const state = fox.getState?.() ?? fox.userData?.foxState;
  if (state !== "FOLLOWING") return false;

  const gap = opts.gap ?? FOX_FOLLOW_GAP;
  const lerpK = opts.lerp ?? FOX_FOLLOW_LERP;
  const footLift = opts.footLift ?? FOX_FOOT_LIFT;
  const turnK = opts.turn ?? FOX_TURN_SLERP;

  _prev.copy(fox.position);

  // ---- 平面坐标：与岛面高度场同一套 (x,z) ----
  let flatFox = worldToFlatXZ(fox.position, planetRadius);
  let flatPl = worldToFlatXZ(playerPos, planetRadius);

  // 岛外 / 半球守卫失败时用简易经纬反推
  if (!flatFox) flatFox = approxFlatFromWorld(fox.position, planetRadius);
  if (!flatPl) flatPl = approxFlatFromWorld(playerPos, planetRadius);

  let fx = flatFox.x;
  let fz = flatFox.z;
  let moving = false;

  const dx = flatPl.x - fx;
  const dz = flatPl.z - fz;
  const dist = Math.hypot(dx, dz);

  if (dist > gap) {
    // 目标：落在玩家身后约 gap 处，再向该点 lerp（地面走，非空中飞）
    const ux = dx / dist;
    const uz = dz / dist;
    const tx = flatPl.x - ux * gap * 0.9;
    const tz = flatPl.z - uz * gap * 0.9;
    // 距离越远追得越快一点，仍保持平滑
    const k = Math.min(1, lerpK * (1 + (dist - gap) * 0.08));
    fx += (tx - fx) * k;
    fz += (tz - fz) * k;
    moving = dist > gap + 0.12;
  }

  // ---- 贴真实地面：R + groundLiftAt + 脚底微抬 ----
  const groundY = groundLiftAt(fx, fz) + footLift;
  placeObjectOnSphere(fox, fx, fz, groundY, planetRadius);

  // ---- 朝向：法线 = 球心外向；正脸 +X 沿地面切向朝移动/玩家 ----
  _up.copy(fox.position).normalize();
  _fwd.subVectors(fox.position, _prev);
  _fwd.addScaledVector(_up, -_fwd.dot(_up));
  if (_fwd.lengthSq() < 1e-8) {
    // 静止时看向玩家的地面投影
    _fwd.set(dx, 0, dz); // 平面差不够，用世界切向
    // 从 flat 差重建切向：近似用位置差投影
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
  // placeObjectOnSphere 已写过一次朝向；用 slerp 平滑转向
  _qCur.copy(fox.quaternion);
  // 若 place 刚重置，从当前 slerp 到目标
  _qCur.slerp(_q, turnK);
  fox.quaternion.copy(_qCur);

  fox.userData.flatX = fx;
  fox.userData.flatZ = fz;
  if (fox.userData?.collider?.position) {
    fox.userData.collider.position.copy(fox.position);
  }
  return moving;
}

/** worldToFlatXZ 失败时的简易反推（与 mapEditor 半球外逻辑同类） */
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
