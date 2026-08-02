// =====================================================================
//  阿狸 · 蜷缩熟睡的低多边形卡通小狐狸（Sleeping Low-Poly Fox）
//  积木拼接 + MeshToonMaterial 三色分块 + 全件 addOutline 墨线
//  约定：肚皮 / 尾巴接触面贴齐局部 Y=0，便于 placeObjectOnSphere
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

/** 动漫橙 · 主体 / 耳根 / 尾根 */
const FOX_ORANGE = 0xe96a36;
/** 乳白 · 下巴脸颊 / 逗号眉 / 尾尖 */
const FOX_CREAM = 0xf4f7ed;
/** 焦黑 · 鼻尖 / 耳尖 / 小爪 */
const FOX_INK = 0x2a2a2a;

const OUT = 0.03; // 手绘细描边（规范要求）

/**
 * 带描边的网格：卡通 toon + flat 硬边 + Inverse Hull
 * @param {THREE.BufferGeometry} geo
 * @param {THREE.Material} mat
 * @param {number} [outline=OUT]
 */
function part(geo, mat, outline = OUT) {
  const mesh = new THREE.Mesh(facet(geo), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, outline);
  return mesh;
}

/**
 * 蜷缩熟睡的低多边形小狐狸「阿狸」。
 * 面向局部 +Z（头略朝 +Z、尾环抱右侧），底部 Y=0。
 * @returns {THREE.Group}
 */
export function createLowPolyFox() {
  const g = new THREE.Group();
  g.name = "fox-ali";

  // MeshToonMaterial 无 flatShading 属性；硬边靠 facet() 非索引 + 逐面法线
  const orange = toonMat(FOX_ORANGE);
  const cream = toonMat(FOX_CREAM);
  const ink = toonMat(FOX_INK);

  // ========== 1. 身体主体：拉长扁平盒，趴卧 ==========
  // 尺寸约 1.15 × 0.38 × 0.68；中心抬起半高 → 肚皮贴 Y=0
  const body = part(new THREE.BoxGeometry(1.15, 0.38, 0.68), orange);
  body.name = "fox-body";
  body.position.set(0.05, 0.19, 0.02);
  // 轻微前倾蜷缩感
  body.rotation.z = -0.08;
  body.rotation.x = 0.04;
  g.add(body);

  // 腹部乳白软垫（下巴延伸到胸腹的一块）
  const belly = part(new THREE.BoxGeometry(0.55, 0.16, 0.42), cream, 0.022);
  belly.name = "fox-belly-cream";
  belly.position.set(0.22, 0.1, 0.04);
  g.add(belly);

  // ========== 2. 环抱身侧的蓬松大尾巴 ==========
  // 尾根：偏大、圆润多面体，贴身右侧后方
  const tailRoot = part(new THREE.IcosahedronGeometry(0.42, 1), orange);
  tailRoot.name = "fox-tail-root";
  tailRoot.scale.set(1.35, 0.95, 1.15);
  tailRoot.position.set(-0.42, 0.28, 0.38);
  tailRoot.rotation.set(0.25, -0.55, 0.35);
  g.add(tailRoot);

  // 尾中段（仍为橙，略弯）
  const tailMid = part(new THREE.IcosahedronGeometry(0.32, 1), orange, 0.026);
  tailMid.name = "fox-tail-mid";
  tailMid.scale.set(1.2, 0.9, 1.05);
  tailMid.position.set(-0.18, 0.36, 0.62);
  tailMid.rotation.set(0.4, -0.2, 0.15);
  g.add(tailMid);

  // 尾尖：乳白色蓬松端，略贴地
  const tailTip = part(new THREE.IcosahedronGeometry(0.26, 1), cream, 0.024);
  tailTip.name = "fox-tail-tip";
  tailTip.scale.set(1.15, 0.85, 1.1);
  tailTip.position.set(0.22, 0.22, 0.72);
  tailTip.rotation.set(0.55, 0.35, -0.1);
  g.add(tailTip);

  // 保证尾接触面贴地：若 tip 底低于 0 则整体上推已在设计时贴齐
  // 尾根下缘约 y≈0.05，tip 下缘约 y≈0.05

  // ========== 3. 头部：向前收尖的锥状多面体 ==========
  const headG = new THREE.Group();
  headG.name = "fox-head";
  headG.position.set(0.62, 0.28, 0.06);
  // 睡姿：头略埋向身前、下巴贴近前爪
  headG.rotation.set(0.35, 0.15, -0.12);

  // 主头壳：icosa 拉尖（scale.x 向前）
  const head = part(new THREE.IcosahedronGeometry(0.28, 0), orange);
  head.name = "fox-head-shell";
  head.scale.set(1.35, 0.95, 0.95);
  head.position.set(0.06, 0.02, 0);
  headG.add(head);

  // 下颌 / 脸颊乳白
  const muzzle = part(new THREE.BoxGeometry(0.28, 0.16, 0.32), cream, 0.022);
  muzzle.name = "fox-muzzle";
  muzzle.position.set(0.22, -0.06, 0);
  muzzle.rotation.z = -0.15;
  headG.add(muzzle);

  // 小黑鼻头
  const nose = part(new THREE.BoxGeometry(0.07, 0.055, 0.07), ink, 0.016);
  nose.name = "fox-nose";
  nose.position.set(0.38, -0.02, 0);
  headG.add(nose);

  // 逗号眉毛贴片（两团乳白）
  for (const side of [-1, 1]) {
    const brow = part(new THREE.BoxGeometry(0.1, 0.045, 0.06), cream, 0.014);
    brow.name = side < 0 ? "fox-brow-L" : "fox-brow-R";
    brow.position.set(0.08, 0.14, side * 0.12);
    brow.rotation.z = side * 0.35;
    brow.rotation.y = side * -0.2;
    headG.add(brow);
  }

  // 闭眼睡线（焦黑细条，可选灵魂细节）
  for (const side of [-1, 1]) {
    const lid = part(new THREE.BoxGeometry(0.09, 0.02, 0.035), ink, 0.01);
    lid.name = side < 0 ? "fox-lid-L" : "fox-lid-R";
    lid.position.set(0.18, 0.06, side * 0.11);
    lid.rotation.z = 0.1;
    headG.add(lid);
  }

  // ========== 4. 耳朵：巨大三角锥，向上向外倾 ==========
  for (const side of [-1, 1]) {
    const earG = new THREE.Group();
    earG.name = side < 0 ? "fox-ear-L" : "fox-ear-R";
    // 径向分段 3–4（低多边形切面）
    const earOuter = part(new THREE.ConeGeometry(0.14, 0.36, 4), orange, 0.026);
    earOuter.name = "fox-ear-outer";
    earOuter.position.y = 0.16;
    earG.add(earOuter);

    // 耳尖焦黑小帽
    const earTip = part(new THREE.ConeGeometry(0.07, 0.12, 3), ink, 0.016);
    earTip.name = "fox-ear-tip";
    earTip.position.y = 0.32;
    earG.add(earTip);

    // 耳内侧乳白薄片
    const earIn = part(new THREE.ConeGeometry(0.08, 0.22, 3), cream, 0.014);
    earIn.name = "fox-ear-inner";
    earIn.position.set(0.02, 0.12, 0);
    earIn.scale.set(0.7, 0.85, 0.55);
    earG.add(earIn);

    earG.position.set(-0.02, 0.18, side * 0.16);
    // 向上向外倾斜
    earG.rotation.order = "YXZ";
    earG.rotation.x = -0.25;
    earG.rotation.z = side * -0.55;
    earG.rotation.y = side * 0.2;
    headG.add(earG);
  }

  g.add(headG);

  // ========== 5. 卧在头下方的微型爪子（焦黑小方块） ==========
  for (const side of [-1, 1]) {
    const paw = part(new THREE.BoxGeometry(0.14, 0.08, 0.12), ink, 0.016);
    paw.name = side < 0 ? "fox-paw-L" : "fox-paw-R";
    // 头下、贴地
    paw.position.set(0.48, 0.04, side * 0.14);
    paw.rotation.y = side * 0.25;
    g.add(paw);
  }

  // 后爪蜷在身下（隐约两块）
  for (const side of [-1, 1]) {
    const hind = part(new THREE.BoxGeometry(0.12, 0.07, 0.1), orange, 0.014);
    hind.name = side < 0 ? "fox-hind-L" : "fox-hind-R";
    hind.position.set(-0.28, 0.04, side * 0.22);
    g.add(hind);
  }

  // ========== 6. 底部对齐：扫描包围盒，整体下移使最低点 = 0 ==========
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  if (Number.isFinite(box.min.y) && Math.abs(box.min.y) > 1e-4) {
    g.position.y -= box.min.y;
  }

  g.userData.kind = "fox";
  g.userData.displayName = "阿狸";
  g.userData.collideRadius = 0.55;
  g.userData.sleeping = true;

  return g;
}
