// =====================================================================
//  暗紫灰色赛博水墨老虎（Cyber Ink Tiger）· 向莫比斯致敬的独立 NPC
//  - 严格四足猫科骨骼层级：tigerGroup → bodyGroup(躯干/头/尾) + 四足
//  - 躯干：横向非等比拉伸卵形多面体 scale(1.5, 1.2, 2.8)，前胸厚实后臀微收
//  - 头部圆润 V 形，前上方 1/4 嵌套进前胸网格，消除拼接断层
//  - 红宝石自发光双眼（MeshBasicMaterial #FF3B30 + 微型红色 PointLight）
//  - 淡灰 #DCDCDC 面部斑块拼黑白斑纹
//  - 30~40 片极扁黑色 #1F1F2E 虎纹贴片，横纵交错环绕躯干四肢，外探 0.01
//  - 黑色短靴四足：五棱柱腿（radialSegments 5）+ 焦黑爪部
//  - 长尾 = 3 段由粗到细圆锥串联，总长 ≈ 身体 0.9，尾尖上翘 20°
//  - 全部件 MeshToonMaterial({flatShading:true}) 消光 + 通用 addOutline() 墨线
//  可选 roam 配置：在大树间巡游 + 沿石阶下坑饮水的状态机行为
// =====================================================================
import * as THREE from "three";
import { addOutline, toonMat, OUTLINE } from "../assets/toon.js";

const SKIN = 0x463c43;    // 消光暗紫灰
const INK_STRIPE = 0x1f1f2e; // 纯黑虎纹
const PATCH_GRAY = 0xdcdcdc; // 面部淡灰斑块
const EYE_RED = 0xff3b30;    // 暴烈红
const EYE_LIGHT = 0xff2d55;  // 红宝石点光源
const BOOT_BLACK = 0x141216; // 焦黑短靴

/** 低多边化 + 描边入组 */
function tp(group, geo, mat, thickness = OUTLINE.character) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  addOutline(mesh, thickness);
  group.add(mesh);
  return mesh;
}

/** 消光 Toon 皮肤（带极弱自发光，月夜里保住剪影） */
function skinMat(color, emissive = 0x120e14) {
  return toonMat(color, { flatShading: true, emissive });
}

/* -------------------------------------------------------------------
 *  资产本体：createMoebiusTiger() → THREE.Group
 * ------------------------------------------------------------------- */
export function createMoebiusTiger(rnd = Math.random, roam = null) {
  const tigerGroup = new THREE.Group();
  tigerGroup.name = "moebius-cyber-ink-tiger";

  const matSkin = skinMat(SKIN, 0x2a2230);
  const matStripe = skinMat(INK_STRIPE, 0x12121c);
  const matPatch = skinMat(PATCH_GRAY, 0x2e2e34);
  const matBoot = skinMat(BOOT_BLACK, 0x0c0a10);

  /* ---------- 骨骼层级：bodyGroup 承载躯干/头/尾，四足挂在 tigerGroup ---------- */
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "tiger-body";
  bodyGroup.position.y = 1.62; // 四足伏地的低姿态躯干中心
  tigerGroup.add(bodyGroup);

  /* ---------- 1. 浑圆前胸与腹部：横向非等比拉伸卵形多面体 ---------- */
  const torso = tp(bodyGroup, new THREE.SphereGeometry(1, 10, 8), matSkin, OUTLINE.character);
  torso.scale.set(1.5, 1.2, 2.8); // 前胸厚实、后臀微收的流线躯干
  // 后臀微收：尾端再叠一枚小卵形
  const haunch = tp(bodyGroup, new THREE.SphereGeometry(0.82, 8, 6), matSkin, OUTLINE.character);
  haunch.scale.set(1.25, 1.05, 1.3);
  haunch.position.set(0, 0.05, -2.0);

  /* ---------- 2. 圆润 V 形头：前上方 1/4 嵌套进前胸 ---------- */
  const headGroup = new THREE.Group();
  headGroup.name = "tiger-head";
  headGroup.position.set(0, 0.72, 2.42); // 嵌套进前胸网格，彻底消除拼接断层
  bodyGroup.add(headGroup);

  const skull = tp(headGroup, new THREE.SphereGeometry(1, 9, 7), matSkin, OUTLINE.character);
  skull.scale.set(1.02, 0.92, 1.12);
  // V 形脸颊：两枚斜削扁球拼出猫科颧骨
  for (const s of [-1, 1]) {
    const cheek = tp(headGroup, new THREE.SphereGeometry(0.62, 7, 5), matSkin, OUTLINE.characterDetail);
    cheek.scale.set(0.72, 0.62, 0.85);
    cheek.position.set(s * 0.42, -0.28, 0.62);
    cheek.rotation.y = s * 0.5; // 向前收拢成 V
  }
  // 双耳
  for (const s of [-1, 1]) {
    const ear = tp(headGroup, new THREE.ConeGeometry(0.26, 0.5, 4), matSkin, OUTLINE.characterDetail);
    ear.position.set(s * 0.55, 0.82, 0.05);
    ear.rotation.z = -s * 0.35;
    ear.rotation.x = -0.15;
  }

  /* ---------- 红宝石大眼：自发光圆薄片 + 微型红色 PointLight ---------- */
  const matEye = new THREE.MeshBasicMaterial({ color: EYE_RED, fog: false });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 10), matEye);
    eye.rotation.x = Math.PI / 2; // 圆面朝前
    eye.position.set(s * 0.42, 0.14, 0.98);
    eye.rotation.y = s * 0.32; // 略朝外，猫科正面双目
    eye.raycast = () => {};
    headGroup.add(eye);
    const glow = new THREE.PointLight(EYE_LIGHT, 1.1, 7, 2);
    glow.position.set(s * 0.5, 0.16, 1.25);
    headGroup.add(glow);
  }

  /* ---------- 面部淡灰斑块（带黑描边）拼黑白斑纹 ---------- */
  const patchSpecs = [
    { p: [0, -0.34, 1.02], s: [0.42, 0.3, 0.1], r: [0.15, 0, 0] },     // 口鼻白块
    { p: [-0.66, -0.1, 0.62], s: [0.34, 0.42, 0.09], r: [0, 0, 0.5] }, // 左颊
    { p: [0.66, -0.1, 0.62], s: [0.34, 0.42, 0.09], r: [0, 0, -0.5] }, // 右颊
    { p: [-0.4, 0.44, 0.86], s: [0.2, 0.14, 0.07], r: [0.3, 0, 0] },   // 左眉
    { p: [0.4, 0.44, 0.86], s: [0.2, 0.14, 0.07], r: [0.3, 0, 0] },    // 右眉
  ];
  for (const q of patchSpecs) {
    const patch = tp(headGroup, new THREE.SphereGeometry(1, 6, 5), matPatch, OUTLINE.characterDetail);
    patch.scale.set(...q.s);
    patch.position.set(...q.p);
    patch.rotation.set(...q.r);
  }
  // 鼻头一点焦黑
  const nose = tp(headGroup, new THREE.ConeGeometry(0.12, 0.16, 4), matBoot, OUTLINE.characterDetail);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.16, 1.14);

  /* ---------- 3. 低多边形水墨虎纹网络：极扁黑片外探 0.01，横纵交错 ---------- */
  const _n = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _x = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const stripeCount = 28 + ((rnd() * 5) | 0); // 躯干 28~32 片
  for (let i = 0; i < stripeCount; i++) {
    const u = rnd() * Math.PI * 2;             // 环绕角
    const z = (rnd() * 2 - 1) * 2.3;           // 沿体长分布
    const shrink = Math.sqrt(Math.max(0.08, 1 - (z / 2.8) ** 2));
    const p = new THREE.Vector3(1.5 * shrink * Math.cos(u), 1.2 * shrink * Math.sin(u), z);
    _n.set(p.x / 2.25, p.y / 1.44, p.z / 7.84).normalize(); // 椭球法线
    const longitudinal = rnd() < 0.35; // 纵向泼墨 vs 横向环纹
    if (longitudinal) _t.set(0, 0, 1);
    else _t.set(-Math.sin(u), Math.cos(u), 0);
    _t.addScaledVector(_n, -_t.dot(_n)).normalize(); // 纹长方向（切面内）
    _x.crossVectors(_n, _t).normalize();             // 宽方向
    const len = 0.7 + rnd() * 1.0;
    const w = 0.18 + rnd() * 0.16;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, len), matStripe);
    _m.makeBasis(_x, _n, _t); // X=宽, Y=法线(薄轴), Z=纹长
    stripe.setRotationFromMatrix(_m);
    stripe.position.copy(p).addScaledVector(_n, -0.02); // 半埋入肤，外面外探 ≈0.01
    addOutline(stripe, OUTLINE.characterDetail);
    bodyGroup.add(stripe);
  }

  /* ---------- 4. 黑色短靴四足：五棱柱腿 + 焦黑爪部 ---------- */
  /** @type {THREE.Group[]} */
  const legs = [];
  const legSlots = [
    { x: -0.92, z: 1.85, bend: 0.1 },
    { x: 0.92, z: 1.85, bend: -0.08 },
    { x: -0.98, z: -1.8, bend: -0.16 }, // 后肢微蹲（伏地蓄力）
    { x: 0.98, z: -1.8, bend: 0.14 },
  ];
  for (const slot of legSlots) {
    const leg = new THREE.Group();
    leg.position.set(slot.x, 1.45, slot.z);
    leg.rotation.x = slot.bend;
    const upper = tp(leg, new THREE.CylinderGeometry(0.34, 0.44, 1.25, 5), matSkin, OUTLINE.character);
    upper.position.y = -0.55;
    // 焦黑短靴爪部
    const boot = tp(leg, new THREE.CylinderGeometry(0.4, 0.46, 0.42, 5), matBoot, OUTLINE.character);
    boot.position.y = -1.28;
    // 腿部虎纹环 ×2
    for (const ry of [-0.35, -0.85]) {
      const ring = tp(leg, new THREE.CylinderGeometry(0.45, 0.45, 0.13, 5), matStripe, OUTLINE.characterDetail);
      ring.position.y = ry;
    }
    tigerGroup.add(leg);
    legs.push(leg);
  }

  /* ---------- 5. 流线型微翘长尾：3 段圆锥串联，总长 ≈ 身体 0.9 ---------- */
  const tailSegs = [];
  let parent = bodyGroup;
  const segSpecs = [
    { len: 2.3, r0: 0.36, r1: 0.26, lift: 0.1, z: -2.55, y: 0.25 },
    { len: 1.8, r0: 0.25, r1: 0.17, lift: 0.12, z: 0, y: 0 },
    { len: 1.4, r0: 0.16, r1: 0.07, lift: 0.35, z: 0, y: 0 }, // 尾尖上翘 ≈20°
  ];
  for (let i = 0; i < 3; i++) {
    const s = segSpecs[i];
    const seg = new THREE.Group();
    if (i === 0) seg.position.set(s.z * -0.0 + 0, s.y, s.z); // 尾根贴后臀
    else seg.position.set(0, 0, -segSpecs[i - 1].len * 0.88);
    seg.rotation.x = s.lift;
    const cone = tp(seg, new THREE.ConeGeometry(s.r1, s.len, 6), i === 2 ? matStripe : matSkin, OUTLINE.characterDetail);
    cone.rotation.x = -Math.PI / 2; // 尖端朝 -Z
    cone.position.z = -s.len / 2;
    parent.add(seg);
    tailSegs.push(seg);
    parent = seg;
  }
  // 尾环黑纹 ×2
  const ring1 = tp(tailSegs[1], new THREE.CylinderGeometry(0.17, 0.17, 0.16, 6), matStripe, OUTLINE.characterDetail);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.z = -0.5;
  const ring2 = tp(tailSegs[2], new THREE.CylinderGeometry(0.1, 0.1, 0.14, 6), matStripe, OUTLINE.characterDetail);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.z = -0.4;

  /* ---------- 实时动画接口 ---------- */
  const anim = {
    walkPhase: 0,
    headDown: 0, // 0 直立 → 1 饮水低头
  };

  tigerGroup.userData.update = function updateTiger(dt, t) {
    const walking = tigerGroup.userData._walking;
    if (walking) anim.walkPhase += dt * 7.5;
    const swing = walking ? Math.sin(anim.walkPhase) * 0.32 : 0;
    legs[0].rotation.x = legSlots[0].bend + swing;
    legs[1].rotation.x = legSlots[1].bend - swing;
    legs[2].rotation.x = legSlots[2].bend - swing * 0.8;
    legs[3].rotation.x = legSlots[3].bend + swing * 0.8;
    tigerGroup.position.y = (tigerGroup.userData._baseY || 0) + (walking ? Math.abs(Math.sin(anim.walkPhase)) * 0.09 : 0);
    // 尾：慢摆 + 尾尖呼吸
    tailSegs[0].rotation.y = Math.sin(t * 1.4) * 0.22;
    tailSegs[1].rotation.y = Math.sin(t * 1.4 + 0.7) * 0.18;
    tailSegs[2].rotation.x = segSpecs[2].lift + Math.sin(t * 2.2) * 0.06;
    // 饮水低头
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
 *  巡游 + 饮水行为状态机：大树间巡行 → 沿石阶下坑 → 饮水 → 返回
 *  roam: { rim: Vector3[], steps: Vector3[], drink: Vector3, speed? }
 * ------------------------------------------------------------------- */
function attachRoamBehavior(tiger, roam) {
  const speed = roam.speed ?? 2.4;
  const rim = roam.rim;
  const down = roam.steps;
  const up = [...down].reverse();
  let mode = "patrol";
  let wp = 0;
  let pause = 0;
  let drinkT = 0;

  const seek = (target, dt, arrive) => {
    const dx = target.x - tiger.position.x;
    const dz = target.z - tiger.position.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) return true;
    const step = Math.min(d, speed * dt);
    tiger.position.x += (dx / d) * step;
    tiger.position.z += (dz / d) * step;
    tiger.rotation.y = Math.atan2(dx, dz);
    return false;
  };

  tiger.userData._walking = false;
  tiger.userData._drinking = false;
  tiger.position.copy(rim[0]);
  tiger.userData._baseY = rim[0].y;

  const prevUpdate = tiger.userData.update;
  tiger.userData.update = function (dt, t) {
    if (tiger.userData.forceDrink && mode === "patrol") {
      mode = "to-steps";
      tiger.userData.forceDrink = false;
    }
    tiger.userData._walking = false;
    tiger.userData._drinking = false;
    if (mode === "patrol") {
      if (pause > 0) pause -= dt;
      else if (seek(rim[wp], dt, 0.8)) {
        pause = 1.2 + Math.random() * 1.6; // 树间停步嗅望
        wp = (wp + 1) % rim.length;
        if (wp === 0) mode = "to-steps"; // 巡一圈后去饮水
      } else tiger.userData._walking = true;
      tiger.userData._baseY = rim[0].y;
    } else if (mode === "to-steps") {
      if (seek(down[0], dt, 0.7)) mode = "descend";
      else tiger.userData._walking = true;
      tiger.userData._baseY = down[0].y;
    } else if (mode === "descend") {
      tiger.userData._walking = true;
      const cur = down[0];
      if (seek(cur, dt, 0.6)) down.shift();
      // 高度沿石阶平滑下探
      const ty = down.length ? down[0].y : roam.drink.y;
      tiger.userData._baseY += (ty - tiger.userData._baseY) * Math.min(1, dt * 3);
      if (!down.length) {
        mode = "drink";
        drinkT = 5 + Math.random() * 3;
        down.push(...up); // 复原上行路线
      }
    } else if (mode === "drink") {
      tiger.userData._drinking = true;
      drinkT -= dt;
      if (drinkT <= 0) mode = "ascend";
    } else if (mode === "ascend") {
      tiger.userData._walking = true;
      if (down.length && seek(down[0], dt, 0.6)) down.shift();
      const ty = down.length ? down[0].y : rim[0].y;
      tiger.userData._baseY += (ty - tiger.userData._baseY) * Math.min(1, dt * 3);
      if (!down.length) {
        mode = "patrol";
        wp = 1;
      }
    }
    tiger.userData._mode = mode;
    prevUpdate(dt, t);
  };
}
