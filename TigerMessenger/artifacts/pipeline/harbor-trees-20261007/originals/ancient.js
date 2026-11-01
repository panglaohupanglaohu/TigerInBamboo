// =====================================================================
//  东方水墨古风资产：扭曲古松 / 仙鹤 / 黑岩
//  参考雪舟《四季花鸟图屏风》：焦墨树干、墨绿松冠、丹顶鹤、加粗勾线
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";
import { mergeStaticGroup } from "../world/geometryMerge.js";
import { registerLocalLight } from "../render/lighting/localLightRegistry.js";

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
 * 日式造型松：弯曲粗干、少量横向骨枝、层层修剪成云片的松冠。
 * 形态依据真实庭园松而不是递归分形树；随机只改变姿态，不改变树的骨架语法。
 */
export function createAncientPineTree(seed = 7301 + pineSerial++ * 97) {
  const g = new THREE.Group();
  g.name = "giantTreeGroup"; // 兼容测试/编辑器引用（小松与巨松同源资产）
  const rnd = pineRng(seed);
  const barkMat = toonMat(BARK);
  const barkDarkMat = toonMat(BARK_DARK);
  const leafMats = [toonMat(PINE_DARK), toonMat(PINE), toonMat(PINE_LIGHT)];
  const yAxis = new THREE.Vector3(0, 1, 0);

  function segment(a, b, r0, r1, material = barkMat, outline = O_BOLD * 0.72) {
    const delta = new THREE.Vector3().subVectors(b, a);
    const len = delta.length();
    const mesh = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(r1, r0, len, 7, 1, false)),
      material
    );
    mesh.position.copy(a).addScaledVector(delta, 0.5);
    mesh.quaternion.setFromUnitVectors(yAxis, delta.normalize());
    mesh.castShadow = true;
    addOutline(mesh, outline, 0x2b2823, 0.045);
    g.add(mesh);
    return mesh;
  }

  function branch(points, r0, r1) {
    for (let i = 0; i < points.length - 1; i++) {
      const t = i / Math.max(1, points.length - 2);
      segment(
        points[i],
        points[i + 1],
        THREE.MathUtils.lerp(r0, r1, t),
        THREE.MathUtils.lerp(r0, r1, Math.min(1, t + 0.45)),
        i === 0 ? barkMat : barkDarkMat,
        O_BOLD * (i === 0 ? 0.64 : 0.48)
      );
    }
  }

  /** 修剪后的云片冠：宽、扁、下暗上亮，外轮廓有少量不规则起伏。 */
  function crown(center, width, depth, thickness, yaw = 0, fullness = 1) {
    const pad = new THREE.Group();
    pad.position.copy(center);
    pad.rotation.y = yaw;
    const blobs = Math.max(4, Math.round(4 * fullness));
    for (let i = 0; i < blobs; i++) {
      const edge = blobs === 1 ? 0 : i / (blobs - 1) - 0.5;
      const mesh = new THREE.Mesh(
        facet(new THREE.IcosahedronGeometry(0.5, 1)),
        leafMats[i === blobs - 1 ? 2 : i === 0 ? 0 : 1]
      );
      mesh.position.set(
        edge * width * 0.62 + (rnd() - 0.5) * width * 0.08,
        (i % 2) * thickness * 0.2 + (rnd() - 0.5) * 0.04,
        (rnd() - 0.5) * depth * 0.34
      );
      const taper = 1 - Math.abs(edge) * 0.35;
      mesh.scale.set(
        width * 0.48 * taper,
        thickness * (1.15 + rnd() * 0.15),
        depth * (0.58 + rnd() * 0.1)
      );
      mesh.rotation.set((rnd() - 0.5) * 0.12, rnd() * Math.PI, (rnd() - 0.5) * 0.08);
      mesh.castShadow = true;
      addOutline(mesh, O_BOLD * 0.38, 0x173227, 0.035);
      pad.add(mesh);
    }
    g.add(pad);
  }

  const lean = (rnd() > 0.5 ? 1 : -1) * (0.52 + rnd() * 0.5);
  const depthLean = (rnd() - 0.5) * 0.5;
  const trunk = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.04 + lean * 0.12, 0.7, depthLean * 0.1),
    new THREE.Vector3(-0.12 + lean * 0.3, 1.45, 0.1 + depthLean * 0.25),
    new THREE.Vector3(0.08 + lean * 0.55, 2.25, -0.04 + depthLean * 0.5),
    new THREE.Vector3(-0.04 + lean * 0.8, 3.08, 0.12 + depthLean * 0.72),
    new THREE.Vector3(0.2 + lean, 3.82, 0.02 + depthLean),
    new THREE.Vector3(0.08 + lean * 1.12, 4.45, 0.12 + depthLean * 1.1),
  ];
  for (let i = 0; i < trunk.length - 1; i++) {
    const t = i / (trunk.length - 2);
    segment(trunk[i], trunk[i + 1], 0.3 - t * 0.19, 0.265 - t * 0.19);
  }

  // 外露根盘让树真正“抓”在球面上，呼应参考照片中的老松根势。
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.35;
    const end = new THREE.Vector3(Math.cos(a) * (0.62 + rnd() * 0.25), 0.03, Math.sin(a) * (0.62 + rnd() * 0.25));
    const mid = end.clone().multiplyScalar(0.46);
    mid.y = 0.12 + rnd() * 0.06;
    branch([trunk[0], mid, end], 0.16, 0.035);
  }

  const flip = rnd() > 0.5 ? 1 : -1;
  const arms = [
    { at: 2, side: -1, len: 1.75, rise: 0.16, z: 0.35, crown: [1.75, 0.82, 0.3] },
    { at: 2, side: 1, len: 1.35, rise: 0.08, z: -0.45, crown: [1.35, 0.72, 0.28] },
    { at: 3, side: 1, len: 1.9, rise: 0.2, z: 0.28, crown: [1.85, 0.85, 0.3] },
    { at: 4, side: -1, len: 1.45, rise: 0.28, z: -0.28, crown: [1.5, 0.76, 0.3] },
    { at: 5, side: 1, len: 1.22, rise: 0.34, z: 0.2, crown: [1.3, 0.7, 0.31] },
  ];

  for (let i = 0; i < arms.length; i++) {
    const spec = arms[i];
    const start = trunk[spec.at].clone();
    const side = spec.side * flip;
    const bend = new THREE.Vector3(
      start.x + side * spec.len * 0.48,
      start.y + spec.rise * 0.25 - 0.05,
      start.z + spec.z * 0.45
    );
    const tip = new THREE.Vector3(
      start.x + side * spec.len,
      start.y + spec.rise,
      start.z + spec.z
    );
    const upTip = tip.clone();
    upTip.y += 0.14 + rnd() * 0.12;
    branch([start, bend, tip, upTip], 0.13 - i * 0.011, 0.035);
    const yaw = Math.atan2(spec.z, side * spec.len);
    crown(upTip, spec.crown[0], spec.crown[1], spec.crown[2], yaw, i === 2 ? 1.2 : 1);

  }

  // 顶端分成两束，避免圣诞树式尖顶，形成参考图中的横向“伞盖”。
  const top = trunk[trunk.length - 1];
  for (const side of [-1, 1]) {
    const tip = top.clone().add(new THREE.Vector3(side * 0.52, 0.42 + (side > 0 ? 0.12 : 0), side * 0.12));
    branch([top, top.clone().lerp(tip, 0.52).add(new THREE.Vector3(0, 0.08, 0)), tip], 0.085, 0.03);
    crown(tip, side > 0 ? 1.35 : 1.05, 0.78, 0.34, side * 0.16, 1.05);
  }

  g.rotation.y = (rnd() - 0.5) * 0.55;
  g.scale.setScalar(1.02);
  // 性能：单株 ~130 网格（冠+枝+描边）→ 按材质合并成 ~8 个绘制调用。
  // 全树静态（无逐帧变换/无运行时材质切换），合并后外观逐顶点一致。
  mergeStaticGroup(g);
  g.userData.collideRadius = 0.58;
  g.userData.kind = "gardenPine";
  return g;
}

// =====================================================================
//  港口双株 · 工笔庭院古樟（对照院落双干合生 + 云片伞冠原画）
//  不改庭园 createAncientPineTree
// =====================================================================

/** 原画树干偏灰褐，非巧克力焦糖 */
export const BANYAN_BARK = 0x6a5c4a;
export const BANYAN_BARK_GROOVE = 0x3e362c;
/** 原画三色叶：荫底深松 / 竹青主体 / 迎光嫩黄绿 */
export const BANYAN_CANOPY_DARK = 0x1a3d24;
export const BANYAN_CANOPY = 0x2f7a32;
export const BANYAN_CANOPY_LIGHT = 0x7cb342;
export const BANYAN_DESIGN_HEIGHT = 32;
export const BANYAN_OUTLINE = 0.042;
export const BANYAN_ZONE_FILL = 1.4;

/**
 * 旧港口参天古樟。对照院落工笔原画：
 * 双干合生、纵沟树皮、枝藏冠内、云片伞冠（暗底 / 竹青 / 嫩黄绿）。
 * @param {number|object} [seedOrOpts]
 * @returns {THREE.Group} giantBanyanGroup
 */
export function createColossalVernacularTree(seedOrOpts = {}) {
  const opts = typeof seedOrOpts === "number" ? { seed: seedOrOpts } : seedOrOpts || {};
  const seed = Number.isFinite(opts.seed) ? opts.seed : 8801 + pineSerial++ * 97;
  const merge = opts.merge !== false;
  const prefix = opts.namePrefix || "banyan";
  const rnd = pineRng(seed);
  const n = (s) => `${prefix}-${s}`;

  const bark = toonMat(BANYAN_BARK, { flatShading: true });
  const groove = toonMat(BANYAN_BARK_GROOVE, { flatShading: true });
  const leafDark = toonMat(BANYAN_CANOPY_DARK, { flatShading: true });
  const leafMid = toonMat(BANYAN_CANOPY, { flatShading: true });
  const leafLit = toonMat(BANYAN_CANOPY_LIGHT, { flatShading: true });

  const giantBanyanGroup = new THREE.Group();
  giantBanyanGroup.name = opts.groupName || "giantBanyanGroup";

  const ink = (mesh, outline = BANYAN_OUTLINE) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addOutline(mesh, outline);
    return mesh;
  };

  const yAxis = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  // ------------------------------------------------------------------
  //  合生树基：矮阔根盘，两干从同一坨根里长出来
  // ------------------------------------------------------------------
  const base = ink(
    new THREE.Mesh(new THREE.CylinderGeometry(1.025, 1.275, 2.4, 8, 1, false), bark),
    0.05
  );
  base.name = n("trunk-base");
  base.position.set(0.05, 1.15, 0.05);
  giantBanyanGroup.add(base);

  /**
   * 一柱老干：微锥 + 微倾 + 纵沟（原画树皮竖纹）
   */
  const addColumn = (spec, name) => {
    const col = new THREE.Group();
    col.name = name;
    const shaft = ink(
      new THREE.Mesh(
        new THREE.CylinderGeometry(spec.rTop, spec.rBot, spec.h, 8, 1, false),
        bark
      ),
      0.05
    );
    shaft.name = `${name}-shaft`;
    shaft.position.y = spec.h * 0.5;
    col.add(shaft);
    const ribs = 7;
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * Math.PI * 2 + rnd() * 0.18;
      const r = THREE.MathUtils.lerp(spec.rBot, spec.rTop, 0.45);
      const rib = ink(
        new THREE.Mesh(new THREE.BoxGeometry(0.05, spec.h * 0.78, 0.11), groove),
        0.03
      );
      rib.name = n(`bark-rib-${spec.x.toFixed(1)}-${i}`);
      rib.position.set(Math.cos(a) * r * 0.94, spec.h * 0.46, Math.sin(a) * r * 0.94);
      rib.rotation.y = a;
      col.add(rib);
    }
    col.position.set(spec.x, 0.15, spec.z);
    col.rotation.z = spec.leanZ;
    col.rotation.x = spec.leanX;
    giantBanyanGroup.add(col);
    return col;
  };

  // 原画主体：左干略矮粗、右干略高，后侧一股较细
  addColumn(
    { x: -0.48, z: 0.09, h: 12.4, rTop: 0.51, rBot: 0.74, leanZ: 0.055, leanX: 0.02 },
    n("trunk-0")
  );
  addColumn(
    { x: 0.52, z: -0.11, h: 13.6, rTop: 0.48, rBot: 0.7, leanZ: -0.048, leanX: -0.025 },
    n("trunk-1")
  );
  addColumn(
    { x: 0.06, z: 0.46, h: 11.2, rTop: 0.34, rBot: 0.51, leanZ: 0.02, leanX: 0.07 },
    n("trunk-2")
  );

  // ------------------------------------------------------------------
  //  藏在冠内的骨干：短、粗、斜伸进云片，不外露筷子枝
  // ------------------------------------------------------------------
  const arms = [
    { y: 11.6, yaw: -2.55, tilt: 0.95, len: 5.2, r0: 0.42, r1: 0.22 },
    { y: 12.4, yaw: 0.35, tilt: 0.82, len: 4.6, r0: 0.38, r1: 0.2 },
    { y: 13.2, yaw: 2.2, tilt: 0.88, len: 4.8, r0: 0.36, r1: 0.18 },
    { y: 12.8, yaw: -0.85, tilt: 0.78, len: 4.2, r0: 0.34, r1: 0.16 },
  ];
  for (let i = 0; i < arms.length; i++) {
    const a = arms[i];
    dir.set(
      Math.cos(a.yaw) * Math.sin(a.tilt),
      Math.cos(a.tilt),
      Math.sin(a.yaw) * Math.sin(a.tilt)
    ).normalize();
    const mesh = ink(
      new THREE.Mesh(new THREE.CylinderGeometry(a.r1, a.r0, a.len, 7, 1, false), bark),
      0.04
    );
    mesh.name = n(`branch-${i}`);
    quat.setFromUnitVectors(yAxis, dir);
    mesh.quaternion.copy(quat);
    mesh.position.set(dir.x * 0.35, a.y, dir.z * 0.35).addScaledVector(dir, a.len * 0.42);
    giantBanyanGroup.add(mesh);
  }

  // ------------------------------------------------------------------
  //  工笔云片伞冠：8 团扁云，团内密叠，底暗顶亮
  //  对照原画：左低垂覆屋、中层团块、右上主冠
  // ------------------------------------------------------------------
  const pads = [
    { x: -8.2, y: 14.2, z: 2.6, rx: 6.4, ry: 2.4, rz: 6.2, count: 11 },
    { x: -4.6, y: 16.0, z: -3.4, rx: 5.2, ry: 2.1, rz: 5.6, count: 9 },
    { x: 1.2, y: 15.6, z: 3.2, rx: 5.0, ry: 2.0, rz: 5.4, count: 9 },
    { x: 6.4, y: 16.8, z: -2.4, rx: 4.8, ry: 2.0, rz: 5.2, count: 8 },
    { x: -5.4, y: 20.4, z: 0.8, rx: 6.0, ry: 2.3, rz: 6.0, count: 10 },
    { x: 1.8, y: 22.8, z: -2.0, rx: 7.0, ry: 2.6, rz: 6.8, count: 12 },
    { x: 5.8, y: 24.6, z: 2.2, rx: 4.8, ry: 2.1, rz: 5.4, count: 8 },
    { x: 0.2, y: 27.4, z: -0.6, rx: 5.6, ry: 2.2, rz: 5.8, count: 10 },
  ];

  let crownCount = 0;
  let darkN = 0;
  let midN = 0;
  let lightN = 0;

  for (let p = 0; p < pads.length; p++) {
    const pad = pads[p];
    const padGroup = new THREE.Group();
    padGroup.name = n(`cloud-${p}`);
    padGroup.position.set(pad.x, pad.y, pad.z);
    padGroup.rotation.y = (rnd() - 0.5) * 0.7;
    for (let i = 0; i < pad.count; i++) {
      const u = i / Math.max(1, pad.count - 1);
      const ang = (i / pad.count) * Math.PI * 2 + rnd() * 0.55;
      const rad = Math.sqrt(rnd()) * 0.82;
      const lx = Math.cos(ang) * rad * pad.rx * 0.42;
      const lz = Math.sin(ang) * rad * pad.rz * 0.42;
      // 团内分层：下暗、中青、上嫩绿（原画纵深）
      const vy = (rnd() - 0.35) * pad.ry;
      const band = vy < -0.35 ? "dark" : vy > 0.55 ? "light" : "mid";
      const mat = band === "dark" ? leafDark : band === "light" ? leafLit : leafMid;
      const radius = 1.15 + rnd() * 0.55;
      const mesh = ink(
        new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), mat),
        0.036
      );
      mesh.name = n(`crown-${band}-${crownCount}`);
      mesh.userData.canopyBand = band;
      // 扁云片：左右舒展、上下压薄（消灭矿石球）
      mesh.scale.set(
        1.55 + rnd() * 0.35,
        0.48 + rnd() * 0.16,
        1.5 + rnd() * 0.35
      );
      mesh.position.set(lx, vy + u * 0.15, lz);
      mesh.rotation.set(rnd() * 0.7, rnd() * Math.PI * 2, rnd() * 0.7);
      padGroup.add(mesh);
      crownCount++;
      if (band === "dark") darkN++;
      else if (band === "light") lightN++;
      else midN++;
    }
    giantBanyanGroup.add(padGroup);
  }

  const fill = new THREE.PointLight(0xffffff, BANYAN_ZONE_FILL, 68, 1.7);
  fill.name = n("zone-fill");
  fill.position.set(0, 20, 0);
  giantBanyanGroup.add(fill);
  // K4：古榕树区补光迁入 registry（owner 前缀随 namePrefix，多株各自稳定）
  registerLocalLight(fill, {
    owner: `${prefix}-zone-fill`,
    kind: "point",
    color: 0xffffff,
    intensity: BANYAN_ZONE_FILL,
    radius: 68,
    priority: 3,
  });

  giantBanyanGroup.rotation.y = (rnd() - 0.5) * 0.5;
  if (merge) mergeStaticGroup(giantBanyanGroup);

  giantBanyanGroup.userData.kind = "colossalVernacularTree";
  giantBanyanGroup.userData.assetType = "colossalVernacularTree";
  giantBanyanGroup.userData.style = "gongbi-courtyard-camphor";
  giantBanyanGroup.userData.seed = seed;
  giantBanyanGroup.userData.designHeight = BANYAN_DESIGN_HEIGHT;
  giantBanyanGroup.userData.canopyHeight = BANYAN_DESIGN_HEIGHT;
  giantBanyanGroup.userData.height = BANYAN_DESIGN_HEIGHT;
  giantBanyanGroup.userData.topY = BANYAN_DESIGN_HEIGHT;
  giantBanyanGroup.userData.collideRadius = 3.6;
  giantBanyanGroup.userData.crownCount = crownCount;
  giantBanyanGroup.userData.canopyBands = { dark: darkN, mid: midN, light: lightN };
  giantBanyanGroup.userData.trunkCount = 3;
  giantBanyanGroup.userData.stemLayers = 1;
  giantBanyanGroup.userData.branchCount = arms.length;
  giantBanyanGroup.userData.cloudPads = pads.length;
  giantBanyanGroup.userData.zoneFill = BANYAN_ZONE_FILL;
  giantBanyanGroup.userData.outline = BANYAN_OUTLINE;
  return giantBanyanGroup;
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
