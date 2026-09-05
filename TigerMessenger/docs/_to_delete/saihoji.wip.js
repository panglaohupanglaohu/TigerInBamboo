// =====================================================================
//  西芳寺 · 苔海六景
//  六景聚拢在「苔庭」中枢（与主岛西芳寺缘苔丘同向 lat56/lon-120），
//  2×3 相邻排布、圆盘不重叠；朝圣小路按入口→…→回望顺序串联。
//  每座景区使用确定性构图；随机仅用于石面和苔斑细节。
// =====================================================================
import * as THREE from "three";
import { facet } from "../assets/lowPoly.js";
import { createAncientPineTree } from "../assets/ancient.js";
import { toonMat, addOutline, INK_COLOR } from "../assets/toon.js";
import { mergeStaticGroup } from "./geometryMerge.js";
import { PLANET_RADIUS } from "./planet.js";

const MOSS_COLORS = Object.freeze([0x3e704f, 0x477f58, 0x548c60, 0x5c9767]);
const STONE_COLORS = Object.freeze([0x706b61, 0x625f58, 0x4f514b]);
const SAND_COLOR = 0xc8bea8;
const PATH_COLOR = 0x8e887d;
const HEAVY_INK = 0.022;
/** 苔庭古松整体体积倍率（相对 createAncientPineTree 原尺寸；主人 2026-09-05 ×2） */
export const SAIHOJI_PINE_SIZE = 6;
/** 苔庭古松间距倍率（主人 2026-09-05：树与树之间 ×2）——作用于布局表 x/z */
export const SAIHOJI_PINE_SPREAD = 2;
const _yUp = new THREE.Vector3(0, 1, 0);
const _base = new THREE.Vector3();
const _east = new THREE.Vector3();
const _north = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

/**
 * 苔庭中枢（与 messengerIsland 西芳寺缘苔丘锚点一致）。
 * 六景在此局部东-北平面 2×3 密铺：
 *   回望石组 ── 空庭 ── 苔海岛群   (北排)
 *   入口苔径 ── 主石之庭 ── 枯瀑之庭 (南排 · 游线起)
 * 圆心距 ≥ rᵢ+rⱼ+1.25m，保证相邻不重叠。
 */
export const SAIHOJI_HUB = Object.freeze({ lat: 56, lon: -120 });

/** 固定的“苔海六景”：半径为各景区需要留出的球面距离（世界单位）。 */
export const SAIHOJI_ZONES = Object.freeze([
  // 2×3 密铺于苔庭中枢；圆心距按球面弧长 ≥ rᵢ+rⱼ+1.25m
  // 南排（游线起）：入口 → 主石 → 枯瀑
  {
    id: "moss-entry",
    name: "入口苔径",
    lat: 56.0,
    lon: -120.0,
    radius: 5.5,
    heading: 1.571,
    path: [-0.2, -2.4],
  },
  {
    id: "master-stones",
    name: "主石之庭",
    lat: 55.5136,
    lon: -130.9127,
    radius: 7.5,
    heading: 1.571,
    path: [-3.6, -1.8],
  },
  {
    id: "dry-cascade",
    name: "枯瀑之庭",
    lat: 53.9805,
    lon: -141.9182,
    radius: 7.0,
    heading: 0.0,
    path: [3.35, 0.2],
  },
  // 北排：苔海 → 空庭 → 回望
  {
    id: "moss-islands",
    name: "苔海岛群",
    lat: 59.8020,
    lon: -145.7141,
    radius: 8.5,
    heading: -1.571,
    path: [0.2, 4.1],
  },
  {
    id: "empty-court",
    name: "空庭",
    lat: 61.7147,
    lon: -132.9937,
    radius: 9.0,
    heading: -1.571,
    path: [-3.2, -1.7],
  },
  {
    id: "return-view",
    name: "回望石组",
    lat: 62.3304,
    lon: -120.0,
    radius: 7.0,
    heading: Math.PI,
    path: [0.1, -3.35],
  },
]);

/** 六景之间最小净空（米）；打包时圆心距 ≥ rᵢ+rⱼ+此值 */
export const SAIHOJI_MIN_DISTANCE = 1.25;

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function latLonToGardenDir(latDeg, lonDeg, out = new THREE.Vector3()) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return out.set(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  );
}

/** 兼容旧调试接口：Phi/Theta → 球面方向。 */
export function phiThetaToDir(phi, theta, out = new THREE.Vector3()) {
  const sp = Math.sin(phi);
  return out.set(sp * Math.cos(theta), Math.cos(phi), sp * Math.sin(theta));
}

/** 兼容旧调试接口：把对象以 Phi/Theta 贴到球面。 */
export function placeByPhiTheta(obj, phi, theta, radius = PLANET_RADIUS, lift = 0) {
  phiThetaToDir(phi, theta, _dir);
  return placeOnDirection(obj, _dir, radius, lift);
}

function placeOnDirection(obj, direction, radius, lift = 0, yaw = 0) {
  _dir.copy(direction).normalize();
  obj.position.copy(_dir).multiplyScalar(radius + lift);
  _quat.setFromUnitVectors(_yUp, _dir);
  obj.quaternion.copy(_quat);
  if (yaw) obj.rotateY(yaw);
  return obj;
}

/**
 * 景区局部米制坐标 → 球面位置。
 * x 为东西向、z 为南北向；归一化投影保证每个物件都真正贴球面。
 */
function directionAtLocal(zone, x, z, radius, out = new THREE.Vector3()) {
  latLonToGardenDir(zone.lat, zone.lon, _base);
  _east.crossVectors(_yUp, _base).normalize();
  _north.crossVectors(_base, _east).normalize();
  return out
    .copy(_base)
    .addScaledVector(_east, x / radius)
    .addScaledVector(_north, z / radius)
    .normalize();
}

function placeAtLocal(obj, zone, x, z, radius, lift = 0, yaw = 0) {
  directionAtLocal(zone, x, z, radius, _dir);
  return placeOnDirection(obj, _dir, radius, lift, zone.heading + yaw);
}

function angularDistanceMeters(aLat, aLon, bLat, bLon, radius = PLANET_RADIUS) {
  const a = latLonToGardenDir(aLat, aLon, new THREE.Vector3());
  const b = latLonToGardenDir(bLat, bLon, new THREE.Vector3());
  return a.angleTo(b) * radius;
}

/** 给其他随机场景使用：命中六景预留区时必须重新采样。 */
export function isInsideSaihojiReserve(lat, lon, padding = 1.5) {
  return SAIHOJI_ZONES.some(
    (zone) => angularDistanceMeters(lat, lon, zone.lat, zone.lon) < zone.radius + padding
  );
}

function pushCollider(colliders, obj, radiusOverride) {
  const radius = radiusOverride ?? obj.userData.collideRadius ?? 0;
  if (radius < 0.15) return;
  colliders.push({ position: obj.position.clone(), radius });
}

function makeIrregularPatch(rnd, rx, rz, color, segments = 12) {
  const vertices = [0, 0.015, 0];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const jitter = 0.82 + rnd() * 0.3;
    vertices.push(
      Math.cos(a) * rx * jitter,
      0.005 + rnd() * 0.022,
      Math.sin(a) * rz * jitter
    );
  }
  for (let i = 0; i < segments; i++) {
    indices.push(0, i + 1, ((i + 1) % segments) + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, toonMat(color, { side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  mesh.userData.kind = color === SAND_COLOR ? "drySand" : "mossPatch";
  mesh.userData.collideRadius = 0;
  return mesh;
}

function createGardenStone(style, height, rnd, colorIndex = 0) {
  const geometry = new THREE.IcosahedronGeometry(0.5, 1);
  const pos = geometry.attributes.position;
  const cache = new Map();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    if (!cache.has(key)) cache.set(key, 0.78 + rnd() * 0.42);
    v.multiplyScalar(cache.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  const proportions = {
    standing: [0.62, 1.0, 0.58],
    attendant: [0.78, 0.72, 0.68],
    reclining: [1.3, 0.42, 0.78],
    bridge: [1.6, 0.28, 0.56],
    cascade: [1.0, 0.5, 0.86],
    seat: [1.35, 0.3, 1.0],
  }[style] || [0.8, 0.7, 0.7];

  const mesh = new THREE.Mesh(
    facet(geometry),
    toonMat(STONE_COLORS[colorIndex % STONE_COLORS.length])
  );
  mesh.scale.set(proportions[0] * height, proportions[1] * height, proportions[2] * height);
  mesh.position.y = proportions[1] * height * 0.48;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, HEAVY_INK, INK_COLOR, 0.045);

  const group = new THREE.Group();
  group.add(mesh);
  group.userData.kind = `gardenStone:${style}`;
  group.userData.collideRadius = Math.max(proportions[0], proportions[2]) * height * 0.46;
  return group;
}

function createStoneStep(rnd, scale = 1) {
  const mesh = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.42, 0.48, 0.1, 7)),
    toonMat(PATH_COLOR)
  );
  mesh.scale.set(scale * (0.82 + rnd() * 0.24), 1, scale * (0.68 + rnd() * 0.22));
  mesh.position.y = 0.05;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh, 0.009, INK_COLOR, 0.035);
  const group = new THREE.Group();
  group.add(mesh);
  group.userData.kind = "stoneStep";
  group.userData.collideRadius = 0;
  return group;
}

const STONE_LAYOUTS = Object.freeze({
  "moss-entry": [
    { x: -2.7, z: -0.8, style: "standing", h: 1.45, yaw: 0.15 },
    { x: 2.45, z: 1.0, style: "attendant", h: 1.25, yaw: -0.35 },
  ],
  "master-stones": [
    { x: 0, z: 0.2, style: "standing", h: 3.0, yaw: -0.15 },
    { x: -1.65, z: -0.55, style: "attendant", h: 1.7, yaw: 0.42 },
    { x: 1.45, z: 0.75, style: "reclining", h: 1.5, yaw: -0.3 },
    { x: -0.35, z: 2.0, style: "attendant", h: 1.2, yaw: 0.1 },
    { x: 2.65, z: -1.25, style: "reclining", h: 0.95, yaw: 0.55 },
  ],
  "dry-cascade": [
    { x: -0.15, z: 3.0, style: "standing", h: 2.15, yaw: 0.05, lift: 0.2 },
    { x: -0.75, z: 1.55, style: "cascade", h: 1.35, yaw: -0.2, lift: 0.14 },
    { x: 0.5, z: 0.15, style: "cascade", h: 1.25, yaw: 0.28, lift: 0.09 },
    { x: -0.25, z: -1.35, style: "bridge", h: 1.15, yaw: -0.1, lift: 0.04 },
    { x: 1.15, z: -2.65, style: "reclining", h: 1.05, yaw: 0.45 },
  ],
  "moss-islands": [
    { x: -3.2, z: 1.2, style: "standing", h: 1.8, yaw: -0.2 },
    { x: -2.1, z: 0.35, style: "attendant", h: 1.15, yaw: 0.35 },
    { x: -3.65, z: -0.45, style: "reclining", h: 0.9, yaw: -0.5 },
    { x: 0.25, z: -1.4, style: "standing", h: 2.2, yaw: 0.18 },
    { x: 1.35, z: -0.65, style: "attendant", h: 1.25, yaw: -0.4 },
    { x: -0.65, z: -2.45, style: "reclining", h: 0.95, yaw: 0.28 },
    { x: 3.25, z: 1.8, style: "standing", h: 1.45, yaw: -0.12 },
    { x: 4.1, z: 0.9, style: "attendant", h: 1.0, yaw: 0.5 },
    { x: 2.55, z: 0.35, style: "bridge", h: 0.9, yaw: -0.35 },
  ],
  "empty-court": [
    { x: 0.7, z: 0.4, style: "seat", h: 1.0, yaw: -0.18 },
  ],
  "return-view": [
    { x: -2.8, z: 0.8, style: "reclining", h: 1.25, yaw: 0.3 },
    { x: -1.25, z: -0.2, style: "attendant", h: 1.55, yaw: -0.2 },
    { x: 0.25, z: 0.25, style: "standing", h: 2.2, yaw: 0.1 },
    { x: 1.75, z: -0.5, style: "attendant", h: 1.35, yaw: 0.4 },
    { x: 3.0, z: 0.65, style: "reclining", h: 1.0, yaw: -0.45 },
  ],
});

/**
 * 西芳寺古松构图（作庭记 / 梦窗疏石 · 聚散有致）
 *
 * 原则（非均匀环植）：
 *  - 奇数组景：1 / 3 / 5；主木–副木–添木（大–中–小）
 *  - 聚：紧簇成「岛」「屏」；散：单株点景、计白当黑
 *  - 高低胖瘦：scale 0.58–1.32（幼松→老干），忌一刀齐
 *  - 错落：间距参差、不对称；yaw 让树干斜势朝向景心或互成对景
 *  - 抬根：lift 0.06–0.12，根盘坐在苔面之上，避免埋进苔毯
 *  - 让路：石组中轴、砂带、游线正中不植；空庭极简
 *
 * role: master | secondary | companion | solitary
 */
const PINE_LAYOUTS = Object.freeze({
  // —— 入口苔径：门前对景 1+1，小径侧添一幼松；前庭留白 ——
  "moss-entry": [
    // 门左主松（略高、斜向内迎客）
    { x: -3.55, z: 1.15, scale: 1.18, yaw: 0.95, lift: 0.09, seed: 811, role: "master" },
    // 门右副松（略矮、反向呼应，非对称）
    { x: 3.15, z: 0.55, scale: 0.88, yaw: -1.25, lift: 0.08, seed: 820, role: "secondary" },
    // 径侧添木（幼、贴边，不挡踏步）
    { x: -2.05, z: -2.85, scale: 0.62, yaw: 0.4, lift: 0.07, seed: 829, role: "companion" },
  ],

  // —— 主石之庭：西北聚三（主屏），东南散一，北缘远一 ——
  "master-stones": [
    // 聚 · 主屏三株（主石西侧，成林遮映，非环绕）
    { x: -4.85, z: 1.65, scale: 1.28, yaw: 0.72, lift: 0.1, seed: 5566, role: "master" },
    { x: -3.55, z: 2.85, scale: 0.92, yaw: 1.35, lift: 0.08, seed: 1229, role: "secondary" },
    { x: -5.35, z: 0.15, scale: 0.68, yaw: 0.2, lift: 0.07, seed: 1238, role: "companion" },
    // 散 · 东南远点（与主屏对角，拉开纵深）
    { x: 5.05, z: -2.55, scale: 1.05, yaw: -2.1, lift: 0.09, seed: 1247, role: "solitary" },
    // 散 · 北缘矮松（远景层次，不压主石）
    { x: 1.85, z: 5.35, scale: 0.58, yaw: -0.55, lift: 0.07, seed: 1256, role: "companion" },
  ],

  // —— 枯瀑之庭：瀑两侧夹峙（非围环）；下游散一 ——
  "dry-cascade": [
    // 瀑顶左 · 老干（高）
    { x: -3.95, z: 3.55, scale: 1.22, yaw: 0.55, lift: 0.11, seed: 1401, role: "master" },
    // 瀑顶右 · 副（中，距主略远、高度差）
    { x: 3.45, z: 2.85, scale: 0.86, yaw: -0.85, lift: 0.09, seed: 1410, role: "secondary" },
    // 瀑腰左下 · 添（矮，贴岸）
    { x: -4.55, z: 0.65, scale: 0.64, yaw: 1.1, lift: 0.08, seed: 1419, role: "companion" },
    // 下游散 · 单株点景（砂带外，回望枯流）
    { x: 4.15, z: -3.35, scale: 0.95, yaw: -2.4, lift: 0.08, seed: 1428, role: "solitary" },
  ],

  // —— 苔海岛群：随三组石岛各配「岛松」；聚散随岛，忌等距 ——
  "moss-islands": [
    // 西岛聚三（主岛锚点 · 主副添）
    { x: -5.35, z: 0.85, scale: 1.2, yaw: 0.35, lift: 0.1, seed: 1997, role: "master" },
    { x: -4.15, z: 2.15, scale: 0.78, yaw: 1.55, lift: 0.08, seed: 2153, role: "secondary" },
    { x: -6.05, z: -0.65, scale: 0.6, yaw: -0.4, lift: 0.07, seed: 2162, role: "companion" },
    // 南岛单株（散 · 与西岛对角）
    { x: 0.95, z: -4.85, scale: 1.08, yaw: 2.65, lift: 0.09, seed: 2171, role: "solitary" },
    // 东岛双株（一小一大，非对称）
    { x: 5.55, z: 2.45, scale: 0.98, yaw: -1.15, lift: 0.09, seed: 2180, role: "secondary" },
    { x: 4.35, z: 3.65, scale: 0.58, yaw: 0.85, lift: 0.07, seed: 2189, role: "companion" },
  ],

  // —— 空庭：极简 · 仅远角两株遥相呼应，中心大留白 ——
  "empty-court": [
    { x: -6.25, z: 3.45, scale: 1.12, yaw: 0.65, lift: 0.09, seed: 3011, role: "solitary" },
    { x: 5.85, z: -4.15, scale: 0.72, yaw: -2.05, lift: 0.08, seed: 3020, role: "companion" },
  ],

  // —— 回望石组：背后聚三成屏，前景两侧散点，正面留观景口 ——
  "return-view": [
    // 北缘聚屏（主副添 · 回望时的背景林）
    { x: -1.15, z: 4.65, scale: 1.32, yaw: 3.0, lift: 0.1, seed: 4101, role: "master" },
    { x: -2.85, z: 3.55, scale: 0.9, yaw: 2.55, lift: 0.08, seed: 4110, role: "secondary" },
    { x: 0.95, z: 4.15, scale: 0.66, yaw: -2.85, lift: 0.07, seed: 4119, role: "companion" },
    // 西翼散
    { x: -4.65, z: -1.55, scale: 0.82, yaw: 1.15, lift: 0.08, seed: 4128, role: "solitary" },
    // 东翼散（更矮，错落）
    { x: 4.45, z: -0.85, scale: 0.6, yaw: -1.45, lift: 0.07, seed: 4137, role: "companion" },
  ],
});

function addZoneMoss(root, zone, count, radius, rnd) {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 10) {
    attempts++;
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * zone.radius * 0.88;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const rx = 0.48 + rnd() * 0.52;
    const rz = 0.45 + rnd() * 0.5;
    const patch = makeIrregularPatch(
      rnd,
      rx,
      rz,
      MOSS_COLORS[(rnd() * MOSS_COLORS.length) | 0],
      12
    );
    placeAtLocal(patch, zone, x, z, radius, 0.025, rnd() * Math.PI);
    root.add(patch);
    placed++;
  }
  return placed;
}

function addDryCascadeSand(root, zone, radius, rnd) {
  const ribbon = [
    { x: 0.2, z: 2.5, rx: 1.15, rz: 1.35 },
    { x: -0.15, z: 0.65, rx: 1.35, rz: 1.4 },
    { x: 0.35, z: -1.25, rx: 1.5, rz: 1.3 },
    { x: 0.8, z: -2.85, rx: 1.7, rz: 1.0 },
  ];
  for (const p of ribbon) {
    const sand = makeIrregularPatch(rnd, p.rx, p.rz, SAND_COLOR, 12);
    placeAtLocal(sand, zone, p.x, p.z, radius, 0.045, -0.08);
    root.add(sand);
  }
}

/** 石底苔裙：双圈极扁苔斑，模糊石地交界（六景统一） */
function addStoneMossSkirt(root, zone, cx, cz, radius, rnd, ringR = 0.9) {
  const colors = MOSS_COLORS;
  for (const ring of [
    { r: ringR, n: 8 },
    { r: ringR * 0.55, n: 5 },
  ]) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + rnd() * 0.25;
      const d = ring.r * (0.75 + rnd() * 0.35);
      const patch = makeIrregularPatch(
        rnd,
        0.28 + rnd() * 0.22,
        0.22 + rnd() * 0.16,
        colors[(rnd() * colors.length) | 0],
        10
      );
      placeAtLocal(
        patch,
        zone,
        cx + Math.cos(a) * d,
        cz + Math.sin(a) * d,
        radius,
        0.02 + rnd() * 0.015,
        rnd() * Math.PI
      );
      root.add(patch);
    }
  }
}

/** 主石脚嵌小石：垂直层叠（基座 → 中垫 → 主体） */
function addNestedFooting(root, zone, spec, radius, rnd) {
  const tiers = [
    { dx: -0.35, dz: 0.2, h: spec.h * 0.28, style: "attendant" },
    { dx: 0.4, dz: -0.15, h: spec.h * 0.22, style: "reclining" },
  ];
  for (const t of tiers) {
    const foot = createGardenStone(t.style, Math.max(0.45, t.h), rnd, 3);
    placeAtLocal(
      foot,
      zone,
      spec.x + t.dx,
      spec.z + t.dz,
      radius,
      (spec.lift ?? 0) * 0.4,
      (spec.yaw ?? 0) + (rnd() - 0.5) * 0.4
    );
    root.add(foot);
  }
}

/** 枯瀑阶梯唇：浅蓝薄块沿石组落差排列 */
function addDryCascadeTiers(root, zone, radius, rnd) {
  const waterMat = toonMat(0x9fd8e8, {
    transparent: true,
    opacity: 0.82,
    emissive: 0x2a5a68,
    emissiveIntensity: 0.22,
  });
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const lip = new THREE.Mesh(
      facet(new THREE.BoxGeometry(0.55 - t * 0.12, 0.045, 0.7 - t * 0.08)),
      waterMat
    );
    const g = new THREE.Group();
    g.add(lip);
    placeAtLocal(g, zone, -0.1 + t * 0.15, 2.4 - i * 1.05, radius, 0.12 + (1 - t) * 0.35, -0.1);
    root.add(g);
  }
  void rnd;
}

function slerpDirection(a, b, t, out = new THREE.Vector3()) {
  const omega = a.angleTo(b);
  if (omega < 1e-5) return out.copy(a);
  const sinOmega = Math.sin(omega);
  return out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * omega) / sinOmega)
    .addScaledVector(b, Math.sin(t * omega) / sinOmega)
    .normalize();
}

function addPilgrimagePath(root, radius, rnd) {
  const directions = SAIHOJI_ZONES.map((zone) =>
    directionAtLocal(zone, zone.path?.[0] ?? 0, zone.path?.[1] ?? 0, radius, new THREE.Vector3())
  );
  const route = [];
  for (let segment = 0; segment < directions.length - 1; segment++) {
    const a = directions[segment];
    const b = directions[segment + 1];
    const arcLength = a.angleTo(b) * radius;
    const steps = Math.max(8, Math.floor(arcLength / 1.35));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const dir = slerpDirection(a, b, t, new THREE.Vector3());
      const step = createStoneStep(rnd, i % 3 === 0 ? 0.86 : 1);
      placeOnDirection(step, dir, radius, 0.04, (rnd() - 0.5) * 0.35);
      root.add(step);
      route.push(step);
    }
  }
  return route;
}

/**
 * 在二次元球形世界中建立“苔海六景”。
 * @returns {{group:THREE.Group,colliders:object[],landmarks:object,placed:THREE.Vector3[],mossCount:number}}
 */
export function buildSaihojiPlanet(scene, opts = {}) {
  const radius = opts.radius ?? PLANET_RADIUS;
  const rnd = lcg(opts.seed ?? 884);
  const mossTarget = Math.max(72, opts.mossCount ?? 132);
  void opts.rockCount; // 保留旧调用兼容；六景石组数量由构图固定。

  const root = new THREE.Group();
  root.name = "SaihojiSixScenes";
  const colliders = [];
  const placed = [];
  const zones = {};
  let mossCount = 0;

  if (opts.planet?.isMesh) paintPlanetMossSea(opts.planet);

  const totalArea = SAIHOJI_ZONES.reduce((sum, zone) => sum + zone.radius * zone.radius, 0);
  for (let zi = 0; zi < SAIHOJI_ZONES.length; zi++) {
    const zone = SAIHOJI_ZONES[zi];
    const group = new THREE.Group();
    group.name = `Saihoji:${zone.name}`;
    root.add(group);
    zones[zone.id] = {
      definition: zone,
      group,
      stones: [],
      pines: [],
      pathDirection: directionAtLocal(
        zone,
        zone.path?.[0] ?? 0,
        zone.path?.[1] ?? 0,
        radius,
        new THREE.Vector3()
      ),
    };

    const share = (zone.radius * zone.radius) / totalArea;
    const count = Math.max(10, Math.round(mossTarget * share));
    mossCount += addZoneMoss(group, zone, count, radius, rnd);
    if (zone.id === "dry-cascade") addDryCascadeSand(group, zone, radius, rnd);

    const stones = STONE_LAYOUTS[zone.id] || [];
    for (let i = 0; i < stones.length; i++) {
      const spec = stones[i];
      const stone = createGardenStone(spec.style, spec.h, rnd, zi + i);
      placeAtLocal(stone, zone, spec.x, spec.z, radius, spec.lift ?? 0, spec.yaw ?? 0);
      group.add(stone);
      zones[zone.id].stones.push(stone);
      placed.push(stone.position.clone());
      pushCollider(colliders, stone);
      // 垂直层叠语言：石底苔裙 + 主石脚嵌小石（与起始庭园洪隐山一致）
      addStoneMossSkirt(group, zone, spec.x, spec.z, radius, rnd, 0.55 + spec.h * 0.22);
      if (spec.style === "standing" || spec.style === "cascade") {
        addNestedFooting(group, zone, spec, radius, rnd);
      }
    }

    // 古松：聚散组景 · 高低胖瘦 · 抬根出苔（见 PINE_LAYOUTS）
    const pines = PINE_LAYOUTS[zone.id] || [];
    for (const spec of pines) {
      const sc = Number.isFinite(spec.scale) ? spec.scale : 1;
      const pine = createAncientPineTree(spec.seed);
      const visual = sc * SAIHOJI_PINE_SIZE;
      pine.scale.multiplyScalar(visual);
      // lift：根盘明显坐于苔面之上——苔庭（苔斑 + 苔丘地形）略高于球面，
      // 松树抬根不足会被埋（用户反馈），默认抬根 0.22；体积×3 后再略抬，
      // 免得放大后的根盘重新埋进苔裙。
      const lift =
        (Number.isFinite(spec.lift) ? spec.lift : 0.08) +
        0.14 +
        0.06 * Math.max(0, SAIHOJI_PINE_SIZE - 1);
      // 间距 ×2（SAIHOJI_PINE_SPREAD）：树与树之间距离翻倍
      placeAtLocal(pine, zone, spec.x * SAIHOJI_PINE_SPREAD, spec.z * SAIHOJI_PINE_SPREAD, radius, lift, spec.yaw ?? 0);
      pine.userData.pineRole = spec.role || "solitary";
      pine.userData.pineScale = sc;
      pine.userData.pineSize = SAIHOJI_PINE_SIZE;
      group.add(pine);
      zones[zone.id].pines.push(pine);
      placed.push(pine.position.clone());
      const cr = (pine.userData.collideRadius ?? 0.58) * visual * 1.15;
      pushCollider(colliders, pine, Math.max(0.45, cr));
      // 根际苔裙略小于树冠投影，不把树干埋进厚苔（跟随间距倍率）
      addStoneMossSkirt(group, zone, spec.x * SAIHOJI_PINE_SPREAD, spec.z * SAIHOJI_PINE_SPREAD, radius, rnd, 0.55 * visual);
    }

    if (zone.id === "moss-entry") {
      for (let i = 0; i < 7; i++) {
        const step = createStoneStep(rnd, 0.95);
        placeAtLocal(step, zone, -1.7 + i * 0.58, -2.8 + i * 0.75, radius, 0.04, i * 0.08);
        group.add(step);
      }
    }

    // 枯瀑之庭：补阶梯式浅蓝跌水唇（垂直层叠）
    if (zone.id === "dry-cascade") {
      addDryCascadeTiers(group, zone, radius, rnd);
    }
  }

  const route = addPilgrimagePath(root, radius, rnd);
  scene.add(root);

  // 性能：每景 ~130 片苔藓/苔裙（makeIrregularPatch 直接子网格）→
  // 按材质合并成每区 ~6 个绘制调用。石头/松树是嵌套组（含碰撞与
  // 地标引用），保持原样不合并；苔藓无拾取/无运行时切换，安全。
  for (const zone of Object.values(zones)) {
    mergeStaticGroup(zone.group, {
      skip: (mesh) => mesh.parent !== zone.group,
    });
  }

  return {
    group: root,
    colliders,
    landmarks: { zones, route, reservedCaps: SAIHOJI_ZONES },
    placed,
    mossCount,
  };
}

/** 整颗星球保持苔海基底；用宽色阶制造截图参考中的青绿卡通块面。 */
export function paintPlanetMossSea(planetMesh) {
  const geometry = planetMesh.geometry;
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(0x315b43);
  const mid = new THREE.Color(0x4d9b69);
  const light = new THREE.Color(0x58aa72);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const band = Math.sin(x * 0.13 + z * 0.09) * 0.5 + 0.5;
    color.copy(dark).lerp(mid, 0.38 + band * 0.38);
    if (y > 8) color.lerp(light, Math.min(0.25, (y - 8) / 100));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  planetMesh.material = toonMat(0xffffff, { vertexColors: true });
  planetMesh.material.needsUpdate = true;
}

/** 旧名称保留给外部调试脚本，但不再把南半球刷成白砂。 */
export function paintPlanetHemispheres(planetMesh) {
  paintPlanetMossSea(planetMesh);
}
