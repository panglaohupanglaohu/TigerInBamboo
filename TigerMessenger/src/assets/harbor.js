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

  const rows = boat.userData.crew?.userData?.rows || [];
  let leftN = 0;
  let leftSed = 0;
  let rightN = 0;
  let rightSed = 0;

  for (let i = 0; i < oars.length; i++) {
    const oar = oars[i];
    const row = rows[i];
    const side = oar.userData.side || row?.side || 1;
    if (side < 0) {
      leftN++;
      if ((row?.sedateT ?? 0) > 0) leftSed++;
    } else {
      rightN++;
      if ((row?.sedateT ?? 0) > 0) rightSed++;
    }

    // 麻醉桨手：桨无力下垂，不跟拍
    if ((row?.sedateT ?? 0) > 0) {
      const base = oar.userData.baseQuat;
      if (base) {
        _oarEuler.set(0.35 * side, 0.08 * side, 0.12);
        _oarOffQ.setFromEuler(_oarEuler);
        oar.quaternion.copy(base).multiply(_oarOffQ);
      }
      continue;
    }

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

  // 左右舷有效划力差 → 船身歪扭（左强右弱则偏右）
  const leftPower = leftN ? 1 - leftSed / leftN : 1;
  const rightPower = rightN ? 1 - rightSed / rightN : 1;
  boat.userData.oarImbalance = leftPower - rightPower; // -1..1
  boat.userData.oarSedatedCount = leftSed + rightSed;

  // 剪纸士兵随桨同步划动
  updateWarshipCrew(boat, phase, speed, d);
}

/**
 * 部分桨手被麻醉时船向歪扭：绕当地法线偏航。
 * 在 placeOnCurve / orient 之后调用。
 * @param {THREE.Object3D} boat
 * @param {number} dt
 */
export function applyBoatOarWobble(boat, dt = 1 / 60) {
  if (!boat) return;
  const imb = boat.userData.oarImbalance || 0;
  const speed = boat.userData.oarSpeed ?? 0;
  if (Math.abs(imb) < 0.04 || speed < 0.05) return;
  const d = Math.min(0.05, Math.max(0, Number(dt) || 0));
  // 歪扭幅度：左右差 × 划速；累积一点再衰减，像失控偏航
  let yaw = boat.userData.wobbleYaw || 0;
  yaw += imb * 0.55 * speed * d;
  yaw *= Math.exp(-d * 0.35); // 缓缓回正，但有差就持续灌
  boat.userData.wobbleYaw = yaw;
  // 局部 +Y = 法线：偏航
  boat.rotateY(yaw * d * 2.8 + imb * 0.22 * speed * d);
}

/**
 * 麻醉弹命中战船最近桨手。
 * @returns {{ kind: 'object', object: THREE.Object3D, duration: number, boat: THREE.Object3D, index: number }|null}
 */
export function sedateWarshipCrewNearest(boat, worldPos, radius = 2.9, duration = 5) {
  const rows = boat?.userData?.crew?.userData?.rows;
  if (!Array.isArray(rows) || !worldPos) return null;
  boat.updateWorldMatrix(true, false);
  const r2 = radius * radius;
  let best = -1;
  let bestD = r2;
  const _wp = new THREE.Vector3();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if ((r.sedateT ?? 0) > 0) continue;
    if (r.attach) {
      r.attach.getWorldPosition(_wp);
    } else {
      _wp.set(r.x, CREW_HIP_Y, r.side * 0.28).applyMatrix4(boat.matrixWorld);
    }
    const d = _wp.distanceToSquared(worldPos);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return null;
  rows[best].sedateT = duration;
  const attach = rows[best].attach;
  if (attach) {
    attach.userData.sedated = true;
    attach.userData.sedateT = duration;
  }
  return {
    kind: "object",
    object: attach || boat,
    duration,
    boat,
    index: best,
  };
}

// =====================================================================
//  战船剪纸罗马士兵：每支桨配一名，四肢关节随桨相位划动
//  - 剪纸人：扁平薄片（Z 向薄），所有关节绕面法线旋转（2D 纸偶动画）
//  - 皮甲（躯干 cuirass + 皮裙 pteruges）+ 罗马青铜盔（galea）+ 大型红羽冠
//  - 每船 11 个 InstancedMesh（躯干/皮裙/头/盔/羽冠/羽片/羽轴/双臂/双腿），尺寸
//    定义在船局部坐标系内，随战船 scale 自然成比例
// =====================================================================

/**
 * 多块方盒合并为单一 BufferGeometry（剪纸罗马盔等复合轮廓）。
 * @param {Array<[number, number, number, number, number, number?]>} defs
 *   每项 [w, h, t, ox, oy, oz?]
 */
function mergeBoxes(defs) {
  const positions = [];
  const normals = [];
  for (let i = 0; i < defs.length; i++) {
    const [w, h, t, ox, oy, oz = 0] = defs[i];
    const g = new THREE.BoxGeometry(w, h, t);
    g.translate(ox, oy, oz);
    const f = facet(g);
    const p = f.attributes.position.array;
    const n = f.attributes.normal.array;
    for (let j = 0; j < p.length; j++) {
      positions.push(p[j]);
      normals.push(n[j]);
    }
    f.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.computeBoundingSphere();
  return merged;
}

/** 共享几何/材质（全部船共用，懒加载） */
let CREW_SHARED = null;
function crewShared() {
  if (CREW_SHARED) return CREW_SHARED;
  const CREST_SCALE = 1 / 3;
  const CREST_BASE_Y = 0.292;
  const m = {
    leather: toonMat(0x8a5a33), // 皮甲
    leatherDark: toonMat(0x5c3a22), // 皮裙
    skin: toonMat(0xd9a06b), // 头/四肢
    bronze: toonMat(0xd4a84a), // 罗马盔 — 亮青铜
    crest: toonMat(0xc62828), // 红色羽冠主体
    crestDark: toonMat(0x7f1d1d), // 羽毛分层暗部
    crestLight: toonMat(0xef5350), // 羽轴高光
  };
  // 部件原点均在关节处；头/盔/冠的颈部位移直接烘焙进几何
  const box = (w, h, t, ox, oy) => {
    const geo = new THREE.BoxGeometry(w, h, t);
    geo.translate(ox, oy, 0);
    return facet(geo);
  };
  /** XY 面剪纸轮廓，Z 向薄挤出；z 用于把羽毛细节叠到羽冠前面。 */
  const extrudeShape = (shape, depth, z = 0) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 2,
    });
    geo.translate(0, 0, z - depth * 0.5);
    return facet(geo);
  };

  // 以羽冠与头盔的连接线为锚点缩放，避免羽冠缩小后悬空或下沉。
  const scaleCrestFromHelmet = (geo) => {
    geo.translate(0, -CREST_BASE_Y, 0);
    geo.scale(CREST_SCALE, CREST_SCALE, CREST_SCALE);
    geo.translate(0, CREST_BASE_Y, 0);
    return geo;
  };

  /** 多个独立羽片合并为一个共享几何，减少每名纸士兵的 draw call。 */
  const mergeExtrudedShapes = (shapes, depth, z = 0) => {
    const positions = [];
    const normals = [];
    for (const shape of shapes) {
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: 1,
      });
      geo.translate(0, 0, z - depth * 0.5);
      const f = facet(geo);
      const p = f.attributes.position.array;
      const n = f.attributes.normal.array;
      for (let i = 0; i < p.length; i++) {
        positions.push(p[i]);
        normals.push(n[i]);
      }
      f.dispose();
      geo.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    merged.computeBoundingSphere();
    return merged;
  };

  /**
   * 大型扇形红羽冠：底部横跨头盔前额至后颈，顶部高高展开。
   * 纸士兵是侧向剪纸轮廓，因此羽冠也沿 XY 面展开，保留清晰的扇形剪影。
   */
  const crestFan = () => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.205, 0.292);
    shape.lineTo(-0.245, 0.405);
    shape.lineTo(-0.232, 0.515);
    shape.lineTo(-0.17, 0.625);
    shape.lineTo(-0.082, 0.695);
    shape.lineTo(0.0, 0.725);
    shape.lineTo(0.092, 0.702);
    shape.lineTo(0.18, 0.64);
    shape.lineTo(0.235, 0.535);
    shape.lineTo(0.25, 0.42);
    shape.lineTo(0.198, 0.292);
    shape.closePath();
    return scaleCrestFromHelmet(extrudeShape(shape, 0.04));
  };

  /** 单片细羽毛：从盔顶向外上方倾斜，形成层层排列的羽冠。 */
  const crestFeathers = () => {
    const feathers = [];
    const stems = [];
    const count = 15;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      const baseX = -0.19 + u * 0.38;
      const edge = Math.abs(u - 0.5) * 2;
      const tipX = baseX * (1.12 + edge * 0.14);
      const tipY = 0.47 + 0.255 * (1 - Math.pow(edge, 1.45));
      const width = 0.023 - edge * 0.004;

      const feather = new THREE.Shape();
      feather.moveTo(baseX - width, 0.296);
      feather.lineTo(baseX + width, 0.296);
      feather.lineTo(tipX + width * 0.22, tipY - 0.04);
      feather.lineTo(tipX, tipY);
      feather.lineTo(tipX - width * 0.22, tipY - 0.04);
      feather.closePath();
      feathers.push(feather);

      const dx = tipX - baseX;
      const dy = tipY - 0.304;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;
      const half = 0.0042;
      const stem = new THREE.Shape();
      stem.moveTo(baseX + nx * half, 0.304 + ny * half);
      stem.lineTo(tipX + nx * half * 0.55, tipY + ny * half * 0.55);
      stem.lineTo(tipX - nx * half * 0.55, tipY - ny * half * 0.55);
      stem.lineTo(baseX - nx * half, 0.304 - ny * half);
      stem.closePath();
      stems.push(stem);
    }
    return {
      feathers: scaleCrestFromHelmet(mergeExtrudedShapes(feathers, 0.012, 0.022)),
      stems: scaleCrestFromHelmet(mergeExtrudedShapes(stems, 0.014, 0.029)),
    };
  };
  const crestDetail = crestFeathers();
  const geo = {
    torso: box(0.13, 0.17, 0.03, 0, 0.085), // 关节=髋
    skirt: box(0.15, 0.08, 0.026, 0, -0.04), // 关节=髋（下垂）
    // 脸从颊护之间露出
    head: box(0.064, 0.07, 0.024, 0, 0.188),
    // 罗马 galea 剪纸轮廓：盔碗 + 额檐 + 颈护 + 双颊护 + 羽冠座
    helmet: mergeBoxes([
      [0.118, 0.07, 0.05, 0, 0.252], // 盔碗 calotte
      [0.136, 0.022, 0.058, 0, 0.218], // 额檐 brow peak
      [0.108, 0.032, 0.052, 0, 0.198], // 颈护 neck guard
      [0.032, 0.062, 0.044, -0.06, 0.182], // 左颊护
      [0.032, 0.062, 0.044, 0.06, 0.182], // 右颊护
      [0.04, 0.022, 0.04, 0, 0.292], // 羽冠座（托住红羽冠底边）
    ]),
    // 大型红色扇形羽冠，以及分层羽片/羽轴细节
    crest: crestFan(),
    crestFeathers: crestDetail.feathers,
    crestStems: crestDetail.stems,
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
    ["crestFeathers", geo.crestFeathers, m.crestDark],
    ["crestStems", geo.crestStems, m.crestLight],
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
  crew.userData.rows = oars.map((oar, i) => {
    // 粘附点：麻醉弹可贴在桨手身上
    const attach = new THREE.Object3D();
    attach.name = `crew-attach-${i}`;
    attach.position.set(oar.position.x, CREW_HIP_Y, (oar.userData.side || 1) * 0.28);
    g.add(attach);
    return {
      x: oar.position.x,
      side: oar.userData.side || 1,
      phase: oar.userData.phase || 0,
      sedateT: 0,
      attach,
      oar,
    };
  });
  crew.userData.parts = parts;
  g.add(crew);
  g.userData.crew = crew;
  g.userData.oarImbalance = 0;
  updateWarshipCrew(g, 0, 0, 0); // 静坐姿态
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
 * @param {number} [dt]
 */
function updateWarshipCrew(boat, phase = 0, speed = 0, dt = 1 / 60) {
  const crew = boat?.userData?.crew;
  if (!crew) return;
  const rows = crew.userData.rows;
  const parts = crew.userData.parts;
  const sp = Math.max(0, Math.min(1, Number(speed) || 0));
  const d = Math.min(0.05, Math.max(0, Number(dt) || 0));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const s = r.side;
    // 麻醉：倒计时 + 瘫软坐姿，不划桨
    if ((r.sedateT ?? 0) > 0) {
      r.sedateT = Math.max(0, r.sedateT - d);
      if (r.attach) {
        r.attach.userData.sedated = r.sedateT > 0;
        r.attach.userData.sedateT = r.sedateT;
      }
      _cQBase.identity();
      if (s < 0) _cQBase.setFromAxisAngle(_CY, Math.PI);
      // 瘫倒：躯干侧倾、手臂垂落
      const limpLean = s * 0.85;
      _cQBody.copy(_cQBase).multiply(_cRz.setFromAxisAngle(_CZ, limpLean));
      _cPos.set(r.x, CREW_HIP_Y - 0.04, s * 0.28);
      _cMat.compose(_cPos, _cQBody, _cScale);
      parts.torso.setMatrixAt(i, _cMat);
      parts.skirt.setMatrixAt(i, _cMat);
      parts.head.setMatrixAt(i, _cMat);
      parts.helmet.setMatrixAt(i, _cMat);
      parts.crest.setMatrixAt(i, _cMat);
      parts.crestFeathers.setMatrixAt(i, _cMat);
      parts.crestStems.setMatrixAt(i, _cMat);
      _cQLimb.copy(_cQBase).multiply(_cRz.setFromAxisAngle(_CZ, limpLean + s * 0.9));
      _cOff.set(0, 0.08, 0).applyQuaternion(_cQBody).add(_cPos);
      _cOff.z += 0.016;
      _cMat.compose(_cOff, _cQLimb, _cScale);
      parts.armL.setMatrixAt(i, _cMat);
      _cOff.z -= 0.032;
      _cMat.compose(_cOff, _cQLimb, _cScale);
      parts.armR.setMatrixAt(i, _cMat);
      _cQLimb.copy(_cQBase).multiply(_cRz.setFromAxisAngle(_CZ, s * 0.2));
      _cOff.set(0.035, 0.01, 0.014).applyQuaternion(_cQBase).add(_cPos);
      _cMat.compose(_cOff, _cQLimb, _cScale);
      parts.legL.setMatrixAt(i, _cMat);
      _cOff.set(-0.035, 0.01, -0.014).applyQuaternion(_cQBase).add(_cPos);
      _cMat.compose(_cOff, _cQLimb, _cScale);
      parts.legR.setMatrixAt(i, _cMat);
      continue;
    }

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
    parts.crestFeathers.setMatrixAt(i, _cMat);
    parts.crestStems.setMatrixAt(i, _cMat);

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
  const helm = part(geo.helmet, m.bronze, 0.008);
  helm.name = "soldier-helm";
  body.add(helm);
  const crest = part(geo.crest, m.crest, 0.008);
  crest.name = "soldier-crest";
  body.add(crest);
  const crestFeathers = part(geo.crestFeathers, m.crestDark, 0.004);
  crestFeathers.name = "soldier-crest-feathers";
  body.add(crestFeathers);
  const crestStems = part(geo.crestStems, m.crestLight, 0.003);
  crestStems.name = "soldier-crest-stems";
  body.add(crestStems);

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
 * 船上剪纸桨手人数（= 桨数 = 装船容量）。
 * @param {THREE.Object3D|null|undefined} boat
 */
export function boatCrewCount(boat) {
  const oars = boat?.userData?.oars;
  return Array.isArray(oars) ? oars.length : 0;
}

/**
 * 搬运班组：count 名纸士兵沿 from→to 往返搬箱，相位错开不撞车。
 * 可选 cranePos：随机走起重机，一次装 4 件（加快装船）。
 * @param {{
 *   from: THREE.Vector3,
 *   to: THREE.Vector3,
 *   count?: number,
 *   period?: number,
 *   offset?: number,
 *   cranePos?: THREE.Vector3,
 *   crane?: THREE.Object3D,
 *   craneChance?: number,
 *   onDeliver?: (n: number) => void,
 * }} opts
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
    porter.userData.prevU = 0;
    porter.userData.useCrane = false;
    porter.userData.delivered = false;
    squad.add(porter);
    porters.push(porter);
  }
  squad.userData.from = opts.from.clone();
  squad.userData.to = opts.to.clone();
  squad.userData.period = opts.period ?? 12;
  squad.userData.offset = opts.offset ?? 0;
  squad.userData.porters = porters;
  squad.userData.cranePos = opts.cranePos ? opts.cranePos.clone() : null;
  squad.userData.crane = opts.crane || null;
  squad.userData.craneChance = opts.craneChance ?? 0.32;
  squad.userData.onDeliver = opts.onDeliver || null;
  /** false 时停在货堆旁待命（船离港/进港中） */
  squad.userData.loading = true;
  squad.userData.update = (t) => {
    const prev = squad.userData._lastT;
    const dt =
      Number.isFinite(prev) && t > prev
        ? Math.min(0.1, Math.max(0.001, t - prev))
        : 1 / 60;
    squad.userData._lastT = t;
    updatePorterSquad(squad, t, dt);
  };
  return squad;
}

/** 手工搬运时间轴 */
const HAND_CARRY_END = 0.46;
const HAND_DROP = 0.5;
const HAND_PAUSE_END = 0.56;
/** 起重机作业时间轴：货堆→起重机→吊运→回堆 */
const CRANE_WALK = 0.22;
const CRANE_DROP = 0.52;
const CRANE_DONE = 0.72;

/**
 * 班组循环：去程扛箱 → 船边卸货（+1）→ 空手返回；
 * 或随机使用起重机一次吊 4 件（+4）。
 */
function updatePorterSquad(squad, t, dt = 1 / 60) {
  const { from, to, period, offset, porters, cranePos, crane, loading } = squad.userData;
  const onDeliver = squad.userData.onDeliver;
  _ptA.copy(to).sub(from);
  _ptA.y = 0;
  _ptSide.set(-_ptA.z, 0, _ptA.x).normalize();

  for (let i = 0; i < porters.length; i++) {
    const p = porters[i];
    // 麻醉弹：卧倒僵直，跳过搬货循环
    if (p.userData?.sedated) {
      p.userData.sedateT = (p.userData.sedateT ?? 0) - dt;
      if (p.userData.sedateT > 0) {
        const parts = p.userData.parts;
        if (parts) {
          if (parts.legL) parts.legL.rotation.z = 0.1;
          if (parts.legR) parts.legR.rotation.z = -0.08;
          if (parts.armL) parts.armL.rotation.z = 0.3;
          if (parts.armR) parts.armR.rotation.z = 0.3;
          if (parts.body) parts.body.rotation.z = 0;
          if (parts.crate) parts.crate.visible = false;
        }
        continue;
      }
      p.userData.sedated = false;
      p.userData.sedateT = 0;
    }
    const { body, armL, armR, legL, legR, crate } = p.userData.parts;

    // 无船装货时：在货堆旁待命
    if (loading === false) {
      _ptB.copy(from).addScaledVector(_ptSide, p.userData.lane);
      p.position.copy(_ptB);
      p.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x);
      legL.rotation.z = 0;
      legR.rotation.z = 0;
      body.rotation.z = 0;
      armL.rotation.z = 0.25;
      armR.rotation.z = 0.25;
      crate.visible = false;
      p.userData.prevU = -1; // 哨兵：恢复装货时对齐相位，避免误计数
      p.userData.delivered = true;
      p.userData.useCrane = false;
      continue;
    }

    const u =
      ((((t + offset + (i * period) / porters.length) % period) + period) % period) / period;
    // 从待命恢复：对齐 prevU，本帧不触发交付
    if (p.userData.prevU < 0) {
      p.userData.prevU = u;
      p.userData.delivered = true;
      p.userData.useCrane = false;
    }
    const prevU = p.userData.prevU ?? u;

    // 周期回绕：决定本趟是否使用起重机（全班组共用一台，busy 时改手工）
    if (prevU > 0.8 && u < 0.2) {
      p.userData.delivered = false;
      const canCrane =
        !!cranePos &&
        !!crane &&
        !crane.userData.busy &&
        Math.random() < (squad.userData.craneChance ?? 0.32);
      p.userData.useCrane = canCrane;
      if (canCrane) {
        startHarborCraneJob(crane, period * (CRANE_DONE - CRANE_WALK) * 0.95);
      }
    }

    const useCrane = p.userData.useCrane && cranePos;
    let carrying = false;
    let moving = true;
    let hx = 1;
    let hz = 0;

    if (useCrane) {
      // 货堆 → 起重机操作位 → 等候吊运完成 → 空手回堆
      if (u < CRANE_WALK) {
        const s = easeIO(u / CRANE_WALK);
        _ptB.lerpVectors(from, cranePos, s);
        carrying = true;
        hx = cranePos.x - from.x;
        hz = cranePos.z - from.z;
      } else if (u < CRANE_DONE) {
        _ptB.copy(cranePos);
        moving = false;
        carrying = u < CRANE_DROP; // 把货挂上吊钩后空手等候
        hx = to.x - cranePos.x;
        hz = to.z - cranePos.z;
      } else {
        const s = easeIO((u - CRANE_DONE) / (1 - CRANE_DONE));
        _ptB.lerpVectors(cranePos, from, s);
        hx = from.x - cranePos.x;
        hz = from.z - cranePos.z;
      }
      // 吊钩放货瞬间计 4 件
      if (!p.userData.delivered && prevU < CRANE_DROP && u >= CRANE_DROP) {
        p.userData.delivered = true;
        onDeliver?.(4);
      }
    } else {
      // 手工：货堆 → 舷边卸 1 件 → 空手返回
      if (u < HAND_CARRY_END) {
        const s = easeIO(u / HAND_CARRY_END);
        _ptB.lerpVectors(from, to, s);
        carrying = true;
        hx = to.x - from.x;
        hz = to.z - from.z;
      } else if (u < HAND_PAUSE_END) {
        _ptB.copy(to);
        carrying = u < HAND_DROP;
        moving = false;
        hx = to.x - from.x;
        hz = to.z - from.z;
      } else {
        const s = easeIO((u - HAND_PAUSE_END) / (1 - HAND_PAUSE_END));
        _ptB.lerpVectors(to, from, s);
        hx = from.x - to.x;
        hz = from.z - to.z;
      }
      if (!p.userData.delivered && prevU < HAND_DROP && u >= HAND_DROP) {
        p.userData.delivered = true;
        onDeliver?.(1);
      }
    }

    _ptB.addScaledVector(_ptSide, p.userData.lane * (useCrane ? 0.35 : 1));
    p.position.copy(_ptB);
    const step = t * 9 + i * 2.3;
    p.position.y += moving ? Math.abs(Math.sin(step)) * 0.035 : 0;
    p.rotation.y = Math.atan2(-hz, hx || 1);
    const swing = moving ? Math.sin(step) * 0.5 : 0;
    legL.rotation.z = swing;
    legR.rotation.z = -swing;
    body.rotation.z = moving ? -0.1 : useCrane && u >= CRANE_WALK && u < CRANE_DONE ? 0.05 : 0;
    armL.rotation.z = carrying ? 1.22 : useCrane && u >= CRANE_WALK && u < CRANE_DONE ? 1.05 : 0.35 + swing * 0.5;
    armR.rotation.z = carrying ? 1.22 : useCrane && u >= CRANE_WALK && u < CRANE_DONE ? 1.05 : 0.35 - swing * 0.5;
    crate.visible = carrying;
    p.userData.prevU = u;
  }
}

// =====================================================================
//  码头起重机吊运动画（纸士兵随机调用，一次 4 件货）
// =====================================================================

/**
 * 触发一次起重机吊运：吊钩挂 4 箱 → 摆向船 → 卸下 → 回位。
 * @param {THREE.Object3D} crane
 * @param {number} [duration=3.6]
 */
export function startHarborCraneJob(crane, duration = 3.6) {
  if (!crane || crane.userData.busy) return false;
  const rope = crane.getObjectByName("crane-rope");
  // 吊钩是无名 mesh：rope 下方、靠悬臂前端
  let hookMesh = null;
  let hookRing = null;
  crane.traverse((o) => {
    if (o.name === "crane-rope" || o.name === "crane-boom" || o.name === "crane-winch") return;
    if (!o.isMesh) return;
    if (o.position.y < 1.2 && o.position.x > 2) {
      if (!hookMesh) hookMesh = o;
      else if (!hookRing) hookRing = o;
    }
  });

  // 4 件货挂在吊钩下
  const payload = new THREE.Group();
  payload.name = "crane-payload";
  const wood = toonMat(CRATE_WOOD);
  for (let i = 0; i < 4; i++) {
    const box = new THREE.Mesh(facet(new THREE.BoxGeometry(0.2, 0.16, 0.2)), wood);
    box.position.set((i % 2) * 0.22 - 0.11, -0.28 - Math.floor(i / 2) * 0.18, i < 2 ? 0.1 : -0.1);
    box.castShadow = true;
    payload.add(box);
  }
  const tipX = rope?.position.x ?? 3.0;
  const ropeLen = rope?.geometry?.parameters?.height ?? 1.85;
  payload.position.set(tipX, (rope?.position.y ?? 2) - ropeLen / 2 - 0.2, 0);
  crane.add(payload);

  crane.userData.busy = true;
  crane.userData.anim = {
    t: 0,
    duration: Math.max(1.5, duration),
    baseYaw: crane.rotation.y,
    rope,
    ropeBaseY: rope?.position.y ?? 0,
    ropeBaseScaleY: rope?.scale.y ?? 1,
    hookMesh,
    hookRing,
    hookBaseY: hookMesh?.position.y ?? 0,
    ringBaseY: hookRing?.position.y ?? 0,
    payload,
    payloadBaseY: payload.position.y,
  };
  return true;
}

/** 逐帧更新起重机吊运动画。 */
export function updateHarborCrane(crane, dt) {
  const anim = crane?.userData?.anim;
  if (!anim) return;
  const d = Math.min(0.05, Math.max(0, Number(dt) || 0));
  anim.t += d;
  const k = Math.min(1, anim.t / anim.duration);
  // 0–0.2 微降挂钩 · 0.2–0.45 提起 · 0.45–0.7 回转向船 · 0.7–0.88 放下卸货 · 0.88–1 回位
  let ropeMul = 1;
  let yawOff = 0;
  let payloadVis = true;
  if (k < 0.2) {
    ropeMul = 1 + (k / 0.2) * 0.25;
  } else if (k < 0.45) {
    ropeMul = 1.25 - ((k - 0.2) / 0.25) * 0.45;
  } else if (k < 0.7) {
    ropeMul = 0.8;
    yawOff = easeIO((k - 0.45) / 0.25) * 0.55;
  } else if (k < 0.88) {
    ropeMul = 0.8 + ((k - 0.7) / 0.18) * 0.5;
    yawOff = 0.55;
    if (k > 0.8) payloadVis = false;
  } else {
    const u = (k - 0.88) / 0.12;
    ropeMul = 1.3 - u * 0.3;
    yawOff = 0.55 * (1 - easeIO(u));
    payloadVis = false;
  }
  crane.rotation.y = anim.baseYaw + yawOff;
  if (anim.rope) {
    // 伸长绳 = 放大 Y 并下移中心
    anim.rope.scale.y = anim.ropeBaseScaleY * ropeMul;
    const half = (anim.rope.geometry?.parameters?.height ?? 1.85) * 0.5;
    // 保持顶端不动：中心随 scale 下移
    const tipY = anim.ropeBaseY + half * anim.ropeBaseScaleY;
    anim.rope.position.y = tipY - half * anim.rope.scale.y;
  }
  const drop = (ropeMul - 1) * 0.9;
  if (anim.hookMesh) anim.hookMesh.position.y = anim.hookBaseY - drop;
  if (anim.hookRing) anim.hookRing.position.y = anim.ringBaseY - drop;
  if (anim.payload) {
    anim.payload.visible = payloadVis;
    anim.payload.position.y = anim.payloadBaseY - drop;
  }
  if (k >= 1) {
    if (anim.payload) {
      crane.remove(anim.payload);
      anim.payload.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material && !o.material.userData?.shared) o.material.dispose?.();
      });
    }
    if (anim.rope) {
      anim.rope.scale.y = anim.ropeBaseScaleY;
      anim.rope.position.y = anim.ropeBaseY;
    }
    if (anim.hookMesh) anim.hookMesh.position.y = anim.hookBaseY;
    if (anim.hookRing) anim.hookRing.position.y = anim.ringBaseY;
    crane.rotation.y = anim.baseYaw;
    crane.userData.busy = false;
    crane.userData.anim = null;
  }
}

/**
 * 甲板上的装船进度货箱（随 cargo/capacity 显隐）。
 * @param {THREE.Object3D} boat
 * @param {number} [slots=8]
 */
export function ensureDeckCargoMarkers(boat, slots = 8) {
  if (!boat || boat.userData.deckCargo) return boat?.userData?.deckCargo;
  const group = new THREE.Group();
  group.name = "deck-cargo";
  const wood = toonMat(CRATE_WOOD);
  for (let i = 0; i < slots; i++) {
    const c = new THREE.Mesh(facet(new THREE.BoxGeometry(0.24, 0.2, 0.24)), wood);
    c.position.set(-1.15 + (i % 4) * 0.55, 0.95, i < 4 ? 0.14 : -0.14);
    c.rotation.y = (i * 0.37) % 1;
    c.visible = false;
    c.castShadow = true;
    group.add(c);
  }
  boat.add(group);
  boat.userData.deckCargo = group;
  return group;
}

/**
 * @param {THREE.Object3D} boat
 * @param {number} cargo
 * @param {number} capacity
 */
export function updateDeckCargoMarkers(boat, cargo, capacity) {
  const g = boat?.userData?.deckCargo;
  if (!g) return;
  const slots = g.children.length;
  const filled = Math.min(
    slots,
    Math.ceil((Math.max(0, cargo) / Math.max(1, capacity)) * slots)
  );
  for (let i = 0; i < slots; i++) g.children[i].visible = i < filled;
}

/**
 * 固定木马的系绳纸士兵：左手盾、右手长枪；后仰弓步拽绳姿态。
 * @returns {THREE.Group}
 */
export function createTieSoldier() {
  const root = createNightInfiltrationSoldier({ torchLeft: false });
  root.name = "tie-soldier";
  // 白天系绳专用标记：木马倾倒只统计这类士兵，与夜潜兵无关
  root.userData.kind = "tieSoldier";
  root.userData.role = "day-tiedown";
  const { body, armL, armR, legL, legR, crate } = root.userData.parts || {};
  if (crate) crate.visible = false;
  // 后仰拽绳 + 弓步蹬地（盾/枪仍在左右手）
  if (body) body.rotation.z = 0.3;
  if (armL) armL.rotation.z = 1.05; // 左臂前上（盾随臂）
  if (armR) armR.rotation.z = 1.15; // 右臂前上（枪随臂）
  if (legL) legL.rotation.z = 0.5;
  if (legR) legR.rotation.z = -0.42;
  const eq = root.userData.equipment;
  if (eq?.shield) eq.shield.position.set(-0.16, PORTER_HIP + 0.18, 0.14);
  if (eq?.spear) {
    eq.spear.position.set(0.22, PORTER_HIP + 0.2, 0.12);
    eq.spear.rotation.set(0.2, 0, -Math.PI / 2 - 0.2);
  }
  return root;
}

// 红盔/蓝盔指的是头盔上的「缨穗」（羽冠）颜色，盔体始终为共享的亮青铜。
const SOLDIER_CREST = {
  blue: { crest: 0x2563eb, feathers: 0x1e3a8a, stems: 0x93c5fd },
  red: { crest: 0xc62828, feathers: 0x7f1d1d, stems: 0xef5350 },
};

/**
 * 给纸士兵换盔顶缨穗颜色（蓝缨攻城 / 红缨守城）。只刷羽冠三件
 * （soldier-crest / -crest-feathers / -crest-stems），不动青铜盔体。
 * @param {THREE.Object3D} root
 * @param {"blue"|"red"} side
 */
export function paintSoldierHelm(root, side = "blue") {
  const pal = SOLDIER_CREST[side] || SOLDIER_CREST.blue;
  if (!root) return root;
  root.userData.helmSide = side;
  const mats = {
    "soldier-crest": toonMat(pal.crest),
    "soldier-crest-feathers": toonMat(pal.feathers),
    "soldier-crest-stems": toonMat(pal.stems),
  };
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    const mat = mats[o.name];
    if (mat) o.material = mat;
  });
  return root;
}

/**
 * 给战船甲板桨手（warship-crew 的 InstancedMesh）换缨穗颜色。
 * 船上看到的士兵是船自带的剪纸桨手，不是方阵士兵；方阵换边时船组也要同步换，
 * 否则「蓝缨士兵乘船」看起来仍是红缨。只换羽冠三件，盔体保持亮青铜；
 * 不改动 CREW_SHARED 共享材质（运河巡航船/红缨增援船仍是红缨）。
 * @param {THREE.Object3D} boat createFisherBoat 的战船
 * @param {"blue"|"red"} side
 */
export function paintBoatCrewCrest(boat, side = "blue") {
  if (!boat) return boat;
  if (boat.userData.crewCrestSide === side) return boat; // 幂等
  boat.userData.crewCrestSide = side;
  const pal = SOLDIER_CREST[side] || SOLDIER_CREST.blue;
  const mats = {
    "crew-crest": toonMat(pal.crest),
    "crew-crestFeathers": toonMat(pal.feathers),
    "crew-crestStems": toonMat(pal.stems),
  };
  boat.traverse((o) => {
    if (!o.isMesh) return;
    const mat = mats[o.name];
    if (mat) o.material = mat;
  });
  return boat;
}

/**
 * 卸下战船全部乘员：方阵士兵登岸（或打光）后，甲板应为空船。
 * 隐藏 warship-crew 整组（剪纸桨手 InstancedMesh）；桨保持停泊姿态。
 * @param {THREE.Object3D} boat createFisherBoat 的战船
 */
export function emptyBoatCrew(boat) {
  if (!boat) return boat;
  const crew = boat.userData.crew || boat.getObjectByName?.("warship-crew");
  if (crew) crew.visible = false;
  return boat;
}

/**
 * 港口鼓声巡查兵：左手盾牌、右手长枪（矛头向前），快步行进姿态。
 * @returns {THREE.Group}
 */
export function createHarborPatrolSoldier() {
  const root = createNightInfiltrationSoldier({ torchLeft: false });
  root.name = "harbor-patrol-soldier";
  root.userData.phalanxRole = "spear";
  const { body, armL, armR, crate } = root.userData.parts || {};
  if (crate) crate.visible = false;
  // 前倾突击：矛头朝局部 +X（行进方向）
  if (body) body.rotation.z = -0.14;
  if (armL) armL.rotation.z = -0.45; // 左盾微前
  if (armR) armR.rotation.z = 1.28; // 右枪前指
  const spear = root.userData.equipment?.spear;
  if (spear) {
    spear.position.set(0.28, 0.22, 0.02);
    // 枪杆沿 +X 前指
    spear.rotation.set(0, 0, -Math.PI / 2 - 0.08);
  }
  const shield = root.userData.equipment?.shield;
  if (shield) {
    shield.position.set(-0.16, PORTER_HIP + 0.14, 0.12);
  }
  return root;
}

/**
 * 方阵短剑盾兵：左手盾、右手青铜短剑。
 */
export function createGladiusSoldier() {
  const root = createNightInfiltrationSoldier({ torchLeft: false });
  root.name = "gladius-soldier";
  root.userData.phalanxRole = "gladius";
  const spear = root.userData.equipment?.spear;
  if (spear) spear.visible = false;
  const fig = root.children[0];
  const bronze = toonMat(0x9a7434, { flatShading: true });
  const wood = toonMat(0x4b3523, { flatShading: true });
  const sword = new THREE.Group();
  sword.name = "right-hand-gladius";
  const grip = part(new THREE.CylinderGeometry(0.012, 0.014, 0.08, 5), wood, 0.004);
  grip.position.y = 0.04;
  sword.add(grip);
  const blade = part(new THREE.BoxGeometry(0.028, 0.2, 0.008), bronze, 0.005);
  blade.position.y = 0.16;
  sword.add(blade);
  sword.position.set(0.2, PORTER_HIP + 0.12, 0.1);
  sword.rotation.set(0.15, 0, -0.9);
  fig?.getObjectByName("infiltration-equipment")?.add(sword);
  const eq = root.userData.equipment || {};
  eq.gladius = sword;
  root.userData.equipment = eq;
  const { armR } = root.userData.parts || {};
  if (armR) armR.rotation.z = 0.85;
  return root;
}

/**
 * 英格兰长弓兵（侧视剪纸）。
 * 臂几何沿局部 −Y 垂下，绕 Z 转：0=下垂，≈1.5=前平举，≈3.4=拉到耳侧。
 * 弓贴左手、箭随右手；撒放时弦弹回、手留在耳侧，再 follow-through。
 * 用 updateLongbowShot 驱动 reach→nock→draw→hold→loose→follow→recover。
 */
const BOW_ARM = {
  L_LOW: 0.62,
  L_AIM: 1.74,
  R_QUIVER: 0.08,
  R_NOCK: 1.52,
  R_DRAW: 3.82,
  R_FOLLOW: 2.18,
};
const BOW_HAND_LEN = 0.138;
const BOW_TIP = 0.235;
const BOW_STRING_LEN = 0.22;
const ARROW_HALF = 0.17;

const _bowHandL = new THREE.Vector3();
const _bowHandR = new THREE.Vector3();

function bowEase(u) {
  const x = THREE.MathUtils.clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

function bowSmooth(u) {
  const x = THREE.MathUtils.clamp(u, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function armHandPos(arm, out) {
  const th = arm?.rotation.z || 0;
  out.set(
    (arm?.position.x || 0) + BOW_HAND_LEN * Math.sin(th),
    (arm?.position.y || 0) - BOW_HAND_LEN * Math.cos(th),
    arm?.position.z || 0
  );
  return out;
}

function placeBowString(seg, ax, ay, bx, by) {
  if (!seg) return;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 0.001;
  seg.position.set((ax + bx) * 0.5, (ay + by) * 0.5, 0);
  seg.scale.y = len / BOW_STRING_LEN;
  seg.rotation.z = Math.atan2(dx, dy);
}

export function createLongbowSoldier() {
  const root = createNightInfiltrationSoldier({ torchLeft: false });
  root.name = "longbow-soldier";
  root.userData.phalanxRole = "longbow";
  const spear = root.userData.equipment?.spear;
  if (spear) spear.visible = false;
  const shield = root.userData.equipment?.shield;
  if (shield) shield.visible = false;

  const fig = root.children[0];
  const equip =
    root.userData.equipment?.equipment || fig?.getObjectByName("infiltration-equipment");
  const yew = toonMat(0x6b4a24, { flatShading: true });
  const horn = toonMat(0x3a2a18, { flatShading: true });
  const wrap = toonMat(0x4a3020, { flatShading: true });
  const stringMat = toonMat(0xf2ebe0, { flatShading: true });
  const shaftMat = toonMat(0x7a5a32, { flatShading: true });
  const headMat = toonMat(0x8a9498, { flatShading: true });
  const fletchMat = toonMat(0xc43c32, { flatShading: true });
  const leather = toonMat(0x5c3a22, { flatShading: true });

  const bow = new THREE.Group();
  bow.name = "english-longbow";
  const grip = part(new THREE.BoxGeometry(0.026, 0.055, 0.02), wrap, 0.004);
  bow.add(grip);

  const limbTop = new THREE.Group();
  limbTop.name = "bow-limb-top";
  const staveTop = part(new THREE.BoxGeometry(0.018, 0.21, 0.014), yew, 0.004);
  staveTop.position.y = 0.118;
  limbTop.add(staveTop);
  const tipT = part(new THREE.BoxGeometry(0.014, 0.036, 0.012), horn, 0.003);
  tipT.position.y = BOW_TIP;
  limbTop.add(tipT);
  bow.add(limbTop);

  const limbBot = new THREE.Group();
  limbBot.name = "bow-limb-bot";
  const staveBot = part(new THREE.BoxGeometry(0.018, 0.21, 0.014), yew, 0.004);
  staveBot.position.y = -0.118;
  limbBot.add(staveBot);
  const tipB = part(new THREE.BoxGeometry(0.014, 0.036, 0.012), horn, 0.003);
  tipB.position.y = -BOW_TIP;
  limbBot.add(tipB);
  bow.add(limbBot);

  const stringTop = part(new THREE.BoxGeometry(0.008, BOW_STRING_LEN, 0.008), stringMat, 0.002);
  stringTop.name = "bow-string-top";
  bow.add(stringTop);
  const stringBot = part(new THREE.BoxGeometry(0.008, BOW_STRING_LEN, 0.008), stringMat, 0.002);
  stringBot.name = "bow-string-bot";
  bow.add(stringBot);
  equip?.add(bow);

  const nocked = new THREE.Group();
  nocked.name = "nocked-arrow";
  const ash = part(new THREE.CylinderGeometry(0.007, 0.007, 0.34, 4), shaftMat, 0.002);
  ash.rotation.z = Math.PI / 2;
  nocked.add(ash);
  const head = part(new THREE.ConeGeometry(0.016, 0.05, 4), headMat, 0.002);
  head.rotation.z = -Math.PI / 2;
  head.position.x = 0.19;
  nocked.add(head);
  const fletch = part(new THREE.BoxGeometry(0.05, 0.036, 0.008), fletchMat, 0.002);
  fletch.position.x = -0.14;
  nocked.add(fletch);
  nocked.visible = false;
  equip?.add(nocked);

  const quiver = new THREE.Group();
  quiver.name = "longbow-quiver";
  const pot = part(new THREE.CylinderGeometry(0.026, 0.032, 0.15, 6), leather, 0.004);
  pot.rotation.z = 0.55;
  quiver.add(pot);
  for (let i = 0; i < 3; i++) {
    const extra = part(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 4), shaftMat, 0.001);
    extra.position.set(-0.02 + i * 0.016, 0.08, 0.01 - i * 0.006);
    extra.rotation.z = 0.5;
    quiver.add(extra);
    const nock = part(new THREE.BoxGeometry(0.018, 0.014, 0.006), fletchMat, 0.001);
    nock.position.copy(extra.position).add(new THREE.Vector3(-0.01, 0.07, 0));
    nock.rotation.z = 0.5;
    quiver.add(nock);
  }
  quiver.position.set(-0.05, PORTER_HIP + 0.07, -0.035);
  equip?.add(quiver);

  const { body, armL, armR, legL, legR } = root.userData.parts || {};
  if (armL) armL.rotation.z = BOW_ARM.L_LOW;
  if (armR) armR.rotation.z = BOW_ARM.R_QUIVER;
  if (body) body.rotation.z = 0.04;
  if (legL) legL.rotation.z = 0.16;
  if (legR) legR.rotation.z = -0.12;

  const eq = root.userData.equipment || {};
  eq.bow = bow;
  eq.limbTop = limbTop;
  eq.limbBot = limbBot;
  eq.stringTop = stringTop;
  eq.stringBot = stringBot;
  eq.nockedArrow = nocked;
  eq.quiver = quiver;
  eq.quiverMouth = new THREE.Vector3(-0.08, PORTER_HIP + 0.16, -0.02);
  root.userData.equipment = eq;
  root.userData.bowCycle = {
    phase: "reach",
    t: Math.random() * 0.18,
    draw: 0,
    holdFor: 0.16 + Math.random() * 0.16,
    seed: Math.random() * Math.PI * 2,
  };
  poseLongbowGear(root, { draw: 0, showArrow: false });
  return root;
}

/**
 * 按当前手臂角度摆弓、弦、搭箭。手臂角度由 updateLongbowShot 先写好。
 * @param {THREE.Group} root
 * @param {{ draw?: number, showArrow?: boolean, stringJiggle?: number, arrowFromQuiver?: number }} opts
 */
function poseLongbowGear(root, opts = {}) {
  const d = THREE.MathUtils.clamp(opts.draw ?? 0, 0, 1);
  const showArrow = !!opts.showArrow;
  const jiggle = opts.stringJiggle || 0;
  const fromQ = THREE.MathUtils.clamp(opts.arrowFromQuiver ?? 0, 0, 1);
  const { body, armL, armR, legL, legR } = root.userData.parts || {};
  const eq = root.userData.equipment || {};

  if (body) {
    body.rotation.z = 0.05 - d * 0.12;
    body.position.y = PORTER_HIP - d * 0.01;
  }
  if (legL) legL.rotation.z = 0.16 + d * 0.07;
  if (legR) legR.rotation.z = -0.12 - d * 0.05;

  armHandPos(armL, _bowHandL);
  armHandPos(armR, _bowHandR);

  const bow = eq.bow;
  if (bow) {
    bow.position.set(_bowHandL.x + 0.012, _bowHandL.y + 0.006, 0.045);
  }

  const bend = d * 0.28;
  if (eq.limbTop) eq.limbTop.rotation.z = bend;
  if (eq.limbBot) eq.limbBot.rotation.z = -bend;

  const tipTopX = -BOW_TIP * Math.sin(bend);
  const tipTopY = BOW_TIP * Math.cos(bend);
  const tipBotX = BOW_TIP * Math.sin(bend);
  const tipBotY = -BOW_TIP * Math.cos(bend);

  const braceX = -0.014;
  let nockX = braceX + jiggle;
  let nockY = jiggle * 0.15;
  if (bow && d > 0.02) {
    nockX = THREE.MathUtils.lerp(braceX, _bowHandR.x - bow.position.x, d) + jiggle;
    nockY = THREE.MathUtils.lerp(0, _bowHandR.y - bow.position.y, d) + jiggle * 0.2;
  }
  placeBowString(eq.stringTop, tipTopX, tipTopY, nockX, nockY);
  placeBowString(eq.stringBot, tipBotX, tipBotY, nockX, nockY);

  const arrow = eq.nockedArrow;
  if (!arrow) return;
  arrow.visible = showArrow;
  if (!showArrow) return;

  const mouth = eq.quiverMouth;
  if (fromQ > 0.001 && mouth) {
    const ax = THREE.MathUtils.lerp(mouth.x, _bowHandR.x + ARROW_HALF * 0.15, 1 - fromQ);
    const ay = THREE.MathUtils.lerp(mouth.y, _bowHandR.y, 1 - fromQ);
    arrow.position.set(ax, ay, 0.06);
    arrow.rotation.z = THREE.MathUtils.lerp(0.85, 0.08, 1 - fromQ);
    return;
  }

  const aimX = (_bowHandL.x - _bowHandR.x) || 0.2;
  const aimY = _bowHandL.y - _bowHandR.y;
  // 单骨纸臂拉到耳侧会偏高，箭路略压平，剪影才像平射
  const ang = Math.atan2(aimY, aimX) * 0.42;
  arrow.rotation.z = ang;
  arrow.position.set(
    _bowHandR.x + Math.cos(ang) * ARROW_HALF,
    _bowHandR.y + Math.sin(ang) * ARROW_HALF,
    0.055
  );
}

/**
 * 长弓循环。返回 true 的那一帧是撒放，应立刻射出飞箭。
 * @param {THREE.Group} root
 * @param {number} dt
 */
export function updateLongbowShot(root, dt = 0.016) {
  if (!root?.userData) return false;
  if (!root.userData.bowCycle) {
    root.userData.bowCycle = {
      phase: "reach",
      t: 0,
      draw: 0,
      holdFor: 0.2,
      seed: 0,
    };
  }
  const c = root.userData.bowCycle;
  const { armL, armR } = root.userData.parts || {};
  c.t += Math.max(0, Number(dt) || 0);
  let released = false;

  const setArms = (lz, rz) => {
    if (armL) armL.rotation.z = lz;
    if (armR) armR.rotation.z = rz;
  };

  if (c.phase === "reach") {
    const u = bowEase(c.t / 0.22);
    setArms(
      THREE.MathUtils.lerp(BOW_ARM.L_AIM * 0.7, BOW_ARM.L_LOW, u),
      THREE.MathUtils.lerp(BOW_ARM.R_FOLLOW, BOW_ARM.R_QUIVER, u)
    );
    c.draw = 0;
    poseLongbowGear(root, { draw: 0, showArrow: u > 0.55, arrowFromQuiver: 1 });
    if (c.t >= 0.22) {
      c.phase = "nock";
      c.t = 0;
    }
  } else if (c.phase === "nock") {
    const u = bowEase(c.t / 0.28);
    setArms(
      THREE.MathUtils.lerp(BOW_ARM.L_LOW, BOW_ARM.L_AIM, u),
      THREE.MathUtils.lerp(BOW_ARM.R_QUIVER, BOW_ARM.R_NOCK, u)
    );
    c.draw = u * 0.08;
    poseLongbowGear(root, {
      draw: c.draw,
      showArrow: true,
      arrowFromQuiver: 1 - u,
    });
    if (c.t >= 0.28) {
      c.phase = "draw";
      c.t = 0;
    }
  } else if (c.phase === "draw") {
    const u = bowSmooth(c.t / 0.68);
    setArms(
      THREE.MathUtils.lerp(BOW_ARM.L_AIM, BOW_ARM.L_AIM + 0.04, u),
      THREE.MathUtils.lerp(BOW_ARM.R_NOCK, BOW_ARM.R_DRAW, u)
    );
    c.draw = u;
    poseLongbowGear(root, { draw: c.draw, showArrow: true });
    if (c.t >= 0.68) {
      c.phase = "hold";
      c.t = 0;
      c.draw = 1;
      if (!c.holdFor) c.holdFor = 0.18 + Math.random() * 0.14;
    }
  } else if (c.phase === "hold") {
    const wobble = 0.018 * Math.sin(c.t * 10 + (c.seed || 0));
    setArms(BOW_ARM.L_AIM + 0.04, BOW_ARM.R_DRAW + wobble);
    c.draw = 1;
    poseLongbowGear(root, { draw: 1, showArrow: true, stringJiggle: wobble * 0.15 });
    if (c.t >= (c.holdFor || 0.2)) {
      c.phase = "loose";
      c.t = 0;
      released = true;
      if (root.userData.equipment?.nockedArrow) {
        root.userData.equipment.nockedArrow.visible = false;
      }
    }
  } else if (c.phase === "loose") {
    // 撒放：弦弹回，右手留在耳侧（不跟着弦走）
    const u = Math.min(1, c.t / 0.1);
    c.draw = Math.max(0, (1 - u) * (1 - u));
    const osc = Math.exp(-c.t * 22) * Math.sin(c.t * 78) * 0.035;
    setArms(BOW_ARM.L_AIM + 0.02, BOW_ARM.R_DRAW - u * 0.18);
    poseLongbowGear(root, { draw: Math.max(0, c.draw + osc * 4), showArrow: false, stringJiggle: osc });
    if (c.t >= 0.12) {
      c.phase = "follow";
      c.t = 0;
    }
  } else if (c.phase === "follow") {
    const u = bowEase(c.t / 0.26);
    setArms(
      THREE.MathUtils.lerp(BOW_ARM.L_AIM, BOW_ARM.L_AIM * 0.72, u),
      THREE.MathUtils.lerp(BOW_ARM.R_DRAW - 0.18, BOW_ARM.R_FOLLOW, u)
    );
    c.draw = 0;
    poseLongbowGear(root, { draw: 0, showArrow: false });
    if (c.t >= 0.26) {
      c.phase = "recover";
      c.t = 0;
    }
  } else {
    const u = bowEase(c.t / 0.16);
    setArms(
      THREE.MathUtils.lerp(BOW_ARM.L_AIM * 0.72, BOW_ARM.L_AIM * 0.7, u),
      THREE.MathUtils.lerp(BOW_ARM.R_FOLLOW, BOW_ARM.R_FOLLOW, u)
    );
    c.draw = 0;
    poseLongbowGear(root, { draw: 0, showArrow: false });
    if (c.t >= 0.16) {
      c.phase = "reach";
      c.t = 0;
      c.holdFor = 0.16 + Math.random() * 0.16;
    }
  }
  return released;
}

/**
 * 夜间潜入城堡的纸士兵：默认左手盾牌、右手长枪。
 * torchLeft=true 时左手改火炬（夜探照明），右手仍持长枪。
 *
 * 仍复用码头班组的剪纸罗马士兵几何，装备单独挂在 fig 上，
 * 因而不会改变已有搬运兵的尺寸与动画。
 * @param {{ torchLeft?: boolean }} [opts]
 * @returns {THREE.Group}
 */
export function createNightInfiltrationSoldier({ torchLeft = false } = {}) {
  const { m, geo } = crewShared();
  const root = buildPorter(m, geo);
  root.name = torchLeft ? "night-torch-soldier" : "night-shield-soldier";
  const { body, armL, armR, legL, legR, crate } = root.userData.parts;
  const fig = root.children[0];
  crate.visible = false;

  // 立定突进姿态：左手持盾前挡，右手持枪
  body.rotation.z = 0.02;
  armL.rotation.z = -0.42; // 左臂微前 → 盾面朝前
  armR.rotation.z = 0.55; // 右臂抬枪
  legL.rotation.z = 0.08;
  legR.rotation.z = -0.08;

  const bronze = m.bronze;
  const shieldMat = toonMat(0xb8c4c7, { flatShading: true });
  const shieldRimMat = toonMat(0x65777a, { flatShading: true });
  const spearWood = toonMat(0x4b3523, { flatShading: true });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb22e });
  const equipment = new THREE.Group();
  equipment.name = "infiltration-equipment";

  let shield = null;
  let torch = null;
  let torchLight = null;
  if (torchLeft) {
    torch = new THREE.Group();
    torch.name = "left-hand-torch";
    const shaft = part(new THREE.CylinderGeometry(0.012, 0.015, 0.18, 5), spearWood, 0.005);
    shaft.position.y = 0.09;
    torch.add(shaft);
    const flame = part(new THREE.ConeGeometry(0.035, 0.09, 5), flameMat, 0.006);
    flame.name = "torch-flame";
    flame.position.y = 0.225;
    torch.add(flame);
    torch.position.set(-0.15, PORTER_HIP + 0.12, 0.11);
    torchLight = new THREE.PointLight(0xff8a32, 0.75, 3.2, 2);
    torchLight.name = "infiltration-torch-light";
    torchLight.position.set(0, 0.2, 0.03);
    torch.add(torchLight);
    equipment.add(torch);
  } else {
    // 左手圆盾：面朝 +X 前（行进方向）
    shield = new THREE.Group();
    shield.name = "left-hand-shield";
    const face = part(new THREE.CylinderGeometry(0.1, 0.1, 0.028, 8), shieldMat, 0.008);
    face.rotation.z = Math.PI / 2; // 盾面朝左右？→ 改朝前
    face.rotation.y = Math.PI / 2;
    shield.add(face);
    const rim = part(new THREE.TorusGeometry(0.102, 0.012, 4, 8), shieldRimMat, 0.006);
    rim.rotation.y = Math.PI / 2;
    rim.position.x = 0.02;
    shield.add(rim);
    shield.position.set(-0.16, PORTER_HIP + 0.14, 0.1);
    equipment.add(shield);
  }

  // 右手长枪：木质长杆、青铜枪领、锥形枪尖，长度明显超过纸士兵身高。
  const spear = new THREE.Group();
  spear.name = "right-hand-long-spear";
  const shaft = part(new THREE.CylinderGeometry(0.012, 0.016, 0.62, 6), spearWood, 0.004);
  shaft.position.y = 0.11;
  spear.add(shaft);
  const butt = part(new THREE.CylinderGeometry(0.018, 0.012, 0.045, 6), bronze, 0.004);
  butt.position.y = -0.21;
  spear.add(butt);
  const collar = part(new THREE.CylinderGeometry(0.025, 0.025, 0.035, 6), bronze, 0.004);
  collar.position.y = 0.415;
  spear.add(collar);
  const spearhead = part(new THREE.ConeGeometry(0.052, 0.17, 6), bronze, 0.006);
  spearhead.name = "long-spear-head";
  spearhead.position.y = 0.515;
  spear.add(spearhead);
  // 长枪沿局部 +X 前指（行进方向）；与 createHarborPatrolSoldier 保持一致，
  // 避免默认竖直摆放导致“矛尖向天”。
  spear.position.set(0.28, PORTER_HIP + 0.12, 0.11);
  spear.rotation.set(0, 0, -Math.PI / 2 - 0.08);
  equipment.add(spear);

  fig.add(equipment);
  root.userData.equipment = { equipment, shield, spear, torch, torchLight };
  root.userData.torchBearer = !!torchLeft;
  return root;
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
  // 随机使用起重机：一次吊 4 件，加快装船（装船次数累加到船上士兵人数后离港）
  const deckTop = deckY + deckH / 2;
  const cranePos = new THREE.Vector3(
    crane.position.x + 0.35,
    deckTop,
    crane.position.z + 0.55
  );
  const squadA = createPorterSquad({
    from: new THREE.Vector3(-1.7, deckTop, 1.75),
    to: new THREE.Vector3(4.3, deckTop, 0.2),
    period: 12,
    offset: 0,
    cranePos,
    crane,
    craneChance: 0.3,
  });
  const squadB = createPorterSquad({
    from: new THREE.Vector3(2.2, deckTop, 1.55),
    to: new THREE.Vector3(5.1, deckTop, -0.25),
    period: 12,
    offset: 6, // 与 A 组错半周期，两组交替上货
    cranePos,
    crane,
    craneChance: 0.34,
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

  // 泊位船：装货计数初始状态（物流系统 bind 后接管离港/进港）
  boat.userData.harborDocked = true;
  boat.userData.cargoLoaded = 0;
  boat.userData.cargoCapacity = boatCrewCount(boat);
  ensureDeckCargoMarkers(boat);

  return {
    group: g,
    landmarks: { boat, crane, crates, cratesByCrane: crates2, porterSquads: [squadA, squadB] },
    /** 贴球后由调用方转为世界碰撞 */
    collidersLocal,
    squads: [squadA, squadB],
    /**
     * 逐帧驱动。若已挂 logistics（装船计数/离港/护城河进港），走物流；
     * 否则仅班组往返 + 起重机动画。
     */
    update: (dt, t) => {
      if (g.userData.logistics?.update) {
        g.userData.logistics.update(dt, t);
        return;
      }
      updateHarborCrane(crane, dt);
      squadA.userData.update(t);
      squadB.userData.update(t);
    },
  };
}
