// =====================================================================
//  海岛老旧修船厂码头（Old Pier & Shipyard）
//  - createFisherBoat  低多边形小渔船 + 救生圈
//  - createStackedCrates  纵横错落木箱/货柜堆叠算法
//  - createHarborCrane  复古港口起重机
//  - buildOldHarborScene  整景 Group（底部局部 Y=0）
//  约定：MeshToonMaterial 卡通色块 + facet 硬边 + addOutline(0.04)
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

/** 船体下半 · 亮蓝 */
const HULL_BLUE = 0x2c96b4;
/** 船体上半 / 船舱 · 乳白 */
const HULL_CREAM = 0xf3f5f0;
/** 救生圈橙 */
const BUOY_ORANGE = 0xe86a2a;
/** 货柜青灰 */
const CRATE_STEEL = 0xa2b5cd;
/** 原木色 */
const CRATE_WOOD = 0xb8956a;
/** 起重机深青灰 */
const CRANE_STEEL = 0x37474f;
/** 码头木板 */
const PIER_PLANK = 0x8b7355;
/** 码头桩柱 */
const PIER_PILE = 0x5c4a38;
/** 吊绳焦黑 */
const ROPE_INK = 0x1a1a1a;
/** 加固框深木 */
const STRAP = 0x6a5340;

const OUT = 0.04;

/**
 * @param {THREE.BufferGeometry} geo
 * @param {THREE.Material} mat
 * @param {number} [outline]
 */
function part(geo, mat, outline = OUT) {
  const mesh = new THREE.Mesh(facet(geo), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, outline);
  return mesh;
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// =====================================================================
//  1. 低多边形小渔船
// =====================================================================

/**
 * 前端收尖小渔船：蓝底乳白舷、侧救生圈、带窗船舱、桅杆。
 * 底部约在 Y=0。
 * @returns {THREE.Group}
 */
export function createFisherBoat() {
  const g = new THREE.Group();
  g.name = "fisher-boat";

  const blue = toonMat(HULL_BLUE);
  const cream = toonMat(HULL_CREAM);
  const orange = toonMat(BUOY_ORANGE);
  const dark = toonMat(0x2a3238);
  const wood = toonMat(CRATE_WOOD);

  // ---- 船体下半：亮蓝，前端收尖（锥 + 盒拼接）----
  const hullLow = part(new THREE.BoxGeometry(2.4, 0.42, 0.95), blue);
  hullLow.name = "hull-low";
  hullLow.position.set(0, 0.22, 0);
  g.add(hullLow);

  // 船头尖（蓝）
  const prow = part(new THREE.ConeGeometry(0.48, 0.9, 5), blue, 0.032);
  prow.name = "hull-prow";
  prow.rotation.z = -Math.PI / 2;
  prow.position.set(1.5, 0.24, 0);
  prow.scale.set(1, 1, 0.72);
  g.add(prow);

  // 船尾略收
  const stern = part(new THREE.BoxGeometry(0.35, 0.38, 0.72), blue, 0.032);
  stern.position.set(-1.25, 0.22, 0);
  g.add(stern);

  // ---- 船体上半：乳白舷墙 ----
  const hullUp = part(new THREE.BoxGeometry(2.15, 0.22, 0.88), cream);
  hullUp.name = "hull-up";
  hullUp.position.set(-0.05, 0.5, 0);
  g.add(hullUp);

  const gunwale = part(new THREE.BoxGeometry(2.0, 0.08, 0.94), cream, 0.028);
  gunwale.position.set(-0.05, 0.62, 0);
  g.add(gunwale);

  // 甲板木色
  const deck = part(new THREE.BoxGeometry(1.9, 0.05, 0.72), wood, 0.028);
  deck.position.set(-0.08, 0.44, 0);
  g.add(deck);

  // ---- 船舱：白色长方体 + 连续深色方窗 ----
  const cabin = part(new THREE.BoxGeometry(0.85, 0.48, 0.7), cream);
  cabin.name = "cabin";
  cabin.position.set(-0.35, 0.88, 0);
  g.add(cabin);

  // 连续车窗（深色方块）
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const win = part(new THREE.BoxGeometry(0.16, 0.14, 0.04), dark, 0.018);
      win.position.set(-0.55 + i * 0.22, 0.92, side * 0.36);
      g.add(win);
    }
  }
  // 前窗
  const frontWin = part(new THREE.BoxGeometry(0.04, 0.16, 0.42), dark, 0.018);
  frontWin.position.set(0.08, 0.94, 0);
  g.add(frontWin);

  // 舱顶
  const roof = part(new THREE.BoxGeometry(0.92, 0.08, 0.76), cream, 0.028);
  roof.position.set(-0.35, 1.14, 0);
  g.add(roof);

  // ---- 桅杆：白色细圆柱 ----
  const mast = part(new THREE.CylinderGeometry(0.035, 0.045, 1.35, 6), cream, 0.022);
  mast.name = "mast";
  mast.position.set(0.35, 1.45, 0);
  g.add(mast);

  // 横桁
  const yard = part(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5), cream, 0.016);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0.35, 1.85, 0);
  g.add(yard);

  // ---- 舷侧救生圈：Torus + 橙白相间块 ----
  const buoyG = new THREE.Group();
  buoyG.name = "lifebuoy";
  // 主环（乳白）
  const ring = part(new THREE.TorusGeometry(0.16, 0.045, 6, 14), cream, 0.022);
  ring.rotation.y = Math.PI / 2;
  buoyG.add(ring);
  // 橙白相间条带（4 段）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.2;
    const isOrange = i % 2 === 0;
    const band = part(
      new THREE.BoxGeometry(0.1, 0.1, 0.08),
      isOrange ? orange : cream,
      0.014
    );
    band.position.set(0, Math.cos(a) * 0.16, Math.sin(a) * 0.16);
    buoyG.add(band);
  }
  buoyG.position.set(0.55, 0.72, 0.52);
  buoyG.rotation.x = 0.15;
  g.add(buoyG);

  // 另一侧小锚钩装饰
  const cleat = part(new THREE.BoxGeometry(0.12, 0.06, 0.08), dark, 0.014);
  cleat.position.set(0.9, 0.66, -0.42);
  g.add(cleat);

  g.userData.kind = "fisherBoat";
  g.userData.collideRadius = 1.4;
  return g;
}

// =====================================================================
//  2. 杂物堆叠算法 · 木箱 / 货柜
// =====================================================================

/**
 * 单个木箱或货柜，带加固框薄片。
 * @param {{ wood?: boolean, size?: number, seed?: number }} [opts]
 */
export function createCrate(opts = {}) {
  const rnd = lcg(opts.seed ?? 1);
  const wood = opts.wood ?? rnd() > 0.45;
  const s = opts.size ?? 0.35 + rnd() * 0.45;
  const mat = toonMat(wood ? CRATE_WOOD : CRATE_STEEL);
  const strapMat = toonMat(wood ? STRAP : 0x6a7888);

  const g = new THREE.Group();
  g.name = wood ? "wood-crate" : "steel-crate";

  // 略非正方，市井感
  const sx = s * (0.85 + rnd() * 0.35);
  const sy = s * (0.7 + rnd() * 0.45);
  const sz = s * (0.85 + rnd() * 0.3);
  const box = part(new THREE.BoxGeometry(sx, sy, sz), mat, OUT * 0.9);
  box.position.y = sy / 2;
  g.add(box);

  // 极扁加固框（长条薄片）
  const t = 0.025;
  const strapY = sy * (0.28 + rnd() * 0.35);
  // 水平箍
  const band = part(new THREE.BoxGeometry(sx * 1.02, t, sz * 1.02), strapMat, 0.016);
  band.position.y = strapY;
  g.add(band);
  // 竖向边条（两面）
  if (rnd() > 0.35) {
    for (const side of [-1, 1]) {
      const vert = part(new THREE.BoxGeometry(t, sy * 0.92, sz * 0.12), strapMat, 0.014);
      vert.position.set(side * sx * 0.48, sy / 2, 0);
      g.add(vert);
    }
  }
  // 货柜门缝感
  if (!wood && rnd() > 0.4) {
    const door = part(new THREE.BoxGeometry(sx * 0.04, sy * 0.7, sz * 0.85), strapMat, 0.012);
    door.position.set(sx * 0.5, sy / 2, 0);
    g.add(door);
  }

  g.userData.kind = "crate";
  g.userData.halfH = sy / 2;
  g.userData.size = { x: sx, y: sy, z: sz };
  return g;
}

/**
 * 在地面随机纵横交错堆叠 15~20 个木箱/货柜。
 * @param {{ count?: number, seed?: number, areaX?: number, areaZ?: number }} [opts]
 * @returns {THREE.Group}
 */
export function createStackedCrates(opts = {}) {
  const rnd = lcg(opts.seed ?? 20260802);
  const count = opts.count ?? 15 + ((rnd() * 6) | 0); // 15–20
  const areaX = opts.areaX ?? 3.8;
  const areaZ = opts.areaZ ?? 2.6;

  const g = new THREE.Group();
  g.name = "stacked-crates";

  /** 简易占用：按格叠高 */
  const cols = 5;
  const rows = 4;
  /** @type {number[][]} */
  const heights = Array.from({ length: cols }, () => Array(rows).fill(0));
  /** @type {number[][]} */
  const baseY = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let i = 0; i < count; i++) {
    const ci = (rnd() * cols) | 0;
    const ri = (rnd() * rows) | 0;
    const wood = rnd() > 0.42;
    const crate = createCrate({ wood, seed: ((opts.seed ?? 0) + i * 97) >>> 0 });
    const sz = crate.userData.size;

    // 纵横交错：格子中心 + 抖动，部分旋转 90°
    const cellW = areaX / cols;
    const cellD = areaZ / rows;
    let x = (ci + 0.5) * cellW - areaX / 2 + (rnd() - 0.5) * cellW * 0.45;
    let z = (ri + 0.5) * cellD - areaZ / 2 + (rnd() - 0.5) * cellD * 0.45;
    const yaw = rnd() > 0.5 ? Math.PI / 2 : 0;
    const yawJitter = (rnd() - 0.5) * 0.35;
    crate.rotation.y = yaw + yawJitter;

    // 叠在该格已有高度上
    const y0 = baseY[ci][ri];
    crate.position.set(x, y0, z);
    baseY[ci][ri] = y0 + sz.y * (0.92 + rnd() * 0.08);
    heights[ci][ri] += 1;

    // 偶发倾斜（倒落感，仍大致堆叠）
    if (rnd() > 0.82 && heights[ci][ri] === 1) {
      crate.rotation.z = (rnd() - 0.5) * 0.25;
      crate.rotation.x = (rnd() - 0.5) * 0.12;
    }

    g.add(crate);
  }

  g.userData.kind = "stackedCrates";
  g.userData.count = count;
  return g;
}

// =====================================================================
//  3. 复古港口起重机
// =====================================================================

/**
 * 工业吊车：深青灰斜悬臂 + 绞盘轮 + 吊绳。
 * 底部在 Y=0。
 * @returns {THREE.Group}
 */
export function createHarborCrane() {
  const g = new THREE.Group();
  g.name = "harbor-crane";

  const steel = toonMat(CRANE_STEEL);
  const mid = toonMat(0x546e7a);
  const dark = toonMat(0x263238);
  const rope = toonMat(ROPE_INK);

  // 基座
  const base = part(new THREE.BoxGeometry(1.1, 0.35, 1.1), steel);
  base.position.y = 0.175;
  g.add(base);

  const baseTop = part(new THREE.BoxGeometry(0.85, 0.2, 0.85), mid, 0.032);
  baseTop.position.y = 0.45;
  g.add(baseTop);

  // 立柱
  const mast = part(new THREE.BoxGeometry(0.32, 2.4, 0.32), steel);
  mast.position.set(0, 1.55, 0);
  g.add(mast);

  // 斜撑
  const brace = part(new THREE.BoxGeometry(0.14, 1.6, 0.14), mid, 0.028);
  brace.position.set(0.55, 1.1, 0);
  brace.rotation.z = -0.55;
  g.add(brace);

  // ---- 巨型悬臂：深青灰长方体，斜向上 ----
  const boom = part(new THREE.BoxGeometry(3.6, 0.28, 0.38), steel);
  boom.name = "crane-boom";
  boom.position.set(1.5, 2.55, 0);
  boom.rotation.z = 0.32; // 斜向上
  g.add(boom);

  // 悬臂顶桁架细杆
  const boomTop = part(new THREE.BoxGeometry(3.4, 0.1, 0.12), mid, 0.022);
  boomTop.position.set(1.45, 2.85, 0);
  boomTop.rotation.z = 0.32;
  g.add(boomTop);

  // ---- 机械绞盘：扁平圆柱 radialSegments=12 ----
  const winch = part(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), mid);
  winch.name = "crane-winch";
  winch.rotation.z = Math.PI / 2;
  // 悬臂底座关节处
  winch.position.set(0.15, 2.35, 0.35);
  g.add(winch);

  // 绞盘侧盘
  const disc = part(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12), dark, 0.022);
  disc.rotation.z = Math.PI / 2;
  disc.position.set(0.15, 2.35, 0.48);
  g.add(disc);

  // ---- 吊绳：极细黑色圆柱，自悬臂前端下垂 ----
  const ropeLen = 1.85;
  const cable = part(new THREE.CylinderGeometry(0.018, 0.018, ropeLen, 5), rope, 0.014);
  cable.name = "crane-rope";
  // 悬臂前端约 (1.5+1.6*cos, 2.55+1.6*sin)
  const tipX = 1.5 + Math.cos(0.32) * 1.65;
  const tipY = 2.55 + Math.sin(0.32) * 1.65;
  cable.position.set(tipX, tipY - ropeLen / 2, 0);
  g.add(cable);

  // 吊钩
  const hook = part(new THREE.BoxGeometry(0.12, 0.16, 0.08), dark, 0.016);
  hook.position.set(tipX, tipY - ropeLen - 0.05, 0);
  g.add(hook);
  const hookRing = part(new THREE.TorusGeometry(0.07, 0.018, 5, 10), dark, 0.012);
  hookRing.position.set(tipX, tipY - ropeLen + 0.08, 0);
  g.add(hookRing);

  // 配重块（后方）
  const counter = part(new THREE.BoxGeometry(0.55, 0.4, 0.5), dark, 0.028);
  counter.position.set(-0.55, 2.2, 0);
  g.add(counter);

  // 操作室小盒
  const cab = part(new THREE.BoxGeometry(0.45, 0.4, 0.5), mid, 0.028);
  cab.position.set(0.05, 2.0, -0.4);
  g.add(cab);
  const cabWin = part(new THREE.BoxGeometry(0.28, 0.18, 0.04), toonMat(0x1c2430), 0.012);
  cabWin.position.set(0.05, 2.05, -0.66);
  g.add(cabWin);

  g.userData.kind = "harborCrane";
  g.userData.collideRadius = 1.2;
  return g;
}

// =====================================================================
//  4. 整景：老旧修船厂码头
// =====================================================================

/**
 * 工业感老码头场景：栈桥木板 + 渔船 + 货柜堆 + 起重机。
 * 局部坐标：甲板面约 Y=0.35，整体底部桩脚 Y=0。
 * @param {{ seed?: number }} [opts]
 * @returns {{ group: THREE.Group, colliders: object[], landmarks: object }}
 */
export function buildOldHarborScene(opts = {}) {
  const seed = opts.seed ?? 8844;
  const rnd = lcg(seed);
  const g = new THREE.Group();
  g.name = "old-harbor-scene";

  const plank = toonMat(PIER_PLANK);
  const pileMat = toonMat(PIER_PILE);
  const sand = toonMat(0xcbb896);

  // ---------- 栈桥平台（木板码头）----------
  const deckW = 7.2;
  const deckD = 4.2;
  const deckH = 0.18;
  const deckY = 0.42;

  const deck = part(new THREE.BoxGeometry(deckW, deckH, deckD), plank);
  deck.name = "pier-deck";
  deck.position.set(0, deckY, 0);
  g.add(deck);

  // 木板接缝（深色细条）
  for (let i = 0; i < 8; i++) {
    const seam = part(
      new THREE.BoxGeometry(0.04, deckH * 1.05, deckD * 0.98),
      toonMat(STRAP),
      0.012
    );
    seam.position.set(-deckW / 2 + 0.5 + i * 0.9, deckY, 0);
    g.add(seam);
  }

  // 栈桥延伸入水短段
  const finger = part(new THREE.BoxGeometry(2.2, deckH * 0.9, 1.6), plank, 0.032);
  finger.position.set(deckW / 2 + 0.9, deckY - 0.02, -0.4);
  g.add(finger);

  // 栈桥外的可见水面：从 finger 末端外开始，直接覆盖船底视觉层。
  const harborWater = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.08, 6.5),
    new THREE.MeshBasicMaterial({
      color: 0x247f99,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  harborWater.name = "harbor-water";
  harborWater.position.set(9.0, deckY + 0.15, -0.4);
  harborWater.renderOrder = 1;
  harborWater.receiveShadow = true;
  g.add(harborWater);

  // 桩柱
  const pilePositions = [
    [-3.2, -1.8],
    [-3.2, 1.8],
    [0, -1.9],
    [0, 1.9],
    [3.2, -1.8],
    [3.2, 1.8],
    [4.8, -1.0],
    [4.8, 0.4],
  ];
  for (const [px, pz] of pilePositions) {
    const ph = 0.55 + rnd() * 0.15;
    const pile = part(new THREE.CylinderGeometry(0.1, 0.12, ph, 6), pileMat, 0.022);
    pile.position.set(px, ph / 2, pz);
    g.add(pile);
  }

  // 岸边砂土基
  const berm = part(new THREE.BoxGeometry(deckW + 1.2, 0.2, deckD + 1.4), sand, 0.028);
  berm.position.set(-0.2, 0.08, 0.15);
  g.add(berm);

  // ---------- 渔船：栈桥尽头水面系泊，船底贴水 ----------
  const boat = createFisherBoat();
  boat.position.set(8.0, deckY + 0.19, -0.4);
  // 停泊姿态保持平稳；驾驶时 boatRide 会按球面法线和船头方向重建姿态。
  boat.rotation.set(0.01, 0.35, 0.01);
  g.add(boat);

  // 垫木（船架）
  for (const side of [-1, 1]) {
    const block = part(new THREE.BoxGeometry(0.35, 0.22, 0.9), toonMat(CRATE_WOOD), 0.028);
    block.position.set(side * 0.55, deckY + 0.12, -0.1);
    block.rotation.y = 0.2;
    g.add(block);
  }

  // ---------- 货柜堆：渔船下方/前方地面 ----------
  const crates = createStackedCrates({
    count: 15 + ((rnd() * 6) | 0),
    seed: seed + 11,
    areaX: 4.2,
    areaZ: 2.4,
  });
  crates.position.set(-1.6, deckY + deckH / 2, 1.15);
  crates.rotation.y = -0.15;
  g.add(crates);

  // 第二小堆（船尾侧）
  const crates2 = createStackedCrates({
    count: 6,
    seed: seed + 99,
    areaX: 1.8,
    areaZ: 1.4,
  });
  crates2.position.set(2.2, deckY + deckH / 2, 1.0);
  crates2.scale.setScalar(0.85);
  g.add(crates2);

  // ---------- 起重机：码头右侧靠前 ----------
  const crane = createHarborCrane();
  crane.position.set(2.6, deckY + deckH / 2, -1.35);
  crane.rotation.y = -0.55;
  crane.scale.setScalar(0.85);
  g.add(crane);

  // 拦绳桩
  for (let i = 0; i < 3; i++) {
    const bollard = part(new THREE.CylinderGeometry(0.08, 0.1, 0.28, 6), toonMat(CRANE_STEEL), 0.018);
    bollard.position.set(-2.8 + i * 0.5, deckY + 0.2, -1.9);
    g.add(bollard);
  }

  // 底部对齐 Y=0
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  if (Number.isFinite(box.min.y) && Math.abs(box.min.y) > 1e-4) {
    g.position.y -= box.min.y;
  }

  // 碰撞（局部 → 世界由调用方在 place 后写 position）
  const collidersLocal = [
    { x: 0, z: 0, r: 3.6 },
    { x: 2.6, z: -1.35, r: 1.1 },
    { x: -1.6, z: 1.15, r: 1.4 },
  ];

  g.userData.kind = "oldHarbor";
  g.userData.collideRadius = 4.0;

  return {
    group: g,
    landmarks: { boat, crane, crates },
    /** 贴球后由调用方转为世界碰撞 */
    collidersLocal,
  };
}
