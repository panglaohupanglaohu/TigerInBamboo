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
//  1. 古战船（三列桨战船 trireme 造型）
// =====================================================================

/**
 * 截屏形制：长尾翘艏柱 + 青铜撞角 + 船眼 + 单桅绗缝大方帆（红回纹边、
 * 红蛇纹）+ 两侧长桨 + 甲板货箱栏杆。局部 +X = 船头，底部约 Y=0。
 * @returns {THREE.Group}
 */
export function createFisherBoat() {
  const g = new THREE.Group();
  g.name = "fisher-boat";

  const hullDark = toonMat(0x3f4a3c); // 船底暗绿灰
  const hullRed = toonMat(0xb0492c); // 红橙舷带
  const stripeWhite = toonMat(0xe8e0cc); // 回纹白带
  const ink = toonMat(0x2a2620); // 回纹深方
  const wood = toonMat(0xb8956a); // 甲板
  const woodDark = toonMat(0x6a5340); // 栏杆 / 艏柱
  const bronze = toonMat(0x9a7434); // 撞角
  const sailTan = toonMat(0xe6dcc0, { side: THREE.DoubleSide }); // 帆
  const sailRed = toonMat(0xb03a2a, { side: THREE.DoubleSide }); // 帆边 / 蛇纹
  const rope = toonMat(0x8a7a5c); // 帆索 / 支索

  // ---- 船体：侧面轮廓挤出（船尾上翘）----
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.42, 0.3); // 船尾底
  hullShape.lineTo(2.02, 0.14); // 龙骨微前倾
  hullShape.lineTo(2.3, 0.62); // 船头柱
  hullShape.lineTo(2.08, 0.78); // 船头舷缘
  hullShape.lineTo(-1.5, 0.82); // 舷缘中部
  hullShape.lineTo(-2.14, 1.0); // 舷缘上翘
  hullShape.lineTo(-2.46, 1.18); // 船尾舷缘最高
  hullShape.lineTo(-2.52, 0.86); // 船尾柱内侧
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.0,
    bevelEnabled: false,
    curveSegments: 6,
  });
  hullGeo.translate(0, 0, -0.5);
  const hull = part(hullGeo, hullDark);
  hull.name = "hull-low";
  g.add(hull);

  // ---- 红橙舷带（两侧：平直段 + 船尾上翘段）----
  for (const side of [-1, 1]) {
    const bandFlat = part(new THREE.BoxGeometry(3.6, 0.15, 0.05), hullRed, 0.02);
    bandFlat.position.set(0.26, 0.66, side * 0.51);
    g.add(bandFlat);
    const bandUp = part(new THREE.BoxGeometry(1.0, 0.15, 0.05), hullRed, 0.02);
    bandUp.position.set(-1.85, 0.88, side * 0.51);
    bandUp.rotation.z = 2.83; // 随舷缘上翘
    g.add(bandUp);
    // 白色回纹带 + 深色回纹方块
    const stripe = part(new THREE.BoxGeometry(2.6, 0.09, 0.045), stripeWhite, 0.016);
    stripe.position.set(0.28, 0.5, side * 0.51);
    g.add(stripe);
    for (let i = 0; i < 7; i++) {
      const key = part(new THREE.BoxGeometry(0.12, 0.045, 0.05), ink, 0.01);
      key.position.set(-0.85 + i * 0.36, 0.5, side * 0.515);
      g.add(key);
    }
    // ---- 船眼（白底黑瞳）----
    const eye = part(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10), stripeWhite, 0.018);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(1.78, 0.52, side * 0.5);
    g.add(eye);
    const pupil = part(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), ink, 0.012);
    pupil.rotation.x = Math.PI / 2;
    pupil.position.set(1.8, 0.52, side * 0.51);
    g.add(pupil);
  }

  // ---- 青铜撞角：主尖 + 上翘副尖 + 两片鳍 ----
  const ram = part(new THREE.ConeGeometry(0.16, 1.15, 6), bronze, 0.028);
  ram.name = "hull-prow";
  ram.rotation.z = -Math.PI / 2 + 0.06;
  ram.position.set(2.78, 0.3, 0);
  g.add(ram);
  const ramUp = part(new THREE.ConeGeometry(0.1, 0.55, 5), bronze, 0.022);
  ramUp.rotation.z = -Math.PI / 2 + 0.5;
  ramUp.position.set(2.42, 0.62, 0);
  g.add(ramUp);
  for (const side of [-1, 1]) {
    const fin = part(new THREE.BoxGeometry(0.5, 0.22, 0.04), bronze, 0.018);
    fin.position.set(2.3, 0.3, side * 0.16);
    fin.rotation.y = side * 0.5;
    g.add(fin);
  }

  // ---- 凤尾艏柱：弯弧 + 顶饰 ----
  const sternpost = part(
    new THREE.TorusGeometry(0.62, 0.075, 6, 10, 1.9),
    woodDark,
    0.03
  );
  sternpost.position.set(-2.62, 1.1, 0);
  sternpost.rotation.z = 0.35; // 自船尾向上向前弯成天鹅颈
  g.add(sternpost);
  const finial = part(new THREE.BoxGeometry(0.2, 0.16, 0.2), hullRed, 0.022);
  finial.position.set(-2.28, 1.82, 0);
  g.add(finial);

  // ---- 长桨：两侧各 13 支，枢轴在舷缘（可动画划水）----
  // 每支桨是 Group：原点=桨根；局部 +Y 指向桨尖；绕局部 X 俯仰、Z 前后扫。
  const oars = [];
  const _oarA = new THREE.Vector3();
  const _oarB = new THREE.Vector3();
  const _oarDir = new THREE.Vector3();
  const _oarQuat = new THREE.Quaternion();
  const _oarUp = new THREE.Vector3(0, 1, 0);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 13; i++) {
      const x = -1.7 + i * 0.27;
      _oarA.set(x, 0.68, side * 0.5); // 桨根：舷缘
      _oarB.set(x - 0.5, -0.2, side * 1.72); // 桨尖：下外后方（叶端入水划动）
      _oarDir.copy(_oarB).sub(_oarA);
      const len = _oarDir.length();
      _oarDir.normalize();

      const oarRig = new THREE.Group();
      oarRig.name = side < 0 ? `oar-L-${i}` : `oar-R-${i}`;
      oarRig.position.copy(_oarA);
      // 局部 +Y → 桨尖方向；基准姿态存 baseQuat，
      // 划水动画在其上叠加局部偏移（直接写 rotation 会丢基准、桨指天）
      _oarQuat.setFromUnitVectors(_oarUp, _oarDir);
      oarRig.quaternion.copy(_oarQuat);
      oarRig.userData.baseQuat = _oarQuat.clone();

      const shaft = part(new THREE.CylinderGeometry(0.022, 0.028, len, 5), woodDark, 0.012);
      shaft.name = "oar-shaft";
      shaft.position.y = len * 0.5; // 沿局部 +Y 伸出
      oarRig.add(shaft);

      const blade = part(new THREE.BoxGeometry(0.32, 0.1, 0.03), woodDark, 0.012);
      blade.name = "oar-blade";
      blade.position.y = len;
      // 桨叶面朝前后，略偏
      blade.rotation.set(0, side * 0.35, Math.PI / 2);
      oarRig.add(blade);

      oarRig.userData.side = side;
      oarRig.userData.index = i;
      oarRig.userData.phase = i * 0.22 + (side > 0 ? 0.11 : 0); // 错开相位，波浪式
      g.add(oarRig);
      oars.push(oarRig);
    }
  }
  g.userData.oars = oars;
  g.userData.oarPhase = 0;
  g.userData.oarSpeed = 0; // 0..1 划水强度，由 updateWarshipOars 平滑
  buildWarshipCrew(g); // 每支桨配一名剪纸罗马士兵，肢随桨动

  // ---- 甲板 + 栏杆 + 货箱 + 船尾楼 ----
  const deck = part(new THREE.BoxGeometry(3.9, 0.06, 0.86), wood, 0.026);
  deck.position.set(0.05, 0.8, 0);
  g.add(deck);
  for (const side of [-1, 1]) {
    const rail = part(new THREE.BoxGeometry(3.7, 0.04, 0.05), woodDark, 0.014);
    rail.position.set(0.0, 1.08, side * 0.42);
    g.add(rail);
    for (let i = 0; i < 9; i++) {
      const post = part(new THREE.BoxGeometry(0.045, 0.26, 0.045), woodDark, 0.012);
      post.position.set(-1.75 + i * 0.45, 0.95, side * 0.42);
      g.add(post);
    }
  }
  // 甲板货箱
  const crateSpots = [
    [-0.7, 0.2, 0.32],
    [0.05, -0.22, 0.26],
    [1.15, 0.12, 0.3],
    [-1.25, -0.15, 0.24],
  ];
  for (const [cx, cz, s] of crateSpots) {
    const crate = part(new THREE.BoxGeometry(s, s, s), wood, 0.02);
    crate.position.set(cx, 0.86 + s / 2, cz * 0.2); // 中线堆放，给两列划桨纸人让位
    crate.rotation.y = cx * 0.6;
    g.add(crate);
  }
  // 船尾小楼（舱棚 + 顶台栏杆）
  const aftCabin = part(new THREE.BoxGeometry(0.9, 0.4, 0.56), wood, 0.026);
  aftCabin.position.set(-1.85, 1.02, 0);
  g.add(aftCabin);
  const aftRoof = part(new THREE.BoxGeometry(1.0, 0.06, 0.6), woodDark, 0.02);
  aftRoof.position.set(-1.85, 1.25, 0);
  g.add(aftRoof);

  // ---- 桅杆 + 横桁 ----
  const mast = part(new THREE.CylinderGeometry(0.045, 0.065, 2.9, 7), woodDark, 0.024);
  mast.name = "mast";
  mast.position.set(0.55, 2.2, 0);
  g.add(mast);
  const mastTop = part(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), woodDark, 0.018);
  mastTop.position.set(0.55, 3.8, 0);
  g.add(mastTop);
  const yard = part(new THREE.CylinderGeometry(0.035, 0.035, 2.7, 6), woodDark, 0.02);
  yard.rotation.x = Math.PI / 2;
  yard.position.set(0.55, 3.32, 0);
  g.add(yard);

  // ---- 大方帆：鼓起 + 红边衬底 + 横向帆索（绗缝鼓起）----
  const SAIL_W = 2.5;
  const SAIL_H = 2.05;
  const sailGeo = new THREE.PlaneGeometry(SAIL_W, SAIL_H, 8, 7);
  const sailPos = sailGeo.attributes.position;
  for (let i = 0; i < sailPos.count; i++) {
    const u = sailPos.getX(i) / SAIL_W + 0.5; // 0..1 横
    const v = sailPos.getY(i) / SAIL_H + 0.5; // 0..1 纵
    // max(0,·)：边界顶点浮点微超界会让 sin 出现极小负数，小数次幂得 NaN
    const bulge =
      Math.max(0, Math.sin(Math.PI * u)) ** 0.8 *
      Math.max(0, Math.sin(Math.PI * v)) ** 0.9 * 0.52;
    sailPos.setZ(i, bulge);
  }
  sailGeo.computeVertexNormals();
  const sail = part(sailGeo, sailTan, 0.03);
  sail.name = "sail";
  sail.rotation.y = Math.PI / 2; // 鼓起朝船头 +X
  sail.position.set(0.55, 2.28, 0);
  g.add(sail);
  // 红回纹边：4 条窄红带沿帆四边，跟随鼓起曲线、贴在帆面前 0.008
  const sailBulge = (u, v) =>
    Math.max(0, Math.sin(Math.PI * u)) ** 0.8 *
    Math.max(0, Math.sin(Math.PI * v)) ** 0.9 * 0.52;
  function sailBand(u0, u1, v0, v1) {
    const w = (u1 - u0) * SAIL_W;
    const h = (v1 - v0) * SAIL_H;
    const geo = new THREE.PlaneGeometry(w, h, 6, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = u0 + (pos.getX(i) / w + 0.5) * (u1 - u0);
      const v = v0 + (pos.getY(i) / h + 0.5) * (v1 - v0);
      pos.setZ(i, sailBulge(u, v) + 0.008);
    }
    geo.computeVertexNormals();
    const band = part(geo, sailRed, 0.014);
    band.rotation.y = Math.PI / 2;
    band.position.set(
      0.55,
      2.28 + ((v0 + v1) / 2 - 0.5) * SAIL_H,
      ((u0 + u1) / 2 - 0.5) * SAIL_W
    );
    return band;
  }
  g.add(sailBand(0.0, 0.055, 0, 1)); // 左边
  g.add(sailBand(0.945, 1.0, 0, 1)); // 右边
  g.add(sailBand(0, 1, 0.93, 1.0)); // 顶边
  g.add(sailBand(0, 1, 0.0, 0.07)); // 底边
  // 横向帆索（6 根，跟随鼓起 → 绗缝分带）
  for (let b = 1; b <= 6; b++) {
    const v = b / 7;
    const yLocal = (v - 0.5) * SAIL_H;
    const bulge = Math.sin(Math.PI * 0.5) ** 0.8 * Math.sin(Math.PI * v) ** 0.9 * 0.52;
    const brail = part(new THREE.CylinderGeometry(0.016, 0.016, SAIL_W * 0.98, 5), rope, 0.01);
    brail.rotation.x = Math.PI / 2;
    brail.position.set(0.55 + bulge + 0.02, 2.28 + yLocal, 0);
    g.add(brail);
  }
  // 红蛇纹（帆面 S 形红条 = 简化龙纹），跟随鼓起贴帆面前 0.02
  const serpentCurve = [
    [0.62, 0.28, 0.55],
    [0.66, 0.36, 0.15],
    [0.7, 0.44, -0.25],
    [0.68, 0.52, -0.6],
    [0.74, 0.6, -0.35],
  ];
  for (const [v, u, rot] of serpentCurve) {
    const seg = part(new THREE.BoxGeometry(0.1, 0.3, 0.05), sailRed, 0.012);
    seg.position.set(
      0.55 + sailBulge(u, v) + 0.02,
      2.28 + (v - 0.5) * SAIL_H,
      (u - 0.5) * SAIL_W
    );
    seg.rotation.x = rot;
    g.add(seg);
  }

  // ---- 支索 + 旗帜绳（艏柱顶 → 桅顶，挂小三角旗）----
  function rigLine(ax, ay, az, bx, by, bz, thick = 0.014) {
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const line = part(new THREE.CylinderGeometry(thick, thick, len, 4), rope, 0.008);
    line.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    line.lookAt(bx, by, bz);
    line.rotateX(Math.PI / 2);
    return line;
  }
  g.add(rigLine(0.55, 3.95, 0, -2.28, 1.86, 0)); // 后支索（兼旗绳）
  g.add(rigLine(0.55, 3.95, 0, 2.18, 0.82, 0)); // 前支索
  // 小三角旗 5 面（沿后支索均布）
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const fx = 0.55 + (-2.28 - 0.55) * t;
    const fy = 3.95 + (1.86 - 3.95) * t;
    const flag = part(new THREE.ConeGeometry(0.09, 0.24, 3), i % 2 ? sailRed : stripeWhite, 0.01);
    flag.position.set(fx, fy - 0.13, 0);
    flag.rotation.z = Math.PI; // 尖朝下
    g.add(flag);
  }

  // 船体吃水：整体下移，让龙骨（局部 y≈0.14）贴到原点水线之下
  for (const child of g.children) child.position.y -= 0.18;

  g.userData.kind = "fisherBoat";
  g.userData.collideRadius = 6.8;
  return g;
}

/**
 * 战船双侧船桨划水动画。
 * @param {THREE.Object3D} boat createFisherBoat 返回值
 * @param {number} dt
 * @param {number|boolean} moving 是否在前进（true/1=全速划，0=停桨回落）
 */
const _oarEuler = new THREE.Euler();
const _oarOffQ = new THREE.Quaternion();
export function updateWarshipOars(boat, dt = 1 / 60, moving = false) {
  const oars = boat?.userData?.oars;
  if (!Array.isArray(oars) || !oars.length) return;
  const d = Math.min(0.05, Math.max(0, Number(dt) || 0));
  const target = moving === true ? 1 : Math.max(0, Math.min(1, Number(moving) || 0));
  // 强度平滑，避免启停突变
  let speed = boat.userData.oarSpeed ?? 0;
  speed += (target - speed) * Math.min(1, d * 5.5);
  if (speed < 0.02 && target < 0.02) speed = 0;
  boat.userData.oarSpeed = speed;

  // 推进时加快桨频；停泊时相位冻结在最近位置
  if (speed > 0.01) {
    boat.userData.oarPhase = (boat.userData.oarPhase || 0) + d * (3.8 + speed * 2.4);
  }
  const phase = boat.userData.oarPhase || 0;

  for (const oar of oars) {
    const side = oar.userData.side || 1;
    const p = phase + (oar.userData.phase || 0);
    // 周期：sin 为推水主拍；方波感用 sin^3 加强「抓水」
    const stroke = Math.sin(p);
    const power = stroke * stroke * stroke; // 保号立方
    const catchLift = Math.max(0, -Math.cos(p)); // 回桨抬起
    // 前后扫（绕局部 Z）：推水时桨柄向后（-X 船尾）
    const sweep = power * 0.55 * speed;
    // 入水俯仰（绕局部 X）：推水沉、回桨抬；左右舷镜像
    const dip = (-0.22 * power + 0.28 * catchLift) * speed * side;
    // 微微外展
    const flare = (0.06 + 0.1 * catchLift) * speed * side;

    // 在基准姿态（桨尖下外指水）上叠加局部偏移；
    // 无 baseQuat 的旧数据退回纯偏移
    _oarEuler.set(dip, flare * 0.35, sweep);
    _oarOffQ.setFromEuler(_oarEuler);
    const base = oar.userData.baseQuat;
    if (base) oar.quaternion.copy(base).multiply(_oarOffQ);
    else oar.quaternion.copy(_oarOffQ);
  }

  // 剪纸士兵随桨同步划动
  updateWarshipCrew(boat, phase, speed);
}

// =====================================================================
//  战船剪纸罗马士兵：每支桨配一名，四肢关节随桨相位划动
//  - 剪纸人：扁平薄片（Z 向薄），所有关节绕面法线旋转（2D 纸偶动画）
//  - 皮甲（躯干 cuirass + 皮裙 pteruges）+ 青铜头盔 + 红鬃冠
//  - 每船 9 个 InstancedMesh（躯干/皮裙/头/盔/鬃冠/双臂/双腿），尺寸
//    定义在船局部坐标系内，随战船 scale 自然成比例
// =====================================================================

/** 共享几何/材质（全部船共用，懒加载） */
let CREW_SHARED = null;
function crewShared() {
  if (CREW_SHARED) return CREW_SHARED;
  const m = {
    leather: toonMat(0x8a5a33), // 皮甲
    leatherDark: toonMat(0x5c3a22), // 皮裙
    skin: toonMat(0xd9a06b), // 头/四肢
    bronze: toonMat(0xb08d4a), // 头盔
    crest: toonMat(0xb03a2a), // 红鬃冠
  };
  // 部件原点均在关节处；头/盔/冠的颈部位移直接烘焙进几何
  const box = (w, h, t, ox, oy) => {
    const geo = new THREE.BoxGeometry(w, h, t);
    geo.translate(ox, oy, 0);
    return facet(geo);
  };
  const geo = {
    torso: box(0.13, 0.17, 0.03, 0, 0.085), // 关节=髋
    skirt: box(0.15, 0.08, 0.026, 0, -0.04), // 关节=髋（下垂）
    head: box(0.078, 0.085, 0.026, 0, 0.197), // 烘焙在躯干链上
    helmet: box(0.102, 0.06, 0.034, 0, 0.235),
    crest: box(0.15, 0.05, 0.04, 0, 0.272),
    arm: box(0.042, 0.15, 0.02, 0, -0.07), // 关节=肩
    leg: box(0.048, 0.16, 0.02, 0, -0.075), // 关节=髋
  };
  CREW_SHARED = { m, geo };
  return CREW_SHARED;
}

/**
 * 为战船配置剪纸罗马士兵：每支桨一名，坐姿面对舷侧。
 * @param {THREE.Group} g createFisherBoat 的船组（需已填充 userData.oars）
 */
function buildWarshipCrew(g) {
  const oars = g.userData.oars;
  if (!Array.isArray(oars) || !oars.length) return;
  const { m, geo } = crewShared();
  const n = oars.length;
  const crew = new THREE.Group();
  crew.name = "warship-crew";
  const parts = {};
  const defs = [
    ["torso", geo.torso, m.leather],
    ["skirt", geo.skirt, m.leatherDark],
    ["head", geo.head, m.skin],
    ["helmet", geo.helmet, m.bronze],
    ["crest", geo.crest, m.crest],
    ["armL", geo.arm, m.skin],
    ["armR", geo.arm, m.skin],
    ["legL", geo.leg, m.skin],
    ["legR", geo.leg, m.skin],
  ];
  for (const [name, gmm, mat] of defs) {
    const im = new THREE.InstancedMesh(gmm, mat, n);
    im.name = `crew-${name}`;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false; // 实例散布全船，几何包围球盖不住
    im.castShadow = true;
    im.receiveShadow = true;
    crew.add(im);
    parts[name] = im;
  }
  // 与桨一一对应：同 x、同舷、同相位 → 手臂跟桨同步
  crew.userData.rows = oars.map((oar) => ({
    x: oar.position.x,
    side: oar.userData.side || 1,
    phase: oar.userData.phase || 0,
  }));
  crew.userData.parts = parts;
  g.add(crew);
  g.userData.crew = crew;
  updateWarshipCrew(g, 0, 0); // 静坐姿态
}

const _cMat = new THREE.Matrix4();
const _cQBase = new THREE.Quaternion();
const _cQBody = new THREE.Quaternion();
const _cQLimb = new THREE.Quaternion();
const _cRz = new THREE.Quaternion();
const _cPos = new THREE.Vector3();
const _cOff = new THREE.Vector3();
const _cScale = new THREE.Vector3(1, 1, 1);
const _CZ = new THREE.Vector3(0, 0, 1);
const _CY = new THREE.Vector3(0, 1, 0);
/** 坐姿髋点高度（甲板面 0.83 之上，脚恰好落在甲板上） */
const CREW_HIP_Y = 0.99;

/**
 * 剪纸士兵划桨动画（由 updateWarshipOars 内部调用，与桨同相位）。
 * @param {THREE.Object3D} boat
 * @param {number} phase 全船桨相位 boat.userData.oarPhase
 * @param {number} speed 0..1 划水强度
 */
function updateWarshipCrew(boat, phase = 0, speed = 0) {
  const crew = boat?.userData?.crew;
  if (!crew) return;
  const rows = crew.userData.rows;
  const parts = crew.userData.parts;
  const sp = Math.max(0, Math.min(1, Number(speed) || 0));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const s = r.side;
    const p = phase + r.phase;
    const stroke = Math.sin(p);
    const power = stroke * stroke * stroke; // 与桨的抓水主拍一致
    const lift = Math.max(0, -Math.cos(p)); // 回桨
    // 纸偶关节全部绕面法线（局部 Z）；左舷法线朝 -Z，角度乘 side 镜像
    const lean = s * sp * (0.24 * power - 0.14); // 躯干：拉桨后仰、回桨前倾
    const arm = s * (0.24 + sp * (-0.62 * power + 0.44 * lift)); // 臂随桨前后摆
    const leg = s * (0.42 + sp * 0.16 * power); // 坐姿腿前伸，蹬踏微动

    _cQBase.identity();
    if (s < 0) _cQBase.setFromAxisAngle(_CY, Math.PI); // 左舷面朝外翻面
    _cQBody.copy(_cQBase).multiply(_cRz.setFromAxisAngle(_CZ, lean));
    _cPos.set(r.x, CREW_HIP_Y, s * 0.28);

    // 躯干链（髋枢轴）：躯干/皮裙/头/盔/冠 同姿态
    _cMat.compose(_cPos, _cQBody, _cScale);
    parts.torso.setMatrixAt(i, _cMat);
    parts.skirt.setMatrixAt(i, _cMat);
    parts.head.setMatrixAt(i, _cMat);
    parts.helmet.setMatrixAt(i, _cMat);
    parts.crest.setMatrixAt(i, _cMat);

    // 双臂：肩点随躯干前倾，再叠加自身摆动；Z 向微错开防共面
    _cQLimb.copy(_cQBase).multiply(_cRz.setFromAxisAngle(_CZ, lean + arm));
    _cOff.set(0, 0.135, 0).applyQuaternion(_cQBody).add(_cPos);
    _cOff.z += 0.016;
    _cMat.compose(_cOff, _cQLimb, _cScale);
    parts.armL.setMatrixAt(i, _cMat);
    _cOff.z -= 0.032;
    _cMat.compose(_cOff, _cQLimb, _cScale);
    parts.armR.setMatrixAt(i, _cMat);

    // 双腿：髋枢轴坐姿前伸；Z 向微错开防共面
    _cQLimb.copy(_cQBase).multiply(_cRz.setFromAxisAngle(_CZ, leg));
    _cOff.set(0.035, 0.01, 0.014).applyQuaternion(_cQBase).add(_cPos);
    _cMat.compose(_cOff, _cQLimb, _cScale);
    parts.legL.setMatrixAt(i, _cMat);
    _cOff.set(-0.035, 0.01, -0.014).applyQuaternion(_cQBase).add(_cPos);
    _cMat.compose(_cOff, _cQLimb, _cScale);
    parts.legR.setMatrixAt(i, _cMat);
  }
  for (const name in parts) parts[name].instanceMatrix.needsUpdate = true;
}

// =====================================================================
//  码头搬运班组：剪纸士兵（与战船桨手同款几何，同步放大一倍）
//  在货堆与战船之间往返：扛木箱到船边 → 箱子触船即视为装船消失 → 空手返回
// =====================================================================

/** 纸士兵与战船同步放大一倍 */
const PORTER_SCALE = 2;
/** 站立髋点高（腿长 0.16，脚恰好落地） */
const PORTER_HIP = 0.17;

const _ptA = new THREE.Vector3();
const _ptB = new THREE.Vector3();
const _ptSide = new THREE.Vector3();
const easeIO = (s) => s * s * (3 - 2 * s);

/** 单个搬运纸士兵：髋枢轴躯干链 + 双臂抱箱 + 双腿摆动。 */
function buildPorter(m, geo) {
  const root = new THREE.Group();
  root.name = "porter";
  const fig = new THREE.Group();
  fig.scale.setScalar(PORTER_SCALE);
  root.add(fig);

  // 躯干链（髋枢轴）：躯干/皮裙/头/盔/鬃冠 同姿态
  const body = new THREE.Group();
  body.name = "porter-body";
  body.position.y = PORTER_HIP;
  fig.add(body);
  body.add(part(geo.torso, m.leather, 0.01));
  body.add(part(geo.skirt, m.leatherDark, 0.01));
  body.add(part(geo.head, m.skin, 0.008));
  body.add(part(geo.helmet, m.bronze, 0.008));
  body.add(part(geo.crest, m.crest, 0.008));

  // 双臂：肩枢轴，抱箱时前平举
  const armL = new THREE.Group();
  armL.position.set(0, PORTER_HIP + 0.135, 0.018);
  armL.add(part(geo.arm, m.skin, 0.008));
  fig.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0, PORTER_HIP + 0.135, -0.018);
  armR.add(part(geo.arm, m.skin, 0.008));
  fig.add(armR);

  // 双腿：髋枢轴，行走时反向摆动
  const legL = new THREE.Group();
  legL.position.set(0.03, PORTER_HIP, 0.012);
  legL.add(part(geo.leg, m.skin, 0.008));
  fig.add(legL);
  const legR = new THREE.Group();
  legR.position.set(-0.03, PORTER_HIP, -0.012);
  legR.add(part(geo.leg, m.skin, 0.008));
  fig.add(legR);

  // 肩扛/怀抱的木箱（触船即视为装船，visible 控制）
  const crate = part(new THREE.BoxGeometry(0.15, 0.11, 0.12), toonMat(CRATE_WOOD), 0.01);
  crate.name = "porter-crate";
  crate.position.set(0.24, PORTER_HIP + 0.1, 0);
  crate.rotation.z = -0.1;
  fig.add(crate);

  root.userData.parts = { body, armL, armR, legL, legR, crate };
  return root;
}

/**
 * 搬运班组：count 名纸士兵沿 from→to 往返搬箱，相位错开不撞车。
 * @param {{ from: THREE.Vector3, to: THREE.Vector3, count?: number, period?: number, offset?: number }} opts
 * @returns {THREE.Group & { userData: { update(t: number): void } }}
 */
export function createPorterSquad(opts) {
  const { m, geo } = crewShared();
  const squad = new THREE.Group();
  squad.name = "porter-squad";
  const count = opts.count ?? 2;
  const porters = [];
  for (let i = 0; i < count; i++) {
    const porter = buildPorter(m, geo);
    // 横向车道错开，避免同线重叠
    porter.userData.lane = (i - (count - 1) / 2) * 0.46;
    squad.add(porter);
    porters.push(porter);
  }
  squad.userData.from = opts.from.clone();
  squad.userData.to = opts.to.clone();
  squad.userData.period = opts.period ?? 12;
  squad.userData.offset = opts.offset ?? 0;
  squad.userData.porters = porters;
  squad.userData.update = (t) => updatePorterSquad(squad, t);
  return squad;
}

/** 班组循环动画：去程扛箱 → 船边卸货（箱子消失=装船）→ 空手返回。 */
function updatePorterSquad(squad, t) {
  const { from, to, period, offset, porters } = squad.userData;
  _ptA.copy(to).sub(from);
  _ptA.y = 0;
  _ptSide.set(-_ptA.z, 0, _ptA.x).normalize();
  const CARRY_END = 0.46;
  const PAUSE_END = 0.56;
  for (let i = 0; i < porters.length; i++) {
    const p = porters[i];
    const { body, armL, armR, legL, legR, crate } = p.userData.parts;
    const u = ((((t + offset + (i * period) / porters.length) % period) + period) % period) / period;
    let carrying = false;
    let moving = true;
    if (u < CARRY_END) {
      const s = easeIO(u / CARRY_END);
      _ptB.lerpVectors(from, to, s);
      carrying = true;
    } else if (u < PAUSE_END) {
      _ptB.copy(to);
      carrying = u < CARRY_END + 0.04; // 触船一瞬后箱子即装船消失
      moving = false;
    } else {
      const s = easeIO((u - PAUSE_END) / (1 - PAUSE_END));
      _ptB.lerpVectors(to, from, s);
    }
    _ptB.addScaledVector(_ptSide, p.userData.lane);
    p.position.copy(_ptB);
    const step = t * 9 + i * 2.3;
    p.position.y += moving ? Math.abs(Math.sin(step)) * 0.035 : 0;
    // 纸偶面法线朝侧，前进向 = 局部 +X：yaw 把 +X 转到移动方向
    const hx = moving ? (carrying ? to.x - from.x : from.x - to.x) : 1;
    const hz = moving ? (carrying ? to.z - from.z : from.z - to.z) : 0;
    p.rotation.y = Math.atan2(-hz, hx);
    const swing = moving ? Math.sin(step) * 0.5 : 0;
    legL.rotation.z = swing;
    legR.rotation.z = -swing;
    body.rotation.z = moving ? -0.1 : 0; // 行进中微前倾
    armL.rotation.z = carrying ? 1.22 : 0.35 + swing * 0.5;
    armR.rotation.z = carrying ? 1.22 : 0.35 - swing * 0.5;
    crate.visible = carrying;
  }
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
    new THREE.BoxGeometry(14.5, 0.08, 9.5),
    new THREE.MeshBasicMaterial({
      color: 0x247f99,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  harborWater.name = "harbor-water";
  harborWater.position.set(10.6, deckY + 0.15, -1.3);
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

  // ---------- 战船：栈桥尽头水面系泊，船体放大一倍（剪纸桨手随船同比例放大）----------
  const boat = createFisherBoat();
  boat.scale.setScalar(2);
  boat.position.set(9.4, deckY + 0.19, -1.0);
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

  // 第二小堆（起重机旁 · 弹琴老人落座邻侧）
  const crates2 = createStackedCrates({
    count: 6,
    seed: seed + 99,
    areaX: 1.8,
    areaZ: 1.4,
  });
  crates2.name = "harbor-crates-by-crane";
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

  // ---------- 两组剪纸士兵搬运货物上船：货堆 → 战船舷边往返 ----------
  const deckTop = deckY + deckH / 2;
  const squadA = createPorterSquad({
    from: new THREE.Vector3(-1.7, deckTop, 1.75),
    to: new THREE.Vector3(4.3, deckTop, 0.2),
    period: 12,
    offset: 0,
  });
  const squadB = createPorterSquad({
    from: new THREE.Vector3(2.2, deckTop, 1.55),
    to: new THREE.Vector3(5.1, deckTop, -0.25),
    period: 12,
    offset: 6, // 与 A 组错半周期，两组交替上货
  });
  g.add(squadA);
  g.add(squadB);

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
    landmarks: { boat, crane, crates, cratesByCrane: crates2, porterSquads: [squadA, squadB] },
    /** 贴球后由调用方转为世界碰撞 */
    collidersLocal,
    /** 逐帧驱动搬运班组往返动画 */
    update: (_dt, t) => {
      squadA.userData.update(t);
      squadB.userData.update(t);
    },
  };
}
