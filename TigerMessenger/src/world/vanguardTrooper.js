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
  /**
   * 打先锋兵：15 刀 = 1 次损伤（主人 2026-09-05"被攻击就反击"补的新口径）。
   * 比标枪（10）还钝——红盔/蓝盔的短剑砍在重甲上几乎无效，代差感就在这里：
   * 士兵会**踊跃扑上去**，但砍半天砍不倒，反过来被 1 刀 1 个。
   */
  meleeHitsPerWound: 15,
  /** 先锋兵打普通士兵：激光刀 1 刀 = 1 次损伤 */
  bladeHitsPerWound: 1,
  /** 先锋兵打普通士兵：闪电枪 2 枪 = 1 次损伤 */
  boltHitsPerWound: 2,
  /** 先锋兵生命值（可挨几次损伤） */
  vanguardLife: 3,
});

/**
 * 一队的规模（主人 2026-09-05 修订：24 个编制位）：
 * 22 = 20 名战斗（2 组 × 10 三三制）+ 2 名看护（留守飞行器旁）。
 * 乘坐：GatePodCraft 3 台各索降 2 名（6），gateHaulerCraft 3 台各卸 6 名（18 容量，
 * 实载 16：6/6/4，末艇差额让给"比 20 多出的看护"口径）。战斗队形仍是 2 × 10。
 */
export const VANGUARD_SQUAD_SIZE = 27;

/**
 * 花名册版图（主人 2026-09-06 定的舰队编成）——**唯一真相**。
 *
 *   uid  0.. 5：泡机突击兵。3 台 × 2 名，每台一前一后（前后型快速突击）
 *   uid  6..26：登陆艇兵。3 艘 × 7 名，每艘第 7 名（seat 6）留守看护
 *
 * 谁上哪台车、坐第几个位子，全部由 uid 一次算出。这不是为了好看：撤离时
 * 「回自己乘来的那艘艇」、回收时「谁归哪台泡机的绳子」都要靠这个映射，
 * 旧口径把看护定义成「uid ≥ 20」，跟载具无关，于是这两件事永远对不上号。
 *
 * @param {number} uid
 * @returns {{kind:"pod"|"hauler", vehicle:number, seat:number, lead:boolean, guard:boolean}}
 */
export function vanguardRosterSlot(uid) {
  const i = Math.max(0, uid | 0);
  const podSeats = VANGUARD_FORMATION.assaultPods * VANGUARD_FORMATION.perAssaultPod; // 6
  if (i < podSeats) {
    const seat = i % VANGUARD_FORMATION.perAssaultPod;
    return {
      kind: "pod",
      vehicle: Math.floor(i / VANGUARD_FORMATION.perAssaultPod),
      seat,
      lead: seat === 0,   // 前位：突击对里冲在前面的那个
      guard: false,
    };
  }
  const k = i - podSeats;
  const per = VANGUARD_FORMATION.perHaulerSeats; // 7
  const seat = k % per;
  return {
    kind: "hauler",
    vehicle: Math.floor(k / per),
    seat,
    lead: seat === 0,     // 每艇第一个人当组长
    guard: seat === per - 1, // 最后一个位子＝留守看护
  };
}

/**
 * 闪电炮的**充电—放电**模型（主人 2026-09-04：「别上来一顿突突，要出现充电过程，
 * 让战斗出现悬念」）。
 *
 * 这不是给开火加个 cooldown 就完事。真正让画面出现悬念的是三件事：
 *   ① **充电可见**：枪口先亮起来、越来越亮，观众知道"要放了"，也知道**还没放**；
 *   ② **命中率跟充电度走**：没充满就放 = 大概率打空。所以士兵有机会在充电窗口里
 *      移动、举盾、冲上来——战斗才有来回，而不是单方面点名；
 *   ③ **放电是一瞬**：0.18s 的弧光，不是持续光束。持续光束会让"2 炮毙命"变成秒杀扫射。
 *
 * 四个阶段循环：idle → charging(chargeTime) → discharge(dischargeTime) → cooldown(cooldown)
 */
export const VANGUARD_BOLT = Object.freeze({
  /** 充电时长（秒）：这段时间枪口辉光从 0 涨到 1 */
  chargeTime: 1.55,
  /** 放电时长（秒）：弧光可见的一瞬 */
  dischargeTime: 0.18,
  /** 放电后的冷却（秒） */
  cooldown: 0.85,
  /** 满充命中率（近距离） */
  hitFull: 0.86,
  /** 零充命中率（被打断/抢射时的下限）——主人 2026-09-06 抬到 0.25，远距脱靶更少见 */
  hitEmpty: 0.25,
  /** 命中率随距离衰减到一半的距离（主人 2026-09-06：射程拉到 500m，halfRange 同步抬到 280） */
  halfRange: 280,
  /** 最大射程（超出不开火）——主人 2026-09-06 拉到 500m，让空中飞行的攻击者进入射程 */
  maxRange: 500,
  /** 对威胁目标「超距则逼近」停下开火的水平接战距离（米，切平面投影） */
  engageHoriz: 50,
  /** 光圈弹丸飞行速度（米/秒）：放慢到肉眼能看清青色光环划过弹道（主人 2026-09-05） */
  ringSpeed: 30,
  /** 弧光折线段数（放电函数的采样数，弧光已由光圈弹取代，常量保留兼容） */
  arcSegments: 9,
  /** 弧光横向抖动幅度（相对射程的比例） */
  arcJitter: 0.075,
  /** 2 炮毙命——与 VANGUARD_COMBAT.boltHitsPerWound 同一个数，别写第二份 */
  get shotsToKill() { return 2; },
});

/**
 * 编成（主人 2026-09-04）：20 人 = **2 组 × 10**；
 * 每组 = **1 名组长 + 3 个三人子小组**（三三制）。
 */
export const VANGUARD_FORMATION = Object.freeze({
  // 三三制的最小单位是**三人小组**。一艘登陆艇下 6 名参战兵 = 2 个三人小组，
  // 三艘艇就是 3 组 × 2 小组 = 18 人。按艇分组而不是按人数硬切，
  // 是为了让「哪条艇下来的人、撤离时回哪条艇」在编成上就成立。
  groups: 3,          // 一艇一组
  perGroup: 6,        // 每艇参战 6（第 7 名留守看护，不进阵型）
  teamsPerGroup: 2,
  perTeam: 3,
  /** 每艘登陆艇的实际座位数（含那名留守看护） */
  perHaulerSeats: 7,
  /** 泡机突击对：3 台 × 2 名，不进三三制方阵，另走前后型突击 */
  assaultPods: 3,
  perAssaultPod: 2,
  /** 突击对前出距离（米）：压在三三制阵列前方，先接敌 */
  assaultLead: 7.5,
  /** 突击对内前后两人的间距（米） */
  assaultPairGap: 2.6,
  /** 推进速度（米/秒）——「缓慢沉稳推进」，比普通士兵慢一截 */
  advanceSpeed: 0.85,
  /** 子小组三角的边长 */
  teamSpacing: 1.5,
  /** 子小组之间的间距 */
  teamGap: 4.2,
  /** 两个组之间的间距 */
  groupGap: 9.0,
});

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
 * @param {"arrow"|"javelin"|"melee"} kind
 * @returns {{wounded:boolean, dead:boolean, arrowHits:number, javelinHits:number, meleeHits:number, life:number}}
 */
export function applyVanguardHit(trooper, kind) {
  const u = trooper?.userData;
  if (!u || u.dead) {
    return { wounded: false, dead: !!u?.dead, arrowHits: u?.arrowHits ?? 0, javelinHits: u?.javelinHits ?? 0, meleeHits: u?.meleeHits ?? 0, life: u?.life ?? 0 };
  }
  let wounded = false;
  if (kind === "arrow") {
    u.arrowHits = (u.arrowHits || 0) + 1;
    if (u.arrowHits >= VANGUARD_COMBAT.arrowsPerWound) { u.arrowHits = 0; wounded = true; }
  } else if (kind === "javelin") {
    u.javelinHits = (u.javelinHits || 0) + 1;
    if (u.javelinHits >= VANGUARD_COMBAT.javelinsPerWound) { u.javelinHits = 0; wounded = true; }
  } else if (kind === "melee") {
    // 红盔/蓝盔的刀砍重甲：15 刀才 1 次损伤（代差）
    u.meleeHits = (u.meleeHits || 0) + 1;
    if (u.meleeHits >= VANGUARD_COMBAT.meleeHitsPerWound) { u.meleeHits = 0; wounded = true; }
  }
  if (wounded) {
    u.wounds = (u.wounds || 0) + 1;
    u.life = Math.max(0, (u.life ?? VANGUARD_COMBAT.vanguardLife) - 1);
    if (u.life <= 0) { u.dead = true; u.downed = true; }
  }
  return { wounded, dead: !!u.dead, arrowHits: u.arrowHits, javelinHits: u.javelinHits, meleeHits: u.meleeHits ?? 0, life: u.life };
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
const _vtC = new THREE.Vector3();
const _vtD = new THREE.Vector3();
const _vtE = new THREE.Vector3();
const _vtF = new THREE.Vector3();
const _vtG = new THREE.Vector3();
const _vtH = new THREE.Vector3();
const _vtQ = new THREE.Quaternion();
const _vtUp = new THREE.Vector3();
const _vtFwd = new THREE.Vector3();
const _vtSide = new THREE.Vector3();
const _vtBasis = new THREE.Matrix4();

/** 确定性哈希：出手节奏错相用，禁止 Math.random */
function vtHash(a, b = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  // ⚠️ 末次位运算返回有符号 int32，需 >>> 0 回正（否则负 roll → 命中骰恒真）
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * 造一支先锋兵中队。
 * @param {{count?:number, scale?:number}} [opts]
 */
/**
 * 军服糊成土黄（主人 2026-09-06：重甲兵「拉出去后，军服变成土黄色」）。
 *
 * 做法是**换材质引用**，不是改颜色值：`toonMat` 是按 (颜色, 选项) 缓存的，
 * 全场 27 名重甲兵共用同一批材质实例，直接 `material.color.set(...)`
 * 会把没被吞的人也一起染了。
 *
 * 换过去的那一套同样走 toonMat 缓存——所以无论多少人被吞过，
 * 全场也只多出这四个材质实例，draw call 不涨。
 * 只染军服（装甲主色 / 卡其副板 / 内衬 / 大腿红条），
 * 关节和枪身不动：那是装备，不是军服。
 */
let _soilMap = null;
function soilMap() {
  if (_soilMap) return _soilMap;
  const opt = { flatShading: true };
  _soilMap = new Map([
    [toonMat(0x4a4f55, opt), toonMat(0x8a7434, opt)], // 深灰装甲 → 土黄
    [toonMat(0x8d8375, opt), toonMat(0xa89250, opt)], // 卡其副板 → 更黄
    [toonMat(0x3a4550, opt), toonMat(0x6b5a2c, opt)], // 靛灰内衬 → 土褐
    [toonMat(0xb2402f, opt), toonMat(0x8a6a34, opt)], // 大腿红条 → 一并糊掉
  ]);
  return _soilMap;
}

/**
 * @param {THREE.Object3D} trooper 一名重甲兵
 * @returns {boolean} 是否真的染上了（已经染过的返回 false）
 */
export function soilVanguardUniform(trooper) {
  if (!trooper || trooper.userData?.uniformSoiled) return false;
  const map = soilMap();
  trooper.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const next = map.get(o.material);
    if (next) o.material = next;
  });
  trooper.userData.uniformSoiled = true;
  return true;
}

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
 * @param {(dir:THREE.Vector3)=>number} [groundHeightAt] 苔庭地表采样（逐人贴地）。
 *   传入时每人按各自方向的真实地表半径落地；不传则统一压到 groundRadius 球面。
 */
export function deployVanguardSquad(squadRoot, hubDir, groundRadius, groundHeightAt = null) {
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
    // 2026-09-05 修复「站在树顶」：旧公式 up*gr + east*x + north*z 的模长是
    // √(gr²+x²+z²) > gr——横队一展开整排人被抬离地表；苔庭苔丘又是起伏地形，
    // 20 人共用一次 hub 采样 + 这个浮高，画面上就是全队悬在树冠上。
    // 现在先把展开点**归一化回球面**，再按各自方向的真实地表半径落地。
    const dir = up.clone().multiplyScalar(groundRadius)
      .addScaledVector(east, x)
      .addScaledVector(north, z)
      .normalize();
    const r = groundHeightAt ? groundHeightAt(dir) : groundRadius;
    tr.position.copy(dir).multiplyScalar(r);
    // 站正：局部 +Y 对齐径向，面朝 north
    _vtBasis.makeBasis(east, up, north);
    tr.quaternion.setFromRotationMatrix(_vtBasis);
    tr.visible = true;
  });
}

/**
 * 落地后每帧：向最近的普通士兵出手。
 * 激光刀近身（< bladeRange）→ bladeVsShield：有盾先劈盾，无盾 1 刀=1 损伤；
 * 闪电炮远射（bladeRange < dist ≤ boltRange）→ 充电—放电状态机：
 * 充电可见（枪口辉光随 charge 变亮）、命中率随充电度走、放电是一瞬的折线弧光。
 *
 * 判定只调 vanguardStrikeLands / bladeVsShield；真正扣血交给调用方的 onWound
 * （saihojiPhalanx 的 applySoldierDamage 才知道瘫倒/击杀阈值与事件日志）。
 *
 * @param {THREE.Group} squadRoot
 * @param {number} dt
 * @param {number} t
 * @param {{soldiers?:THREE.Object3D[], prefer?:THREE.Object3D[], onWound?:(s:THREE.Object3D, weapon:string, trooper:THREE.Object3D)=>void,
 *          onBoltArc?:(from:THREE.Vector3, to:THREE.Vector3, hit:boolean)=>void,
 *          onShieldBroken?:(s:THREE.Object3D, trooper:THREE.Object3D)=>void,
 *          bladeRange?:number, boltRange?:number, swingPeriod?:number}} [opts]
 * @returns {{blade:number, bolt:number, wounds:number}} 本帧出手统计
 */
export function updateVanguardCombat(squadRoot, dt, t, opts = {}) {
  const stats = { blade: 0, bolt: 0, wounds: 0 };
  const {
    soldiers = [],
    prefer = [],   // 优先打击名单：正在攻击莫比斯机队的攻击者（主人 2026-09-05）
    onWound = null,
    onBoltArc = null,
    onShieldBroken = null,
    bladeRange = 3,
    boltRange = VANGUARD_BOLT.maxRange,
    swingPeriod = 0.7,
  } = opts;
  if (!squadRoot || squadRoot.userData.state !== "deployed") {
    advanceBoltRings(squadRoot, dt, stats, onWound); // 空中光圈继续飞完
    return stats;
  }
  advanceBoltRings(squadRoot, dt, stats, onWound);
  const live = soldiers.filter((s) => s?.parent && !s.userData?.dead && !s.userData?.downed);
  if (!live.length) return stats;
  // 主人 2026-09-05：谁在打机队就先打谁——瞄准、面对、近战、开火全锁定优先名单；
  // 名单清空（攻击者全灭）才回落"最近红盔"的旧口径。
  const preferLive = prefer.filter((s) => s?.parent && !s.userData?.dead);
  const pool = preferLive.length ? preferLive : live;

  for (const tr of squadRoot.userData.troopers) {
    if (!tr.visible || tr.userData.dead) continue;
    if (tr.userData.onGround === false) continue; // 索降/攀绳中不出手（assault 模块置位）
    tr.getWorldPosition(_vtA);
    // 最近目标（优先名单池内）
    let best = null;
    let bestD = Infinity;
    for (const s of pool) {
      s.getWorldPosition(_vtB);
      const d = _vtA.distanceToSquared(_vtB);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best) continue;
    const dist = Math.sqrt(bestD);

    // 主人 2026-09-06：威胁目标（正在攻击机队的生物/红盔）超距则主动逼近。
    // 之前重甲兵站着不追，光圈弹永远够不着天上的攻击者。用「水平距离」（切平面投影）
    // 判据——攻击者盘旋高空时重甲兵朝其正下方走，走到接近水平阈值即停，
    // 此时欧氏 dist 落入拉大后的射程（maxRange=500），闪电枪才真正开火。
    if (preferLive.length && preferLive.includes(best)) {
      _vtE.copy(_vtA).normalize();                   // 自身径向
      _vtH.copy(_vtB).sub(_vtA);                     // 指向目标（世界）
      _vtH.addScaledVector(_vtE, -_vtH.dot(_vtE));   // 剥去径向 → 水平分量
      const horiz = _vtH.length();
      if (horiz > VANGUARD_BOLT.engageHoriz) {
        _vtH.normalize();
        const r0 = tr.position.length();
        tr.position.addScaledVector(_vtH, VANGUARD_FORMATION.advanceSpeed * dt);
        tr.position.normalize().multiplyScalar(r0);  // 贴回球面，保持行走高度
      }
    }

    // 瞄准（主人 2026-09-05：远距离激光炮要瞄准的）：接敌即转身面对目标
    if (dist <= boltRange) {
      _vtE.copy(_vtA).normalize();                 // 径向
      _vtF.copy(_vtB).sub(_vtA);                   // 指向目标
      _vtF.addScaledVector(_vtE, -_vtF.dot(_vtE)); // 投回切平面
      if (_vtF.lengthSq() > 1e-8) {
        _vtF.normalize();
        _vtSide.crossVectors(_vtF, _vtE).normalize();
        _vtBasis.makeBasis(_vtSide, _vtE, _vtF);
        tr.quaternion.setFromRotationMatrix(_vtBasis);
      }
    }

    // 激光刀：近身挥砍（有 0.38s 的举刀→劈落弧线，不是一帧摆 pose）
    const armR = tr.userData.parts?.armR;
    const armL = tr.userData.parts?.armL;
    const torso = tr.userData.parts?.torso;
    tr.userData._swingT = (tr.userData._swingT || tr.userData._swingPhase || 0) + dt;
    if (dist <= bladeRange && tr.userData._swingT >= swingPeriod) {
      tr.userData._swingT = 0;
      tr.userData._swingAnim = 0; // 启动劈砍动画
      stats.blade++;
      const vs = bladeVsShield(best);
      if (vs.shieldBroken) {
        best.userData.shieldBroken = true; // 记账：调用方摘盾网格 + 记事件
        onShieldBroken?.(best, tr);
      } else if (vanguardStrikeLands(best, "blade")) {
        stats.wounds++;
        onWound?.(best, "blade", tr);
      }
    }
    // 劈砍动画推进（主人 2026-09-05：3 米内格杀要快——0.25s 完成举刀→劈落）
    const anim = tr.userData._swingAnim;
    if (anim !== undefined && anim < 1) {
      tr.userData._swingAnim = Math.min(1, anim + dt / 0.25);
      const k = tr.userData._swingAnim;
      const s = k < 0.3 ? -2.35 * (k / 0.3) : THREE.MathUtils.lerp(-2.35, 0.55, (k - 0.3) / 0.7);
      if (armR) armR.rotation.x = s;
      if (torso) torso.rotation.y = Math.sin(k * Math.PI) * 0.55;
    } else {
      if (armR) armR.rotation.x += (-1.05 - armR.rotation.x) * Math.min(1, dt * 8);
      if (torso) torso.rotation.y += (0 - torso.rotation.y) * Math.min(1, dt * 6);
    }

    // 闪电炮：充电—放电（充电时举枪瞄准，枪口辉光随 charge 变亮）
    const wantFire = dist > bladeRange && dist <= boltRange;
    const bolt = updateBoltCharge(tr, dt, wantFire);
    const gun = tr.userData.parts?.gun;
    if (gun) {
      const k = 1 + bolt.charge * 0.32 + (bolt.phase === "discharge" ? 0.38 : 0);
      gun.scale.setScalar(k);
    }
    if (armL) {
      if (bolt.phase === "charging" || bolt.phase === "discharge") {
        armL.rotation.x += (-1.38 - armL.rotation.x) * Math.min(1, dt * 7); // 举枪平指
      } else {
        armL.rotation.x += (0 - armL.rotation.x) * Math.min(1, dt * 4);
      }
    }
    if (bolt.fired) {
      stats.bolt++;
      best.getWorldPosition(_vtB);
      // 确定性命中骰：同一发弹重放必须同结果（禁 Math.random）
      tr.userData._boltShots = (tr.userData._boltShots || 0) + 1;
      const roll = vtHash((tr.userData.uid ?? 0) + 1, tr.userData._boltShots * 7 + 3);
      const hit = roll < boltHitChance(1, dist);
      // 目标点：命中→胸口；脱靶→切向偏移一点（观众看得出"这一炮空了"）
      const to = _vtC.copy(_vtB);
      if (!hit) {
        _vtD.copy(to).sub(_vtA).normalize();
        _vtG.copy(to).normalize();
        _vtF.crossVectors(_vtD, _vtG);
        if (_vtF.lengthSq() < 1e-6) _vtF.set(1, 0, 0);
        _vtF.normalize();
        const side = vtHash((tr.userData.uid ?? 0) + 1, tr.userData._boltShots * 13 + 5) > 0.5 ? 1 : -1;
        const amp = 1.0 + 1.1 * vtHash((tr.userData.uid ?? 0) + 1, tr.userData._boltShots * 17 + 7);
        to.addScaledVector(_vtF, side * amp);
      }
      // 主人 2026-09-05：闪电改为**光圈**弹丸——可见的青色光环从枪口飞向目标
      vanguardMuzzleWorld(tr, _vtG);
      fireBoltRing(squadRoot, _vtG.clone(), to.clone(), best, hit, tr);
    }
  }

  // 光圈弹丸已在函数开头推进过（此前开头+结尾各推一次 = 实速翻倍，
  // 主人 2026-09-05 "光圈打太快"的另一半根源），不再重复。
  return stats;
}

/**
 * 闪电炮光圈弹丸：发射一发光环（池化，挂 squadRoot 下）。
 */
function fireBoltRing(squadRoot, from, to, target, hit, trooper) {
  const pool = boltRingPool(squadRoot);
  const ring = pool.find((r) => !r.visible);
  if (!ring) return;
  ring.visible = true;
  ring.position.copy(from);
  const flight = squadRoot.userData._boltRingsInFlight;
  flight.push({ ring, from: from.clone(), to: to.clone(), target, hit, trooper, t: 0 });
}

/** 萤火虫光斑纹理（懒建一次：白心 → 萤黄 → 透明径向渐变） */
let _fireflyTex = null;
/**
 * 萤火光点贴图（径向渐变，加色混合用）。
 * 2026-09-06 导出：泡机的麻醉弹也要这层光晕，两处必须是同一个视觉语汇——
 * 各画各的迟早会漂成两种萤火。
 */
export function fireflyTexture() {
  if (_fireflyTex) return _fireflyTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,225,1)");
  grad.addColorStop(0.25, "rgba(232,255,165,0.9)");
  grad.addColorStop(0.55, "rgba(185,242,115,0.35)");
  grad.addColorStop(1, "rgba(140,220,90,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  _fireflyTex = new THREE.CanvasTexture(c);
  return _fireflyTex;
}

/**
 * 光圈弹挂萤火虫（主人 2026-09-05）：一粒黄绿光晕 + 三粒火星绕环飞舞，
 * 加色混合 + 呼吸闪烁——飞行中的光圈像一团萤火虫拖着光。
 */
function attachFireflies(ring) {
  const mat = () => new THREE.SpriteMaterial({
    map: fireflyTexture(),
    color: 0xd8ffb0,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Sprite(mat());
  halo.scale.setScalar(0.9);
  ring.add(halo);
  const sparks = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Sprite(mat());
    sp.scale.setScalar(0.14);
    ring.add(sp);
    sparks.push({ sp, phase: i * 2.09, r: 0.28 + 0.09 * (i % 2) });
  }
  ring.userData.fireflies = { halo, sparks };
}

/** 光圈弹丸池 + 飞行清单（挂 squadRoot，懒建） */
function boltRingPool(squadRoot) {
  let pool = squadRoot.userData._boltRingPool;
  if (!pool) {
    pool = [];
    for (let i = 0; i < 14; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.055, 8, 18),
        new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.95, depthWrite: false })
      );
      ring.visible = false;
      ring.frustumCulled = false;
      attachFireflies(ring);
      squadRoot.add(ring);
      pool.push(ring);
    }
    squadRoot.userData._boltRingPool = pool;
    squadRoot.userData._boltRingFlight = [];
  }
  if (!squadRoot.userData._boltRingsInFlight) squadRoot.userData._boltRingsInFlight = [];
  return pool;
}

/**
 * 光圈弹丸推进：追踪目标胸口（微上飘），命中/到点结算。
 * 命中瞬间才走 vanguardStrikeLands → onWound（2 炮毙命口径不变）。
 */
function advanceBoltRings(squadRoot, dt, stats, onWound) {
  const flight = squadRoot.userData._boltRingsInFlight;
  if (!flight) return;
  const speed = VANGUARD_BOLT.ringSpeed;
  for (let i = flight.length - 1; i >= 0; i--) {
    const s = flight[i];
    s.t += dt;
    const alive = s.target?.parent && !s.target.userData.dead;
    const tp = alive
      ? s.target.getWorldPosition(_vtC).clone().addScaledVector(_vtD.set(0, 1, 0), 0.75)
      : s.to;
    // 追踪飞行：每帧朝目标当前位置修正（光圈会"咬"住移动目标）
    _vtE.copy(tp).sub(s.ring.position);
    const dist = _vtE.length();
    const step = Math.min(dist, speed * dt);
    if (dist > 1e-4) {
      _vtE.normalize();
      s.ring.position.addScaledVector(_vtE, step);
      // 光圈正对飞行方向（环面垂直于弹道）
      _vtF.set(0, 0, 1);
      s.ring.quaternion.setFromUnitVectors(_vtF, _vtE);
    }
    // 萤火虫：光晕呼吸明暗 + 火星绕环飞舞、脉动闪烁
    const ff = s.ring.userData.fireflies;
    if (ff) {
      const tw = 0.55 + 0.45 * Math.sin(s.t * 6.5); // 黄绿微光呼吸
      ff.halo.material.opacity = 0.35 + 0.5 * tw;
      ff.halo.scale.setScalar(0.7 + 0.35 * tw);
      for (const k of ff.sparks) {
        const a = s.t * 5.2 + k.phase;
        k.sp.position.set(Math.cos(a) * k.r, Math.sin(a) * k.r, 0);
        const fl = Math.sin(s.t * 9.3 + k.phase * 3.1);
        k.sp.material.opacity = 0.3 + 0.65 * fl * fl; // 萤火虫脉冲式闪
      }
    }
    // 命中 / 超时（30 m/s 慢速弹丸：150m 飞行 ~5s，超时窗同步放宽）
    const arrived = dist < 1.3 || s.t > 7;
    if (arrived) {
      if (s.hit && s.t <= 7 && alive && vanguardStrikeLands(s.target, "bolt")) {
        stats.wounds++;
        onWound?.(s.target, "bolt", s.trooper);
      }
      s.ring.visible = false;
      flight.splice(i, 1);
    }
  }
}

/** 中队里还站着的人数（供 UI / 测试读） */
export function vanguardAliveCount(squadRoot) {
  const troopers = squadRoot?.userData?.troopers || [];
  return troopers.filter((t) => !t.userData.dead).length;
}


// ============================================================================
//  三三制编组（主人 2026-09-04）
//
//  20 人 = 2 组 × 10；每组 = 1 名组长 + 3 个三人子小组。
//  编组是**确定性**的：uid → (group, team, slot)，没有随机，重开一局站位一样。
//  组长不进子小组（他是第 10 个人），站在本组三个小组的几何中心稍前。
// ============================================================================

/**
 * 给中队分组。幂等：重复调用结果相同。
 * @returns {{groups: Array<{index:number, leader:object, teams:object[][], all:object[]}>}}
 */
export function assignVanguardFireteams(squadRoot) {
  const troopers = squadRoot?.userData?.troopers || [];
  const { groups: G, teamsPerGroup, perTeam } = VANGUARD_FORMATION;
  const groups = [];
  for (let g = 0; g < G; g++) {
    groups.push({ index: g, leader: null, teams: Array.from({ length: teamsPerGroup }, () => []), all: [] });
  }
  const assault = [];

  for (const tr of troopers) {
    const slot = vanguardRosterSlot(tr.userData.uid ?? 0);
    tr.userData.vehicleSlot = slot;
    // 看护身份在这里一次定死。旧代码写在 vanguardAssault.setupMission 里
    // （`uid >= 20`），跟他坐哪条艇无关——撤离时「回自己乘来的那艘艇」对不上号。
    tr.userData.vehicleGuard = slot.guard;

    if (slot.kind === "pod") {
      // 泡机突击兵：不进三三制方阵，走前后型突击对
      tr.userData.role = "assault";
      tr.userData.group = -1;
      tr.userData.team = -1;
      tr.userData.slot = slot.seat;
      tr.userData.pod = slot.vehicle;
      assault.push(tr);
      continue;
    }
    tr.userData.pod = -1;
    if (slot.guard) {
      // 留守看护：守在自己那艘艇旁，不进阵型（updateVanguardAdvance 会跳过）
      tr.userData.role = "guard";
      tr.userData.group = slot.vehicle;
      tr.userData.team = -1;
      tr.userData.slot = -1;
      continue;
    }
    const g = Math.min(G - 1, slot.vehicle);
    const ti = Math.floor(slot.seat / perTeam) % teamsPerGroup;
    const inner = slot.seat % perTeam;
    tr.userData.role = slot.lead ? "leader" : "member";
    tr.userData.group = g;
    tr.userData.team = ti;
    tr.userData.slot = inner;
    groups[g].teams[ti].push(tr);
    groups[g].all.push(tr);
    if (slot.lead) groups[g].leader = tr;
  }

  squadRoot.userData.formation = { groups, assault };
  return { groups, assault };
}

/**
 * 三三制阵位（相对推进方向的局部偏移，单位：米）。
 *
 * 布局：组长在前，三个子小组呈**倒品字**跟在后面（左前、右前、中后），
 * 每个子小组内部也是一个小三角（组员 0 在前，1/2 在后左右）。
 * 这样从空中看，一个组是"大三角里套三个小三角"——三三制的画面标志。
 *
 * @returns {{right:number, forward:number}} 局部偏移
 */
export function vanguardFormationOffset(trooper) {
  const { teamSpacing, teamGap, groupGap, assaultLead, assaultPairGap } = VANGUARD_FORMATION;
  // 泡机突击对（主人 2026-09-06：「快速突击型 前后型战斗」）：
  // 不进三三制方阵，三对人压在阵列前方横排，每对一前一后。
  // 前出是有战术含义的——他们是索降下来的，落点本就在敌人跟前。
  if (trooper.userData.role === "assault") {
    const pod = trooper.userData.pod ?? 0;
    const lead = (trooper.userData.slot ?? 0) === 0;
    return {
      right: (pod - (VANGUARD_FORMATION.assaultPods - 1) / 2) * assaultPairGap * 1.8,
      forward: assaultLead + (lead ? assaultPairGap * 0.5 : -assaultPairGap * 0.5),
    };
  }
  const g = trooper.userData.group ?? 0;
  const groupOff = (g - (VANGUARD_FORMATION.groups - 1) / 2) * groupGap;
  const ti = trooper.userData.team ?? 0;
  const slot = trooper.userData.slot ?? 0;
  // 子小组锚点：左前 / 右前 / 中后
  const TEAM_ANCHOR = [
    { right: -teamGap * 0.5, forward: 0 },
    { right: teamGap * 0.5, forward: 0 },
    { right: 0, forward: -teamGap * 0.8 },
  ][ti % 3];
  // 小组内三角：0 在前，1 左后，2 右后
  const SLOT = [
    { right: 0, forward: teamSpacing * 0.6 },
    { right: -teamSpacing * 0.55, forward: -teamSpacing * 0.35 },
    { right: teamSpacing * 0.55, forward: -teamSpacing * 0.35 },
  ][slot % 3];
  // 组长站在自己那个三人小组的位子上，只往前挪半步——他是小组的一员，
  // 不是飘在阵型外的一个点。旧写法把组长单独摆在组前方，于是 team 0
  // 永远缺一个人，三人小组的三角在画面上是残的。
  const leadBump = trooper.userData.role === "leader" ? teamSpacing * 0.45 : 0;
  return {
    right: groupOff + TEAM_ANCHOR.right + SLOT.right,
    forward: TEAM_ANCHOR.forward + SLOT.forward + leadBump,
  };
}

// ============================================================================
//  闪电炮：放电函数
// ============================================================================

/**
 * 充电度 → 命中率。**二次曲线**，不是线性：
 * 半充时只有 ~25% 命中率，逼着他们把电充满才开火——这就是"悬念"的来源。
 * 再乘一个距离衰减（halfRange 处减半）。
 *
 * @param {number} charge 0..1
 * @param {number} dist 目标距离
 */
export function boltHitChance(charge, dist) {
  const u = Math.max(0, Math.min(1, charge));
  const { hitFull, hitEmpty, halfRange } = VANGUARD_BOLT;
  const byCharge = hitEmpty + (hitFull - hitEmpty) * u * u;
  const byDist = 1 / (1 + Math.max(0, dist) / Math.max(1e-3, halfRange));
  return byCharge * byDist;
}

/** 确定性抖动（禁止 Math.random；同一发弹每帧画出来必须是同一条弧） */
function boltNoise(seed, i) {
  let h = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491) >>> 0;
  return ((h >>> 8) & 0xffff) / 0xffff - 0.5;   // −0.5 .. 0.5
}

/**
 * 放电轨迹：一条**折线**，不是直线。
 * 主干沿 from→to，每个采样点在垂直平面上按 `boltNoise` 抖开，
 * 两端收窄（起点在枪口、终点在目标，必须钉死，否则弧光会飘出枪口）。
 *
 * @param {{x:number,y:number,z:number}} from
 * @param {{x:number,y:number,z:number}} to
 * @param {number} seed 同一发弹用同一个 seed
 * @param {number} [segments]
 * @returns {number[][]} 折线点（含首尾），长度 = segments + 1
 */
export function boltArcPath(from, to, seed, segments = VANGUARD_BOLT.arcSegments) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  // 任取两个与主干垂直的方向
  let ax = 0, ay = 1, az = 0;
  if (Math.abs(dy / len) > 0.9) { ax = 1; ay = 0; az = 0; }
  // u = normalize(cross(d, a))
  let ux = dy * az - dz * ay;
  let uy = dz * ax - dx * az;
  let uz = dx * ay - dy * ax;
  const ul = Math.hypot(ux, uy, uz) || 1e-6;
  ux /= ul; uy /= ul; uz /= ul;
  // v = normalize(cross(d, u))
  let vx = dy * uz - dz * uy;
  let vy = dz * ux - dx * uz;
  let vz = dx * uy - dy * ux;
  const vl = Math.hypot(vx, vy, vz) || 1e-6;
  vx /= vl; vy /= vl; vz /= vl;

  const amp = len * VANGUARD_BOLT.arcJitter;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // 两端收窄：sin(πt) 在 t=0/1 处为 0，中段最大
    const w = Math.sin(Math.PI * t) * amp;
    const nu = boltNoise(seed, i * 2) * 2 * w;
    const nv = boltNoise(seed, i * 2 + 1) * 2 * w;
    pts.push([
      from.x + dx * t + ux * nu + vx * nv,
      from.y + dy * t + uy * nu + vy * nv,
      from.z + dz * t + uz * nu + vz * nv,
    ]);
  }
  return pts;
}

/**
 * 推进闪电炮的四阶段状态机。**只管状态与充电度**，开不开火由调用方决定
 * （它才知道有没有目标、够不够射程）。
 *
 * 2026-09-05 改为**时间累积**推进：大步长 dt（卡顿/测试单次喂 5s）也能在一次
 * 调用里走完 充电→放电→冷却 的多段转移，不会出现"充了电却永远不开火"。
 *
 * @param {object} trooper
 * @param {number} dt
 * @param {boolean} wantFire 有目标且在射程内
 * @returns {{phase:string, charge:number, fired:boolean}} fired 只在进入 discharge 的那一帧为 true
 */
export function updateBoltCharge(trooper, dt, wantFire) {
  const u = trooper.userData;
  u.boltPhase = u.boltPhase || "idle";
  u.boltT = u.boltT || 0;
  u.boltCharge = u.boltCharge || 0;
  let fired = false;
  let remain = Math.max(0, dt);
  let guard = 8; // 单帧最多推进 8 段状态转移，防异常输入死循环
  const B = VANGUARD_BOLT;

  while (guard-- > 0) {
    switch (u.boltPhase) {
      case "idle":
        u.boltCharge = 0;
        u.boltT = 0;
        if (!wantFire) { guard = 0; break; }
        u.boltPhase = "charging"; // 不消耗 remain：进入 charging 后下一轮再累计
        break;
      case "charging": {
        if (!wantFire) {
          // 目标没了：泄电回 idle，不空放（空放会变成"一顿突突"）
          u.boltPhase = "idle"; u.boltT = 0; u.boltCharge = 0;
          guard = 0;
          break;
        }
        const need = B.chargeTime - u.boltT;
        if (remain < need) {
          u.boltT += remain;
          u.boltCharge = Math.min(1, u.boltT / B.chargeTime);
          guard = 0;
          break;
        }
        remain -= need;
        u.boltT = B.chargeTime;
        u.boltCharge = 1;
        u.boltPhase = "discharge";
        u.boltT = 0;
        fired = true;
        break;
      }
      case "discharge": {
        const need = B.dischargeTime - u.boltT;
        if (remain < need) { u.boltT += remain; guard = 0; break; }
        remain -= need;
        u.boltT = 0;
        u.boltPhase = "cooldown";
        break;
      }
      case "cooldown": {
        const need = B.cooldown - u.boltT;
        if (remain < need) {
          u.boltT += remain;
          u.boltCharge = Math.max(0, 1 - u.boltT / B.cooldown);
          guard = 0;
          break;
        }
        remain -= need;
        u.boltT = 0;
        u.boltCharge = 0;
        u.boltPhase = "idle";
        break;
      }
      default:
        u.boltPhase = "idle";
        guard = 0;
    }
  }
  return { phase: u.boltPhase, charge: u.boltCharge, fired };
}

// ============================================================================
//  激光刀破盾（主人 2026-09-04：「近距离格斗时，激光刀对盾牌的破坏力」）
// ============================================================================

/**
 * 一刀砍在盾上会发生什么：**盾直接被切开**，不是弹开。
 * 这就是代差感——普通士兵的盾对箭有效，对激光刀等于没有。
 *
 * 调用方（saihojiPhalanx）负责真正摘掉盾网格与记事件；这里只裁定结果，
 * 免得判定口径散成两份。
 *
 * @param {object} soldier 被砍的普通士兵
 * @returns {{shieldBroken:boolean, wounded:boolean}}
 */
export function bladeVsShield(soldier) {
  const eq = soldier?.userData?.equipment;
  const hasShield = !!(eq?.shield && !soldier.userData.shieldBroken);
  if (hasShield) {
    // 第一刀劈盾：盾没了，人这一刀不算受伤（他还举着残柄退了一步）
    return { shieldBroken: true, wounded: false };
  }
  // 无盾：1 刀 = 1 次损伤（VANGUARD_COMBAT.bladeHitsPerWound）
  return { shieldBroken: false, wounded: true };
}

// ============================================================================
//  缓慢沉稳推进
// ============================================================================

const _adA = new THREE.Vector3();
const _adB = new THREE.Vector3();
const _adUp = new THREE.Vector3();
const _adFwd = new THREE.Vector3();
const _adRight = new THREE.Vector3();
const _adBasis = new THREE.Matrix4();

/**
 * 按三三制阵位向 `targetDir` 推进一帧。
 *
 * 球面世界：`up` = 单位径向，前进方向是切平面里从当前朝向指向目标的那一支。
 * **速度是常量**（`VANGUARD_FORMATION.advanceSpeed`），不做加速度——
 * 「缓慢沉稳」的画面感来自匀速 + 阵型不散，不是来自缓动曲线。
 *
 * @param {object} squadRoot
 * @param {number} dt
 * @param {{anchorDir:THREE.Vector3, groundRadius:number, headingDir?:THREE.Vector3, speed?:number}} opts
 *   anchorDir 是阵型中心当前所在的球面方向（会被本函数就地推进）
 * @returns {{advanced:number}} 本帧推进的弧长
 */
export function updateVanguardAdvance(squadRoot, dt, opts = {}) {
  const troopers = squadRoot?.userData?.troopers || [];
  if (!troopers.length) return { advanced: 0 };
  const {
    anchorDir,
    groundRadius,
    headingDir = null,
    speed = VANGUARD_FORMATION.advanceSpeed,
  } = opts;
  if (!anchorDir || !Number.isFinite(groundRadius)) return { advanced: 0 };

  _adUp.copy(anchorDir).normalize();
  // 前进方向：切平面里指向 headingDir 的分量
  if (headingDir) {
    _adFwd.copy(headingDir).addScaledVector(_adUp, -headingDir.dot(_adUp));
    if (_adFwd.lengthSq() < 1e-10) _adFwd.set(0, 0, 1);
    _adFwd.normalize();
  } else {
    _adFwd.set(0, 0, 1).addScaledVector(_adUp, -_adUp.z).normalize();
  }
  _adRight.crossVectors(_adFwd, _adUp).normalize();

  // 阵型中心沿切向走一步，再重新归一化回球面
  const step = speed * dt;
  if (step > 0) {
    anchorDir.addScaledVector(_adFwd, step / Math.max(1e-3, groundRadius)).normalize();
    _adUp.copy(anchorDir);
    _adRight.crossVectors(_adFwd, _adUp).normalize();
    _adFwd.crossVectors(_adUp, _adRight).normalize();
  }

  for (const tr of troopers) {
    if (tr.userData.dead) continue;
    if (tr.userData.vehicleGuard) continue; // 看护留守飞行器旁，不进战斗阵型
    const off = vanguardFormationOffset(tr);
    _adA.copy(_adUp).multiplyScalar(groundRadius)
      .addScaledVector(_adRight, off.right)
      .addScaledVector(_adFwd, off.forward);
    // 站到球面上：位置归一化到 groundRadius，姿态用局部基底
    _adB.copy(_adA).normalize().multiplyScalar(groundRadius);
    tr.position.copy(_adB);
    const up2 = _adB.clone().normalize();
    const right2 = _adRight.clone().addScaledVector(up2, -_adRight.dot(up2)).normalize();
    const fwd2 = new THREE.Vector3().crossVectors(up2, right2).normalize();
    _adBasis.makeBasis(right2, up2, fwd2);
    tr.quaternion.setFromRotationMatrix(_adBasis);
    tr.visible = true;
    // 沉重的行走（主人 2026-09-05）：低频大摆幅 + 躯干随步态微倾，重甲的顿挫感
    const phase = (tr.userData.uid ?? 0) * 0.7;
    const advT = (squadRoot.userData._advT = (squadRoot.userData._advT || 0));
    const sw = Math.sin(advT * 2.4 + phase) * 0.34;
    if (tr.userData.parts?.legL) tr.userData.parts.legL.rotation.x = sw;
    if (tr.userData.parts?.legR) tr.userData.parts.legR.rotation.x = -sw;
    if (tr.userData.parts?.torso) tr.userData.parts.torso.rotation.z = Math.sin(advT * 2.4 + phase) * 0.05;
  }
  squadRoot.userData._advT = (squadRoot.userData._advT || 0) + dt;
  return { advanced: step };
}

// ============================================================================
//  闪电炮表现件：枪口世界坐标 + 弧光折线池（放电可视化）
// ============================================================================

/**
 * 枪口（muzzle 辉光环）的世界坐标——弧光的起点。
 * @param {THREE.Object3D} trooper
 * @param {THREE.Vector3} [out]
 */
export function vanguardMuzzleWorld(trooper, out = new THREE.Vector3()) {
  const gun = trooper?.userData?.parts?.gun;
  if (!gun?.parent) return trooper?.getWorldPosition ? trooper.getWorldPosition(out) : out.set(0, 0, 0);
  gun.updateWorldMatrix(true, false);
  return gun.localToWorld(out.set(0, 0, 0.47));
}

/**
 * 放电弧光池：`boltArcPath` 的折线可视化。
 * spawn() 复用池内 Line（maxArcs 条），每条只亮放电那一瞬（dischargeTime + 0.06s 淡出）。
 * update(dt) 每帧推进淡出——挂 scene 后由调用方（saihojiPhalanx）驱动。
 *
 * @param {{maxArcs?:number}} [opts]
 * @returns {{root:THREE.Group, spawn:(from:THREE.Vector3, to:THREE.Vector3, seed?:number)=>void,
 *            update:(dt:number)=>void}}
 */
export function createBoltArcFx({ maxArcs = 14 } = {}) {
  const root = new THREE.Group();
  root.name = "vanguard-bolt-arcs";
  const lifeMax = VANGUARD_BOLT.dischargeTime + 0.06;
  const pool = [];
  for (let i = 0; i < maxArcs; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array((VANGUARD_BOLT.arcSegments + 1) * 3), 3)
    );
    const mat = new THREE.LineBasicMaterial({
      color: 0x9fe8ff, transparent: true, opacity: 0, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.frustumCulled = false;
    root.add(line);
    pool.push({ line, life: 0 });
  }
  let cursor = 0;
  return {
    root,
    spawn(from, to, seed = 1) {
      const slot = pool[cursor % pool.length];
      cursor++;
      const pts = boltArcPath(from, to, seed);
      const attr = slot.line.geometry.getAttribute("position");
      for (let i = 0; i < pts.length; i++) attr.setXYZ(i, pts[i][0], pts[i][1], pts[i][2]);
      attr.needsUpdate = true;
      slot.life = lifeMax;
      slot.line.visible = true;
      slot.line.material.opacity = 0.95;
    },
    update(dt) {
      for (const s of pool) {
        if (!s.line.visible) continue;
        s.life -= dt;
        s.line.material.opacity = Math.max(0, 0.95 * (s.life / lifeMax));
        if (s.life <= 0) s.line.visible = false;
      }
    },
  };
}
