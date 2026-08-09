// =====================================================================
//  莫比斯水晶异星大都会（南半球 · 史诗级重构）
//  - InstancedMesh 三倍巨型晶体群（4/5/6 段三桶，合并 Draw Call）
//  - 3 座三倍中央母皇塔做地平线风暴中心
//  - 三倍占地疏散布局，同时给 8 字高架留出完整净空
//  - 根部金黄能量海（万家灯火，冷暖对冲）
//  - 实例化水墨描边（BackSide 法线外扩，共用实例矩阵）
//  - 每座建筑落在绿色丘垫上：按基座足迹取峡谷阶地最高面，避免被邻阶山壁掩埋
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { createDetailedMoebiusTower } from "../assets/moebiusTower.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";
import { CANYON, canyonOffsetDir } from "./canyon.js";
import {
  cityLocalToDir,
  dirToCityLocal,
  generateHighRidgeLayout,
  loadCrystalLayoutFromStorage,
  normalizeCrystalLayout,
} from "./crystalCityLayout.js";

const GOLD = 0xffd700; // 能量海金
const GRASS = 0x55875f; // 绿色丘垫 · 草绿
const SOIL = 0x7a6b48; // 绿色丘垫 · 土褐坡脚
const CITY_ENTRY_DROP = CANYON.depth / CANYON.steps;
const CITY_APPROACH_DISTANCE_MULTIPLIER = 5;
const CITY_BUILDING_SCALE = 3;
/** 普通晶塔：底面相对绿色山丘顶面的净空。 */
const BUILDING_SURFACE_CLEARANCE = 0.15;
/** 花厅塔（母皇/金鳞）：更大净空，塔脚必须明显露在丘顶台面之上。 */
const HALL_SURFACE_CLEARANCE = 0.55;
/** 绿色山丘相对建筑底径的高度比例；上限压低，禁止高柱把塔身包埋。 */
const GREEN_HILL_HEIGHT_RATIO = 0.3;
const GREEN_HILL_HEIGHT_MIN = 1.0;
const GREEN_HILL_HEIGHT_MAX = 2.8;
/** 花厅塔专用丘：略高一点，丘顶做平台托住花厅塔基。 */
const HALL_HILL_HEIGHT_RATIO = 0.38;
const HALL_HILL_HEIGHT_MIN = 1.6;
const HALL_HILL_HEIGHT_MAX = 3.6;
/** 丘脚略咬入阶地，避免与峡谷面留缝。 */
const GREEN_HILL_EMBED = 0.45;
// 原城市只占峡谷第五级以内；线性半径扩大 3 倍，而非把楼继续挤在谷心。
const ORIGINAL_CITY_RADIUS =
  CANYON.rim * (1 - CITY_APPROACH_DISTANCE_MULTIPLIER / CANYON.steps);
export const CITY_FOOTPRINT_RADIUS = Math.min(
  CANYON.rim - 0.08,
  ORIGINAL_CITY_RADIUS * 3
);

/**
 * 玻璃材质（性能修复版）：原 transmission 0.92 物理透射会触发
 * three.js 每帧「全场景二次渲染到透射缓冲」，直视水晶城时帧率
 * 46.9 → 10.8 fps（最坏帧 475ms 卡死）。改为透明 + clearcoat 高光 +
 * 自发光的手绘风玻璃，观感接近、成本只剩一次正向渲染。
 */
function crystalPhysical(color = 0xd6eaf8, emissive = 0x1f3a4b) {
  return new THREE.MeshPhysicalMaterial({
    transmission: 0,
    opacity: 0.7,
    transparent: true,
    roughness: 0.06,
    metalness: 0.0,
    color: new THREE.Color(color),
    emissive: new THREE.Color(emissive),
    emissiveIntensity: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    flatShading: true,
    depthWrite: false,
  });
}

/** 中央母体晶皇塔（电车绕行地标 + 能量束目标） */
export const GRAND_CRYSTAL = Object.freeze({
  lat: -24,
  lon: CANYON.lon,
  h: 29.05 * CITY_BUILDING_SCALE,
  r: 2.2 * CITY_BUILDING_SCALE,
});

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 实例化描边材质（BackSide + 法线外扩，唐伯虎笔意墨线） */
function outlineMatInstanced(thickness) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x211e19,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
\tfloat tmHash = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
\ttransformed += normal * (${thickness.toFixed(4)} * (0.6 + 0.8 * tmHash));`
    );
  };
  return mat;
}

const _footEast = new THREE.Vector3();
const _footNorth = new THREE.Vector3();
const _footDir = new THREE.Vector3();

/**
 * 建筑圆盘足迹下的峡谷地表范围。
 * 峡谷是离散阶梯：足迹边缘常踩在更高一阶上，若只按中心落点会把塔身埋进邻阶山壁。
 * @returns {{ minS: number, maxS: number, centerS: number }}
 */
export function footprintSurfaceRange(dir, radiusWorld, R, samples = 16) {
  _footEast.crossVectors(new THREE.Vector3(0, 1, 0), dir);
  if (_footEast.lengthSq() < 1e-8) _footEast.set(1, 0, 0);
  _footEast.normalize();
  _footNorth.crossVectors(dir, _footEast).normalize();

  const centerS = R + canyonOffsetDir(dir);
  let minS = centerS;
  let maxS = centerS;
  // 用足迹中心附近地表半径换算角距，避免深谷处用裸 R 低估跨阶宽度。
  const surfR = Math.max(24, Math.abs(centerS));
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    for (const frac of [0.55, 1.0, 1.12]) {
      const ang = (radiusWorld * frac) / surfR;
      _footDir
        .copy(dir)
        .addScaledVector(_footEast, Math.cos(a) * ang)
        .addScaledVector(_footNorth, Math.sin(a) * ang)
        .normalize();
      const s = R + canyonOffsetDir(_footDir);
      if (s < minS) minS = s;
      if (s > maxS) maxS = s;
    }
  }
  return { minS, maxS, centerS };
}

/**
 * 建筑落地高程：
 *  1) 足迹内最高峡谷阶地 = 绿色山丘的「地基」
 *  2) 其上起一座矮绿丘，建筑底落在丘顶面之上
 *  不得把建筑埋进绿丘，也不得埋进邻阶山壁。
 *
 * @param {{ hall?: boolean, meshBottomLocal?: number }} [opts]
 *   hall: 花厅塔（母皇/金鳞）用更大净空与丘高
 *   meshBottomLocal: 缩放后网格最低点（通常 ≤0）；用于把真实塔脚抬到丘顶之上
 */
export function buildingPlacementOnTerrain(dir, radiusWorld, R, opts = {}) {
  const hall = !!opts.hall;
  const { minS, maxS, centerS } = footprintSurfaceRange(dir, radiusWorld, R);
  const hillHeight = THREE.MathUtils.clamp(
    radiusWorld * (hall ? HALL_HILL_HEIGHT_RATIO : GREEN_HILL_HEIGHT_RATIO),
    hall ? HALL_HILL_HEIGHT_MIN : GREEN_HILL_HEIGHT_MIN,
    hall ? HALL_HILL_HEIGHT_MAX : GREEN_HILL_HEIGHT_MAX
  );
  // 丘脚落在足迹最高阶地，邻阶墙不会再压住绿丘/塔脚
  const hillBase = maxS;
  const hillCrest = hillBase + hillHeight;
  const clearance = hall ? HALL_SURFACE_CLEARANCE : BUILDING_SURFACE_CLEARANCE;
  // 真实网格底 = root + meshBottomLocal；令其 = hillCrest + clearance
  const meshBottomLocal = Number.isFinite(opts.meshBottomLocal) ? opts.meshBottomLocal : 0;
  const root = hillCrest + clearance - meshBottomLocal;
  const padHeight = hillHeight + GREEN_HILL_EMBED;
  return {
    root,
    minS,
    maxS,
    centerS,
    hillBase,
    hillHeight,
    hillCrest,
    padHeight,
    clearance,
    hall,
  };
}

/**
 * 绿色山丘：上半球草丘，底圆在 y=0、丘顶在 y=meshHeight。
 * meshHeight = hillHeight + embed；放置后丘顶对齐 hillCrest，建筑在其上方。
 */
function buildGreenHillPad(radiusWorld, meshHeight, seed = 1) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };

  const pad = new THREE.Group();
  pad.name = "moebius-green-hill-pad";

  // 上半球：phi 0→π/2 时 y∈[0,1]；压成缓丘
  const geo = facet(
    new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)
  );
  const footR = radiusWorld * 1.38;
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = Math.max(0, v.y);
    const radial = Math.hypot(v.x, v.z) || 1e-6;
    const flare = 1 + (1 - h) * 0.12;
    v.x = (v.x / radial) * radial * flare;
    v.z = (v.z / radial) * radial * flare;
    const j = 0.96 + rnd() * 0.08;
    v.x *= footR * j;
    v.y *= meshHeight;
    v.z *= footR * j;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const grass = new THREE.Color(GRASS);
  const soil = new THREE.Color(SOIL);
  const c = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = 1 - THREE.MathUtils.clamp(pos.getY(i) / Math.max(1e-3, meshHeight), 0, 1);
    c.copy(grass).lerp(soil, t * t * 0.88);
    const g = 0.94 + rnd() * 0.1;
    colors[i * 3] = Math.min(1, c.r * g);
    colors[i * 3 + 1] = Math.min(1, c.g * g);
    colors[i * 3 + 2] = Math.min(1, c.b * g);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mound = new THREE.Mesh(
    geo,
    toonMat(0xffffff, { vertexColors: true, flatShading: true })
  );
  mound.name = "moebius-green-hill-body";
  mound.castShadow = true;
  mound.receiveShadow = true;
  mound.position.y = 0;
  addOutline(mound, 0.03, 0x1c2523, 0);
  pad.add(mound);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.18;
    const rr = footR * (0.78 + rnd() * 0.16);
    const patch = new THREE.Mesh(
      facet(new THREE.SphereGeometry(0.26 + rnd() * 0.12, 6, 4)),
      toonMat(0x4e8849, { flatShading: true })
    );
    patch.scale.set(1.45, 0.2, 1.2);
    patch.position.set(Math.cos(a) * rr, 0.06, Math.sin(a) * rr);
    patch.receiveShadow = true;
    pad.add(patch);
  }

  pad.userData.kind = "moebius-green-hill-pad";
  pad.userData.padHeight = meshHeight;
  pad.userData.topRadius = footR * 0.55;
  return pad;
}

/**
 * 底缘在 hillBase - embed，丘顶在 hillCrest；建筑 root 在丘顶之上。
 * 花厅塔额外加一层丘顶圆台，塔基明确站在绿色台面上。
 */
function placeGreenHillPad(parent, dir, place, radiusWorld, seed) {
  const meshHeight = place.padHeight; // hillHeight + embed
  const pad = buildGreenHillPad(radiusWorld, meshHeight, seed);
  // 本地 y=0 → 世界 hillBase - embed；本地 y=meshHeight → hillCrest
  const baseR = place.hillBase - GREEN_HILL_EMBED;
  pad.position.copy(dir).multiplyScalar(baseR);
  pad.quaternion.copy(quatYToDir(dir, new THREE.Quaternion()));

  if (place.hall) {
    // 丘顶绿色圆台：半径略大于塔基，厚度薄，托住花厅塔脚
    const terraceR = radiusWorld * 1.12;
    const terraceH = 0.28;
    const terrace = new THREE.Mesh(
      facet(new THREE.CylinderGeometry(terraceR * 0.92, terraceR, terraceH, 12)),
      toonMat(GRASS, { flatShading: true })
    );
    terrace.name = "moebius-hall-hill-terrace";
    terrace.castShadow = true;
    terrace.receiveShadow = true;
    // 圆台顶面与丘顶齐平（本地 meshHeight 为丘顶）
    terrace.position.y = meshHeight - terraceH * 0.5;
    addOutline(terrace, 0.028, 0x1c2523, 0);
    pad.add(terrace);
  }

  parent.add(pad);
  return pad;
}

/** 缩放后塔网格在本地 Y 的最低点（含描边/平台下探）。 */
function towerMeshBottomLocal(tower) {
  tower.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(tower);
  if (!Number.isFinite(box.min.y)) return 0;
  return box.min.y;
}

/**
 * 构建莫比斯水晶大都会。
 * @param {THREE.CatmullRomCurve3} [options.trackCurve] 轨道让行走廊
 * @param {object} [options.layout] 搭建面板布局；缺省读 localStorage 或高地汇聚默认
 * @param {boolean} [options.useStorage=true] 是否读取存档布局
 */
export function buildMoebiusCrystalMetropolis(scene, R, options = {}) {
  const { trackCurve = null, useStorage = true } = options;
  const rnd = lcg(20260803);
  const group = new THREE.Group();
  group.name = "moebius-metropolis";

  const cityCenterDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  const _dir = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _tiltQ = new THREE.Quaternion();
  const _scl = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _e = new THREE.Euler();
  const _facing = new THREE.Vector3();
  const _basisX = new THREE.Vector3();

  /** 布局：显式 > 存档 > 高地汇聚默认 */
  let layout = options.layout
    ? normalizeCrystalLayout(options.layout)
    : useStorage
      ? loadCrystalLayoutFromStorage()
      : null;
  if (!layout) layout = generateHighRidgeLayout(20260803);
  layout = normalizeCrystalLayout(layout);

  function insideCanyon(dir, minDrop = CITY_ENTRY_DROP) {
    return canyonOffsetDir(dir) <= -minDrop + 1e-5;
  }

  function trackClear(dir, minAngle = 0.19) {
    if (!trackCurve) return true;
    for (let i = 0; i <= 320; i++) {
      trackCurve.getPointAt(i / 320, _pos);
      if (_pos.angleTo(dir) < minAngle) return false;
    }
    return true;
  }

  // ---------- 从布局装配：花厅 + 晶体全部汇聚高地环带 ----------
  const grandSites = [];
  const tracksideGoldSites = [];
  for (const h of layout.halls) {
    const dir = cityLocalToDir(h.lx, h.lz, new THREE.Vector3());
    if (h.kind === "grand") grandSites.push({ dir, scale: h.scale ?? 1, seed: h.seed ?? 701, lx: h.lx, lz: h.lz });
    else tracksideGoldSites.push({ dir, seed: h.seed ?? 4107, scale: h.scale ?? 0.45, lx: h.lx, lz: h.lz });
  }
  // 布局无 grand 时兜底一座，避免下游崩溃
  if (!grandSites.length) {
    const fallback = generateHighRidgeLayout().halls.find((x) => x.kind === "grand");
    grandSites.push({
      dir: cityLocalToDir(fallback.lx, fallback.lz, new THREE.Vector3()),
      scale: 1,
      seed: 701,
      lx: fallback.lx,
      lz: fallback.lz,
    });
  }
  const grandDir = grandSites[0].dir.clone();
  const reservedLandmarkDirs = [
    ...grandSites.map((s) => s.dir),
    ...tracksideGoldSites.map((s) => s.dir),
  ];

  // ---------- 1. 实例化晶体（布局坐标） ----------
  const buckets = { 4: [], 5: [], 6: [] };
  const placedDirs = [];
  const placedBuildings = [];
  for (const c of layout.crystals) {
    const dir = cityLocalToDir(c.lx, c.lz, new THREE.Vector3());
    const r = c.r;
    const centrality = 1 - cityCenterDir.angleTo(dir) / CITY_FOOTPRINT_RADIUS;
    const h =
      (4.8 + Math.max(0, centrality) * 7.5) *
      (c.hMul ?? 1) *
      CITY_BUILDING_SCALE *
      0.55;
    // 只躲开花厅塔心，允许环绕成簇（高地汇聚）
    if (reservedLandmarkDirs.some((reserved) => dir.angleTo(reserved) < 0.055 + r / (2 * R))) {
      continue;
    }
    if (!trackClear(dir, (r + 2.0) / R)) continue;
    const place = buildingPlacementOnTerrain(dir, r, R);
    const root = place.root;
    const tooClose = placedBuildings.some((other) => {
      const needed =
        ((r + other.r + 0.2) * 0.42) / Math.max(24, Math.min(root, other.root));
      return dir.angleTo(other.dir) < needed;
    });
    if (tooClose) continue;
    const seg = c.seg || 5;
    buckets[seg].push({
      dir: dir.clone(),
      h: Math.max(6, h),
      r,
      root,
      place,
      tx: c.tx ?? 0,
      tz: c.tz ?? 0,
      lx: c.lx,
      lz: c.lz,
    });
    placedDirs.push(dir.clone());
    placedBuildings.push({ dir: dir.clone(), r, root });
  }

  const greenHillPads = new THREE.Group();
  greenHillPads.name = "moebius-green-hill-pads";
  group.add(greenHillPads);

  for (const seg of [4, 5, 6]) {
    const list = buckets[seg];
    if (!list.length) continue;
    const geo = facet(new THREE.CylinderGeometry(0.12, 1, 1, seg));
    geo.translate(0, 0.5, 0); // 底部原点（实例矩阵缩放为最终尺寸）
    const mat = crystalPhysical(); // 玻璃折射
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    // 透明体必须用极细壳线；过厚反向壳会被玻璃透射成“灰色钢筋”。
    const outInst = new THREE.InstancedMesh(geo, outlineMatInstanced(0.012), list.length);
    list.forEach((c, i) => {
      placeGreenHillPad(greenHillPads, c.dir, c.place, c.r, 8200 + seg * 100 + i);
      _pos.copy(c.dir).multiplyScalar(c.root);
      _quat.copy(quatYToDir(c.dir, new THREE.Quaternion()));
      _tiltQ.setFromEuler(_e.set(c.tx, 0, c.tz));
      _quat.multiply(_tiltQ);
      _scl.set(c.r, c.h, c.r);
      _m.compose(_pos, _quat, _scl);
      inst.setMatrixAt(i, _m);
      outInst.setMatrixAt(i, _m);
    });
    inst.castShadow = true;
    inst.instanceMatrix.needsUpdate = true;
    outInst.instanceMatrix.needsUpdate = true;
    group.add(inst, outInst);
  }

  /**
   * 花厅塔（母皇/金鳞）落在绿色山丘顶面：
   *  - 先 scale，再量真实网格底
   *  - 塔脚抬到丘顶圆台之上，不被绿丘掩埋
   * @returns {{ root: number, padHeight: number, hillCrest: number }}
   */
  function placeDetailedTower(tower, dir, facing = null, radiusWorld = 2.3 * CITY_BUILDING_SCALE) {
    // 足迹略放大：花厅平台/生物层外挑，避免邻阶/丘坡仍切到塔脚
    const footR = radiusWorld * 1.15;
    const meshBottomLocal = towerMeshBottomLocal(tower);
    const place = buildingPlacementOnTerrain(dir, footR, R, {
      hall: true,
      meshBottomLocal,
    });
    const rootR = place.root;
    placeGreenHillPad(
      greenHillPads,
      dir,
      place,
      footR,
      9100 + ((Math.abs(dir.x) * 1e4) | 0)
    );
    tower.position.copy(dir).multiplyScalar(rootR);
    if (facing) {
      _facing.copy(facing).addScaledVector(dir, -facing.dot(dir));
      if (_facing.lengthSq() > 1e-6) {
        _facing.normalize();
        _basisX.crossVectors(dir, _facing).normalize();
        _m.makeBasis(_basisX, dir, _facing);
        tower.quaternion.setFromRotationMatrix(_m);
      } else {
        tower.quaternion.copy(quatYToDir(dir, new THREE.Quaternion()));
      }
    } else {
      tower.quaternion.copy(quatYToDir(dir, new THREE.Quaternion()));
    }
    group.add(tower);
    return { root: rootR, padHeight: place.padHeight, hillCrest: place.hillCrest };
  }

  // ---------- 2. 花厅母皇塔（带 Bio-Dome 暖光花厅）----------
  const crystals = [];
  for (const gd of grandSites) {
    const dir = gd.dir;
    const tower = createDetailedMoebiusTower({
      stages: 3,
      balcony: true,
      goldScales: true,
      seed: gd.seed,
    });
    tower.name = "moebius-grand-community-tower";
    // 必须先 scale 再量底/落位，否则花厅塔脚仍按未缩放高度埋进绿丘
    tower.scale.setScalar(gd.scale * CITY_BUILDING_SCALE);
    tower.rotateY((gd.seed % 11) * 0.19);
    const baseR = 2.3 * gd.scale * CITY_BUILDING_SCALE;
    const { root } = placeDetailedTower(tower, dir, null, baseR);
    const h = tower.userData.height * gd.scale * CITY_BUILDING_SCALE;
    crystals.push({
      group: tower,
      dir: dir.clone(),
      h,
      r: baseR,
      root,
      hall: true,
      lx: gd.lx,
      lz: gd.lz,
    });
  }

  // ---------- 2b. 金鳞花厅塔（高地环带，布局驱动） ----------
  const corridorTowers = [];
  for (const [siteIndex, site] of tracksideGoldSites.entries()) {
    if (trackCurve && !trackClear(site.dir, 0.15)) continue;
    const scaleMul = site.scale ?? 0.45;
    const scale = scaleMul * CITY_BUILDING_SCALE;
    const tower = createDetailedMoebiusTower({
      stages: siteIndex === 0 ? 3 : 2,
      balcony: true,
      goldScales: true,
      seed: site.seed,
    });
    tower.scale.setScalar(scale);
    tower.name =
      siteIndex === 0
        ? "moebius-trackside-gold-right"
        : "moebius-trackside-gold-left";
    _facing.copy(cityCenterDir).sub(site.dir);
    const baseR = 2.2 * scale;
    const { root } = placeDetailedTower(tower, site.dir, _facing, baseR);
    const h = tower.userData.height * scale;
    const record = {
      group: tower,
      dir: site.dir.clone(),
      h,
      r: baseR,
      root,
      hall: true,
      lx: site.lx,
      lz: site.lz,
    };
    corridorTowers.push(record);
    crystals.push(record);
  }

  // ---------- 3. 金黄能量海（晶体根部 + 城市地表万家灯火） ----------
  const SEA = 420;
  const seaGeo = new THREE.CircleGeometry(0.5, 6);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshBasicMaterial({
    color: GOLD,
    transparent: true,
    opacity: 0.55,
  });
  const sea = new THREE.InstancedMesh(seaGeo, seaMat, SEA);
  const seaSpots = [...placedDirs, ...crystals.map((c) => c.dir)];
  for (let i = 0; i < SEA; i++) {
    let dir = null;
    for (let attempt = 0; attempt < 24 && !dir; attempt++) {
      let candidate;
      if (rnd() < 0.78 && seaSpots.length) {
        // 晶体根部附近，但扰动后仍必须留在峡谷内。
        candidate = seaSpots[(rnd() * seaSpots.length) | 0].clone();
        candidate.x += (rnd() - 0.5) * 0.045;
        candidate.y += (rnd() - 0.5) * 0.025;
        candidate.z += (rnd() - 0.5) * 0.045;
        candidate.normalize();
      } else {
        candidate = latLonToDir(
          CANYON.lat + (rnd() - 0.5) * 64,
          CANYON.lon + (rnd() - 0.5) * 90,
          new THREE.Vector3()
        );
      }
      if (insideCanyon(candidate)) dir = candidate;
    }
    if (!dir) dir = grandDir.clone();
    _pos.copy(dir).multiplyScalar(R + 0.06 + canyonOffsetDir(dir));
    _quat.copy(quatYToDir(dir, new THREE.Quaternion()));
    const s = 0.4 + rnd() * 1.1;
    _scl.set(s, 1, s);
    _m.compose(_pos, _quat, _scl);
    sea.setMatrixAt(i, _m);
  }
  sea.instanceMatrix.needsUpdate = true;
  group.add(sea);

  // ---------- 4. 塔间鸟群（可迁移到叹息之门；花厅「忽聚忽散」Boids 另见 hallFlock） ----------
  const birdFlocks = createMoebiusHallBirdFlocks(group, crystals, rnd);

  group.userData.cityFootprintAngularRadius = CITY_FOOTPRINT_RADIUS;
  group.userData.backgroundBuildingCount = placedDirs.length;
  group.userData.greenHillPadCount = greenHillPads.children.length;
  group.userData.birdFlocks = birdFlocks;
  group.userData.layout = layout;
  scene.add(group);
  const grandTop = grandDir
    .clone()
    .multiplyScalar(crystals[0].root + crystals[0].h * 0.96);
  return {
    group,
    crystals,
    corridorTowers,
    grand: crystals[0],
    grandTop,
    birdFlocks,
    layout,
    /**
     * @param {number} dt
     * @param {number} t
     * @param {{ escortTram?: import("three").Object3D|null }} [opts]
     */
    update(dt, t, opts = {}) {
      birdFlocks.update(dt, t, opts);
    },
  };
}

/** 释放 moebius 组几何（材质可能与 toon 缓存共用，只丢 geometry） */
function disposeMoebiusGroup(root) {
  if (!root) return;
  const geos = new Set();
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    if (o.geometry) geos.add(o.geometry);
  });
  for (const g of geos) g.dispose();
}

/**
 * 热重建水晶城（保持 api 对象引用，供 messengerIsland 闭包继续 update）。
 * @param {ReturnType<typeof buildMoebiusCrystalMetropolis>} api
 * @param {THREE.Scene} scene
 * @param {number} R
 * @param {{ trackCurve?: THREE.CatmullRomCurve3, layout?: object, useStorage?: boolean }} options
 */
export function rebuildMoebiusCrystalMetropolis(api, scene, R, options = {}) {
  if (!api) return null;
  const parent = api.group?.parent || scene;
  if (api.group) {
    parent.remove(api.group);
    disposeMoebiusGroup(api.group);
  }
  // 重建时不要再读 storage 覆盖刚传入的 layout
  const next = buildMoebiusCrystalMetropolis(scene, R, {
    ...options,
    useStorage: options.layout ? false : options.useStorage !== false,
  });
  // 原地改写数组，保留 flock.obstacles 等对 crystals 的引用
  if (Array.isArray(api.crystals)) {
    api.crystals.length = 0;
    api.crystals.push(...next.crystals);
  } else {
    api.crystals = next.crystals;
  }
  api.group = next.group;
  api.corridorTowers = next.corridorTowers;
  api.grand = next.grand;
  api.grandTop = next.grandTop;
  api.birdFlocks = next.birdFlocks;
  api.layout = next.layout;
  api.update = next.update;
  return api;
}

export { cityLocalToDir, dirToCityLocal, generateHighRidgeLayout };

// ---------------------------------------------------------------------------
//  花厅之间鸟群：低多边剪影，沿塔间航线穿梭
// ---------------------------------------------------------------------------

/**
 * @param {THREE.Group} parent
 * @param {{ group: THREE.Object3D, dir: THREE.Vector3, h: number, root: number }[]} crystals
 * @param {() => number} rnd
 */
function createMoebiusHallBirdFlocks(parent, crystals, rnd) {
  const root = new THREE.Group();
  root.name = "moebius-hall-birds";
  parent.add(root);

  // 花厅巡航：深色剪影；送别伴飞：更大更亮，车窗易见
  const wingMat = new THREE.MeshBasicMaterial({
    color: 0x2a3540,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const bodyMat = new THREE.MeshBasicMaterial({
    color: 0x1e2830,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const farewellWingMat = new THREE.MeshBasicMaterial({
    color: 0x1a2430,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const farewellBodyMat = new THREE.MeshBasicMaterial({
    color: 0x0f161c,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  function makeBird(scale = 1, farewell = false) {
    const bird = new THREE.Group();
    bird.name = farewell ? "moebius-bird-farewell" : "moebius-bird";
    const wm = farewell ? farewellWingMat : wingMat;
    const bm = farewell ? farewellBodyMat : bodyMat;
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * scale, 0.14 * scale), wm);
    wingL.position.set(-0.28 * scale, 0, 0);
    wingL.rotation.z = 0.38;
    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * scale, 0.14 * scale), wm);
    wingR.position.set(0.28 * scale, 0, 0);
    wingR.rotation.z = -0.38;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 5, 4), bm);
    body.scale.set(1.4, 0.7, 0.7);
    bird.add(wingL, wingR, body);
    bird.userData.wingL = wingL;
    bird.userData.wingR = wingR;
    bird.userData.baseScale = scale;
    bird.userData.farewellOnly = farewell;
    return bird;
  }

  // 航点：各花厅塔「中层～上层」世界位置（霓虹穹顶高度带）
  /** @type {THREE.Vector3[]} */
  const halls = [];
  for (const c of crystals) {
    if (!c?.dir || !Number.isFinite(c.root) || !Number.isFinite(c.h)) continue;
    const up = c.dir.clone().normalize();
    // 两层高度：约 1/3、2/3 塔高（对应花厅错落层）
    for (const frac of [0.32, 0.55, 0.72]) {
      halls.push(up.clone().multiplyScalar(c.root + c.h * frac));
    }
  }
  // 若塔少，补谷心上空漫游点
  if (halls.length < 4) {
    const mid = crystals[0]?.dir?.clone().normalize() || new THREE.Vector3(0, -1, 0);
    const r0 = crystals[0]?.root || 40;
    halls.push(mid.clone().multiplyScalar(r0 + 12));
    halls.push(mid.clone().multiplyScalar(r0 + 18));
  }

  const _pos = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _target = new THREE.Vector3();
  const _tramPos = new THREE.Vector3();
  const _tramFwd = new THREE.Vector3();
  const _escortPos = new THREE.Vector3();
  const _patrolPos = new THREE.Vector3();
  const _patrolTan = new THREE.Vector3();
  const _patrolUp = new THREE.Vector3();
  const _patrolRight = new THREE.Vector3();
  /** 0=花厅巡航 · 1=电车伴飞（平滑过渡） */
  let escortBlend = 0;

  /**
   * 在闭合折线航点上按参数 u∈[0,1) 采样位置与切线
   * @param {THREE.Vector3[]} pts
   * @param {number} u
   * @param {THREE.Vector3} outPos
   * @param {THREE.Vector3} outTan
   */
  function sampleLoop(pts, u, outPos, outTan) {
    const n = pts.length;
    if (n === 0) {
      outPos.set(0, 0, 0);
      outTan.set(1, 0, 0);
      return;
    }
    if (n === 1) {
      outPos.copy(pts[0]);
      outTan.set(1, 0, 0);
      return;
    }
    const seg = ((u % 1) + 1) % 1;
    const f = seg * n;
    const i0 = Math.floor(f) % n;
    const i1 = (i0 + 1) % n;
    const local = f - Math.floor(f);
    const s = local * local * (3 - 2 * local);
    outPos.lerpVectors(pts[i0], pts[i1], s);
    outTan.subVectors(pts[i1], pts[i0]);
    if (outTan.lengthSq() < 1e-8) outTan.set(1, 0, 0);
    else outTan.normalize();
  }

  /** @type {{ birds: THREE.Group[], path: THREE.Vector3[], speed: number, phase: number }[]} */
  const flocks = [];
  const flockCount = Math.min(6, Math.max(3, (crystals.length * 1.2) | 0));

  for (let f = 0; f < flockCount; f++) {
    // 每群选 3～4 个花厅航点构成闭合航线
    const path = [];
    const pickN = 3 + ((rnd() * 2) | 0);
    let idx = (rnd() * halls.length) | 0;
    for (let k = 0; k < pickN; k++) {
      path.push(halls[idx % halls.length].clone());
      idx += 1 + ((rnd() * Math.max(1, (halls.length / pickN) | 0)) | 0);
    }
    // 相对质心外推，航线走在塔间走廊而非穿心
    const centroid = new THREE.Vector3();
    for (const p of path) centroid.add(p);
    centroid.multiplyScalar(1 / path.length);
    for (const p of path) p.lerp(centroid, -0.14);

    const flockG = new THREE.Group();
    flockG.name = `moebius-bird-flock-${f}`;
    root.add(flockG);

    const birdN = 5 + ((rnd() * 5) | 0);
    /** @type {THREE.Group[]} */
    const birds = [];
    for (let b = 0; b < birdN; b++) {
      const sc = 0.9 + rnd() * 0.65;
      const bird = makeBird(sc);
      bird.userData.lane = (b - (birdN - 1) * 0.5) * (0.65 + rnd() * 0.3);
      bird.userData.lag = rnd() * 0.09;
      bird.userData.bob = rnd() * Math.PI * 2;
      bird.userData.flapSpeed = 9 + rnd() * 5;
      flockG.add(bird);
      birds.push(bird);
    }

    flocks.push({
      birds,
      path,
      speed: 0.032 + rnd() * 0.03,
      phase: rnd(),
      escortOnly: false,
    });
  }

  // 专属送别编队：更大只数，平时藏在城缘，离城时贴车
  {
    const path = halls.slice(0, Math.min(4, halls.length)).map((p) => p.clone());
    if (path.length < 2 && halls[0]) {
      path.push(halls[0].clone().add(new THREE.Vector3(2, 2, 0)));
    }
    const flockG = new THREE.Group();
    flockG.name = "moebius-bird-flock-farewell";
    root.add(flockG);
    const birds = [];
    const birdN = 14;
    for (let b = 0; b < birdN; b++) {
      const sc = 1.6 + rnd() * 0.9;
      const bird = makeBird(sc, true);
      bird.userData.lane = (b - (birdN - 1) * 0.5) * 0.85;
      bird.userData.lag = rnd() * 0.12;
      bird.userData.bob = rnd() * Math.PI * 2;
      bird.userData.flapSpeed = 11 + rnd() * 4;
      bird.visible = false;
      flockG.add(bird);
      birds.push(bird);
    }
    flocks.push({
      birds,
      path: path.length ? path : halls.slice(0, 1),
      speed: 0.04,
      phase: rnd(),
      escortOnly: true,
    });
  }

  /**
   * 把巡航鸟群迁到地标。
   * - 默认：绕 center 圆圈
   * - opts.corridor：穿行三重门夹道（不进云墙）
   * @param {THREE.Vector3} centerWorld
   * @param {{
   *   span?: number, altSpread?: number, includeFarewell?: boolean,
   *   corridor?: {
   *     origin: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3,
   *     halfWidth: number, halfLength: number, yMin: number, yMax: number, cloudCeilY?: number
   *   }
   * }} [opts]
   */
  function migratePatrolHome(centerWorld, opts = {}) {
    if (!centerWorld || centerWorld.lengthSq() < 1e-8) return false;
    const includeFarewell = opts.includeFarewell !== false;
    const cor = opts.corridor || null;

    for (const flock of flocks) {
      if (flock.escortOnly && !includeFarewell) continue;
      /** @type {THREE.Vector3[]} */
      let path = [];

      if (cor?.origin && cor.forward && cor.right && cor.up) {
        // 沿轨穿三重门的长环：门前 → 中拱 → 门后 → 回穿
        // 高度锁在券洞带；横向略摆但不越双子夹道 / 不进云墙
        const o = cor.origin;
        const Rgt = cor.right.clone().normalize();
        const Up = cor.up.clone().normalize();
        const Fwd = cor.forward.clone().normalize();
        const hw = Math.max(0.6, (cor.halfWidth || 3) * 0.72);
        const hl = Math.max(4, cor.halfLength || 16);
        const y0 = cor.yMin ?? 3;
        const y1 = Math.min(cor.yMax ?? 12, (cor.cloudCeilY ?? 40) - 2);
        const yMid = (y0 + y1) * 0.5;
        const yLo = y0 + (y1 - y0) * 0.25;
        const yHi = y0 + (y1 - y0) * 0.75;
        const side = flock.escortOnly ? hw * 0.55 : hw * (0.35 + rnd() * 0.55);
        const s = (rnd() > 0.5 ? 1 : -1) * side;
        // 6 点闭合：穿门两次（去程 + 回程对侧）
        path = [
          o.clone().addScaledVector(Fwd, -hl * 0.95).addScaledVector(Up, yMid).addScaledVector(Rgt, s * 0.3),
          o.clone().addScaledVector(Fwd, -hl * 0.25).addScaledVector(Up, yHi).addScaledVector(Rgt, s * 0.7),
          o.clone().addScaledVector(Fwd, hl * 0.15).addScaledVector(Up, yLo).addScaledVector(Rgt, -s * 0.4),
          o.clone().addScaledVector(Fwd, hl * 0.95).addScaledVector(Up, yMid).addScaledVector(Rgt, -s * 0.25),
          o.clone().addScaledVector(Fwd, hl * 0.2).addScaledVector(Up, yHi).addScaledVector(Rgt, s * 0.55),
          o.clone().addScaledVector(Fwd, -hl * 0.35).addScaledVector(Up, yLo).addScaledVector(Rgt, s * 0.15),
        ];
        // 收窄横向：lane 偏移会再加，路径本身保持在夹道内
        flock.speed = flock.escortOnly ? 0.045 : 0.038 + rnd() * 0.02;
      } else {
        const center = centerWorld.clone();
        const up = center.clone().normalize();
        const t1 = new THREE.Vector3(0, 1, 0).cross(up);
        if (t1.lengthSq() < 1e-8) t1.set(1, 0, 0);
        t1.normalize();
        const t2 = new THREE.Vector3().crossVectors(up, t1).normalize();
        const span = Number.isFinite(opts.span) ? opts.span : 16;
        const altSpread = Number.isFinite(opts.altSpread) ? opts.altSpread : 7;
        const pickN = flock.escortOnly ? 4 : 3 + ((rnd() * 2) | 0);
        const phase0 = rnd() * Math.PI * 2;
        for (let k = 0; k < pickN; k++) {
          const a = phase0 + (k / pickN) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
          const rad = span * (0.72 + rnd() * 0.4);
          path.push(
            center
              .clone()
              .addScaledVector(t1, Math.cos(a) * rad)
              .addScaledVector(t2, Math.sin(a) * rad)
              .addScaledVector(up, (rnd() - 0.5) * altSpread)
          );
        }
        const centroid = new THREE.Vector3();
        for (const p of path) centroid.add(p);
        centroid.multiplyScalar(1 / path.length);
        for (const p of path) p.lerp(centroid, -0.08);
      }

      flock.path = path;
      flock.phase = rnd();

      // 立即落到新航线
      if (path.length) {
        for (let b = 0; b < flock.birds.length; b++) {
          const bird = flock.birds[b];
          const u = (b / Math.max(1, flock.birds.length)) % 1;
          sampleLoop(path, u, _patrolPos, _patrolTan);
          if (cor) {
            // 走廊模式：lane 限幅，避免摆出双子塔/云墙
            const maxLane = Math.max(0.4, (cor.halfWidth || 3) * 0.45);
            bird.userData.lane = THREE.MathUtils.clamp(bird.userData.lane || 0, -maxLane, maxLane);
            _patrolUp.copy(cor.up).normalize();
            _patrolRight.copy(cor.right).normalize();
          } else {
            _patrolUp.copy(_patrolPos).normalize();
            _patrolRight.crossVectors(_patrolUp, _patrolTan).normalize();
          }
          const lane = bird.userData.lane || 0;
          bird.position
            .copy(_patrolPos)
            .addScaledVector(_patrolRight, lane)
            .addScaledVector(_patrolUp, Math.abs(lane) * 0.08);
        }
      }
    }
    return true;
  }

  /**
   * @param {number} dt
   * @param {number} t
   * @param {{ escortTram?: import("three").Object3D|null }} [opts]
   *   escortTram：离城送别目标电车
   */
  function update(dt, t, opts = {}) {
    const escortTram = opts.escortTram || null;
    const wantEscort = !!escortTram;
    // 快速融入（~0.8s），散开稍慢
    const blendRate = wantEscort ? 2.2 : 0.7;
    const targetBlend = wantEscort ? 1 : 0;
    escortBlend += (targetBlend - escortBlend) * Math.min(1, (dt || 1 / 60) * blendRate);
    if (Math.abs(escortBlend - targetBlend) < 0.002) escortBlend = targetBlend;

    let hasTram = false;
    if (escortTram && escortBlend > 0.02) {
      escortTram.getWorldPosition(_tramPos);
      _tramFwd.set(1, 0, 0).applyQuaternion(escortTram.quaternion);
      _up.copy(_tramPos).normalize();
      _tramFwd.addScaledVector(_up, -_tramFwd.dot(_up));
      if (_tramFwd.lengthSq() < 1e-8) _tramFwd.set(0, 0, 1).addScaledVector(_up, -_up.z);
      _tramFwd.normalize();
      _right.crossVectors(_up, _tramFwd).normalize();
      // 右舷归一化失败时兜底
      if (_right.lengthSq() < 1e-8) _right.set(0, 0, 1);
      else _right.normalize();
      hasTram = true;
    }

    let birdGlobal = 0;
    for (const flock of flocks) {
      const escortOnly = !!flock.escortOnly;
      // 专属送别队：只在伴飞时显示
      if (escortOnly) {
        const show = escortBlend > 0.05;
        for (const bird of flock.birds) bird.visible = show;
        if (!show) {
          birdGlobal += flock.birds.length;
          continue;
        }
      }

      const u0 = (flock.phase + t * flock.speed) % 1;
      for (const bird of flock.birds) {
        const u = (u0 - (bird.userData.lag || 0) + 1) % 1;
        // ---- 花厅巡航位 ----
        if (flock.path?.length) {
          sampleLoop(flock.path, u, _patrolPos, _patrolTan);
        } else {
          _patrolPos.copy(_tramPos);
          _patrolTan.copy(_tramFwd);
        }
        _patrolUp.copy(_patrolPos).normalize();
        _patrolTan.addScaledVector(_patrolUp, -_patrolTan.dot(_patrolUp));
        if (_patrolTan.lengthSq() < 1e-8) _patrolTan.set(1, 0, 0);
        else _patrolTan.normalize();
        _patrolRight.crossVectors(_patrolUp, _patrolTan).normalize();
        {
          const lane = bird.userData.lane || 0;
          const bob =
            Math.sin(t * 2.2 + bird.userData.bob) * 0.45 +
            Math.sin(t * 5.1 + lane) * 0.18;
          _patrolPos
            .addScaledVector(_patrolRight, lane)
            .addScaledVector(_patrolUp, bob + Math.abs(lane) * 0.12);
        }

        // ---- 电车伴飞：大编队侧上方（城市尺度可见）----
        if (hasTram) {
          const i = birdGlobal;
          const side = i % 2 === 0 ? 1 : -1;
          const row = (i / 2) | 0;
          const orbit = t * 1.35 + bird.userData.bob;
          // 车身尺度约数米～十余米，编队拉开
          const sideDist = 5.5 + row * 1.1 + Math.sin(orbit) * 0.8;
          const upDist = 3.8 + (row % 4) * 0.9 + Math.sin(orbit * 1.3) * 0.55;
          const backDist = -0.5 - row * 1.15 - (bird.userData.lag || 0) * 10;
          _escortPos
            .copy(_tramPos)
            .addScaledVector(_right, side * sideDist)
            .addScaledVector(_up, upDist)
            .addScaledVector(_tramFwd, backDist);
        } else {
          _escortPos.copy(_patrolPos);
        }

        const k = escortOnly
          ? escortBlend
          : escortBlend * escortBlend * (3 - 2 * escortBlend);
        bird.position.lerpVectors(_patrolPos, _escortPos, k);

        // 送别时放大，车窗更明显
        const sc = (bird.userData.baseScale || 1) * (1 + k * 1.35);
        bird.scale.setScalar(sc);

        if (k > 0.35 && hasTram) {
          _target.copy(bird.position).add(_tramFwd);
          bird.up.copy(_up);
        } else {
          _target.copy(bird.position).add(_patrolTan);
          bird.up.copy(_patrolUp);
        }
        bird.lookAt(_target);

        const flapMul = 1 + k * 0.85;
        const flap =
          Math.sin(t * bird.userData.flapSpeed * flapMul + bird.userData.bob) * (0.55 + k * 0.2);
        if (bird.userData.wingL) bird.userData.wingL.rotation.z = 0.38 + flap;
        if (bird.userData.wingR) bird.userData.wingR.rotation.z = -0.38 - flap;

        birdGlobal++;
      }
    }
  }

  return {
    group: root,
    flocks,
    update,
    migratePatrolHome,
  };
}

/** 旧名兼容 */
export const buildMoebiusCity = buildMoebiusCrystalMetropolis;
