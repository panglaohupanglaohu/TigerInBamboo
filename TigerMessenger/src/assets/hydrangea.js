// =====================================================================
//  低多边形卡通绣球花丛（Hydrangea Clusters）
//  花球：IcosahedronGeometry(detail 1) + 三色插画盘
//  绿叶：六边形薄片斜向外展；整丛 20~30 球层叠穿插
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

// 三种标志性插画色：淡蓝 / 乳白 / 淡黄绿（嫩苞）
const FLOWER_COLORS = [0xa9cbef, 0xf4f7ed, 0xcbe685];
const LEAF_COLORS = [0x2e7d32, 0x43a047];

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 花球单元：花球 + 下方/侧面 2~3 片斜展绿叶 */
function createFlowerBall(rnd, r, color) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(
    facet(new THREE.IcosahedronGeometry(r, 1)),
    toonMat(color)
  );
  ball.castShadow = true;
  ball.receiveShadow = true;
  addOutline(ball, 0.014);
  g.add(ball);

  const leafMat = toonMat(LEAF_COLORS[(rnd() * LEAF_COLORS.length) | 0]);
  const leafCount = 2 + ((rnd() * 2) | 0);
  for (let i = 0; i < leafCount; i++) {
    const leaf = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(0.16, 0.22, 0.03, 6)),
      leafMat
    );
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    addOutline(leaf, 0.008);
    const a = rnd() * Math.PI * 2;
    leaf.position.set(
      Math.cos(a) * r * 0.75,
      -r * (0.35 + rnd() * 0.3),
      Math.sin(a) * r * 0.75
    );
    leaf.rotation.set(0.5 + rnd() * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.6);
    g.add(leaf);
  }
  return g;
}

/**
 * 大花丛：20~30 个花球紧密层叠。
 * 底部稍大（成熟蓝白），顶部稍小且多黄绿（嫩苞）；球间微重叠无机械间隙。
 * @param {number} scale 整体倍率（1 ≈ 半人高）
 */
export function createLowPolyHydrangeaBush(scale = 1, seed = 7) {
  const rnd = lcg(seed);
  const bush = new THREE.Group();
  bush.name = "hydrangea-bush";
  const COUNT = 24;
  for (let i = 0; i < COUNT; i++) {
    const t = i / COUNT; // 0 底 → 1 顶
    // 高度分布：大部分在下 2/3
    const h = Math.pow(t, 0.8);
    const y = (0.12 + h * 0.85) * scale;
    // 底部大 → 顶部小
    const r = (0.4 - h * 0.16) * scale * (0.9 + rnd() * 0.25);
    // 顶部多黄绿嫩苞，底部蓝白为主
    const colorIdx =
      h > 0.55 && rnd() < 0.65 ? 2 : (rnd() * 2) | 0; // 2=黄绿
    const unit = createFlowerBall(rnd, r, FLOWER_COLORS[colorIdx]);
    // 丛内散布：底层摊得开，顶层收拢；间距 < 球径产生穿插
    const spread = (1.0 - h * 0.55) * scale;
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * spread;
    unit.position.set(Math.cos(a) * d, y, Math.sin(a) * d * 0.8);
    unit.rotation.y = rnd() * Math.PI * 2;
    bush.add(unit);
  }
  // 与地图/场景共用元数据（贴地 + 碰撞约定）
  bush.userData.kind = "hydrangea";
  bush.userData.assetType = "hydrangea";
  bush.userData.factoryScale = scale;
  bush.userData.factorySeed = seed;
  bush.userData.collideRadius = 0.35 * scale; // 轻挡路
  return bush;
}

/**
 * 书店四周部署组（局部坐标，与书店同父级使用）：
 *  - 草坪前沿一排 5 丛，挡住基底硬边
 *  - 门廊台阶左右各 1 丛（半人高）
 *  - 两侧贴墙 2 丛（包裹外墙）
 */
export function createBookshopHydrangeas() {
  const g = new THREE.Group();
  g.name = "bookshop-hydrangeas";
  // 草坪斜坡前沿一排
  for (let i = 0; i < 5; i++) {
    const bush = createLowPolyHydrangeaBush(0.9 + (i % 2) * 0.15, 100 + i * 17);
    bush.position.set(-2.8 + i * 1.4, 0.28, 3.1);
    g.add(bush);
  }
  // 门廊台阶两侧（半人高小丛）
  for (const side of [-1, 1]) {
    const bush = createLowPolyHydrangeaBush(0.55, 300 + side);
    bush.position.set(side * 1.15, 0.32, 2.3);
    g.add(bush);
  }
  // 贴墙两丛（包裹外墙）
  for (const side of [-1, 1]) {
    const bush = createLowPolyHydrangeaBush(1.05, 400 + side);
    bush.position.set(side * 2.55, 0.32, 0.9);
    g.add(bush);
  }
  return g;
}
