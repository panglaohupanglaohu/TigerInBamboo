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
  const wood = toonMat(0x8a6140, { flatShading: true });   // 风化橡木，比原 0x8b4513 去饱和
  const darkWood = toonMat(0x4b3725, { flatShading: true }); // 深木（轮/鬃/缝隙）
  const rope = toonMat(0x33261a, { flatShading: true });
  const baseWood = toonMat(0xa07c57, { flatShading: true }); // 浅色编条，和深条拉开明暗

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
    new THREE.BoxGeometry(5.0 * S, 0.40 * S, 7.6 * S),
    baseWood,
    "troy-plank-platform",
    0.032
  );
  platform.position.y = 0.42 * S;
  g.add(platform);

  // 底部两根枕木（横向），衔接车轮
  for (const zSign of [1, -1]) {
    const sleeper = part(
      new THREE.BoxGeometry(5.4 * S, 0.32 * S, 0.62 * S),
      darkWood,
      "troy-axle-sleeper",
      0.024
    );
    sleeper.position.set(0, 0.24 * S, zSign * 2.7 * S);
    g.add(sleeper);
  }

  // 低面六角车轮（CylinderGeometry r,r,h,6）
  const wheelGeo = new THREE.CylinderGeometry(0.68 * S, 0.68 * S, 0.38 * S, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-2.55, 0.68, 2.7],
    [2.55, 0.68, 2.7],
    [-2.55, 0.68, -2.7],
    [2.55, 0.68, -2.7],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = part(wheelGeo, darkWood, "troy-wheel", 0.02);
    wheel.position.set(wx * S, wy * S, wz * S);
    g.add(wheel);
    const hub = part(
      new THREE.CylinderGeometry(0.17 * S, 0.17 * S, 0.46 * S, 6),
      baseWood, "troy-wheel-hub", 0.012
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx * S, wy * S, wz * S);
    g.add(hub);
    for (let sp = 0; sp < 3; sp++) {
      const spoke = part(
        new THREE.BoxGeometry(0.30 * S, 1.22 * S, 0.11 * S),
        baseWood, "troy-wheel-spoke", 0.008
      );
      spoke.position.set(wx * S, wy * S, wz * S);
      spoke.rotation.set(0, Math.PI / 2, (sp * Math.PI) / 3);
      g.add(spoke);
    }
  }

  // ============ 2. 四肢 (Legs) ============
  // 上细下粗的五棱柱马腿，拉长到车身
  const legGeo = new THREE.CylinderGeometry(0.30 * S, 0.54 * S, 2.95 * S, 5);
  const legPositions = [
    [-1.48, 1.95, 1.92],
    [1.48, 1.95, 1.92],
    [-1.48, 1.95, -1.92],
    [1.48, 1.95, -1.92],
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
  // 拉长且厚重的马身：参考图中躯干是主要体量，Z 轴(长) > X 轴(宽)。
  // 头部会按这个基准同步放大，避免出现“小头木马”。
  const body = part(
    new THREE.BoxGeometry(3.35 * S, 2.95 * S, 6.2 * S),
    wood,
    "troy-torso",
    0.03
  );
  body.position.set(0, 4.15 * S, 0);
  g.add(body);

  // ============ 3.2 编条木纹 (Woven Planking) ============
  // 目标图的木马是一圈圈横向编条，不是随机补丁。随机小块在远处糊成一团色斑，
  // 规则的横向环带才能在剪影上读出“编木”。沿 Z 等距铺环带，环带之间留缝，
  // 再用纵向立筋压住，形成经纬交织。
  const WEAVE_BANDS = 9;
  const bodyW = 3.35, bodyH = 2.95, bodyL = 6.2, bodyY = 4.15;
  for (let i = 0; i < WEAVE_BANDS; i++) {
    const t = (i + 0.5) / WEAVE_BANDS;
    const bz = (t - 0.5) * bodyL * S;
    const alt = i % 2 === 0;
    const bandMat = alt ? wood : baseWood;
    const bulge = alt ? 1.035 : 1.012;   // 交替外凸，产生编织的起伏
    const band = part(
      new THREE.BoxGeometry(bodyW * bulge * S, bodyH * 0.985 * S, (bodyL / WEAVE_BANDS) * 0.74 * S),
      bandMat,
      "troy-body-patch",
      0.016
    );
    band.position.set(0, bodyY * S, bz);
    g.add(band);
    // 环带之间的深色缝隙
    const gap = part(
      new THREE.BoxGeometry(bodyW * 1.045 * S, bodyH * 0.94 * S, (bodyL / WEAVE_BANDS) * 0.18 * S),
      darkWood,
      "troy-wood-seam",
      0.008
    );
    gap.position.set(0, bodyY * S, bz + (bodyL / WEAVE_BANDS) * 0.46 * S);
    g.add(gap);
  }
  // 纵向立筋：压在环带外侧，交织感的另一半
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const stile = part(
        new THREE.BoxGeometry(0.13 * S, 0.42 * S, bodyL * 0.96 * S),
        darkWood,
        "troy-body-stile",
        0.01
      );
      stile.position.set(sx * bodyW * 0.53 * S, (bodyY + (k - 1) * 0.92) * S, 0);
      g.add(stile);
    }
  }
  // 背脊与腹底各一条压条，封住上下口
  for (const sy of [1, -1]) {
    const cap = part(
      new THREE.BoxGeometry(bodyW * 0.92 * S, 0.16 * S, bodyL * 0.98 * S),
      baseWood,
      "troy-body-cap",
      0.012
    );
    cap.position.set(0, (bodyY + sy * bodyH * 0.5) * S, 0);
    g.add(cap);
  }

  // 马身纵向木肋（深炭色细棱柱），加强拼接线
  for (let i = 0; i < 3; i++) {
    const rib = part(
      new THREE.CylinderGeometry(0.05 * S, 0.05 * S, 5.1 * S, 4),
      rope,
      "troy-body-rib",
      0.012
    );
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = Math.PI / 4;
    rib.position.set((i - 1) * 1.0 * S, 3.8 * S, 0);
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
  // 参考图里的脖子与肩胸连成一个厚重的前躯，不能做成细长立柱。
  // 这里把宽度、深度和高度同时提高，让头部的尺寸有真实的承托关系。
  // 胸块：把颈根压在躯干前端上，避免“细柱插方块”
  const chest = part(
    new THREE.BoxGeometry(2.25 * S, 1.55 * S, 1.45 * S),
    baseWood,
    "troy-chest",
    0.026
  );
  chest.position.set(0, 4.85 * S, 2.55 * S);
  g.add(chest);

  const neck = part(
    new THREE.BoxGeometry(1.45 * S, 2.70 * S, 1.50 * S),
    wood,
    "troy-neck",
    0.026
  );
  neck.position.set(0, 5.85 * S, 3.00 * S);
  neck.rotation.x = 0.40; // 前倾约 23°，拱颈
  g.add(neck);

  // 颈部也用横向编条，和躯干同一套木作语言
  for (let i = 0; i < 4; i++) {
    const nb = part(
      new THREE.BoxGeometry(1.52 * S, 0.34 * S, 1.57 * S),
      i % 2 === 0 ? baseWood : darkWood,
      "troy-neck-band",
      0.012
    );
    nb.position.set(0, (5.0 + i * 0.62) * S, (2.68 + i * 0.27) * S);
    nb.rotation.x = 0.40;
    g.add(nb);
  }

  // 脖子侧面的木板缝隙
  for (let i = 0; i < 3; i++) {
    const nseam = part(
      new THREE.BoxGeometry(0.02 * S, 1.15 * S, 0.02 * S),
      darkWood,
      "troy-neck-seam",
      0.005
    );
    nseam.position.set((i % 2 === 0 ? 1 : -1) * 0.76 * S, (5.4 + i * 0.5) * S, (2.8 + i * 0.22) * S);
    g.add(nseam);
  }

  // ============ 5. 与躯干协调的马头 (Dynamic Head) ============
  // 头部按参考图重新校准：头长约为躯干长度的三分之一，宽高也随厚颈
  // 增加，保证头、颈、胸是连续的大体块，而不是细颈接小方块。
  const head = part(
    new THREE.BoxGeometry(1.22 * S, 1.18 * S, 2.05 * S),
    wood,
    "troy-head",
    0.028
  );
  head.position.set(0, 7.05 * S, 3.95 * S);
  head.rotation.x = -0.30; // 低头约 17°，厚重侧脸
  g.add(head);

  // 口鼻与头部保持约 7:10 的宽度，并拉出足够长度形成清晰的马脸。
  const snout = part(
    new THREE.BoxGeometry(0.86 * S, 0.72 * S, 1.05 * S),
    darkWood,
    "troy-snout",
    0.024
  );
  snout.position.set(0, 6.62 * S, 4.88 * S);
  snout.rotation.x = -0.30;
  g.add(snout);

  // 灵魂装饰：三角耳朵（3 面圆锥，稍微朝后抿）
  const earGeo = new THREE.ConeGeometry(0.19 * S, 0.52 * S, 3);
  earGeo.rotateX(0.2);
  for (const side of [-1, 1]) {
    const ear = part(earGeo, darkWood, "troy-ear", 0.014);
    ear.position.set(side * 0.40 * S, 7.72 * S, 3.55 * S);
    ear.rotation.set(-0.15, 0, side * 0.1);
    g.add(ear);
  }

  // 锯齿状马鬃：一排渐小方块叠在脖子后，平替木片鬃毛
  const maneCount = 5;
  for (let i = 0; i < maneCount; i++) {
    const maneGeo = new THREE.BoxGeometry(0.42 * S, (0.74 - i * 0.1) * S, 0.78 * S);
    const maneUnit = part(maneGeo, darkWood, "troy-mane", 0.018);
    maneUnit.position.set(0, (5.82 - i * 0.45) * S, (1.34 - i * 0.26) * S);
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
