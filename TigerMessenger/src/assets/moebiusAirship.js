// =====================================================================
//  莫比斯蒸汽朋克航空艇 · createMoebiusAirship()
//
//  还原参考插画中央偏左的橙红色蒸汽飞艇：
//  流线前重后尖的多面气囊 + 炭黑经纬网架 + 十字尾翼 +
//  悬吊欧式客运吊舱 + 张紧悬索；全件唐伯虎水墨 addOutline 描边，
//  castShadow 开启 → 在星球水面与桥上投下巨大的平边卡通阴影。
//
//  结构层级（骨骼链，防止零件飞散）：
//    airshipGroup                       根节点，局部原点 (0,0,0)
//    └─ rig                             悬浮摆动层（动画用，不影响贴放）
//       ├─ envelopeMesh                 中央流线气囊（4~5 段圆柱链 + 非等比缩放）
//       │  └─ latticeGroup              经纬网架（炭黑细扁箱紧贴表面）
//       │  └─ finGroup                  尾部 4 片 90° 均布十字尾翼
//       ├─ cableGroup                   14 根张紧悬索（超细灰圆柱）
//       └─ gondolaMesh                  吊舱（Y = -3.5，两侧奶白舷窗）
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";
import { quatYToDir } from "../world/sphereMath.js";
import { PLANET_RADIUS } from "../world/planet.js";

/* ---------------- 色板 ---------------- */
const HULL_DARK = 0xd35400;   // 赤陶橙红（主体）
const HULL_LIGHT = 0xe67e22;  // 暖橙（首尾段 / 尾翼）
const LATTICE = 0x2a2a2a;     // 炭黑网架
const GONDOLA = 0x5d4037;     // 古董深棕吊舱
const WINDOW = 0xf5efdc;      // 奶白舷窗
const CABLE = 0x8a8f94;       // 灰钢悬索

/* ---------------- 气囊纵剖面型线（+Z 为艇首，-Z 为艇尾） ----------------
 * [z, radius]：首端圆钝 r=1.5 → 中段鼓胀 r=2.2 → 尾端收尖 r=0.2
 */
const PROFILE = [
  [4.1, 0.4],   // 首尖收口
  [2.7, 1.5],   // 圆钝鼻头
  [1.1, 2.2],   // 鼓起
  [-0.7, 2.2],  // 最大截面
  [-2.3, 1.4],  // 收束
  [-4.1, 0.2],  // 尾尖
];
/** 气囊非等比缩放：Z 向拉长、Y 向略扁（流线前重感） */
const ENV_SCALE = { x: 1, y: 0.92, z: 1.1 };

/** 按型线插值气囊半径（根坐标 z，已计入非等比缩放） */
function envelopeRadiusAt(rootZ) {
  const z = rootZ / ENV_SCALE.z;
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [z1, r1] = PROFILE[i];
    const [z2, r2] = PROFILE[i + 1];
    if (z <= z1 && z >= z2) {
      const t = (z1 - z) / (z1 - z2);
      return (r1 + (r2 - r1) * t) * ENV_SCALE.y;
    }
  }
  return 0.2 * ENV_SCALE.y;
}

/** 登机垂绳长度（吊舱局部坐标） */
export const ROPE_LEN = 9;

/** 通用描边件工厂 */
function part(geo, mat, outline = 0.02) {
  const m = new THREE.Mesh(facet(geo), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  addOutline(m, outline);
  return m;
}

/* =====================================================================
 *  气囊：4~5 段 CylinderGeometry(radialSegments=10) 链式拼合
 * ===================================================================== */
function buildEnvelope() {
  const envelope = new THREE.Group();
  envelope.name = "airship-envelope";

  const matDark = toonMat(HULL_DARK, { flatShading: true });
  const matLight = toonMat(HULL_LIGHT, { flatShading: true });

  // 相邻型线点之间逐段成圆柱切片（radiusTop 对应 +Z 艇首端）
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [z1, r1] = PROFILE[i];
    const [z2, r2] = PROFILE[i + 1];
    const len = z1 - z2;
    const geo = new THREE.CylinderGeometry(r1, r2, len, 10, 1);
    geo.rotateX(Math.PI / 2); // 圆柱 +Y → +Z：top 半径落在艇首侧
    const slice = part(geo, i === 1 || i === 4 ? matLight : matDark, 0.035);
    slice.name = `envelope-slice-${i}`;
    slice.position.z = (z1 + z2) / 2;
    envelope.add(slice);
  }

  // 非等比缩放：Z 向拉长，整体流线
  envelope.scale.set(ENV_SCALE.x, ENV_SCALE.y, ENV_SCALE.z);
  return envelope;
}

/* =====================================================================
 *  经纬网架：炭黑细扁箱（厚 0.03）紧贴气囊外表面
 * ===================================================================== */
function buildLattice(envelope) {
  const lattice = new THREE.Group();
  lattice.name = "airship-lattice";
  const mat = toonMat(LATTICE, { flatShading: true });

  /* --- 纬向肋环：沿纵向阈值（型线拐点）环绕 --- */
  const ringZs = [2.7, 1.1, -0.7, -2.3];
  const SEG = 10;
  for (const rz of ringZs) {
    // 型线恰在拐点上，直接取该点半径
    const r = PROFILE.find((p) => p[0] === rz)[1] + 0.03;
    const chord = ((2 * Math.PI * r) / SEG) * 1.06;
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      const seg = part(new THREE.BoxGeometry(chord, 0.1, 0.03), mat, 0.008);
      seg.position.set(Math.cos(a) * r, Math.sin(a) * r, rz);
      seg.rotation.z = a + Math.PI / 2; // 长边沿切线方向
      lattice.add(seg);
    }
  }

  /* --- 经向肋条：沿横向阈值（10 条棱线）从首贯尾 --- */
  const RIBS = 10;
  for (let i = 0; i < RIBS; i++) {
    const holder = new THREE.Group();
    holder.rotation.z = (i / RIBS) * Math.PI * 2;
    for (let s = 0; s < PROFILE.length - 1; s++) {
      const [z1, r1] = PROFILE[s];
      const [z2, r2] = PROFILE[s + 1];
      const dr = r2 - r1;
      const dz = z2 - z1;
      const len = Math.hypot(dr, dz) * 1.02;
      const seg = part(new THREE.BoxGeometry(len, 0.1, 0.03), mat, 0.008);
      // 在 holder 局部系中 +X = 径向外法线
      seg.position.set((r1 + r2) / 2 + 0.03, 0, (z1 + z2) / 2);
      seg.rotation.y = -Math.atan2(dz, dr); // 贴合表面斜率
      holder.add(seg);
    }
    lattice.add(holder);
  }

  envelope.add(lattice);
  return lattice;
}

/* =====================================================================
 *  尾翼：4 片 90° 均布的扁平矩形稳定翼，挂在气囊尾端
 * ===================================================================== */
function buildFins(envelope) {
  const finGroup = new THREE.Group();
  finGroup.name = "airship-fins";
  finGroup.position.z = -4.05; // 气囊尾端（气囊局部坐标）
  const mat = toonMat(HULL_LIGHT, { flatShading: true, side: THREE.DoubleSide });

  for (let k = 0; k < 4; k++) {
    const holder = new THREE.Group();
    holder.rotation.z = (k * Math.PI) / 2; // 90° 十字均布
    const fin = part(new THREE.BoxGeometry(1.7, 0.05, 1.5), mat, 0.02);
    fin.position.set(0.95, 0, -0.25); // 径向外伸 + 略向后掠
    fin.rotation.z = 0.12; // 微翘
    holder.add(fin);
    finGroup.add(holder);
  }

  envelope.add(finGroup);
  return finGroup;
}

/* =====================================================================
 *  悬索：14 根张紧超细灰圆柱（radius 0.015）连接气囊与吊舱
 * ===================================================================== */
function buildCables() {
  const cableGroup = new THREE.Group();
  cableGroup.name = "airship-cables";
  const mat = toonMat(CABLE, { flatShading: true });

  const stations = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5]; // 沿吊舱长度 7 站
  const gondolaTop = -3.5 + 0.4; // 吊舱顶面 Y
  for (const z of stations) {
    const r = envelopeRadiusAt(z);
    for (const side of [-1, 1]) {
      const topY = -r - 0.04; // 贴气囊下表面
      const len = topY - gondolaTop;
      const cable = part(
        new THREE.CylinderGeometry(0.015, 0.015, len, 4),
        mat,
        0.004
      );
      cable.name = "rigging-cable";
      cable.position.set(side * 0.42, (topY + gondolaTop) / 2, z);
      cableGroup.add(cable);
    }
  }
  return cableGroup;
}

/* =====================================================================
 *  吊舱：船形客运舱（BoxGeometry 0.8 × 0.8 × 3.5）+ 两列奶白舷窗
 * ===================================================================== */
function buildGondola() {
  const gondola = new THREE.Group();
  gondola.name = "airship-gondola";
  gondola.position.y = -3.5; // 悬挂于气囊中心正下方 Y = -3.5

  const cabin = part(
    new THREE.BoxGeometry(0.8, 0.8, 3.5),
    toonMat(GONDOLA, { flatShading: true }),
    0.03
  );
  cabin.name = "gondola-cabin";
  gondola.add(cabin);

  // 船形首尾翘板（轻点缀，保持船形轮廓）
  const prow = part(
    new THREE.BoxGeometry(0.6, 0.3, 0.5),
    toonMat(GONDOLA, { flatShading: true }),
    0.018
  );
  prow.position.set(0, 0.18, 1.85);
  prow.rotation.x = -0.35;
  gondola.add(prow);
  const stern = prow.clone();
  stern.position.z = -1.85;
  stern.rotation.x = 0.35;
  gondola.add(stern);

  // 两侧连续一排奶白方形舷窗
  const winMat = toonMat(WINDOW, { flatShading: true });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const win = part(new THREE.BoxGeometry(0.03, 0.22, 0.26), winMat, 0.006);
      win.position.set(side * 0.415, 0.12, -1.25 + i * 0.5);
      gondola.add(win);
    }
  }

  // 舱顶黄铜栏杆细条（蒸汽朋克点缀）
  const rail = part(
    new THREE.BoxGeometry(0.86, 0.05, 3.3),
    toonMat(0xb08d57, { flatShading: true }),
    0.012
  );
  rail.position.y = 0.44;
  gondola.add(rail);

  // 登机垂绳：从舱底垂下，末端打结环（按 F 抓绳攀爬）
  // 几何原点 = 绳尾末端，getWorldPosition 即报拓拓末端世界位置
  const ropeGeo = new THREE.CylinderGeometry(0.035, 0.05, ROPE_LEN, 5);
  ropeGeo.translate(0, ROPE_LEN / 2, 0);
  const ropeMat = toonMat(0x8a6f4d, { flatShading: true });
  const rope = part(ropeGeo, ropeMat, 0.006);
  rope.name = "airship-board-rope";
  rope.position.set(0.62, -0.4 - ROPE_LEN, 1.2); // 舱侧栏杆外悬垂
  gondola.add(rope);
  // 绳尾结环（脚蹬点，提示可抓）
  const knot = part(new THREE.TorusGeometry(0.17, 0.055, 5, 8), ropeMat, 0.006);
  knot.position.y = 0.12;
  knot.rotation.x = Math.PI / 2;
  rope.add(knot);
  gondola.userData.rope = rope;

  return gondola;
}

/* =====================================================================
 *  主工厂：createMoebiusAirship()
 * ===================================================================== */
/**
 * 生成莫比斯蒸汽朋克航空艇（独立 Group，局部原点 = 气囊中心）。
 * 携带 userData.update(dt, t)：悬浮起伏 + 轻微横滚/俯仰。
 *
 * @returns {THREE.Group & { userData: object, update?: Function }}
 */
export function createMoebiusAirship() {
  const airshipGroup = new THREE.Group();
  airshipGroup.name = "moebius-airship";

  // 悬浮摆动层：贴放只动根节点，动画只动 rig
  const rig = new THREE.Group();
  rig.name = "airship-rig";
  airshipGroup.add(rig);

  /* ---------- 骨骼链装配 ---------- */
  const envelopeMesh = buildEnvelope();
  buildLattice(envelopeMesh);
  const finGroup = buildFins(envelopeMesh);
  rig.add(envelopeMesh);

  const cableGroup = buildCables();
  rig.add(cableGroup);

  const gondolaMesh = buildGondola();
  rig.add(gondolaMesh);

  /* ---------- 阴影：整艇 castShadow（跳过描边壳） ---------- */
  airshipGroup.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline) {
      o.castShadow = true;
    }
  });

  /* ---------- userData / 悬浮动画 ---------- */
  airshipGroup.userData.kind = "moebius-airship";
  airshipGroup.userData.assetType = "moebiusAirship";
  airshipGroup.userData.displayName = "莫比斯航空艇";
  airshipGroup.userData.parts = { envelopeMesh, finGroup, cableGroup, gondolaMesh };
  airshipGroup.userData.rope = gondolaMesh.userData.rope;
  airshipGroup.userData.collideRadius = 0; // 空中资产，不参与地面碰撞

  const phase = Math.random() * Math.PI * 2;
  airshipGroup.update = function updateAirship(_dt, t) {
    // 整体缓慢起伏（沿局部 +Y = 星球法线方向）
    rig.position.y = Math.sin(t * 0.5 + phase) * 0.55;
    // 轻微横滚与偏航漂移
    rig.rotation.z = Math.sin(t * 0.34 + phase) * 0.03;
    rig.rotation.y = Math.sin(t * 0.22 + phase) * 0.05;
    // 气囊微微俯仰（巡航呼吸感）
    envelopeMesh.rotation.x = Math.sin(t * 0.42 + phase) * 0.02;
  };

  return airshipGroup;
}

/* =====================================================================
 *  球面贴放：飞艇悬停于指定球面方向上空
 * ===================================================================== */
const _aq = new THREE.Quaternion();

/**
 * 把航空艇放到球面法线 dir 上空 hover 单位处（局部 +Y = 法线）。
 * @param {THREE.Group} airship
 * @param {THREE.Vector3} dir 单位方向（一般为湖沼位置方向）
 * @param {number} [R] 星球半径
 * @param {number} [hover] 悬浮高度（地表之上）
 * @param {number} [yaw] 初始偏航
 */
export function placeMoebiusAirshipAbove(
  airship,
  dir,
  R = PLANET_RADIUS,
  hover = 20,
  yaw = 0.7
) {
  airship.quaternion.copy(quatYToDir(dir, _aq));
  airship.rotateY(yaw);
  airship.position.copy(dir).multiplyScalar(R + hover);
  airship.userData.anchorDir = dir.clone();
  airship.userData.hover = hover;
  airship.userData.yaw = yaw;
  return airship;
}
