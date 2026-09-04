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

  root.scale.setScalar(scale);
  root.userData.haulerSerial = serial;
  root.userData.haulerLength = 7.6 * scale;
  return root;
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
