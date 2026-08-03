// =====================================================================
//  莫比斯原初湖沼 · createMoebiusSwampZone()  —— 彻底重写版
//
//  概念：玩家不是在「浮空大盘子」上走，而是在正常球体地表（Y=40）行走时，
//  突然遇到一个向球心方向深深塌陷、刀劈斧凿般的「原始深渊大坑洞」，
//  从草地边缘一跃而下，砸入地下 15 单位的半透明玻璃湖沼。
//
//  Y 轴绝对坐标分层（局部 Group 内锁死）：
//    Y = 40.0  正常球体地面高度（玩家行走的绿色草地 / 坑口缘）
//    Y = 25.0  地下半透明湖沼水面（比地表低整整 15 个单位）
//    Y = 10.0  坑洞最深处湖底沙地（总水深 15：从 Y=10 到 Y=25）
//    Y = 21.0  珍珠瓷感异星白鲸躯干中心（头破水出，身沉水底）
//
//  核心资产：
//    - 50×50 PlaneGeometry 玻璃水面（transmission 0.96 / ior 1.333 / #79D2C4）
//    - 程序拼装「珍珠瓷感异星白鲸」NPC（卵形身 + 鼻头 + 双鳍 + 翘尾分叉）
//    - 扎根 Y=10 的焦黑墨绿六棱柱原始世界树 + 蛇形缠绕藤蔓
//    - 3~4 朵 ConeGeometry 翻转 180° 的内凹荷叶小舟 + 焦黑土著人偶
//    - 全件 addOutline() 唐伯虎水墨描边；纯白环境光 1.2 消灭死黑阴影
// =====================================================================
import * as THREE from "three";
import { addOutline, toonMat, INK_COLOR } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { quatYToDir, latLonToDir, flatXZToLatLon } from "./sphereMath.js";
import { CANYON } from "./canyon.js";
import { PLANET_RADIUS } from "./planet.js";

/* ---------------- Y 轴绝对坐标分层（锁死，勿动） ---------------- */
/** 正常球体地面高度：玩家行走的草地 / 坑口缘 */
export const SWAMP_GROUND_Y = 40.0;
/** 地下半透明湖沼水面高度：比地表低整整 15 单位 */
export const SWAMP_WATER_Y = 25.0;
/** 坑洞最深处湖底沙地：巨树根部与河床乱石扎根于此 */
export const SWAMP_FLOOR_Y = 10.0;
/** 白鲸躯干中心：头破水出，身沉水下 */
const WHALE_Y = 21.0;

const WATER_Y = SWAMP_WATER_Y;

/* ---------------- 莫比斯插画色板（蓝绿主导 + 局部暖色提亮） ---------------- */
const WATER_COLOR = 0x6ecfc4; // 青绿玻璃水（浅青蓝）
const WATER_DEEP = 0x2a7a8f;  // 深水衰减（深海军蓝）
const WALL_COLOR = 0x3f8f8a;  // 坑壁苔青蓝绿（湿润岩壁）
const WALL_MOSS = 0x4fae9c;   // 坑壁苔藓亮斑
const FLOOR_COLOR = 0x5fa89f; // 湖底青沙
const GRASS_COLOR = 0x4fbd8a; // 地表青绿草
const TRUNK_COLOR = 0x2d6e5e; // 墨青巨干
const VINE_COLOR = 0x3fae7a;  // 青绿藤蔓
const ROCK_COLOR = 0x2f7a72;  // 水下青绿乱石
const ROOT_COLOR = 0x14524a;  // 水下焦青树根
const LOTUS_LEAF = 0x4fcf8e;  // 荷叶青绿
const WHALE_SKIN = 0xe3ead6;  // 米白/浅绿鲸豚肤（儒艮感）
const WHALE_BELLY = 0xf2f0e2; // 鲸腹更浅的米白
const DOLL_SKIN = 0x5c3a28;   // 土著深肤色
const DOLL_HAIR = 0xe8b64c;   // 土著金色卷发
const TOWER_TRUNK = 0x3a6b5c; // 坑边苍天巨干（青褐）
const TOWER_LEAF = 0x2f9d6e;  // 巨树冠叶绿
const PALM_LEAF = 0x35b07f;   // 棕榈/芭蕉叶青绿
/* 暖色点缀生物 */
const EEL_COLOR = 0xb8c94f;   // 黄绿鳗形生物
const WORM_COLOR = 0xe05a3a;  // 橙红管状蠕虫
const MUSHROOM_CAP = 0x9b6bb3;// 紫色蘑菇/珊瑚
const MUSHROOM_STEM = 0xe8e0d0;
const PINK_HANG = 0xf2a6b8;   // 粉色长尾垂挂生物
const BIRD_PINK = 0xf5c6d0;   // 粉白飞鸟
const BIRD_PURPLE = 0x9a8fb8; // 紫灰飞鸟
const SHELL_COLOR = 0xf0e6d2; // 米白贝壳
const FISH_GREEN = 0x3aa87a;  // 绿黑斑纹鱼
const FISH_DARK = 0x123c33;   // 鱼身黑斑/剪影

/** 通用描边件工厂 */
function part(geo, mat, outline = 0.03) {
  const m = new THREE.Mesh(facet(geo), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  addOutline(m, outline);
  return m;
}

/** 顶点抖动：刀劈斧凿的原始岩壁质感 */
function jitter(geo, amp, rnd) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(
      i,
      p.getX(i) + (rnd() - 0.5) * amp,
      p.getY(i) + (rnd() - 0.5) * amp * 0.6,
      p.getZ(i) + (rnd() - 0.5) * amp
    );
  }
  geo.computeVertexNormals();
  return geo;
}

/* =====================================================================
 *  2. 地下半透明 PBR 水体剖面（Y = 25.0）
 *  50×50 PlaneGeometry，高级物理玻璃：水上 / 水下分层透视
 * ===================================================================== */
function createWaterSurface() {
  const geo = new THREE.PlaneGeometry(50, 50, 6, 6);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({
    transmission: 0.96,
    transparent: true,
    opacity: 1.0,
    roughness: 0.03,
    metalness: 0.0,
    ior: 1.333, // 水的真实折射率
    thickness: 1.5,
    color: new THREE.Color(WATER_COLOR), // 浅青蓝玻璃水
    attenuationColor: new THREE.Color(WATER_DEEP), // 深处渐入深海军蓝
    attenuationDistance: 18,
    clearcoat: 0.35,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const water = new THREE.Mesh(geo, mat);
  water.name = "swamp-underground-waterline";
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  addOutline(water, 0.014, INK_COLOR, 0.05);

  // 一圈闭合刚劲黑色细墨线（水面边框）
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-25, 0.04, -25),
      new THREE.Vector3(25, 0.04, -25),
      new THREE.Vector3(25, 0.04, 25),
      new THREE.Vector3(-25, 0.04, 25),
    ]),
    new THREE.LineBasicMaterial({ color: INK_COLOR })
  );
  ring.raycast = () => {};
  water.add(ring);
  return water;
}

/* =====================================================================
 *  3. 程序化实时拼装「珍珠瓷感异星白鲸」NPC
 *  Thinking in Boxes：卵形身 + 圆鼻头 + 双扁鳍 + 微翘分叉尾
 * ===================================================================== */
function buildBelugaWhale(rnd) {
  const whale = new THREE.Group();
  whale.name = "moebius-beluga-whale";

  // 温润异星皮肤：儒艮/海牛般的米白浅绿温润瓷感
  const skin = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(WHALE_SKIN), // 米白浅绿
    roughness: 0.1,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    emissive: new THREE.Color("#1c3a36"), // 淡淡青蓝内发光
  });

  /** @type {THREE.Mesh[]} */
  const parts = [];
  const addPart = (mesh) => {
    mesh.castShadow = true;
    addOutline(mesh, 0.045);
    whale.add(mesh);
    parts.push(mesh);
    return mesh;
  };

  // 身体：横向非等比拉伸、前圆后尖的流线型卵形多面体
  const body = new THREE.Mesh(facet(new THREE.SphereGeometry(1, 12, 9)), skin);
  body.scale.set(1.8, 1.2, 3.4); // 锁死的非等比缩放
  addPart(body);

  // 鼻头：前端贴一个小圆球，圆润憨厚
  const nose = new THREE.Mesh(facet(new THREE.SphereGeometry(0.62, 10, 8)), skin);
  nose.position.set(0, 0.12, 3.25);
  addPart(nose);

  // 眼睛：刚好破水而出的黑豆眼（局部 y≈+1.45 → 世界 Y≈22.5，水线之上）
  const eyeMat = toonMat(0x1a1a1a);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(facet(new THREE.SphereGeometry(0.13, 6, 5)), eyeMat);
    eye.position.set(side * 1.02, 1.45, 2.45);
    addPart(eye);
  }

  // 憨态可掬的微笑嘴线
  const mouth = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, -0.12, 3.72),
      new THREE.Vector3(0, -0.28, 3.86),
      new THREE.Vector3(0.5, -0.12, 3.72),
    ]),
    new THREE.LineBasicMaterial({ color: INK_COLOR })
  );
  mouth.raycast = () => {};
  whale.add(mouth);

  // 鱼鳍：身体两侧贴两片扁平三角形
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(facet(new THREE.ConeGeometry(0.6, 1.9, 3)), skin);
    fin.scale.set(1, 1, 0.26); // 压扁成三角鳍
    fin.rotation.order = "ZXY";
    fin.rotation.z = side * (Math.PI / 2 - 0.45); // 向外平展微后掠
    fin.rotation.x = 0.25;
    fin.position.set(side * 1.72, -0.42, 0.6);
    addPart(fin);
  }

  // 尾部：微翘的尾柄 + 分叉尾巴（两片后掠叶瓣）
  const tailStock = new THREE.Mesh(facet(new THREE.ConeGeometry(0.55, 1.7, 6)), skin);
  tailStock.rotation.x = -Math.PI / 2 - 0.22; // 朝后且微翘
  tailStock.position.set(0, 0.3, -3.85);
  addPart(tailStock);
  for (const side of [-1, 1]) {
    const fluke = new THREE.Mesh(facet(new THREE.ConeGeometry(0.52, 1.8, 3)), skin);
    fluke.scale.set(1, 1, 0.2);
    fluke.rotation.order = "ZXY";
    fluke.rotation.x = -Math.PI / 2 - 0.4;
    fluke.rotation.z = side * 0.55;
    fluke.position.set(side * 0.62, 0.72, -4.6);
    addPart(fluke);
  }

  whale.userData.parts = parts;
  return whale;
}

/* =====================================================================
 *  4a. 原始世界树（扎根 Y = 10.0）：焦黑墨绿六棱柱 + 蛇形藤蔓
 * ===================================================================== */
function buildWorldTree(rnd, swampZone) {
  const g = new THREE.Group();
  g.name = "swamp-ancient-world-tree";

  const trunkH = 58; // Y=10 → Y=68，上穿水面伸向高空
  const trunk = part(
    new THREE.CylinderGeometry(1.4, 2.6, trunkH, 6), // 六棱柱
    toonMat(TRUNK_COLOR, { flatShading: true }),
    0.05
  );
  trunk.name = "world-tree-trunk";
  trunk.scale.set(1.12, 1, 0.9);
  trunk.position.set(-8, SWAMP_FLOOR_Y + trunkH * 0.5, -7);
  trunk.rotation.z = 0.05;
  trunk.rotation.x = -0.03;
  g.add(trunk);

  // 水下根部：焦黑抓地根须（Y=10 扎根）
  const rootMat = toonMat(ROOT_COLOR, { flatShading: true });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.6;
    const root = part(
      new THREE.ConeGeometry(0.5 + rnd() * 0.3, 3.2 + rnd() * 2.2, 4),
      rootMat,
      0.02
    );
    root.rotation.z = Math.PI + (rnd() - 0.5) * 0.9; // 倒扣扎入沙地
    root.rotation.y = a;
    root.position.set(
      trunk.position.x + Math.cos(a) * 2.2,
      SWAMP_FLOOR_Y + 0.9,
      trunk.position.z + Math.sin(a) * 2.2
    );
    g.add(root);
  }

  // 树冠：水上多层低多边球（Y=52 以上）
  for (let i = 0; i < 7; i++) {
    const canopy = part(
      new THREE.IcosahedronGeometry(2.4 + rnd() * 2.0, 0),
      toonMat(0x196f3d, { flatShading: true }),
      0.03
    );
    const a = rnd() * Math.PI * 2;
    const d = 0.8 + rnd() * 4.2;
    canopy.position.set(
      trunk.position.x + Math.cos(a) * d,
      52 + rnd() * 12,
      trunk.position.z + Math.sin(a) * d
    );
    g.add(canopy);
  }

  // 翠绿藤蔓：绕巨树与水下岩石蛇形缠绕
  const vineMat = toonMat(VINE_COLOR, { flatShading: true });
  const tx = trunk.position.x;
  const tz = trunk.position.z;
  const vineCount = 5 + ((rnd() * 2) | 0);
  for (let v = 0; v < vineCount; v++) {
    const pts = [];
    const phase = rnd() * Math.PI * 2;
    const turns = 1.2 + rnd() * 1.5;
    const y0 = SWAMP_FLOOR_Y + rnd() * 2; // 从水底起步
    const y1 = 44 + rnd() * 14;
    const segs = 14;
    const rad0 = 2.6 + rnd() * 1.4;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const ang = phase + t * turns * Math.PI * 2;
      const rr = rad0 * (0.88 + 0.22 * Math.sin(t * 6 + phase));
      pts.push(
        new THREE.Vector3(tx + Math.cos(ang) * rr, y0 + (y1 - y0) * t, tz + Math.sin(ang) * rr)
      );
    }
    const tube = part(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.16 + rnd() * 0.12, 5, false),
      vineMat,
      0.018
    );
    tube.name = `swamp-vine-${v}`;
    g.add(tube);
  }

  swampZone.add(g);
  return g;
}

/* =====================================================================
 *  4b. 内凹荷叶小舟（Y = 25.0）：ConeGeometry 翻转 180° 成凹陷浅碗
 * ===================================================================== */
function buildNativeDoll(scale = 1) {
  const doll = new THREE.Group();
  doll.name = "swamp-native-doll";
  const mat = toonMat(DOLL_SKIN, { flatShading: true });
  const torso = part(new THREE.ConeGeometry(0.26 * scale, 0.72 * scale, 5), mat, 0.012);
  torso.position.y = 0.36 * scale;
  doll.add(torso);
  const head = part(new THREE.SphereGeometry(0.17 * scale, 6, 5), mat, 0.01);
  head.position.y = 0.86 * scale;
  doll.add(head);
  // 金色卷发（插画中黑皮肤金发的土著特征）
  const hairMat = toonMat(DOLL_HAIR, { flatShading: true });
  for (let i = 0; i < 4; i++) {
    const curl = part(new THREE.SphereGeometry(0.075 * scale, 5, 4), hairMat, 0.008);
    const a = (i / 4) * Math.PI * 2 + 0.4;
    curl.position.set(
      Math.cos(a) * 0.1 * scale,
      (0.97 + (i % 2) * 0.04) * scale,
      Math.sin(a) * 0.1 * scale
    );
    doll.add(curl);
  }
  return doll;
}

function createLotusLeafBoat(rnd, radius = 4.2) {
  const g = new THREE.Group();
  g.name = "swamp-lotus-leaf-boat";

  // 开放圆锥沿 X 轴翻转 180° → 向内凹陷的浅碗状巨型荷叶小舟
  const leafGeo = new THREE.ConeGeometry(radius, radius * 0.42, 8, 1, true);
  const leaf = part(leafGeo, toonMat(LOTUS_LEAF, { flatShading: true }), 0.04);
  leaf.rotation.x = Math.PI; // 口朝上，内凹
  leaf.position.y = 0.08;
  g.add(leaf);

  // 叶底厚盘（水下侧也有体积）
  const pad = part(
    new THREE.CylinderGeometry(radius * 0.7, radius * 0.86, 0.22, 8),
    toonMat(0x27ae60, { flatShading: true }),
    0.026
  );
  pad.position.y = -0.35;
  g.add(pad);

  // 碗中 2~3 个极简焦黑土著人偶，还原叙事生活气息
  const dollN = 2 + ((rnd() * 2) | 0);
  for (let i = 0; i < dollN; i++) {
    const doll = buildNativeDoll(0.85 + rnd() * 0.4);
    const a = rnd() * Math.PI * 2;
    const d = rnd() * radius * 0.42;
    doll.position.set(Math.cos(a) * d, 0.1, Math.sin(a) * d);
    doll.rotation.y = rnd() * Math.PI * 2;
    g.add(doll);
  }

  // 一杆长篙（插画中角色的撑杆）
  const pole = part(
    new THREE.CylinderGeometry(0.05, 0.05, radius * 1.7, 4),
    toonMat(0x6e4a2f, { flatShading: true }),
    0.01
  );
  pole.rotation.z = Math.PI / 2 - 0.35;
  pole.position.set(radius * 0.4, 0.7, radius * 0.2);
  g.add(pole);

  return g;
}

/* =====================================================================
 *  4c. 参考插画生态组件：鳗/管虫/紫蘑菇/粉垂生物/飞鸟/贝壳/棕榈
 * ===================================================================== */
/** 黄绿鳗形生物：水下蛇形游动（CatmullRom 管体，头部圆钝） */
function buildSwampEel(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-eel";
  const pts = [];
  const phase = rnd() * Math.PI * 2;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector3(
      t * 11 - 5.5,
      Math.sin(t * Math.PI * 2 + phase) * 1.2,
      Math.cos(t * Math.PI * 1.4 + phase) * 1.6
    ));
  }
  const tube = part(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.3, 6, false),
    toonMat(EEL_COLOR, { flatShading: true }),
    0.02
  );
  g.add(tube);
  const head = part(new THREE.SphereGeometry(0.44, 7, 6), toonMat(EEL_COLOR, { flatShading: true }), 0.02);
  head.position.copy(pts[8]).add(new THREE.Vector3(0.35, 0, 0));
  head.scale.set(1.5, 0.9, 0.9);
  g.add(head);
  const eyeMat = toonMat(FISH_DARK);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(facet(new THREE.SphereGeometry(0.07, 5, 4)), eyeMat);
    eye.position.copy(head.position).add(new THREE.Vector3(0.3, 0.14, side * 0.26));
    g.add(eye);
  }
  g.userData.phase = phase;
  return g;
}

/** 橙红管状蠕虫丛：湖底扎根，顶端微张 */
function buildTubeWormCluster(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-tube-worms";
  const mat = toonMat(WORM_COLOR, { flatShading: true });
  const n = 4 + ((rnd() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const h = 1.1 + rnd() * 1.6;
    const worm = part(new THREE.CylinderGeometry(0.13 + rnd() * 0.07, 0.2 + rnd() * 0.08, h, 6), mat, 0.014);
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 0.9;
    worm.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d);
    worm.rotation.z = (rnd() - 0.5) * 0.3;
    worm.rotation.x = (rnd() - 0.5) * 0.3;
    g.add(worm);
    const tip = part(new THREE.SphereGeometry(0.16 + rnd() * 0.06, 6, 5), toonMat(0xf2825f, { flatShading: true }), 0.012);
    tip.position.set(worm.position.x, h + 0.06, worm.position.z);
    tip.scale.y = 0.7;
    g.add(tip);
  }
  return g;
}

/** 紫色蘑菇/珊瑚状植物（坑缘与水下皆可） */
function buildMoebiusMushroom(rnd, scale = 1) {
  const g = new THREE.Group();
  g.name = "swamp-mushroom";
  const h = (0.9 + rnd() * 1.2) * scale;
  const stem = part(
    new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, h, 5),
    toonMat(MUSHROOM_STEM, { flatShading: true }),
    0.014
  );
  stem.position.y = h / 2;
  g.add(stem);
  const capR = (0.42 + rnd() * 0.4) * scale;
  const cap = part(new THREE.SphereGeometry(capR, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(MUSHROOM_CAP, { flatShading: true }), 0.018);
  cap.position.y = h;
  g.add(cap);
  if (rnd() > 0.4) {
    const h2 = h * 0.6;
    const stem2 = part(new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, h2, 5), toonMat(MUSHROOM_STEM, { flatShading: true }), 0.01);
    stem2.position.set(capR * 0.9, h2 / 2, capR * 0.4);
    g.add(stem2);
    const cap2 = part(new THREE.SphereGeometry(capR * 0.6, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(MUSHROOM_CAP, { flatShading: true }), 0.012);
    cap2.position.set(capR * 0.9, h2, capR * 0.4);
    g.add(cap2);
  }
  return g;
}

/** 粉色长尾垂挂生物：悬于藤蔓下，随风轻摆（蛞蝓/水母感） */
function buildPinkHanger(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-pink-hanger";
  const mat = toonMat(PINK_HANG, { flatShading: true });
  const body = part(new THREE.SphereGeometry(0.42, 7, 6), mat, 0.02);
  body.scale.set(0.85, 1.2, 0.85);
  body.position.y = -0.5;
  g.add(body);
  const tailPts = [
    new THREE.Vector3(0, -0.9, 0),
    new THREE.Vector3(0.18, -1.7, 0.08),
    new THREE.Vector3(-0.12, -2.6, -0.06),
    new THREE.Vector3(0.1, -3.4, 0.05),
  ];
  const tail = part(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 16, 0.09, 5, false),
    mat,
    0.012
  );
  g.add(tail);
  const eyeMat = toonMat(FISH_DARK);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(facet(new THREE.SphereGeometry(0.05, 5, 4)), eyeMat);
    eye.position.set(side * 0.16, -0.42, 0.34);
    g.add(eye);
  }
  g.userData.phase = rnd() * Math.PI * 2;
  return g;
}

/** 飞鸟：粉白 / 紫灰，坑口上空盘旋 */
function buildSwampBird(rnd, color) {
  const g = new THREE.Group();
  g.name = "swamp-bird";
  const mat = toonMat(color, { flatShading: true });
  const body = part(new THREE.ConeGeometry(0.28, 1.0, 5), mat, 0.014);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wingGeo = new THREE.PlaneGeometry(1.15, 0.42);
  for (const side of [-1, 1]) {
    const wing = part(wingGeo, toonMat(color, { flatShading: true, side: THREE.DoubleSide }), 0.01);
    wing.position.set(side * 0.62, 0.08, 0);
    wing.rotation.z = side * 0.5;
    wing.userData.side = side;
    g.add(wing);
    g.userData[`wing${side > 0 ? "R" : "L"}`] = wing;
  }
  const beak = part(new THREE.ConeGeometry(0.08, 0.28, 4), toonMat(0xe8b64c, { flatShading: true }), 0.008);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.04, 0.6);
  g.add(beak);
  g.userData.orbitR = 20 + rnd() * 12;
  g.userData.orbitY = SWAMP_GROUND_Y + 7 + rnd() * 9;
  g.userData.speed = 0.18 + rnd() * 0.16;
  g.userData.phase = rnd() * Math.PI * 2;
  return g;
}

/** 米白贝壳（扇面压扁 + 放射刻线） */
function buildShell(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-shell";
  const shell = part(new THREE.SphereGeometry(0.5 + rnd() * 0.25, 8, 5), toonMat(SHELL_COLOR, { flatShading: true }), 0.016);
  shell.scale.set(1, 0.35, 0.85);
  g.add(shell);
  const ridge = part(new THREE.TorusGeometry(0.42, 0.045, 4, 8, Math.PI), toonMat(0xdccfb4, { flatShading: true }), 0.01);
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = 0.12;
  g.add(ridge);
  return g;
}

/** 坑缘棕榈/丛林树：弯曲青褐干 + 放射棕榈叶丛（湿润繁茂感） */
function buildRimPalm(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-rim-palm";
  const h = 7 + rnd() * 6;
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.5, h, 6);
  trunkGeo.translate(0, h / 2, 0);
  trunkGeo.rotateZ(0.12 + rnd() * 0.14); // 微微弯向坑心
  const trunk = part(trunkGeo, toonMat(TOWER_TRUNK, { flatShading: true }), 0.024);
  g.add(trunk);
  const leafMat = toonMat(PALM_LEAF, { flatShading: true, side: THREE.DoubleSide });
  const top = new THREE.Vector3(-Math.sin(0.12 + 0.14) * h * 0.5, h * 0.98, 0);
  const n = 6 + ((rnd() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const leaf = part(new THREE.PlaneGeometry(0.85, 3.6 + rnd() * 1.6, 1, 3), leafMat, 0.014);
    leaf.geometry.translate(0, -1.9, 0); // 以叶柄为轴下垂
    leaf.position.copy(top);
    leaf.rotation.order = "YXZ";
    leaf.rotation.y = a;
    leaf.rotation.x = 0.85 + rnd() * 0.5; // 外展下垂
    g.add(leaf);
  }
  return g;
}

/** 坑边苍天巨树：扎根 Y=40 地面，高耸入云（低于地表的湖沼被它环抱） */
function buildToweringTree(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-towering-tree";
  const h = 18 + rnd() * 14;
  const trunk = part(
    new THREE.CylinderGeometry(0.5 + rnd() * 0.3, 1.05 + rnd() * 0.4, h, 6),
    toonMat(TOWER_TRUNK, { flatShading: true }),
    0.028
  );
  trunk.position.y = h / 2;
  trunk.rotation.z = (rnd() - 0.5) * 0.08;
  g.add(trunk);
  // 顶部低多边叶簇（莫比斯式圆冠）
  const leafMat = toonMat(TOWER_LEAF, { flatShading: true });
  const crownN = 4 + ((rnd() * 3) | 0);
  for (let i = 0; i < crownN; i++) {
    const canopy = part(
      new THREE.IcosahedronGeometry(1.8 + rnd() * 2.2, 0),
      leafMat,
      0.024
    );
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 2.6;
    canopy.position.set(Math.cos(a) * d, h - 1 + rnd() * 4.5, Math.sin(a) * d);
    g.add(canopy);
  }
  return g;
}

/* =====================================================================
 *  1. 主函数：地表向下深挖 30 单位大坑洞（水面降至地下 15 单位）
 * ===================================================================== */
/**
 * 创建莫比斯原初湖沼。
 * 局部 Y 轴锁死：Y=40 地表草地 / Y=25 玻璃水面 / Y=10 湖底沙地。
 * 玩家可从 Y=40 草地边缘自由落体，砸入 Y=25 水中。
 *
 * @param {{ seed?: number }} [opts]
 * @returns {THREE.Group & { userData: object, update?: Function }}
 */
export function createMoebiusSwampZone(opts = {}) {
  let s = (opts.seed ?? 20260804) >>> 0;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };

  const swampZone = new THREE.Group();
  swampZone.name = "moebius-swamp-zone";

  /* ---------- 5. 纯白环境光 1.2：彻底消灭 realistic 死黑阴影 ---------- */
  const amb = new THREE.AmbientLight(0xffffff, 1.2);
  amb.name = "swamp-ambient-white";
  swampZone.add(amb);
  const hemi = new THREE.HemisphereLight(0xf5fffb, 0xa5cad6, 0.5);
  hemi.position.set(0, SWAMP_GROUND_Y + 20, 0);
  swampZone.add(hemi);

  /* ---------- 坑洞外壳：上宽下窄的刀劈斧凿深渊碗壁 ---------- */
  // 坑壁：顶口 r≈34（Y=40）→ 底 r≈13（Y=10），内视碗壁
  const wallGeo = jitter(
    new THREE.CylinderGeometry(34, 13, SWAMP_GROUND_Y - SWAMP_FLOOR_Y, 14, 4, true),
    2.2,
    rnd
  );
  const wall = new THREE.Mesh(
    facet(wallGeo),
    toonMat(WALL_COLOR, { flatShading: true, side: THREE.BackSide })
  );
  wall.name = "swamp-sinkhole-wall";
  wall.position.y = (SWAMP_GROUND_Y + SWAMP_FLOOR_Y) / 2; // 25
  wall.receiveShadow = true;
  addOutline(wall, 0.045);
  swampZone.add(wall);

  /* ---------- 坑口缘：自然塌陷断崖（无围墙！送信人可自由进出）---------- */
  const ENTRANCE_A = 0.5; // 入坑通道方位角（局部）
  const angDiff = (a) => Math.atan2(Math.sin(a - ENTRANCE_A), Math.cos(a - ENTRANCE_A));

  // 低矮断崖碎石：沿坑缘不连续散布（高度≤ 0.9，不拦路），入口处留豁口
  const screeMat = toonMat(0x7fa08a, { flatShading: true });
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    if (Math.abs(angDiff(a)) < 0.66) continue; // 入口不设石
    const rock = part(jitter(new THREE.IcosahedronGeometry(0.9 + rnd() * 1.1, 0), 0.3, rnd), screeMat, 0.02);
    const d = 33.5 + rnd() * 2.5;
    rock.position.set(Math.cos(a) * d, SWAMP_GROUND_Y + 0.15, Math.sin(a) * d);
    rock.scale.set(1.3, 0.3 + rnd() * 0.3, 1.1);
    rock.rotation.y = rnd() * Math.PI;
    swampZone.add(rock);
  }

  // 入口缓坡石阶：8 级宽石板从草地 Y=40 一路下行没入水下 Y≈22，可直接走入
  const stepMat = toonMat(0x8fae9e, { flatShading: true });
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const step = part(jitter(new THREE.BoxGeometry(8.5, 1.2, 3.2), 0.35, rnd), stepMat, 0.026);
    const rr = 37 - t * 12;
    step.position.set(
      Math.cos(ENTRANCE_A) * rr,
      SWAMP_GROUND_Y - 0.6 - t * 17.5,
      Math.sin(ENTRANCE_A) * rr
    );
    step.rotation.y = -ENTRANCE_A;
    step.rotation.x = 0.16; // 微微向坑心下倾
    swampZone.add(step);
  }

  // Y=40 地表草地：低平草皮断片（非围墙）+ 草簇，玩家起跳处
  // 注：星球弯曲导致的地表下沉由 applySwampSphereFit 在放置时按真实缩放修正
  const grassMat = toonMat(GRASS_COLOR, { flatShading: true });
  /** @type {THREE.Mesh[]} 坑缘地表装饰（放置时贴球面） */
  const rimDecor = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
    const patch = part(
      new THREE.CylinderGeometry(2.4 + rnd() * 2.2, 2.8 + rnd() * 2.4, 0.45, 6),
      grassMat,
      0.024
    );
    const gd = 37 + rnd() * 8;
    patch.position.set(Math.cos(a) * gd, SWAMP_GROUND_Y - 0.22, Math.sin(a) * gd);
    patch.userData.baseY = SWAMP_GROUND_Y - 0.22;
    swampZone.add(patch);
    rimDecor.push(patch);
  }
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const tuft = part(new THREE.ConeGeometry(0.32 + rnd() * 0.3, 1.1 + rnd() * 0.9, 4), grassMat, 0.014);
    const gd = 35 + rnd() * 8;
    tuft.position.set(
      Math.cos(a) * gd,
      SWAMP_GROUND_Y + 0.5,
      Math.sin(a) * gd
    );
    tuft.rotation.z = (rnd() - 0.5) * 0.3;
    tuft.userData.baseY = SWAMP_GROUND_Y + 0.5;
    swampZone.add(tuft);
    rimDecor.push(tuft);
  }

  /* ---------- 坑边苍天大树：环湖沼四周，沿球面贴地扎根 ---------- */
  const treeCount = 10 + ((rnd() * 3) | 0);
  /** @type {THREE.Group[]} */
  const towerTrees = [];
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2 + rnd() * 0.35;
    if (Math.abs(angDiff(a)) < 0.5) continue; // 不堵入口通道
    const tree = buildToweringTree(rnd);
    // 注意：星球半径仅 40（局部有效半径 = 40/scale），坑缘平坦切平面在
    // 局部水平 ≈ Rs/√2 之外急剧下沉，树环必须收在坑缘附近才能贴地。
    const d = 36.5 + rnd() * 5;
    tree.position.set(Math.cos(a) * d, SWAMP_GROUND_Y - 0.3, Math.sin(a) * d);
    tree.userData.yaw = rnd() * Math.PI * 2; // 放置时贴球面后再绕法线自转
    swampZone.add(tree);
    towerTrees.push(tree);
  }
  // 星球是弯曲的：平坦切平面之外地表下沉，树/草皮需沿球面下探并朝法线生长，
  // 否则悬浮。缩放在放置时才确定，故由 applySwampSphereFit 统一修正。
  swampZone.userData.towerTrees = towerTrees;
  swampZone.userData.rimDecor = rimDecor;

  // 坑壁垂挂藤蔓（从 Y=40 坑口一路垂到水面附近）
  const hangVineMat = toonMat(VINE_COLOR, { flatShading: true });
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2;
    const y1 = WATER_Y + 2 + rnd() * 8;
    const pts = [];
    const rTop = 33, rBot = 26 - rnd() * 6;
    for (let j = 0; j <= 6; j++) {
      const t = j / 6;
      const rr = rTop + (rBot - rTop) * t;
      pts.push(new THREE.Vector3(
        Math.cos(a + t * 0.35) * rr,
        SWAMP_GROUND_Y - 1 + (y1 - (SWAMP_GROUND_Y - 1)) * t,
        Math.sin(a + t * 0.35) * rr
      ));
    }
    const vine = part(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.14, 4, false),
      hangVineMat,
      0.015
    );
    swampZone.add(vine);
  }

  /* ---------- 湖底沙地（Y = 10.0）+ 河床乱石 ---------- */
  const floor = part(
    jitter(new THREE.CylinderGeometry(13.5, 15, 1.2, 12), 0.8, rnd),
    toonMat(FLOOR_COLOR, { flatShading: true }),
    0.032
  );
  floor.name = "swamp-lake-floor";
  floor.position.y = SWAMP_FLOOR_Y - 0.2;
  swampZone.add(floor);

  for (let i = 0; i < 14; i++) {
    const rock = part(
      new THREE.IcosahedronGeometry(0.5 + rnd() * 1.2, 0),
      toonMat(ROCK_COLOR, { flatShading: true }),
      0.02
    );
    const a = rnd() * Math.PI * 2;
    const d = 2 + rnd() * 10;
    rock.position.set(Math.cos(a) * d, SWAMP_FLOOR_Y + 0.4 + rnd() * 1.2, Math.sin(a) * d);
    rock.rotation.set(rnd(), rnd() * 2, rnd());
    rock.scale.set(1.15, 0.55 + rnd() * 0.4, 0.95);
    swampZone.add(rock);
  }

  /* ---------- 2. 玻璃水面（Y = 25.0）---------- */
  const water = createWaterSurface();
  swampZone.add(water);

  /* ---------- 水下游鱼：绿黑斑纹小鱼群（玻璃剖面下的生灵） ---------- */
  /** @type {THREE.Group[]} */
  const fishes = [];
  const fishGreenMat = toonMat(FISH_GREEN, { flatShading: true });
  const fishAltMat = toonMat(0x2e8f6e, { flatShading: true });
  const spotMat = toonMat(FISH_DARK, { flatShading: true });
  for (let i = 0; i < 9; i++) {
    const fish = new THREE.Group();
    fish.name = `swamp-fish-${i}`;
    const fMat = i % 2 ? fishGreenMat : fishAltMat;
    const fBody = part(new THREE.ConeGeometry(0.32, 1.3, 4), fMat, 0.014);
    fBody.rotation.x = Math.PI / 2;
    fish.add(fBody);
    const fTail = part(new THREE.ConeGeometry(0.22, 0.5, 3), fMat, 0.01);
    fTail.rotation.x = -Math.PI / 2;
    fTail.position.z = -0.85;
    fish.add(fTail);
    // 黑斑纹：体侧 2~3 枚深色斑点
    for (let k = 0; k < 2 + (i % 2); k++) {
      const spot = new THREE.Mesh(facet(new THREE.SphereGeometry(0.06, 4, 3)), spotMat);
      spot.position.set((k - 1) * 0.22, 0.12, (rnd() - 0.5) * 0.5);
      fish.add(spot);
    }
    fish.position.set((rnd() - 0.5) * 30, 13 + rnd() * 9, (rnd() - 0.5) * 30);
    fish.userData.orbitR = 6 + rnd() * 12;
    fish.userData.orbitY = fish.position.y;
    fish.userData.phase = rnd() * Math.PI * 2;
    fish.userData.speed = 0.25 + rnd() * 0.3;
    swampZone.add(fish);
    fishes.push(fish);
  }

  /* ---------- 4a. 原始世界树（Y=10 扎根，穿水上天）---------- */
  buildWorldTree(rnd, swampZone);

  /* ---------- 3. 米白浅绿鲸豚（儒艮/海牛感）：一大一小两只，Y = 21.0 ---------- */
  /** @type {THREE.Group[]} */
  const whales = [];
  const whale = buildBelugaWhale(rnd);
  whale.position.set(7, WHALE_Y, 4);
  whale.rotation.y = -2.35; // 昂首朝向坑心水面之上
  whale.userData.baseY = WHALE_Y;
  swampZone.add(whale);
  whales.push(whale);

  const whalePup = buildBelugaWhale(rnd);
  whalePup.scale.setScalar(0.55); // 小一号的幼体，伴随游弋
  whalePup.position.set(-6, WHALE_Y - 2.5, -6);
  whalePup.rotation.y = 0.85;
  whalePup.userData.baseY = WHALE_Y - 2.5;
  whalePup.userData.bobPhase = 2.1;
  swampZone.add(whalePup);
  whales.push(whalePup);

  // 荷叶水下茎秆的锚点先记着（荷叶生成后补茎）
  /* ---------- 4b. 内凹荷叶小舟（Y = 25.0）3~4 朵 ---------- */
  /** @type {THREE.Group[]} */
  const lotuses = [];
  const lotusSlots = [
    { x: -13, z: 9, r: 4.4, yaw: 0.4 },
    { x: 12, z: -12, r: 3.8, yaw: -0.9 },
    { x: -10, z: -14, r: 3.4, yaw: 1.6 },
    { x: 16, z: 10, r: 3.0, yaw: 2.4 },
  ];
  const lotusCount = 3 + ((rnd() * 2) | 0); // 3~4 朵
  for (let i = 0; i < lotusCount; i++) {
    const slot = lotusSlots[i];
    const lotus = createLotusLeafBoat(rnd, slot.r * (0.92 + rnd() * 0.16));
    lotus.position.set(slot.x, WATER_Y + 0.1, slot.z);
    lotus.rotation.y = slot.yaw + rnd() * 0.4;
    lotus.userData.bobPhase = rnd() * Math.PI * 2;
    lotus.userData.baseY = WATER_Y + 0.1;
    swampZone.add(lotus);
    lotuses.push(lotus);

    // 水下茎秆：从湖底 Y=10 一路连到荷叶
    const stemH = WATER_Y - SWAMP_FLOOR_Y;
    const stem = part(
      new THREE.CylinderGeometry(0.13, 0.2, stemH, 5),
      toonMat(0x1e8449, { flatShading: true }),
      0.014
    );
    stem.position.set(slot.x, SWAMP_FLOOR_Y + stemH * 0.5, slot.z);
    swampZone.add(stem);
  }

  /* ---------- 氛围气泡 ---------- */
  const bubbles = [];
  for (let i = 0; i < 12; i++) {
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 + rnd() * 0.09, 5, 4),
      new THREE.MeshBasicMaterial({
        color: 0xd5f5e3,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      })
    );
    bubble.position.set((rnd() - 0.5) * 34, 12 + rnd() * 11, (rnd() - 0.5) * 34);
    bubble.userData.baseY = bubble.position.y;
    bubble.userData.phase = rnd() * Math.PI * 2;
    swampZone.add(bubble);
    bubbles.push(bubble);
  }

  /* ---------- 参考插画生态：鳗 / 管虫 / 紫蘑菇 / 粉垂生物 / 飞鸟 / 贝壳 / 棕榈 ---------- */
  // 黄绿鳗：水下 16~20 高度蛇形巡游
  const eel = buildSwampEel(rnd);
  eel.position.set(-2, 17.5, 0);
  swampZone.add(eel);

  // 橙红管状蠕虫：湖底两处
  for (let i = 0; i < 2; i++) {
    const worms = buildTubeWormCluster(rnd);
    const a = rnd() * Math.PI * 2;
    const d = 4 + rnd() * 6;
    worms.position.set(Math.cos(a) * d, SWAMP_FLOOR_Y + 0.4, Math.sin(a) * d);
    swampZone.add(worms);
  }

  // 紫蘑菇/珊瑚：坑缘草甸 + 水下岩隙
  for (let i = 0; i < 4; i++) {
    const mush = buildMoebiusMushroom(rnd, 1 + rnd() * 0.6);
    const a = rnd() * Math.PI * 2;
    if (Math.abs(angDiff(a)) < 0.55) continue;
    const d = 34.5 + rnd() * 4;
    mush.position.set(Math.cos(a) * d, SWAMP_GROUND_Y + 0.1, Math.sin(a) * d);
    mush.userData.baseY = SWAMP_GROUND_Y + 0.1;
    swampZone.add(mush);
    rimDecor.push(mush);
  }
  for (let i = 0; i < 2; i++) {
    const mush = buildMoebiusMushroom(rnd, 0.8 + rnd() * 0.5);
    const a = rnd() * Math.PI * 2;
    const d = 8 + rnd() * 4;
    mush.position.set(Math.cos(a) * d, SWAMP_FLOOR_Y + 0.35, Math.sin(a) * d);
    swampZone.add(mush);
  }

  // 粉色长尾垂挂生物：悬于坑壁藤蔓末端（3 只）
  /** @type {THREE.Group[]} */
  const hangers = [];
  for (let i = 0; i < 3; i++) {
    const hanger = buildPinkHanger(rnd);
    const a = (i / 3) * Math.PI * 2 + 0.9;
    const r = 28 + rnd() * 3;
    hanger.position.set(Math.cos(a) * r, SWAMP_GROUND_Y - 3 - rnd() * 5, Math.sin(a) * r);
    hanger.lookAt(0, hanger.position.y, 0);
    swampZone.add(hanger);
    hangers.push(hanger);
  }

  // 飞鸟：粉白 + 紫灰，坑口上空盘旋（4 只）
  /** @type {THREE.Group[]} */
  const birds = [];
  for (let i = 0; i < 4; i++) {
    const bird = buildSwampBird(rnd, i % 2 ? BIRD_PINK : BIRD_PURPLE);
    swampZone.add(bird);
    birds.push(bird);
  }

  // 米白贝壳：坑缘草甸散落（3 枚，与苔石相伴）
  for (let i = 0; i < 3; i++) {
    const shell = buildShell(rnd);
    const a = rnd() * Math.PI * 2;
    const d = 34 + rnd() * 6;
    shell.position.set(Math.cos(a) * d, SWAMP_GROUND_Y + 0.15, Math.sin(a) * d);
    shell.rotation.y = rnd() * Math.PI * 2;
    shell.userData.baseY = SWAMP_GROUND_Y + 0.15;
    swampZone.add(shell);
    rimDecor.push(shell);
  }

  // 坑缘棕榈：与苍天巨树交错，湿润繁茂的丛林感（同样贴球面）
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    if (Math.abs(angDiff(a)) < 0.5) continue;
    const palm = buildRimPalm(rnd);
    const d = 36 + rnd() * 4.5;
    palm.position.set(Math.cos(a) * d, SWAMP_GROUND_Y - 0.2, Math.sin(a) * d);
    palm.userData.yaw = rnd() * Math.PI * 2;
    swampZone.add(palm);
    towerTrees.push(palm); // 一并交给 applySwampSphereFit 贴球面
  }

  /* ---------- userData / 实时动画 ---------- */
  swampZone.userData.kind = "moebius-swamp";
  swampZone.userData.groundY = SWAMP_GROUND_Y;
  swampZone.userData.waterY = WATER_Y;
  swampZone.userData.floorY = SWAMP_FLOOR_Y;
  swampZone.userData.whale = whale;
  swampZone.userData.whales = whales;
  swampZone.userData.lotuses = lotuses;
  // 不设大型碰撞体：送信人可直接走入 / 跳入湖沼（无隐形围墙）
  swampZone.userData.collideRadius = 0;
  swampZone.userData.cameraHint = {
    localPosition: new THREE.Vector3(30, 46, 34),
    localLookAt: new THREE.Vector3(0, WATER_Y, 0),
    fov: 62,
  };

  swampZone.update = function updateSwamp(_dt, t) {
    // 荷叶小舟随水起伏
    for (const lotus of lotuses) {
      const ph = lotus.userData.bobPhase || 0;
      lotus.position.y = (lotus.userData.baseY || WATER_Y) + Math.sin(t * 1.05 + ph) * 0.09;
      lotus.rotation.z = Math.sin(t * 0.8 + ph) * 0.028;
    }
    // 鲸豚们缓缓浮沉，鼻头始终破水
    for (const w of whales) {
      const ph = w.userData.bobPhase || 0;
      w.position.y = w.userData.baseY + Math.sin(t * 0.6 + ph) * 0.35;
      w.rotation.z = Math.sin(t * 0.45 + ph) * 0.03;
    }
    // 游鱼环游
    for (const f of fishes) {
      const a = t * f.userData.speed + f.userData.phase;
      f.position.set(
        Math.cos(a) * f.userData.orbitR,
        f.userData.orbitY + Math.sin(t * 0.9 + f.userData.phase) * 0.6,
        Math.sin(a) * f.userData.orbitR
      );
      f.rotation.y = -a - Math.PI / 2;
    }
    // 黄绿鳗：缓速绕坑心巡游 + 身体起伏
    {
      const ea = t * 0.14 + eel.userData.phase;
      eel.position.set(Math.cos(ea) * 9, 17.5 + Math.sin(t * 0.7) * 1.1, Math.sin(ea) * 9);
      eel.rotation.y = -ea - Math.PI / 2;
      eel.rotation.z = Math.sin(t * 0.9) * 0.12;
    }
    // 粉色垂挂生物：绕悬点轻摆
    for (const h of hangers) {
      const ph = h.userData.phase || 0;
      h.rotation.z = Math.sin(t * 0.8 + ph) * 0.14;
      h.rotation.x = Math.cos(t * 0.6 + ph) * 0.1;
    }
    // 飞鸟：坑口上空盘旋 + 拍翅
    for (const bird of birds) {
      const a = t * bird.userData.speed + bird.userData.phase;
      bird.position.set(
        Math.cos(a) * bird.userData.orbitR,
        bird.userData.orbitY + Math.sin(t * 0.8 + bird.userData.phase) * 0.8,
        Math.sin(a) * bird.userData.orbitR
      );
      bird.rotation.y = -a + Math.PI / 2;
      const flap = Math.sin(t * 7 + bird.userData.phase) * 0.5;
      if (bird.userData.wingL) bird.userData.wingL.rotation.z = -0.5 - flap;
      if (bird.userData.wingR) bird.userData.wingR.rotation.z = 0.5 + flap;
    }
    // 气泡
    for (const b of bubbles) {
      b.position.y = b.userData.baseY + Math.sin(t * 1.5 + b.userData.phase) * 0.5;
      b.material.opacity = 0.22 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.1 + b.userData.phase));
    }
    // 水面微漾（玻璃顶点轻晃）
    const p = water.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, Math.sin(t * 1.2 + x * 0.22 + z * 0.18) * 0.14);
    }
    p.needsUpdate = true;
  };

  return swampZone;
}

/* =====================================================================
 *  放置工厂与球面贴放（保持对外导出接口不变）
 * ===================================================================== */

/**
 * 球面贴合修正：星球是弯曲的，坑缘平坦切平面之外地表会下沉。
 * 大树 / 草皮按放置缩放下的真实球半径沿球面下探，树朝法线倾斜生长，
 * 避免悬浮。幂等：可重复调用（缩放变更时重新贴合）。
 *
 * @param {THREE.Group} swampZone createMoebiusSwampZone 的返回组
 * @param {number} scale 放置时的包装缩放
 * @param {number} [surfaceR] 坑口地表处的星球径向半径（R + 地表抬升），
 *                            局部有效球半径 = surfaceR / scale
 */
export function applySwampSphereFit(swampZone, scale, surfaceR = PLANET_RADIUS) {
  const Rs = surfaceR / Math.max(1e-4, scale); // 局部坐标下的有效球半径
  const drop = (d) => (d >= Rs ? 0 : Rs - Math.sqrt(Rs * Rs - d * d));
  const trees = swampZone.userData.towerTrees || [];
  for (const tree of trees) {
    const d = Math.hypot(tree.position.x, tree.position.z);
    // 多埋 0.8 局部单位：树干底部扎进土里，兼补生成/放置地表半径的小偏差
    tree.position.y = SWAMP_GROUND_Y - 0.3 - drop(d) - 0.8;
    // 局部 +Y 对齐该点球面法线（树朝外倾斜，根部埋土）再绕法线自转
    _swT.set(tree.position.x, Rs - drop(d), tree.position.z).normalize();
    tree.quaternion.copy(quatYToDir(_swT, _swQ));
    tree.rotateY(tree.userData.yaw ?? 0);
  }
  const decor = swampZone.userData.rimDecor || [];
  for (const m of decor) {
    const d = Math.hypot(m.position.x, m.position.z);
    m.position.y = (m.userData.baseY ?? SWAMP_GROUND_Y) - drop(d);
  }
  return swampZone;
}

/**
 * 地图 / 目录用工厂：包装原点 = 正常地表（局部 Y=40）。
 * 放置后玩家脚下即坑口草地，坑内向球心塌陷 30 单位直达湖底。
 *
 * @param {{ seed?: number, scale?: number }} [opts]
 * @returns {THREE.Group}
 */
export function createMoebiusSwampPlacement(opts = {}) {
  const scale = opts.scale ?? 0.5;
  const seed = opts.seed ?? 7711;
  const inner = createMoebiusSwampZone({ seed });
  // 将局部 Y=40 的地表对齐包装原点：inner.y = -40
  inner.position.y = -SWAMP_GROUND_Y;

  const wrap = new THREE.Group();
  wrap.name = "moebius-swamp-placement";
  wrap.add(inner);
  wrap.scale.setScalar(scale);
  applySwampSphereFit(inner, scale);

  wrap.userData.kind = "moebius-swamp";
  wrap.userData.assetType = "moebiusSwamp";
  wrap.userData.displayName = "莫比斯湖沼";
  wrap.userData.collideRadius = 0; // 可走入资产：不注册碰撞墙
  wrap.userData.factoryScale = scale;
  wrap.userData.seed = seed;
  wrap.userData.inner = inner;
  wrap.userData.update = (dt, t) => inner.update?.(dt, t);

  return wrap;
}

/**
 * 书店平面坐标与水晶城（峡谷谷心）之间的中点球面方向
 */
export function swampMidwayDir(bookshopX, bookshopZ, R = PLANET_RADIUS) {
  const { lat, lon } = flatXZToLatLon(bookshopX, bookshopZ, R);
  const bookDir = latLonToDir(lat, lon, new THREE.Vector3());
  const cityDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  const mid = bookDir.clone().add(cityDir);
  if (mid.lengthSq() < 1e-8) return cityDir.clone();
  return mid.normalize();
}

const _swP = new THREE.Vector3();
const _swT = new THREE.Vector3();
const _swUp = new THREE.Vector3();
const _swRight = new THREE.Vector3();
const _swM = new THREE.Matrix4();
const _swQ = new THREE.Quaternion();
const _swBook = new THREE.Vector3();
const _swCity = new THREE.Vector3();
const _swMid = new THREE.Vector3();
const _swTarget = new THREE.Vector3();

/**
 * 把湖沼锚到电车轨道附近（坑口地表 Y=40 对齐目标点，非浮空盘子）
 * 位置：书店→原中点 的 25% 距离。
 */
export function placeMoebiusSwampOnTrack(
  swampZone,
  trackCurve,
  bookshopX,
  bookshopZ,
  R = PLANET_RADIUS,
  scale = 0.5
) {
  if (!trackCurve) {
    const { lat, lon } = flatXZToLatLon(bookshopX, bookshopZ, R);
    latLonToDir(lat, lon, _swBook);
    latLonToDir(CANYON.lat, CANYON.lon, _swCity);
    _swMid.copy(_swBook).add(_swCity).normalize();
    _swTarget.copy(_swBook).lerp(_swMid, 0.25).normalize();
    return placeMoebiusSwampOnSphere(swampZone, _swTarget, R, scale, 0);
  }

  const { lat, lon } = flatXZToLatLon(bookshopX, bookshopZ, R);
  latLonToDir(lat, lon, _swBook);
  latLonToDir(CANYON.lat, CANYON.lon, _swCity);

  let midT = 0.35;
  let midScore = Infinity;
  const N = 360;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    trackCurve.getPointAt(t, _swP);
    _swUp.copy(_swP).normalize();
    const ab = _swBook.angleTo(_swUp);
    const bc = _swUp.angleTo(_swCity);
    const score =
      Math.abs(ab - bc) * 2.2 + (bc < 0.12 ? 2.5 : 0) + (ab < 0.08 ? 1.5 : 0);
    if (score < midScore) {
      midScore = score;
      midT = t;
    }
  }
  trackCurve.getPointAt(midT, _swP);
  _swMid.copy(_swP).normalize();
  _swTarget.copy(_swBook).lerp(_swMid, 0.25).normalize();

  let bestT = midT;
  let bestDot = -Infinity;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    trackCurve.getPointAt(t, _swP);
    _swUp.copy(_swP).normalize();
    const d = _swUp.dot(_swTarget);
    const ab = _swBook.angleTo(_swUp);
    const score = d - (ab < 0.05 ? 0.15 : 0);
    if (score > bestDot) {
      bestDot = score;
      bestT = t;
    }
  }

  trackCurve.getPointAt(bestT, _swP);
  trackCurve.getTangentAt(bestT, _swT);
  _swUp.copy(_swP).normalize();
  _swT.addScaledVector(_swUp, -_swT.dot(_swUp));
  if (_swT.lengthSq() < 1e-8) {
    _swT.set(0, 0, 1).addScaledVector(_swUp, -_swUp.z);
  }
  _swT.normalize();
  _swRight.crossVectors(_swT, _swUp).normalize();
  _swM.makeBasis(_swT, _swUp, _swRight);
  _swQ.setFromRotationMatrix(_swM);

  swampZone.scale.setScalar(scale);
  swampZone.quaternion.copy(_swQ);
  applySwampSphereFit(swampZone, scale, _swP.length());

  // 坑口地表（包装原点）对齐轨旁地表点 → 玩家可行走进入坑缘
  // （inner 已内移 -40，坑缘即在包装原点，无需再减 40×scale）
  swampZone.position.copy(_swP);

  swampZone.userData.trackParam = bestT;
  swampZone.userData.onTrack = true;
  swampZone.userData.bookshopDistanceFactor = 0.25;
  return swampZone;
}

/**
 * 球面贴放：坑口草地精确贴齐星球地表，整个湖沼向球心方向深挖塌陷，
 * 玩家从草地边缘一跃而下。
 * （inner 已内移 -40：坑缘 = 包装原点，故直接定位到 R + surfaceLift，
 * 切勿再减 SWAMP_GROUND_Y×scale，否则会双重下移埋入地下。）
 */
export function placeMoebiusSwampOnSphere(
  swampZone,
  dir,
  R = PLANET_RADIUS,
  scale = 0.5,
  surfaceLift = 0
) {
  swampZone.scale.setScalar(scale);
  swampZone.quaternion.copy(quatYToDir(dir, new THREE.Quaternion()));
  swampZone.rotateY(0.5);
  applySwampSphereFit(swampZone, scale, R + surfaceLift);
  // 坑缘（包装原点）对齐 R + surfaceLift
  const surface = dir.clone().multiplyScalar(R + surfaceLift);
  swampZone.position.copy(surface);
  return swampZone;
}
