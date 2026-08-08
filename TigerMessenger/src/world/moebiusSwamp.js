// =====================================================================
//  莫比斯原初湖沼 · createMoebiusSwampZone()  —— 月夜重构版（对照参考截屏）
//
//  概念：湖沼被四周苍天大树环抱，树冠在坑口上方交织成顶棚，
//  水面不见阳光，整片湖沼有如月夜 —— 仅借萤火虫与发光花蕊两种光。
//  因此全沼使用不受光平涂材质（不接收全局昼夜光照），以深蓝绿月夜
//  色板还原参考图的扁平插画感；鲸豚/花蕊为画面亮色主体。
//
//  Y 轴绝对坐标分层（局部 Group 内锁死）：
//    Y = 40.0  正常球体地面高度（玩家行走的草地 / 坑口缘）
//    Y = 25.0  地下半透明湖沼水面（比地表低整整 15 个单位）
//    Y = 10.0  坑洞最深处湖底沙地（总水深 15：从 Y=10 到 Y=25）
//    Y = 50~60 树冠顶棚（苍天大树枝冠交织遮天）
//
//  核心资产：
//    - 自发光半透明青绿水面 + 深蓝水下剖面（月夜不见阳光）
//    - 珍珠瓷感异星白鲸 / 焦黑土著人偶 / 内凹荷叶小舟（载粉色发光花蕊）
//    - 树冠顶棚 + 巨叶垂吊 / 萤火虫群 / 发光花蕊 / 微弱月光柱
//    - 全件 addOutline() 墨线描边，莫比斯插画感
// =====================================================================
import * as THREE from "three";
import { addOutline, INK_COLOR } from "../assets/toon.js";
import { createMoebiusTiger } from "./moebiusTiger.js";
import { facet } from "../assets/lowPoly.js";
import { quatYToDir, latLonToDir, flatXZToLatLon } from "./sphereMath.js";
import { CANYON } from "./canyon.js";
import { PLANET_RADIUS } from "./planet.js";

/* ---------------- Y 轴绝对坐标分层（锁死，勿动） ---------------- */
/** 正常球体地面高度：玩家行走的草地 / 坑口缘（湖沼局部坐标，不随 R 放大） */
export const SWAMP_LOCAL_GROUND_Y = 40.0;
/** 兼容旧调用方；语义上仍是局部坐标。 */
export const SWAMP_GROUND_Y = SWAMP_LOCAL_GROUND_Y;
/** 地下半透明湖沼水面高度：比地表低整整 15 单位 */
export const SWAMP_WATER_Y = 25.0;
/** 坑洞最深处湖底沙地：巨树根部与河床乱石扎根于此 */
export const SWAMP_FLOOR_Y = 10.0;
/** 白鲸躯干中心：昂首破水（月夜里水面的亮色主体） */
const WHALE_Y = 24.0;

const WATER_Y = SWAMP_WATER_Y;

/**
 * 植物树叶相对坑口地面的高度倍率。
 * 2 = 树冠/巨叶距地面高度升为原来的 2 倍（仅抬叶冠，不改水面/盆地）。
 */
const LEAF_HEIGHT_MUL = 2;

/** 把「高于地面」的 Y 按 LEAF_HEIGHT_MUL 抬高 */
function leafHeightY(y) {
  if (y <= SWAMP_LOCAL_GROUND_Y) return y;
  return SWAMP_LOCAL_GROUND_Y + (y - SWAMP_LOCAL_GROUND_Y) * LEAF_HEIGHT_MUL;
}

/* ---------------- 月夜色板（深蓝主导 + 萤火/花蕊辉光提亮） ---------------- */
const WATER_COLOR = 0x4aa8ff; // 水面亮蓝（月夜自发光，明确可读为湖水）
const WATER_MID = 0x147acc;   // 水体中段饱和蓝（向下渐深）
const WATER_DEEP = 0x052a6b;  // 深水衰减（暗蓝，越往下越深）
const WALL_COLOR = 0x1b4f5e;  // 坑壁湿暗青蓝
const WALL_MOSS = 0x2a6b70;   // 坑壁苔藓亮斑（月夜微光）
const FLOOR_COLOR = 0x173f52; // 湖底暗蓝沙
const GRASS_COLOR = 0x1d5a50; // 坑缘暗青绿草
const TRUNK_COLOR = 0x16454e; // 墨暗巨干
const VINE_COLOR = 0x2f8f7a;  // 青绿藤蔓
const ROCK_COLOR = 0x1f5664;  // 水下暗蓝乱石
const ROOT_COLOR = 0x10333c;  // 水下焦暗树根
const LOTUS_LEAF = 0x5cb868;  // 荷叶绿（夜色中略亮）
const WHALE_SKIN = 0xd9e6c4;  // 米白浅绿鲸豚肤（画面亮色主体）
const WHALE_BELLY = 0xeef0da; // 鲸腹更浅的米白
const DOLL_SKIN = 0x3a2a24;   // 土著深肤色
const DOLL_HAIR = 0xe5953f;   // 土著橙焰发（夜色暖亮）
const TOWER_TRUNK = 0x1a4a52; // 坑边苍天巨干（暗青蓝）
const TOWER_LEAF = 0x17505e;  // 巨树冠暗叶
const PALM_LEAF = 0x1d5a68;   // 棕榈/芭蕉叶暗青蓝
/* 暖色点缀生物 */
const EEL_COLOR = 0x9fb84f;   // 黄绿鳗形生物
const WORM_COLOR = 0xd75a3a;  // 橙红管状蠕虫
const MUSHROOM_CAP = 0x8f5fa8;// 紫色蘑菇/珊瑚
const MUSHROOM_STEM = 0xcfd8cf;
const PINK_HANG = 0xe88fa2;   // 粉色长尾垂挂生物
const BIRD_PINK = 0xf5c6d0;   // 粉白飞鸟
const BIRD_PURPLE = 0x9a8fb8; // 紫灰飞鸟
const GLOW_BIRD_A = 0xd8ffe0; // 发光飞鸟：薄荷白
const GLOW_BIRD_B = 0xfff0b8; // 发光飞鸟：暖杏黄
const MONKEY_FUR = 0x463a4e;  // 长尾猴：暗紫褐毛
const MONKEY_FACE = 0xe8c8a8; // 长尾猴：浅色脸
const LIZARD_GLOW = 0x8fffc0; // 发光蜥蜴：薄荷绿
const RIBBON_GLOW = 0xc8e860; // 发光带鱼：黄绿
const SHELL_COLOR = 0xe8dcc4; // 米白贝壳
const FISH_GREEN = 0x2f8f6e;  // 绿黑斑纹鱼
const FISH_DARK = 0x0e2f2a;   // 鱼身黑斑/剪影
/* 月夜光源：萤火虫 / 花蕊 / 月光柱 / 树冠分层 */
const FIREFLY_A = 0xd8ff9a;   // 萤火虫黄绿
const FIREFLY_B = 0x9fffe0;   // 萤火虫青蓝
const STAMEN_PINK = 0xffd9e8; // 发光花蕊粉白
const STAMEN_MINT = 0xc8ffe8; // 发光花蕊薄荷
const PETAL_DEEP = 0xb8486a;  // 花瓣深粉
const MOON_SHAFT = 0x9fd4e8;  // 微弱冷月光柱
const CANOPY_DARK = 0x123c4c; // 树冠深色
const CANOPY_MID = 0x17505e;  // 树冠中色
const CANOPY_LIT = 0x1d5f6e;  // 树冠亮色（受月边缘）

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

/**
 * 月夜平涂材质：湖沼不接收全局昼夜光照（树冠遮挡阳光），
 * 用不受光 MeshBasicMaterial 还原参考插画配色（flatShading 对不受光材质无效，忽略）。
 * 沿用 toonMat 之名，最小化调用点改动。
 */
function toonMat(color, opts = {}) {
  const { flatShading, ...rest } = opts || {};
  return new THREE.MeshBasicMaterial({ color, fog: false, ...rest });
}

let _glowTex = null;
/** 径向辉光贴图（单例）：萤火虫 / 花蕊光晕 */
function getGlowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.28, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

/** 加色辉光 sprite：萤火虫 / 光晕 / 光池 */
function glowSprite(color, scale, opacity) {
  const m = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  s.raycast = () => {};
  return s;
}

/* =====================================================================
 *  2. 地下半透明 PBR 水体剖面（Y = 25.0）
 *  圆形水面（R=33，贴合坑口）+ 边缘亮圈/高光环，强化“湖”的边界与深邃感
 * ===================================================================== */
function createWaterSurface() {
  // 圆形水面（贴合坑口半径 ~33），而非无限大平面，强化“湖”的边界
  const R = 33;
  const geo = new THREE.CircleGeometry(R, 48);
  geo.rotateX(-Math.PI / 2);
  // 月夜：水面不见阳光，自发光半透明浅蓝；下方透出上浅下深的水体剖面
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(WATER_COLOR),
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const water = new THREE.Mesh(geo, mat);
  water.name = "swamp-underground-waterline";
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  addOutline(water, 0.014, INK_COLOR, 0.05);

  // 水面边缘亮圈：明确的水/陆分界线，让“湖面”成为可读的视觉基准
  const rimPts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    rimPts.push(new THREE.Vector3(Math.cos(a) * R, 0.05, Math.sin(a) * R));
  }
  const rim = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(rimPts),
    new THREE.LineBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.65, fog: false })
  );
  rim.raycast = () => {};
  water.add(rim);

  // 微弱高光环（加色发光），增强水面反光与深邃感
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(R - 1.2, R + 0.4, 64),
    new THREE.MeshBasicMaterial({
      color: 0x33a8ff, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    })
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.06;
  glowRing.raycast = () => {};
  water.add(glowRing);
  return water;
}

/* =====================================================================
 *  2b. 水体体积剖面（Y = 10 → 25）：上浅蓝、下深蓝的垂直渐变
 *  让“水面向下蓝色越深”可读：透过浅蓝半透明水面，可见充填整湖的
 *  水体圆柱，顶=浅蓝(WATER_COLOR) → 中=WATER_MID → 底=深蓝(WATER_DEEP)
 * ===================================================================== */
function createWaterVolume() {
  // 半径略小于坑壁，避免 z-fighting；上口 r≈31、底 r≈14，随坑壁上宽下窄
  const R_TOP = 32.5; // 贴近水面边缘，减少边缘漏出绿色坑壁/草地
  const R_BOT = 14;
  const H = SWAMP_WATER_Y - SWAMP_FLOOR_Y; // 15
  const geo = new THREE.CylinderGeometry(R_TOP, R_BOT, H, 32, 8, true);
  geo.rotateX(0); // 默认 Y 轴向，无需旋转
  // 顶点色：按高度归一化（顶=1，底=0）从浅蓝渐变到深蓝
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const cTop = new THREE.Color(WATER_COLOR);
  const cMid = new THREE.Color(WATER_MID);
  const cBot = new THREE.Color(WATER_DEEP);
  const cTmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const hgt = THREE.MathUtils.clamp((pos.getY(i) + H / 2) / H, 0, 1); // 0 底 → 1 顶
    if (hgt > 0.5) cTmp.copy(cMid).lerp(cTop, (hgt - 0.5) * 2);
    else cTmp.copy(cBot).lerp(cMid, hgt * 2);
    col[i * 3] = cTmp.r;
    col[i * 3 + 1] = cTmp.g;
    col[i * 3 + 2] = cTmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const vol = new THREE.Mesh(geo, mat);
  vol.name = "swamp-water-volume";
  vol.position.y = (SWAMP_WATER_Y + SWAMP_FLOOR_Y) / 2; // 17.5
  vol.raycast = () => {};
  return vol;
}

/* =====================================================================
 *  2c. 水面涟漪波纹：花朵/落叶触水时扩散的细环（加色发光，外扩淡出）
 * ===================================================================== */
function createRipple() {
  // 细环：内半径 0.82、外半径 1.0，靠整体 scale 放大表现扩散
  const geo = new THREE.RingGeometry(0.82, 1.0, 40);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xbfeaff),
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.name = "swamp-ripple";
  ring.raycast = () => {};
  ring.visible = false;
  ring.userData = { active: false, age: 0, life: 2.2 };
  return ring;
}

/* =====================================================================
 *  3. 程序化实时拼装「珍珠瓷感异星白鲸」NPC
 *  Thinking in Boxes：卵形身 + 圆鼻头 + 双扁鳍 + 微翘分叉尾
 * ===================================================================== */
function buildBelugaWhale(rnd) {
  const whale = new THREE.Group();
  whale.name = "moebius-beluga-whale";

  // 月夜里的画面亮色主体：不受光米白浅绿瓷感
  const skin = new THREE.MeshBasicMaterial({ color: new THREE.Color(WHALE_SKIN), fog: false });

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

  // 眼睛：刚好破水而出的黑豆眼（贴头顶面，昂首后仍嵌在头上）
  const eyeMat = toonMat(0x1a1a1a);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(facet(new THREE.SphereGeometry(0.16, 6, 5)), eyeMat);
    eye.position.set(side * 0.95, 0.42, 2.9);
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
      toonMat(CANOPY_MID, { flatShading: true }),
      0.03
    );
    const a = rnd() * Math.PI * 2;
    const d = 0.8 + rnd() * 4.2;
    canopy.position.set(
      trunk.position.x + Math.cos(a) * d,
      leafHeightY(52 + rnd() * 12),
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
  // （不加描边壳：碗内要保持参考图的亮绿叶面，双面渲染）
  const leafGeo = new THREE.ConeGeometry(radius, radius * 0.42, 8, 1, true);
  const leaf = new THREE.Mesh(
    facet(leafGeo),
    toonMat(LOTUS_LEAF, { flatShading: true, side: THREE.DoubleSide })
  );
  leaf.castShadow = leaf.receiveShadow = true;
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

  // 参考图叶舟中的粉色发光花蕊尖锥
  const spike = buildStamenSpike(rnd);
  spike.position.set(-radius * 0.25, 0.12, radius * 0.1);
  spike.rotation.z = 0.12;
  g.add(spike);
  g.userData.halo = spike.userData.halo;

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

/** 发光飞鸟：薄荷白 / 暖杏黄 + 加色光晕，枝头间来回穿梭 */
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
  // 月夜里飞鸟自带微光
  const halo = glowSprite(color, 2.2, 0.45);
  g.add(halo);
  g.userData.halo = halo;
  g.userData.orbitR = 15 + rnd() * 11;
  g.userData.orbitY = 44 + rnd() * 7; // 枝头高度：树冠/垂叶之间
  g.userData.dart = 2.5 + rnd() * 3.5; // 径向穿梭幅度（枝头间来回）
  g.userData.speed = 0.22 + rnd() * 0.18;
  g.userData.phase = rnd() * Math.PI * 2;
  return g;
}

/* 玩家入沼交互（萤火环绕/尾随 + 长尾猴投果 / 送信人回扔 / 猴躲避） */
const FRUIT_G = 12; // 果实弹道重力
const FRUIT_CATCH_R2 = 1.35; // 接住半径²
const FRUIT_HIT_MONKEY_R2 = 1.8; // 砸中猴半径²
const FRUIT_DODGE_R = 7.5; // 猴开始躲避的距离
const _ffP = new THREE.Vector3(); // 玩家局部坐标
const _ffF = new THREE.Vector3(); // 玩家局部朝向（水平）
const _ffQ = new THREE.Quaternion();
const _ffAim = new THREE.Vector3();
const _ffTmp = new THREE.Vector3();

/** 长尾猴：暗毛浅脸 + S 形长尾，树冠间跳跃 */
function buildLongTailMonkey(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-longtail-monkey";
  const fur = toonMat(MONKEY_FUR, { flatShading: true });
  const body = part(new THREE.SphereGeometry(0.42, 6, 5), fur, 0.014);
  body.scale.set(0.9, 1.15, 0.9);
  body.position.y = 0.5;
  g.add(body);
  const head = part(new THREE.SphereGeometry(0.26, 6, 5), fur, 0.012);
  head.position.y = 1.02;
  g.add(head);
  const face = part(new THREE.SphereGeometry(0.16, 6, 5), toonMat(MONKEY_FACE, { flatShading: true }), 0.008);
  face.scale.set(1, 0.85, 0.6);
  face.position.set(0, 1.0, 0.18);
  g.add(face);
  for (const s of [-1, 1]) {
    const ear = part(new THREE.SphereGeometry(0.09, 5, 4), fur, 0.006);
    ear.position.set(s * 0.24, 1.1, 0);
    g.add(ear);
  }
  // 四肢短棍
  const limbGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.5, 4);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const limb = part(limbGeo, fur, 0.008);
    limb.position.set(sx * 0.28, 0.22, sz * 0.2);
    limb.rotation.z = sx * 0.5;
    limb.rotation.x = -sz * 0.3;
    g.add(limb);
    if (sz === 1) {
      // 前肢：玩家入沼投果时高举
      if (sx === -1) g.userData.armL = limb;
      else g.userData.armR = limb;
      limb.userData.baseRotX = limb.rotation.x;
    }
  }
  // 长尾：比身体更长的 S 形垂尾
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const tt = i / 8;
    pts.push(new THREE.Vector3(Math.sin(tt * 3.0) * 0.35, 0.45 - tt * 0.9 - tt * tt * 0.6, -0.35 - tt * 1.7));
  }
  const tail = part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.05, 4, false), fur, 0.008);
  g.add(tail);
  g.userData.phase = rnd() * Math.PI * 2;
  return g;
}

/** 发光蜥蜴：薄荷绿平涂 + 细尾四足 + 微光晕，地面缓爬 */
function buildGlowLizard(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-glow-lizard";
  const mat = toonMat(LIZARD_GLOW, { flatShading: true });
  const body = part(new THREE.SphereGeometry(0.3, 6, 5), mat, 0.012);
  body.scale.set(0.8, 0.5, 1.6);
  body.position.y = 0.18;
  g.add(body);
  const head = part(new THREE.SphereGeometry(0.16, 6, 5), mat, 0.008);
  head.scale.set(0.9, 0.6, 1.2);
  head.position.set(0, 0.16, 0.55);
  g.add(head);
  const tail = part(new THREE.ConeGeometry(0.09, 1.1, 4), mat, 0.006);
  tail.rotation.x = -Math.PI / 2 + 0.15;
  tail.position.set(0, 0.14, -0.95);
  g.add(tail);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = part(new THREE.ConeGeometry(0.05, 0.3, 4), mat, 0.005);
    leg.rotation.z = sx * 1.9;
    leg.position.set(sx * 0.28, 0.1, sz * 0.3);
    g.add(leg);
  }
  const halo = glowSprite(LIZARD_GLOW, 1.5, 0.4);
  halo.position.y = 0.3;
  g.add(halo);
  g.userData.halo = halo;
  g.userData.phase = rnd() * Math.PI * 2;
  return g;
}

/** 发光带鱼：侧扁长带 + 顶点波动摆尾，水下环游 */
function buildRibbonFish(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-glow-ribbonfish";
  const geo = new THREE.PlaneGeometry(3.8, 0.6, 16, 1);
  const pos = geo.attributes.position;
  const baseX = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const taper = 0.3 + 0.7 * (0.5 + x / 3.8); // 头宽尾细
    baseX[i] = x;
    pos.setY(i, pos.getY(i) * taper);
  }
  geo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(geo, toonMat(RIBBON_GLOW, { flatShading: true, side: THREE.DoubleSide }));
  g.add(bodyMesh);
  const head = part(new THREE.SphereGeometry(0.16, 5, 4), toonMat(RIBBON_GLOW, { flatShading: true }), 0.008);
  head.position.set(1.9, 0.05, 0);
  g.add(head);
  const halo = glowSprite(RIBBON_GLOW, 2.4, 0.35);
  g.add(halo);
  g.userData.halo = halo;
  g.userData.bodyMesh = bodyMesh;
  g.userData.baseX = baseX;
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
  // 叶冠距地面高度 ×2
  const h = (7 + rnd() * 6) * LEAF_HEIGHT_MUL;
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

/**
 * 坑边苍天巨树（有机整容版）
 * - 六棱主干下粗上细收分 + 露根
 * - 树枝斜向外上 25°~45°，根部嵌进主干 ≥0.3（消灭 90° 直角插接）
 * - 枝端扁平 Icosahedron 树冠 · 深松绿
 * - Toon flatShading + outline 0.045
 */
function buildToweringTree(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-towering-tree";
  const OUT = 0.045;
  const barkMat = toonMat(0x654321, { flatShading: true });
  const barkDark = toonMat(TOWER_TRUNK, { flatShading: true });
  const canopyMats = [
    toonMat(0x1c3024, { flatShading: true }),
    toonMat(0x243a2c, { flatShading: true }),
    toonMat(0x16261c, { flatShading: true }),
  ];
  const yAxis = new THREE.Vector3(0, 1, 0);
  const _d = new THREE.Vector3();

  const h = (40 + rnd() * 18) * LEAF_HEIGHT_MUL; // 高耸
  const R_BOT = 1.2 + rnd() * 0.35;
  const R_TOP = 0.55 + rnd() * 0.2;
  const lean = (rnd() - 0.5) * 0.14;

  function cylSeg(a, b, r0, r1, mat, outline = OUT) {
    _d.subVectors(b, a);
    const len = Math.max(0.05, _d.length());
    const mesh = part(
      new THREE.CylinderGeometry(r1, r0, len, 6, 1, false),
      mat,
      outline
    );
    mesh.position.copy(a).addScaledVector(_d.normalize(), len * 0.5);
    mesh.quaternion.setFromUnitVectors(yAxis, _d);
    g.add(mesh);
    return mesh;
  }

  // —— 主干分段收分（微弯）——
  const trunkPts = [];
  const nSeg = 6;
  for (let i = 0; i <= nSeg; i++) {
    const t = i / nSeg;
    const y = t * h;
    const bend = Math.sin(t * Math.PI) * lean * h * 0.08;
    trunkPts.push(new THREE.Vector3(bend, y, bend * 0.4));
  }
  for (let i = 0; i < trunkPts.length - 1; i++) {
    const t0 = i / (trunkPts.length - 1);
    const t1 = (i + 1) / (trunkPts.length - 1);
    cylSeg(
      trunkPts[i],
      trunkPts[i + 1],
      THREE.MathUtils.lerp(R_BOT, R_TOP, t0),
      THREE.MathUtils.lerp(R_BOT, R_TOP, t1),
      barkMat,
      OUT
    );
  }

  // 露根
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.4;
    const len = 1.6 + rnd() * 1.4;
    const root = part(
      new THREE.BoxGeometry(len, 0.35 + rnd() * 0.2, 0.5 + rnd() * 0.25),
      barkDark,
      OUT * 0.85
    );
    root.position.set(Math.cos(a) * R_BOT * 0.45, 0.12, Math.sin(a) * R_BOT * 0.45);
    root.rotation.y = a + Math.PI / 2;
    root.rotation.z = (rnd() - 0.5) * 0.3;
    g.add(root);
  }

  function plumeCanopy(at, dir, size) {
    const n = 2 + ((rnd() * 2) | 0);
    for (let k = 0; k < n; k++) {
      const blob = part(
        new THREE.IcosahedronGeometry(0.55, 0),
        canopyMats[k % canopyMats.length],
        OUT * 0.8
      );
      blob.position.copy(at).addScaledVector(dir, 0.4 + k * 0.35);
      blob.position.y += (k - 0.4) * 0.5 * size;
      blob.scale.set(
        (2.0 + rnd() * 0.8) * size,
        (0.35 + rnd() * 0.12) * size,
        (1.5 + rnd() * 0.6) * size
      );
      blob.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI, (rnd() - 0.5) * 0.25);
      g.add(blob);
    }
  }

  // —— 斜向外上树枝（嵌套进主干）——
  const arms = 7 + ((rnd() * 4) | 0);
  for (let i = 0; i < arms; i++) {
    const t = 0.22 + (i / arms) * 0.62 + (rnd() - 0.5) * 0.04;
    const yi = Math.min(trunkPts.length - 2, Math.floor(t * (trunkPts.length - 1)));
    const tf = t * (trunkPts.length - 1) - yi;
    const attach = trunkPts[yi].clone().lerp(trunkPts[yi + 1], tf);
    const trunkR = THREE.MathUtils.lerp(R_BOT, R_TOP, t);

    const elev = 0.45 + rnd() * 0.35; // 25°~45°+ 斜上
    const yaw = (i / arms) * Math.PI * 2 + rnd() * 0.5;
    const dir = new THREE.Vector3(
      Math.cos(yaw) * Math.cos(elev),
      Math.sin(elev),
      Math.sin(yaw) * Math.cos(elev)
    ).normalize();

    const nest = 0.4 + rnd() * 0.35; // ≥0.3 嵌进主干
    const start = attach.clone().addScaledVector(dir, trunkR * 0.1 - nest);
    const len = 8 + rnd() * 10 + (1 - t) * 6;
    const mid = start
      .clone()
      .addScaledVector(dir, len * 0.5)
      .add(new THREE.Vector3((rnd() - 0.5) * 1.2, 0.8 + rnd(), (rnd() - 0.5) * 1.2));
    const tip = start
      .clone()
      .addScaledVector(dir, len)
      .add(new THREE.Vector3((rnd() - 0.5) * 0.8, 1.2 + rnd(), (rnd() - 0.5) * 0.8));

    const r0 = 0.45 + rnd() * 0.2 + (1 - t) * 0.25;
    cylSeg(start, mid, r0, r0 * 0.55, barkMat, OUT * 0.9);
    cylSeg(mid, tip, r0 * 0.55, r0 * 0.22, barkDark, OUT * 0.75);
    plumeCanopy(tip, dir, 2.2 + rnd() * 1.4 + (1 - t) * 0.8);

    // 二级斜枝
    if (rnd() > 0.4) {
      const sub = dir
        .clone()
        .applyAxisAngle(yAxis, (rnd() > 0.5 ? 1 : -1) * (0.55 + rnd() * 0.5));
      sub.y += 0.25;
      sub.normalize();
      const s0 = mid.clone().addScaledVector(sub, -0.35);
      const s1 = mid.clone().addScaledVector(sub, 4 + rnd() * 4);
      cylSeg(s0, s1, r0 * 0.4, r0 * 0.15, barkDark, OUT * 0.65);
      plumeCanopy(s1, sub, 1.4 + rnd() * 0.8);
    }
  }

  // 顶冠两簇
  const top = trunkPts[trunkPts.length - 1];
  for (const side of [-1, 1]) {
    const elev = 0.72 + rnd() * 0.12;
    const yaw = side * (0.8 + rnd() * 0.5);
    const dir = new THREE.Vector3(
      Math.cos(yaw) * Math.cos(elev),
      Math.sin(elev),
      Math.sin(yaw) * Math.cos(elev)
    ).normalize();
    const start = top.clone().addScaledVector(dir, -0.5);
    const tip = top.clone().addScaledVector(dir, 6 + rnd() * 4);
    cylSeg(start, tip, R_TOP * 0.9, 0.2, barkDark, OUT * 0.7);
    plumeCanopy(tip, dir, 2.8 + rnd() * 1.2);
  }

  // 少量缠藤（保留月夜氛围，不抢有机骨架）
  const vineMat = toonMat(VINE_COLOR, { flatShading: true });
  const coils = 2 + ((rnd() * 2) | 0);
  for (let c = 0; c < coils; c++) {
    const y0 = 4 + rnd() * (h * 0.5);
    const len = 8 + rnd() * 12;
    const r = R_BOT * 0.7 + rnd() * 0.4;
    const pts = [];
    const seg = 12;
    for (let j = 0; j <= seg; j++) {
      const tt = j / seg;
      const yy = y0 + len * tt;
      const ang = tt * 2.2 * Math.PI + c * 1.9;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, yy, Math.sin(ang) * r));
    }
    g.add(
      part(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.08, 4, false),
        vineMat,
        0.012
      )
    );
  }

  return g;
}

/* =====================================================================
 *  4d. 月夜氛围：树冠顶棚 / 巨叶垂吊 / 发光花蕊 / 粉色花蕊尖锥
 * ===================================================================== */
/** 树冠顶棚：三圈扁叶簇向内收拢 + 垂吊巨叶，交织遮天（水面不见阳光） */
function buildCanopyCeiling(rnd, swampZone) {
  const g = new THREE.Group();
  g.name = "swamp-canopy-ceiling";
  const blobMats = [CANOPY_DARK, CANOPY_MID, CANOPY_LIT].map((c) => toonMat(c, { flatShading: true }));
  // 树冠环：相对坑口地面高度 ×2（原 50/52/54 → 60/64/68）
  const rings = [
    { r: 27, y: leafHeightY(50), n: 11, s: 8.0 },
    { r: 17, y: leafHeightY(52), n: 8, s: 7.0 },
    { r: 7, y: leafHeightY(54), n: 5, s: 6.0 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + rnd() * 0.5;
      const blob = part(
        new THREE.IcosahedronGeometry(ring.s * (0.8 + rnd() * 0.5), 0),
        blobMats[(rnd() * 3) | 0],
        0.02
      );
      blob.scale.set(1.25, 0.6, 1.25); // 摊平成「冠」
      blob.position.set(
        Math.cos(a) * ring.r * (0.85 + rnd() * 0.3),
        ring.y + (rnd() - 0.5) * 3,
        Math.sin(a) * ring.r * (0.85 + rnd() * 0.3)
      );
      blob.rotation.y = rnd() * Math.PI;
      g.add(blob);
    }
  }
  // 巨叶垂吊：芭蕉式大叶自冠缘垂向坑心（参考图顶部大叶前景）
  const frondMats = [
    toonMat(0x16455a, { flatShading: true, side: THREE.DoubleSide }),
    toonMat(CANOPY_LIT, { flatShading: true, side: THREE.DoubleSide }),
  ];
  for (let i = 0; i < 12; i++) {
    const len = 7 + rnd() * 5;
    const frond = part(new THREE.PlaneGeometry(2.6 + rnd() * 2.2, len, 1, 3), frondMats[i % 2], 0.016);
    frond.geometry.translate(0, -len / 2, 0); // 顶边为悬挂轴
    const fp = frond.geometry.attributes.position;
    for (let k = 0; k < fp.count; k++) {
      const yy = -fp.getY(k); // 0..len 向下
      fp.setZ(k, fp.getZ(k) + yy * yy * 0.05); // 叶尖外弧
    }
    frond.geometry.computeVertexNormals();
    // 叶脉：沿叶面中轴与两侧放射的暗色细线（设计原稿要求宽大叶有清晰脉络）
    const veinMat = new THREE.LineBasicMaterial({ color: 0x0c2a33, transparent: true, opacity: 0.7 });
    const veinPts = [];
    const mid = len; // 主脉
    const vSeg = 6;
    for (let s = 0; s <= vSeg; s++) {
      const tt = s / vSeg;
      veinPts.push(new THREE.Vector3(0, -len * tt, len * len * tt * tt * 0.05));
    }
    const mainVein = new THREE.Line(new THREE.BufferGeometry().setFromPoints(veinPts), veinMat);
    mainVein.raycast = () => {};
    frond.add(mainVein);
    for (let s = 1; s <= 4; s++) {
      const tt = s / 5;
      const yY = -len * tt;
      const zZ = len * len * tt * tt * 0.05;
      for (const side of [-1, 1]) {
        const sideVein = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, yY, zZ),
            new THREE.Vector3(side * (1.0 + len * 0.12) * (1 - tt), yY - len * 0.12, zZ),
          ]),
          veinMat
        );
        sideVein.raycast = () => {};
        frond.add(sideVein);
      }
    }
    const a = rnd() * Math.PI * 2;
    const rr = 18 + rnd() * 14;
    // 巨叶悬挂点同步抬高到 2 倍离地高度
    frond.position.set(Math.cos(a) * rr, leafHeightY(45 + rnd() * 5), Math.sin(a) * rr);
    frond.rotation.order = "YXZ";
    frond.rotation.y = a + Math.PI / 2;
    frond.rotation.x = 0.55 + rnd() * 0.5; // 垂吊
    g.add(frond);
  }
  swampZone.add(g);
  return g;
}

/** 发光花蕊花：深色花瓣 + 明亮花蕊 + 加色光晕（月夜光源之二） */
function buildGlowFlower(rnd, hue) {
  const g = new THREE.Group();
  g.name = "swamp-glow-flower";
  const h = 0.5 + rnd() * 0.9;
  const stem = part(new THREE.CylinderGeometry(0.035, 0.05, h, 4), toonMat(0x1d5a5a, { flatShading: true }), 0.008);
  stem.position.y = h / 2;
  g.add(stem);
  const petalMat = toonMat(hue ? 0x2a7a80 : PETAL_DEEP, { flatShading: true, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = part(new THREE.PlaneGeometry(0.16, 0.3), petalMat, 0.006);
    petal.position.set(Math.cos(a) * 0.12, h + 0.02, Math.sin(a) * 0.12);
    petal.rotation.order = "YXZ";
    petal.rotation.y = -a;
    petal.rotation.x = -0.9;
    g.add(petal);
  }
  const coreColor = hue ? STAMEN_MINT : STAMEN_PINK;
  const core = new THREE.Mesh(
    facet(new THREE.SphereGeometry(0.09 + rnd() * 0.05, 6, 5)),
    new THREE.MeshBasicMaterial({ color: coreColor, fog: false })
  );
  core.position.y = h + 0.06;
  g.add(core);
  const halo = glowSprite(coreColor, 1.5 + rnd() * 0.8, 0.55);
  halo.position.y = h + 0.06;
  halo.userData.pulse = rnd() * Math.PI * 2;
  g.add(halo);
  g.userData.halo = halo;
  return g;
}

/**
 * 巨型发光花朵：宽大花瓣朝空中开放，花蕊发光（设计原稿）。
 * 用于湖沼“5 朵大大花朵轮换飘落湖面”的效果。返回 group，含可动画的 userData。
 */
function buildGiantFlower(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-giant-flower";
  const petalMat = toonMat(0xf2d6e6, { flatShading: true, side: THREE.DoubleSide }); // 浅粉花瓣
  const petalN = 7;
  const pr = 2.4; // 花瓣半径（巨型）
  for (let i = 0; i < petalN; i++) {
    const a = (i / petalN) * Math.PI * 2;
    const petal = part(new THREE.PlaneGeometry(1.4, 2.6, 1, 2), petalMat, 0.02);
    petal.position.set(Math.cos(a) * pr, 0.2, Math.sin(a) * pr);
    petal.rotation.order = "YXZ";
    petal.rotation.y = -a;
    petal.rotation.x = -1.05; // 朝天空开放
    g.add(petal);
  }
  // 花蕊：发光球 + 加色光晕（如同设计原稿亮芯）
  const core = new THREE.Mesh(
    facet(new THREE.SphereGeometry(0.7, 8, 6)),
    new THREE.MeshBasicMaterial({ color: 0xfff0a0, fog: false })
  );
  core.position.y = 0.4;
  g.add(core);
  const halo = glowSprite(0xffe6a0, 7.0, 0.75);
  halo.position.y = 0.5;
  g.add(halo);
  g.userData.halo = halo;
  g.userData.core = core;
  return g;
}

/** 粉色发光花蕊尖锥：圆锥 + 亮尖 + 光晕（参考图叶舟中的粉锥） */
function buildStamenSpike(rnd) {
  const g = new THREE.Group();
  g.name = "swamp-stamen-spike";
  const spike = part(new THREE.ConeGeometry(0.42, 1.7, 6), toonMat(PINK_HANG, { flatShading: true }), 0.014);
  spike.position.y = 0.85;
  g.add(spike);
  const tip = new THREE.Mesh(
    facet(new THREE.SphereGeometry(0.12, 6, 5)),
    new THREE.MeshBasicMaterial({ color: STAMEN_PINK, fog: false })
  );
  tip.position.y = 1.72;
  g.add(tip);
  const halo = glowSprite(STAMEN_PINK, 2.2, 0.5);
  halo.position.y = 1.5;
  halo.userData.pulse = rnd() * Math.PI * 2;
  g.add(halo);
  g.userData.halo = halo;
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

  /* ---------- 5. 月夜：不放置任何全局光源 ----------
   * 旧版纯白环境光 1.2 会照亮整个星球；现全沼改为不受光平涂材质，
   * 湖沼与昼夜循环彻底解耦（树冠遮挡阳光，仅萤火/花蕊作光源）。 */

  /* ---------- 坑洞外壳：上宽下窄的刀劈斧凿深渊碗壁 ---------- */
  // 坑壁：顶口 r≈34（Y=40）→ 底 r≈13（Y=10），内视碗壁
  const wallGeo = jitter(
    new THREE.CylinderGeometry(34, 13, SWAMP_LOCAL_GROUND_Y - SWAMP_FLOOR_Y, 14, 4, true),
    2.2,
    rnd
  );
  const wallFacet = facet(wallGeo);
  // 月夜坑壁：顶亮底暗的深蓝绿渐变 + 苔藓亮斑（顶点色，不受光）
  const wp = wallFacet.attributes.position;
  const wcol = new Float32Array(wp.count * 3);
  const cTop = new THREE.Color(0x24606c);
  const cBot = new THREE.Color(0x0c2a3a);
  const cMoss = new THREE.Color(WALL_MOSS);
  const cTmp = new THREE.Color();
  for (let i = 0; i < wp.count; i++) {
    const hgt = THREE.MathUtils.clamp((wp.getY(i) + 15) / 30, 0, 1);
    cTmp.copy(cBot).lerp(cTop, Math.pow(hgt, 1.35));
    const n = 0.5 + 0.5 * Math.sin(wp.getX(i) * 1.9 + wp.getZ(i) * 1.4) * Math.sin(wp.getY(i) * 0.8 + wp.getX(i) * 0.6);
    if (n > 0.72) cTmp.lerp(cMoss, Math.min(1, (n - 0.72) * 2.2));
    wcol[i * 3] = cTmp.r;
    wcol[i * 3 + 1] = cTmp.g;
    wcol[i * 3 + 2] = cTmp.b;
  }
  wallFacet.setAttribute("color", new THREE.BufferAttribute(wcol, 3));
  const wall = new THREE.Mesh(
    wallFacet,
    toonMat(0xffffff, { side: THREE.BackSide, vertexColors: true })
  );
  wall.name = "swamp-sinkhole-wall";
  wall.position.y = (SWAMP_LOCAL_GROUND_Y + SWAMP_FLOOR_Y) / 2; // 25
  wall.receiveShadow = true;
  addOutline(wall, 0.045);
  swampZone.add(wall);

  /* ---------- 坑口缘：自然塌陷断崖（无围墙！送信人可自由进出）---------- */
  const ENTRANCE_A = 0.5; // 入坑通道方位角（局部）
  const angDiff = (a) => Math.atan2(Math.sin(a - ENTRANCE_A), Math.cos(a - ENTRANCE_A));

  // 低矮断崖碎石：沿坑缘不连续散布（高度≤ 0.9，不拦路），入口处留豁口
  const screeMat = toonMat(0x275a58, { flatShading: true });
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    if (Math.abs(angDiff(a)) < 0.66) continue; // 入口不设石
    const rock = part(jitter(new THREE.IcosahedronGeometry(0.9 + rnd() * 1.1, 0), 0.3, rnd), screeMat, 0.02);
    const d = 33.5 + rnd() * 2.5;
    rock.position.set(Math.cos(a) * d, SWAMP_LOCAL_GROUND_Y + 0.15, Math.sin(a) * d);
    rock.scale.set(1.3, 0.3 + rnd() * 0.3, 1.1);
    rock.rotation.y = rnd() * Math.PI;
    swampZone.add(rock);
  }

  // 入口缓坡石阶：8 级宽石板从草地 Y=40 一路下行没入水下 Y≈22，可直接走入
  const stepMat = toonMat(0x2f6a66, { flatShading: true });
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const step = part(jitter(new THREE.BoxGeometry(8.5, 1.2, 3.2), 0.35, rnd), stepMat, 0.026);
    const rr = 37 - t * 12;
    step.position.set(
      Math.cos(ENTRANCE_A) * rr,
      SWAMP_LOCAL_GROUND_Y - 0.6 - t * 17.5,
      Math.sin(ENTRANCE_A) * rr
    );
    step.rotation.y = -ENTRANCE_A;
    step.rotation.x = 0.16; // 微微向坑心下倾
    swampZone.add(step);
  }

  // 注：放置区「地表草地」已按需求移除——湖沼先挖坑，不展示坑口地面，
  // 坑缘只保留塌陷断崖碎石、入口石阶与环湖苍天大树，玩家自坑口直接踏入深渊。

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
    tree.position.set(Math.cos(a) * d, SWAMP_LOCAL_GROUND_Y - 0.3, Math.sin(a) * d);
    tree.userData.yaw = rnd() * Math.PI * 2; // 放置时贴球面后再绕法线自转
    swampZone.add(tree);
    towerTrees.push(tree);
  }
  // 星球是弯曲的：平坦切平面之外地表下沉，树/草皮需沿球面下探并朝法线生长，
  // 否则悬浮。缩放在放置时才确定，故由 applySwampSphereFit 统一修正。
  swampZone.userData.towerTrees = towerTrees;
  const rimDecor = (swampZone.userData.rimDecor = []); // 地表草地已移除，坑缘不再有草皮/草簇

  /* ---------- 相机距离外：树与树之间随机跨树蔓藤（丛林密网） ---------- */
  // 仅在大树两两之间按概率连一条悬垂的跨树藤蔓，营造密林缠绕感
  {
    const crossVineMat = toonMat(VINE_COLOR, { flatShading: true });
    const used = new Set();
    const tries = towerTrees.length * 2;
    for (let k = 0; k < tries; k++) {
      const i = (rnd() * towerTrees.length) | 0;
      let j = (rnd() * towerTrees.length) | 0;
      if (j === i) j = (j + 1) % towerTrees.length;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (used.has(key)) continue;
      used.add(key);
      if (rnd() > 0.55) continue; // 随机跳过部分组合
      const A = towerTrees[i].position;
      const B = towerTrees[j].position;
      const baseY = SWAMP_LOCAL_GROUND_Y - 0.3;
      const yA = baseY + 14 + rnd() * 18; // 相机距离外高处连接
      const yB = baseY + 14 + rnd() * 18;
      const sag = 4 + rnd() * 6; // 自然下垂
      const pts = [];
      const seg = 16;
      for (let s = 0; s <= seg; s++) {
        const tt = s / seg;
        const x = A.x + (B.x - A.x) * tt;
        const z = A.z + (B.z - A.z) * tt;
        const y = (yA + (yB - yA) * tt) - Math.sin(tt * Math.PI) * sag;
        pts.push(new THREE.Vector3(x, y, z));
      }
      const vine = part(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.12 + rnd() * 0.05, 4, false),
        crossVineMat,
        0.014
      );
      swampZone.add(vine);
    }
  }

  /* ---------- 5 朵巨型发光花朵：宽大叶上方朝空中开放，轮换飘落湖面 ---------- */
  const giantFlowers = [];
  for (let i = 0; i < 5; i++) {
    const f = buildGiantFlower(rnd);
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.4;
    const d = 20 + rnd() * 10; // 宽大叶丛上方（坑缘棕榈带内侧）
    const baseY = SWAMP_LOCAL_GROUND_Y + 6 + rnd() * 8; // 在叶面之上朝天空开放
    f.position.set(Math.cos(a) * d, baseY, Math.sin(a) * d);
    f.userData.baseY = baseY;
    f.userData.fallOrder = i;        // 轮换次序
    f.userData.falling = false;      // 是否正在飘落
    f.userData.fallT = 0;            // 飘落计时
    f.userData.restT = 0;            // 湖面停留计时
    swampZone.add(f);
    giantFlowers.push(f);
  }
  swampZone.userData.giantFlowers = giantFlowers;

  /* ---------- 水面涟漪池：花朵触水时扩散 ---------- */
  const ripples = [];
  for (let i = 0; i < 12; i++) {
    const rp = createRipple();
    swampZone.add(rp);
    ripples.push(rp);
  }
  function spawnRipple(x, z, strength = 1) {
    const rp = ripples.find((r) => !r.userData.active);
    if (!rp) return;
    rp.userData.active = true;
    rp.userData.age = 0;
    rp.userData.life = 2.2 * strength;
    rp.position.set(x, WATER_Y + 0.07, z);
    rp.visible = true;
    rp.scale.setScalar(0.4);
    rp.material.opacity = 0.7 * strength;
  }
  function updateRipples(dt) {
    for (const rp of ripples) {
      if (!rp.userData.active) continue;
      rp.userData.age += dt;
      const k = rp.userData.age / rp.userData.life;
      if (k >= 1) {
        rp.userData.active = false;
        rp.visible = false;
        rp.material.opacity = 0;
        continue;
      }
      // 外扩（0.4 → 5.5）并淡出
      rp.scale.setScalar(0.4 + k * 5.1);
      rp.material.opacity = (1 - k) * 0.7;
    }
  }

  /* ---------- 落叶系统：参天大树落叶飘落，湖面漂浮落叶/花瓣 ---------- */
  const fallingLeaves = [];
  const LEAF_POOL = 60;
  for (let i = 0; i < LEAF_POOL; i++) {
    const leaf = part(
      new THREE.PlaneGeometry(0.6 + rnd() * 0.4, 0.32 + rnd() * 0.2),
      toonMat(PALM_LEAF, { flatShading: true, side: THREE.DoubleSide }),
      0.006
    );
    leaf.visible = false;
    leaf.userData = { active: false };
    swampZone.add(leaf);
    fallingLeaves.push(leaf);
  }
  // 在湖面漂浮的落叶（静态漂浮物，强化“湖面”可读）
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 3 + rnd() * 28;
    const fl = part(
      new THREE.PlaneGeometry(0.7 + rnd() * 0.5, 0.38 + rnd() * 0.25),
      toonMat(PALM_LEAF, { flatShading: true, side: THREE.DoubleSide }),
      0.006
    );
    fl.position.set(Math.cos(a) * d, WATER_Y + 0.08, Math.sin(a) * d);
    fl.rotation.set(-Math.PI / 2 + (rnd() - 0.5) * 0.2, rnd() * Math.PI, 0);
    fl.userData.drift = rnd() * Math.PI * 2;
    fl.userData.dRadius = d;
    swampZone.add(fl);
  }
  swampZone.userData.fallingLeaves = fallingLeaves;

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
        SWAMP_LOCAL_GROUND_Y - 1 + (y1 - (SWAMP_LOCAL_GROUND_Y - 1)) * t,
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

  /* ---------- 树冠顶棚：苍天大树枝冠交织遮天（水面不见阳光） ---------- */
  buildCanopyCeiling(rnd, swampZone);

  /* ---------- 月光柱：树冠隙缝漏下几缕微弱冷光柱（「月夜」暗示） ---------- */
  const shafts = [];
  const shaftMat = new THREE.MeshBasicMaterial({
    color: MOON_SHAFT, transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  for (let i = 0; i < 3; i++) {
    const a = ENTRANCE_A + (i - 1) * 2.1 + rnd() * 0.4;
    const d = 6 + rnd() * 10;
    const h = 30;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 + rnd() * 0.3, 2.0 + rnd() * 0.8, h, 8, 1, true),
      shaftMat
    );
    shaft.position.set(Math.cos(a) * d, WATER_Y + h / 2 - 2, Math.sin(a) * d);
    shaft.rotation.z = (rnd() - 0.5) * 0.16;
    shaft.raycast = () => {};
    swampZone.add(shaft);
    shafts.push(shaft);
  }

  /* ---------- 萤火虫：水面与坑壁间漂移闪烁（月夜光源之一） ---------- */
  const fireflies = [];
  for (let i = 0; i < 46; i++) {
    const sp = glowSprite(i % 3 === 2 ? FIREFLY_B : FIREFLY_A, 0.5 + rnd() * 0.7, 0.8);
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 26;
    sp.position.set(Math.cos(a) * d, WATER_Y + 1 + rnd() * 12, Math.sin(a) * d);
    sp.userData.baseX = sp.position.x;
    sp.userData.baseY = sp.position.y;
    sp.userData.baseZ = sp.position.z;
    sp.userData.range = 1.5 + rnd() * 2.5;
    sp.userData.speed = 0.25 + rnd() * 0.4;
    sp.userData.flicker = 2 + rnd() * 3;
    sp.userData.phase = rnd() * Math.PI * 2;
    sp.userData.op = 0.5 + rnd() * 0.5;
    // 玩家入沼时的环绕/尾随参数
    sp.userData.followK = 0;
    sp.userData.orbitR = 1.4 + rnd() * 2.4;
    sp.userData.orbitH = 0.6 + rnd() * 2.2;
    sp.userData.orbitSpd = (0.8 + rnd() * 1.4) * (rnd() < 0.5 ? -1 : 1);
    sp.userData.orbitPh = rnd() * Math.PI * 2;
    sp.userData.trail = i % 3 === 0; // 1/3 尾随身后，其余环绕
    swampZone.add(sp);
    fireflies.push(sp);
  }
  // 光池：数个大而极淡的光晕，模拟萤群/花蕊光在水面的铺展
  const pools = [];
  for (let i = 0; i < 6; i++) {
    const pool = glowSprite(i % 2 ? 0x9fffd8 : 0xffc9dd, 7 + rnd() * 5, 0.07);
    const a = rnd() * Math.PI * 2;
    const d = 4 + rnd() * 18;
    pool.position.set(Math.cos(a) * d, WATER_Y + 1.5 + rnd() * 4, Math.sin(a) * d);
    pool.userData.phase = rnd() * Math.PI * 2;
    swampZone.add(pool);
    pools.push(pool);
  }

  /* ---------- 发光花蕊（月夜光源之二）：坑缘 / 壁架 / 水下 ---------- */
  const glowHalos = [];
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2;
    if (Math.abs(angDiff(a)) < 0.5) continue;
    const flower = buildGlowFlower(rnd, i % 2);
    const d = 34 + rnd() * 6;
    flower.position.set(Math.cos(a) * d, SWAMP_LOCAL_GROUND_Y - 0.1, Math.sin(a) * d);
    flower.userData.baseY = SWAMP_LOCAL_GROUND_Y - 0.1;
    swampZone.add(flower);
    rimDecor.push(flower);
    glowHalos.push(flower.userData.halo);
  }
  for (let i = 0; i < 6; i++) {
    const flower = buildGlowFlower(rnd, i % 2);
    const a = rnd() * Math.PI * 2;
    const d = 24 + rnd() * 7;
    flower.position.set(Math.cos(a) * d, WATER_Y + 1 + rnd() * 8, Math.sin(a) * d);
    flower.scale.setScalar(1.2 + rnd() * 0.8);
    swampZone.add(flower);
    glowHalos.push(flower.userData.halo);
  }
  for (let i = 0; i < 3; i++) {
    const flower = buildGlowFlower(rnd, 0);
    const a = rnd() * Math.PI * 2;
    const d = 6 + rnd() * 6;
    flower.position.set(Math.cos(a) * d, SWAMP_FLOOR_Y + 0.4, Math.sin(a) * d);
    swampZone.add(flower);
    glowHalos.push(flower.userData.halo);
  }

  /* ---------- 湖底：蓝色藻类地面（非草皮）+ 河床乱石 ---------- */
  // 坑底不是草皮，而是幽蓝发光的藻类植物铺地，强化“深邃湖水”的纵深感
  const ALGAE_COLOR = 0x1f6fb0;       // 湖底蓝藻主色
  const ALGAE_GLOW = 0x3fa8e0;        // 藻类受光亮斑（微发光感）
  const floor = part(
    jitter(new THREE.CylinderGeometry(13.5, 15, 1.2, 12), 0.8, rnd),
    toonMat(ALGAE_COLOR, { flatShading: true }),
    0.032
  );
  floor.name = "swamp-lake-floor";
  floor.position.y = SWAMP_FLOOR_Y - 0.2;
  swampZone.add(floor);

  // 藻类簇：湖底散布的蓝绿发光藻团（高低起伏，营造水下植被层）
  const algaeTuftMat = toonMat(ALGAE_GLOW, { flatShading: true });
  const algaeDarkMat = toonMat(0x16527e, { flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 1.5 + rnd() * 11;
    const clump = new THREE.Group();
    const blades = 3 + ((rnd() * 4) | 0);
    for (let b = 0; b < blades; b++) {
      const blade = part(
        new THREE.ConeGeometry(0.12 + rnd() * 0.1, 1.0 + rnd() * 1.8, 4),
        rnd() < 0.5 ? algaeTuftMat : algaeDarkMat,
        0.008
      );
      blade.position.set((rnd() - 0.5) * 0.6, (0.5 + rnd() * 0.9), (rnd() - 0.5) * 0.6);
      blade.rotation.z = (rnd() - 0.5) * 0.4;
      clump.add(blade);
    }
    clump.position.set(Math.cos(a) * d, SWAMP_FLOOR_Y + 0.2, Math.sin(a) * d);
    swampZone.add(clump);
  }

  // 河床暗蓝乱石（置于藻类之间，不喧宾夺主）
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

  /* ---------- 2b. 水体体积剖面（Y = 10 → 25）：上浅蓝、下深蓝 ---------- */
  const waterVolume = createWaterVolume();
  swampZone.add(waterVolume);

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

  /* ---------- 3. 米白浅绿鲸豚：暂时游回湖心（离开喂食木筏） ---------- */
  /** @type {THREE.Group[]} */
  const whales = [];
  // 成鲸：湖心偏深一带缓慢绕游（不贴喂食筏）
  const whale = buildBelugaWhale(rnd);
  whale.position.set(-4, WHALE_Y - 0.6, -8);
  whale.rotation.order = "YXZ";
  whale.rotation.x = -1.05; // 略平，更像在游而非直立讨食
  whale.rotation.y = 2.4;
  whale.userData.baseY = WHALE_Y - 0.6;
  whale.userData.baseRotX = -1.05;
  whale.userData.bobPhase = 0.4;
  // 绕湖心椭圆巡游（本地 XZ）
  whale.userData.swim = {
    cx: -2,
    cz: -5,
    rx: 9,
    rz: 7,
    speed: 0.11,
    phase: 0.2,
    yawOffset: Math.PI * 0.5, // 切向朝向
  };
  swampZone.add(whale);
  whales.push(whale);

  // 幼鲸：跟随成鲸外侧稍浅处
  const whalePup = buildBelugaWhale(rnd);
  whalePup.scale.setScalar(0.55);
  whalePup.position.set(-10, WHALE_Y - 1.2, -3);
  whalePup.rotation.order = "YXZ";
  whalePup.rotation.x = -0.95;
  whalePup.rotation.y = 2.1;
  whalePup.userData.baseY = WHALE_Y - 1.2;
  whalePup.userData.baseRotX = -0.95;
  whalePup.userData.bobPhase = 2.1;
  whalePup.userData.swim = {
    cx: -2,
    cz: -5,
    rx: 11.5,
    rz: 9,
    speed: 0.13,
    phase: 1.8,
    yawOffset: Math.PI * 0.5,
  };
  swampZone.add(whalePup);
  whales.push(whalePup);

  /* ---------- 黑人孩子喂食白鲸：小木筏 + 举臂孩子 + 食物碎屑 ---------- */
  const feedRaft = createLotusLeafBoat(rnd, 2.3);
  feedRaft.position.set(10.2, WATER_Y + 0.1, 6.8);
  feedRaft.rotation.y = 0.2;
  feedRaft.userData.bobPhase = 1.3;
  feedRaft.userData.baseY = WATER_Y + 0.1;
  swampZone.add(feedRaft);
  if (feedRaft.userData.halo) glowHalos.push(feedRaft.userData.halo);

  // 喂食孩子：立于筏缘，双臂高举向白鲸口边递食
  const feeder = buildNativeDoll(1.05);
  const feedArmGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.62, 4);
  for (const s of [-1, 1]) {
    const arm = part(feedArmGeo, toonMat(DOLL_SKIN, { flatShading: true }), 0.006);
    arm.position.set(s * 0.17, 0.66, 0.12);
    arm.rotation.x = 1.15; // 前上举
    arm.rotation.z = -s * 0.5;
    feeder.add(arm);
  }
  feeder.position.set(-0.95, 0.12, -0.85); // 筏缘靠鲸一侧
  feeder.rotation.y = -2.3; // 面向白鲸头
  feedRaft.add(feeder);

  // 食物碎屑：手与鲸口之间的弧线上几点暖光
  const foodBits = [];
  const handW = new THREE.Vector3(9.1, 26.0, 5.8);
  const mouthW = new THREE.Vector3(7.6, 27.5, 4.5);
  for (let i = 0; i < 4; i++) {
    const k = 0.15 + i * 0.22;
    const bit = glowSprite(0xffe08a, 0.42, 0.85);
    bit.position.lerpVectors(handW, mouthW, k);
    bit.position.y += Math.sin(k * Math.PI) * 0.5 + 0.6;
    bit.userData.phase = i * 1.7;
    swampZone.add(bit);
    foodBits.push(bit);
  }

  // 水下泅游的黑人孩子：玻璃水下的暗色剪影，绕鲸缓游
  const swimmer = buildNativeDoll(0.95);
  swimmer.rotation.order = "YXZ";
  swimmer.rotation.x = 1.35; // 俯身水平泅游
  swimmer.position.set(2.5, 20.8, 9.5);
  swampZone.add(swimmer);

  // 荷叶水下茎秆的锚点先记着（荷叶生成后补茎）
  /* ---------- 4b. 内凹荷叶小舟（Y = 25.0）3~4 朵 ---------- */
  /** @type {THREE.Group[]} */
  const lotuses = [feedRaft]; // 喂食木筏一并随水起伏
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
    if (lotus.userData.halo) glowHalos.push(lotus.userData.halo);

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
        color: 0x9fe8e0,
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
    mush.position.set(Math.cos(a) * d, SWAMP_LOCAL_GROUND_Y + 0.1, Math.sin(a) * d);
    mush.userData.baseY = SWAMP_LOCAL_GROUND_Y + 0.1;
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
    hanger.position.set(Math.cos(a) * r, SWAMP_LOCAL_GROUND_Y - 3 - rnd() * 5, Math.sin(a) * r);
    hanger.lookAt(0, hanger.position.y, 0);
    swampZone.add(hanger);
    hangers.push(hanger);
  }

  // 发光飞鸟：薄荷白 + 暖杏黄，枝头间来回穿梭（4 只）
  /** @type {THREE.Group[]} */
  const birds = [];
  for (let i = 0; i < 4; i++) {
    const bird = buildSwampBird(rnd, i % 2 ? GLOW_BIRD_A : GLOW_BIRD_B);
    bird.scale.setScalar(1.25); // 枝头发光鸟更醒目
    swampZone.add(bird);
    birds.push(bird);
    if (bird.userData.halo) glowHalos.push(bird.userData.halo);
  }

  // 长尾猴：树冠/垂叶间坐望→弧线跳跃（3 只）
  /** @type {THREE.Group[]} */
  const monkeys = [];
  for (let i = 0; i < 3; i++) {
    const mk = buildLongTailMonkey(rnd);
    mk.scale.setScalar(1.3);
    const perches = [];
    const n = 3 + ((rnd() * 2) | 0);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const d = 14 + rnd() * 14;
      perches.push(new THREE.Vector3(Math.cos(a) * d, 43 + rnd() * 6, Math.sin(a) * d));
    }
    mk.userData.perches = perches;
    mk.userData.idx = 0;
    mk.userData.next = 1 % n;
    mk.userData.sitDur = 1.4 + rnd() * 1.4;
    mk.userData.jumpDur = 0.7 + rnd() * 0.3;
    mk.userData.arc = 2.2 + rnd() * 1.6;
    mk.userData.phase = rnd() * 7;
    mk.userData.lastCi = Math.floor(mk.userData.phase / (mk.userData.sitDur + mk.userData.jumpDur));
    mk.userData.dodgeT = 0; // >0 时强制躲避跳
    mk.userData.dodgeFrom = new THREE.Vector3();
    mk.userData.dodgeTo = new THREE.Vector3();
    swampZone.add(mk);
    monkeys.push(mk);
  }

  // 投掷果实池（猴砸送信人 → 送信人接住回扔 → 猴躲避）
  const fruitGeo = facet(new THREE.SphereGeometry(0.17, 6, 5));
  const fruitMats = [
    toonMat(0xff9a4d, { flatShading: true }), // 橙果
    toonMat(0xe8708f, { flatShading: true }), // 浆果
  ];
  const fruits = [];
  for (let i = 0; i < 12; i++) {
    const fr = new THREE.Mesh(fruitGeo, fruitMats[i % 2]);
    fr.visible = false;
    fr.userData = {
      active: false,
      /** @type {'inbound'|'held'|'return'} */
      phase: "inbound",
      vel: new THREE.Vector3(),
      life: 0,
      holdT: 0,
      owner: null, // 投出的猴
      targetMk: null, // 回扔目标猴
    };
    swampZone.add(fr);
    fruits.push(fr);
  }
  /** @type {THREE.Mesh|null} 送信人手中暂存的果 */
  let heldFruit = null;

  // 发光蜥蜴：坑缘草甸缓爬 ×2 + 湖底 ×1
  /** @type {THREE.Group[]} */
  const lizards = [];
  for (let i = 0; i < 3; i++) {
    const lz = buildGlowLizard(rnd);
    lz.scale.setScalar(1.35);
    if (i < 2) {
      lz.userData.baseY = SWAMP_LOCAL_GROUND_Y + 0.12;
      lz.userData.orbitR = 33 + rnd() * 5;
    } else {
      lz.userData.baseY = SWAMP_FLOOR_Y + 0.3;
      lz.userData.orbitR = 8 + rnd() * 4;
    }
    lz.userData.speed = 0.1 + rnd() * 0.08;
    lz.position.y = lz.userData.baseY;
    swampZone.add(lz);
    lizards.push(lz);
    if (lz.userData.halo) glowHalos.push(lz.userData.halo);
  }

  // 发光带鱼：水下摆尾环游（3 条）
  /** @type {THREE.Group[]} */
  const ribbons = [];
  for (let i = 0; i < 3; i++) {
    const rf = buildRibbonFish(rnd);
    rf.userData.orbitR = 7 + rnd() * 9;
    rf.userData.orbitY = 15 + rnd() * 6;
    rf.userData.speed = 0.16 + rnd() * 0.12;
    rf.userData.wave = 5 + rnd() * 3;
    swampZone.add(rf);
    ribbons.push(rf);
    if (rf.userData.halo) glowHalos.push(rf.userData.halo);
  }

  /* ---------- 赛博水墨虎：大树间巡游 + 沿石阶下坑饮水 ---------- */
  const tigerRim = [0.5, 1.6, 2.7, 3.9, 5.1].map(
    (a) => new THREE.Vector3(Math.cos(a) * 37.4, SWAMP_LOCAL_GROUND_Y, Math.sin(a) * 37.4)
  );
  const tigerSteps = [0.15, 0.4, 0.65, 0.9].map((tt) =>
    new THREE.Vector3(
      Math.cos(ENTRANCE_A) * (37 - 12 * tt),
      SWAMP_LOCAL_GROUND_Y - 17.5 * tt,
      Math.sin(ENTRANCE_A) * (37 - 12 * tt)
    )
  );
  const tiger = createMoebiusTiger(rnd, {
    rim: tigerRim,
    steps: tigerSteps,
    drink: tigerSteps[3],
    speed: 2.6,
  });
  swampZone.add(tiger);
  swampZone.userData.tiger = tiger;

  // 米白贝壳：坑缘草甸散落（3 枚，与苔石相伴）
  for (let i = 0; i < 3; i++) {
    const shell = buildShell(rnd);
    const a = rnd() * Math.PI * 2;
    const d = 34 + rnd() * 6;
    shell.position.set(Math.cos(a) * d, SWAMP_LOCAL_GROUND_Y + 0.15, Math.sin(a) * d);
    shell.rotation.y = rnd() * Math.PI * 2;
    shell.userData.baseY = SWAMP_LOCAL_GROUND_Y + 0.15;
    swampZone.add(shell);
    rimDecor.push(shell);
  }

  // 坑缘棕榈：与苍天巨树交错，湿润繁茂的丛林感（同样贴球面）
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    if (Math.abs(angDiff(a)) < 0.5) continue;
    const palm = buildRimPalm(rnd);
    const d = 36 + rnd() * 4.5;
    palm.position.set(Math.cos(a) * d, SWAMP_LOCAL_GROUND_Y - 0.2, Math.sin(a) * d);
    palm.userData.yaw = rnd() * Math.PI * 2;
    swampZone.add(palm);
    towerTrees.push(palm); // 一并交给 applySwampSphereFit 贴球面
  }

  /* ---------- userData / 实时动画 ---------- */
  swampZone.userData.kind = "moebius-swamp";
  swampZone.userData.groundY = SWAMP_LOCAL_GROUND_Y;
  swampZone.userData.waterY = WATER_Y;
  swampZone.userData.floorY = SWAMP_FLOOR_Y;
  swampZone.userData.whale = whale;
  swampZone.userData.whales = whales;
  swampZone.userData.lotuses = lotuses;
  swampZone.userData.nectarTargets = [];
  // 不设大型碰撞体：送信人可直接走入 / 跳入湖沼（无隐形围墙）
  swampZone.userData.collideRadius = 0;
  swampZone.userData.cameraHint = {
    // 月夜：机位入坑内仰俯树冠/水面
    localPosition: new THREE.Vector3(17, 31.5, 19),
    localLookAt: new THREE.Vector3(0, 29, 0),
    fov: 62,
  };

  swampZone.update = function updateSwamp(_dt, t, runtime) {
    /* ---------- 玩家入沼判定：萤火环绕/尾随 + 长尾猴投果 ---------- */
    const player = runtime?.player;
    let playerIn = false;
    if (player) {
      swampZone.updateWorldMatrix(true, false);
      _ffP.copy(player.position);
      swampZone.worldToLocal(_ffP);
      const horiz = Math.hypot(_ffP.x, _ffP.z);
      playerIn = horiz < 30 && _ffP.y > 12 && _ffP.y < 52;
      swampZone.getWorldQuaternion(_ffQ).invert();
      _ffF.copy(player.facing).applyQuaternion(_ffQ);
      _ffF.y = 0;
      if (_ffF.lengthSq() < 1e-6) _ffF.set(0, 0, 1);
      _ffF.normalize();
    }
    // 荷叶小舟随水起伏
    for (const lotus of lotuses) {
      const ph = lotus.userData.bobPhase || 0;
      lotus.position.y = (lotus.userData.baseY || WATER_Y) + Math.sin(t * 1.05 + ph) * 0.09;
      lotus.rotation.z = Math.sin(t * 0.8 + ph) * 0.028;
    }
    // 鲸豚：暂时游回湖心椭圆巡游（离开喂食筏）+ 轻柔浮沉换气
    for (const w of whales) {
      const ph = w.userData.bobPhase || 0;
      const sw = w.userData.swim;
      if (sw) {
        const ang = sw.phase + t * sw.speed;
        const x = sw.cx + Math.cos(ang) * sw.rx;
        const z = sw.cz + Math.sin(ang) * sw.rz;
        w.position.x = x;
        w.position.z = z;
        // 切向朝向（沿轨道前进）
        const tx = -Math.sin(ang) * sw.rx;
        const tz = Math.cos(ang) * sw.rz;
        w.rotation.y = Math.atan2(tx, tz) + (sw.yawOffset || 0);
      }
      w.position.y = (w.userData.baseY ?? WHALE_Y) + Math.sin(t * 0.55 + ph) * 0.4;
      const breathe = Math.sin(t * 0.28 + ph);
      const baseRx = w.userData.baseRotX ?? -1.05;
      // 换气时略抬头，幅度比贴筏讨食时小
      w.rotation.x = baseRx + breathe * 0.28;
      w.rotation.z = Math.sin(t * 0.4 + ph) * 0.04;
    }

    /* ---------- 5 朵巨型发光花朵：轮换飘落湖面（花蕊发光） ---------- */
    const giantFlowers = swampZone.userData.giantFlowers || [];
    for (let i = 0; i < giantFlowers.length; i++) {
      const f = giantFlowers[i];
      const cyc = (t * 0.05 + i * 0.37) % 1; // 每朵独立相位，轮换有一朵在飘落
      // 花蕊发光脉动
      if (f.userData.core) {
        const pulse = 0.7 + Math.sin(t * 1.6 + i) * 0.3;
        f.userData.core.material.color.setRGB(pulse, pulse * 0.92, 0.55);
      }
      // 被 aircraft 扫描激光吸入中：跳过本花位置逻辑，避免抢位移
      if (f.userData.scanSucking) {
        f.userData.restT = Math.min(f.userData.restT ?? 0, 1);
        continue;
      }
      if (!f.userData.falling) {
        // 正常开放：在叶面之上朝天空轻微摇曳（非水面蜜源）
        f.userData.onWater = false;
        f.userData.feeding = false;
        f.position.y = f.userData.baseY + Math.sin(t * 0.5 + i) * 0.3;
        f.rotation.y += _dt * 0.05;
        // 触发飘落：每朵按各自周期落下一次
        if (cyc > 0.82) {
          f.userData.falling = true;
          f.userData.fallT = 0;
          f.userData.restT = 0;
          f.userData.splashed = false;
        }
      } else {
        // 飘落：从叶面高度缓慢下落至湖面（旋转飘摆）
        f.userData.fallT += _dt;
        const k = Math.min(1, f.userData.fallT / 6.0); // 6 秒落至水面
        const startY = f.userData.baseY;
        const targetY = WATER_Y + 0.3;
        f.position.y = startY + (targetY - startY) * k;
        f.rotation.x += _dt * 0.4;
        f.rotation.z += _dt * 0.3;
        if (k >= 1) {
          // 首次触水 → 在落点激起涟漪；可供 aircraft 蜂鸟吸食
          if (!f.userData.splashed) {
            f.userData.splashed = true;
            f.userData.onWater = true;
            f.userData.nectar = 1; // 1=满蜜，被吸食后衰减
            f.userData.restT = 0;
            spawnRipple(f.position.x, f.position.z, 1.3);
          }
          // 落湖面后停留；被吸食时花蕊更亮、蜜量衰减
          f.userData.restT += _dt;
          if (f.userData.feeding && f.userData.core) {
            const p2 = 0.85 + Math.sin(t * 8 + i) * 0.15;
            f.userData.core.material.color.setRGB(p2, p2 * 0.5, 0.9);
            f.userData.nectar = Math.max(0, (f.userData.nectar ?? 1) - _dt * 0.22);
          }
          // 蜜尽或停留超时 → 复位重新开放
          // 水面停留稍长，给空中「巨蜂鸟」编队赶路吸蜜的时间
          const restLimit = f.userData.feeding ? 16.0 : 14.0;
          if (f.userData.restT > restLimit || (f.userData.nectar ?? 0) <= 0.05) {
            f.userData.falling = false;
            f.userData.splashed = false;
            f.userData.onWater = false;
            f.userData.feeding = false;
            f.userData.nectar = 0;
            f.userData.restT = 0;
            f.rotation.set(0, f.rotation.y, 0);
            f.position.y = f.userData.baseY;
          }
        }
      }
    }

    // 暴露蜜源（世界坐标）供 aircraft 寻觅吸食
    {
      const nectar = [];
      const _nw = new THREE.Vector3();
      for (const f of giantFlowers) {
        if (f.userData.onWater && (f.userData.nectar ?? 0) > 0.08) {
          f.getWorldPosition(_nw);
          nectar.push({
            flower: f,
            worldPos: _nw.clone(),
            nectar: f.userData.nectar ?? 1,
          });
        }
      }
      swampZone.userData.nectarTargets = nectar;
      // placement 包装也挂一份
      if (swampZone.parent?.userData?.kind === "moebius-swamp") {
        swampZone.parent.userData.nectarTargets = nectar;
      }
    }

    // 水面涟漪扩散淡出
    updateRipples(_dt);

    /* ---------- 落叶系统：参天大树落叶飘落 + 湖面漂浮落叶 ---------- */
    const fallingLeaves = swampZone.userData.fallingLeaves || [];
    // 周期性从随机大树顶部生成落叶
    if (Math.random() < _dt * 6) {
      const free = fallingLeaves.find((l) => !l.userData.active);
      if (free && towerTrees.length) {
        const src = towerTrees[(Math.random() * towerTrees.length) | 0];
        free.position.copy(src.position);
        // 树冠已抬高 2 倍：从冠顶附近飘落
        free.position.y += (30 + Math.random() * 20) * LEAF_HEIGHT_MUL;
        free.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        free.userData.active = true;
        free.userData.vy = -(1.2 + Math.random() * 1.2);
        free.userData.spin = (Math.random() - 0.5) * 2;
        free.userData.sway = Math.random() * Math.PI * 2;
        free.visible = true;
      }
    }
    for (const l of fallingLeaves) {
      if (!l.userData.active) continue;
      l.userData.sway += _dt * 2;
      l.position.y += l.userData.vy * _dt;
      l.position.x += Math.sin(l.userData.sway) * _dt * 0.6;
      l.position.z += Math.cos(l.userData.sway) * _dt * 0.6;
      l.rotation.x += l.userData.spin * _dt;
      l.rotation.z += l.userData.spin * 0.7 * _dt;
      if (l.position.y <= WATER_Y + 0.1) {
        // 落到水面：转为漂浮（停在水面，缓慢漂）
        l.position.y = WATER_Y + 0.1;
        l.userData.active = false;
        l.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.2, Math.random() * Math.PI, 0);
        l.userData.drift = Math.random() * Math.PI * 2;
        l.userData.dRadius = Math.hypot(l.position.x, l.position.z) || 5;
      }
    }
    // 湖面漂浮落叶缓慢旋转漂移
    for (const l of swampZone.children) {
      if (l.userData && l.userData.drift !== undefined) {
        l.userData.drift += _dt * 0.15;
        const r = l.userData.dRadius;
        l.position.x = Math.cos(l.userData.drift) * r + Math.sin(t + l.userData.drift) * 0.3;
        l.position.z = Math.sin(l.userData.drift) * r + Math.cos(t + l.userData.drift) * 0.3;
      }
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
    // 发光飞鸟：枝头间穿梭（径向往返）+ 拍翅
    for (const bird of birds) {
      const a = t * bird.userData.speed + bird.userData.phase;
      const rr = bird.userData.orbitR + Math.sin(t * 0.55 + bird.userData.phase * 2) * bird.userData.dart;
      bird.position.set(
        Math.cos(a) * rr,
        bird.userData.orbitY + Math.sin(t * 0.8 + bird.userData.phase) * 0.8,
        Math.sin(a) * rr
      );
      bird.rotation.y = -a; // 头朝行进切向
      const flap = Math.sin(t * 7 + bird.userData.phase) * 0.5;
      if (bird.userData.wingL) bird.userData.wingL.rotation.z = -0.5 - flap;
      if (bird.userData.wingR) bird.userData.wingR.rotation.z = 0.5 + flap;
    }
    // 长尾猴：坐望→跳枝；遇回扔果则侧跃躲避
    for (const mk of monkeys) {
      const u = mk.userData;
      const nPerch = u.perches.length;

      // ---- 躲避跳：回扔果逼近时强制弧线跃到更远枝头 ----
      if (u.dodgeT > 0) {
        u.dodgeT += _dt;
        const k = Math.min(1, u.dodgeT / 0.55);
        mk.position.lerpVectors(u.dodgeFrom, u.dodgeTo, k);
        mk.position.y += Math.sin(k * Math.PI) * (u.arc + 2.2);
        mk.lookAt(u.dodgeTo.x, mk.position.y, u.dodgeTo.z);
        // 躲避时前肢张开
        for (const arm of [u.armL, u.armR]) {
          if (arm) arm.rotation.x = arm.userData.baseRotX - 1.2;
        }
        if (k >= 1) {
          u.dodgeT = 0;
          // 对齐到最近 perch 索引，继续常规循环
          let bestI = 0;
          let bestD = Infinity;
          for (let i = 0; i < nPerch; i++) {
            const d = u.perches[i].distanceToSquared(u.dodgeTo);
            if (d < bestD) {
              bestD = d;
              bestI = i;
            }
          }
          u.idx = bestI;
          u.next = (bestI + 1 + ((Math.random() * (nPerch - 1)) | 0)) % nPerch;
          if (u.next === u.idx) u.next = (u.idx + 1) % nPerch;
          // 重置为「刚坐下」：避免落地立刻再投果
          const cyc = u.sitDur + u.jumpDur;
          const ciNow = Math.floor((t + u.phase) / cyc);
          u.phase = ciNow * cyc + 0.12 - t;
          u.lastCi = ciNow;
          u.throwCd = Math.max(u.throwCd || 0, 1.4);
        }
        continue;
      }

      const cyc = u.sitDur + u.jumpDur;
      const local = t + u.phase;
      const ci = Math.floor(local / cyc);
      if (ci !== u.lastCi) {
        u.lastCi = ci;
        u.idx = u.next;
        u.next = (u.next + 1) % nPerch;
      }
      const lt = local - ci * cyc;
      const A = u.perches[u.idx];
      const B = u.perches[u.next];
      if (lt < u.sitDur) {
        mk.position.copy(A);
        mk.position.y += Math.sin(t * 3.1 + u.phase) * 0.06;
        mk.lookAt(B.x, mk.position.y + 0.3, B.z);
      } else {
        const k = (lt - u.sitDur) / u.jumpDur;
        mk.position.lerpVectors(A, B, k);
        mk.position.y += Math.sin(k * Math.PI) * u.arc;
        mk.lookAt(B.x, mk.position.y, B.z);
      }

      // 侦测回扔果：逼近则躲避
      for (const fr of fruits) {
        const fu = fr.userData;
        if (!fu.active || fu.phase !== "return") continue;
        const dist = fr.position.distanceTo(mk.position);
        if (dist > FRUIT_DODGE_R) continue;
        _ffTmp.subVectors(mk.position, fr.position);
        // 果朝猴飞来（速度与相对位置同向）
        if (fu.vel.dot(_ffTmp) < 0.5) continue;
        // 挑一个离当前与来果方向都较远的枝头
        u.dodgeFrom.copy(mk.position);
        let best = u.perches[(u.idx + 1) % nPerch];
        let bestScore = -Infinity;
        for (const p of u.perches) {
          const awayFruit = p.distanceTo(fr.position);
          const awaySelf = p.distanceTo(mk.position);
          const score = awayFruit * 1.2 + awaySelf * 0.5 + Math.random();
          if (awaySelf > 2.5 && score > bestScore) {
            bestScore = score;
            best = p;
          }
        }
        u.dodgeTo.copy(best);
        u.dodgeT = 0.001;
        u.poseT = 0;
        break;
      }

      // 玩家入沼：冷却到了朝送信人投果
      u.throwCd = (u.throwCd || 0) - _dt;
      if (u.poseT > 0) {
        u.poseT -= _dt;
        if (player) mk.lookAt(_ffP.x, mk.position.y + 0.2, _ffP.z);
        const k = Math.sin(Math.min(1, 1 - u.poseT / 0.55) * Math.PI);
        for (const arm of [u.armL, u.armR]) {
          if (arm) arm.rotation.x = arm.userData.baseRotX - 2.4 * k;
        }
      } else {
        for (const arm of [u.armL, u.armR]) {
          if (arm) arm.rotation.x = arm.userData.baseRotX;
        }
        if (playerIn && u.throwCd <= 0 && lt < u.sitDur && u.dodgeT <= 0) {
          const fr = fruits.find((x) => !x.userData.active);
          if (fr) {
            u.throwCd = 1.8 + Math.random() * 2.6;
            u.poseT = 0.55;
            const fu = fr.userData;
            fu.active = true;
            fu.phase = "inbound";
            fu.owner = mk;
            fu.targetMk = null;
            fu.holdT = 0;
            fu.life = 5;
            fr.visible = true;
            fr.position.set(mk.position.x, mk.position.y + 1.2, mk.position.z);
            const T = 0.85 + Math.random() * 0.35;
            fu.vel.set(
              (_ffP.x - fr.position.x) / T,
              (_ffP.y + 1.0 - fr.position.y) / T + 0.5 * FRUIT_G * T,
              (_ffP.z - fr.position.z) / T
            );
          }
        }
      }
    }

    // 手中果：跟送信人；按 R / 点击 / 自动 0.35s 后回扔
    if (heldFruit && player) {
      const fu = heldFruit.userData;
      fu.holdT += _dt;
      heldFruit.position.set(_ffP.x + _ffF.x * 0.35, _ffP.y + 1.15, _ffP.z + _ffF.z * 0.35);
      const keys = runtime?.keys;
      // 接住约 0.35s 自动回扔，或按 R 立刻扔
      const wantThrow = fu.holdT >= 0.35 || !!keys?.KeyR;
      if (wantThrow) {
        // 瞄准：原投出的猴，否则最近猴
        let target = fu.owner;
        if (!target || !target.parent) {
          let bestD = Infinity;
          for (const mk of monkeys) {
            const d = mk.position.distanceToSquared(_ffP);
            if (d < bestD) {
              bestD = d;
              target = mk;
            }
          }
        }
        if (target) {
          fu.phase = "return";
          fu.targetMk = target;
          fu.life = 4;
          fu.holdT = 0;
          const aim = target.position;
          const T = 0.75 + Math.random() * 0.2;
          // 预判：朝猴当前位偏高一点，猴会躲开
          fu.vel.set(
            (aim.x - heldFruit.position.x) / T,
            (aim.y + 0.8 - heldFruit.position.y) / T + 0.5 * FRUIT_G * T,
            (aim.z - heldFruit.position.z) / T
          );
        } else {
          // 无目标：朝面朝方向抛出
          fu.phase = "return";
          fu.life = 3;
          fu.vel.set(_ffF.x * 8, 6, _ffF.z * 8);
        }
        heldFruit = null;
      }
    }

    // 果实弹道
    for (const fr of fruits) {
      const fu = fr.userData;
      if (!fu.active) continue;

      if (fu.phase === "held") {
        // 由 heldFruit 分支驱动位置
        continue;
      }

      fu.life -= _dt;
      fu.vel.y -= FRUIT_G * _dt;
      fr.position.addScaledVector(fu.vel, _dt);
      fr.rotation.x += _dt * 6;
      fr.rotation.z += _dt * 4;

      // 入站果：送信人接住
      if (fu.phase === "inbound" && player && fr.position.distanceToSquared(_ffP) < FRUIT_CATCH_R2) {
        if (!heldFruit) {
          fu.phase = "held";
          fu.holdT = 0;
          fu.vel.set(0, 0, 0);
          fu.life = 6;
          heldFruit = fr;
        } else {
          // 已有果在手：弹开消失
          fu.active = false;
          fr.visible = false;
        }
        continue;
      }

      // 回扔：砸中猴（若未躲开）
      if (fu.phase === "return") {
        for (const mk of monkeys) {
          if (fr.position.distanceToSquared(mk.position) < FRUIT_HIT_MONKEY_R2) {
            // 命中：吓一跳，强制短躲避
            const u = mk.userData;
            if (u.dodgeT <= 0) {
              u.dodgeFrom.copy(mk.position);
              u.dodgeTo.copy(u.perches[(u.idx + 1 + ((Math.random() * 2) | 0)) % u.perches.length]);
              u.dodgeT = 0.001;
            }
            fu.active = false;
            fr.visible = false;
            break;
          }
        }
      }

      if (!fu.active) continue;
      if (fu.life <= 0 || fr.position.y < WATER_Y + 0.15) {
        if (heldFruit === fr) heldFruit = null;
        fu.active = false;
        fr.visible = false;
        fu.owner = null;
        fu.targetMk = null;
      }
    }
    // 发光蜥蜴：贴地缓爬，头朝行进向微摆
    for (const lz of lizards) {
      const u = lz.userData;
      const a = t * u.speed + u.phase;
      const r = u.orbitR + Math.sin(a * 3.1) * 1.4;
      lz.position.set(Math.cos(a) * r, u.baseY, Math.sin(a) * r);
      lz.rotation.y = -a + Math.sin(t * 2.2 + u.phase) * 0.25;
    }
    // 发光带鱼：环游 + 带状身体波动摆尾
    for (const rf of ribbons) {
      const u = rf.userData;
      const a = t * u.speed + u.phase;
      rf.position.set(
        Math.cos(a) * u.orbitR,
        u.orbitY + Math.sin(t * 0.8 + u.phase) * 0.5,
        Math.sin(a) * u.orbitR
      );
      rf.rotation.y = -a - Math.PI / 2; // 头(+X)朝行进向
      const rp = u.bodyMesh.geometry.attributes.position;
      for (let i = 0; i < rp.count; i++) {
        const x = u.baseX[i];
        const tailK = 0.5 - x / 3.8; // 头 0 → 尾 1
        rp.setZ(i, Math.sin(x * 2.0 - t * u.wave + u.phase) * 0.3 * (0.15 + 0.85 * tailK));
      }
      rp.needsUpdate = true;
    }
    // 水下泅游的孩子：绕鲸缓游 + 打腿摆
    {
      const a = t * 0.1 + 2.4;
      swimmer.position.set(7 + Math.cos(a) * 6.5, 20.6 + Math.sin(t * 0.9) * 0.4, 4 + Math.sin(a) * 6.5);
      swimmer.rotation.y = -a;
      swimmer.rotation.z = Math.sin(t * 2.6) * 0.18;
    }
    // 食物碎屑微光闪烁
    for (const b of foodBits) {
      b.material.opacity = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3 + b.userData.phase));
    }
    // 赛博水墨虎巡游/饮水；传入 player 以便见送信人跳下相见
    tiger.userData.update?.(_dt, t, runtime);
    // 气泡
    for (const b of bubbles) {
      b.position.y = b.userData.baseY + Math.sin(t * 1.5 + b.userData.phase) * 0.5;
      b.material.opacity = 0.22 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.1 + b.userData.phase));
    }
    // 萤火虫：玩家入沼 → 大部分环绕/尾随送信人，离开后平滑回归环境漂移
    for (const f of fireflies) {
      const u = f.userData;
      const tt = t * u.speed + u.phase;
      const ax = u.baseX + Math.sin(tt * 0.9) * u.range + Math.sin(tt * 0.37 + 1.7) * u.range * 0.6;
      const ay = u.baseY + Math.sin(tt * 0.7 + u.phase) * 1.2;
      const az = u.baseZ + Math.cos(tt * 0.8) * u.range;
      u.followK += ((playerIn ? 1 : 0) - u.followK) * Math.min(1, _dt * 1.5);
      if (u.followK > 0.002 && player) {
        let tx, ty, tz;
        if (u.trail) {
          // 尾随：身后 1~3 单位拖尾
          const back = 1.8 + Math.sin(tt * 0.7 + u.orbitPh) * 0.8;
          tx = _ffP.x - _ffF.x * back + Math.sin(tt * 1.3 + u.orbitPh) * 0.6;
          ty = _ffP.y + 1.2 + Math.sin(tt * 0.9 + u.orbitPh) * 0.5;
          tz = _ffP.z - _ffF.z * back + Math.cos(tt * 1.1 + u.orbitPh) * 0.6;
        } else {
          // 环绕：绕玩家水平圆周 + 头顶浮动
          const oa = t * u.orbitSpd + u.orbitPh;
          tx = _ffP.x + Math.cos(oa) * u.orbitR;
          ty = _ffP.y + u.orbitH + Math.sin(t * 1.3 + u.orbitPh) * 0.45;
          tz = _ffP.z + Math.sin(oa) * u.orbitR;
        }
        const k = u.followK;
        f.position.set(ax + (tx - ax) * k, ay + (ty - ay) * k, az + (tz - az) * k);
      } else {
        f.position.set(ax, ay, az);
      }
      const tw = 0.5 + 0.5 * Math.sin(t * u.flicker + u.phase * 3);
      f.material.opacity = u.op * (0.3 + 0.7 * tw);
    }
    // 花蕊光晕呼吸
    for (const h of glowHalos) {
      h.material.opacity = 0.38 + 0.26 * (0.5 + 0.5 * Math.sin(t * 1.6 + (h.userData.pulse || 0)));
    }
    // 光池微闪
    for (const p of pools) {
      p.material.opacity = 0.05 + 0.04 * (0.5 + 0.5 * Math.sin(t * 0.7 + p.userData.phase));
    }
    // 月光柱微弱呼吸
    shaftMat.opacity = 0.022 + 0.012 * (0.5 + 0.5 * Math.sin(t * 0.4));
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
    tree.position.y = SWAMP_LOCAL_GROUND_Y - 0.3 - drop(d) - 0.8;
    // 局部 +Y 对齐该点球面法线（树朝外倾斜，根部埋土）再绕法线自转
    _swT.set(tree.position.x, Rs - drop(d), tree.position.z).normalize();
    tree.quaternion.copy(quatYToDir(_swT, _swQ));
    tree.rotateY(tree.userData.yaw ?? 0);
  }
  const decor = swampZone.userData.rimDecor || [];
  for (const m of decor) {
    const d = Math.hypot(m.position.x, m.position.z);
    m.position.y = (m.userData.baseY ?? SWAMP_LOCAL_GROUND_Y) - drop(d);
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
  inner.position.y = -SWAMP_LOCAL_GROUND_Y;

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
  wrap.userData.nectarTargets = []; // 由 inner.update 同步：水面落花蜜源（世界坐标）
  wrap.userData.update = (dt, t, runtime) => {
    inner.update?.(dt, t, runtime);
    // 镜像蜜源列表，方便外部只拿 wrap（地图放置根）
    wrap.userData.nectarTargets = inner.userData.nectarTargets || [];
  };

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
 * 切勿再减 SWAMP_LOCAL_GROUND_Y×scale，否则会双重下移埋入地下。）
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

// =====================================================================
//  独立工厂：绿黑斑纹小鱼群 / 萤火虫群
//  从 createMoebiusSwampZone 内部逻辑提取，收拢为紧凑可放置组件。
//  不改动 zone 原有 inline 生成逻辑（zone 内仍用大范围散布）。
// =====================================================================

/** 绿黑斑纹小鱼群（9条，圆形排布，可独立放置） */
function buildFishSchool(rnd = Math.random) {
  const g = new THREE.Group();
  g.name = "swamp-fish-school";
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
    for (let k = 0; k < 2 + (i % 2); k++) {
      const spot = new THREE.Mesh(facet(new THREE.SphereGeometry(0.06, 4, 3)), spotMat);
      spot.position.set((k - 1) * 0.22, 0.12, (rnd() - 0.5) * 0.5);
      fish.add(spot);
    }
    // 独立放置：紧凑圆形排布（zone 内用 ±15 大范围，这里收拢到半径 ~1.5）
    const a = (i / 9) * Math.PI * 2;
    const d = 1.0 + (rnd() - 0.5) * 0.6;
    fish.position.set(Math.cos(a) * d, (rnd() - 0.5) * 1.2, Math.sin(a) * d);
    fish.userData.orbitR = d;
    fish.userData.orbitY = fish.position.y;
    fish.userData.phase = rnd() * Math.PI * 2;
    fish.userData.speed = 0.25 + rnd() * 0.3;
    g.add(fish);
  }
  return g;
}

/** 萤火虫群（46点辉光，球形散布，可独立放置） */
function buildFireflies(rnd = Math.random) {
  const g = new THREE.Group();
  g.name = "swamp-fireflies";
  for (let i = 0; i < 46; i++) {
    const sp = glowSprite(i % 3 === 2 ? FIREFLY_B : FIREFLY_A, 0.5 + rnd() * 0.7, 0.8);
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 5;
    const y = rnd() * 6;
    sp.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    sp.userData.baseX = sp.position.x;
    sp.userData.baseY = sp.position.y;
    sp.userData.baseZ = sp.position.z;
    sp.userData.range = 1.5 + rnd() * 2.5;
    sp.userData.speed = 0.25 + rnd() * 0.4;
    sp.userData.flicker = 2 + rnd() * 3;
    sp.userData.phase = rnd() * Math.PI * 2;
    sp.userData.op = 0.5 + rnd() * 0.5;
    sp.userData.followK = 0;
    sp.userData.orbitR = 1.4 + rnd() * 2.4;
    sp.userData.orbitH = 0.6 + rnd() * 2.2;
    sp.userData.orbitSpd = (0.8 + rnd() * 1.4) * (rnd() < 0.5 ? -1 : 1);
    sp.userData.orbitPh = rnd() * Math.PI * 2;
    sp.userData.trail = i % 3 === 0;
    g.add(sp);
  }
  return g;
}

// =====================================================================
//  生态组件集中导出（不影响上面任何逻辑）：供截图 harness / 地图编辑器
//  单独实例化。仅新增导出，未改动任何现有函数的实现。
// =====================================================================
export const SWAMP_COMPONENT_BUILDERS = {
  whale: buildBelugaWhale,
  worldTree: buildWorldTree,
  nativeDoll: buildNativeDoll,
  lotusLeafBoat: createLotusLeafBoat,
  swampEel: buildSwampEel,
  tubeWormCluster: buildTubeWormCluster,
  moebiusMushroom: buildMoebiusMushroom,
  pinkHanger: buildPinkHanger,
  swampBird: buildSwampBird,
  longTailMonkey: buildLongTailMonkey,
  glowLizard: buildGlowLizard,
  ribbonFish: buildRibbonFish,
  shell: buildShell,
  rimPalm: buildRimPalm,
  toweringTree: buildToweringTree,
  canopyCeiling: buildCanopyCeiling,
  glowFlower: buildGlowFlower,
  giantFlower: buildGiantFlower,
  stamenSpike: buildStamenSpike,
  fishSchool: buildFishSchool,
  fireflies: buildFireflies,
};
