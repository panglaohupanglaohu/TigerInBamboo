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
 * 东方写意古松（整容版）
 * - 主干：六/八棱柱下粗上细收分，底部嵌苍劲露根
 * - 树枝：斜向外上 25°~45° 探出，根部深度嵌套进主干 ≥0.3，消灭 90° 直角插接
 * - 树冠：枝端 2~3 片拍扁 Icosahedron，消光深松绿 #1C3024
 * - 全件 MeshToonMaterial flatShading + addOutline(0.045)
 */
export function createAncientPineTree(seed = 7301 + pineSerial++ * 97) {
  const g = new THREE.Group();
  g.name = "ancient-pine-organic";
  const rnd = pineRng(seed);

  // 焦褐树干 / 深松绿冠（消光 Toon，无塑料高光）
  const barkMat = toonMat(0x654321, { flatShading: true });
  const barkDarkMat = toonMat(BARK_DARK, { flatShading: true });
  const canopyMat = toonMat(0x1c3024, { flatShading: true }); // 深松绿
  const canopyMat2 = toonMat(0x243a2c, { flatShading: true });
  const canopyMat3 = toonMat(0x16261c, { flatShading: true });
  const OUT = 0.045;
  const yAxis = new THREE.Vector3(0, 1, 0);
  const _dir = new THREE.Vector3();
  const _mid = new THREE.Vector3();

  /** 圆柱段：从 a 指向 b，两端半径 r0→r1，六棱 low-poly */
  function cylSeg(a, b, r0, r1, mat = barkMat, outline = OUT) {
    _dir.subVectors(b, a);
    const len = Math.max(0.02, _dir.length());
    const mesh = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(r1, r0, len, 6, 1, false)),
      mat
    );
    mesh.position.copy(a).addScaledVector(_dir.normalize(), len * 0.5);
    mesh.quaternion.setFromUnitVectors(yAxis, _dir);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addOutline(mesh, outline, 0x211e19, 0.04);
    g.add(mesh);
    return mesh;
  }

  /* ---------- 1. 主树干：下粗上细六棱收分（可微弯） ---------- */
  const TRUNK_H = 11.5 + rnd() * 1.2;
  const R_BOT = 1.15 + rnd() * 0.15; // ≈1.2
  const R_TOP = 0.55 + rnd() * 0.12; // ≈0.6
  const lean = (rnd() > 0.5 ? 1 : -1) * (0.08 + rnd() * 0.12);
  const leanZ = (rnd() - 0.5) * 0.1;

  // 分段主干（平滑收分 + 轻微蛇形），非一根直柱
  const trunkPts = [];
  const trunkSegs = 5;
  for (let i = 0; i <= trunkSegs; i++) {
    const t = i / trunkSegs;
    const y = t * TRUNK_H;
    // 微弯：中段外撇再收回
    const bend = Math.sin(t * Math.PI) * lean * TRUNK_H * 0.12;
    const bendZ = Math.sin(t * Math.PI * 0.9) * leanZ * TRUNK_H * 0.1;
    trunkPts.push(new THREE.Vector3(bend, y, bendZ));
  }
  for (let i = 0; i < trunkPts.length - 1; i++) {
    const t0 = i / (trunkPts.length - 1);
    const t1 = (i + 1) / (trunkPts.length - 1);
    const r0 = THREE.MathUtils.lerp(R_BOT, R_TOP, t0);
    const r1 = THREE.MathUtils.lerp(R_BOT, R_TOP, t1);
    cylSeg(trunkPts[i], trunkPts[i + 1], r0, r1, barkMat, OUT);
  }

  // 地面露根：扁平长方体嵌 Y≈0，苍劲抓地
  for (let i = 0; i < 5 + ((rnd() * 3) | 0); i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.5;
    const len = 0.9 + rnd() * 0.7;
    const root = new THREE.Mesh(
      facet(new THREE.BoxGeometry(len, 0.18 + rnd() * 0.1, 0.28 + rnd() * 0.12)),
      barkDarkMat
    );
    root.position.set(
      Math.cos(a) * (R_BOT * 0.55),
      0.06 + rnd() * 0.04,
      Math.sin(a) * (R_BOT * 0.55)
    );
    root.rotation.y = a + Math.PI / 2;
    root.rotation.z = (rnd() - 0.5) * 0.25;
    root.rotation.x = (rnd() - 0.5) * 0.15;
    // 根部切入主干
    root.position.x *= 0.7;
    root.position.z *= 0.7;
    root.castShadow = true;
    addOutline(root, OUT * 0.85, 0x211e19, 0.04);
    g.add(root);
  }

  /* ---------- 2. 斜向外上树枝：25°~45°，根部嵌进主干 ≥0.3 ---------- */
  const branchSpecs = [
    { t: 0.28, yaw: 0.4, elev: 0.55, len: 3.2, r0: 0.38 },
    { t: 0.32, yaw: 2.6, elev: 0.48, len: 2.8, r0: 0.34 },
    { t: 0.48, yaw: 1.2, elev: 0.62, len: 3.5, r0: 0.32 },
    { t: 0.52, yaw: 4.0, elev: 0.5, len: 2.9, r0: 0.3 },
    { t: 0.65, yaw: 0.9, elev: 0.7, len: 2.6, r0: 0.26 },
    { t: 0.68, yaw: 3.5, elev: 0.58, len: 2.4, r0: 0.24 },
    { t: 0.8, yaw: 2.0, elev: 0.72, len: 2.1, r0: 0.2 },
    { t: 0.82, yaw: 5.0, elev: 0.65, len: 1.9, r0: 0.18 },
  ];

  /** 扁平 low-poly 树冠片：2~3 层拍扁多面体 */
  function addPlumeCanopy(at, dirOut, size = 1) {
    const n = 2 + ((rnd() * 2) | 0);
    for (let k = 0; k < n; k++) {
      const mat = k === 0 ? canopyMat3 : k === 1 ? canopyMat : canopyMat2;
      const blob = new THREE.Mesh(
        facet(new THREE.IcosahedronGeometry(0.55, 0)),
        mat
      );
      // 沿枝向略外移 + 上下错落
      blob.position.copy(at).addScaledVector(dirOut, 0.15 + k * 0.12);
      blob.position.y += (k - 0.5) * 0.18 * size;
      blob.position.x += (rnd() - 0.5) * 0.25 * size;
      blob.position.z += (rnd() - 0.5) * 0.25 * size;
      // 拍扁横展：scale (2.0, 0.4, 1.5) 级
      const sx = (1.6 + rnd() * 0.6) * size;
      const sy = (0.32 + rnd() * 0.12) * size;
      const sz = (1.2 + rnd() * 0.5) * size;
      blob.scale.set(sx, sy, sz);
      blob.rotation.set(
        (rnd() - 0.5) * 0.25,
        rnd() * Math.PI,
        (rnd() - 0.5) * 0.2
      );
      blob.castShadow = true;
      addOutline(blob, OUT * 0.75, 0x0f1a14, 0.035);
      g.add(blob);
    }
  }

  for (let bi = 0; bi < branchSpecs.length; bi++) {
    const sp = branchSpecs[bi];
    const t = sp.t + (rnd() - 0.5) * 0.03;
    // 主干表面点
    const yi = Math.min(trunkPts.length - 2, Math.floor(t * (trunkPts.length - 1)));
    const tf = t * (trunkPts.length - 1) - yi;
    const attach = trunkPts[yi].clone().lerp(trunkPts[yi + 1], tf);
    const trunkR = THREE.MathUtils.lerp(R_BOT, R_TOP, t);

    // 斜向外上：仰角 25°~45°（elev 0.44~0.78 rad）
    const elev = THREE.MathUtils.clamp(sp.elev + (rnd() - 0.5) * 0.08, 0.44, 0.82);
    const yaw = sp.yaw + (rnd() - 0.5) * 0.35 + lean * 0.4;
    const dir = new THREE.Vector3(
      Math.cos(yaw) * Math.cos(elev),
      Math.sin(elev),
      Math.sin(yaw) * Math.cos(elev)
    ).normalize();

    // 根部深深嵌进主干 ≥0.3：起点自轴心向外，再回缩 0.35~0.55
    const nest = 0.35 + rnd() * 0.25;
    const start = attach
      .clone()
      .addScaledVector(dir, trunkR * 0.15 - nest);
    const len = sp.len * (0.9 + rnd() * 0.2);
    // 两段微折：中段略上扬，更有机
    const mid = start
      .clone()
      .addScaledVector(dir, len * 0.48)
      .add(new THREE.Vector3((rnd() - 0.5) * 0.2, 0.15 + rnd() * 0.2, (rnd() - 0.5) * 0.2));
    const tip = start
      .clone()
      .addScaledVector(dir, len)
      .add(new THREE.Vector3((rnd() - 0.5) * 0.15, 0.25 + rnd() * 0.2, (rnd() - 0.5) * 0.15));

    const r0 = sp.r0 * (0.9 + rnd() * 0.15);
    const r1 = r0 * 0.55;
    const r2 = r0 * 0.28;
    cylSeg(start, mid, r0, r1, barkMat, OUT * 0.9);
    cylSeg(mid, tip, r1, r2, barkDarkMat, OUT * 0.75);

    // 偶发二级小枝（同样斜上嵌套）
    if (rnd() > 0.35) {
      const subDir = dir
        .clone()
        .applyAxisAngle(yAxis, (rnd() > 0.5 ? 1 : -1) * (0.5 + rnd() * 0.4));
      subDir.y += 0.2;
      subDir.normalize();
      const s0 = mid.clone().addScaledVector(subDir, -0.2); // 嵌进母枝
      const s1 = mid.clone().addScaledVector(subDir, 0.9 + rnd() * 0.5);
      cylSeg(s0, s1, r1 * 0.7, r2 * 0.8, barkDarkMat, OUT * 0.65);
      addPlumeCanopy(s1, subDir, 0.7 + rnd() * 0.25);
    }

    addPlumeCanopy(tip, dir, 0.85 + rnd() * 0.35);
  }

  // 顶冠：两丛斜上短枝 + 扁平冠，避免圣诞尖顶
  const top = trunkPts[trunkPts.length - 1];
  for (const side of [-1, 1]) {
    const elev = 0.75 + rnd() * 0.12;
    const yaw = side * (0.7 + rnd() * 0.4) + lean;
    const dir = new THREE.Vector3(
      Math.cos(yaw) * Math.cos(elev),
      Math.sin(elev),
      Math.sin(yaw) * Math.cos(elev)
    ).normalize();
    const start = top.clone().addScaledVector(dir, -0.35);
    const tip = top.clone().addScaledVector(dir, 1.4 + rnd() * 0.4);
    cylSeg(start, tip, R_TOP * 0.85, 0.08, barkDarkMat, OUT * 0.7);
    addPlumeCanopy(tip, dir, 1.0 + rnd() * 0.2);
  }

  g.rotation.y = (rnd() - 0.5) * 0.7;
  g.userData.collideRadius = 0.65;
  g.userData.kind = "gardenPine";
  g.userData.seed = seed;
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
