import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";

/**
 * 低多边形（Low Poly）特洛伊木马——纯积木式几何解构。
 * 将原木肌理 / 肌肉线条拆成硬朗的 Box / 棱柱(Cylinder) 相互堆叠：
 *   轮车底座 + 低面车轮 → 锥形马腿 → 拉长的马身 → 前倾 25° 的脖子 →
 *   微低 30°、Z 轴拉长的马面 → 三角耳朵 → 锯齿状方块马鬃。
 * 并叠加：错落“补丁木块” + 横向黑色木板缝隙拼接线，增强手作拼装感。
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

  // 统一原木硬边材质（红褐色平涂，与插画一致）
  const wood = toonMat(0x8b4513, { flatShading: true });   // 经典红褐原木
  const darkWood = toonMat(0x4a2c12, { flatShading: true }); // 深木（轮/鬃/缝隙）
  const rope = toonMat(0x33261a, { flatShading: true });
  const baseWood = toonMat(0x7a4a1d, { flatShading: true });

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
    new THREE.BoxGeometry(4.4 * S, 0.34 * S, 6.6 * S),
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
    sleeper.position.set(0, 0.2 * S, zSign * 2.3 * S);
    g.add(sleeper);
  }

  // 低面六角车轮（CylinderGeometry r,r,h,6）
  const wheelGeo = new THREE.CylinderGeometry(0.42 * S, 0.42 * S, 0.3 * S, 6);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-2.2, 0.42, 2.35],
    [2.2, 0.42, 2.35],
    [-2.2, 0.42, -2.35],
    [2.2, 0.42, -2.35],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = part(wheelGeo, darkWood, "troy-wheel", 0.02);
    wheel.position.set(wx * S, wy * S, wz * S);
    g.add(wheel);
  }

  // ============ 2. 四肢 (Legs) ============
  // 上细下粗的五棱柱马腿，拉长到车身
  const legGeo = new THREE.CylinderGeometry(0.24 * S, 0.4 * S, 2.45 * S, 5);
  const legPositions = [
    [-1.3, 1.7, 1.62],
    [1.3, 1.7, 1.62],
    [-1.3, 1.7, -1.62],
    [1.3, 1.7, -1.62],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = part(legGeo, wood, "troy-leg", 0.026);
    leg.position.set(lx * S, ly * S, lz * S);
    g.add(leg);
  }

  // 腿部补丁木块
  for (let i = 0; i < 10; i++) {
    const px = (rand() - 0.5) * 2.6 * S;
    const pz = (rand() - 0.5) * 3.4 * S;
    const patch = part(
      new THREE.BoxGeometry((0.2 + rand() * 0.25) * S, 0.03 * S, (0.3 + rand() * 0.3) * S),
      i % 3 === 0 ? rope : wood,
      "troy-leg-patch",
      0.012
    );
    patch.position.set(px, (1.15 + rand() * 1.05) * S, pz);
    patch.rotation.set(0, rand() * Math.PI, (rand() - 0.5) * 0.05);
    g.add(patch);
  }

  // ============ 3. 躯干 (Torso) ============
  // 拉长且略加厚的马身：给头部留出稳定的身体基准，Z 轴(长) > X 轴(宽)
  const body = part(
    new THREE.BoxGeometry(2.85 * S, 2.45 * S, 4.9 * S),
    wood,
    "troy-torso",
    0.03
  );
  body.position.set(0, 3.78 * S, 0);
  g.add(body);

  // 马腹补丁木块：错落拼板感
  for (let i = 0; i < 22; i++) {
    const bx = (rand() - 0.5) * 2.2 * S;
    const by = (2.72 + rand() * 1.92) * S;
    const bz = (rand() - 0.5) * 4.5 * S;
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

  // ============ 3.5 横向黑色木板缝隙拼接线 ============
  // 沿马身 / 脖子 / 马头外侧散布极薄深色长条，模拟图中的木板接缝拼接线。
  const seamCount = 16;
  for (let i = 0; i < seamCount; i++) {
    const long = i % 3 === 0; // 部分接缝更长
    const seam = part(
      new THREE.BoxGeometry(
        (long ? 0.9 : 0.5) * S,
        0.02 * S,
        0.02 * S
      ),
      darkWood,
      "troy-wood-seam",
      0.006
    );
    // 分布到马身侧面（含腹侧与背侧）
    const ring = i % 2;
    const sx = (rand() - 0.5) * 2.4 * S;
    const sy = (2.8 + rand() * 2.0) * S;
    const sz = (rand() - 0.5) * 4.4 * S;
    seam.position.set(sx, sy, sz);
    // 法向朝外：沿侧面的 -X 或 +X 对齐，制造“钉在木板上的横缝”
    seam.rotation.set((rand() - 0.5) * 0.06, (rand() - 0.5) * 0.3, 0);
    seam.position.x = ring === 0 ? 1.45 * S : -1.45 * S;
    seam.rotation.y += ring === 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(seam);
  }

  // 马身纵向木肋（深炭色细棱柱），加强拼接线
  for (let i = 0; i < 3; i++) {
    const rib = part(
      new THREE.CylinderGeometry(0.05 * S, 0.05 * S, 4.9 * S, 4),
      rope,
      "troy-body-rib",
      0.012
    );
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = Math.PI / 4;
    rib.position.set((i - 1) * 1.0 * S, 3.68 * S, 0);
    g.add(rib);
  }

  // ============ 3.6 夜间潜入舱门 (Belly Hatch) ==========
  // 舱口压在马腹最低处，白天闭合；夜晚由两扇木板向下分开，
  // 让绳索和纸士兵从腹部中央明确露出来。
  const bellyHatch = new THREE.Group();
  bellyHatch.name = "troy-belly-hatch";
  const cavity = part(
    new THREE.BoxGeometry(1.7 * S, 0.08 * S, 1.9 * S),
    darkWood,
    "troy-belly-cavity",
    0.014
  );
  cavity.position.set(0, 2.48 * S, 0);
  bellyHatch.add(cavity);
  const doors = [];
  for (const side of [-1, 1]) {
    const door = part(
      new THREE.BoxGeometry(0.82 * S, 0.08 * S, 1.82 * S),
      baseWood,
      side < 0 ? "troy-belly-door-left" : "troy-belly-door-right",
      0.018
    );
    door.position.set(side * 0.43 * S, 2.53 * S, 0);
    bellyHatch.add(door);
    doors.push(door);
  }
  g.add(bellyHatch);
  const setBellyOpen = (amount = 0) => {
    const open = THREE.MathUtils.clamp(Number(amount) || 0, 0, 1);
    doors[0].rotation.z = 0.92 * open;
    doors[1].rotation.z = -0.92 * open;
    cavity.visible = open > 0.01;
    bellyHatch.userData.open = open;
  };
  bellyHatch.userData = { cavity, doors, setOpen: setBellyOpen, open: 0 };
  g.userData.bellyHatch = bellyHatch.userData;
  g.userData.setBellyOpen = setBellyOpen;
  setBellyOpen(0);

  // ============ 4. 倾斜的脖子 (Animated Neck) ============
  // 脖子随躯干加厚，并让连接段更宽，避免头部像单独插在身体上。
  const neck = part(
    new THREE.BoxGeometry(0.9 * S, 1.68 * S, 0.9 * S),
    wood,
    "troy-neck",
    0.026
  );
  neck.position.set(0, 5.1 * S, 1.52 * S);
  neck.rotation.x = 0.42; // 前倾约 24°
  g.add(neck);

  // 脖子侧面的木板缝隙
  for (let i = 0; i < 3; i++) {
    const nseam = part(
      new THREE.BoxGeometry(0.02 * S, 0.84 * S, 0.02 * S),
      darkWood,
      "troy-neck-seam",
      0.005
    );
    nseam.position.set((i % 2 === 0 ? 1 : -1) * 0.45 * S, 5.08 * S, 1.52 * S);
    g.add(nseam);
  }

  // ============ 5. 与躯干协调的马头 (Dynamic Head) ============
  // 头部相对身体适度加宽加高，仍保持 Z 轴拉长；与加宽后的脖子自然重叠。
  const head = part(
    new THREE.BoxGeometry(0.82 * S, 0.78 * S, 1.5 * S),
    wood,
    "troy-head",
    0.028
  );
  head.position.set(0, 6.02 * S, 1.86 * S);
  head.rotation.x = -0.28; // 向下低头约 16°，打破呆板
  g.add(head);

  // 马鼻保持比头部略窄，但同步放大，避免头身比例调整后鼻部过小。
  const snout = part(
    new THREE.BoxGeometry(0.6 * S, 0.5 * S, 0.72 * S),
    darkWood,
    "troy-snout",
    0.024
  );
  snout.position.set(0, 5.73 * S, 2.53 * S);
  snout.rotation.x = -0.25;
  g.add(snout);

  // 灵魂装饰：三角耳朵（3 面圆锥，稍微朝后抿）
  const earGeo = new THREE.ConeGeometry(0.16 * S, 0.46 * S, 3);
  earGeo.rotateX(0.2);
  for (const side of [-1, 1]) {
    const ear = part(earGeo, darkWood, "troy-ear", 0.014);
    ear.position.set(side * 0.3 * S, 6.56 * S, 1.6 * S);
    ear.rotation.set(-0.15, 0, side * 0.1);
    g.add(ear);
  }

  // 锯齿状马鬃：一排渐小方块叠在脖子后，平替木片鬃毛
  const maneCount = 5;
  for (let i = 0; i < maneCount; i++) {
    const maneGeo = new THREE.BoxGeometry(0.34 * S, (0.66 - i * 0.09) * S, 0.66 * S);
    const maneUnit = part(maneGeo, darkWood, "troy-mane", 0.018);
    maneUnit.position.set(0, (5.5 - i * 0.42) * S, (1.42 - i * 0.24) * S);
    maneUnit.rotation.x = 0.42;
    g.add(maneUnit);
  }

  // ============ 6. 拉条与绳索 (Strap Ribs) ============
  // 胸部/颈部横向绳索
  const strapGeo = new THREE.CylinderGeometry(0.055 * S, 0.055 * S, 2.2 * S, 4);
  for (const [sx, sy, sz, rotZ] of [
    [0, 4.7, 1.05, 0],
    [0, 5.5, 2.35, 0],
    [0, 3.3, -1.5, 0],
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
    tie.position.set(side * 1.9 * S, 0.75 * S, 2.35 * S);
    tie.rotation.z = side * 0.15;
    g.add(tie);
  }

  return g;
}
