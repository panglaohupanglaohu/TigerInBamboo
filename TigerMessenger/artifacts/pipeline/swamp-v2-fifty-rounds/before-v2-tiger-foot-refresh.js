// =====================================================================
//  湖沼墨虎（Moebius Swamp Tiger）
//  - 体积再缩：在先前 0.63 基础上再 ×∛(1/4) ≈ 0.40（约原体积 1/16）
//  - 四足贴地：模型脚底对齐 local y=0；路径高度叠加球面 drop，避免“走斜面”
//  - 斑纹贴图 / 腰 2/3 / 黑身白掌 / 灯谜气泡
// =====================================================================
import * as THREE from "three";
import { addOutline, toonMat, OUTLINE } from "../toon.js";
import { registerLocalLight } from "../../render/lighting/localLightRegistry.js";
import { applyOptimizedTigerGeometry } from "../tigerGeometry.js";
import { prepareTigerAnatomy } from "../tigerAnatomy.js";

const BODY_BLACK = 0x121214; // 身体墨黑
const PAW_WHITE = 0xf4f1ea; // 脚掌白
const PATCH_WHITE = 0xe8e4dc; // 面部少量白
const EYE_RED = 0xff3b30;
const EYE_LIGHT = 0xff2d55;
const NOSE_INK = 0x0a0a0c;

/** 再缩小到约当前 1/4 体积：0.63 * ∛0.25 ≈ 0.40 */
export const TIGER_SCALE = 0.4;
/** 腰部相对原宽的收缩 */
const WAIST_MUL = 2 / 3;

/* ---------------- 虎纹 Canvas 贴图（无几何条棍） ---------------- */
let _stripeMap = null;
function getTigerStripeMap() {
  if (_stripeMap) return _stripeMap;
  const w = 256;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  // 底：墨黑
  ctx.fillStyle = "#141416";
  ctx.fillRect(0, 0, w, h);
  // 斑纹：略亮的墨灰/深靛不规则竖条（黑底上可辨）
  const stripes = 14;
  for (let i = 0; i < stripes; i++) {
    const x = ((i + 0.3) / stripes) * w + (Math.sin(i * 2.1) * 6);
    const bw = 5 + (i % 3) * 3 + Math.abs(Math.sin(i * 1.7)) * 4;
    const grad = ctx.createLinearGradient(x, 0, x + bw, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.35, "rgba(48,48,56,0.95)");
    grad.addColorStop(0.5, "rgba(28,28,34,1)");
    grad.addColorStop(0.65, "rgba(48,48,56,0.95)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    // 波浪边缘虎纹
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 4) {
      const wobble = Math.sin(y * 0.08 + i) * 3.5 + Math.sin(y * 0.03 + i * 0.5) * 2;
      ctx.lineTo(x + bw * 0.5 + wobble, y);
    }
    for (let y = h; y >= 0; y -= 4) {
      const wobble = Math.sin(y * 0.08 + i) * 3.5 + Math.sin(y * 0.03 + i * 0.5) * 2;
      ctx.lineTo(x - bw * 0.5 + wobble, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  // 少量横向断纹
  ctx.strokeStyle = "rgba(40,40,48,0.7)";
  ctx.lineWidth = 3;
  for (let j = 0; j < 6; j++) {
    const y = 16 + j * 18;
    ctx.beginPath();
    ctx.moveTo(10, y);
    for (let x = 10; x < w - 10; x += 8) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + j) * 4);
    }
    ctx.stroke();
  }
  _stripeMap = new THREE.CanvasTexture(c);
  _stripeMap.wrapS = THREE.RepeatWrapping;
  _stripeMap.wrapT = THREE.RepeatWrapping;
  _stripeMap.repeat.set(2.2, 1.4);
  _stripeMap.colorSpace = THREE.SRGBColorSpace;
  _stripeMap.needsUpdate = true;
  return _stripeMap;
}

/** 低多边化 + 描边入组 */
function tp(group, geo, mat, thickness = OUTLINE.character) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  addOutline(mesh, thickness);
  group.add(mesh);
  return mesh;
}

function bodyMat() {
  return toonMat(BODY_BLACK, {
    flatShading: true,
    map: getTigerStripeMap(),
    emissive: 0x1a1a22,
    emissiveIntensity: 0.12,
  });
}

function solidMat(color, emissive = 0x0a0a0c) {
  return toonMat(color, { flatShading: true, emissive, emissiveIntensity: 0.08 });
}

/* -------------------------------------------------------------------
 *  资产本体：createMoebiusTiger() → THREE.Group
 * ------------------------------------------------------------------- */
export function createMoebiusTigerModel(rnd = Math.random, { optimizedGeometry = true, anatomy = true } = {}) {
  const tigerGroup = new THREE.Group();
  tigerGroup.name = "moebius-cyber-ink-tiger";

  const matBody = bodyMat(); // 黑身 + 斑纹贴图
  const matPaw = solidMat(PAW_WHITE, 0x2a2824);
  const matPatch = solidMat(PATCH_WHITE, 0x222018);
  const matNose = solidMat(NOSE_INK, 0x050506);

  /* ---------- 骨骼层级（脚底最终对齐 local y=0） ---------- */
  // 腿几何：髋 y=LEG_HIP_Y，掌底相对髋 ≈ -1.536 → 髋=1.536 时脚底≈0
  const LEG_HIP_Y = 1.54;
  const BODY_CENTER_Y = 1.62; // 躯干中心（肩高感）
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "tiger-body";
  bodyGroup.position.y = BODY_CENTER_Y;
  tigerGroup.add(bodyGroup);

  /* ---------- 1. 躯干：黑身斑纹贴图；腰宽 = 原 2/3 ---------- */
  // 原 scale (1.5, 1.2, 2.8) → 腰向 × 2/3
  const torso = tp(
    bodyGroup,
    new THREE.SphereGeometry(1, 10, 8),
    matBody,
    OUTLINE.character
  );
  torso.scale.set(1.5 * WAIST_MUL, 1.2 * WAIST_MUL, 2.8);
  torso.name = "tiger-torso";

  const haunch = tp(
    bodyGroup,
    new THREE.SphereGeometry(0.82, 8, 6),
    matBody,
    OUTLINE.character
  );
  haunch.scale.set(1.25 * WAIST_MUL, 1.05 * WAIST_MUL, 1.3);
  haunch.position.set(0, 0.05, -2.0);

  // 前胸略鼓（仍黑身贴图），不恢复腰宽
  const chest = tp(
    bodyGroup,
    new THREE.SphereGeometry(0.7, 8, 6),
    matBody,
    OUTLINE.characterDetail
  );
  chest.scale.set(1.15 * WAIST_MUL, 1.0 * WAIST_MUL, 1.1);
  chest.position.set(0, 0.08, 1.65);

  /* ---------- 2. 头 ---------- */
  const headGroup = new THREE.Group();
  headGroup.name = "tiger-head";
  headGroup.position.set(0, 0.72, 2.42);
  bodyGroup.add(headGroup);

  const skull = tp(headGroup, new THREE.SphereGeometry(1, 9, 7), matBody, OUTLINE.character);
  skull.scale.set(1.02, 0.92, 1.12);
  for (const s of [-1, 1]) {
    const cheek = tp(
      headGroup,
      new THREE.SphereGeometry(0.62, 7, 5),
      matBody,
      OUTLINE.characterDetail
    );
    cheek.scale.set(0.72, 0.62, 0.85);
    cheek.position.set(s * 0.42, -0.28, 0.62);
    cheek.rotation.y = s * 0.5;
  }
  for (const s of [-1, 1]) {
    const ear = tp(
      headGroup,
      new THREE.ConeGeometry(0.26, 0.5, 4),
      matBody,
      OUTLINE.characterDetail
    );
    ear.position.set(s * 0.55, 0.82, 0.05);
    ear.rotation.z = -s * 0.35;
    ear.rotation.x = -0.15;
  }

  /* ---------- 红宝石眼 ---------- */
  const matEye = new THREE.MeshBasicMaterial({ color: EYE_RED, fog: false });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 10), matEye);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(s * 0.42, 0.14, 0.98);
    eye.rotation.y = s * 0.32;
    eye.raycast = () => {};
    headGroup.add(eye);
    const glow = new THREE.PointLight(EYE_LIGHT, 0.9, 5, 2);
    glow.position.set(s * 0.5, 0.16, 1.25);
    headGroup.add(glow);
    // K4：虎眼点光迁入 registry（owner 派生稳定 id：moebius-tiger-eye#0/#1）
    registerLocalLight(glow, {
      owner: "moebius-tiger-eye",
      kind: "point",
      color: EYE_LIGHT,
      intensity: 0.9,
      radius: 5,
      priority: 4,
    });
  }

  /* ---------- 面部少量白斑（口鼻） ---------- */
  const muzzle = tp(
    headGroup,
    new THREE.SphereGeometry(1, 6, 5),
    matPatch,
    OUTLINE.characterDetail
  );
  muzzle.scale.set(0.38, 0.28, 0.12);
  muzzle.position.set(0, -0.34, 1.02);
  muzzle.rotation.x = 0.15;

  const nose = tp(
    headGroup,
    new THREE.ConeGeometry(0.12, 0.16, 4),
    matNose,
    OUTLINE.characterDetail
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.16, 1.14);

  /* ---------- 3. 四足：黑腿 + 白脚掌，静止时四足平落（无永久前倾弯） ---------- */
  /** @type {THREE.Group[]} */
  const legs = [];
  const legX = 0.92 * WAIST_MUL + 0.15;
  // bend 仅作行走动画基线 0，避免静止像站在斜坡上
  const legSlots = [
    { x: -legX, z: 1.55, bend: 0 },
    { x: legX, z: 1.55, bend: 0 },
    { x: -legX - 0.04, z: -1.55, bend: 0 },
    { x: legX + 0.04, z: -1.55, bend: 0 },
  ];
  // 大腿长 + 脚掌使掌底在 leg 局部 y ≈ -LEG_HIP_Y
  const THIGH_H = 1.2;
  const PAW_H = 0.36;
  for (const slot of legSlots) {
    const leg = new THREE.Group();
    leg.position.set(slot.x, LEG_HIP_Y, slot.z);
    leg.rotation.x = 0;
    const upper = tp(
      leg,
      new THREE.CylinderGeometry(0.28, 0.36, THIGH_H, 5),
      matBody,
      OUTLINE.character
    );
    upper.position.y = -THIGH_H * 0.5;
    // 白色脚掌：底面贴 leg 局部 y = -LEG_HIP_Y → 世界 y=0
    const paw = tp(
      leg,
      new THREE.CylinderGeometry(0.34, 0.4, PAW_H, 5),
      matPaw,
      OUTLINE.character
    );
    paw.position.y = -THIGH_H - PAW_H * 0.5 + 0.02;
    const pad = tp(
      leg,
      new THREE.SphereGeometry(0.14, 5, 4),
      solidMat(0xfff8f0, 0x2a2420),
      OUTLINE.characterDetail
    );
    pad.scale.set(1.15, 0.28, 1.2);
    // 肉垫贴地：略低于脚掌中心
    pad.position.set(0, -THIGH_H - PAW_H + 0.04, 0.04);
    tigerGroup.add(leg);
    legs.push(leg);
  }

  // 脚底对齐 local y=0（量脚掌底，上移整组内容）
  {
    tigerGroup.updateMatrixWorld(true);
    let minY = Infinity;
    for (const leg of legs) {
      leg.updateMatrixWorld(true);
      leg.traverse((o) => {
        if (!o.isMesh || o.userData.isOutline) return;
        const box = new THREE.Box3().setFromObject(o);
        if (box.min.y < minY) minY = box.min.y;
      });
    }
    if (Number.isFinite(minY) && Math.abs(minY) > 1e-4) {
      // 未缩放组内：把脚底抬到 0
      bodyGroup.position.y -= minY;
      for (const leg of legs) leg.position.y -= minY;
    }
  }

  /* ---------- 4. 毛笔形分段尾（结构仿阿狸，色：黑身 + 白尖） ----------
   * 与 fox createWalkingFox 同构：链沿局部 +Y 竖起，后仰 lean，
   * 8 节 Cylinder 根细→中鼓→尖细；末 2 节乳白，前节焦黑。
   * 虎身坐标：+Z 头 / -Z 尾 / +Y 上 → 后仰用 rotation.x（负=朝身后 -Z）
   * 左右甩用 rotation.z（与狐的 rotation.x 左右对应）
   */
  const TAIL_OUT = 0.032;
  const matTailInk = solidMat(0x1a1a1c, 0x0e0e12); // 黑
  const matTailTip = solidMat(0xf4f7ed, 0x2a2820); // 白尖 #F4F7ED

  const BODY_W_T = 1.5 * WAIST_MUL; // 腰收后的身宽
  const TAIL_TOTAL = 5.4; // 约一体长的蓬松大尾
  const TAIL_R_PEAK = BODY_W_T * 0.4;

  /** 毛笔半径倍率 s∈[0,1]：根细 → 0.42 最鼓 → 尖细（同阿狸） */
  function brushRadiusMul(s) {
    const t = THREE.MathUtils.clamp(s, 0, 1);
    const peakAt = 0.42;
    if (t <= peakAt) {
      const k = t / peakAt;
      const ease = k * k * (3 - 2 * k);
      return 0.12 + (1.0 - 0.12) * ease;
    }
    const k = (t - peakAt) / (1 - peakAt);
    const ease = k * k;
    return 1.0 + (0.08 - 1.0) * ease;
  }
  function brushRadius(s) {
    return Math.max(0.04, brushRadiusMul(s) * TAIL_R_PEAK);
  }

  // 8 节权重（同阿狸）
  const SEG_W = [0.08, 0.1, 0.12, 0.14, 0.14, 0.14, 0.14, 0.14];
  const SEG_N = SEG_W.length;
  const segH = SEG_W.map((w) => TAIL_TOTAL * w);
  // 沿尾长微弧（在 lean 平面内，非左右）
  const baseBendLean = [2, 1, 1, 0, -1, -1, -2, -2].map((d) =>
    THREE.MathUtils.degToRad(d)
  );

  const tailRoot = new THREE.Group();
  tailRoot.name = "tiger-brush-tail-root";
  // 后臀上方；链 +Y 竖起
  tailRoot.position.set(0, 0.15, -2.35);
  tailRoot.rotation.order = "XZY";
  // 后仰 45°：+Y 指向身后斜上（-Z + Y）
  const TAIL_LEAN_BACK = THREE.MathUtils.degToRad(-45);
  tailRoot.rotation.x = TAIL_LEAN_BACK;
  tailRoot.rotation.y = 0;
  tailRoot.rotation.z = 0;
  tailRoot.userData.baseLeanX = TAIL_LEAN_BACK;
  bodyGroup.add(tailRoot);

  /** @type {THREE.Group[]} */
  const tailSegs = [];
  let tailParent = tailRoot;
  let s0 = 0;
  for (let i = 0; i < SEG_N; i++) {
    const s1 = s0 + SEG_W[i];
    const h = segH[i];
    const rBottom = brushRadius(s0);
    const rTop = brushRadius(s1);
    // 末两节白尖（同阿狸 cream 段）
    const useWhite = i >= SEG_N - 2;
    const segMat = useWhite ? matTailTip : matTailInk;

    const joint = new THREE.Group();
    joint.name =
      i === 0
        ? "TigerTailBase"
        : i === Math.floor(SEG_N * 0.4)
          ? "TigerTailMid"
          : i === SEG_N - 1
            ? "TigerTailTip"
            : `TigerTail-${i + 1}`;
    joint.position.set(0, i === 0 ? 0 : segH[i - 1] * 0.98, 0);
    tailParent.add(joint);

    // 圆柱轴 +Y，translate 使底在关节原点
    const geo = new THREE.CylinderGeometry(rTop, rBottom, h, 6, 1);
    geo.translate(0, h * 0.5, 0);
    const mesh = tp(joint, geo, segMat, i === SEG_N - 1 ? 0.028 : TAIL_OUT);
    mesh.name = useWhite ? "tiger-tail-brush-tip" : `tiger-tail-brush-${i + 1}`;
    // 略压扁成毛笔切面（同阿狸）
    const flat = THREE.MathUtils.lerp(0.9, 0.65, i / (SEG_N - 1));
    mesh.scale.set(flat, 1, flat * 0.9);
    // tp 已 add 到 joint；这里 mesh 已在 joint 下

    joint.userData.baseRot = {
      x: baseBendLean[i] ?? 0, // 沿 lean 平面微弧
      y: 0,
      z: 0,
    };
    joint.userData.segIndex = i;
    joint.rotation.x = joint.userData.baseRot.x;
    joint.rotation.y = 0;
    joint.rotation.z = 0;

    tailSegs.push(joint);
    tailParent = joint;
    s0 = s1;
  }

  /* ---------- 整体体积 → 约原 1/4 ---------- */
  tigerGroup.scale.setScalar(TIGER_SCALE);

  /* ---------- 动画 ---------- */
  const anim = { walkPhase: 0, headDown: 0 };
  if (optimizedGeometry) applyOptimizedTigerGeometry(tigerGroup);
  let anatomyController = null;
  const footPoint = new THREE.Vector3();
  let rest;
  function captureRest() {
    tigerGroup.updateMatrixWorld(true);
    rest = {
      legs: legs.map(leg => leg.rotation.clone()),
      legPositions: legs.map(leg => leg.position.clone()),
      footPoints: [],
      headPosition: headGroup.position.clone(), headRotation: headGroup.rotation.clone(),
      bodyRotation: bodyGroup.rotation.clone(), tailRotation: tailRoot.rotation.clone(),
      tailJoints: tailSegs.map(joint => joint.rotation.clone()),
    };
    // Serialized Blender extras contain the OLD brush-tail values. Actual
    // candidate transforms are the authority for this actor's animation rest.
    tailRoot.userData.baseLeanX = rest.tailRotation.x;
    tailSegs.forEach((joint, i) => {
      joint.userData.baseRot = { x: rest.tailJoints[i].x, y: rest.tailJoints[i].y, z: rest.tailJoints[i].z };
    });
    if (tigerGroup.userData.tigerAnatomy?.active) {
      for (const leg of legs) {
        const inverse = leg.matrixWorld.clone().invert(), points = [];
        leg.traverseVisible(node => {
          if (!node.isMesh || node.userData.isOutline) return;
          const position = node.geometry?.getAttribute('position');
          if (!position) return;
          const local = inverse.clone().multiply(node.matrixWorld);
          for (let i = 0; i < position.count; i++) {
            points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(local));
          }
        });
        rest.footPoints.push(points);
      }
    }
  }
  captureRest();
  tigerGroup.userData.setTigerAnatomy = enabled => {
    if (!anatomyController && !enabled) return true;
    if (!anatomyController) {
      // A first toggle can happen mid-animation. Prepare from the original
      // rest state rather than storing one walking frame as the fallback.
      legs.forEach((leg, i) => { leg.position.copy(rest.legPositions[i]); leg.rotation.copy(rest.legs[i]); });
      headGroup.position.copy(rest.headPosition); headGroup.rotation.copy(rest.headRotation);
      bodyGroup.rotation.copy(rest.bodyRotation); tailRoot.rotation.copy(rest.tailRotation);
      tailSegs.forEach((joint, i) => joint.rotation.copy(rest.tailJoints[i]));
      anatomyController = prepareTigerAnatomy(tigerGroup);
    }
    if (!anatomyController) return false;
    const already = tigerGroup.userData.tigerAnatomy.active === !!enabled;
    if (!anatomyController.setEnabled(enabled)) return false;
    if (!already) captureRest();
    return true;
  };
  tigerGroup.userData.disposeTigerAnatomy = () => {
    if (!anatomyController) return;
    anatomyController.setEnabled(false);
    captureRest();
    anatomyController.dispose();
    anatomyController = null;
  };
  if (anatomy) tigerGroup.userData.setTigerAnatomy(true);

  tigerGroup.userData.kind = "moebius-swamp-tiger";
  tigerGroup.userData.displayName = "湖沼之虎";
  tigerGroup.userData.speech = {
    line: "两家秋雨一家声，你猜",
    reply: "芭蕉与荷",
  };
  tigerGroup.userData.tailSegs = tailSegs;
  tigerGroup.userData.tailRoot = tailRoot;
  tigerGroup.userData.anatomyLegs = legs;

  tigerGroup.userData.update = function updateTiger(dt, t) {
    const walking = tigerGroup.userData._walking;
    if (walking) anim.walkPhase += dt * 7.5;
    // 对角步态：幅度适中，四足轮换触地，避免“爬坡”感
    const swing = walking ? Math.sin(anim.walkPhase) * 0.28 : 0;
    legs[0].rotation.x = rest.legs[0].x + swing;
    legs[1].rotation.x = rest.legs[1].x - swing;
    legs[2].rotation.x = rest.legs[2].x - swing * 0.9;
    legs[3].rotation.x = rest.legs[3].x + swing * 0.9;
    // The longer Blender paws can dip ~5 mm below the old flat support plane.
    // Lift only an intersecting leg; retain the original gait and root motion.
    if (tigerGroup.userData.tigerAnatomy?.active) {
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        let footMinY = Infinity;
        for (const point of rest.footPoints[i]) {
          footPoint.copy(point).multiply(leg.scale).applyQuaternion(leg.quaternion);
          footMinY = Math.min(footMinY, footPoint.y);
        }
        leg.position.y = rest.legPositions[i].y +
          (Number.isFinite(footMinY) ? Math.max(0, -footMinY - rest.legPositions[i].y) : 0);
      }
    }
    // 脚底已对齐 y=0：_baseY 即地面高度；行走仅极轻上下起伏
    tigerGroup.position.y =
      (tigerGroup.userData._baseY || 0) +
      (walking ? Math.abs(Math.sin(anim.walkPhase)) * 0.03 : 0);

    // —— 毛笔尾动画（结构/相位同阿狸 animateFoxCompanion）——
    // 链 +Y；后仰 = rotation.x；左右 = rotation.z
    const moveAmt = walking ? 1 : 0.25;
    const gait = anim.walkPhase || t * 3;
    const wind = 0.4 + 0.6 * moveAmt;
    const baseLean = rest.tailRotation.x;
    const leanAnim = baseLean + Math.cos(gait * 2) * 0.035 * moveAmt;
    const sway = Math.sin(gait) * 0.42 * wind;

    tailRoot.rotation.order = "XZY";
    tailRoot.rotation.x = leanAnim; // 后仰
    tailRoot.rotation.z = rest.tailRotation.z + sway * 0.35; // 根部轻左右
    tailRoot.rotation.y = rest.tailRotation.y;

    for (let i = 0; i < tailSegs.length; i++) {
      const j = tailSegs[i];
      const u = tailSegs.length <= 1 ? 0 : i / (tailSegs.length - 1);
      const phase = u * 0.5; // 末梢滞后 → S 甩
      const br = rest.tailJoints[i];
      const ampLR = THREE.MathUtils.lerp(0.1, 0.45, u) * wind;
      const ampFB = THREE.MathUtils.lerp(0.02, 0.06, u) * wind;
      // 左右（z）相位延迟
      j.rotation.z = br.z + Math.sin(gait - phase) * ampLR;
      j.rotation.y = br.y;
      // 前后微弧（x）
      j.rotation.x = (br.x || 0) + Math.cos(gait * 2 - phase) * ampFB;
    }

    const target = tigerGroup.userData._drinking ? 1 : 0;
    anim.headDown += (target - anim.headDown) * Math.min(1, dt * 3);
    headGroup.rotation.x = rest.headRotation.x + anim.headDown * 0.95;
    headGroup.position.z = rest.headPosition.z - anim.headDown * 0.5;
    headGroup.position.y = rest.headPosition.y - anim.headDown * 0.55;
    bodyGroup.rotation.x = rest.bodyRotation.x + anim.headDown * 0.1;
  };

  return tigerGroup;
}
