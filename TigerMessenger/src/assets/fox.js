// =====================================================================
//  阿狸 · 插画风四足小狐狸（尖脸 V 眼 + 蓬松火焰尾）
//  - SLEEPING：蜷缩睡姿层
//  - FOLLOWING：createWalkingFox（前胸/后臀分段 · 四短腿 · 链式大尾）
//  - 贴地尾随：只写位置，朝向从上一帧 slerp（杜绝 placeObject 重置抖动）
//  - 猫步 / S 尾浪 / 独立头追视
//  约定：底部 y=0；+X 正脸；+Y 法线
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";
import { flatToWorld, quatYToDir } from "../world/sphereMath.js";
import { groundLiftAt, worldToFlatXZ } from "../world/hills.js";

export const FOX_ORANGE = 0xe96a36;
const FOX_CREAM = 0xf4f7ed;
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

// ---------------------------------------------------------------------------
//  createWalkingFox · 尖脸插画风行走形态（非圆球大头）
// ---------------------------------------------------------------------------

/**
 * 行走/尾随 rig（未缩放）。
 * 体长约 1.0，头为扁 icosahedron + 乳白吻部（V 字眯眯眼），身后链式火焰尾。
 *
 * @param {{ orange: THREE.Material, cream: THREE.Material, ink: THREE.Material }} mats
 */
export function createWalkingFox(mats) {
  const { orange, cream, ink } = mats;

  const BODY_W = 0.62;
  const BODY_LEN = 1.0;
  const CHEST_LEN = 0.55;
  const HIPS_LEN = 0.45;
  const BODY_H = 0.42;
  // 蓬松大尾：约 0.95 身长（视觉焦点）
  const TAIL_TOTAL = BODY_LEN * 0.95;
  const LEG_H = 0.3;
  const LEG_T = 0.078;

  const root = new THREE.Group();
  root.name = "fox-walk-root";

  const bodyY = LEG_H + BODY_H * 0.5;
  const legLocalY = -BODY_H * 0.5 - LEG_H * 0.5 + 0.02;

  // ---- 躯干：胸 / 腰 / 臀 三段圆球团圆衔接（非方盒）----
  // 后臀
  const hips = new THREE.Group();
  hips.name = "fox-hips";
  hips.position.set(-HIPS_LEN * 0.28, bodyY, 0);
  hips.userData.baseY = bodyY;
  root.add(hips);

  const hipsMesh = part(new THREE.SphereGeometry(0.28, 8, 6), orange);
  hipsMesh.name = "fox-hips-mesh";
  // 圆润臀：略扁高、左右鼓
  hipsMesh.scale.set(1.05, 0.95, 1.15);
  hips.add(hipsMesh);

  for (const side of [-1, 1]) {
    const cheek = part(new THREE.SphereGeometry(0.16, 6, 5), orange, 0.02);
    cheek.scale.set(0.9, 0.85, 1.05);
    cheek.position.set(-0.04, -0.02, side * 0.18);
    hips.add(cheek);
  }

  const hipsBelly = part(new THREE.SphereGeometry(0.14, 6, 5), cream, 0.018);
  hipsBelly.scale.set(1.15, 0.55, 0.9);
  hipsBelly.position.set(0.05, -0.12, 0);
  hips.add(hipsBelly);

  // 腰腹中段：承接胸与臀的团圆球（解决「两截方身」）
  const midG = new THREE.Group();
  midG.name = "fox-mid-torso";
  midG.position.set(0.02, bodyY - 0.01, 0);
  midG.userData.baseY = bodyY - 0.01;
  root.add(midG);

  const midMesh = part(new THREE.SphereGeometry(0.24, 8, 6), orange);
  midMesh.name = "fox-mid-mesh";
  midMesh.scale.set(1.35, 0.88, 1.05); // 前后拉长填缝
  midG.add(midMesh);

  const midBelly = part(new THREE.SphereGeometry(0.15, 6, 5), cream, 0.016);
  midBelly.scale.set(1.2, 0.5, 0.85);
  midBelly.position.set(0.02, -0.1, 0);
  midG.add(midBelly);

  // 前胸
  const chest = new THREE.Group();
  chest.name = "fox-chest";
  chest.position.set(CHEST_LEN * 0.36, bodyY + 0.01, 0);
  chest.userData.baseY = bodyY + 0.01;
  root.add(chest);

  const chestMesh = part(new THREE.SphereGeometry(0.26, 8, 6), orange);
  chestMesh.name = "fox-chest-mesh";
  chestMesh.scale.set(1.25, 1.0, 1.08);
  chest.add(chestMesh);

  // 肩侧小圆，更立体
  for (const side of [-1, 1]) {
    const shoulder = part(new THREE.SphereGeometry(0.12, 6, 5), orange, 0.016);
    shoulder.position.set(0.02, 0.04, side * 0.2);
    shoulder.scale.set(0.9, 0.85, 0.95);
    chest.add(shoulder);
  }

  const chestCream = part(new THREE.SphereGeometry(0.14, 6, 5), cream, 0.018);
  chestCream.scale.set(1.2, 0.55, 0.9);
  chestCream.position.set(0.08, -0.1, 0);
  chest.add(chestCream);

  // ---- 脖子：胸→头细过渡（必须有脖子，别方身直接安头）----
  const NECK_H = 0.14;
  const neckG = new THREE.Group();
  neckG.name = "fox-neck";
  // 从前胸上前方伸出
  neckG.position.set(CHEST_LEN * 0.38, BODY_H * 0.22, 0);
  neckG.rotation.z = -0.35; // 略前倾
  chest.add(neckG);

  // 粗→细两节圆台
  const neckBase = part(
    new THREE.CylinderGeometry(0.09, 0.13, NECK_H * 0.55, 6),
    orange,
    0.02
  );
  neckBase.name = "fox-neck-base";
  neckBase.position.y = NECK_H * 0.22;
  neckG.add(neckBase);

  const neckTop = part(
    new THREE.CylinderGeometry(0.07, 0.095, NECK_H * 0.55, 6),
    orange,
    0.018
  );
  neckTop.name = "fox-neck-top";
  neckTop.position.y = NECK_H * 0.72;
  neckG.add(neckTop);

  // 乳白喉毛小过渡
  const neckCream = part(new THREE.SphereGeometry(0.07, 5, 4), cream, 0.012);
  neckCream.scale.set(0.7, 0.9, 0.55);
  neckCream.position.set(0.04, NECK_H * 0.35, 0);
  neckG.add(neckCream);

  // ---- 头：挂在脖子顶端（尖脸 icosa + 吻）----
  const headG = new THREE.Group();
  headG.name = "fox-walk-head";
  headG.position.set(0.02, NECK_H + 0.08, 0);
  headG.rotation.order = "YXZ";
  headG.rotation.z = 0.28; // 抵消脖子前倾，脸仍朝前
  neckG.add(headG);

  const headMesh = part(new THREE.IcosahedronGeometry(0.26, 0), orange);
  headMesh.name = "fox-walk-head-shell";
  // 略扁略长，偏插画狐狸头，不是气球
  headMesh.scale.set(1.28, 0.92, 0.9);
  headG.add(headMesh);

  const muzzle = part(new THREE.BoxGeometry(0.28, 0.15, 0.3), cream, 0.022);
  muzzle.position.set(0.2, -0.05, 0);
  headG.add(muzzle);

  const nose = part(new THREE.BoxGeometry(0.065, 0.05, 0.065), ink, 0.016);
  nose.position.set(0.35, -0.02, 0);
  headG.add(nose);

  // V 字眯眯眼（折线两段）
  /** @type {THREE.Mesh[]} */
  const lids = [];
  /** @type {THREE.Group[]} */
  const eyeGroups = [];
  for (const side of [-1, 1]) {
    const eyeG = new THREE.Group();
    eyeG.name = side < 0 ? "fox-squint-L" : "fox-squint-R";
    eyeG.position.set(0.16, 0.05, side * 0.12);
    const a = part(new THREE.BoxGeometry(0.1, 0.022, 0.032), ink, 0.012);
    a.rotation.z = side * 0.22;
    eyeG.add(a);
    const b = part(new THREE.BoxGeometry(0.06, 0.02, 0.028), ink, 0.01);
    b.position.set(0.055, -0.012, 0);
    b.rotation.z = side * -0.35;
    eyeG.add(b);
    headG.add(eyeG);
    lids.push(a, b);
    eyeGroups.push(eyeG);
  }

  // 乳白倒三角眉
  for (const side of [-1, 1]) {
    const brow = part(new THREE.ConeGeometry(0.055, 0.07, 3), cream, 0.012);
    brow.rotation.z = Math.PI;
    brow.position.set(0.1, 0.16, side * 0.11);
    brow.scale.set(1.1, 0.85, 0.35);
    headG.add(brow);
  }

  // 粉腮
  for (const side of [-1, 1]) {
    const cheek = part(new THREE.SphereGeometry(0.05, 5, 4), toonMat(0xfadbd8), 0.008);
    cheek.scale.set(0.45, 0.7, 0.9);
    cheek.position.set(0.12, -0.06, side * 0.16);
    headG.add(cheek);
  }

  // 耳
  /** @type {THREE.Group[]} */
  const ears = [];
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
    ears.push(earG);
  }

  // ---- 毛笔形火焰尾（hips 后）----
  // 坐标约定（狐身）：+X 脸前，+Y 上，+Z 左
  // 尾链沿局部 +Y 竖起；后仰用 rotation.z（负=朝 -X 身后）
  // 左右晃必须用 rotation.x（± 才是真正的左右，不会变成单侧滚转）
  // 旧方案 z=π/2 后改 rotation.y 实际是绕尾轴滚，看起来像「只往右甩」
  const tailRoot = new THREE.Group();
  tailRoot.name = "fox-flame-tail-root";
  // 臀后上方，链向上竖
  tailRoot.position.set(-0.12, BODY_H * 0.18, 0);
  tailRoot.rotation.order = "ZYX";
  // 后仰 45°：链 +Y 竖直为 0，z=-45° 指向身后斜上（非 90° 直立）
  const TAIL_LEAN_BACK = THREE.MathUtils.degToRad(-45);
  tailRoot.rotation.z = TAIL_LEAN_BACK;
  tailRoot.rotation.x = 0; // 左右中立
  tailRoot.rotation.y = 0;
  tailRoot.userData.baseLeanZ = TAIL_LEAN_BACK;
  hips.add(tailRoot);

  /**
   * 毛笔半径倍率（s∈[0,1]：0=臀根，1=尾尖）
   * 根细(≈0.12) → 0.45 附近最鼓(1.0) → 尖细(≈0.08)
   */
  function brushRadiusMul(s) {
    const t = THREE.MathUtils.clamp(s, 0, 1);
    // smoothstep 两段：抬升到峰 + 收尖
    const peakAt = 0.42;
    if (t <= peakAt) {
      const k = t / peakAt;
      const ease = k * k * (3 - 2 * k); // smoothstep
      // 根 0.12 → 峰 1.0
      return 0.12 + (1.0 - 0.12) * ease;
    }
    const k = (t - peakAt) / (1 - peakAt);
    const ease = k * k; // 末端加速变细
    // 峰 1.0 → 尖 0.08
    return 1.0 + (0.08 - 1.0) * ease;
  }

  // 绝对半径 = mul * 身宽系数（峰约 0.22，根约 0.026）
  const TAIL_R_PEAK = BODY_W * 0.36;
  function brushRadius(s) {
    return Math.max(0.018, brushRadiusMul(s) * TAIL_R_PEAK);
  }

  // 8 节：根部更密的过渡，中后略拉长
  const SEG_W = [0.08, 0.1, 0.12, 0.14, 0.14, 0.14, 0.14, 0.14];
  const SEG_N = SEG_W.length;
  /** @type {THREE.Group[]} */
  const tailJoints = [];
  /** @type {THREE.Mesh[]} */
  const tailMeshes = [];
  const segH = SEG_W.map((w) => TAIL_TOTAL * w);

  // 中性预弯：仅微后曲，左右基准全 0
  const baseBendX = [0, 0, 0, 0, 0, 0, 0, 0];
  const baseBendZ = [2, 1, 1, 0, -1, -1, -2, -2]; // 沿尾长微弧（前后），非左右

  let parent = tailRoot;
  let s0 = 0;
  for (let i = 0; i < SEG_N; i++) {
    const s1 = s0 + SEG_W[i];
    const h = segH[i];
    const rBottom = brushRadius(s0);
    const rTop = brushRadius(s1);
    const useCream = i >= SEG_N - 2;
    const segMat = useCream ? cream : orange;

    const joint = new THREE.Group();
    joint.name =
      i === 0
        ? "TailBase"
        : i === Math.floor(SEG_N * 0.4)
          ? "TailMid"
          : i === SEG_N - 1
            ? "TailTip"
            : `fox-tail-j${i + 1}`;
    joint.position.set(0, i === 0 ? 0 : segH[i - 1] * 0.98, 0);
    parent.add(joint);

    const geo = new THREE.CylinderGeometry(rTop, rBottom, h, 6, 1);
    geo.translate(0, h * 0.5, 0);
    const mesh = part(geo, segMat, i === SEG_N - 1 ? 0.018 : OUT * 0.85);
    mesh.name = i === SEG_N - 1 ? "fox-tail-flame-tip" : `fox-tail-flame-${i + 1}`;
    const flat = THREE.MathUtils.lerp(0.9, 0.65, i / (SEG_N - 1));
    mesh.scale.set(flat, 1, flat * 0.9);
    joint.add(mesh);

    joint.userData.baseRot = {
      x: THREE.MathUtils.degToRad(baseBendX[i] ?? 0),
      y: 0,
      z: THREE.MathUtils.degToRad(baseBendZ[i] ?? 0),
    };
    joint.rotation.x = 0;
    joint.rotation.y = 0;
    joint.rotation.z = joint.userData.baseRot.z;
    joint.userData.segIndex = i;

    tailJoints.push(joint);
    tailMeshes.push(mesh);
    parent = joint;
    s0 = s1;
  }

  // 动画驱动骨：根 / 中鼓 / 尖
  const tailBase = tailJoints[0];
  const tailMid = tailJoints[Math.floor(SEG_N * 0.4)] || tailJoints[3];
  const tailTip = tailJoints[SEG_N - 1];

  // ---- 四短腿：前 chest / 后 hips ----
  const legGeo = new THREE.BoxGeometry(LEG_T, LEG_H, LEG_T);
  const legDefs = [
    { x: 0.12, z: 0.18, front: true },
    { x: 0.12, z: -0.18, front: true },
    { x: -0.08, z: 0.2, front: false },
    { x: -0.08, z: -0.2, front: false },
  ];
  /** @type {THREE.Mesh[]} */
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

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box.min.y)) root.position.y -= box.min.y;

  return {
    root,
    hips,
    mid: midG,
    chest,
    neck: neckG,
    head: headG,
    headMesh,
    tail: tailRoot,
    tailJoints,
    tailMeshes,
    tailBase,
    tailMid,
    tailTip,
    legs: { children: legMeshes, visible: true },
    legMeshes,
    lids,
    eyeGroups,
    ears,
    dims: { BODY_W, BODY_LEN, BODY_H, TAIL_TOTAL, LEG_H, bodyY, NECK_H },
  };
}

// 兼容旧名：不再导出圆球大头版
export function createClassicAliFox() {
  const orange = toonMat(FOX_ORANGE);
  const cream = toonMat(FOX_CREAM);
  const ink = toonMat(FOX_INK);
  const walk = createWalkingFox({ orange, cream, ink });
  walk.root.userData = {
    ...walk.root.userData,
    classic: false,
    elegant: true,
    torso: walk.hips,
    body: walk.chest,
    head: walk.head,
    legs: walk.legMeshes,
    tailRoot: walk.tail,
    tailJoints: walk.tailJoints,
    tailBase: walk.tailBase,
    tailMid: walk.tailMid,
    tailTip: walk.tailTip,
  };
  return walk.root;
}

// ---------------------------------------------------------------------------
//  createLowPolyFox · 睡 / 走双层
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

  // ========== 睡姿层 ==========
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
  head.scale.set(1.28, 0.92, 0.9);
  headG.add(head);
  const muzzle = part(new THREE.BoxGeometry(0.28, 0.16, 0.32), cream, 0.022);
  muzzle.position.set(0.22, -0.06, 0);
  headG.add(muzzle);
  const nose = part(new THREE.BoxGeometry(0.07, 0.055, 0.07), ink, 0.016);
  nose.position.set(0.38, -0.02, 0);
  headG.add(nose);

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

  // ========== 行走层 ==========
  const walk = createWalkingFox({ orange, cream, ink });
  walk.root.visible = false;
  rig.add(walk.root);

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

  // 尖脸行走体量：默认 0.52（与送信人协调）；勿用大头版的 0.28
  const worldScale = opts.scale ?? 0.52;
  rig.scale.setScalar(worldScale);

  sleepG.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(sleepG);
  if (Number.isFinite(box.min.y) && Math.abs(box.min.y) > 1e-4) {
    sleepG.position.y -= box.min.y;
  }

  const base = {
    bodyY: body.position.y,
    bodyRotX: body.rotation.x,
    headRot: { x: headG.rotation.x, y: headG.rotation.y, z: headG.rotation.z },
    hipsY: walk.hips.position.y,
    midY: walk.mid?.position.y ?? 0,
    chestY: walk.chest.position.y,
  };

  /** @type {FoxState} */
  let foxState = "SLEEPING";

  g.userData.anim = {
    movingSmooth: 0,
    headYaw: 0,
    headPitch: 0,
    leanZ: 0,
    prevMoveX: 0,
    prevMoveZ: 0,
    hasPrevMove: false,
    _lastTime: 0,
    isMoving: false,
  };

  function standUp() {
    sleepG.visible = false;
    walk.root.visible = true;
    glowRing.visible = false;
    walk.root.position.y = 0;
    walk.hips.rotation.set(0, 0, 0);
    walk.chest.rotation.set(0, 0, 0);
    walk.hips.position.y = base.hipsY;
    walk.chest.position.y = base.chestY;
    g.userData.sleeping = false;
    g.userData.following = true;
  }

  function lieDown() {
    sleepG.visible = true;
    walk.root.visible = false;
    glowRing.visible = true;
    walk.hips.rotation.set(0, 0, 0);
    walk.chest.rotation.set(0, 0, 0);
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

  g.switchState = switchState;
  g.standUp = standUp;
  g.lieDown = lieDown;
  g.getState = () => foxState;

  g.userData.kind = "fox";
  g.userData.displayName = "阿狸";
  g.userData.collideRadius = 0.4;
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
    walkRoot: walk.root,
    hips: walk.hips,
    mid: walk.mid,
    chest: walk.chest,
    neck: walk.neck,
    walkHead: walk.head,
    headMesh: walk.headMesh,
    tail: walk.tail,
    tailJoints: walk.tailJoints,
    tailMeshes: walk.tailMeshes,
    tailBase: walk.tailBase,
    tailMid: walk.tailMid,
    tailTip: walk.tailTip,
    legs: walk.legs,
    legMeshes: walk.legMeshes,
    lids: walk.lids,
    eyeGroups: walk.eyeGroups,
    ears: walk.ears,
    glowRing,
    base,
  };

  return g;
}

// ---------------------------------------------------------------------------
//  贴地跟随（无朝向重置抖动）
// ---------------------------------------------------------------------------

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qCur = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _headWorld = new THREE.Vector3();
const _lookWorld = new THREE.Vector3();
const _lookLocal = new THREE.Vector3();
const _axisY = new THREE.Vector3();
const _parentInv = new THREE.Matrix4();
const _flatTmp = { x: 0, z: 0 };

export const FOX_FOLLOW_GAP = 2.2;
export const FOX_FOLLOW_LERP = 0.12;
export const FOX_FOOT_LIFT = 0.03;
export const FOX_TURN_SLERP = 0.14;
export const FOX_HOP_AMP = 0.0; // 世界位置不再颠簸（防抖）
export const FOX_GAIT_HZ = 10;
export const FOX_HEAD_CLAMP = Math.PI / 5; // ~36°，更安全

/**
 * 只写球面位置，不重置四元数（避免每帧 snap→slerp 抖动）
 */
function placeFoxPositionOnly(fox, fx, fz, height, planetRadius) {
  flatToWorld(fx, height, fz, planetRadius, _pos);
  fox.position.copy(_pos);
}

/**
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
  const time = opts.time ?? performance.now() * 0.001;

  const anim = fox.userData.anim || (fox.userData.anim = {});
  const lastT = anim._lastTime ?? time;
  let dt = opts.dt ?? time - lastT;
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) dt = 1 / 60;
  anim._lastTime = time;

  _prev.copy(fox.position);

  let flatFox = worldToFlatXZ(fox.position, planetRadius);
  let flatPl = worldToFlatXZ(playerPos, planetRadius);
  if (!flatFox) flatFox = approxFlatFromWorld(fox.position, planetRadius);
  if (!flatPl) flatPl = approxFlatFromWorld(playerPos, planetRadius);

  let fx = flatFox.x;
  let fz = flatFox.z;

  const dx = flatPl.x - fx;
  const dz = flatPl.z - fz;
  const dist = Math.hypot(dx, dz);

  // 滞回：避免 gap 边界来回抖动
  const wasMoving = !!anim.isMoving;
  let moving = wasMoving;
  if (!wasMoving && dist > gap + 0.2) moving = true;
  else if (wasMoving && dist < gap + 0.05) moving = false;
  else if (!wasMoving) moving = false;
  else moving = dist > gap;

  let moveX = 0;
  let moveZ = 0;
  if (moving && dist > 1e-5) {
    const ux = dx / dist;
    const uz = dz / dist;
    const tx = flatPl.x - ux * gap * 0.9;
    const tz = flatPl.z - uz * gap * 0.9;
    const k = Math.min(1, lerpK * (1 + Math.max(0, dist - gap) * 0.08));
    const nfx = fx + (tx - fx) * k;
    const nfz = fz + (tz - fz) * k;
    moveX = nfx - fx;
    moveZ = nfz - fz;
    fx = nfx;
    fz = nfz;
  }
  anim.isMoving = moving;

  // 平滑移动量（驱动步态混合，避免腿瞬间开合）
  anim.movingSmooth = THREE.MathUtils.damp(anim.movingSmooth || 0, moving ? 1 : 0, 8, dt);

  // ---- 位置：贴地；不重置朝向 ----
  const groundY = groundLiftAt(fx, fz) + footLift;
  placeFoxPositionOnly(fox, fx, fz, groundY, planetRadius);

  // ---- 朝向：从「当前」slerp 到目标（禁止 placeObject 先 snap）----
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
  if (_right.lengthSq() < 1e-8) {
    // 退化：只保法线
    quatYToDir(_up, _q);
  } else {
    _fwd.crossVectors(_up, _right).normalize();
    _m.makeBasis(_fwd, _up, _right);
    _q.setFromRotationMatrix(_m);
  }
  // 移动时跟转向；静止时更慢，减少抖
  const tk = moving ? turnK : turnK * 0.4;
  _qCur.copy(fox.quaternion).slerp(_q, tk);
  fox.quaternion.copy(_qCur);

  // 转弯倾侧（小幅）
  let turnRate = 0;
  if (moving && anim.hasPrevMove) {
    const plen = Math.hypot(anim.prevMoveX, anim.prevMoveZ) || 1e-6;
    const clen = Math.hypot(moveX, moveZ) || 1e-6;
    const cross =
      (anim.prevMoveX / plen) * (moveZ / clen) - (anim.prevMoveZ / plen) * (moveX / clen);
    turnRate = THREE.MathUtils.clamp(cross * 3.5, -1, 1);
  }
  if (moving && (Math.abs(moveX) > 1e-6 || Math.abs(moveZ) > 1e-6)) {
    anim.prevMoveX = moveX;
    anim.prevMoveZ = moveZ;
    anim.hasPrevMove = true;
  }
  anim.leanZ = THREE.MathUtils.damp(anim.leanZ || 0, moving ? turnRate * 0.1 : 0, 6, dt);

  // ---- 局部动画（腿/尾/头）----
  animateFoxCompanion(fox, {
    time,
    dt,
    moving,
    moveAmount: anim.movingSmooth || 0,
    playerPos,
    leanZ: anim.leanZ || 0,
  });

  fox.userData.flatX = fx;
  fox.userData.flatZ = fz;
  if (fox.userData?.collider?.position) {
    fox.userData.collider.position.copy(fox.position);
  }
  return moving;
}

// ---------------------------------------------------------------------------
//  局部骨骼动画
// ---------------------------------------------------------------------------

/**
 * @param {THREE.Object3D} fox
 * @param {{ time: number, dt?: number, moving?: boolean, moveAmount?: number, playerPos?: THREE.Vector3|null, leanZ?: number }} opts
 */
export function animateFoxCompanion(fox, opts = {}) {
  const p = fox.userData?.parts;
  if (!p) return;

  const time = opts.time ?? performance.now() * 0.001;
  const dt = opts.dt ?? 1 / 60;
  const moveAmt = opts.moveAmount ?? (opts.moving ? 1 : 0);
  const playerPos = opts.playerPos ?? null;
  const leanZ = opts.leanZ ?? 0;
  const anim = fox.userData.anim || (fox.userData.anim = {});
  const following = (fox.getState?.() ?? fox.userData?.foxState) === "FOLLOWING";

  // 睡姿呼吸
  if (!following || p.sleepG?.visible) {
    if (p.body && p.base) {
      p.body.position.y = (p.base.bodyY || 0.19) + Math.sin(time * 1.6) * 0.012;
    }
    return;
  }

  if (!p.hips || !p.chest || !p.legMeshes) return;

  const gait = time * FOX_GAIT_HZ;
  const baseHipsY = p.base?.hipsY ?? p.hips.userData.baseY ?? p.hips.position.y;
  const baseChestY = p.base?.chestY ?? p.chest.userData.baseY ?? p.chest.position.y;

  // ---- 扭臀猫步（局部）----
  // 臀/胸 yaw 减小，避免把竖尾带成「总偏一侧」
  p.hips.rotation.y = Math.sin(gait) * 0.08 * moveAmt + Math.sin(time * 2.1) * 0.02 * (1 - moveAmt);
  p.chest.rotation.y = Math.sin(gait + Math.PI) * 0.04 * moveAmt;
  p.hips.rotation.z = leanZ * 0.6;
  p.chest.rotation.z = leanZ * 0.35;
  p.hips.position.y = baseHipsY + Math.sin(gait * 2) * 0.012 * moveAmt;
  p.chest.position.y = baseChestY + Math.sin(gait * 2 + 0.4) * 0.009 * moveAmt;
  if (p.mid) {
    const baseMidY = p.base?.midY ?? p.mid.userData?.baseY ?? p.mid.position.y;
    p.mid.position.y = baseMidY + Math.sin(gait * 2 + 0.2) * 0.008 * moveAmt;
    p.mid.rotation.y = Math.sin(gait + 0.5) * 0.05 * moveAmt;
  }

  // ---- 四腿对角 ----
  const legs = p.legMeshes;
  const legAmp = 0.38 * moveAmt;
  if (legs[0]) legs[0].rotation.x = Math.sin(gait) * legAmp;
  if (legs[3]) legs[3].rotation.x = Math.sin(gait) * legAmp;
  if (legs[1]) legs[1].rotation.x = Math.sin(gait + Math.PI) * legAmp;
  if (legs[2]) legs[2].rotation.x = Math.sin(gait + Math.PI) * legAmp;

  // ---- 尾巴：竖起后仰 + 真正的左右对称晃 ----
  // 链 +Y 向上；后仰 = rotation.z（负值朝身后）
  // 左右 = rotation.x（sin 过零，左右对称），绝不用 z=π/2 + rotation.y 那套
  const t = gait;
  const wind = 0.4 + 0.6 * moveAmt;
  const baseLean =
    p.tail?.userData?.baseLeanZ ?? THREE.MathUtils.degToRad(-45);
  // 保持约 45° 后仰，仅随步轻微点动（不拉回 90° 直立）
  const leanZAnim = baseLean + Math.cos(t * 2) * 0.035 * moveAmt;
  // 左右主摆：纯 sin，振幅够大，肉眼可见双边
  const sway = Math.sin(t) * 0.42 * wind;

  if (p.tail) {
    p.tail.rotation.order = "ZYX";
    p.tail.rotation.z = leanZAnim; // 后仰立起
    p.tail.rotation.x = sway; // ← 左右！
    p.tail.rotation.y = 0;
  }

  const joints = p.tailJoints || [];
  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    if (!j) continue;
    const u = joints.length <= 1 ? 0 : i / (joints.length - 1);
    const phase = u * 0.5; // 末梢滞后 → S 甩
    const br = j.userData.baseRot || { x: 0, y: 0, z: 0 };
    // 左右振幅向末梢加大
    const ampLR = THREE.MathUtils.lerp(0.1, 0.45, u) * wind;
    // 前后微弧保持毛笔形
    const ampFB = THREE.MathUtils.lerp(0.02, 0.06, u) * wind;
    j.rotation.x = Math.sin(t - phase) * ampLR; // 左右
    j.rotation.y = 0;
    j.rotation.z = (br.z || 0) + Math.cos(t * 2 - phase) * ampFB; // 前后
  }
  // 三骨精确相位
  if (p.tailBase) {
    p.tailBase.rotation.x = Math.sin(t) * 0.18 * wind;
    p.tailBase.rotation.y = 0;
    p.tailBase.rotation.z = (p.tailBase.userData.baseRot?.z || 0) + Math.cos(t * 2) * 0.03 * wind;
  }
  if (p.tailMid) {
    p.tailMid.rotation.x = Math.sin(t - 0.25) * 0.32 * wind;
    p.tailMid.rotation.y = 0;
    p.tailMid.rotation.z = (p.tailMid.userData.baseRot?.z || 0) + Math.cos(t * 2 - 0.25) * 0.04 * wind;
  }
  if (p.tailTip) {
    p.tailTip.rotation.x = Math.sin(t - 0.5) * 0.48 * wind;
    p.tailTip.rotation.y = 0;
    p.tailTip.rotation.z = (p.tailTip.userData.baseRot?.z || 0) + Math.cos(t * 2 - 0.5) * 0.05 * wind;
  }

  // 脖子随步伐轻点
  if (p.neck) {
    p.neck.rotation.z = -0.35 + Math.sin(t * 2) * 0.04 * moveAmt;
    p.neck.rotation.x = Math.sin(t) * 0.03 * moveAmt;
  }

  // ---- 头追视（独立，夹钳，阻尼）----
  updateWalkHeadLookAt(fox, p.walkHead, anim, playerPos, dt, moveAmt, time);

  // 耳微动
  if (p.walkHead) {
    p.walkHead.traverse((o) => {
      if (!o.userData?.baseRot) return;
      const br = o.userData.baseRot;
      o.rotation.x = br.x + Math.sin(time * 4.2) * 0.05;
      o.rotation.z = br.z + Math.sin(time * 3.1 + br.z) * 0.03;
    });
  }
}

function updateWalkHeadLookAt(fox, head, anim, playerPos, dt, moveAmt, time) {
  if (!head) return;

  const neutralPitch = -0.04 + Math.sin(time * 2.4) * 0.03;
  const neutralYaw = Math.sin(time * 1.6) * 0.04 * (1 - moveAmt * 0.5);
  let targetYaw = neutralYaw;
  let targetPitch = neutralPitch;

  if (playerPos) {
    head.getWorldPosition(_headWorld);
    _axisY.setFromMatrixColumn(fox.matrixWorld, 1).normalize();
    _lookWorld.copy(playerPos).addScaledVector(_axisY, 0.45);

    const parent = head.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      _parentInv.copy(parent.matrixWorld).invert();
      _lookLocal.copy(_lookWorld).applyMatrix4(_parentInv);
      _lookLocal.sub(head.position);
    } else {
      _lookLocal.copy(_lookWorld).sub(_headWorld);
    }

    if (_lookLocal.lengthSq() > 1e-8) {
      _lookLocal.normalize();
      const horiz = Math.hypot(_lookLocal.x, _lookLocal.z) || 1e-6;
      let yaw = Math.atan2(-_lookLocal.z, _lookLocal.x);
      let pitch = Math.atan2(_lookLocal.y, horiz);
      yaw = THREE.MathUtils.clamp(yaw, -FOX_HEAD_CLAMP, FOX_HEAD_CLAMP);
      pitch = THREE.MathUtils.clamp(pitch, -FOX_HEAD_CLAMP, FOX_HEAD_CLAMP);
      // 走时弱追踪，停时仰望
      const track = THREE.MathUtils.lerp(0.9, 0.4, moveAmt);
      targetYaw = THREE.MathUtils.lerp(neutralYaw, yaw, track);
      targetPitch = THREE.MathUtils.lerp(neutralPitch, pitch, track);
    }
  }

  anim.headYaw = THREE.MathUtils.damp(anim.headYaw || 0, targetYaw, 6, dt);
  anim.headPitch = THREE.MathUtils.damp(anim.headPitch || 0, targetPitch, 6, dt);
  head.rotation.order = "YXZ";
  head.rotation.y = anim.headYaw;
  head.rotation.x = anim.headPitch;
  head.rotation.z = 0;
}

/** 兼容旧 API */
export function animateClassicRun(fox, time, moving) {
  const anim = fox.userData.anim || (fox.userData.anim = {});
  anim.movingSmooth = THREE.MathUtils.damp(anim.movingSmooth || 0, moving ? 1 : 0, 8, 1 / 60);
  animateFoxCompanion(fox, {
    time,
    dt: 1 / 60,
    moving,
    moveAmount: anim.movingSmooth,
    playerPos: null,
    leanZ: anim.leanZ || 0,
  });
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

