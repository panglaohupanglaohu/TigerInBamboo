// =====================================================================
//  湖沼墨虎（Moebius Swamp Tiger）
//  - 体积再缩：在先前 0.63 基础上再 ×∛(1/4) ≈ 0.40（约原体积 1/16）
//  - 四足贴地：模型脚底对齐 local y=0；路径高度叠加球面 drop，避免“走斜面”
//  - 斑纹贴图 / 腰 2/3 / 黑身白掌 / 灯谜气泡
// =====================================================================
import * as THREE from "three";
import { addOutline, toonMat, OUTLINE } from "../assets/toon.js";
import { showBubble, hideBubble } from "../ui/hud.js";
import { PLANET_RADIUS } from "./planet.js";

const BODY_BLACK = 0x121214; // 身体墨黑
const PAW_WHITE = 0xf4f1ea; // 脚掌白
const PATCH_WHITE = 0xe8e4dc; // 面部少量白
const EYE_RED = 0xff3b30;
const EYE_LIGHT = 0xff2d55;
const NOSE_INK = 0x0a0a0c;

/** 再缩小到约当前 1/4 体积：0.63 * ∛0.25 ≈ 0.40 */
const TIGER_SCALE = 0.4;
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
export function createMoebiusTiger(rnd = Math.random, roam = null) {
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

  tigerGroup.userData.kind = "moebius-swamp-tiger";
  tigerGroup.userData.displayName = "湖沼墨虎";
  tigerGroup.userData.speech = {
    line: "两家秋雨一家声，你猜",
    reply: "芭蕉与荷",
  };
  tigerGroup.userData.tailSegs = tailSegs;
  tigerGroup.userData.tailRoot = tailRoot;

  tigerGroup.userData.update = function updateTiger(dt, t) {
    const walking = tigerGroup.userData._walking;
    if (walking) anim.walkPhase += dt * 7.5;
    // 对角步态：幅度适中，四足轮换触地，避免“爬坡”感
    const swing = walking ? Math.sin(anim.walkPhase) * 0.28 : 0;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    legs[2].rotation.x = -swing * 0.9;
    legs[3].rotation.x = swing * 0.9;
    // 脚底已对齐 y=0：_baseY 即地面高度；行走仅极轻上下起伏
    tigerGroup.position.y =
      (tigerGroup.userData._baseY || 0) +
      (walking ? Math.abs(Math.sin(anim.walkPhase)) * 0.03 : 0);

    // —— 毛笔尾动画（结构/相位同阿狸 animateFoxCompanion）——
    // 链 +Y；后仰 = rotation.x；左右 = rotation.z
    const moveAmt = walking ? 1 : 0.25;
    const gait = anim.walkPhase || t * 3;
    const wind = 0.4 + 0.6 * moveAmt;
    const baseLean = tailRoot.userData.baseLeanX ?? THREE.MathUtils.degToRad(-45);
    const leanAnim = baseLean + Math.cos(gait * 2) * 0.035 * moveAmt;
    const sway = Math.sin(gait) * 0.42 * wind;

    tailRoot.rotation.order = "XZY";
    tailRoot.rotation.x = leanAnim; // 后仰
    tailRoot.rotation.z = sway * 0.35; // 根部轻左右
    tailRoot.rotation.y = 0;

    for (let i = 0; i < tailSegs.length; i++) {
      const j = tailSegs[i];
      const u = tailSegs.length <= 1 ? 0 : i / (tailSegs.length - 1);
      const phase = u * 0.5; // 末梢滞后 → S 甩
      const br = j.userData.baseRot || { x: 0, y: 0, z: 0 };
      const ampLR = THREE.MathUtils.lerp(0.1, 0.45, u) * wind;
      const ampFB = THREE.MathUtils.lerp(0.02, 0.06, u) * wind;
      // 左右（z）相位延迟
      j.rotation.z = Math.sin(gait - phase) * ampLR;
      j.rotation.y = 0;
      // 前后微弧（x）
      j.rotation.x = (br.x || 0) + Math.cos(gait * 2 - phase) * ampFB;
    }

    const target = tigerGroup.userData._drinking ? 1 : 0;
    anim.headDown += (target - anim.headDown) * Math.min(1, dt * 3);
    headGroup.rotation.x = anim.headDown * 0.95;
    headGroup.position.z = 2.42 - anim.headDown * 0.5;
    headGroup.position.y = 0.72 - anim.headDown * 0.55;
    bodyGroup.rotation.x = anim.headDown * 0.1;
  };

  if (roam) attachRoamBehavior(tigerGroup, roam);
  return tigerGroup;
}

/* -------------------------------------------------------------------
 *  巡游 + 饮水 + 见送信人跳下相见
 *  roam: { rim, steps, drink, speed? }
 *  update(dt, t, runtime?)  runtime.player → 触发跳下相见
 * ------------------------------------------------------------------- */
const GREET_SEE_R = 32; // 坑缘看见送信人的水平距离（湖沼本地）
const GREET_MEET_R = 3.2; // 走到面前的距离
const GREET_STAY = 10; // 相见停留（够说完灯谜）
const GREET_COOLDOWN = 18; // 结束后冷却，避免反复跳
const GREET_JUMP_DUR = 0.95;
const GREET_JUMP_PEAK = 4.2; // 抛物线跳起高度

const _greetFrom = new THREE.Vector3();
const _greetTo = new THREE.Vector3();
const _greetPlayer = new THREE.Vector3();

function attachRoamBehavior(tiger, roam) {
  if (!roam.rim?.length || !roam.steps?.length) return;
  const speed = roam.speed ?? 2.4;
  const rim = roam.rim;
  const steps = roam.steps;
  const up = [...steps].reverse();
  let mode = "patrol";
  let wp = 0;
  let pause = 0;
  let drinkT = 0;
  let queue = steps;
  let qi = 0;
  let greetStayT = 0;
  let greetCd = 0;
  /** @type {{ t: number, dur: number, peak: number }|null} */
  let jump = null;

  /**
   * 球面贴地：与 applySwampSphereFit 同公式，消除坑缘“平面斜坡”悬空感。
   * pathY = 设计路径高度（如 SWAMP_GROUND_Y 或石阶 y）
   */
  function groundY(x, z, pathY) {
    let scale = 1;
    let o = tiger.parent;
    while (o) {
      if (Number.isFinite(o.userData?.factoryScale)) {
        scale = o.userData.factoryScale;
        break;
      }
      if (Number.isFinite(o.parent?.userData?.factoryScale)) {
        scale = o.parent.userData.factoryScale;
        break;
      }
      o = o.parent;
      if (!o || o === o.parent) break;
    }
    const Rs = PLANET_RADIUS / Math.max(1e-4, scale);
    const d = Math.hypot(x, z);
    const drop = d >= Rs ? 0 : Rs - Math.sqrt(Math.max(0, Rs * Rs - d * d));
    return pathY - drop;
  }

  const seek = (target, dt, arrive, spd = speed) => {
    if (!target) return true;
    const dx = target.x - tiger.position.x;
    const dz = target.z - tiger.position.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) return true;
    const step = Math.min(d, spd * dt);
    tiger.position.x += (dx / d) * step;
    tiger.position.z += (dz / d) * step;
    tiger.rotation.y = Math.atan2(dx, dz);
    // 水平移动时同步贴地高度（path 点自带 y 时用目标 y）
    if (Number.isFinite(target.y)) {
      tiger.userData._baseY = groundY(tiger.position.x, tiger.position.z, target.y);
    }
    return false;
  };

  /** 送信人 → 虎父节点本地坐标 */
  function playerLocal(player) {
    if (!player?.position || !tiger.parent) return null;
    _greetPlayer.copy(player.position);
    tiger.parent.worldToLocal(_greetPlayer);
    return _greetPlayer;
  }

  /** 开跳：从当前坑缘/高处跃向送信人近旁 */
  function beginGreetJump(pl) {
    _greetFrom.copy(tiger.position);
    _greetFrom.y = tiger.userData._baseY ?? tiger.position.y;
    // 落点：送信人身前约 2.8，贴地高度
    const dx = pl.x - tiger.position.x;
    const dz = pl.z - tiger.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const stop = Math.max(0, d - 2.8);
    const tx = tiger.position.x + (dx / d) * stop;
    const tz = tiger.position.z + (dz / d) * stop;
    _greetTo.set(tx, groundY(tx, tz, pl.y), tz);
    jump = { t: 0, dur: GREET_JUMP_DUR, peak: GREET_JUMP_PEAK * TIGER_SCALE * 2.2 };
    mode = "greet-jump";
    tiger.userData._greeting = true;
    tiger.userData._drinking = false;
    tiger.rotation.y = Math.atan2(dx, dz);
  }

  tiger.userData._walking = false;
  tiger.userData._drinking = false;
  tiger.userData._greeting = false;
  tiger.position.copy(rim[0]);
  tiger.userData._baseY = groundY(rim[0].x, rim[0].z, rim[0].y);
  tiger.position.y = tiger.userData._baseY;

  const prevUpdate = tiger.userData.update;
  tiger.userData.update = function (dt, t, runtime) {
    const player = runtime?.player ?? null;
    if (greetCd > 0) greetCd -= dt;

    // 强制饮水（旧接口）
    if (tiger.userData.forceDrink && mode === "patrol") {
      mode = "to-steps";
      tiger.userData.forceDrink = false;
    }

    // 巡游/饮水途中看见送信人 → 跳下相见
    if (
      player &&
      greetCd <= 0 &&
      (mode === "patrol" ||
        mode === "to-steps" ||
        mode === "descend" ||
        mode === "drink" ||
        mode === "ascend")
    ) {
      const pl = playerLocal(player);
      if (pl) {
        const horiz = Math.hypot(pl.x - tiger.position.x, pl.z - tiger.position.z);
        // 送信人在湖沼坑内（比坑缘低）或已足够近
        const rimY = rim[0].y;
        const playerBelow = pl.y < rimY - 2;
        if (horiz < GREET_SEE_R && (playerBelow || horiz < 14)) {
          beginGreetJump(pl);
        }
      }
    }

    tiger.userData._walking = false;
    tiger.userData._drinking = false;
    if (mode !== "greet-jump" && mode !== "greet-meet" && mode !== "greet-stay") {
      tiger.userData._greeting = false;
    }

    if (mode === "greet-jump" && jump) {
      // 抛物线跃下：水平 ease + 竖直 sin 拱
      jump.t += dt;
      const u = Math.min(1, jump.t / jump.dur);
      const ease = u * u * (3 - 2 * u);
      tiger.position.x = _greetFrom.x + (_greetTo.x - _greetFrom.x) * ease;
      tiger.position.z = _greetFrom.z + (_greetTo.z - _greetFrom.z) * ease;
      const baseY = _greetFrom.y + (_greetTo.y - _greetFrom.y) * ease;
      tiger.userData._baseY = baseY + Math.sin(u * Math.PI) * jump.peak;
      tiger.userData._walking = false;
      tiger.userData._greeting = true;
      // 腾空时略收腿感：用 drinking 低头的反面——保持机警抬头
      if (u >= 1) {
        jump = null;
        mode = "greet-meet";
        tiger.userData._baseY = _greetTo.y;
      }
    } else if (mode === "greet-meet") {
      tiger.userData._greeting = true;
      const pl = playerLocal(player);
      if (!pl) {
        // 人走了：回坑缘
        mode = "ascend";
        queue = up;
        qi = 0;
      } else if (seek(pl, dt, GREET_MEET_R, speed * 1.35)) {
        // 到面前：面向送信人
        const dx = pl.x - tiger.position.x;
        const dz = pl.z - tiger.position.z;
        if (dx * dx + dz * dz > 1e-6) tiger.rotation.y = Math.atan2(dx, dz);
        tiger.userData._baseY += (pl.y - tiger.userData._baseY) * Math.min(1, dt * 4);
        mode = "greet-stay";
        greetStayT = GREET_STAY;
      } else {
        tiger.userData._walking = true;
        tiger.userData._baseY += (pl.y - tiger.userData._baseY) * Math.min(1, dt * 3);
      }
    } else if (mode === "greet-stay") {
      tiger.userData._greeting = true;
      const pl = playerLocal(player);
      if (pl) {
        const dx = pl.x - tiger.position.x;
        const dz = pl.z - tiger.position.z;
        if (dx * dx + dz * dz > 1e-6) tiger.rotation.y = Math.atan2(dx, dz);
        // 轻轻贴着送信人高度
        tiger.userData._baseY += (pl.y - tiger.userData._baseY) * Math.min(1, dt * 2);
        // 人跑远则提前结束
        const horiz = Math.hypot(dx, dz);
        if (horiz > GREET_SEE_R * 0.85) greetStayT = 0;
      }
      greetStayT -= dt;
      if (greetStayT <= 0) {
        tiger.userData._greeting = false;
        greetCd = GREET_COOLDOWN;
        mode = "ascend";
        queue = up;
        qi = 0;
      }
    } else if (mode === "patrol") {
      if (pause > 0) pause -= dt;
      else if (seek(rim[wp], dt, 0.8)) {
        pause = 1.2 + Math.random() * 1.6;
        wp = (wp + 1) % rim.length;
        if (wp === 0) mode = "to-steps";
      } else tiger.userData._walking = true;
      tiger.userData._baseY = groundY(
        tiger.position.x,
        tiger.position.z,
        rim[wp]?.y ?? rim[0].y
      );
    } else if (mode === "to-steps") {
      if (seek(steps[0], dt, 0.7)) {
        mode = "descend";
        queue = steps;
        qi = 0;
      } else tiger.userData._walking = true;
      tiger.userData._baseY = groundY(
        tiger.position.x,
        tiger.position.z,
        steps[0].y
      );
    } else if (mode === "descend") {
      tiger.userData._walking = true;
      if (qi < queue.length && seek(queue[qi], dt, 0.6)) qi++;
      const ty = qi < queue.length ? queue[qi].y : roam.drink.y;
      const targetY = groundY(tiger.position.x, tiger.position.z, ty);
      tiger.userData._baseY += (targetY - tiger.userData._baseY) * Math.min(1, dt * 3);
      if (qi >= queue.length) {
        mode = "drink";
        drinkT = 5 + Math.random() * 3;
        queue = up;
        qi = 0;
      }
    } else if (mode === "drink") {
      tiger.userData._drinking = true;
      drinkT -= dt;
      tiger.userData._baseY = groundY(
        tiger.position.x,
        tiger.position.z,
        roam.drink.y
      );
      if (drinkT <= 0) mode = "ascend";
    } else if (mode === "ascend") {
      tiger.userData._walking = true;
      if (qi < queue.length && seek(queue[qi], dt, 0.6)) qi++;
      const ty = qi < queue.length ? queue[qi].y : rim[0].y;
      const targetY = groundY(tiger.position.x, tiger.position.z, ty);
      tiger.userData._baseY += (targetY - tiger.userData._baseY) * Math.min(1, dt * 3);
      if (qi >= queue.length) {
        mode = "patrol";
        wp = 1;
        queue = steps;
        qi = 0;
      }
    }
    tiger.userData._mode = mode;
    prevUpdate(dt, t);
  };
}

/* -------------------------------------------------------------------
 *  与送信人对话气泡
 *  虎：「两家秋雨一家声，你猜」
 *  送信人：「芭蕉与荷」
 * ------------------------------------------------------------------- */
// 相见跳下后近距离说话；略放大以免落地后对不上
const TIGER_TALK_RANGE = 7.5;
const TIGER_LINE_HOLD = 3.2;
const TIGER_REPLY_HOLD = 2.8;
const TIGER_COOLDOWN = 14;
const _tigerBubbleWorld = new THREE.Vector3();
const _playerWorld = new THREE.Vector3();

/**
 * 每帧：若送信人靠近湖沼虎，弹出对答气泡。
 * @param {{ tiger?: THREE.Object3D|null, player?: object, camera?: THREE.Camera, dt?: number, isGameStarted?: () => boolean, isBlocked?: () => boolean }} deps
 */
export function updateSwampTigerDialog({
  tiger,
  player,
  camera,
  dt = 0.016,
  isGameStarted = () => true,
  isBlocked = () => false,
}) {
  if (!tiger || !player || !camera || !isGameStarted()) {
    if (tiger?.userData?._dialog?.active) {
      hideBubble();
      tiger.userData._dialog.active = false;
      tiger.userData._dialog.phase = "idle";
    }
    return false;
  }

  if (!tiger.userData._dialog) {
    tiger.userData._dialog = {
      phase: "idle", // idle | tiger | messenger | cool
      timer: 0,
      active: false,
    };
  }
  const d = tiger.userData._dialog;
  const speech = tiger.userData.speech || {
    line: "两家秋雨一家声，你猜",
    reply: "芭蕉与荷",
  };

  tiger.getWorldPosition(_tigerBubbleWorld);
  _playerWorld.copy(player.position);
  const dist = _tigerBubbleWorld.distanceTo(_playerWorld);
  const near = dist <= TIGER_TALK_RANGE;

  if (isBlocked()) {
    if (d.active) {
      hideBubble();
      d.active = false;
    }
    return false;
  }

  if (d.phase === "idle") {
    if (near) {
      d.phase = "tiger";
      d.timer = TIGER_LINE_HOLD;
      d.active = true;
    }
  } else if (d.phase === "tiger") {
    d.timer -= dt;
    _tigerBubbleWorld.y += 1.15 * (tiger.scale?.x || TIGER_SCALE) * 2.2;
    projectAndShow(speech.line, _tigerBubbleWorld, camera);
    d.active = true;
    if (d.timer <= 0) {
      d.phase = "messenger";
      d.timer = TIGER_REPLY_HOLD;
    }
  } else if (d.phase === "messenger") {
    d.timer -= dt;
    _playerWorld.y += 2.2;
    projectAndShow(speech.reply, _playerWorld, camera);
    d.active = true;
    if (d.timer <= 0) {
      hideBubble();
      d.active = false;
      d.phase = "cool";
      d.timer = TIGER_COOLDOWN;
    }
  } else if (d.phase === "cool") {
    d.timer -= dt;
    if (d.timer <= 0) {
      d.phase = "idle";
      // 仍站在旁边则不会立刻连刷：需先离开再靠近
      if (near) d.timer = 0.5;
    }
  }

  // 中途走开：收起并进入冷却
  if (!near && (d.phase === "tiger" || d.phase === "messenger")) {
    hideBubble();
    d.active = false;
    d.phase = "cool";
    d.timer = 4;
  }

  return d.active;
}

function projectAndShow(text, worldPos, camera) {
  _tigerBubbleWorld.copy(worldPos);
  _tigerBubbleWorld.project(camera);
  if (_tigerBubbleWorld.z < 1) {
    showBubble(
      text,
      (_tigerBubbleWorld.x * 0.5 + 0.5) * window.innerWidth,
      (-_tigerBubbleWorld.y * 0.5 + 0.5) * window.innerHeight,
      { large: true } // 湖沼虎灯谜加大字号
    );
  } else {
    hideBubble();
  }
}

/** 从场景里找湖沼虎（placement wrap / zone 均可） */
export function findSwampTiger(scene) {
  if (!scene) return null;
  let found = null;
  scene.traverse((o) => {
    if (found) return;
    if (o.userData?.kind === "moebius-swamp-tiger") found = o;
    if (o.userData?.tiger?.userData?.kind === "moebius-swamp-tiger") {
      found = o.userData.tiger;
    }
  });
  return found;
}
