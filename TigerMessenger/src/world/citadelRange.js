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
import { canyonOffsetDir, canyonOffsetDirSmooth } from "./canyon.js";
import { P } from "../core/params.js";
import { toonMat, addOutline } from "../assets/toon.js";
import { createMangaWaterfall } from "./mangaWaterfall.js";
import {
  CITADEL,
  citadelCurvatureDrop,
  citadelTerraceMetrics,
  normalizeCitadelTerrain,
  CITADEL_CASCADE_POOL_SPECS,
  CITADEL_CASCADE_MARKER,
} from "./odysseyCitadel.js";

// 再导出，供编辑器等沿用 citadelRange 路径
export { CITADEL_CASCADE_POOL_SPECS, CITADEL_CASCADE_MARKER };
import { createSnowMassif } from "../assets/snowMassif.js";
import { createColossalVernacularTree } from "../assets/ancient.js";
import { createCitadelMoat, CITADEL_MOAT_SPEC } from "../assets/citadelMoat.js";
import { createCitadelTrojanHorse } from "../assets/citadelTrojanHorse.js";
import { createTieSoldier } from "../assets/harbor.js";
import { createCitadelNightInfiltration } from "./citadelInfiltration.js";
import { tickObjectSedation } from "./tranquilizer.js";
import { CANAL_WATER_LIFT, CANAL_HALF_WIDTH, CANAL_LIP_WIDTH, CANAL_BANK_COLOR, CANAL_LIP_COLOR, sweepPrism } from "./canalSystem.js";
import { createNavonaCanalPlaza } from "./navonaPlaza.js";

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
const MOAT_INNER = 38; // 护城河内径：内岸绿地低于护城河水面（城堡前方浸水）
const CITADEL_SINK = 0.6; // 城堡 + 护城河内岸绿地相对护城河水面的下沉量
// 木马固定落在第一层瀑布正下方的接水湖面，不再回退到港口前草地。
// 该净空对应模型车轮/底座离水面的微小间隙，保证“停在水面上”而不是沉入水体。
const HORSE_LAKE_CLEARANCE = 0.12;
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
  // 护城河内岸绿地相对护城河水面下沉：城堡台地外缘(radius=24)到护城河内径(38)
  // 的环带绿地全额下潜 CITADEL_SINK，让城堡前方绿地浸在护城河水面下；
  // 城堡台地外缘(24)处即达到全额，与城堡台地外缘(随容器下沉)曲率对齐；
  // 护城河内径(38)处仍全额（前方绿地浸入），护城河外(>38)不降（与护城河水面齐平）。
  // 城堡核心(r<24)不降（台面仍露出），被城堡台地实体覆盖；护城河内侧壁由
  // 加深 wallDepth 遮住 38 处阶跃。与域缘裙边互斥，避免过深。
  const innerR = Math.hypot(lx, lz);
  const CASTLE_RADIUS = 24;
  const inSkirt = edge < SKIRT_BAND ? edge / SKIRT_BAND : 1;
  if (innerR > CASTLE_RADIUS && innerR < MOAT_INNER && inSkirt > 0) {
    lift -= CITADEL_SINK * inSkirt;
  }
  return lift;
}

/** 局部坐标 → 可见地面抬升：山脉高度场网格只覆盖矩形域，域缘裙边（-0.7）
 *  是扎进球面遮缝的、在域外不可见；域外可见地面是星球网格的三角面。
 *  低分段球面的弦面比解析球面低 0.3~0.4（弦高差），单个三角面横跨 ~20m，
 *  稀疏采样插值追不上弦面，必须逐方向精确射线实测（峡谷位移已烘焙在
 *  网格内）。广场重建是一次性开销，按方向量化（~0.2m）缓存去重。 */
let _planetMesh = null;
let _groundRay = null;
const _groundLiftCache = new Map();
const _ro = new THREE.Vector3();
const _rd = new THREE.Vector3();
function planetSurfaceLiftDir(dir) {
  if (!_planetMesh || !_groundRay) return canyonOffsetDirSmooth(dir);
  // 强制逐三角求交：rebuild 发生在 scene.add 之前，几何 boundingSphere 可能陈旧，
  // Raycaster 默认包围球剪枝会误判 MISS → 回落解析值把广场埋进弦面。
  if (_planetMesh.geometry.boundingSphere) _planetMesh.geometry.boundingSphere = null;
  _ro.copy(dir).multiplyScalar(160 + 40);
  _groundRay.set(_ro, _rd.copy(dir).negate());
  const hit = _groundRay.intersectObject(_planetMesh, false)[0];
  return hit ? 40 - hit.distance : canyonOffsetDirSmooth(dir);
}
export function visibleGroundLiftLocal(lx, lz) {
  _o
    .copy(_site)
    .multiplyScalar(160)
    .addScaledVector(_right, lx)
    .addScaledVector(_fwd, lz)
    .normalize();
  const key =
    ((Math.round(_o.x * 500) + 500) * 1001 + (Math.round(_o.y * 500) + 500)) * 1001 +
    (Math.round(_o.z * 500) + 500);
  let lift = _groundLiftCache.get(key);
  if (lift === undefined) {
    lift = planetSurfaceLiftDir(_o);
    _groundLiftCache.set(key, lift);
  }
  return Math.max(citadelRangeLiftLocal(lx, lz), lift);
}

/**
 * 世界方向 → 山脉高程（域外恒 0，无分配）。
 * 供物理/选址合成：surfR = R + canyonOffsetDir(dir) + citadelRangeLiftDir(dir)
 */
/* 站心局部坐标 → 矩形域边界的有符号距离（正=域外；> SKIRT_BAND 即裙边过渡走完、纯平地） */
export function citadelRangeEdgeDist(lx, lz) {
  return -Math.min(lx - LX_MIN, LX_MAX - lx, lz - LZ_MIN, LZ_MAX - lz);
}

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

/** 局部坐标是否落在高度场有效域内（域外为裙边下潜/星球曲面，运河保持浮空）。 */
export function citadelRangeInBounds(lx, lz) {
  return lx >= LX_MIN && lx <= LX_MAX && lz >= LZ_MIN && lz <= LZ_MAX;
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
      terraceIndex,
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

const _horseTipQ = new THREE.Quaternion();
const _horseTipAxis = new THREE.Vector3(0, 0, 1);

/**
 * 木马倾倒：只看「白天拉扯绳索」的系绳班组（horse-tiedown-squad / tie-soldier）。
 * 夜潜行动士兵（citadelInfiltration）与倾倒判定完全无关。
 * @param {THREE.Object3D|null} horse
 * @param {number} dt
 */
function updateTrojanHorseTiedown(horse, dt) {
  if (!horse?.isObject3D) return;
  const squad =
    horse.userData.tiedownSquad || horse.getObjectByName("horse-tiedown-squad");
  if (!squad) return;
  if (!horse.userData.baseQuat) {
    horse.userData.baseQuat = horse.quaternion.clone();
  }
  const d = Math.min(0.05, Math.max(0, Number(dt) || 0));

  // 夜潜期间系绳班组会被隐藏：此时不倾倒、不读夜潜兵状态，木马回正
  const dayTiedownActive = squad.visible !== false;
  let n = 0;
  let sed = 0;
  let sumX = 0;
  if (dayTiedownActive) {
    for (const child of squad.children) {
      // 仅白天系绳兵：name=tie-soldier；跳过绳索网格与其它子节点
      if (child.name !== "tie-soldier" && child.userData?.kind !== "tieSoldier") {
        continue;
      }
      n++;
      if (child.userData.sedated) tickObjectSedation(child, d);
      if (child.userData.sedated && (child.userData.sedateT ?? 0) > 0) {
        sed++;
        sumX += child.position.x;
      }
    }
  }

  const ratio = n > 0 ? sed / n : 0;
  const targetTip = dayTiedownActive ? ratio * 0.58 : 0; // 最多约 33°；夜间强制 0
  let tip = horse.userData.tipAmount ?? 0;
  tip += (targetTip - tip) * Math.min(1, d * 2.6);
  if (tip < 0.001 && targetTip < 0.001) {
    // 系绳班全员清醒（或夜潜中）：跟手编辑器拖拽后的姿态，作为新基准
    horse.userData.tipAmount = 0;
    horse.userData.baseQuat.copy(horse.quaternion);
    return;
  }
  horse.userData.tipAmount = tip;
  if (sed > 0) horse.userData.tipSign = sumX >= 0 ? 1 : -1;
  const sign = horse.userData.tipSign || 1;
  // 局部滚转倾倒（Z 轴），保留放置朝向
  _horseTipQ.setFromAxisAngle(_horseTipAxis, tip * sign);
  horse.quaternion.copy(horse.userData.baseQuat).multiply(_horseTipQ);
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

/**
 * 把雪山底脚整体压进球面：大足迹在曲面上会「外缘悬空」，
 * 采样山脚一带顶点的世界半径，沿锚点径向多轮内推到 maxR ≤ planetR - bury。
 * （一次平移对外缘顶点的径向收缩 < 平移量，故需迭代。）
 * @param {THREE.Object3D} massif
 * @param {number} planetR
 * @param {number} [bury=2] 山脚相对球面再下埋的余量
 */
function embedSnowMassifBase(massif, planetR, bury = 2) {
  const v = new THREE.Vector3();
  const center = new THREE.Vector3();
  const up = new THREE.Vector3();
  const skirtH = 6 * (massif.scale?.x || 1);
  const targetMaxR = planetR - bury;
  let lastMaxBaseR = 0;
  let totalPush = 0;

  for (let pass = 0; pass < 8; pass++) {
    massif.updateMatrixWorld(true);
    center.copy(massif.position);
    up.copy(center).normalize();
    let maxBaseR = 0;
    let sampleCount = 0;
    massif.traverse((obj) => {
      const pos = obj?.geometry?.attributes?.position;
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        obj.localToWorld(v);
        // 山脚带：相对锚点法线高度不超过 skirtH
        if (v.clone().sub(center).dot(up) > skirtH) continue;
        maxBaseR = Math.max(maxBaseR, v.length());
        sampleCount++;
      }
    });
    if (sampleCount === 0 || !Number.isFinite(maxBaseR)) break;
    lastMaxBaseR = maxBaseR;
    const overshoot = maxBaseR - targetMaxR;
    if (overshoot <= 0.05) break;
    // 外缘 cosθ < 1，单步多推一点以加快收敛
    const step = overshoot * 1.15;
    massif.position.addScaledVector(up, -step);
    totalPush += step;
  }

  massif.userData.sphereEmbed = {
    maxBaseR: lastMaxBaseR,
    targetMaxR,
    totalPush,
    bury,
  };
  return massif;
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

function buildEmptyWaterGroup(name) {
  const group = new THREE.Group();
  group.name = name;
  group.userData.cascadeEnabled = false;
  group.userData.waterfallCount = 0;
  group.userData.spansTerraceCount = 1;
  const update = () => {};
  group.update = update;
  group.userData.update = update;
  return group;
}

function buildPilgrimageWaterSteps(R, materials, contourSpec) {
  const normalized = normalizeCitadelTerrain(contourSpec);
  const waterSteps = new THREE.Group();
  waterSteps.name = "citadel-pilgrimage-water-steps";
  waterSteps.userData.cascadeEnabled = normalized.cascadeEnabled;
  waterSteps.userData.cascadePoolsEnabled = normalized.cascadePoolsEnabled;
  if (!normalized.cascadeEnabled || !normalized.cascadePoolsEnabled) {
    // 瀑布总开关关：无瀑布无湖；湖开关关：瀑布独立挂帘（buildPilgrimageCascades
    // 改走台地落差锚点），本组为空——台面全部让给建筑。
    waterSteps.userData.curvatureGrounding = {
      contactRadius: 0,
      contactElevation: 0,
      surfaceRadius: R,
      containerBaseLift: 0,
    };
    return waterSteps;
  }
  const metrics = citadelTerraceMetrics(normalized);
  const stageSpecs = CITADEL_CASCADE_POOL_SPECS;
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

function buildPilgrimageCascades(R, waterSteps, materials, contourSpec = null) {
  const normalized = normalizeCitadelTerrain(contourSpec ?? CITADEL.contourTerrain);
  if (!normalized.cascadeEnabled) {
    return buildEmptyWaterGroup("citadel-pilgrimage-layered-cascades");
  }
  // 湖开关关闭（瀑布独立模式）：不再依赖梯湖组，按台地 metrics 落差挂帘。
  // 锚点沿用各台地梯湖池心坐标（与湖模式同位置），帘高 = 相邻台地 top 差。
  const poolsOff = !normalized.cascadePoolsEnabled || !waterSteps?.children?.length;
  const cascades = new THREE.Group();
  cascades.name = "citadel-pilgrimage-layered-cascades";
  cascades.userData.cascadeEnabled = true;
  cascades.userData.cascadePoolsEnabled = normalized.cascadePoolsEnabled;
  cascades.userData.waterfallCount = 0;

  const metrics = citadelTerraceMetrics(normalized);
  const count = poolsOff ? metrics.length - 1 : waterSteps.children.length - 1;

  for (let i = 0; i < count; i++) {
    const upper = poolsOff ? null : waterSteps.children[i];
    const lower = poolsOff ? null : waterSteps.children[i + 1];
    let upperWaterY, lowerWaterY, connectorX, connectorZ;
    if (poolsOff) {
      // 独立模式：帘顶 = 上台地台面，帘脚 = 下台地台面；水平位置用池心 + 前缘偏置
      upperWaterY = metrics[i].top;
      lowerWaterY = metrics[i + 1].top;
      const upperSpec = CITADEL_CASCADE_POOL_SPECS[i];
      const lowerSpec = CITADEL_CASCADE_POOL_SPECS[i + 1];
      connectorX = (upperSpec.x + lowerSpec.x) * 0.5;
      connectorZ = (upperSpec.z + lowerSpec.z) * 0.5 + 0.3;
    } else {
      upperWaterY = upper.position.dot(_site) + 0.09;
      lowerWaterY = lower.position.dot(_site) + 0.09;
      connectorX = (upper.userData.rangeLocal.lx + lower.userData.rangeLocal.lx) * 0.5;
      connectorZ = (upper.userData.rangeLocal.lz + lower.userData.rangeLocal.lz) * 0.5 + 0.3;
    }
    const drop = upperWaterY - lowerWaterY;

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
      poolsOff ? 0 : (lower.userData.rangeLocal.lx - connectorX) * 0.5,
      0.003,
      poolsOff ? 0 : (lower.userData.rangeLocal.lz - connectorZ) * 0.5
    );
    receivingWater.scale.z = 0.76;
    receivingWater.castShadow = false;
    receivingWater.renderOrder = 7;
    waterfall.add(receivingWater);
    waterfall.userData.receivingPool = poolsOff ? null : lower.name;

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
    waterfall.userData.upperPool = poolsOff ? null : upper.name;
    waterfall.userData.lowerPool = poolsOff ? null : lower.name;
    waterfall.userData.actualDrop = drop;
    waterfall.userData.spansTerraceCount = 1;
    waterfall.userData.upperTerraceIndex = i;
    waterfall.userData.lowerTerraceIndex = i + 1;
    waterfall.userData.facadeClearance = facadeClearance;
    waterfall.userData.deployedCurtainWidth = 4.5 * waterfall.scale.x;
    waterfall.userData.waterlinePenetration = 0.5;
    cascades.add(waterfall);
    cascades.userData.waterfallCount++;
  }
  const update = (dt, t) => {
    for (const waterfall of cascades.children) waterfall.update?.(dt, t);
  };
  cascades.update = update;
  cascades.userData.update = update;
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

/**
 * 港口深潭太古巨木（士兵装货栈桥旁 · 仅此双株使用 createColossalVernacularTree）
 */
function buildSacredTarnTree(_materials) {
  const tree = createColossalVernacularTree({
    seed: 9901,
    merge: true,
    namePrefix: "tarn-elder-tree",
    groupName: "citadel-sacred-tarn-elder-tree",
  });
  tree.userData.kind = "sacredTarnElderTree";
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
  // 射线基准需要星球网格；重建前先就位，供 visibleGroundLiftLocal 实测弦面
  _planetMesh = null;
  scene.traverse((o) => {
    if (!_planetMesh && o.name === "planet-surface") _planetMesh = o;
  });
  if (_planetMesh) {
    _planetMesh.updateWorldMatrix(true, false);
    _groundRay = new THREE.Raycaster();
    _groundRay.far = 60;
  }
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
      // 缠绕须朝球心外侧（与其余网格一致）：原 (a,c,b) 朝内，
      // 导致向下 Raycast 全部命中背面被剔除、flatShading 光照反向。
      indices.push(a, b, c, b, d, c);
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
    // 与运河/护城河统一水色（0x3a86a0）；梯湖/水帘同属地表水系
    water: new THREE.MeshBasicMaterial({
      color: 0x3a86a0,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };

  // 层叠瀑布 + 五级梯湖：可由编辑器 cascadeEnabled 开关。
  // 开启时：窄扇区开槽 + 五湖四帘；关闭时：完整台面，水系组为空。
  let normalizedContour = normalizeCitadelTerrain(contourSpec);
  let pilgrimageWaterSteps = buildPilgrimageWaterSteps(R, materials, normalizedContour);
  scene.add(pilgrimageWaterSteps);
  let pilgrimageCascades = buildPilgrimageCascades(R, pilgrimageWaterSteps, materials, normalizedContour);
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

  // 第二棵太古巨木：港口深潭旁交错对生（仅港口双株，不影响全局松树）
  const tarnCompanionPine = createColossalVernacularTree({
    seed: 7788,
    merge: true,
    namePrefix: "tarn-companion",
    groupName: "citadel-tarn-companion-pine",
  });
  placeRangeAsset(tarnCompanionPine, -19.8, 44.2, R, -0.15, true);
  tarnCompanionPine.rotateY(1.05);
  scene.add(tarnCompanionPine);

  // ---------- 城堡背后雪山：面对城堡时左右各一组 ----------
  // 站点局部：lz+ = 主岛/正门朝向；站在正门前看城堡时，-lx 为左、+lx 为右，
  // -lz 为城堡背后。两组雪山落在后侧左右翼，环抱城堡。
  // 放大足迹后按球面曲率把山脚整圈压进地面；再径向外推，
  // 使山脚完全退出台地空间（range-r ≥ 台地5 外缘 + 净空）。
  const snowMountains = new THREE.Group();
  snowMountains.name = "citadel-background-snow-massif";
  const SNOW_MASSIF_SCALE = 1.35;
  const SNOW_MASSIF_BURY = 2.4;
  // 山脚净空：雪山整体退出台地空间（台地 5 外缘之外），台面留给搭建
  const SNOW_TERRACE_CLEARANCE = 4;

  /**
   * 临时贴地+朝向后，用 place 逆变换测山脚最小 range 径向。
   * footR = 峰心 range-r − 峰底半径×scale（不在埋脚后的世界位上测）。
   */
  function measureMassifMinFootR(massif, lxA, lzA, yaw) {
    placeRangeAsset(massif, lxA, lzA, R, 0, true);
    massif.rotateY(yaw);
    massif.updateMatrixWorld(true);
    const s = massif.scale?.x || 1;
    const wp = new THREE.Vector3();
    let minFoot = Infinity;
    for (const child of massif.children) {
      const rad = child.userData?.composition?.radius;
      if (!Number.isFinite(rad)) continue;
      child.getWorldPosition(wp);
      // place 逆：site*R + right*lx + fwd*lz ∥ worldPos
      const k = R / Math.max(1e-6, wp.dot(_site));
      const plx = k * wp.dot(_right);
      const plz = k * wp.dot(_fwd);
      const peakR = Math.hypot(plx, plz);
      const footR = peakR - rad * s * 0.92;
      if (footR < minFoot) minFoot = footR;
    }
    return Number.isFinite(minFoot) ? minFoot : Math.hypot(lxA, lzA);
  }

  /**
   * 将雪山组沿 range 平面径向外推，使山脚完全退出台地空间。
   * 目标山脚径向 ≥ 台地 5 外缘 + 净空（落在护城河外绿带），
   * 任何台地环带都不再被山体侵占。
   */
  function retreatSnowMassifFromInnerTerraces(massif, yaw, lx0, lz0, contour) {
    const terraces = contour?.terraces ?? CITADEL.contourTerrain.terraces;
    const t4 = terraces[3]?.radius ?? 21.6;
    const t5 = terraces[4]?.radius ?? 24.0;
    const targetMinFootR = t5 + SNOW_TERRACE_CLEARANCE;

    const minFootBefore = measureMassifMinFootR(massif, lx0, lz0, yaw);
    let lx = lx0;
    let lz = lz0;
    let push = 0;
    let minFoot = minFootBefore;

    for (let pass = 0; pass < 6; pass++) {
      minFoot = measureMassifMinFootR(massif, lx, lz, yaw);
      if (minFoot >= targetMinFootR - 0.08) break;
      const need = (targetMinFootR - minFoot) * 1.12 + 0.25;
      push += need;
      const r0 = Math.hypot(lx, lz) || 1;
      const r1 = r0 + need;
      lx = (lx / r0) * r1;
      lz = (lz / r0) * r1;
    }

    // 最终贴地 + 埋脚
    placeRangeAsset(massif, lx, lz, R, 0, true);
    massif.rotateY(yaw);
    embedSnowMassifBase(massif, R, SNOW_MASSIF_BURY);

    massif.userData.terraceClearance = {
      t4,
      t5,
      targetMinFootR,
      minFootRBefore: minFootBefore,
      minFootRAfter: minFoot,
      push,
      lx,
      lz,
    };
    return massif;
  }

  const snowLeft = createSnowMassif({
    name: "citadel-snow-massif-left",
    seed: 7200,
  });
  snowLeft.scale.setScalar(SNOW_MASSIF_SCALE);
  const leftYaw = 0.45;
  placeRangeAsset(snowLeft, -54, -56, R, 0, true);
  snowLeft.rotateY(leftYaw);
  embedSnowMassifBase(snowLeft, R, SNOW_MASSIF_BURY);
  retreatSnowMassifFromInnerTerraces(snowLeft, leftYaw, -54, -56, normalizedContour);
  snowMountains.add(snowLeft);

  const snowRight = createSnowMassif({
    name: "citadel-snow-massif-right",
    seed: 7300,
  });
  snowRight.scale.setScalar(SNOW_MASSIF_SCALE);
  const rightYaw = -0.45;
  placeRangeAsset(snowRight, 54, -56, R, 0, true);
  snowRight.rotateY(rightYaw);
  embedSnowMassifBase(snowRight, R, SNOW_MASSIF_BURY);
  retreatSnowMassifFromInnerTerraces(snowRight, rightYaw, 54, -56, normalizedContour);
  snowMountains.add(snowRight);
  scene.add(snowMountains);

  // ---------- 护城河：环绕圣城墙脚，落在星球曲面地表 ----------
  // 水面高度必须与运河一致（CANAL_WATER_LIFT），交接处同一水平面。
  // 旧曲率算法用 |worldPos| 当径向高度，把环带切向半径(~42)算进高度，
  // 外缘被抬高 ~5 单位，与运河水面严重错层——这里改为按足迹 (lx,lz)
  // 取高度场 + 结构高度重建，与运河 groundLift 同源。
  let moat = null;
  let moatMesh = null; // 前置声明，供 buildMoat 在 rangeSystem 初始化前写入
  let moatCanalPts = null; // 运河中心线 range 局部折线，供护城河护堤缺口
  let moatWalkPts = null; // 广场连港步道中线折线（range 局部），供护城河护堤开缺
  const buildMoat = (spec) => {
    if (moat) {
      scene.remove(moat);
      moat.traverse((object) => object.geometry?.dispose?.());
      moat = null;
    }
    const moatInner = spec?.inner ?? MOAT_INNER;
    const moatOuter = spec?.outer ?? 46;
    const moatHalf = (moatOuter - moatInner) * 0.5;
    // 护堤缺口：运河走廊内的弧段仅护堤断开，水面/河床连续 →
    // 护城河与运河打通且护堤不交叉。走廊半宽 = 运河护堤外缘(半宽+壁+埂≈8.1)
    // + 本环扫护堤自身径向展幅(half+埂≈5.4) + 余量，保证断开后无残体侵入走廊。
    // 南北两个交接点都开缺：北点齐平接通，南点（域缘裙边）水面随贴地
    // 形成小跌水，两侧护堤均断开、绝不交叉。
    const gapHalf = CANAL_HALF_WIDTH + CANAL_LIP_WIDTH + moatHalf + CANAL_LIP_WIDTH + 0.6;
    // 步道跨护城河处：仅护堤断开，水面/河床连续；缺口半宽盖住步道半宽(1.95)
    const gapWalkHalf = 2.6;
    const embankGapAt = (moatCanalPts || moatWalkPts)
      ? (lx, lz) => {
          for (let i = 0; moatCanalPts && i < moatCanalPts.length; i++) {
            const dx = lx - moatCanalPts[i][0];
            const dz = lz - moatCanalPts[i][1];
            if (dx * dx + dz * dz < gapHalf * gapHalf) return true;
          }
          for (let i = 0; moatWalkPts && i < moatWalkPts.length; i++) {
            const dx = lx - moatWalkPts[i][0];
            const dz = lz - moatWalkPts[i][1];
            if (dx * dx + dz * dz < gapWalkHalf * gapWalkHalf) return true;
          }
          return false;
        }
      : undefined;
    // 网格几何内水面局部 Y（createCitadelMoat 固定结构，不随编辑器高度改）
    const meshWaterY = CITADEL_MOAT_SPEC.waterY;
    // 水面相对当地地表抬升：默认 = 运河 CANAL_WATER_LIFT，保证交接同水平面
    // 编辑器「高度」写入 waterY，语义即相对地表（与运河同）
    const waterSurfaceLift = Number.isFinite(spec?.waterY)
      ? spec.waterY
      : CANAL_WATER_LIFT;
    // 球面曲率贴合强度：0=切平面平铺，1=完全贴高度场（默认）
    const moatCurvature = Number.isFinite(spec?.curvature)
      ? THREE.MathUtils.clamp(spec.curvature, 0, 2)
      : 1;
    // wallDepth 加深：内岸壁盖住前方浸水区
    moat = createCitadelMoat({
      name: "citadel-moat",
      seed: 8801,
      innerRadius: moatInner,
      outerRadius: moatOuter,
      wallDepth: 0.95,
      waterY: meshWaterY,
      embankGapAt,
    });
    // 组原点放在地表；水面在局部 y=meshWaterY。
    // 平铺时额外抬升 (waterSurfaceLift - meshWaterY)，使水面 = 地表 + waterSurfaceLift。
    // siteUpright：与圣城同轴，足迹 (lx,lz) 对齐高度场查询。
    const flatLift = waterSurfaceLift - meshWaterY;
    placeRangeAsset(moat, 0, 0, R, flatLift, true);
    scene.add(moat);
    moat.userData.harborPadLocal = { lx: -22.8, lz: 24.6, toWaterX: 0.66, toWaterZ: -0.75 };
    moat.userData.spec = {
      inner: moatInner,
      outer: moatOuter,
      waterY: waterSurfaceLift, // 相对地表（与运河 CANAL_WATER_LIFT 同语义）
      curvature: moatCurvature,
    };

    // ---------- 曲率贴合：按足迹 (lx,lz) 重建到球面+高度场 ----------
    // 对每个顶点：世界→组局部 → 取 (lx,lz) 与结构高度 structural=localY-meshWaterY
    // 目标半径 = R + citadelRangeLiftLocal(lx,lz) + waterSurfaceLift + structural
    // 与运河 groundLift/water 使用同一套高度源 → 交接处同水平面。
    if (moatCurvature > 1e-6) {
      moat.updateMatrixWorld(true);
      const _mv = new THREE.Vector3();
      const _local = new THREE.Vector3();
      const _flat = new THREE.Vector3();
      const _mwInv = new THREE.Matrix4().copy(moat.matrixWorld).invert();
      moat.traverse((obj) => {
        const pos = obj?.geometry?.attributes?.position;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          _mv.fromBufferAttribute(pos, i);
          obj.localToWorld(_mv);
          _flat.copy(_mv);
          _local.copy(_mv).applyMatrix4(_mwInv);
          const lx = _local.x;
          const lz = _local.z;
          const structural = _local.y - meshWaterY;
          const gridH = citadelRangeLiftLocal(lx, lz);
          const targetR = R + gridH + waterSurfaceLift + structural;
          rangeLocalToWorld(lx, lz, R, _mv);
          _mv.normalize().multiplyScalar(targetR);
          if (moatCurvature < 1 - 1e-6) {
            _mv.lerp(_flat, 1 - Math.min(1, moatCurvature));
          } else if (moatCurvature > 1 + 1e-6) {
            const up = _mv.clone().normalize();
            const over = (moatCurvature - 1) * (targetR - _flat.length());
            _mv.addScaledVector(up, over);
          }
          obj.worldToLocal(_mv);
          pos.setXYZ(i, _mv.x, _mv.y, _mv.z);
        }
        pos.needsUpdate = true;
      });
      // 水面动画以 baseY 为基高（createCitadelMoat 在平铺态捕获）：
      // 贴合后必须重捕，否则 update() 每帧把球面下凹的水面拉回平盘、浮离槽体。
      moat.traverse((obj) => {
        if (obj.name !== "citadel-moat-water" || !obj.geometry?.attributes?.position) return;
        const wp = obj.geometry.attributes.position;
        const baseY = new Float32Array(wp.count);
        for (let i = 0; i < wp.count; i++) baseY[i] = wp.getY(i);
        obj.geometry.userData.baseY = baseY;
      });
    }
    moatMesh = moat;
    return moat;
  };
  buildMoat(contourSpec?.moat);

  // ---------- 纳沃纳式双栖水利广场：运河进入城堡前 ----------
  // 运河环线在圣城附近的具体走向要等 buildWorldCanal 后才能确定，
  // 广场位置/朝向改为延迟摆放：rangeSystem.placeNavonaPlaza(lx, lz, yaw)，
  // 由 messengerIsland 按运河真实切向沿法线推离，保证河道全程露出、两者零重叠。
  // 旱季下凹石材广场+对称喷泉+运河同款围边；汛期同一槽体蓄水，与运河/护城河同水色。

  // 径向重建：把切平面构建的组逐顶点重建到 R + structural 的球面径向位置。
  // 组基架是站点切平面（Y=_site），但大足迹资产的顶点离站点越远，
  // 球面法向与 _site 夹角越大（广场中心处约 25°）——切平面 delta 类贴合
  // 会系统性错位，只有按顶点足迹 (lx,lz) 取真实径向才能严丝合缝。
  // 足迹用世界坐标径向投影回 range 切平面系（组可能带 yaw/偏移，
  // 组局部坐标只在原点无 yaw 摆放时才等于 range 局部）；
  // structural 的高度分量仍取组局部 y（组 up 即 _site）。
  const radialRebuild = (group, structuralAt) => {
    // 无父节点时 updateMatrixWorld 不会重算自身 matrixWorld（position 刚被
    // placeRangeAsset 改过会拿到旧值），必须先强制重组，否则逆变换错位。
    group.updateMatrix();
    group.updateMatrixWorld(true);
    const _rv = new THREE.Vector3();
    const _rl = new THREE.Vector3();
    const _rInv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    group.traverse((obj) => {
      const pos = obj?.geometry?.attributes?.position;
      // 描边壳子网格与父网格共享 geometry：若参与重建会把同一份顶点
      // 按壳子自身 matrixWorld 二次改写，造成整块几何径向错位（悬浮/下沉）。
      if (!pos || obj.userData?.isOutline) return;
      for (let i = 0; i < pos.count; i++) {
        _rv.fromBufferAttribute(pos, i);
        obj.localToWorld(_rv);
        _rl.copy(_rv).applyMatrix4(_rInv);
        // 世界坐标径向投影到 R 切平面 → range 局部足迹
        const sScale = R / Math.max(1e-6, _rv.dot(_site));
        const flx = _rv.dot(_right) * sScale;
        const flz = _rv.dot(_fwd) * sScale;
        rangeLocalToWorld(flx, flz, R, _rv); // 取足迹径向（其 lift 归一化后无关）
        _rv.normalize().multiplyScalar(R + structuralAt(flx, flz, _rl.y));
        obj.worldToLocal(_rv);
        pos.setXYZ(i, _rv.x, _rv.y, _rv.z);
      }
      pos.needsUpdate = true;
      obj.geometry.computeVertexNormals?.();
    });
    return group;
  };

  // 连港步道：广场 R 侧门洞 → 旧港码头陆侧，运河同款护堤语言。
  // 剖面：石板路面 + 两侧矮埂；纵断面 门侧地面 → 跨护城河桥面 → 港口砂基，
  // 跨护城河处护堤开弧缺（仅壁/埂断开，水面/河床连续），与运河交接同语义。
  const buildHarborCauseway = (plaza) => {
    let harbor = null;
    scene.traverse((o) => { if (!harbor && o.name === "old-harbor-scene") harbor = o; });
    if (!harbor || !plaza) return null;
    harbor.updateWorldMatrix(true, false);
    // 起点：广场 R 侧门洞中心（广场局部 +X 侧 wall 位）；终点：港口陆侧砂基外缘
    // 注意：广场组带 25° 切平面倾角，局部点 (9.7,0.85,0) 不是地表点；
    // 取其径向方向后拉回「地表 + 槽沿高 0.15」作为步道贴地起点。
    const gateRaw = new THREE.Vector3(9.7, 0.85, 0).applyMatrix4(plaza.matrixWorld);
    const gScale = R / Math.max(1e-6, gateRaw.dot(_site));
    const gfx = gateRaw.dot(_right) * gScale, gfz = gateRaw.dot(_fwd) * gScale;
    const gateGroundLift = visibleGroundLiftLocal(gfx, gfz);
    const gateW = gateRaw.clone().normalize().multiplyScalar(R + gateGroundLift + 0.97);
    const hx = new THREE.Vector3(1, 0, 0).applyQuaternion(harbor.quaternion);
    hx.addScaledVector(_site, -hx.dot(_site)).normalize();
    const endW = harbor.getWorldPosition(new THREE.Vector3()).addScaledVector(hx, -4.4);
    const gx = gateW.dot(_right) * gScale, gz = gateW.dot(_fwd) * gScale;
    const eScale = R / Math.max(1e-6, endW.dot(_site));
    const ex = endW.dot(_right) * eScale, ez = endW.dot(_fwd) * eScale;
    const dx = ex - gx, dz = ez - gz;
    const len = Math.hypot(dx, dz);
    if (!Number.isFinite(len) || len < 4) return null;
    // 断面横向（水平）；注意 placeRangeAsset 基架 X 轴 = _site×_fwd = -_right，
    // 组内几何的 x 分量需镜像后才能与 range 局部系对齐
    const rx = dz / len, rz = -dx / len;
    const N = 48;
    const smooth01 = (t) => t * t * (3 - 2 * t);
    const samples = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const px = gx + dx * t, pz = gz + dz * t;
      // 纵断面：门侧 +0.97（与广场铺装顶面 structural≈0.97 齐平，无台阶）
      // → 跨护城河桥面 1.55（盖过护堤埂顶 1.47）→ 港口贴当地可见地面
      const a = smooth01(THREE.MathUtils.clamp(t / 0.72, 0, 1));
      const b = smooth01(THREE.MathUtils.clamp((t - 0.72) / 0.28, 0, 1));
      // 全程至少高于可见地面 0.25，取高者保证不埋进地表（域内地形 +0.4，
      // 域外为星球弦面）。
      const deckTop = Math.max(
        THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.97, 1.55, a), visibleGroundLiftLocal(ex, ez) + 0.3, b),
        visibleGroundLiftLocal(px, pz) + 0.25
      );
      samples.push({
        p: new THREE.Vector3(-px, deckTop - 0.35, pz), // x 取负：镜像进组局部系
        up: new THREE.Vector3(0, 1, 0),
        right: new THREE.Vector3(-rx, 0, rz),
        deckTop,
      });
    }
    const walk = new THREE.Group();
    walk.name = "navona-harbor-causeway";
    const deckMat = toonMat(CANAL_BANK_COLOR, { flatShading: true });
    const lipMat = toonMat(CANAL_LIP_COLOR, { flatShading: true });
    const deck = sweepPrism(samples, -1.7, 1.7, 0, 0.35, deckMat);
    deck.name = "causeway-deck";
    walk.add(deck);
    for (const side of [-1, 1]) {
      const curb = sweepPrism(samples,
        side > 0 ? 1.7 : -1.95, side > 0 ? 1.95 : -1.7, 0.35, 0.5, lipMat);
      curb.name = `causeway-curb-${side > 0 ? "R" : "L"}`;
      walk.add(curb);
    }
    placeRangeAsset(walk, 0, 0, R, 0, true);
    scene.add(walk);
    // 径向重建：localY 即设计绝对抬升（已含离地间隙），直接当径向高度
    radialRebuild(walk, (_lx, _lz, y) => y);
    walk.userData.placement = { kind: "plaza-harbor-causeway", gate: [gx, gz], end: [ex, ez] };
    // 护城河护堤在步道跨越处开缺：折线（range 局部系，供 embankGapAt）
    moatWalkPts = samples
      .filter((s) => {
        const r = Math.hypot(s.p.x, s.p.z);
        return r > 36 && r < 52;
      })
      .map((s) => [-s.p.x, s.p.z]); // 还原回 range 局部系
    rangeSystem.rebuildMoat?.(contourSpec?.moat);
    return walk;
  };

  let navonaPlaza = null;
  let trojanHorse = null;
  let nightInfiltration = null;
  let _patrolCastle = null; // 供地形热重建后重新计算潜入路线使用
  let computeInfiltrationRoutes = null; // 提升到本作用域，供 rebuildWaterTerraces 复用
  const placeNavonaPlaza = (lx, lz, yaw, patrolCastle = null) => {
    if (navonaPlaza) return navonaPlaza; // 幂等：只摆一次（conform 会永久改写顶点）
    navonaPlaza = createNavonaCanalPlaza({
      name: "citadel-navona-canal-plaza",
      seed: 7701,
      flooded: false,
      // R 侧（局部 +X，yaw=π/2 后朝港口/护城河一侧）开 5.2 宽门洞，连港步道由此接入
      gate: { side: "R", width: 5.2 },
    });
    // 长轴（局部 +Z）沿传入 yaw 对齐运河切向，围边与运河同语言
    placeRangeAsset(navonaPlaza, lx, lz, R, CANAL_WATER_LIFT * 0.15, true);
    navonaPlaza.rotateY(yaw);
    // 与地面贴合：径向重建。广场足迹在矩形域外，可见地面 = 星球网格弦面
    // （低分段球面三角面，比解析球面低 0.3~0.4 且逐面变化）。
    // 抬升式座山：槽底（y=0）逐顶点坐在弦面 +0.12 上——严丝合缝不悬浮、
    // 不被弦面盖住；凹槽美学保留在围边之内（槽心仍比埂顶低 0.85）。
    radialRebuild(navonaPlaza, (rlx, rlz, y) => visibleGroundLiftLocal(rlx, rlz) + y + 0.12);
    // 切平面高差采样（供系绳班组士兵站高反解）：地形面 − 顶点沿 _site 的高差
    const _pt = new THREE.Vector3();
    const sampleDelta = (worldPos) => {
      const vlx = worldPos.dot(_right);
      const vlz = worldPos.dot(_fwd);
      rangeLocalToWorld(vlx, vlz, R, _pt); // 已含地形 lift
      return _pt.sub(worldPos).dot(_site);
    };
    navonaPlaza.userData.placement = { kind: "canal-citadel-approach", lx, lz, yaw };
    navonaPlaza.updateMatrixWorld(true);
    scene.add(navonaPlaza);

    // ---------- 连港步道：广场 R 侧门洞 → 旧港码头陆侧（贴地石堤，跨护城河处护堤开缺） ----------
    buildHarborCauseway(navonaPlaza);

    // 低多边形特洛伊木马：第一层瀑布正下方的接水湖面。
    trojanHorse = createCitadelTrojanHorse({ name: "citadel-trojan-horse", seed: 9901 });
    trojanHorse.scale.setScalar(0.72);

    // 马头朝向从地面向城堡数的第一层瀑布：
    // 台面数组是鸟瞰顺序（高→低），所以真实瀑布节点要取最后一个（低→高的第 1 层）。
    const firstWaterfall = pilgrimageCascades?.children?.at(-1);
    const firstWaterfallPos = new THREE.Vector3();
    if (firstWaterfall) {
      firstWaterfall.updateWorldMatrix(true, false);
      firstWaterfall.getWorldPosition(firstWaterfallPos);
    } else {
      const firstCascadeUpper = CITADEL_CASCADE_POOL_SPECS.at(-2);
      const firstCascadeLower = CITADEL_CASCADE_POOL_SPECS.at(-1);
      const fallbackX = firstCascadeUpper && firstCascadeLower
        ? (firstCascadeUpper.x + firstCascadeLower.x) * 0.5
        : CITADEL_CASCADE_MARKER.x;
      const fallbackZ = firstCascadeUpper && firstCascadeLower
        ? (firstCascadeUpper.z + firstCascadeLower.z) * 0.5 + 0.3 + 2.4
        : CITADEL_CASCADE_MARKER.z;
      rangeLocalToWorld(
        fallbackX,
        fallbackZ,
        R,
        firstWaterfallPos
      );
    }
    // 接水湖是瀑布节点实际生成的水面，优先使用它而不是手写局部坐标；
    // 这样瀑布/台地被编辑后，木马仍会贴着第一层瀑布下方的湖面移动。
    const receivingWater = firstWaterfall?.getObjectByName("citadel-cascade-receiving-water");
    const lowerPool = firstWaterfall?.userData?.lowerPool
      ? pilgrimageWaterSteps?.children?.find(
          (pool) => pool.name === firstWaterfall.userData.lowerPool
        )
      : pilgrimageWaterSteps?.children?.at(-1);
    const lowerPoolWater = lowerPool?.getObjectByName(`${lowerPool.name}-water`);
    const lakeSurfacePos = new THREE.Vector3();
    let lakeWaterObject = "citadel-cascade-receiving-water";
    if (receivingWater) {
      receivingWater.updateWorldMatrix(true, false);
      receivingWater.getWorldPosition(lakeSurfacePos);
    } else if (lowerPoolWater) {
      lakeWaterObject = lowerPoolWater.name;
      lowerPoolWater.updateWorldMatrix(true, false);
      lowerPoolWater.getWorldPosition(lakeSurfacePos);
    } else if (lowerPool) {
      lakeWaterObject = lowerPool.name;
      lowerPool.updateWorldMatrix(true, false);
      lowerPool.getWorldPosition(lakeSurfacePos);
      lakeSurfacePos.addScaledVector(_site, 0.09);
    } else {
      lakeWaterObject = "first-waterfall-fallback-surface";
      lakeSurfacePos.copy(firstWaterfallPos);
    }
    lakeSurfacePos.addScaledVector(_site, HORSE_LAKE_CLEARANCE);

    const surfaceUp = _site.clone();
    const surfaceForward = _fwd.clone()
      .addScaledVector(surfaceUp, -_fwd.dot(surfaceUp))
      .normalize();
    const surfaceRight = new THREE.Vector3()
      .crossVectors(surfaceUp, surfaceForward)
      .normalize();
    trojanHorse.position.copy(lakeSurfacePos);
    trojanHorse.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(surfaceRight, surfaceUp, surfaceForward)
    );
    const lakeLocalScale = R / Math.max(1e-6, lakeSurfacePos.dot(_site));
    const horseLx = lakeSurfacePos.dot(_right) * lakeLocalScale;
    const horseLz = lakeSurfacePos.dot(_fwd) * lakeLocalScale;
    trojanHorse.userData.rangeLocal = { lx: horseLx, lz: horseLz };

    const toFirstWaterfall = firstWaterfallPos.clone().sub(trojanHorse.position);
    toFirstWaterfall.addScaledVector(
      _site,
      -toFirstWaterfall.dot(_site)
    ).normalize();
    const waterfallYaw = Math.atan2(
      -toFirstWaterfall.dot(_right),
      toFirstWaterfall.dot(_fwd)
    );
    // 以瀑布朝向为基准逆时针旋转 90°，使马头转向港口侧运河。
    const horseYaw = waterfallYaw - Math.PI / 2;
    trojanHorse.rotateY(horseYaw);
    trojanHorse.userData.placement = {
      kind: "citadel-cascade-lake",
      surface: "water",
      lx: horseLx,
      lz: horseLz,
      lift: HORSE_LAKE_CLEARANCE,
      yaw: horseYaw,
      waterfallYaw,
      rotationOffset: -Math.PI / 2,
      facing: "canal",
      facingReference: "first-ground-level-waterfall",
      lake: true,
      waterfall: "first-ground-level",
      waterObject: lakeWaterObject,
      cascadeSequence: firstWaterfall?.userData?.sequence ?? 3,
      waterfallOrder: "ground-to-castle",
    };
    scene.add(trojanHorse);

    // ---- 系绳班组：一组纸士兵围马后仰、绳索绷直固定木马 ----
    // 士兵/绳索挂为木马子级（继承编辑器拖拽/右键删除）；站高用 sampleDelta
    // 逐人反解到城堡前草地（地形+0.1）。布局在木马局部系（马头 +Z）。
    trojanHorse.updateMatrixWorld(true);
    const HORSE_S = 0.72;
    const squad = new THREE.Group();
    squad.name = "horse-tiedown-squad";
    const ropeMat = toonMat(0x33261a, { flatShading: true });
    const TIE_SPOTS = [
      { a: [0, 4.6, 2.0], s: [0, 6.9] }, // 正面迎头拽（颈绳）
      { a: [1.3, 3.6, 1.3], s: [4.7, 2.7] }, // 前胸两侧
      { a: [-1.3, 3.6, 1.3], s: [-4.7, 2.7] },
      { a: [1.2, 3.4, -2.0], s: [4.5, -4.8] }, // 后躯两侧
      { a: [-1.2, 3.4, -2.0], s: [-4.5, -4.8] },
      { a: [0, 4.4, -2.4], s: [0, -7.0] }, // 尾部锚定
    ];
    const _w = new THREE.Vector3();
    const _hand = new THREE.Vector3();
    const _att = new THREE.Vector3();
    const _dir = new THREE.Vector3();
    const _upY = new THREE.Vector3(0, 1, 0);
    for (const spot of TIE_SPOTS) {
      const [sx, sz] = spot.s;
      const soldier = createTieSoldier();
      // 站高反解：木马局部 y=0 面采样世界高差 d0 = 地形 − 该面 → 脚底 = 地形+0.07
      _w.set(sx, 0, sz);
      trojanHorse.localToWorld(_w);
      const d0 = sampleDelta(_w);
      const feetY = (d0 + 0.07) / HORSE_S;
      soldier.position.set(sx, feetY, sz);
      // 纸偶 +X 朝向马心（拽绳方向）
      const dl = Math.hypot(sx, sz) || 1;
      soldier.rotation.y = Math.atan2(sz / dl, -sx / dl);
      squad.add(soldier);
      // 绳索：士兵双手前上 → 马身锚点（向躯干中心混入 0.3 埋端遮差）
      const hx = -sx / dl, hz = -sz / dl;
      _hand.set(sx + hx * 0.55, feetY + 0.85, sz + hz * 0.55);
      _att.set(spot.a[0], spot.a[1], spot.a[2]).lerp(_w.set(0, 3.4, 0), 0.3);
      _dir.copy(_att).sub(_hand);
      const ropeLen = _dir.length();
      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, ropeLen, 5),
        ropeMat
      );
      rope.name = "tiedown-rope";
      rope.position.copy(_hand).addScaledVector(_dir, 0.5);
      rope.quaternion.setFromUnitVectors(_upY, _dir.normalize());
      squad.add(rope);
    }
    trojanHorse.add(squad);
    // 白天系绳班组（拉绳固定木马）——倾倒判定只认这组，与夜潜士兵无关
    squad.userData.role = "day-tiedown";
    trojanHorse.userData.tiedownSquad = squad;
    trojanHorse.userData.baseQuat = trojanHorse.quaternion.clone();
    trojanHorse.userData.tipAmount = 0;
    trojanHorse.userData.tipSign = 1;

    // ---- 夜间潜入路线：瀑布组沿四道水帘逐级上攀，阶梯组沿外侧三段石阶 ----
    // 所有路径点直接取当前台地/瀑布/石阶几何；抽出成函数，供地形热重建后
    // 重新计算并回灌 nightInfiltration，避免士兵继续沿旧几何走空中。
    computeInfiltrationRoutes = (castle) => {
      // 城堡台地/石阶/正门都在城堡本地切平面；路线用城堡自身变换贴地，
      // 避免 range 坐标系（R+elevation）与城堡径向下沉(radialEmbed≈4)之间的偏移导致走空中。
      castle.updateMatrixWorld(true);
      const waterfallRoute = [];
      const waterfallNodes = [...(pilgrimageCascades?.children || [])].sort(
        (a, b) => (b.userData?.sequence ?? 0) - (a.userData?.sequence ?? 0)
      );
      const waterfallPos = new THREE.Vector3();
      // 瀑布组先从木马攀到台面 2（sequence 3、2、1 = 从最低处到台面 2 的三道水帘）。
      for (const waterfall of waterfallNodes.slice(0, 3)) {
        waterfall.updateWorldMatrix(true, false);
        waterfall.getWorldPosition(waterfallPos);
        const drop = Math.max(1.2, Number(waterfall.userData?.actualDrop) || 4);
        waterfallRoute.push(waterfallPos.clone().addScaledVector(_site, 0.22));
        waterfallRoute.push(waterfallPos.clone().addScaledVector(_site, drop * 0.46));
        waterfallRoute.push(waterfallPos.clone().addScaledVector(_site, drop + 0.28));
      }
      const terraceTwoPool = pilgrimageWaterSteps?.children?.find(
        (pool) => pool.name === "terrace-2-pool"
      ) || pilgrimageWaterSteps?.children?.[1];
      if (terraceTwoPool) {
        terraceTwoPool.updateWorldMatrix(true, false);
        terraceTwoPool.getWorldPosition(waterfallPos);
        waterfallRoute.push(waterfallPos.clone().addScaledVector(_site, 0.24));
      } else if (waterfallNodes.length) {
        // 湖开关关闭（瀑布独立模式）：最后一道水帘的帘脚即台面 2 前缘，
        // 直接以最低帘的世界位置作为攀爬终点（贴台面前缘）。
        const last = waterfallNodes[waterfallNodes.length - 1];
        last.updateWorldMatrix(true, false);
        last.getWorldPosition(waterfallPos);
        waterfallRoute.push(waterfallPos.clone().addScaledVector(_site, 0.24));
      }

      const stairRoute = [];
      const stairTransferRoutes = [];
      // 石阶踏面直接取城堡本地的 walkFlights 高程（yA→yB），经 castle.localToWorld
      // 贴回真实踏步，不再走 range 坐标系。
      const stairPoint = (flight, phi) => {
        const t = THREE.MathUtils.clamp(
          (phi - flight.from) / (flight.to - flight.from),
          0,
          1
        );
        const localY = THREE.MathUtils.lerp(flight.yA, flight.yB, t);
        const local = new THREE.Vector3(
          flight.rho * Math.sin(phi),
          localY + 0.18,
          flight.rho * Math.cos(phi)
        );
        return local.applyMatrix4(castle.matrixWorld);
      };
      // 阶梯组先只走地面→台面 5 的第一段石阶，抵达台面 5 后再由
      // stairTransferRoutes 按“巡查完成→走下一段石阶”逐层转移到台面 4、3。
      for (const flight of walkFlights.slice(0, 1)) {
        stairRoute.push(stairPoint(flight, flight.from));
        stairRoute.push(stairPoint(flight, flight.to));
      }
      for (const flight of walkFlights) {
        const fromTerrace = flight.terraceIndex + 1;
        const toTerrace = flight.terraceIndex;
        if (fromTerrace >= walkMetrics.length) continue; // 地面 → 台面 5，不是台面间转场
        const midPhi = (flight.from + flight.to) * 0.5;
        stairTransferRoutes.push({
          fromTerrace,
          toTerrace,
          points: [
            stairPoint(flight, flight.from),
            stairPoint(flight, midPhi),
            stairPoint(flight, flight.to),
          ],
        });
      }

      // 门外巡游点统一转城堡本地切平面，再按 target 台地环带约束后用
      // castle.localToWorld 贴回真实台面，避免 range 坐标系造成悬空。
      const patrolSurfacePoint = castle
        ? ({ x, z, world, terraceIndex }, out = new THREE.Vector3()) => {
            const metrics = citadelTerraceMetrics(normalizedContour);
            const metric = metrics[terraceIndex];
            if (!metric) return null;
            const source = world?.isVector3
              ? world
              : castle.localToWorld(new THREE.Vector3(x, 0, z));
            const local = castle.worldToLocal(source.clone());
            local.y = 0;
            const innerRadius = terraceIndex > 0
              ? metrics[terraceIndex - 1].radius + 0.72
              : 0;
            const outerRadius = Math.max(innerRadius + 0.5, metric.radius - 0.72);
            let radius = Math.hypot(local.x, local.z);
            if (radius < 1e-5) {
              local.x = 0;
              local.z = Math.min(outerRadius, Math.max(innerRadius, 1));
              radius = Math.hypot(local.x, local.z);
            }
            radius = THREE.MathUtils.clamp(radius, innerRadius, outerRadius);
            let phi = Math.atan2(local.x, local.z);
            if (
              terraceIndex > 0
              && terraceIndex <= normalizedContour.notchedLayers
            ) {
              const delta = Math.atan2(
                Math.sin(phi - normalizedContour.notchCenter),
                Math.cos(phi - normalizedContour.notchCenter)
              );
              const safeNotchEdge = normalizedContour.notchHalf + 0.14;
              if (Math.abs(delta) < safeNotchEdge) {
                phi = normalizedContour.notchCenter
                  + (delta < 0 ? -safeNotchEdge : safeNotchEdge);
              }
            }
            local.x = radius * Math.sin(phi);
            local.z = radius * Math.cos(phi);
            local.y = metric.top + 0.08;
            return out.copy(local).applyMatrix4(castle.matrixWorld);
          }
        : null;

      return { waterfallRoute, stairRoute, stairTransferRoutes, patrolSurfacePoint };
    };

    _patrolCastle = patrolCastle;
    const infiltrationRoutes = computeInfiltrationRoutes(patrolCastle);
    nightInfiltration = createCitadelNightInfiltration({
      scene,
      horse: trojanHorse,
      staticSquad: squad,
      siteUp: _site,
      siteRight: _right,
      horseGround: trojanHorse.position.clone(),
      waterfallRoute: infiltrationRoutes.waterfallRoute,
      stairRoute: infiltrationRoutes.stairRoute,
      stairTransferRoutes: infiltrationRoutes.stairTransferRoutes,
      patrolCastle,
      patrolSurfacePoint: infiltrationRoutes.patrolSurfacePoint,
    });
    trojanHorse.userData.nightInfiltration = nightInfiltration.root;

    rangeSystem.navonaPlaza = navonaPlaza;
    rangeSystem.trojanHorse = trojanHorse;
    rangeSystem.nightInfiltration = nightInfiltration;
    return navonaPlaza;
  };

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
    tarnCompanionPine,
    lakeBallShrubs: null,
    snowMountains,
    snowMassifLeft: snowLeft,
    snowMassifRight: snowRight,
    moat: moatMesh,
    trojanHorse,
    navonaPlaza,
    nightInfiltration,
    placeNavonaPlaza,
    update(dt, t, ctx = {}) {
      nightInfiltration?.update(dt, t, P.timeOfDay, ctx);
      // 木马系绳兵麻醉 → 木马倾倒；全员苏醒后复位
      updateTrojanHorseTiedown(rangeSystem.trojanHorse || trojanHorse, dt);
    },
    vegetation: null,
    siteDir: _site.clone(),
    fwd: _fwd.clone(),
    right: _right.clone(),
  };

  // 地貌菜单可实时调整护城河内径/外径/高度/曲率：重建环带并重贴球面曲率。
  rangeSystem.rebuildMoat = (spec) => {
    const next = buildMoat(spec);
    rangeSystem.moat = moatMesh; // 同步引用（旧 moat 已从场景移除并 dispose）
    return next;
  };

  // 运河建成后接入：存中心线局部折线 → 重建护城河（护堤在交接处开缺口、水系打通）。
  rangeSystem.linkCanalToMoat = (curve) => {
    if (!curve) return;
    const pts = [];
    const N = 480;
    for (let i = 0; i < N; i++) {
      curve.getPointAt(i / N, _o);
      pts.push([_o.dot(_right), _o.dot(_fwd)]);
    }
    moatCanalPts = pts;
    rangeSystem.rebuildMoat(contourSpec?.moat);
  };

  // 台地半径/层高/层叠瀑布开关变更时热重建水系。
  // cascadeEnabled=false → 空组（不占台面）；true → 五湖四帘，且不得跨两层跌落。
  rangeSystem.rebuildWaterTerraces = (nextContour = CITADEL.contourTerrain) => {
    normalizedContour = normalizeCitadelTerrain(nextContour);
    configureCitadelWalkTerrain(R, normalizedContour);
    scene.remove(pilgrimageWaterSteps, pilgrimageCascades);
    for (const group of [pilgrimageWaterSteps, pilgrimageCascades]) {
      group.traverse((object) => object.geometry?.dispose?.());
    }
    pilgrimageWaterSteps = buildPilgrimageWaterSteps(R, materials, normalizedContour);
    pilgrimageCascades = buildPilgrimageCascades(
      R,
      pilgrimageWaterSteps,
      materials,
      normalizedContour
    );
    scene.add(pilgrimageWaterSteps, pilgrimageCascades);
    rangeSystem.pilgrimageWaterSteps = pilgrimageWaterSteps;
    rangeSystem.pilgrimageCascades = pilgrimageCascades;
    rangeSystem.contourSpec = normalizedContour;
    rangeSystem.cascadeEnabled = normalizedContour.cascadeEnabled;
    // 台地半径/层高/瀑布石阶已重算：同步刷新夜间潜入路线，避免士兵沿旧几何走空中。
    if (nightInfiltration?.setRoutes && computeInfiltrationRoutes) {
      nightInfiltration.setRoutes(computeInfiltrationRoutes(_patrolCastle));
    }
    return rangeSystem;
  };
  rangeSystem.cascadeEnabled = normalizedContour.cascadeEnabled;
  rangeSystem.contourSpec = normalizedContour;
  return rangeSystem;
}
