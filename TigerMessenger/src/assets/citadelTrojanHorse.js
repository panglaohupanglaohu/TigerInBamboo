import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";

/**
 * 低多边形（Low Poly）特洛伊木马——纯积木式几何解构。
 * 将原木肌理 / 肌肉线条拆成硬朗的 Box / 棱柱(Cylinder) 相互堆叠：
 *   轮车底座 + 低面车轮 → 锥形马腿 → 大木箱躯干 → 前倾脖子 →
 *   五棱柱马头 → 锯齿状方块马鬃；并散布极薄“补丁木块”增强手作拼装感。
 *
 * 材质沿用圣城 toonMat（硬边 Cel + 墨线轮廓），保证与护城河/朝圣水阶同画风。
 *
 * @param {object} [opts]
 * @param {string} [opts.name]
 * @param {number} [opts.seed]     随机补丁木块种子
 * @param {number} [opts.scale]    整体缩放
 * @returns {THREE.Group}
 */
export function createCitadelTrojanHorse({
  name = "citadel-trojan-horse",
  seed = 9901,
  scale = 1,
} = {}) {
  const g = new THREE.Group();
  g.name = name;

  // 统一原木硬边材质（与圣城 toonMat 同构，flatShading 强制硬边）
  const wood = toonMat(0x7c4a22, { flatShading: true });
  const darkWood = toonMat(0x4a2c12, { flatShading: true });
  const rope = toonMat(0x33261a, { flatShading: true });
  const baseWood = toonMat(0x6b4218, { flatShading: true });

  // 简易 LCG 伪随机，保证同 seed 拼块布局稳定
  let state = seed >>> 0;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const part = (geometry, material, pname, outline = 0.028, dry = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = pname;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addOutline(mesh, outline, 0x1c2523, dry);
    return mesh;
  };

  const S = scale;

  // ============ 1. 轮车底座 (Base & Wheels) ============
  // 载重平板车：扁平长方体
  const platform = part(
    new THREE.BoxGeometry(4.4 * S, 0.34 * S, 6.4 * S),
    baseWood,
    "troy-plank-platform",
    0.032
  );
  platform.position.y = 0.42 * S;
  g.add(platform);

  // 底部两根枕木（横向），衔接车轮
  for (const zSign of [1, -1]) {
    const sleeper = part(
      new THREE.BoxGeometry(4.8 * S, 0.26 * S, 0.5 * S),
      darkWood,
      "troy-axle-sleeper",
      0.024
    );
    sleeper.position.set(0, 0.2 * S, zSign * 2.2 * S);
    g.add(sleeper);
  }

  // 低面六角车轮（CylinderGeometry r,r,h,6）
  const wheelGeo = new THREE.CylinderGeometry(0.42 * S, 0.42 * S, 0.3 * S, 6);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-2.2, 0.42, 2.3],
    [2.2, 0.42, 2.3],
    [-2.2, 0.42, -2.3],
    [2.2, 0.42, -2.3],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = part(wheelGeo, darkWood, "troy-wheel", 0.02);
    wheel.position.set(wx * S, wy * S, wz * S);
    g.add(wheel);
  }

  // ============ 2. 四肢 (Legs) ============
  // 上细下粗的五棱柱马腿
  const legGeo = new THREE.CylinderGeometry(0.24 * S, 0.4 * S, 2.3 * S, 5);
  const legPositions = [
    [-1.25, 1.62, 1.55],
    [1.25, 1.62, 1.55],
    [-1.25, 1.62, -1.55],
    [1.25, 1.62, -1.55],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = part(legGeo, wood, "troy-leg", 0.026);
    leg.position.set(lx * S, ly * S, lz * S);
    g.add(leg);
  }

  // 腿部补丁木块
  for (let i = 0; i < 10; i++) {
    const px = (rand() - 0.5) * 2.4 * S;
    const pz = (rand() - 0.5) * 3.2 * S;
    const patch = part(
      new THREE.BoxGeometry((0.2 + rand() * 0.25) * S, 0.03 * S, (0.3 + rand() * 0.3) * S),
      i % 3 === 0 ? rope : wood,
      "troy-leg-patch",
      0.012
    );
    patch.position.set(px, (1.1 + rand() * 1.0) * S, pz);
    patch.rotation.set(0, rand() * Math.PI, (rand() - 0.5) * 0.05);
    g.add(patch);
  }

  // ============ 3. 躯干 (Torso) ============
  const body = part(
    new THREE.BoxGeometry(2.7 * S, 2.3 * S, 4.6 * S),
    wood,
    "troy-torso",
    0.03
  );
  body.position.set(0, 3.6 * S, 0);
  g.add(body);

  // 马腹补丁木块：错落拼板感
  for (let i = 0; i < 22; i++) {
    const bx = (rand() - 0.5) * 2.2 * S;
    const by = (2.6 + rand() * 1.8) * S;
    const bz = (rand() - 0.5) * 4.2 * S;
    const patch = part(
      new THREE.BoxGeometry((0.25 + rand() * 0.35) * S, 0.035 * S, (0.4 + rand() * 0.5) * S),
      i % 4 === 0 ? rope : i % 3 === 0 ? darkWood : wood,
      "troy-body-patch",
      0.014
    );
    patch.position.set(bx, by, bz);
    patch.rotation.set((rand() - 0.5) * 0.04, rand() * Math.PI, (rand() - 0.5) * 0.04);
    g.add(patch);
  }

  // 马身纵向木肋（深炭色细棱柱），加强拼接线
  for (let i = 0; i < 3; i++) {
    const rib = part(
      new THREE.CylinderGeometry(0.05 * S, 0.05 * S, 4.6 * S, 4),
      rope,
      "troy-body-rib",
      0.012
    );
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = Math.PI / 4;
    rib.position.set((i - 1) * 1.0 * S, 3.5 * S, 0);
    g.add(rib);
  }

  // ============ 4. 脖子 (Neck) ============
  const neck = part(
    new THREE.BoxGeometry(1.25 * S, 2.3 * S, 1.25 * S),
    wood,
    "troy-neck",
    0.028
  );
  neck.position.set(0, 5.0 * S, 1.7 * S);
  neck.rotation.x = 0.42;
  g.add(neck);

  // ============ 5. 头部与马鬃 (Head & Mane) ============
  // 五棱柱马脸（口鼻略尖）
  const headGeo = new THREE.CylinderGeometry(0.38 * S, 0.62 * S, 1.6 * S, 5);
  headGeo.rotateX(Math.PI / 3);
  const head = part(headGeo, wood, "troy-head", 0.028);
  head.position.set(0, 5.95 * S, 2.15 * S);
  g.add(head);

  // 耳部：两个小三角棱柱
  for (const side of [-1, 1]) {
    const ear = part(
      new THREE.ConeGeometry(0.13 * S, 0.5 * S, 4),
      darkWood,
      "troy-ear",
      0.016
    );
    ear.position.set(side * 0.42 * S, 6.6 * S, 1.7 * S);
    ear.rotation.set(-0.15, 0, side * 0.12);
    g.add(ear);
  }

  // 锯齿状马鬃：一排渐小方块叠在脖子后，平替木片鬃毛
  const maneCount = 5;
  for (let i = 0; i < maneCount; i++) {
    const maneGeo = new THREE.BoxGeometry(0.32 * S, (0.62 - i * 0.08) * S, 0.62 * S);
    const maneUnit = part(maneGeo, darkWood, "troy-mane", 0.018);
    maneUnit.position.set(0, (5.4 - i * 0.38) * S, (1.35 - i * 0.22) * S);
    maneUnit.rotation.x = 0.42;
    g.add(maneUnit);
  }

  // ============ 6. 拉条与绳索 (Strap Ribs) ============
  // 胸部/颈部横向绳索
  const strapGeo = new THREE.CylinderGeometry(0.055 * S, 0.055 * S, 2.2 * S, 4);
  for (const [sx, sy, sz, rotZ] of [
    [0, 4.6, 1.0, 0],
    [0, 5.4, 2.2, 0],
    [0, 3.2, -1.4, 0],
  ]) {
    const strap = part(strapGeo, rope, "troy-strap", 0.01);
    strap.position.set(sx * S, sy * S, sz * S);
    strap.rotation.x = Math.PI / 2;
    strap.rotation.z = rotZ;
    g.add(strap);
  }

  // 底座与车轮之间绑绳
  for (const side of [-1, 1]) {
    const tie = part(
      new THREE.CylinderGeometry(0.05 * S, 0.05 * S, 1.2 * S, 4),
      rope,
      "troy-tie-rope",
      0.01
    );
    tie.position.set(side * 1.9 * S, 0.75 * S, 2.3 * S);
    tie.rotation.z = side * 0.15;
    g.add(tie);
  }

  return g;
}
