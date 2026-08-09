// =====================================================================
//  圣城外围地表（Citadel Range）：五层台地的贴地承接面
//
//  布局（站点局部切平面，lz+ 指向主岛）：
//    lz≈0   不再生成旧 +16 黄土主峰；城堡只由五层可编辑台地承托
//    lz≈36  不再生成独立前景土坡；第五层台地直接咬入全球地表
//    水系    五座台地湖泊 + 四道相邻层瀑布，严禁跨越两层
//
//  关键约束：星球网格 48×32 段太粗（顶点间距 ~20 单位），无法直接
//  顶点位移造山 → 独立高度场网格，视觉与碰撞共用同一高程函数
//  （与 hills.js 岛面山脉同构）。域缘裙边下沉 0.7 扎进球面遮接缝；
//  域内基线 +0.4 覆盖粗网格球面弦高差（sagitta ≈0.28）防穿插。
// =====================================================================
import * as THREE from "three";
import { latLonToDir } from "./sphereMath.js";
import { canyonOffsetDir } from "./canyon.js";
import { toonMat, addOutline } from "../assets/toon.js";
import { createMangaWaterfall } from "./mangaWaterfall.js";
import {
  CITADEL,
  citadelCurvatureDrop,
  citadelTerraceMetrics,
  normalizeCitadelTerrain,
} from "./odysseyCitadel.js";
import { createSnowMassif } from "../assets/snowMassif.js";
import { createCitadelMoat, CITADEL_MOAT_SPEC } from "../assets/citadelMoat.js";

/* ---------------- 选址与山体参数（锁死） ---------------- */
export const RANGE_SITE = Object.freeze({ lat: 24.1, lon: 36.05 });
export const CITADEL_PEAK = Object.freeze({
  // The former +16 broad soil mountain is gone. The five editable contour
  // terraces are now the entire citadel landform and terrace 5 meets ground.
  cx: 0, cz: 0, rx: 44, rz: 38, h: 0,
});
export const VIEW_PEAK = Object.freeze({
  // The former foreground soil mound is removed; architecture replaces it.
  cx: 0, cz: 36, rx: 16, rz: 13, h: 0,
});
export const OUTPOST_CUT = Object.freeze({
  // Strictly beyond the castle facade (which reaches local Z≈16): camera-right
  // foreground outwork on its own flattened ground pad.
  cx: -11, cz: 28, rx: 8.5, rz: 9.0, floor: 0.6,
});
const BASE_LIFT = 0.4; // 域内基线：压住粗网格球面弦高差
const SKIRT_DEPTH = 0.7; // 域缘裙边下沉，扎进球面遮接缝
const SKIRT_BAND = 6; // 裙边过渡带宽
// 局部基架：up = 站点方向，lz+ 指向主岛，lx = 右
const _site = latLonToDir(RANGE_SITE.lat, RANGE_SITE.lon, new THREE.Vector3());
const _island = latLonToDir(90, 0, new THREE.Vector3());
const _fwd = _island.clone().addScaledVector(_site, -_island.dot(_site)).normalize();
const _right = new THREE.Vector3().crossVectors(_fwd, _site).normalize();

// 网格域（局部坐标）
const LX_MIN = -48, LX_MAX = 48;
const LZ_MIN = -30, LZ_MAX = 58;
const STEP = 1.5;

const _o = new THREE.Vector3();

/** 椭圆平顶峰：d<band0 全高平顶，band0→band1 平滑落到 0 */
function peakLift(lx, lz, p, band0 = 0.42, band1 = 0.92) {
  const dx = (lx - p.cx) / p.rx;
  const dz = (lz - p.cz) / p.rz;
  const d = Math.hypot(dx, dz);
  if (d >= band1) return 0;
  if (d <= band0) return p.h;
  const t = (d - band0) / (band1 - band0);
  const s = t * t * (3 - 2 * t);
  return p.h * (1 - s);
}

/** 局部坐标 → 山脉高程（含基线与裙边；视觉=碰撞唯一真源） */
export function citadelRangeLiftLocal(lx, lz) {
  // 陡峭收分带（0.42→0.8 / 0.4→0.8）：两峰如 Mesa 断崖，鞍部深切成谷
  let lift =
    BASE_LIFT +
    peakLift(lx, lz, CITADEL_PEAK, 0.42, 0.8) +
    peakLift(lx, lz, VIEW_PEAK, 0.4, 0.8);

  // The former foreground-defense-tower pad deliberately no longer carves a
  // flat pit into the slope.  The citadel range now stays a continuous landform
  // except for the explicit staircase / cascade watercourse.
  // 域缘裙边：距矩形域边 < SKIRT_BAND 时平滑扎进球面
  const ex = Math.min(lx - LX_MIN, LX_MAX - lx);
  const ez = Math.min(lz - LZ_MIN, LZ_MAX - lz);
  const edge = Math.min(ex, ez);
  if (edge < SKIRT_BAND) {
    const t = THREE.MathUtils.clamp(edge / SKIRT_BAND, 0, 1);
    const s = t * t * (3 - 2 * t);
    lift = THREE.MathUtils.lerp(-SKIRT_DEPTH, lift, s);
  }
  return lift;
}

/**
 * 世界方向 → 山脉高程（域外恒 0，无分配）。
 * 供物理/选址合成：surfR = R + canyonOffsetDir(dir) + citadelRangeLiftDir(dir)
 */
export function citadelRangeLiftDir(dir) {
  // 粗守卫：与站点角距 > ~40° 直接归零
  if (dir.dot(_site) < 0.76) return 0;
  _o.copy(dir).addScaledVector(_site, -dir.dot(_site)); // 切向偏移（单位球近似）
  const k = 160; // WORLD_RADIUS：切向偏移放大为世界单位
  const lx = _o.dot(_right) * k;
  const lz = _o.dot(_fwd) * k;
  if (lx < LX_MIN || lx > LX_MAX || lz < LZ_MIN || lz > LZ_MAX) return 0;
  return citadelRangeLiftLocal(lx, lz);
}

/** 站点局部坐标 → 世界坐标（出参 out） */
export function rangeLocalToWorld(lx, lz, R, out) {
  out
    .copy(_site)
    .multiplyScalar(R)
    .addScaledVector(_right, lx)
    .addScaledVector(_fwd, lz);
  const lift = citadelRangeLiftLocal(lx, lz);
  return out.normalize().multiplyScalar(R + lift);
}

/** 局部坐标 → 指定绝对地表抬升；供五层台地水系使用，禁止再借旧土坡取高。 */
function rangeLocalToWorldAtElevation(lx, lz, R, elevation, out) {
  return out
    .copy(_site)
    .multiplyScalar(R + elevation)
    .addScaledVector(_right, lx)
    .addScaledVector(_fwd, lz);
}

/**
 * 球面地表抬升：让物体落在“第一颗参天大树”所扎根的同一颗星球曲面之上。
 * 与 odysseyCitadel.js 中 grounded 参天树的 localSphericalGroundY 同构——
 * 以站点地表真实半径 groundR = R + canyonOffsetDir(_site) 为球心半径，
 * 在切向半径 r = hypot(lx,lz) 处取球面 Y（怪兽网格弦高差已含在其中）。
 * 这样护城河/港口/战船都贴着球面落地，自然随曲率倾斜、与落地树齐平。
 */
export function sphericalGroundLift(lx, lz, R) {
  const groundR = R + canyonOffsetDir(_site);
  const r = Math.hypot(lx, lz);
  const sagitta = groundR - Math.sqrt(Math.max(0, groundR * groundR - r * r));
  // 站点处地表抬升 = groundR - R；减去该切向半径处的弦高差即得沿“R+抬升”基准的
  // 相对抬升量（与 placeRangeAsset 的 R + lift 同构）。
  return (groundR - R) - sagitta;
}

/* ---------------- 可行走高程：台地台面 + 朝圣台阶（仅碰撞，视觉网格不变） ----------------
   与 odysseyCitadel.js 的 contourTerrain / 折返石阶同参数（那边管视觉，这边管
   碰撞；两者共用站点局部坐标系）。送信人可沿五段折返石阶从山脚一路走上顶层
   台地，经平桥抵达棕色正门门廊。 */
const WALK_ANGLES = Object.freeze([
  Object.freeze([-0.87, -1.5]),
  Object.freeze([-1.5, -0.91]),
  Object.freeze([-0.91, -1.47]),
  Object.freeze([-1.47, -0.94]),
  Object.freeze([-0.94, -1.4]),
]);
let walkPlanetRadius = 160;
let walkContour = normalizeCitadelTerrain(CITADEL.contourTerrain);
let walkMetrics = citadelTerraceMetrics(walkContour);
let walkCurvatureDrop = citadelCurvatureDrop(
  walkPlanetRadius + BASE_LIFT,
  walkContour
);
let walkBaseLift = BASE_LIFT - CITADEL.groundEmbed - walkCurvatureDrop;
let walkFlights = [];

function configureCitadelWalkTerrain(R, contourSpec) {
  walkPlanetRadius = Number.isFinite(R) ? R : 160;
  walkContour = normalizeCitadelTerrain(contourSpec);
  walkMetrics = citadelTerraceMetrics(walkContour);
  walkCurvatureDrop = citadelCurvatureDrop(walkPlanetRadius + BASE_LIFT, walkContour);
  walkBaseLift = BASE_LIFT - CITADEL.groundEmbed - walkCurvatureDrop;
  walkFlights = WALK_ANGLES.map(([from, to], flightIndex) => {
    const terraceIndex = walkMetrics.length - 1 - flightIndex;
    const metric = walkMetrics[terraceIndex];
    const lowerMetric = walkMetrics[terraceIndex + 1];
    return {
      from,
      to,
      rho: metric.radius + 1.05,
      yA: lowerMetric ? lowerMetric.top + 0.06 : metric.bottom,
      yB: metric.top + 0.06,
    };
  });
}
configureCitadelWalkTerrain(walkPlanetRadius, walkContour);

/** Tangent-frame local Y at radius r → actual radial lift above the planet. */
function curvedWalkLift(localY, r) {
  return Math.hypot(walkPlanetRadius + walkBaseLift + localY, r) - walkPlanetRadius;
}

/** 台地/台阶附加抬升（局部坐标；无支撑处返回 -Infinity） */
function citadelTerraceWalkLiftLocal(lx, lz) {
  const r = Math.hypot(lx, lz);
  if (r > walkMetrics.at(-1).radius + 3) return -Infinity;
  const phi = Math.atan2(lx, lz);
  let best = -Infinity;
  // 台面：最高（半径最小）的包含层即脚下台面；瀑布缺口扇区内前四层不存在
  const inNotch = r > walkContour.coreRadius
    && Math.abs(phi - walkContour.notchCenter) < walkContour.notchHalf;
  for (let terraceIndex = 0; terraceIndex < walkMetrics.length; terraceIndex++) {
    const metric = walkMetrics[terraceIndex];
    if (r > metric.radius) continue;
    if (terraceIndex > 0 && terraceIndex <= walkContour.notchedLayers && inNotch) continue;
    best = curvedWalkLift(metric.top, r);
    break;
  }
  // 石阶梯段：沿圆弧的连续坡道（覆盖踏面 ±0.1 的离散起伏）
  for (const f of walkFlights) {
    if (Math.abs(r - f.rho) > 1.35) continue;
    const lo = Math.min(f.from, f.to);
    const hi = Math.max(f.from, f.to);
    if (phi < lo - 0.06 || phi > hi + 0.06) continue;
    const t = THREE.MathUtils.clamp((phi - f.from) / (f.to - f.from), 0, 1);
    best = Math.max(best, curvedWalkLift(f.yA + (f.yB - f.yA) * t, r));
  }
  return best;
}

/** 局部坐标 → 可行走高程（自然坡面与台地/台阶取高者） */
export function citadelWalkLiftLocal(lx, lz) {
  return Math.max(citadelRangeLiftLocal(lx, lz), citadelTerraceWalkLiftLocal(lx, lz));
}

/**
 * 世界方向 → 可行走高程（域外恒 0）。仅供 collision.js 落脚判定；
 * 视觉网格与选址仍用 citadelRangeLiftDir，不受台地/台阶影响。
 */
export function citadelWalkLiftDir(dir) {
  if (dir.dot(_site) < 0.76) return 0;
  _o.copy(dir).addScaledVector(_site, -dir.dot(_site)); // 切向偏移（单位球近似）
  const k = 160; // WORLD_RADIUS：切向偏移放大为世界单位
  const lx = _o.dot(_right) * k;
  const lz = _o.dot(_fwd) * k;
  if (lx < LX_MIN || lx > LX_MAX || lz < LZ_MIN || lz > LZ_MAX) return 0;
  return citadelWalkLiftLocal(lx, lz);
}


/** 站点方向（单位向量，拷贝进 out；不传则返回新向量） */
export function citadelSiteDir(out = new THREE.Vector3()) {
  return out.copy(_site);
}

function rangePart(geometry, material, name, outline = 0.04) {
  const part = new THREE.Mesh(geometry, material);
  part.name = name;
  part.castShadow = true;
  part.receiveShadow = true;
  addOutline(part, outline, 0x1c2523, 0);
  return part;
}

function placeRangeAsset(asset, lx, lz, R, lift = 0, siteUpright = false) {
  rangeLocalToWorld(lx, lz, R, asset.position);
  // Architectural outworks share the citadel's vertical axis; natural assets
  // may follow their own point on the spherical surface.
  const surfaceUp = siteUpright ? _site.clone() : asset.position.clone().normalize();
  asset.position.addScaledVector(surfaceUp, lift);
  const surfaceForward = _fwd.clone()
    .addScaledVector(surfaceUp, -_fwd.dot(surfaceUp))
    .normalize();
  const surfaceRight = new THREE.Vector3().crossVectors(surfaceUp, surfaceForward).normalize();
  const basis = new THREE.Matrix4().makeBasis(surfaceRight, surfaceUp, surfaceForward);
  asset.quaternion.setFromRotationMatrix(basis);
  asset.userData.rangeLocal = { lx, lz };
  return asset;
}

function placeRangeAssetAtElevation(asset, lx, lz, R, elevation) {
  rangeLocalToWorldAtElevation(lx, lz, R, elevation, asset.position);
  const surfaceUp = _site.clone();
  const surfaceForward = _fwd.clone()
    .addScaledVector(surfaceUp, -_fwd.dot(surfaceUp))
    .normalize();
  const surfaceRight = new THREE.Vector3().crossVectors(surfaceUp, surfaceForward).normalize();
  asset.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(surfaceRight, surfaceUp, surfaceForward)
  );
  asset.userData.rangeLocal = { lx, lz };
  asset.userData.absoluteElevation = elevation;
  return asset;
}

function makeIrregularTerraceGeometry(rx, rz, depth, seed, segments = 16) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const positions = [0, 0, 0, 0, -depth, 0];
  const rim = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const jitter = 0.88 + random() * 0.2;
    const x = Math.cos(angle) * rx * jitter;
    const z = Math.sin(angle) * rz * jitter;
    const top = positions.length / 3;
    positions.push(x, (random() - 0.5) * 0.08, z);
    const bottom = positions.length / 3;
    positions.push(x * 1.035, -depth * (0.9 + random() * 0.18), z * 1.035);
    rim.push({ top, bottom });
  }
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const a = rim[i];
    const b = rim[next];
    indices.push(0, b.top, a.top);
    indices.push(1, a.bottom, b.bottom);
    indices.push(a.top, b.top, a.bottom, b.top, b.bottom, a.bottom);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeIrregularPoolGeometry(rx, rz, seed, segments = 20) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1103515245, state) + 12345) >>> 0;
    return state / 0x100000000;
  };
  const positions = [0, 0, 0];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const jitter = 0.9 + random() * 0.16;
    positions.push(
      Math.cos(angle) * rx * jitter,
      0,
      Math.sin(angle) * rz * jitter
    );
  }
  const indices = [];
  for (let i = 0; i < segments; i++) {
    // Counter-clockwise from above: normals point along the citadel's local
    // +Y axis so toon lighting keeps the water blue instead of shadow-black.
    indices.push(0, ((i + 1) % segments) + 1, i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildWhiteStoneLakeStage(spec, materials) {
  const stage = new THREE.Group();
  stage.name = `citadel-${spec.name}`;

  const bank = rangePart(
    makeIrregularTerraceGeometry(spec.rx, spec.rz, spec.depth, spec.seed),
    materials.whiteStone,
    `${stage.name}-white-stone-bank`,
    0.035
  );
  stage.add(bank);

  // Water intentionally has no inverse-hull outline: on a zero-thickness
  // translucent sheet the back shell can cover the face from low viewpoints.
  // The surrounding outlined white stones provide the inked shoreline.
  const water = new THREE.Mesh(
    makeIrregularPoolGeometry(spec.rx * 0.78, spec.rz * 0.7, spec.seed + 31),
    materials.water
  );
  water.name = `${stage.name}-water`;
  water.position.y = 0.09;
  water.castShadow = false;
  water.renderOrder = 3;
  stage.add(water);

  // Sparse low-poly shore stones break the plate-like ellipse and stitch the
  // overlapping white terraces into one hand-cut descending slope.
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2 + (spec.seed % 11) * 0.07;
    const shoreStone = rangePart(
      new THREE.IcosahedronGeometry(0.72 + (i % 3) * 0.13, 0),
      i % 3 === 0 ? materials.whiteStoneShade : materials.whiteStone,
      `${stage.name}-shore-stone`,
      0.018
    );
    shoreStone.position.set(
      Math.cos(angle) * spec.rx * 0.88,
      0.17 + (i % 2) * 0.08,
      Math.sin(angle) * spec.rz * 0.85
    );
    shoreStone.scale.set(1.35 + (i % 2) * 0.25, 0.38, 0.95);
    shoreStone.rotation.y = -angle + i * 0.11;
    stage.add(shoreStone);
  }
  return stage;
}

/**
 * Solve the highest site-axis elevation at which every bottom vertex of a
 * tangent-plane footprint is on or below the spherical ground. The strictest
 * (furthest/lowest) vertex touches exactly; all other underside vertices bite
 * into the terrain instead of floating above it.
 */
export function curvedFootprintGroundElevation(
  geometry,
  lx,
  lz,
  R,
  surfaceLift = BASE_LIFT
) {
  const position = geometry?.attributes?.position;
  const surfaceRadius = R + surfaceLift;
  if (!position) {
    return { elevation: surfaceLift, contactRadius: Math.hypot(lx, lz), surfaceRadius };
  }
  let elevation = Infinity;
  let contactRadius = 0;
  for (let index = 0; index < position.count; index++) {
    const localY = position.getY(index);
    if (localY >= -0.05) continue; // underside only; never sink to a top rim
    const tx = lx + position.getX(index);
    const tz = lz + position.getZ(index);
    const tangentRadius = Math.hypot(tx, tz);
    const surfaceAxis = Math.sqrt(Math.max(
      0,
      surfaceRadius * surfaceRadius - tangentRadius * tangentRadius
    ));
    const allowed = surfaceAxis - R - localY;
    if (allowed < elevation) {
      elevation = allowed;
      contactRadius = tangentRadius;
    }
  }
  return Number.isFinite(elevation)
    ? { elevation, contactRadius, surfaceRadius }
    : { elevation: surfaceLift, contactRadius: Math.hypot(lx, lz), surfaceRadius };
}

function buildPilgrimageWaterSteps(R, materials, contourSpec) {
  const waterSteps = new THREE.Group();
  waterSteps.name = "citadel-pilgrimage-water-steps";
  const metrics = citadelTerraceMetrics(contourSpec);
  const stageSpecs = [
    { name: "terrace-1-pool", x: 3.0, z: 17.0, rx: 5.8, rz: 3.5, depth: 0.9, seed: 9300 },
    { name: "terrace-2-pool", x: 4.3, z: 21.5, rx: 6.3, rz: 3.8, depth: 1.0, seed: 9301 },
    { name: "terrace-3-pool", x: 3.2, z: 26.0, rx: 6.9, rz: 4.2, depth: 1.15, seed: 9302 },
    { name: "terrace-4-pool", x: 4.5, z: 31.0, rx: 7.8, rz: 4.8, depth: 1.3, seed: 9303 },
    { name: "terrace-5-pool", x: 1.0, z: 38.0, rx: 10.5, rz: 6.8, depth: 1.75, seed: 9304 },
  ];
  const stages = stageSpecs.map((spec) => buildWhiteStoneLakeStage(spec, materials));
  const lowestIndex = stages.length - 1;
  const lowestSpec = stageSpecs[lowestIndex];
  const lowestBank = stages[lowestIndex].getObjectByName(
    `citadel-${lowestSpec.name}-white-stone-bank`
  );
  const grounding = curvedFootprintGroundElevation(
    lowestBank.geometry,
    lowestSpec.x,
    lowestSpec.z,
    R
  );
  // One common base offset preserves all authored adjacent lake drops while
  // lowering the complete five-pool/four-waterfall system until the lowest
  // white-stone underside actually meets the curved ground.
  const containerBaseLift = grounding.elevation - metrics[lowestIndex].top;
  waterSteps.userData.curvatureGrounding = {
    contactRadius: grounding.contactRadius,
    contactElevation: grounding.elevation,
    surfaceRadius: grounding.surfaceRadius,
    containerBaseLift,
  };
  for (let i = 0; i < stageSpecs.length; i++) {
    const spec = stageSpecs[i];
    const stage = stages[i];
    const elevation = containerBaseLift + metrics[i].top;
    placeRangeAssetAtElevation(stage, spec.x, spec.z, R, elevation);
    stage.userData.composition = {
      sequence: i,
      terraceIndex: i,
      kind: i === stageSpecs.length - 1 ? "lowest-terrace-pool" : "stepped-pool",
      localElevation: elevation + 0.09,
      rx: spec.rx,
      rz: spec.rz,
      curvatureGrounded: true,
    };
    waterSteps.add(stage);
  }
  return waterSteps;
}

function buildPilgrimageCascades(R, waterSteps, materials) {
  const cascades = new THREE.Group();
  cascades.name = "citadel-pilgrimage-layered-cascades";
  for (let i = 0; i < waterSteps.children.length - 1; i++) {
    const upper = waterSteps.children[i];
    const lower = waterSteps.children[i + 1];
    const upperWaterY = upper.position.dot(_site) + 0.09;
    const lowerWaterY = lower.position.dot(_site) + 0.09;
    const drop = upperWaterY - lowerWaterY;
    const connectorX = (upper.userData.rangeLocal.lx + lower.userData.rangeLocal.lx) * 0.5;
    const connectorZ = (upper.userData.rangeLocal.lz + lower.userData.rangeLocal.lz) * 0.5 + 0.3;

    const waterfall = createMangaWaterfall({
      topY: drop,
      waterlineY: 0,
      seed: 9700 + i,
    });
    const spillwayCliff = rangePart(
      new THREE.BoxGeometry(6.2, drop + 0.9, 0.9),
      materials.whiteStoneShade,
      "citadel-waterfall-white-stone-spillway-cliff",
      0.024
    );
    spillwayCliff.position.set(0, drop * 0.5 - 0.05, -0.62);
    waterfall.add(spillwayCliff);

    // The exposed curtain is shifted toward the facade, so extend the actual
    // downstream lake beneath its impact point. This patch is coplanar with
    // the lower pool, overlaps that pool, and receives the curtain's -0.5
    // waterline penetration instead of leaving mist over bare loess.
    const receivingWater = new THREE.Mesh(
      new THREE.CircleGeometry(3.7, 28),
      materials.water
    );
    receivingWater.name = "citadel-cascade-receiving-water";
    receivingWater.rotation.x = -Math.PI / 2;
    receivingWater.position.set(
      (lower.userData.rangeLocal.lx - connectorX) * 0.5,
      0.003,
      (lower.userData.rangeLocal.lz - connectorZ) * 0.5
    );
    receivingWater.scale.z = 0.76;
    receivingWater.castShadow = false;
    receivingWater.renderOrder = 7;
    waterfall.add(receivingWater);
    waterfall.userData.receivingPool = lower.name;

    waterfall.userData.rebuiltSoilShoulders = 0;
    const connectorBase = rangeLocalToWorld(
      connectorX,
      connectorZ,
      R,
      new THREE.Vector3()
    ).dot(_site);
    placeRangeAsset(
      waterfall,
      connectorX,
      connectorZ,
      R,
      lowerWaterY - connectorBase,
      true
    );
    const facadeClearance = [1.2, 1.6, 2.0, 2.4][i];
    waterfall.translateZ(facadeClearance);
    waterfall.scale.x = 1.16;
    // Re-center the receiving extension between the shifted impact point and
    // the original lower lake so both water surfaces visibly overlap.
    receivingWater.position.z -= facadeClearance * 0.5;
    waterfall.userData.sequence = i;
    waterfall.userData.upperPool = upper.name;
    waterfall.userData.lowerPool = lower.name;
    waterfall.userData.actualDrop = drop;
    waterfall.userData.spansTerraceCount = 1;
    waterfall.userData.upperTerraceIndex = i;
    waterfall.userData.lowerTerraceIndex = i + 1;
    waterfall.userData.facadeClearance = facadeClearance;
    waterfall.userData.deployedCurtainWidth = 4.5 * waterfall.scale.x;
    waterfall.userData.waterlinePenetration = 0.5;
    cascades.add(waterfall);
  }
  const update = (dt, t) => {
    for (const waterfall of cascades.children) waterfall.update?.(dt, t);
  };
  cascades.update = update;
  cascades.userData.update = update;
  cascades.userData.waterfallCount = cascades.children.length;
  cascades.userData.spansTerraceCount = 1;
  return cascades;
}

function buildPilgrimageLookout(R, materials) {
  const lookout = new THREE.Group();
  lookout.name = "citadel-pilgrimage-lookout-stones";
  const stoneSpecs = [
    { x: -6.2, z: 53.0, r: 2.9, sx: 1.55, sz: 1.15, seed: 9400 },
    { x: -0.6, z: 54.2, r: 3.15, sx: 1.7, sz: 1.2, seed: 9401, viewpoint: true },
    { x: 5.5, z: 52.6, r: 2.7, sx: 1.65, sz: 1.1, seed: 9402 },
    { x: 9.8, z: 55.0, r: 2.35, sx: 1.45, sz: 1.05, seed: 9403 },
  ];
  const viewpoint = new THREE.Vector3();
  for (let i = 0; i < stoneSpecs.length; i++) {
    const spec = stoneSpecs[i];
    const stone = rangePart(
      new THREE.IcosahedronGeometry(spec.r, 1),
      i % 2 === 0 ? materials.whiteStoneShade : materials.whiteStone,
      "citadel-lookout-flat-stone",
      0.028
    );
    stone.scale.set(spec.sx, 0.2, spec.sz);
    placeRangeAsset(stone, spec.x, spec.z, R, 0.22, true);
    stone.rotateY((spec.seed % 9) * 0.13);
    stone.userData.isMessengerViewpoint = Boolean(spec.viewpoint);
    lookout.add(stone);
    if (spec.viewpoint) viewpoint.copy(stone.position).addScaledVector(_site, 0.64);
  }
  lookout.userData.viewpoint = viewpoint;
  lookout.userData.lookDirection = rangeLocalToWorld(0, 0, R, new THREE.Vector3())
    .sub(viewpoint)
    .normalize();
  return lookout;
}

function buildRangeShrub(name, scale, materials, seed) {
  const shrub = new THREE.Group();
  shrub.name = name;
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const trunk = rangePart(
    new THREE.CylinderGeometry(0.07 * scale, 0.11 * scale, 0.24 * scale, 5),
    materials.bark,
    `${name}-trunk`,
    0.01
  );
  trunk.position.y = 0.1 * scale;
  shrub.add(trunk);
  for (let i = 0; i < 5; i++) {
    const crown = rangePart(
      new THREE.IcosahedronGeometry((0.38 + random() * 0.18) * scale, 0),
      i === 1 ? materials.leafLight : materials.leaf,
      `${name}-crown`,
      0.015
    );
    const angle = (i / 5) * Math.PI * 2;
    crown.position.set(
      Math.cos(angle) * (0.34 + random() * 0.2) * scale,
      (0.26 + random() * 0.22) * scale,
      Math.sin(angle) * (0.34 + random() * 0.2) * scale
    );
    shrub.add(crown);
  }
  return shrub;
}

function addTarnTreeLimb(parent, start, end, radiusBottom, radiusTop, material, name) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const limb = rangePart(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 7),
    material,
    name,
    0.035
  );
  limb.position.copy(start).add(end).multiplyScalar(0.5);
  limb.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  parent.add(limb);
  return limb;
}

function buildSacredTarnTree(materials) {
  const tree = new THREE.Group();
  tree.name = "citadel-sacred-tarn-elder-tree";

  addTarnTreeLimb(
    tree,
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.45, 15.5, 0.35),
    1.45,
    0.72,
    materials.bark,
    "tarn-elder-tree-trunk"
  );
  addTarnTreeLimb(
    tree,
    new THREE.Vector3(-0.45, 14.2, 0.35),
    new THREE.Vector3(-1.2, 24.2, -0.4),
    0.76,
    0.34,
    materials.bark,
    "tarn-elder-tree-trunk"
  );

  const branchSpecs = [
    [[-0.2, 10.2, 0.2], [-6.4, 17.7, 0.8], 0.6, 0.2],
    [[-0.4, 12.4, 0.1], [5.9, 19.6, -1.4], 0.58, 0.19],
    [[-0.7, 15.4, 0.0], [-5.0, 22.3, 3.4], 0.48, 0.16],
    [[-0.8, 16.8, -0.1], [4.5, 23.7, 2.8], 0.46, 0.15],
    [[-1.0, 19.8, -0.25], [-1.6, 27.0, -0.8], 0.38, 0.12],
  ];
  for (const [from, to, bottom, top] of branchSpecs) {
    addTarnTreeLimb(
      tree,
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
      bottom,
      top,
      materials.bark,
      "tarn-elder-tree-branch"
    );
  }

  const crownSpecs = [
    [-6.2, 18.2, 0.8, 3.7, 1.2, 0.85],
    [-4.0, 21.2, 2.7, 3.4, 1.15, 0.9],
    [5.5, 20.1, -1.2, 4.0, 1.25, 0.88],
    [4.0, 23.3, 2.5, 3.35, 1.1, 0.92],
    [-1.8, 26.2, -0.6, 4.1, 1.05, 0.95],
    [1.7, 25.0, -1.0, 3.35, 1.1, 0.86],
    [-3.4, 23.6, -2.2, 3.15, 1.2, 0.82],
    [0.2, 28.2, 0.5, 3.25, 1.0, 0.92],
  ];
  crownSpecs.forEach(([x, y, z, radius, sx, sy], index) => {
    const crown = rangePart(
      new THREE.SphereGeometry(radius, 9, 6),
      index % 3 === 0 ? materials.leafLight : materials.leaf,
      "tarn-elder-tree-crown",
      0.028
    );
    crown.position.set(x, y, z);
    crown.scale.set(sx, sy, 1.0 + (index % 2) * 0.12);
    tree.add(crown);
  });

  // Sparse hanging strands give the tree a humid lake-marsh character without
  // turning the silhouette into a dense curtain in front of the citadel.
  for (let i = 0; i < 5; i++) {
    const strand = rangePart(
      new THREE.CylinderGeometry(0.045, 0.065, 4.8 + (i % 2) * 1.7, 5),
      materials.leaf,
      "tarn-elder-tree-hanging-vine",
      0.012
    );
    strand.position.set(-5.2 + i * 2.6, 17.4 + (i % 3) * 1.4, 1.0 + (i % 2) * 1.6);
    strand.rotation.z = (i - 2) * 0.035;
    tree.add(strand);
  }
  tree.userData.canopyHeight = 31.5;
  return tree;
}

function buildLakeBallShrub(name, scale, materials, seed) {
  const shrub = new THREE.Group();
  shrub.name = name;
  const trunk = rangePart(
    new THREE.CylinderGeometry(0.09 * scale, 0.14 * scale, 0.5 * scale, 6),
    materials.bark,
    `${name}-trunk`,
    0.01
  );
  trunk.position.y = 0.2 * scale;
  shrub.add(trunk);

  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + (seed % 17) * 0.05;
    const crown = rangePart(
      new THREE.SphereGeometry((0.5 + (i % 2) * 0.12) * scale, 8, 5),
      i === 1 ? materials.leafLight : materials.leaf,
      `${name}-ball-crown`,
      0.016
    );
    crown.position.set(
      Math.cos(angle) * 0.38 * scale,
      (0.55 + (i % 2) * 0.18) * scale,
      Math.sin(angle) * 0.38 * scale
    );
    shrub.add(crown);
  }
  return shrub;
}

/**
 * 构建山脉高度场网格（视觉=碰撞共用 citadelRangeLiftLocal）。
 * 顶点色：谷地草绿 → 坡面土褐 → 峰顶岩灰；flatShading 硬切面。
 */
export function buildCitadelRange(scene, R, contourSpec = CITADEL.contourTerrain) {
  configureCitadelWalkTerrain(R, contourSpec);
  const nx = Math.round((LX_MAX - LX_MIN) / STEP) + 1;
  const nz = Math.round((LZ_MAX - LZ_MIN) / STEP) + 1;
  const positions = new Float32Array(nx * nz * 3);
  const colors = new Float32Array(nx * nz * 3);
  const tmp = new THREE.Vector3();
  // 配色坡道：配合圣城暖色盘（奶白/鎏金/红砖），弃用冷青灰 ——
  // 谷地灰草绿 → 坡面砂石土黄 → 峰顶淡黄绿砂石（Sable 式沙漠圣城）
  const grass = new THREE.Color(0x6d8a63); // 谷地灰草绿（去饱和）
  const soil = new THREE.Color(0xb3a577); // 坡面砂石土黄
  const mesa = new THREE.Color(0xc9c096); // 峰顶淡黄绿砂石（圣城底座）
  const mix = new THREE.Color();
  // 砂石颗粒感：逐顶点微亮度抖动（确定性 lcg，与种子绑定）
  let grain = 20260808 >>> 0;
  const grainRnd = () => {
    grain = (Math.imul(1664525, grain) + 1013904223) >>> 0;
    return grain / 0x100000000;
  };

  let vi = 0;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++, vi++) {
      const lx = LX_MIN + ix * STEP;
      const lz = LZ_MIN + iz * STEP;
      const lift = citadelRangeLiftLocal(lx, lz);
      rangeLocalToWorld(lx, lz, R, tmp);
      positions[vi * 3] = tmp.x;
      positions[vi * 3 + 1] = tmp.y;
      positions[vi * 3 + 2] = tmp.z;
      // 基线→灰草绿；>6 砂石土黄；>11 淡黄绿砂石（峰顶平台）
      const tSoil = THREE.MathUtils.clamp((lift - BASE_LIFT) / 6, 0, 1);
      const tMesa = THREE.MathUtils.clamp((lift - 11) / 4, 0, 1);
      mix.copy(grass).lerp(soil, tSoil).lerp(mesa, tMesa);
      const g = 0.955 + grainRnd() * 0.09; // ±4.5% 砂石颗粒
      colors[vi * 3] = Math.min(1, mix.r * g);
      colors[vi * 3 + 1] = Math.min(1, mix.g * g);
      colors[vi * 3 + 2] = Math.min(1, mix.b * g);
    }
  }

  const indices = [];
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const rangeMaterial = toonMat(0xffffff, { vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, rangeMaterial);
  mesh.name = "citadel-range";
  mesh.userData.baseLift = BASE_LIFT;
  mesh.userData.formerSoilMoundRemoved = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const materials = {
    mountain: toonMat(0x7893a1, { flatShading: true }),
    snow: toonMat(0xf1f4ed, { flatShading: true }),
    outpost: toonMat(0xd6dcd9, { flatShading: true }),
    ink: toonMat(0x25292b, { flatShading: true }),
    leaf: toonMat(0x385e3e, { flatShading: true }),
    leafLight: toonMat(0x6f8b55, { flatShading: true }),
    bark: toonMat(0x57462f, { flatShading: true }),
    whiteStone: toonMat(0xdde3df, { flatShading: true }),
    whiteStoneShade: toonMat(0xbcc8c6, { flatShading: true }),
    water: new THREE.MeshBasicMaterial({
      color: 0x6f9ea5,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };

  // A continuous white-stone pilgrimage slope descends from the gate through
  // four shallow pools into a broad ground-level tarn. Wide flat stones on
  // the near bank form a safe visual overlook toward the citadel and massif.
  let normalizedContour = normalizeCitadelTerrain(contourSpec);
  let pilgrimageWaterSteps = buildPilgrimageWaterSteps(R, materials, normalizedContour);
  scene.add(pilgrimageWaterSteps);
  let pilgrimageCascades = buildPilgrimageCascades(R, pilgrimageWaterSteps, materials);
  scene.add(pilgrimageCascades);
  // Preserve the old shot-harness camera datum without retaining its four
  // visible lookout-stone props in the live scene.
  const pilgrimageLookout = new THREE.Group();
  pilgrimageLookout.name = "citadel-pilgrimage-lookout-camera-datum";
  const lookoutViewpoint = rangeLocalToWorld(-0.6, 54.2, R, new THREE.Vector3())
    .addScaledVector(_site, 0.86);
  pilgrimageLookout.userData.viewpoint = lookoutViewpoint;
  pilgrimageLookout.userData.lookDirection = rangeLocalToWorld(0, 0, R, new THREE.Vector3())
    .sub(lookoutViewpoint)
    .normalize();

  // One dominant marsh elder anchors the deep tarn's left bank. Its broad
  // crown remains offset from the central sightline between messenger and
  // citadel, while the smaller lake-edge vegetation stays strictly spherical.
  const sacredTarnTree = buildSacredTarnTree(materials);
  placeRangeAsset(sacredTarnTree, -15.2, 42.0, R, -0.15, true);
  scene.add(sacredTarnTree);

  // ---------- 城堡背后雪山：面对城堡时左右各一组 ----------
  // 站点局部：lz+ = 主岛/正门朝向；站在正门前看城堡时，-lx 为左、+lx 为右，
  // -lz 为城堡背后。两组雪山落在后侧左右翼，环抱城堡。
  const snowMountains = new THREE.Group();
  snowMountains.name = "citadel-background-snow-massif";
  const snowLeft = createSnowMassif({
    name: "citadel-snow-massif-left",
    seed: 7200,
  });
  snowLeft.scale.setScalar(0.88);
  placeRangeAsset(snowLeft, -54, -56, R, -1.2, true);
  // 略外旋，让峰群向左翼展开
  snowLeft.rotateY(0.45);
  snowMountains.add(snowLeft);

  const snowRight = createSnowMassif({
    name: "citadel-snow-massif-right",
    seed: 7300,
  });
  snowRight.scale.setScalar(0.88);
  placeRangeAsset(snowRight, 54, -56, R, -1.2, true);
  snowRight.rotateY(-0.45);
  snowMountains.add(snowRight);
  scene.add(snowMountains);

  // ---------- 护城河：环绕第五层台地外侧（baseRadius=24 之外）----------
  // 不改动五层台面 / contourTerrain；仅在墙脚外铺平涂环带水面 + 低模岸壁。
  // 圆心与城堡台地圆心对齐（lx=0,lz=0）；港口建议锚点在 userData.harborPadLocal。
  const moat = createCitadelMoat({ name: "citadel-moat", seed: 8801 });
  // 落到【与第一颗参天大树同一球面地表】：以球面真实半径取该切向半径处的地表 Y，
  // 外环随球面径向定向（注意曲率），与落地参天树、港口、古战船齐平。
  const moatR = CITADEL_MOAT_SPEC.outerRadius; // ≈33.2，与 CITADEL_MOAT_SPEC 一致
  const moatLift = sphericalGroundLift(moatR, 0, R) + 0.04;
  placeRangeAsset(moat, 0, 0, R, moatLift, false); // false：沿球面径向定向（注意曲率）
  scene.add(moat);

  const rangeSystem = {
    mesh,
    loessGroundSeal: null,
    castleFooting: null,
    foregroundTower: null,
    pilgrimageWaterSteps,
    pilgrimageCascades,
    interCascadeBridgePool: null,
    pilgrimageLookout,
    sacredTarnTree,
    lakeBallShrubs: null,
    snowMountains,
    snowMassifLeft: snowLeft,
    snowMassifRight: snowRight,
    moat,
    vegetation: null,
    siteDir: _site.clone(),
    fwd: _fwd.clone(),
    right: _right.clone(),
  };

  // The terrain editor can change any terrace radius/height at runtime. Rebuild
  // only the five lakes and four adjacent drops so a stale waterfall can never
  // span two edited terraces.
  rangeSystem.rebuildWaterTerraces = (nextContour = CITADEL.contourTerrain) => {
    normalizedContour = normalizeCitadelTerrain(nextContour);
    configureCitadelWalkTerrain(R, normalizedContour);
    scene.remove(pilgrimageWaterSteps, pilgrimageCascades);
    for (const group of [pilgrimageWaterSteps, pilgrimageCascades]) {
      group.traverse((object) => object.geometry?.dispose?.());
    }
    pilgrimageWaterSteps = buildPilgrimageWaterSteps(R, materials, normalizedContour);
    pilgrimageCascades = buildPilgrimageCascades(R, pilgrimageWaterSteps, materials);
    scene.add(pilgrimageWaterSteps, pilgrimageCascades);
    rangeSystem.pilgrimageWaterSteps = pilgrimageWaterSteps;
    rangeSystem.pilgrimageCascades = pilgrimageCascades;
    rangeSystem.contourSpec = normalizedContour;
    return rangeSystem;
  };
  rangeSystem.contourSpec = normalizedContour;
  return rangeSystem;
}
