// =====================================================================
//  东方水墨古风资产：扭曲古松 / 仙鹤 / 黑岩
//  参考雪舟《四季花鸟图屏风》：焦墨树干、墨绿松冠、丹顶鹤、加粗勾线
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";
import { mergeStaticGroup } from "../world/geometryMerge.js";

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
 * 东方参天古树巨松（The Colossal Primordial Pine）· 日本新版画（吉田博风）硬边造型。
 * 全程序化基础几何体实时拼装：
 *   1) 主干：三级六棱柱级联收分（底层 r1.8 / 中层 r1.0 / 顶层 r0.5）+ X 偏置弯曲 + 整体左倾 10°
 *   2) 树皮剥落乳白内芯贴片（#F4EFEB）附着在底层主干前侧表面（#7D6B5D 消光灰褐）
 *   3) 主树枝：Y=12 / Y=18 处 4 根六棱柱斜向外上 30~45°，根部深嵌主干 >0.35
 *   4) 树冠：极端非等比拍扁云片 scale(3.8, 0.45, 2.2)，多层堆叠成流云墙（#1A3326/#112219）
 *   5) 全网格 addOutline(mesh, 0.05) 唐伯虎水墨描边
 */
export function createAncientPineTree(seed = 7301 + pineSerial++ * 97) {
  const g = new THREE.Group();
  g.name = "giantTreeGroup";
  const rnd = pineRng(seed);

  // ---------- 材质（toonMat 有缓存，同色复用） ----------
  const barkMat = toonMat(0x7d6b5d, { flatShading: true }); // 消光灰褐树皮
  const barkDarkMat = toonMat(0x6a5a4e, { flatShading: true });
  const innerMat = toonMat(0xf4efeb, { flatShading: true }); // 乳白内芯
  const canopyMatA = toonMat(0x1a3326, { flatShading: true }); // 水墨深松绿
  const canopyMatB = toonMat(0x112219, { flatShading: true });
  const OUT = 0.05; // 唐伯虎水墨细描边厚度

  // ---------- 1. 主干：三级级联收分 + 斜向偏置（Conical Twisted Trunk） ----------
  const trunk = new THREE.Group();
  g.add(trunk);

  function trunkSeg(rTop, rBottom, height, xOff, yCenter) {
    const mesh = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(rTop, rBottom, height, 6)),
      barkMat
    );
    mesh.position.set(xOff, yCenter, 0);
    mesh.castShadow = true;
    addOutline(mesh, OUT);
    trunk.add(mesh);
    return mesh;
  }

  // 底层：基部 r1.8 → 顶 1.15，高 10（0~10）
  trunkSeg(1.15, 1.8, 10, 0, 5);
  // 中层：r1.15 → 0.55，高 8（7~15），X -0.5（与底层重叠消除截断）
  trunkSeg(0.55, 1.15, 8, -0.5, 8);
  // 顶层：r0.55 → 0.25，高 8（13~21），X -1.2
  trunkSeg(0.25, 0.55, 8, -1.2, 12.5);
  // 整体左倾 10 度
  trunk.rotation.z = 0.18;

  // 树皮剥落乳白内芯贴片：附着在底层主干前侧（+Z 面）表面
  {
    const patch = new THREE.Mesh(
      facet(new THREE.BoxGeometry(1.7, 4.6, 0.2)),
      innerMat
    );
    // 底层主干 y=3.6 处半径 ≈1.57，六棱柱 +Z 面 ≈1.36；贴片后缘嵌入表面，前缘凸出
    patch.position.set(-0.12, 3.6, 1.42);
    patch.rotation.z = -0.14;
    patch.rotation.x = 0.05;
    patch.castShadow = true;
    addOutline(patch, OUT);
    trunk.add(patch);
  }

  // ---------- 2. 主树枝：斜向外上 30~45°，根部深嵌主干（Organic Branches） ----------
  const branchSpecs = [
    { y: 11.5, x: -0.5, rRoot: 0.52, rTip: 0.15, len: 6.0, yaw: 0.06, tilt: 0.52, mat: barkMat },
    { y: 12.6, x: -0.55, rRoot: 0.4, rTip: 0.11, len: 5.0, yaw: -0.55, tilt: 0.62, mat: barkDarkMat },
    { y: 17.5, x: -1.15, rRoot: 0.36, rTip: 0.1, len: 4.4, yaw: 0.4, tilt: 0.48, mat: barkMat },
    { y: 18.6, x: -1.2, rRoot: 0.28, rTip: 0.08, len: 3.6, yaw: -0.42, tilt: 0.62, mat: barkDarkMat },
  ];
  const branchTips = [];
  for (const spec of branchSpecs) {
    const bg = new THREE.Group();
    bg.position.set(spec.x, spec.y, 0);
    bg.rotation.y = spec.yaw;
    bg.rotation.z = spec.tilt;
    const mesh = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(spec.rTip, spec.rRoot, spec.len, 6)),
      spec.mat
    );
    mesh.position.y = spec.len / 2; // 根部在组原点 = 主干内部（深嵌 > 0.35）
    mesh.castShadow = true;
    addOutline(mesh, OUT);
    bg.add(mesh);
    trunk.add(bg);
    // 树枝末端（trunk 局部系）：RZ(tilt)*RY(yaw) 作用于局部 +Y*len
    branchTips.push(
      new THREE.Vector3(
        spec.x - spec.len * Math.sin(spec.tilt) * Math.cos(spec.yaw),
        spec.y + spec.len * Math.cos(spec.tilt),
        spec.len * Math.sin(spec.tilt) * Math.sin(spec.yaw)
      )
    );
  }

  // ---------- 3. 层叠巨型树冠（Cloud-like Canopy Mats） ----------
  // 云片拍扁矩阵：X 横拉 3.8 / Y 拍扁 0.45 / Z 拉伸 2.2 —— 流云墙般的压迫分量感
  function cloudPad(center, width, depth, thick, blobCount, yaw) {
    const pad = new THREE.Group();
    pad.position.copy(center);
    pad.rotation.y = yaw;
    const n = Math.max(3, blobCount ?? 4);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(
        facet(new THREE.IcosahedronGeometry(0.5, 1)),
        i % 2 === 0 ? canopyMatA : canopyMatB
      );
      const edge = n === 1 ? 0 : i / (n - 1) - 0.5;
      mesh.position.set(
        edge * width * 0.6 + (rnd() - 0.5) * width * 0.22,
        (i % 2) * thick * 0.4 + (rnd() - 0.5) * thick,
        (rnd() - 0.5) * depth * 0.32
      );
      mesh.scale.set(
        3.8 * (0.5 + rnd() * 0.55) * (1 - Math.abs(edge) * 0.18),
        0.45 * (0.8 + rnd() * 0.5),
        2.2 * (0.45 + rnd() * 0.5)
      );
      mesh.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI, (rnd() - 0.5) * 0.2);
      mesh.castShadow = true;
      addOutline(mesh, OUT);
      pad.add(mesh);
    }
    trunk.add(pad);
    return pad;
  }

  // 枝端云片（各 5 粒）
  for (const tip of branchTips) {
    cloudPad(tip, 3.4 + rnd() * 1.2, 2.0 + rnd() * 0.8, 1.6, 5, (rnd() - 0.5) * 0.9);
  }

  // 顶部巨型云墙：三层横铺（Y≈16 / 19 / 22），越往上越收窄，形成流云塔
  for (let layer = 0; layer < 3; layer++) {
    const y = 15.6 + layer * 2.7 + (rnd() - 0.5) * 0.5;
    const w = 8.6 - layer * 1.7;
    cloudPad(
      new THREE.Vector3(-1.6 + (rnd() - 0.5) * 1.3, y, (rnd() - 0.5) * 1.2),
      w,
      3.2,
      1.8,
      7,
      layer * 0.45 + (rnd() - 0.5) * 0.3
    );
  }
  // 云顶压层 + 中段补密度
  cloudPad(new THREE.Vector3(-1.9, 21.6, 0.4), 4.6, 2.2, 1.4, 6, 0.3);
  cloudPad(new THREE.Vector3(-1.1, 13.9, 0.7), 3.8, 1.8, 1.4, 5, 0.9);
  cloudPad(new THREE.Vector3(-1.5, 20.3, -0.6), 3.4, 1.8, 1.4, 5, -0.7);

  g.rotation.y = (rnd() - 0.5) * 0.5;
  // 性能：单株 ~130 网格（57 云片 + 描边）→ 按材质合并成 ~6 个绘制调用。
  // 全树静态（无逐帧变换/无运行时材质切换），合并后外观逐顶点一致。
  mergeStaticGroup(g);
  g.userData.collideRadius = 2.4;
  g.userData.topY = 24;
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
