// =====================================================================
//  东方水墨古风资产：扭曲古松 / 仙鹤 / 黑岩
//  参考雪舟《四季花鸟图屏风》：焦墨树干、墨绿松冠、丹顶鹤、加粗勾线
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

const BARK = 0x665d52; // 老松灰褐树皮
const BARK_DARK = 0x453f37;
const PINE = 0x2f6947; // 修剪松冠主色
const PINE_DARK = 0x1e4a33;
const PINE_LIGHT = 0x4a8055;
const CRANE_WHITE = 0xf2ede2; // 乳白
const INK = 0x1c1a17; // 墨黑
const CINNABAR = 0xa63a2e; // 丹红
const BLACK_ROCK = 0x23211d; // 黑岩

const O_BOLD = 0.032; // 古风加粗勾线

let pineSerial = 0;

function pineRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * 日式造型松：弯曲粗干、少量横向骨枝、层层修剪成云片的松冠。
 * 形态依据真实庭园松而不是递归分形树；随机只改变姿态，不改变树的骨架语法。
 */
export function createAncientPineTree(seed = 7301 + pineSerial++ * 97) {
  const g = new THREE.Group();
  const rnd = pineRng(seed);
  const barkMat = toonMat(BARK);
  const barkDarkMat = toonMat(BARK_DARK);
  const leafMats = [toonMat(PINE_DARK), toonMat(PINE), toonMat(PINE_LIGHT)];
  const yAxis = new THREE.Vector3(0, 1, 0);

  function segment(a, b, r0, r1, material = barkMat, outline = O_BOLD * 0.72) {
    const delta = new THREE.Vector3().subVectors(b, a);
    const len = delta.length();
    const mesh = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(r1, r0, len, 7, 1, false)),
      material
    );
    mesh.position.copy(a).addScaledVector(delta, 0.5);
    mesh.quaternion.setFromUnitVectors(yAxis, delta.normalize());
    mesh.castShadow = true;
    addOutline(mesh, outline, 0x2b2823, 0.045);
    g.add(mesh);
    return mesh;
  }

  function branch(points, r0, r1) {
    for (let i = 0; i < points.length - 1; i++) {
      const t = i / Math.max(1, points.length - 2);
      segment(
        points[i],
        points[i + 1],
        THREE.MathUtils.lerp(r0, r1, t),
        THREE.MathUtils.lerp(r0, r1, Math.min(1, t + 0.45)),
        i === 0 ? barkMat : barkDarkMat,
        O_BOLD * (i === 0 ? 0.64 : 0.48)
      );
    }
  }

  /** 修剪后的云片冠：宽、扁、下暗上亮，外轮廓有少量不规则起伏。 */
  function crown(center, width, depth, thickness, yaw = 0, fullness = 1) {
    const pad = new THREE.Group();
    pad.position.copy(center);
    pad.rotation.y = yaw;
    const blobs = Math.max(4, Math.round(4 * fullness));
    for (let i = 0; i < blobs; i++) {
      const edge = blobs === 1 ? 0 : i / (blobs - 1) - 0.5;
      const mesh = new THREE.Mesh(
        facet(new THREE.IcosahedronGeometry(0.5, 1)),
        leafMats[i === blobs - 1 ? 2 : i === 0 ? 0 : 1]
      );
      mesh.position.set(
        edge * width * 0.62 + (rnd() - 0.5) * width * 0.08,
        (i % 2) * thickness * 0.2 + (rnd() - 0.5) * 0.04,
        (rnd() - 0.5) * depth * 0.34
      );
      const taper = 1 - Math.abs(edge) * 0.35;
      mesh.scale.set(
        width * 0.48 * taper,
        thickness * (1.15 + rnd() * 0.15),
        depth * (0.58 + rnd() * 0.1)
      );
      mesh.rotation.set((rnd() - 0.5) * 0.12, rnd() * Math.PI, (rnd() - 0.5) * 0.08);
      mesh.castShadow = true;
      addOutline(mesh, O_BOLD * 0.38, 0x173227, 0.035);
      pad.add(mesh);
    }
    g.add(pad);
  }

  const lean = (rnd() > 0.5 ? 1 : -1) * (0.52 + rnd() * 0.5);
  const depthLean = (rnd() - 0.5) * 0.5;
  const trunk = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.04 + lean * 0.12, 0.7, depthLean * 0.1),
    new THREE.Vector3(-0.12 + lean * 0.3, 1.45, 0.1 + depthLean * 0.25),
    new THREE.Vector3(0.08 + lean * 0.55, 2.25, -0.04 + depthLean * 0.5),
    new THREE.Vector3(-0.04 + lean * 0.8, 3.08, 0.12 + depthLean * 0.72),
    new THREE.Vector3(0.2 + lean, 3.82, 0.02 + depthLean),
    new THREE.Vector3(0.08 + lean * 1.12, 4.45, 0.12 + depthLean * 1.1),
  ];
  for (let i = 0; i < trunk.length - 1; i++) {
    const t = i / (trunk.length - 2);
    segment(trunk[i], trunk[i + 1], 0.3 - t * 0.19, 0.265 - t * 0.19);
  }

  // 外露根盘让树真正“抓”在球面上，呼应参考照片中的老松根势。
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.35;
    const end = new THREE.Vector3(Math.cos(a) * (0.62 + rnd() * 0.25), 0.03, Math.sin(a) * (0.62 + rnd() * 0.25));
    const mid = end.clone().multiplyScalar(0.46);
    mid.y = 0.12 + rnd() * 0.06;
    branch([trunk[0], mid, end], 0.16, 0.035);
  }

  const flip = rnd() > 0.5 ? 1 : -1;
  const arms = [
    { at: 2, side: -1, len: 1.75, rise: 0.16, z: 0.35, crown: [1.75, 0.82, 0.3] },
    { at: 2, side: 1, len: 1.35, rise: 0.08, z: -0.45, crown: [1.35, 0.72, 0.28] },
    { at: 3, side: 1, len: 1.9, rise: 0.2, z: 0.28, crown: [1.85, 0.85, 0.3] },
    { at: 4, side: -1, len: 1.45, rise: 0.28, z: -0.28, crown: [1.5, 0.76, 0.3] },
    { at: 5, side: 1, len: 1.22, rise: 0.34, z: 0.2, crown: [1.3, 0.7, 0.31] },
  ];

  for (let i = 0; i < arms.length; i++) {
    const spec = arms[i];
    const start = trunk[spec.at].clone();
    const side = spec.side * flip;
    const bend = new THREE.Vector3(
      start.x + side * spec.len * 0.48,
      start.y + spec.rise * 0.25 - 0.05,
      start.z + spec.z * 0.45
    );
    const tip = new THREE.Vector3(
      start.x + side * spec.len,
      start.y + spec.rise,
      start.z + spec.z
    );
    const upTip = tip.clone();
    upTip.y += 0.14 + rnd() * 0.12;
    branch([start, bend, tip, upTip], 0.13 - i * 0.011, 0.035);
    const yaw = Math.atan2(spec.z, side * spec.len);
    crown(upTip, spec.crown[0], spec.crown[1], spec.crown[2], yaw, i === 2 ? 1.2 : 1);

  }

  // 顶端分成两束，避免圣诞树式尖顶，形成参考图中的横向“伞盖”。
  const top = trunk[trunk.length - 1];
  for (const side of [-1, 1]) {
    const tip = top.clone().add(new THREE.Vector3(side * 0.52, 0.42 + (side > 0 ? 0.12 : 0), side * 0.12));
    branch([top, top.clone().lerp(tip, 0.52).add(new THREE.Vector3(0, 0.08, 0)), tip], 0.085, 0.03);
    crown(tip, side > 0 ? 1.35 : 1.05, 0.78, 0.34, side * 0.16, 1.05);
  }

  g.rotation.y = (rnd() - 0.5) * 0.55;
  g.scale.setScalar(1.02);
  g.userData.collideRadius = 0.58;
  g.userData.kind = "gardenPine";
  return g;
}


/**
 * 仙鹤（丹顶鹤）：基础几何体实时拼接。
 * 长脖 S 曲、乳白身体、墨黑尾羽与喙、丹红头顶。
 */
export function createCraneNPC() {
  const g = new THREE.Group();
  const white = toonMat(CRANE_WHITE);
  const ink = toonMat(INK);
  const red = toonMat(CINNABAR);

  // 身体：压扁球（朝 +x 为首）
  const body = new THREE.Mesh(facet(new THREE.SphereGeometry(0.32, 7, 5)), white);
  body.scale.set(1.25, 0.78, 0.85);
  body.position.y = 0.62;
  body.castShadow = true;
  addOutline(body, 0.024);
  g.add(body);

  // 翅膀：两侧扁平盒，乳白
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(facet(new THREE.BoxGeometry(0.34, 0.07, 0.2)), white);
    wing.position.set(-0.02, 0.7, side * 0.3);
    wing.rotation.x = side * 0.35;
    wing.castShadow = true;
    addOutline(wing, 0.02);
    g.add(wing);
  }

  // 尾羽：墨黑锥簇（向后上方）
  for (let i = 0; i < 3; i++) {
    const tail = new THREE.Mesh(facet(new THREE.ConeGeometry(0.07, 0.5, 4)), ink);
    tail.position.set(-0.42, 0.66 + i * 0.03, (i - 1) * 0.09);
    tail.rotation.z = 1.15 + (i - 1) * 0.18; // 指向 -x 并略上扬
    tail.castShadow = true;
    addOutline(tail, 0.018);
    g.add(tail);
  }

  // 脖子：两段 S 曲细圆柱
  const neck1 = new THREE.Group();
  neck1.position.set(0.3, 0.72, 0);
  neck1.rotation.z = -0.35; // 前倾
  const n1 = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 5)), white);
  n1.position.y = 0.21;
  n1.castShadow = true;
  addOutline(n1, 0.016);
  neck1.add(n1);
  const neck2 = new THREE.Group();
  neck2.position.y = 0.42;
  neck2.rotation.z = 0.75; // 回勾成 S
  const n2 = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.04, 0.045, 0.4, 5)), white);
  n2.position.y = 0.2;
  n2.castShadow = true;
  addOutline(n2, 0.016);
  neck2.add(n2);
  neck1.add(neck2);
  g.add(neck1);

  // 头 + 喙 + 丹红顶（挂在颈二顶端）
  const headG = new THREE.Group();
  headG.position.y = 0.42;
  const head = new THREE.Mesh(facet(new THREE.SphereGeometry(0.1, 6, 5)), white);
  head.castShadow = true;
  addOutline(head, 0.014);
  headG.add(head);
  const beak = new THREE.Mesh(facet(new THREE.ConeGeometry(0.035, 0.24, 4)), ink);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.2, 0, 0);
  addOutline(beak, 0.01);
  headG.add(beak);
  const crown = new THREE.Mesh(facet(new THREE.SphereGeometry(0.05, 5, 4)), red);
  crown.scale.set(1, 0.6, 1);
  crown.position.set(-0.02, 0.09, 0);
  addOutline(crown, 0.008);
  headG.add(crown);
  neck2.add(headG);

  // 腿：两根细墨柱
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 4)), ink);
    leg.position.set(0.06, 0.25, side * 0.1);
    addOutline(leg, 0.01);
    g.add(leg);
  }

  g.userData.collideRadius = 0.45;
  return g;
}

/**
 * 黑岩：顶点扰动二十面体，焦墨色（仙鹤立岩用）。
 */
export function createBlackRock() {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.55, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const cache = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    if (!cache.has(key)) cache.set(key, 0.75 + Math.random() * 0.5);
    v.multiplyScalar(cache.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const rock = new THREE.Mesh(facet(geo), toonMat(BLACK_ROCK));
  rock.scale.set(1.1, 0.55, 0.95);
  rock.position.y = 0.26;
  rock.castShadow = true;
  rock.receiveShadow = true;
  addOutline(rock, O_BOLD);
  g.add(rock);
  g.userData.topY = 0.55; // 岩顶近似高度（仙鹤站立面）
  g.userData.collideRadius = 0.7;
  return g;
}

/** 组合：仙鹤立于黑岩之上（单 Group，底部原点） */
export function createCraneOnRock() {
  const g = new THREE.Group();
  const rock = createBlackRock();
  g.add(rock);
  const crane = createCraneNPC();
  crane.position.y = rock.userData.topY;
  crane.rotation.y = Math.random() * Math.PI * 2;
  g.add(crane);
  g.userData.collideRadius = 0.7;
  return g;
}
