// ============================================================================
//  苔庭之战 · 先锋重甲兵（Vanguard Trooper）—— Claude 2026-09-04
//
//  参考用户提供的概念图**形体**：整体式头盔 + 绿色护目镜带 + 口鼻面罩、
//  厚胸甲与肩甲、背后双板背包、大腿护板上一道红条、小腿护胫与厚靴；
//  右手持**激光刀**（暗柄 + 红色发光刃），左手持**闪电枪**（土黄枪身）。
//
//  这不是纸士兵的换皮：他们是随莫比斯 aircraft 一起出行的高级文明单位，
//  所以战斗数值是**不对称**的（用户 2026-09-04 定的）：
//    · 弓箭 20 支 / 标枪 10 支 才能损伤先锋兵一次
//    · 先锋兵的激光刀 1 刀 / 闪电枪 2 枪 就能损伤一名普通士兵
//  这条不对称正是"低级文明 vs 高级文明"这场仗的题眼，所以数值写成
//  VANGUARD_COMBAT 常量导出，测试直接读它，不许在别处硬编码第二份。
//
//  局部坐标：+Y 上、面朝 +Z。纯几何 + toonMat，无贴图。
// ============================================================================

import * as THREE from "three";
import { facet } from "../assets/lowPoly.js";
import { addOutline, toonMat } from "../assets/toon.js";

/**
 * 苔庭之战伤害口径（用户 2026-09-04 裁定）。
 * 命中数是**累计到一次损伤**所需的次数：达到即扣一次生命并重新计数。
 */
export const VANGUARD_COMBAT = Object.freeze({
  /** 打先锋兵：20 箭 = 1 次损伤 */
  arrowsPerWound: 20,
  /** 打先锋兵：10 标枪 = 1 次损伤 */
  javelinsPerWound: 10,
  /** 先锋兵打普通士兵：激光刀 1 刀 = 1 次损伤 */
  bladeHitsPerWound: 1,
  /** 先锋兵打普通士兵：闪电枪 2 枪 = 1 次损伤 */
  boltHitsPerWound: 2,
  /** 先锋兵生命值（可挨几次损伤） */
  vanguardLife: 3,
});

/** 一队的规模（用户要 20 个）。 */
export const VANGUARD_SQUAD_SIZE = 20;

const OUT = 0.012;

function part(geo, mat, outline = OUT) {
  const m = new THREE.Mesh(facet(geo), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (outline > 0) addOutline(m, outline);
  return m;
}
/** 发光件（刀刃 / 护目镜）：不参与描边，也不吃光 */
function glow(geo, color, opacity = 1) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1, opacity,
  }));
  m.renderOrder = 12;
  return m;
}

/**
 * 一名先锋重甲兵。整体高约 1.45（普通纸士兵约 1.33，略高一档但不出戏）。
 * @param {{scale?:number, seed?:number}} [opts]
 */
export function createVanguardTrooper({ scale = 1, seed = 0 } = {}) {
  const root = new THREE.Group();
  root.name = "vanguard-trooper";

  const plate = toonMat(0x4a4f55, { flatShading: true });      // 深灰装甲主色
  const plateLight = toonMat(0x8d8375, { flatShading: true }); // 卡其副板
  const under = toonMat(0x3a4550, { flatShading: true });      // 靛灰内衬
  const dark = toonMat(0x24282c, { flatShading: true });       // 关节/枪柄
  const tan = toonMat(0x9a8f6a, { flatShading: true });        // 枪身土黄
  const red = toonMat(0xb2402f, { flatShading: true });        // 大腿红条

  const fig = new THREE.Group();
  root.add(fig);

  // ---------- 躯干 ----------
  const torso = part(new THREE.BoxGeometry(0.34, 0.40, 0.22), plate);
  torso.position.y = 0.95;
  fig.add(torso);
  const chest = part(new THREE.BoxGeometry(0.30, 0.20, 0.06), plateLight, 0.008);
  chest.position.set(0, 1.03, 0.13);
  fig.add(chest);
  const belt = part(new THREE.BoxGeometry(0.36, 0.11, 0.24), dark, 0.008);
  belt.position.y = 0.72;
  fig.add(belt);
  // 腰挂弹匣袋：概念图腰间那几块小方板
  for (const sx of [-1, 1]) {
    const pouch = part(new THREE.BoxGeometry(0.09, 0.13, 0.07), plateLight, 0.006);
    pouch.position.set(sx * 0.14, 0.68, 0.11);
    fig.add(pouch);
  }

  // ---------- 背包：两片竖板 + 红色指示灯 ----------
  const packL = part(new THREE.BoxGeometry(0.13, 0.42, 0.14), plate, 0.008);
  packL.position.set(-0.10, 1.00, -0.20);
  fig.add(packL);
  const packR = part(new THREE.BoxGeometry(0.13, 0.36, 0.14), plate, 0.008);
  packR.position.set(0.10, 0.96, -0.21);
  packR.rotation.x = 0.06;
  fig.add(packR);
  const packLamp = glow(new THREE.BoxGeometry(0.035, 0.06, 0.02), 0xd8402c);
  packLamp.position.set(0.10, 1.06, -0.285);
  fig.add(packLamp);

  // ---------- 头盔 + 护目镜 + 面罩 ----------
  const head = new THREE.Group();
  head.position.y = 1.30;
  fig.add(head);
  const helm = part(new THREE.BoxGeometry(0.24, 0.22, 0.25), plate, 0.008);
  head.add(helm);
  const helmCrown = part(new THREE.BoxGeometry(0.20, 0.06, 0.16), plateLight, 0.006);
  helmCrown.position.set(0, 0.12, -0.01);
  head.add(helmCrown);
  // 绿色护目镜带（概念图最抢眼的一笔）
  const visor = glow(new THREE.BoxGeometry(0.21, 0.055, 0.03), 0x9ad13a);
  visor.position.set(0, 0.01, 0.13);
  head.add(visor);
  const visorFrame = part(new THREE.BoxGeometry(0.235, 0.075, 0.025), dark, 0);
  visorFrame.position.set(0, 0.01, 0.122);
  head.add(visorFrame);
  // 口鼻面罩 + 一道红识别条
  const mask = part(new THREE.BoxGeometry(0.15, 0.10, 0.08), plateLight, 0.006);
  mask.position.set(0, -0.09, 0.11);
  head.add(mask);
  const maskStripe = part(new THREE.BoxGeometry(0.155, 0.022, 0.012), red, 0);
  maskStripe.position.set(0, -0.055, 0.152);
  head.add(maskStripe);

  // ---------- 手臂：肩甲 + 上臂 + 前臂 ----------
  const arms = {};
  for (const [key, sx] of [["armL", 1], ["armR", -1]]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.21, 1.12, 0);
    fig.add(arm);
    const pauldron = part(new THREE.BoxGeometry(0.15, 0.13, 0.19), plate, 0.008);
    arm.add(pauldron);
    const upper = part(new THREE.BoxGeometry(0.11, 0.20, 0.12), under, 0.006);
    upper.position.y = -0.17;
    arm.add(upper);
    const fore = part(new THREE.BoxGeometry(0.10, 0.20, 0.11), plate, 0.006);
    fore.position.y = -0.36;
    arm.add(fore);
    const glove = part(new THREE.BoxGeometry(0.09, 0.09, 0.10), dark, 0.005);
    glove.position.y = -0.50;
    arm.add(glove);
    // 上臂三道识别环（概念图左臂那几道浅色箍）
    for (let i = 0; i < 3; i++) {
      const band = part(new THREE.BoxGeometry(0.115, 0.018, 0.125), plateLight, 0);
      band.position.y = -0.10 - i * 0.045;
      arm.add(band);
    }
    arms[key] = arm;
  }
  // 右臂前伸挥刀，左臂抬枪
  arms.armR.rotation.x = -1.05;
  arms.armR.rotation.z = -0.18;
  arms.armL.rotation.x = -2.35; // 左臂高举，枪口朝天（概念图的持枪姿）
  arms.armL.rotation.z = 0.34;

  // ---------- 腿：大腿护板（红条）+ 护膝 + 护胫 + 厚靴 ----------
  const legs = {};
  for (const [key, sx, lean] of [["legL", 1, 0.16], ["legR", -1, -0.20]]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.10, 0.70, 0);
    leg.rotation.x = lean;
    fig.add(leg);
    const thigh = part(new THREE.BoxGeometry(0.15, 0.26, 0.16), plateLight, 0.007);
    thigh.position.y = -0.14;
    leg.add(thigh);
    const stripe = part(new THREE.BoxGeometry(0.155, 0.05, 0.165), red, 0);
    stripe.position.y = -0.10;
    leg.add(stripe);
    const knee = part(new THREE.BoxGeometry(0.13, 0.09, 0.14), plate, 0.006);
    knee.position.y = -0.30;
    leg.add(knee);
    const shin = part(new THREE.BoxGeometry(0.12, 0.24, 0.13), under, 0.006);
    shin.position.y = -0.45;
    leg.add(shin);
    const boot = part(new THREE.BoxGeometry(0.14, 0.11, 0.20), plate, 0.007);
    boot.position.set(0, -0.60, 0.03);
    leg.add(boot);
    legs[key] = leg;
  }

  // ---------- 激光刀（右手）：暗柄 + 红色发光刃 + 外发光壳 ----------
  const blade = new THREE.Group();
  blade.name = "vanguard-laser-blade";
  const hilt = part(new THREE.CylinderGeometry(0.026, 0.030, 0.17, 6), dark, 0.005);
  hilt.rotation.z = Math.PI / 2;
  blade.add(hilt);
  const edge = glow(new THREE.BoxGeometry(0.62, 0.028, 0.028), 0xff3a22);
  edge.position.x = 0.39;
  blade.add(edge);
  const halo = glow(new THREE.BoxGeometry(0.62, 0.068, 0.068), 0xff7a4a, 0.30);
  halo.position.x = 0.39;
  blade.add(halo);
  blade.position.set(0, -0.54, 0.02);
  blade.rotation.z = -0.55; // 刀锋斜向前下，不是横着一根棍
  arms.armR.add(blade);

  // ---------- 闪电枪（左手）：土黄枪身 + 深色握把 + 枪口发光环 ----------
  const gun = new THREE.Group();
  gun.name = "vanguard-bolt-gun";
  const barrel = part(new THREE.BoxGeometry(0.075, 0.075, 0.62), tan, 0.006);
  barrel.position.z = 0.16;
  gun.add(barrel);
  const receiver = part(new THREE.BoxGeometry(0.085, 0.11, 0.20), dark, 0.005);
  receiver.position.z = -0.10;
  gun.add(receiver);
  const grip = part(new THREE.BoxGeometry(0.06, 0.14, 0.06), dark, 0.004);
  grip.position.set(0, -0.11, -0.12);
  gun.add(grip);
  const muzzle = glow(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8), 0x6fd8ff, 0.85);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.z = 0.47;
  gun.add(muzzle);
  gun.position.set(0, -0.54, 0.02);
  gun.rotation.x = 1.42;
  arms.armL.add(gun);

  root.userData.parts = { fig, torso, head, ...arms, ...legs, blade, gun };
  root.userData.unitClass = "vanguard-trooper";
  root.userData.combatant = true;
  root.userData.faction = "moebius";     // 与莫比斯 aircraft 同阵营
  root.userData.seed = seed;
  // 战斗账：达到阈值扣一次生命并清零，见 applyVanguardHit
  root.userData.arrowHits = 0;
  root.userData.javelinHits = 0;
  root.userData.wounds = 0;
  root.userData.life = VANGUARD_COMBAT.vanguardLife;
  root.scale.setScalar(scale);
  return root;
}

/**
 * 先锋兵挨打：累计到阈值才算一次损伤（20 箭 / 10 标枪），达到即清零。
 * 箭与标枪各记各的账——用户给的是两个独立口径，不是换算成同一种伤害点数。
 *
 * @param {THREE.Object3D} trooper
 * @param {"arrow"|"javelin"} kind
 * @returns {{wounded:boolean, dead:boolean, arrowHits:number, javelinHits:number, life:number}}
 */
export function applyVanguardHit(trooper, kind) {
  const u = trooper?.userData;
  if (!u || u.dead) {
    return { wounded: false, dead: !!u?.dead, arrowHits: u?.arrowHits ?? 0, javelinHits: u?.javelinHits ?? 0, life: u?.life ?? 0 };
  }
  let wounded = false;
  if (kind === "arrow") {
    u.arrowHits = (u.arrowHits || 0) + 1;
    if (u.arrowHits >= VANGUARD_COMBAT.arrowsPerWound) { u.arrowHits = 0; wounded = true; }
  } else if (kind === "javelin") {
    u.javelinHits = (u.javelinHits || 0) + 1;
    if (u.javelinHits >= VANGUARD_COMBAT.javelinsPerWound) { u.javelinHits = 0; wounded = true; }
  }
  if (wounded) {
    u.wounds = (u.wounds || 0) + 1;
    u.life = Math.max(0, (u.life ?? VANGUARD_COMBAT.vanguardLife) - 1);
    if (u.life <= 0) { u.dead = true; u.downed = true; }
  }
  return { wounded, dead: !!u.dead, arrowHits: u.arrowHits, javelinHits: u.javelinHits, life: u.life };
}

/**
 * 先锋兵打普通士兵：激光刀 1 刀 / 闪电枪 2 枪 造成一次损伤。
 * 只负责"够不够一次损伤"这个判断；真正扣血走 saihojiPhalanx 的
 * applySoldierDamage（那里才知道瘫倒/击杀阈值与事件日志）。
 *
 * @param {THREE.Object3D} soldier 普通士兵
 * @param {"blade"|"bolt"} weapon
 * @returns {boolean} 这一击是否构成一次损伤
 */
export function vanguardStrikeLands(soldier, weapon) {
  const u = soldier?.userData;
  if (!u || u.dead) return false;
  if (weapon === "blade") {
    u._vanguardBladeHits = (u._vanguardBladeHits || 0) + 1;
    if (u._vanguardBladeHits >= VANGUARD_COMBAT.bladeHitsPerWound) {
      u._vanguardBladeHits = 0;
      return true;
    }
    return false;
  }
  u._vanguardBoltHits = (u._vanguardBoltHits || 0) + 1;
  if (u._vanguardBoltHits >= VANGUARD_COMBAT.boltHitsPerWound) {
    u._vanguardBoltHits = 0;
    return true;
  }
  return false;
}

// ============================================================================
//  先锋兵中队：随莫比斯 aircraft 出行 → 苔庭之战落地参战
//
//  两个状态：
//    "aboard"   跟着机队飞（挂在 squad 下，每帧按成员位姿排成两列）
//    "deployed" 落在苔庭地面，向最近的普通士兵挥刀 / 开枪
//  没有寻路、没有状态机嵌套——这是一支布景性质的精锐小队，
//  它存在的意义是把"高级文明"的数值不对称摆到画面上。
// ============================================================================

const _vtA = new THREE.Vector3();
const _vtB = new THREE.Vector3();
const _vtQ = new THREE.Quaternion();
const _vtUp = new THREE.Vector3();
const _vtFwd = new THREE.Vector3();
const _vtSide = new THREE.Vector3();
const _vtBasis = new THREE.Matrix4();

/** 确定性哈希：出手节奏错相用，禁止 Math.random */
function vtHash(a, b = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) / 4294967296;
}

/**
 * 造一支先锋兵中队。
 * @param {{count?:number, scale?:number}} [opts]
 */
export function createVanguardSquad({ count = VANGUARD_SQUAD_SIZE, scale = 1 } = {}) {
  const root = new THREE.Group();
  root.name = "vanguard-squad";
  const troopers = [];
  for (let i = 0; i < count; i++) {
    const t = createVanguardTrooper({ scale, seed: i });
    t.userData.uid = i;
    // 出手节奏错相：不然 20 个人整齐划一地挥刀，像广播体操
    t.userData._swingPhase = vtHash(i, 17) * 1.6;
    t.userData._boltPhase = vtHash(i, 91) * 1.1;
    troopers.push(t);
    root.add(t);
  }
  root.userData.troopers = troopers;
  root.userData.state = "aboard";
  root.visible = false; // 未随队出行/未落地前不出现
  return root;
}

/**
 * 「aboard」阵位：跟着机队飞，排成机腹下的两列。
 * 与 gatePodCraft 的伴飞同一个理由——**每帧跟位而不是挂成子节点**，
 * 免得吃到机队成员的 P.aircraftScale 缩放。
 */
export function updateVanguardAboard(squadRoot, aircraftSquad, t = 0) {
  if (!squadRoot || squadRoot.userData.state !== "aboard") return;
  const members = aircraftSquad?.userData?.members || [];
  if (!members.length) { squadRoot.visible = false; return; }
  squadRoot.visible = true;
  const troopers = squadRoot.userData.troopers;
  squadRoot.updateWorldMatrix(true, false);
  const inv = squadRoot.matrixWorld.clone().invert();

  troopers.forEach((tr, i) => {
    const host = members[i % members.length];
    if (!host?.parent) { tr.visible = false; return; }
    tr.visible = true;
    host.getWorldPosition(_vtA);
    host.getWorldQuaternion(_vtQ);
    _vtUp.set(0, 1, 0).applyQuaternion(_vtQ).normalize();
    _vtFwd.set(0, 0, 1).applyQuaternion(_vtQ).normalize();
    _vtSide.crossVectors(_vtFwd, _vtUp).normalize();
    const rank = Math.floor(i / members.length); // 第几排
    const col = (i % 2 === 0 ? 1 : -1);
    _vtB.copy(_vtA)
      .addScaledVector(_vtSide, col * (2.4 + rank * 0.9))
      .addScaledVector(_vtUp, -4.6 - Math.sin(t * 0.8 + i) * 0.18)
      .addScaledVector(_vtFwd, -rank * 2.2);
    tr.position.copy(_vtB).applyMatrix4(inv);
    tr.quaternion.copy(_vtQ);
  });
}

/**
 * 落地展开：在 hubDir 指的球面点周围排成两列横队。
 * @param {THREE.Group} squadRoot
 * @param {THREE.Vector3} hubDir 苔庭方向（单位向量）
 * @param {number} groundRadius 落脚半径（球心到地面）
 */
export function deployVanguardSquad(squadRoot, hubDir, groundRadius) {
  if (!squadRoot || !hubDir) return;
  squadRoot.userData.state = "deployed";
  squadRoot.visible = true;
  const troopers = squadRoot.userData.troopers;
  const up = hubDir.clone().normalize();
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), up);
  if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
  east.normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  const perRow = Math.ceil(troopers.length / 2);

  troopers.forEach((tr, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = (col - (perRow - 1) / 2) * 1.5;
    const z = row * 1.8 - 0.9;
    const pos = up.clone().multiplyScalar(groundRadius)
      .addScaledVector(east, x)
      .addScaledVector(north, z);
    tr.position.copy(pos);
    // 站正：局部 +Y 对齐径向，面朝 north
    _vtBasis.makeBasis(east, up, north);
    tr.quaternion.setFromRotationMatrix(_vtBasis);
    tr.visible = true;
  });
}

/**
 * 落地后每帧：向最近的普通士兵出手。
 * 激光刀近身（< bladeRange），闪电枪远射（< boltRange）。
 * 判定只调 vanguardStrikeLands；真正扣血交给调用方的 onWound
 * （saihojiPhalanx 的 applySoldierDamage 才知道瘫倒/击杀阈值与事件日志）。
 *
 * @param {THREE.Group} squadRoot
 * @param {number} dt
 * @param {number} t
 * @param {{soldiers?:THREE.Object3D[], onWound?:(s:THREE.Object3D, weapon:string, trooper:THREE.Object3D)=>void,
 *          bladeRange?:number, boltRange?:number, swingPeriod?:number, boltPeriod?:number}} [opts]
 * @returns {{blade:number, bolt:number, wounds:number}} 本帧出手统计
 */
export function updateVanguardCombat(squadRoot, dt, t, opts = {}) {
  const stats = { blade: 0, bolt: 0, wounds: 0 };
  if (!squadRoot || squadRoot.userData.state !== "deployed") return stats;
  const {
    soldiers = [],
    onWound = null,
    bladeRange = 2.6,
    boltRange = 14,
    swingPeriod = 1.1,
    boltPeriod = 0.75,
  } = opts;
  const live = soldiers.filter((s) => s?.parent && !s.userData?.dead);
  if (!live.length) return stats;

  for (const tr of squadRoot.userData.troopers) {
    if (!tr.visible || tr.userData.dead) continue;
    tr.getWorldPosition(_vtA);
    // 最近目标
    let best = null;
    let bestD = Infinity;
    for (const s of live) {
      s.getWorldPosition(_vtB);
      const d = _vtA.distanceToSquared(_vtB);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best) continue;
    const dist = Math.sqrt(bestD);

    // 刀：近身节奏
    tr.userData._swingT = (tr.userData._swingT || tr.userData._swingPhase || 0) + dt;
    if (dist <= bladeRange && tr.userData._swingT >= swingPeriod) {
      tr.userData._swingT = 0;
      stats.blade++;
      if (vanguardStrikeLands(best, "blade")) {
        stats.wounds++;
        onWound?.(best, "blade", tr);
      }
      // 挥刀动作：右臂摆一下（纯表现，下一帧回位）
      const armR = tr.userData.parts?.armR;
      if (armR) armR.rotation.x = -1.55;
    } else {
      const armR = tr.userData.parts?.armR;
      if (armR) armR.rotation.x += (-1.05 - armR.rotation.x) * Math.min(1, dt * 6);
    }

    // 枪：远射节奏（近身时不开枪，避免同一帧双重打击）
    tr.userData._boltT = (tr.userData._boltT || tr.userData._boltPhase || 0) + dt;
    if (dist > bladeRange && dist <= boltRange && tr.userData._boltT >= boltPeriod) {
      tr.userData._boltT = 0;
      stats.bolt++;
      if (vanguardStrikeLands(best, "bolt")) {
        stats.wounds++;
        onWound?.(best, "bolt", tr);
      }
    }
  }
  return stats;
}

/** 中队里还站着的人数（供 UI / 测试读） */
export function vanguardAliveCount(squadRoot) {
  const troopers = squadRoot?.userData?.troopers || [];
  return troopers.filter((t) => !t.userData.dead).length;
}
