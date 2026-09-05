// ============================================================================
//  叹息之门 · 低模重型运输艇（Gate Hauler Craft）—— Claude 2026-09-04
//
//  参考用户提供的第二张概念图**形体**：厚重方箱机体（上壳砖红 / 腹部大面积
//  米白护板）、右前顶部泡形座舱、机头面两个深色圆口、尾下一颗球形推进舱带
//  深色喷口、腹部与尾部的**带肋滑撬板**、尾上一根小鳍。
//
//  ⚠️ 概念图上的品牌字样与作者签名**没有复刻**（那是他人作品上的标识）。
//  艇身编号条、警示点都是本项目自造的原创标记。
//
//  与同目录 gatePodCraft（球根泡形侦察艇）是**两型不同的艇**：那型是细长高翼
//  侦察机，这型是没有翼的方箱运输艇，靠球形推进舱推着走。
//
//  ---------------------------------------------------------------------------
//  这型艇就是 **SOCCO**（主人 2026-09-04 确认）
//  ---------------------------------------------------------------------------
//  苔庭之战里它是**贴海面飞行的气垫运输艇**：随 GatePodCraft 编队进场，
//  在苔庭岸边贴海悬停，放下尾门跳板，腹内 14 名先锋重甲兵冲出上岸；
//  撤离时同一道门攒绳索，人攀绳回腹。
//
//  所以本文件有两种用法，靠 `carrier` 开关分开，**互不影响**：
//    · `carrier: false`（默认）＝ 叹息之门旁的布景艇，形体与 2026-09-04 首版逐字相同
//    · `carrier: true`  ＝ SOCCO：多出气垫裙 / 海面气帘 / 尾门跳板 / 腹内 14 个座位 /
//                        尾门口 2 个绳锚。用 `createSoccoCraft()` 拿这一档
//
//  局部坐标：+Z = 机头 · +Y = 天 · +X = 右。纯几何 + toonMat，无贴图。
// ============================================================================

import * as THREE from "three";
import { facet } from "../assets/lowPoly.js";
import { addOutline, toonMat } from "../assets/toon.js";

/** 三台的涂装差异（确定性常量，禁止 Math.random）。 */
export const GATE_HAULER_VARIANTS = Object.freeze([
  Object.freeze({ id: "hauler-71-4", shell: 0xc9695a, belly: 0xf0e3d7, serial: 4 }),
  Object.freeze({ id: "hauler-23-8", shell: 0xb85f52, belly: 0xe8dbcd, serial: 8 }),
  Object.freeze({ id: "hauler-96-1", shell: 0xd4796a, belly: 0xf4ebe1, serial: 1 }),
]);

const OUT = 0.018;

function mesh(geometry, material, outline = OUT) {
  const m = new THREE.Mesh(facet(geometry), material);
  m.castShadow = true;
  m.receiveShadow = true;
  if (outline > 0) addOutline(m, outline);
  return m;
}
function decal(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/**
 * 一台重型运输艇。整机长约 7.6 × scale。
 * @param {{scale?:number, shell?:number, belly?:number, serial?:number, pilot?:boolean}} [opts]
 */
export function createGateHaulerCraft({
  scale = 1,
  shell = 0xc9695a,
  belly = 0xf0e3d7,
  serial = 4,
  pilot = true,
  carrier = false,
} = {}) {
  const root = new THREE.Group();
  root.name = "gate-hauler-craft";

  const matShell = toonMat(shell, { flatShading: true });
  const matShellDark = toonMat(0x9b4f45, { flatShading: true });
  const matBelly = toonMat(belly, { flatShading: true });
  const matTan = toonMat(0xb08b6e, { flatShading: true });
  const matTanDark = toonMat(0x8b6a51, { flatShading: true });
  const matDark = toonMat(0x2a3240, { flatShading: true });
  const matGlass = toonMat(0xd8e6ea, { flatShading: false, transparent: true, opacity: 0.45 });

  // ---------- 1. 主机体：厚重方箱，往机头略收 ----------
  const hull = mesh(new THREE.BoxGeometry(2.6, 2.5, 4.6), matShell);
  hull.position.set(0, 0.35, -0.2);
  hull.userData.haulerPart = "hull";
  root.add(hull);
  // 机头收口段（概念图右端那块圆润的收头）
  const nose = mesh(new THREE.BoxGeometry(2.25, 2.1, 1.3), matShell, 0.014);
  nose.position.set(0, 0.30, 2.5);
  nose.userData.haulerPart = "nose";
  root.add(nose);
  const noseCap = mesh(new THREE.SphereGeometry(1.06, 12, 8), matShell, 0.014);
  noseCap.scale.set(1.04, 0.98, 0.40);
  noseCap.position.set(0, 0.30, 3.02);
  root.add(noseCap);
  // 上壳后段抬肩（概念图左上那块更高的方肩）
  const shoulder = mesh(new THREE.BoxGeometry(2.35, 0.85, 2.0), matShell, 0.014);
  shoulder.position.set(0, 1.72, -1.35);
  root.add(shoulder);

  // ---------- 2. 腹部米白大护板：这一片占了画面近一半，是这型艇的脸 ----------
  const bellyPanel = mesh(new THREE.BoxGeometry(2.66, 1.55, 4.0), matBelly, 0.012);
  bellyPanel.position.set(0, -0.62, 0.1);
  bellyPanel.userData.haulerPart = "belly";
  root.add(bellyPanel);
  // 护板前端收成圆角（概念图那道大弧）
  const bellyRound = mesh(new THREE.CylinderGeometry(0.78, 0.78, 2.66, 12), matBelly, 0.012);
  bellyRound.rotation.z = Math.PI / 2;
  bellyRound.position.set(0, -0.62, 2.05);
  root.add(bellyRound);
  // 护板与上壳的分界线：一道深色接缝
  for (const sx of [-1, 1]) {
    const seam = mesh(new THREE.BoxGeometry(0.05, 0.12, 4.6), matShellDark, 0);
    seam.position.set(sx * 1.335, 0.14, 0.0);
    root.add(seam);
  }

  // ---------- 3. 座舱：右前顶部泡罩 + 飞行员 ----------
  const canopy = mesh(
    new THREE.SphereGeometry(0.78, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.58),
    matGlass, 0
  );
  canopy.scale.set(0.92, 1.0, 1.25);
  canopy.position.set(0, 1.62, 1.55);
  canopy.userData.haulerPart = "canopy";
  root.add(canopy);
  const coaming = mesh(new THREE.BoxGeometry(1.62, 0.16, 2.05), matShellDark, 0.01);
  coaming.position.set(0, 1.56, 1.55);
  root.add(coaming);
  if (pilot) {
    const torso = mesh(new THREE.BoxGeometry(0.5, 0.52, 0.36), toonMat(0x8b8d72, { flatShading: true }), 0);
    torso.position.set(0, 1.82, 1.30);
    root.add(torso);
    const head = mesh(new THREE.SphereGeometry(0.22, 8, 6), toonMat(0x9a9c80, { flatShading: true }), 0);
    head.position.set(0, 2.18, 1.38);
    root.add(head);
    // 前指的手臂（概念图里飞行员正指向前方）
    const arm = mesh(new THREE.BoxGeometry(0.14, 0.14, 0.72), toonMat(0x8b8d72, { flatShading: true }), 0);
    arm.position.set(0.18, 1.92, 1.78);
    arm.rotation.x = 0.18;
    root.add(arm);
  }

  // ---------- 4. 机头面两个深色圆口 ----------
  for (const [px, py, r] of [[0.62, 0.62, 0.34], [0.62, -0.18, 0.28]]) {
    const ring = decal(new THREE.CircleGeometry(r, 12), matDark);
    ring.position.set(px, py + 0.30, 3.47);
    root.add(ring);
    const lip = mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.10, 12), matShellDark, 0);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(px, py + 0.30, 3.43);
    root.add(lip);
  }

  // ---------- 5. 尾下球形推进舱 + 深色喷口 ----------
  const podArm = mesh(new THREE.BoxGeometry(0.42, 0.42, 1.1), matTanDark, 0.012);
  podArm.position.set(0, -1.10, -2.30);
  root.add(podArm);
  const pod = mesh(new THREE.SphereGeometry(0.95, 12, 9), matTan, 0.016);
  pod.scale.set(1.0, 0.94, 1.12);
  pod.position.set(0, -1.28, -3.15);
  pod.userData.haulerPart = "thrusterPod";
  root.add(pod);
  const nozzle = mesh(new THREE.CylinderGeometry(0.46, 0.60, 0.62, 12), matDark, 0.012);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, -1.28, -4.05);
  root.add(nozzle);
  const nozzleCore = decal(new THREE.CircleGeometry(0.40, 12), toonMat(0x161c26, { flatShading: true }));
  nozzleCore.position.set(0, -1.28, -4.38);
  nozzleCore.lookAt(new THREE.Vector3(0, -1.28, -6));
  root.add(nozzleCore);

  // ---------- 6. 带肋滑撬板：尾部一片斜板 + 腹下一条长导轨 ----------
  const skid = mesh(new THREE.BoxGeometry(2.9, 0.16, 1.5), matTan, 0.012);
  skid.position.set(0, -0.55, -2.75);
  skid.rotation.x = 0.42;
  skid.userData.haulerPart = "skid";
  root.add(skid);
  const rail = mesh(new THREE.BoxGeometry(1.15, 0.20, 4.4), matTan, 0.012);
  rail.position.set(0, -1.48, -0.35);
  rail.rotation.x = -0.05;
  root.add(rail);
  // 肋条：概念图上这两片板都是画满平行细线的
  for (let i = 0; i < 9; i++) {
    const rib = decal(new THREE.BoxGeometry(2.86, 0.035, 0.07), matTanDark);
    rib.position.set(0, -0.46, -2.75 - 0.62 + i * 0.155);
    rib.rotation.x = 0.42;
    root.add(rib);
  }
  for (let i = 0; i < 12; i++) {
    const rib = decal(new THREE.BoxGeometry(1.12, 0.045, 0.06), matTanDark);
    rib.position.set(0, -1.375, -2.35 + i * 0.36);
    root.add(rib);
  }

  // ---------- 7. 尾上小鳍 + 原创识别标记 ----------
  const fin = mesh(new THREE.BoxGeometry(0.14, 0.62, 0.55), matShell, 0.01);
  fin.position.set(0.85, 2.32, -1.9);
  fin.rotation.x = -0.25;
  root.add(fin);
  for (const sx of [-1, 1]) {
    // 舷号刻度条（抽象方点，不是字）
    for (let i = 0; i < 3 + (serial % 3); i++) {
      const tick = decal(new THREE.BoxGeometry(0.02, 0.16, 0.12), matShellDark);
      tick.position.set(sx * 1.312, 0.85, 0.9 - i * 0.2);
      root.add(tick);
    }
    // 警示点
    const dot = decal(new THREE.CircleGeometry(0.09, 8), matDark);
    dot.position.set(sx * 1.336, -0.30, 1.5);
    dot.lookAt(dot.position.clone().add(new THREE.Vector3(sx, 0, 0)));
    root.add(dot);
  }

  // ---------- 8. SOCCO 专属：气垫裙 / 气帘 / 尾门跳板 / 腹内座位 / 绳锚 ----------
  if (carrier) {
    buildSoccoCarrierParts(root, { matBelly, matTan, matTanDark, matDark, matShellDark });
  }

  root.scale.setScalar(scale);
  root.userData.haulerSerial = serial;
  root.userData.haulerLength = 7.6 * scale;
  root.userData.isSocco = carrier === true;
  return root;
}

// ============================================================================
//  SOCCO 载具化（主人 2026-09-04 需求）
//
//  设计约束，改之前先读：
//   · **尾门朝 −Z**：机体的尾在 −Z（推进舱、滑撬板都在那头），跳板必须从那儿放，
//     否则人从机头钻出来，和推进舱打架。
//   · **跳板铰链在腹板后沿**（y = −1.40, z = −2.62），关门时竖起封住尾口，
//     开门时绕 X 转到 −78°，末端刚好探到海面下一点（`SOCCO.rampReach`）。
//   · **腹内 14 个座位**：2 列 × 7 排。14 不是随手取的——GatePodCraft 3 台各索降 2 名 = 6，
//     20 − 6 = 14（主人 2026-09-04 定的编成）。座位数写成 `SOCCO.holdSeats`，
//     测试直接读它，不许在别处再写一份。
//   · **气帘不投影、不描边、不吃光**：它是海面被吹起的白痕，走 MeshBasicMaterial +
//     transparent，`renderOrder` 压在艇体下面。描边壳会把它变成一圈黑框。
// ============================================================================

/** SOCCO 的关键尺寸与编成常量（禁止在别处复制第二份）。 */
export const SOCCO = Object.freeze({
  /** 腹内座位数 = 20 名先锋兵 − GatePod 索降的 6 名 */
  holdSeats: 14,
  /** 尾门开到底的角度（弧度，绕 X 向下） */
  rampOpenAngle: -1.36,
  /** 跳板长度（局部单位） */
  rampLength: 2.9,
  /** 跳板放到底时末端相对腹板的下探深度 */
  rampReach: 2.85,
  /** 贴海巡航时腹板离海面的高度 */
  skimHeight: 1.15,
  /** 气帘白痕的最大半径 */
  sprayRadius: 3.6,
});

function buildSoccoCarrierParts(root, mats) {
  const { matBelly, matTan, matTanDark, matDark } = mats;

  // ---- 气垫裙：绕腹板一圈的圆角厚边 ----
  const skirt = new THREE.Group();
  skirt.name = "socco-skirt";
  const skirtMat = toonMat(0x6f5c4c, { flatShading: true });
  // 四条直边 + 四个圆角柱，拼成圆角矩形；不用 TorusGeometry 是因为它是正圆，
  // 而机体是方箱，正圆裙在四角会飘出去一大截。
  const halfX = 1.52;
  const halfZ = 2.74;
  const th = 0.34;
  for (const sx of [-1, 1]) {
    const side = mesh(new THREE.BoxGeometry(th, th, halfZ * 2 - th * 2), skirtMat, 0.01);
    side.position.set(sx * halfX, -1.52, -0.1);
    skirt.add(side);
  }
  for (const sz of [-1, 1]) {
    const end = mesh(new THREE.BoxGeometry(halfX * 2 - th * 2, th, th), skirtMat, 0.01);
    end.position.set(0, -1.52, -0.1 + sz * halfZ);
    skirt.add(end);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const corner = mesh(new THREE.CylinderGeometry(th / 2, th / 2, th, 8), skirtMat, 0.01);
      corner.position.set(sx * (halfX - th / 2), -1.52, -0.1 + sz * (halfZ - th / 2));
      skirt.add(corner);
    }
  }
  root.add(skirt);

  // ---- 气帘白痕：贴在裙下的一片扁圆盘，海面被吹起的水雾 ----
  //  不描边、不投影、不吃光：它是效果不是构件。
  const spray = new THREE.Mesh(
    new THREE.CircleGeometry(SOCCO.sprayRadius, 24),
    new THREE.MeshBasicMaterial({ color: 0xf2f7f8, transparent: true, opacity: 0.30, depthWrite: false })
  );
  spray.name = "socco-spray";
  spray.rotation.x = -Math.PI / 2;
  spray.position.set(0, -1.86, -0.1);
  spray.castShadow = false;
  spray.receiveShadow = false;
  spray.renderOrder = -2;
  spray.userData.transientFx = true;   // 不进静态合并
  root.add(spray);

  // ---- 尾门跳板：铰链在腹板后沿，关门竖起、开门放到海面 ----
  const hinge = new THREE.Group();
  hinge.name = "socco-ramp-hinge";
  hinge.position.set(0, -1.40, -2.62);
  const ramp = mesh(new THREE.BoxGeometry(1.9, 0.14, SOCCO.rampLength), matTan, 0.012);
  ramp.name = "socco-ramp";
  ramp.position.set(0, 0, -SOCCO.rampLength / 2);
  hinge.add(ramp);
  // 跳板上的防滑肋（与腹下导轨同一套语汇）
  for (let i = 0; i < 8; i++) {
    const rib = decal(new THREE.BoxGeometry(1.86, 0.04, 0.07), matTanDark);
    rib.position.set(0, 0.09, -0.35 - i * 0.32);
    hinge.add(rib);
  }
  // 两侧挡边，免得人从跳板上"走空"
  for (const sx of [-1, 1]) {
    const kerb = mesh(new THREE.BoxGeometry(0.10, 0.20, SOCCO.rampLength - 0.2), matTanDark, 0.008);
    kerb.position.set(sx * 0.95, 0.12, -SOCCO.rampLength / 2);
    hinge.add(kerb);
  }
  hinge.rotation.x = 0;                 // 0 = 关（跳板贴着腹板朝后平放）
  root.add(hinge);
  root.userData.soccoRamp = hinge;

  // ---- 尾口内壁（开门后能看见腹内，不至于是个黑洞）----
  const holdFloor = mesh(new THREE.BoxGeometry(1.94, 0.10, 4.3), matBelly, 0.010);
  holdFloor.name = "socco-hold-floor";
  holdFloor.position.set(0, -1.34, -0.35);
  root.add(holdFloor);
  for (const sx of [-1, 1]) {
    const wall = mesh(new THREE.BoxGeometry(0.10, 1.05, 4.3), matBelly, 0.010);
    wall.position.set(sx * 0.97, -0.82, -0.35);
    root.add(wall);
  }

  // ---- 腹内 14 个座位锚点：2 列 × 7 排 ----
  const hold = new THREE.Group();
  hold.name = "socco-hold";
  const seats = [];
  for (let i = 0; i < SOCCO.holdSeats; i++) {
    const col = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const seat = new THREE.Object3D();
    seat.name = `socco-seat-${i}`;
    // 排距 0.62，从尾口往机头排；人站着（局部 +Y 朝天，面朝 −Z 尾门）
    seat.position.set(col * 0.52, -1.22, -2.05 + row * 0.62);
    seat.rotation.y = Math.PI;          // 面朝尾门，随时能冲出去
    seat.userData.seatIndex = i;
    hold.add(seat);
    seats.push(seat);
  }
  root.add(hold);
  root.userData.soccoSeats = seats;

  // ---- 尾门口两个绳锚：撤离时从这里垂绳，人攀回腹内 ----
  const anchors = [];
  for (const sx of [-1, 1]) {
    const boss = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 8), matDark, 0.008);
    boss.rotation.z = Math.PI / 2;
    boss.position.set(sx * 0.86, -1.22, -2.55);
    boss.name = `socco-rope-anchor-${sx > 0 ? "r" : "l"}`;
    root.add(boss);
    anchors.push(boss);
  }
  root.userData.soccoRopeAnchors = anchors;
}

/**
 * 造一台 SOCCO（＝带货舱的重型运输艇）。
 * @param {object} [opts] 同 `createGateHaulerCraft`，`carrier` 强制为 true
 */
export function createSoccoCraft(opts = {}) {
  const craft = createGateHaulerCraft({ ...opts, carrier: true });
  craft.name = "socco-craft";
  return craft;
}

/**
 * 开合尾门。`open` 0 = 关（跳板收平贴腹）、1 = 全开（末端探到海面）。
 * 幂等、可反复调；不做插值（插值交给调用方的状态机，它才知道节奏）。
 */
export function setSoccoRamp(craft, open = 0) {
  const hinge = craft?.userData?.soccoRamp;
  if (!hinge) return 0;
  const k = Math.max(0, Math.min(1, open));
  hinge.rotation.x = SOCCO.rampOpenAngle * k;
  craft.userData.soccoRampOpen = k;
  return k;
}

/** 尾门是否已开到能放人（≥ 0.9） */
export function soccoRampReady(craft) {
  return (craft?.userData?.soccoRampOpen ?? 0) >= 0.9;
}

/**
 * 腹内座位（世界坐标）。撤离时也用它当"回位点"。
 * @returns {THREE.Vector3[]}
 */
export function soccoSeatWorldPositions(craft, out = []) {
  const seats = craft?.userData?.soccoSeats || [];
  craft?.updateWorldMatrix?.(true, true);
  out.length = 0;
  for (const s of seats) out.push(s.getWorldPosition(new THREE.Vector3()));
  return out;
}

/**
 * 跳板末端（世界坐标）——人就是从这儿踏出去上岸的。
 */
export function soccoRampFootWorld(craft, out = new THREE.Vector3()) {
  const hinge = craft?.userData?.soccoRamp;
  if (!hinge) return out.set(0, 0, 0);
  craft.updateWorldMatrix(true, true);
  return out.set(0, 0, -SOCCO.rampLength).applyMatrix4(hinge.matrixWorld);
}

const _scA = new THREE.Vector3();

/**
 * 贴海巡航：把艇压到离海面 `SOCCO.skimHeight`，气帘随速度脉动。
 *
 * **球面世界**：`up` 是径向（position.normalize()），不是 (0,1,0)。
 * 传 `seaRadius` 就把艇钉到那个半径上；不传就只做气帘与浮沉。
 *
 * @param {THREE.Object3D} craft
 * @param {{t?:number, seaRadius?:number, speed?:number}} [opts]
 */
export function updateSoccoSeaSkim(craft, { t = 0, seaRadius = null, speed = 1 } = {}) {
  if (!craft) return;
  if (Number.isFinite(seaRadius)) {
    _scA.copy(craft.position);
    if (_scA.lengthSq() > 1e-8) {
      const bob = Math.sin(t * 0.9) * 0.16 + Math.sin(t * 2.3) * 0.05;
      craft.position.copy(_scA.normalize().multiplyScalar(seaRadius + SOCCO.skimHeight + bob));
    }
  }
  const spray = craft.getObjectByName?.("socco-spray");
  if (spray) {
    // 气帘随速度胀缩：停下来时收成一圈薄雾，全速时铺开
    const pulse = 0.72 + 0.28 * Math.sin(t * 3.1);
    const k = 0.55 + 0.45 * Math.max(0, Math.min(1, speed));
    spray.scale.setScalar(k * pulse);
    if (spray.material) spray.material.opacity = 0.14 + 0.24 * k * pulse;
  }
}

/**
 * 在叹息之门挂三台重型运输艇（seatRoot 局部坐标：+X 轨右 / +Y 天 / +Z 轨向）。
 * 与 gatePodCraft 的三台侦察艇**错开停位**：运输艇又大又重，停低位、贴夹道，
 * 侦察艇在高处；两拨叠在一个高度会糊成一坨。
 *
 * @param {THREE.Object3D} abandonedGate buildAbandonedGate 的返回值
 * @param {{scale?:number}} [opts]
 * @returns {THREE.Group|null}
 */
export function mountGateHaulerCraft(abandonedGate, { scale = 1 } = {}) {
  const seat = abandonedGate?.userData?.seatRoot;
  if (!seat) return null;
  const old = seat.getObjectByName("gate-hauler-flight");
  if (old) seat.remove(old);

  const flight = new THREE.Group();
  flight.name = "gate-hauler-flight";
  flight.userData.anchor = { kind: "triple-gate" };

  // 门总高 44 / 夹道宽 10：运输艇停在 12~19 的低空，横向不超 ±15
  const berths = [
    { pos: [-9.5, 13.5, -12.0], yaw: 0.52, pitch: -0.04, roll: 0.06, scale: 1.00 },
    { pos: [11.2, 17.5, 6.5], yaw: -2.35, pitch: 0.06, roll: -0.09, scale: 0.84 },
    { pos: [-2.0, 12.0, 15.5], yaw: 0.18, pitch: -0.08, roll: 0.03, scale: 1.10 },
  ];
  berths.forEach((berth, i) => {
    const variant = GATE_HAULER_VARIANTS[i % GATE_HAULER_VARIANTS.length];
    const craft = createGateHaulerCraft({
      scale: berth.scale * scale,
      shell: variant.shell,
      belly: variant.belly,
      serial: variant.serial,
    });
    craft.name = `gate-hauler-${variant.id}`;
    craft.position.fromArray(berth.pos);
    craft.rotation.set(berth.pitch, berth.yaw, berth.roll, "YXZ");
    craft.userData.haulerVariant = variant.id;
    craft.userData.basePosition = berth.pos.slice();
    flight.add(craft);
  });

  seat.add(flight);
  return flight;
}

/**
 * 悬停摆动（纯表现层）。运输艇比侦察艇重，摆幅更小、周期更慢。
 */
export function updateGateHaulerCraft(flight, t = 0) {
  if (!flight) return;
  flight.children.forEach((craft, i) => {
    const base = craft.userData.basePosition;
    if (!base) return;
    const phase = i * 1.7;
    craft.position.y = base[1] + Math.sin(t * 0.44 + phase) * 0.26;
    craft.position.z = base[2] + Math.sin(t * 0.31 + phase * 1.3) * 0.18;
    craft.rotation.z = (craft.userData.baseRoll ??= craft.rotation.z) + Math.sin(t * 0.37 + phase) * 0.022;
  });
}
