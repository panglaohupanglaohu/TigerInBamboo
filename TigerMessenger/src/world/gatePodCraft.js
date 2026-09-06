// ============================================================================
//  叹息之门 · 低模泡形飞行器（Gate Pod Craft）—— Claude 2026-09-04
//
//  参考用户提供的概念图**形体**：球根状泡形机鼻 + 方箱中后段 + 单层泡形座舱
//  + 一对细长平直高翼 + 机鼻上的椭圆舷窗组 + 腹部小推进器丛。
//  配色照抄画面气质：暖灰褐硬壳 + 鼠尾草绿嵌板 + 橙色识别点。
//
//  ⚠️ 概念图上的品牌字样与卡通角色涂装**没有复刻**（第三方商标/角色美术）。
//  机身编号、警示三角、腹部橙点都是本项目自造的原创标记。
//
//  局部坐标：+Z = 机头 · +Y = 天 · +X = 右。与 tripleGateScout 同约定，
//  所以挂到 gate 的 seatRoot（+X 轨右 / +Y 径向 / +Z 轨向）时不用换算。
//  纯几何 + toonMat，无贴图、无 transmission（移动端/SwiftShader 兼容）。
// ============================================================================

import * as THREE from "three";
import { facet } from "../assets/lowPoly.js";
import { addOutline, toonMat } from "../assets/toon.js";

/** 三台的涂装/姿态差异表（确定性，禁止 Math.random）。 */
export const GATE_POD_VARIANTS = Object.freeze([
  Object.freeze({ id: "pod-55-2", hull: 0x8b7b6c, accent: 0x9dbcae, serial: 2 }),
  Object.freeze({ id: "pod-41-7", hull: 0x7d7166, accent: 0xa8bfa4, serial: 7 }),
  Object.freeze({ id: "pod-08-9", hull: 0x94826f, accent: 0x8fb3ad, serial: 9 }),
]);

const OUTLINE = 0.02;

function mesh(geometry, material, outline = OUTLINE) {
  const m = new THREE.Mesh(facet(geometry), material);
  m.castShadow = true;
  m.receiveShadow = true;
  if (outline > 0) addOutline(m, outline);
  return m;
}

/** 无描边的小贴片（舷窗芯、识别点）：描边会把 0.1 大小的片子糊成黑点。 */
function decal(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/**
 * 一台泡形飞行器。整机长约 7 × scale。
 * @param {{scale?:number, hull?:number, accent?:number, serial?:number, pilot?:boolean}} [opts]
 */
export function createGatePodCraft({
  scale = 1,
  hull = 0x8b7b6c,
  accent = 0x9dbcae,
  serial = 2,
  pilot = true,
} = {}) {
  const root = new THREE.Group();
  root.name = "gate-pod-craft";

  const matHull = toonMat(hull, { flatShading: true });
  const matHullDark = toonMat(0x6f6053, { flatShading: true });
  const matAccent = toonMat(accent, { flatShading: true });
  const matAccentDark = toonMat(0x74907f, { flatShading: true });
  const matDark = toonMat(0x3a3630, { flatShading: true });
  const matOrange = toonMat(0xd9772f, { flatShading: true });
  const matGlass = toonMat(0xd4e2e4, { flatShading: false, transparent: true, opacity: 0.5 });

  // ---------- 1. 球根机鼻：概念图里最抢眼的体块，占了近一半机长 ----------
  const nose = mesh(new THREE.SphereGeometry(1.35, 12, 9), matHull);
  nose.scale.set(1.02, 0.90, 1.06);
  nose.position.set(0, -0.22, 2.10);
  nose.userData.podPart = "nose";
  root.add(nose);

  // 舷窗组：鼻锥上散布的椭圆窗（外圈嵌板 + 深色芯），朝向各不相同
  // 角度表是手排的，不是循环生成——概念图上它们就是不规则的
  const ports = [
    [0.35, 0.42, 0.30, 1.0],
    [-0.10, 0.10, 0.34, 0.9],
    [0.62, -0.05, 0.26, 0.8],
    [0.10, -0.55, 0.28, 0.85],
    [-0.45, -0.30, 0.22, 0.75],
  ];
  for (const [ax, ay, r, k] of ports) {
    const dir = new THREE.Vector3(ax, ay, 0.85).normalize();
    const ring = decal(new THREE.CircleGeometry(r, 12), matAccent);
    const core = decal(new THREE.CircleGeometry(r * 0.55, 10), matAccentDark);
    for (const [obj, out] of [[ring, 1.352], [core, 1.362]]) {
      obj.position.copy(dir).multiply(new THREE.Vector3(1.0, 0.94, 1.12)).multiplyScalar(out);
      obj.position.add(nose.position);
      obj.lookAt(obj.position.clone().add(dir));
      obj.scale.setScalar(k);
      root.add(obj);
    }
  }

  // ---------- 2. 方箱中后段：往尾部**变宽变高**（概念图的楔形透视） ----------
  const body = mesh(new THREE.BoxGeometry(1.85, 2.05, 4.1), matHull);
  body.position.set(0, 0.16, -1.20);
  body.userData.podPart = "body";
  root.add(body);
  // 顶部后倾甲板：概念图里座舱之后是一路下斜的背脊，不是平顶
  const deck = mesh(new THREE.BoxGeometry(1.70, 0.44, 3.0), matHull, 0.014);
  deck.position.set(0, 1.02, -1.75);
  deck.rotation.x = -0.10;
  root.add(deck);
  // 腹部楔块：把方箱底面收成船底，避免"一个盒子"的死板
  const belly = mesh(new THREE.BoxGeometry(1.46, 0.60, 3.8), matHullDark);
  belly.position.set(0, -0.96, -1.20);
  root.add(belly);
  // 尾板：鼠尾草绿平切端面（概念图里最亮的一块）
  const tail = mesh(new THREE.BoxGeometry(1.90, 2.10, 0.24), matAccent);
  tail.position.set(0, 0.20, -3.22);
  tail.userData.podPart = "tail";
  root.add(tail);
  // 侧面接缝条：一条深色腰线，把鼻和箱在视觉上缝起来
  for (const sx of [-1, 1]) {
    const seam = mesh(new THREE.BoxGeometry(0.06, 0.20, 4.6), matHullDark, 0);
    seam.position.set(sx * 0.95, -0.42, -0.9);
    root.add(seam);
  }
  // 舷侧绿嵌板：概念图上机身侧面那几块鼠尾草绿补丁
  for (const sx of [-1, 1]) {
    for (const [pz, pw, ph] of [[-2.55, 0.55, 1.15], [0.05, 0.42, 0.62]]) {
      const panel = decal(new THREE.PlaneGeometry(pz < -2 ? 0.55 : pw, ph), matAccent);
      panel.position.set(sx * 0.931, 0.16, pz);
      panel.lookAt(panel.position.clone().add(new THREE.Vector3(sx, 0, 0)));
      root.add(panel);
    }
  }

  // ---------- 3. 座舱：泡形罩 + 飞行员半身 ----------
  const canopy = mesh(new THREE.SphereGeometry(0.52, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), matGlass, 0);
  canopy.position.set(0, 1.28, 0.35);
  canopy.userData.podPart = "canopy";
  canopy.scale.set(1.0, 1.05, 1.25);
  root.add(canopy);
  const coaming = mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.14, 12), matHullDark, 0.012);
  coaming.position.set(0, 1.22, 0.35);
  coaming.scale.set(1.0, 1, 1.25);
  root.add(coaming);
  if (pilot) {
    const torso = mesh(new THREE.BoxGeometry(0.42, 0.34, 0.30), matDark, 0);
    torso.position.set(0, 1.29, 0.27);
    root.add(torso);
    const head = mesh(new THREE.SphereGeometry(0.19, 8, 6), toonMat(0xc9a888, { flatShading: true }), 0);
    head.position.set(0, 1.59, 0.35);
    root.add(head);
    const visor = decal(new THREE.BoxGeometry(0.24, 0.09, 0.05), matDark);
    visor.position.set(0, 1.60, 0.52);
    root.add(visor);
  }

  // ---------- 4. 平直高翼：细长、微微前掠，翼尖一块绿嵌板 ----------
  for (const sx of [-1, 1]) {
    const wing = mesh(new THREE.BoxGeometry(5.2, 0.10, 0.66), matHull, 0.014);
    wing.position.set(sx * 3.55, 0.96, 1.62);
    wing.rotation.y = sx * -0.09; // 前掠
    wing.rotation.z = sx * 0.045; // 一点上反
    wing.userData.podPart = "wing";
    root.add(wing);
    const tip = mesh(new THREE.BoxGeometry(0.95, 0.12, 0.68), matAccent, 0.012);
    tip.position.set(sx * 6.05, wing.position.y + Math.sin(wing.rotation.z) * (sx * 2.2), 1.62);
    tip.rotation.copy(wing.rotation);
    root.add(tip);
    // 翼根挂架：把高翼与机身顶甲板接起来（概念图里那截短柱）
    const pylon = mesh(new THREE.BoxGeometry(0.26, 0.55, 0.60), matHullDark, 0.012);
    pylon.position.set(sx * 0.88, 0.72, 1.55);
    root.add(pylon);
    // 翼根撑杆：两根细管从鼻锥上方斜拉到翼下（概念图上很显眼的结构线）
    for (const dz of [0.05, 0.95]) {
      const strut = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.75, 6), matHullDark, 0);
      strut.position.set(sx * 1.34, 0.40, 1.50 + dz * 0.7);
      strut.rotation.z = sx * -0.72;
      strut.rotation.x = 0.18;
      root.add(strut);
    }
    // 机身编号条（抽象刻度，不是字）：翼面上几个小方点
    for (let i = 0; i < 3 + (serial % 2); i++) {
      const tick = decal(new THREE.BoxGeometry(0.10, 0.02, 0.10), matHullDark);
      tick.position.set(sx * (2.4 + i * 0.28), 1.012, 1.62);
      root.add(tick);
    }
  }

  // ---------- 5. 腹部推进器丛：细管 + 橙色喷口 ----------
  const jets = [
    [-0.42, 0.10], [0.0, -0.20], [0.42, 0.10],
    [-0.24, -0.75], [0.24, -0.75], [0.0, -1.45],
  ];
  for (const [jx, jz] of jets) {
    const pin = mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.62, 6), matDark, 0);
    pin.position.set(jx, -1.48, jz - 0.9);
    pin.rotation.x = jz * 0.10;
    pin.userData.podPart = "thruster";
    root.add(pin);
    const nozzle = decal(new THREE.CylinderGeometry(0.075, 0.055, 0.10, 6), matOrange);
    nozzle.position.set(jx, -1.79, jz - 0.9);
    root.add(nozzle);
  }
  // 鼻下整流罩（概念图里那个深色圆鼓包）
  const chin = mesh(new THREE.SphereGeometry(0.34, 10, 7), matDark, 0.012);
  chin.position.set(-0.30, -1.18, 2.35);
  chin.scale.set(1, 0.8, 1.15);
  root.add(chin);
  const chinRing = decal(new THREE.CircleGeometry(0.13, 10), matOrange);
  chinRing.position.set(-0.30, -1.28, 2.78);
  chinRing.lookAt(new THREE.Vector3(-0.30, -1.45, 3.7));
  root.add(chinRing);

  // ---------- 6. 原创识别标记：舷侧三个橙点 + 一枚警示三角 ----------
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const dot = decal(new THREE.CircleGeometry(0.055, 8), matOrange);
      dot.position.set(sx * 0.932, 0.80, -0.35 - i * 0.36);
      dot.lookAt(dot.position.clone().add(new THREE.Vector3(sx, 0, 0)));
      root.add(dot);
    }
    const tri = decal(new THREE.CircleGeometry(0.10, 3), matHullDark);
    tri.position.set(sx * 0.932, -0.10, -1.95);
    tri.lookAt(tri.position.clone().add(new THREE.Vector3(sx, 0, 0)));
    root.add(tri);
  }

  root.scale.setScalar(scale);
  root.userData.podSerial = serial;
  root.userData.podLength = 8.4 * scale;
  return root;
}

/**
 * 在叹息之门挂三台泡形飞行器（seatRoot 局部坐标：+X 轨右 / +Y 天 / +Z 轨向）。
 * 三台的位置/朝向/大小都是**写死的常量**——它们是布景，不是刷出来的编队，
 * 所以搬门（relocateAbandonedGate）时跟着 seatRoot 走，不需要重算。
 *
 * @param {THREE.Object3D} abandonedGate buildAbandonedGate 的返回值
 * @param {{scale?:number, count?:number}} [opts] count：停几台（默认 3；苔庭之战
 *   要带走泡机，叹息之门的停机数相应减少）
 * @returns {THREE.Group|null} 三台的容器（挂载失败返回 null）
 */
export function mountGatePodCraft(abandonedGate, { scale = 1, count = 3 } = {}) {
  const seat = abandonedGate?.userData?.seatRoot;
  if (!seat) return null;
  // 幂等：重复挂载先摘旧的（开发者菜单搬门会重跑这段）
  const old = seat.getObjectByName("gate-pod-squadron");
  if (old) seat.remove(old);

  const squadron = new THREE.Group();
  squadron.name = "gate-pod-squadron";
  squadron.userData.anchor = { kind: "triple-gate" };

  // 三台的停位：一台高悬在门楣外侧、一台低掠过夹道、一台停在塔肩上。
  // 门总高 44 / 夹道宽 10，所以横向别超过 ±16，否则飞出峡谷框景。
  const berths = [
    { pos: [-12.5, 27.0, 9.5], yaw: 0.38, pitch: -0.06, roll: 0.10, scale: 1.00 },
    { pos: [10.8, 20.5, -7.0], yaw: -2.62, pitch: 0.05, roll: -0.13, scale: 0.86 },
    { pos: [1.2, 33.5, 17.5], yaw: 0.12, pitch: -0.10, roll: 0.04, scale: 1.12 },
  ];
  berths.slice(0, Math.max(0, Math.min(berths.length, count))).forEach((berth, i) => {
    const variant = GATE_POD_VARIANTS[i % GATE_POD_VARIANTS.length];
    const pod = createGatePodCraft({
      scale: berth.scale * scale,
      hull: variant.hull,
      accent: variant.accent,
      serial: variant.serial,
    });
    pod.name = `gate-pod-${variant.id}`;
    pod.position.fromArray(berth.pos);
    pod.rotation.set(berth.pitch, berth.yaw, berth.roll, "YXZ");
    pod.userData.podVariant = variant.id;
    pod.userData.basePosition = berth.pos.slice();
    squadron.add(pod);
  });

  seat.add(squadron);
  return squadron;
}

/**
 * 每帧悬停摆动（纯表现层：只动 position.y / rotation.z，不改基座）。
 * 三台各自错相，不同步晃。
 */
export function updateGatePodCraft(squadron, t = 0) {
  if (!squadron) return;
  squadron.children.forEach((pod, i) => {
    const base = pod.userData.basePosition;
    if (!base) return;
    const phase = i * 2.1;
    pod.position.y = base[1] + Math.sin(t * 0.62 + phase) * 0.42;
    pod.position.x = base[0] + Math.sin(t * 0.41 + phase * 1.7) * 0.22;
    pod.rotation.z = (pod.userData.baseRoll ??= pod.rotation.z) + Math.sin(t * 0.53 + phase) * 0.035;
  });
}

// ============================================================================
//  伴飞：泡形飞行器随莫比斯 aircraft 编队出行（用户 2026-09-04 需求）
//
//  做法是**每帧跟位**，不是把泡机挂成机队成员的子节点：
//  机队成员自己带 P.aircraftScale 的缩放（moebiusAircraft.js 里有一条历史大 bug
//  的注释专门讲这个——组缩放会把世界阵位也乘一遍），挂成子节点就会被那个缩放
//  连位置带体积一起放大。泡机挂在 squad 下、每帧读成员的世界位姿再加切向偏置，
//  体积和阵位就都归自己管。
// ============================================================================

const _epPos = new THREE.Vector3();
const _epQ = new THREE.Quaternion();
const _epUp = new THREE.Vector3();
const _epFwd = new THREE.Vector3();
const _epSide = new THREE.Vector3();
const _epTarget = new THREE.Vector3();

/** 伴飞阵位（相对被伴飞成员的切平面：右 / 上 / 后），确定性常量表。 */
const ESCORT_SLOTS = Object.freeze([
  Object.freeze({ member: 0, side: 9.5, up: -2.2, back: 5.0, scale: 0.62 }),
  Object.freeze({ member: 0, side: -9.5, up: -1.4, back: 6.2, scale: 0.55 }),
  Object.freeze({ member: 1, side: 8.2, up: 2.6, back: 4.2, scale: 0.58 }),
]);

/**
 * 给莫比斯机队挂一组伴飞泡机。幂等：重复调用先摘旧的。
 * @param {THREE.Object3D} squad createMoebiusAircraftSquad 的返回值
 * @param {{scale?:number, slots?:ReadonlyArray<object>}} [opts]
 * @returns {THREE.Group|null}
 */
export function mountGatePodEscort(squad, { scale = 1, slots = ESCORT_SLOTS } = {}) {
  if (!squad) return null;
  const old = squad.getObjectByName("gate-pod-escort");
  if (old) squad.remove(old);

  const wing = new THREE.Group();
  wing.name = "gate-pod-escort";
  slots.forEach((slot, i) => {
    const variant = GATE_POD_VARIANTS[i % GATE_POD_VARIANTS.length];
    const pod = createGatePodCraft({
      scale: slot.scale * scale,
      hull: variant.hull,
      accent: variant.accent,
      serial: variant.serial,
    });
    pod.name = `gate-pod-escort-${variant.id}`;
    pod.userData.escortSlot = slot;
    // 麻醉炮口（机鼻下缘）：苔庭之战时从这里向红盔发射麻醉弹（5 发瘫倒）
    const tranqMuzzle = new THREE.Object3D();
    tranqMuzzle.name = "tranq-muzzle";
    tranqMuzzle.position.set(0, -1.35, 2.5);
    pod.add(tranqMuzzle);
    pod.userData.tranqMuzzle = tranqMuzzle;
    wing.add(pod);
  });
  squad.add(wing);
  squad.userData.gatePodEscort = wing;
  return wing;
}

// ---- 僚机参数（业界两档队形：密集 / 战术掩护）----------------------------
/** 密集队形的跟位阻尼（1/s）。僚机贴翼飞，位置要跟得紧 */
const WING_PARADE_K = 3.4;
/** 掩护轮的跟位阻尼（1/s）。拉开之后不必贴那么死，留出机动余量 */
const WING_COVER_K = 1.1;
/** 队形切换的过渡时间（秒） */
const WING_MODE_BLEND = 1.2;
/** 掩护轮的站位放大：横向 ×2.3、抬高 +7、后拖 +9（看得见长机的全貌） */
const WING_COVER_SIDE = 2.3;
const WING_COVER_UP = 7;
const WING_COVER_BACK = 9;
/** 掩护轮的绕飞角速度（弧度/秒）——绕着长机转，不是钉在一个点上 */
const WING_COVER_ORBIT = 0.5;
/** 掩护轮的绕飞半径（米） */
const WING_COVER_RADIUS = 7.5;

/** 拉开的门槛：长机机背偏离天顶超过这个角，或姿态角速度超过下面那个 */
const WING_BREAK_TILT = 0.70;   // ≈40°
const WING_BREAK_RATE = 1.20;   // rad/s
/** 归队门槛（迟滞）：长机安静满 WING_REJOIN_HOLD 秒才回密集队形 */
const WING_REJOIN_HOLD = 1.5;

/** 僚机自己的飞行包线：坡度 ≤ 40°、俯仰 ≤ 20°。
 *  「保持飞行姿态」的具体数字——超出这个范围就不是在飞，是在被甩 */
const WING_BANK_MAX = 0.70;
const WING_PITCH_MAX = 0.35;

const _ewUp = new THREE.Vector3();
const _ewFwd = new THREE.Vector3();
const _ewSide = new THREE.Vector3();
const _ewVel = new THREE.Vector3();
const _ewTmp = new THREE.Vector3();
const _ewBack = new THREE.Vector3();
const _ewParade = new THREE.Vector3();
const _ewCover = new THREE.Vector3();
const _ewBasis = new THREE.Matrix4();
const _ewQd = new THREE.Quaternion();

const clampAbs = (v, lim) => (Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

/**
 * 每帧把僚机保持在长机旁边的队形位上（两档队形，自动切换）。
 *
 * 在 updateAircraftHover **之后**调用：长机阵位这一帧已经算完，僚机才跟得准；
 * 反过来会慢一帧，转弯时看得出拖影。
 *
 * @param {THREE.Object3D} squad
 * @param {number} [t] 场景时间（秒）。帧间隔从两次调用的时间差推出
 */
export function updateGatePodEscort(squad, t = 0) {
  const wing = squad?.userData?.gatePodEscort;
  if (!wing) return;
  const members = squad.userData.members || [];
  if (!members.length) return;
  squad.updateWorldMatrix(true, false);
  const parentInv = squad.matrixWorld.clone().invert();

  // 帧间隔：这个函数签名里没有 dt，从时间戳推。首帧、跳帧、暂停回来都钳住，
  // 免得阻尼项一步跳到位（那就等于又变回刚性绑定了）。
  const prevT = wing.userData._escortT;
  const dt = Number.isFinite(prevT) ? Math.max(0, Math.min(0.1, t - prevT)) : 0;
  wing.userData._escortT = t;

  // 长机被鲸咬住这件事，squad 上有明牌（saihojiGarden 每帧写 whaleLock）。
  // 有明牌就直接进掩护轮，不等姿态门槛——鲸起的那一瞬间僚机就该拉开。
  const whaleOn = !!(squad.userData?.whaleLock?.active
    || members.some((m) => m?.userData?.whaleLock?.active));

  wing.children.forEach((pod, i) => {
    const slot = pod.userData.escortSlot;
    const host = members[slot.member % members.length];
    if (!host?.parent) return;
    host.getWorldPosition(_epPos);
    host.getWorldQuaternion(_epQ);

    // ---- 当地的天。切换队形、限幅飞行包线，都以它为基准 ----
    _ewUp.copy(_epPos);
    if (_ewUp.lengthSq() < 1e-8) _ewUp.set(0, 1, 0);
    _ewUp.normalize();

    // ---- 长机稳不稳：机背偏离天顶多少 + 姿态角速度多大 ----
    _ewBack.set(0, 1, 0).applyQuaternion(_epQ);
    const hostTilt = Math.acos(Math.max(-1, Math.min(1, _ewBack.dot(_ewUp))));
    const st = (pod.userData._wing ||= { cover: 0, calm: 0, prevQ: null, prevPos: null });
    let rate = 0;
    if (st.prevQ && dt > 0) {
      _ewQd.copy(st.prevQ).invert().multiply(_epQ);
      rate = 2 * Math.acos(Math.max(-1, Math.min(1, Math.abs(_ewQd.w)))) / dt;
    }
    st.prevQ = _epQ.clone();

    // ---- 队形切换（迟滞）：掉进掩护轮很快，归队要等长机真的安静一阵子 ----
    const breaking = whaleOn || hostTilt > WING_BREAK_TILT || rate > WING_BREAK_RATE;
    st.calm = breaking ? 0 : st.calm + dt;
    const want = breaking ? 1 : (st.calm >= WING_REJOIN_HOLD ? 0 : st.cover);
    const step = dt > 0 ? dt / WING_MODE_BLEND : 1;
    st.cover += clampAbs(want - st.cover, step);
    st.cover = Math.max(0, Math.min(1, st.cover));
    const cover = st.cover;

    // ---- ① 密集队形位：长机的**机身坐标系**里的固定偏置 ----
    // 编队转弯时长机压坡度，这个位子跟着一起转——那正是僚机该有的样子。
    _epUp.set(0, 1, 0).applyQuaternion(_epQ).normalize();
    _epFwd.set(0, 0, 1).applyQuaternion(_epQ).normalize();
    _epSide.crossVectors(_epFwd, _epUp).normalize();
    const bob = Math.sin(t * 0.7 + i * 2.3) * 0.35;
    _ewParade.copy(_epPos)
      .addScaledVector(_epSide, slot.side)
      .addScaledVector(_epUp, slot.up + bob)
      .addScaledVector(_epFwd, -slot.back);

    // ---- ② 掩护轮位：拉开到外侧，在**当地水平面**里绕着长机转 ----
    // 关键在于这里用的是当地的天，不是长机的机背：长机翻成什么样，
    // 掩护圈都还在水平面上，僚机也就还在正常飞行。
    _ewFwd.copy(_epFwd).addScaledVector(_ewUp, -_epFwd.dot(_ewUp));
    if (_ewFwd.lengthSq() < 1e-8) {
      _ewFwd.set(1, 0, 0).addScaledVector(_ewUp, -_ewUp.x);
      if (_ewFwd.lengthSq() < 1e-8) _ewFwd.set(0, 0, 1).addScaledVector(_ewUp, -_ewUp.z);
    }
    _ewFwd.normalize();
    _ewSide.crossVectors(_ewFwd, _ewUp).normalize();
    const az = t * WING_COVER_ORBIT + (i / Math.max(1, wing.children.length)) * Math.PI * 2;
    _ewCover.copy(_epPos)
      .addScaledVector(_ewSide, slot.side * WING_COVER_SIDE + Math.cos(az) * WING_COVER_RADIUS)
      .addScaledVector(_ewUp, WING_COVER_UP + bob)
      .addScaledVector(_ewFwd, -slot.back - WING_COVER_BACK + Math.sin(az) * WING_COVER_RADIUS);

    _epTarget.copy(_ewParade).lerp(_ewCover, cover);

    // ---- 跟位：密集档跟得紧，掩护档松一些 ----
    const k = WING_PARADE_K + (WING_COVER_K - WING_PARADE_K) * cover;
    const follow = dt > 0 ? 1 - Math.exp(-k * dt) : 1;
    pod.getWorldPosition(_ewTmp);
    if (st.prevPos && dt > 0) {
      _ewTmp.lerp(_epTarget, follow);
      _ewVel.subVectors(_ewTmp, st.prevPos).multiplyScalar(1 / dt);
    } else {
      _ewTmp.copy(_epTarget);
      _ewVel.set(0, 0, 0);
    }
    st.prevPos = _ewTmp.clone();
    pod.position.copy(_ewTmp).applyMatrix4(parentInv);

    // ---- 姿态 ----
    // 密集档：跟长机一起压坡度（编队转弯），但限幅在自己的飞行包线里；
    // 掩护档：机翼自己摆平，坡度只由**自己的转向**决定——
    //         「保持飞行姿态来进行保护」就是这一句。
    const hostRoll = Math.atan2(_ewBack.dot(_ewSide), Math.max(1e-6, _ewBack.dot(_ewUp)));
    const vSide = _ewVel.dot(_ewSide);
    const vFwd = _ewVel.dot(_ewFwd);
    const vUp = _ewVel.dot(_ewUp);
    const ownBank = -vSide * 0.05;
    const bank = clampAbs(hostRoll * (1 - cover) + ownBank * cover, WING_BANK_MAX)
      + Math.sin(t * 0.53 + i * 1.7) * 0.03;
    // 俯仰：跟着自己的航迹（爬升抬头 / 下降低头），限幅
    const pitch = clampAbs(Math.atan2(vUp, Math.max(0.5, Math.abs(vFwd))), WING_PITCH_MAX);
    _ewBasis.makeBasis(_ewSide.clone().negate(), _ewUp, _ewFwd);
    pod.quaternion.setFromRotationMatrix(_ewBasis);
    pod.rotateX(pitch);
    pod.rotateZ(bank);
  });
}
