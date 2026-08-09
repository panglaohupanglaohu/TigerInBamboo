// =====================================================================
//  圣城山脉（Citadel Range）：旷野双峰 + 前望峡谷
//
//  布局（站点局部切平面，lz+ 指向主岛）：
//    lz≈0   圣城主峰：顶面抬升 16，椭圆平顶（半轴 30×26），圣城坐落其上
//    lz≈36  前望看台峰：抬升 10.5（半轴 17×14），略低于主峰 ——
//           「这山望着那山高」：站在看台峰仰望圣城
//    lz≈18  两峰之间的鞍部深谷（高程 ≈ 主峰一半），凸显圣城体量
//
//  关键约束：星球网格 48×32 段太粗（顶点间距 ~20 单位），无法直接
//  顶点位移造山 → 独立高度场网格，视觉与碰撞共用同一高程函数
//  （与 hills.js 岛面山脉同构）。域缘裙边下沉 0.7 扎进球面遮接缝；
//  域内基线 +0.4 覆盖粗网格球面弦高差（sagitta ≈0.28）防穿插。
// =====================================================================
import * as THREE from "three";
import { latLonToDir } from "./sphereMath.js";
import { toonMat, addOutline } from "../assets/toon.js";
import { createMangaWaterfall } from "./mangaWaterfall.js";

/* ---------------- 选址与山体参数（锁死） ---------------- */
export const RANGE_SITE = Object.freeze({ lat: 24.1, lon: 36.05 });
export const CITADEL_PEAK = Object.freeze({
  // Broad footing sized beyond the 24×24 enceinte, twin barbican and rock
  // claws. The soil now wraps the castle instead of ending under its walls.
  cx: 0, cz: 0, rx: 44, rz: 38, h: 16,
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
const INTER_CASCADE_NOTCH = Object.freeze({
  cx: 3.5,
  halfWidth: 5.2,
  zMin: 23.8,
  zMax: 34.2,
});

function insideInterCascadeNotch(lx, lz) {
  return Math.abs(lx - INTER_CASCADE_NOTCH.cx) < INTER_CASCADE_NOTCH.halfWidth
    && lz > INTER_CASCADE_NOTCH.zMin
    && lz < INTER_CASCADE_NOTCH.zMax;
}

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

  // Direct terrain replacement, not an object placed on top of a mound:
  // flatten the exact right-front shoulder under the defense tower and blend
  // the cut into the remaining cliff over a narrow annulus.
  const outpostDx = (lx - OUTPOST_CUT.cx) / OUTPOST_CUT.rx;
  const outpostDz = (lz - OUTPOST_CUT.cz) / OUTPOST_CUT.rz;
  const outpostD = Math.hypot(outpostDx, outpostDz);
  if (outpostD < 1.18) {
    const blend = THREE.MathUtils.smoothstep(outpostD, 0.72, 1.18);
    lift = THREE.MathUtils.lerp(BASE_LIFT + OUTPOST_CUT.floor, lift, blend);
  }
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

/* ---------------- 可行走高程：台地台面 + 朝圣台阶（仅碰撞，视觉网格不变） ----------------
   与 odysseyCitadel.js 的 contourTerrain / 折返石阶同参数（那边管视觉，这边管
   碰撞；两者共用站点局部坐标系）。送信人可沿五段折返石阶从山脚一路走上顶层
   台地，经平桥抵达棕色正门门廊。 */
const WALK_BASE_LIFT = BASE_LIFT + CITADEL_PEAK.h - 9.25; // 城堡容器基准（顶 16.4 − 下嵌 9.25）
const WALK_SHELF_TOP = (k) => WALK_BASE_LIFT + 4 + 2 * k; // 第 k 层台面世界抬升
const WALK_SHELF_RADIUS = (k) => 24 * 0.9 ** k;
const WALK_NOTCH = Object.freeze({ center: 0.17, half: 0.56, innerR: 9.0 });
// φ：从 +lz（正门/瀑布方向）朝 +lx 量；ρ 为梯段圆弧半径，yA/yB 为容器局部踏面高。
const WALK_FLIGHTS = Object.freeze([
  { from: -0.87, to: -1.5, rho: 25.05, yA: 1.0, yB: 4.06 },
  { from: -1.5, to: -0.91, rho: 22.65, yA: 4.06, yB: 6.06 },
  { from: -0.91, to: -1.47, rho: 20.49, yA: 6.06, yB: 8.06 },
  { from: -1.47, to: -0.94, rho: 18.55, yA: 8.06, yB: 10.06 },
  { from: -0.94, to: -1.4, rho: 16.8, yA: 10.06, yB: 12.06 },
]);

/** 台地/台阶附加抬升（局部坐标；无支撑处返回 -Infinity） */
function citadelTerraceWalkLiftLocal(lx, lz) {
  const r = Math.hypot(lx, lz);
  if (r > 27) return -Infinity;
  const phi = Math.atan2(lx, lz);
  let best = -Infinity;
  // 台面：最高（半径最小）的包含层即脚下台面；瀑布缺口扇区内前四层不存在
  const inNotch =
    r > WALK_NOTCH.innerR && Math.abs(phi - WALK_NOTCH.center) < WALK_NOTCH.half;
  for (let k = 4; k >= 0; k--) {
    if (r > WALK_SHELF_RADIUS(k)) continue;
    if (k < 4 && inNotch) continue;
    best = WALK_SHELF_TOP(k);
    break;
  }
  // 石阶梯段：沿圆弧的连续坡道（覆盖踏面 ±0.1 的离散起伏）
  for (const f of WALK_FLIGHTS) {
    if (Math.abs(r - f.rho) > 1.35) continue;
    const lo = Math.min(f.from, f.to);
    const hi = Math.max(f.from, f.to);
    if (phi < lo - 0.06 || phi > hi + 0.06) continue;
    const t = THREE.MathUtils.clamp((phi - f.from) / (f.to - f.from), 0, 1);
    best = Math.max(best, WALK_BASE_LIFT + f.yA + (f.yB - f.yA) * t);
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

function makeMountainGeometry(radius, height, seed, segments = 10) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  // Truncated ridge profile: never collapse the last ring to a single apex.
  // This removes the oversized cone/needle silhouette while retaining a
  // weathered alpine wall behind the citadel.
  const levels = [0, 0.3, 0.57, 0.76, 0.9];
  const positions = [];
  for (let ring = 0; ring < levels.length; ring++) {
    const t = levels[ring];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const taper = Math.max(0.2, Math.pow(1 - t, 0.72));
      const jag = 0.82 + random() * 0.34;
      const r = radius * taper * jag;
      positions.push(
        Math.cos(angle) * r,
        height * t * (0.96 + random() * 0.06),
        Math.sin(angle) * r
      );
    }
  }
  const indices = [];
  for (let ring = 0; ring < levels.length - 1; ring++) {
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = ring * segments + i;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + i;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, b, b, c, d);
    }
  }
  // Close the broad summit with a shallow, irregular cap instead of an apex.
  const topCenter = positions.length / 3;
  positions.push(0, height * 0.88, 0);
  const topRing = levels.length - 1;
  for (let i = 0; i < segments; i++) {
    indices.push(topRing * segments + i, topCenter, topRing * segments + (i + 1) % segments);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeSnowCapGeometry(radius, height, seed, segments = 10) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1103515245, state) + 12345) >>> 0;
    return state / 0x100000000;
  };
  const positions = [];
  const topRing = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const t = 0.58 + random() * 0.13;
    const r = radius * Math.pow(1 - t, 0.72) * 1.04;
    positions.push(Math.cos(angle) * r, height * t, Math.sin(angle) * r);
    const topAngle = angle + 0.08 * Math.sin(i * 2.3);
    const topRadius = radius * (0.16 + random() * 0.05);
    topRing.push(
      Math.cos(topAngle) * topRadius,
      height * (0.875 + random() * 0.035),
      Math.sin(topAngle) * topRadius
    );
  }
  positions.push(...topRing);
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(i, segments + i, next, next, segments + i, segments + next);
  }
  const summitCenter = positions.length / 3;
  positions.push(0, height * 0.89, 0);
  for (let i = 0; i < segments; i++) {
    indices.push(segments + i, summitCenter, segments + (i + 1) % segments);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildSnowMountain(name, radius, height, seed, materials) {
  const mountain = new THREE.Group();
  mountain.name = name;
  mountain.add(
    rangePart(
      makeMountainGeometry(radius, height, seed),
      materials.mountain,
      `${name}-rock`,
      0.075
    )
  );
  mountain.add(
    rangePart(
      makeSnowCapGeometry(radius, height, seed + 91),
      materials.snow,
      `${name}-snow-cap`,
      0.055
    )
  );
  return mountain;
}

function makeConnectedSaddleGeometry(length, width, height) {
  // Three cross-sections form a broad M-shaped saddle between two peaks.
  const xs = [-length / 2, 0, length / 2];
  const ridgeY = [height * 0.82, height * 0.58, height * 0.9];
  const positions = [];
  for (let i = 0; i < xs.length; i++) {
    positions.push(xs[i], 0, -width / 2, xs[i], 0, width / 2);
    positions.push(xs[i], ridgeY[i], -width * 0.22, xs[i], ridgeY[i], width * 0.22);
  }
  const indices = [];
  for (let section = 0; section < 2; section++) {
    const a = section * 4;
    const b = (section + 1) * 4;
    // front/back cliff faces
    indices.push(a, b, a + 2, a + 2, b, b + 2);
    indices.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1);
    // two upper shoulders and closed bottom
    indices.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildConnectedSnowSaddle(materials) {
  const saddle = new THREE.Group();
  saddle.name = "connected-central-snow-saddle";
  saddle.userData.connectsMountainIndices = [2, 3];
  const rock = rangePart(
    makeConnectedSaddleGeometry(28, 15, 48),
    materials.mountain,
    "connected-central-snow-saddle-rock",
    0.055
  );
  saddle.add(rock);
  const snow = rangePart(
    makeConnectedSaddleGeometry(28.4, 6.8, 48.6),
    materials.snow,
    "connected-central-snow-saddle-cap",
    0.035
  );
  snow.position.y = 0.22;
  saddle.add(snow);
  return saddle;
}

function buildForegroundDefenseTower(materials) {
  const tower = new THREE.Group();
  tower.name = "citadel-foreground-defense-tower";

  const lower = rangePart(
    new THREE.CylinderGeometry(4.9, 4.9, 13.5, 8),
    materials.outpost,
    "foreground-tower-lower"
  );
  lower.position.y = 6.75;
  lower.rotation.y = Math.PI / 8;
  tower.add(lower);
  const upper = rangePart(
    new THREE.CylinderGeometry(4.45, 4.45, 4.6, 8),
    materials.outpost,
    "foreground-tower-upper"
  );
  upper.position.y = 15.8;
  upper.rotation.y = Math.PI / 8;
  tower.add(upper);

  const windowGeometry = new THREE.BoxGeometry(1.35, 1.85, 0.12);
  for (const [x, z, rotationY] of [
    [0, 4.43, 0],
    [-4.43, 0, -Math.PI / 2],
    [4.43, 0, Math.PI / 2],
  ]) {
    const window = rangePart(
      windowGeometry,
      materials.ink,
      "foreground-tower-lookout-window",
      0.022
    );
    window.position.set(x, 15.8, z);
    window.rotation.y = rotationY;
    tower.add(window);
  }

  const parapet = rangePart(
    new THREE.CylinderGeometry(4.72, 4.72, 0.42, 8),
    materials.outpost,
    "foreground-tower-octagonal-parapet",
    0.03
  );
  parapet.position.y = 18.18;
  parapet.rotation.y = Math.PI / 8;
  tower.add(parapet);

  const merlonGeo = new THREE.BoxGeometry(0.82, 0.95, 0.82);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const merlon = rangePart(
      merlonGeo,
      materials.outpost,
      "foreground-tower-crenel",
      0.024
    );
    merlon.position.set(Math.cos(angle) * 4.15, 18.82, Math.sin(angle) * 4.15);
    merlon.rotation.y = -angle;
    tower.add(merlon);
  }
  return tower;
}

function buildCastleSoilFooting(materials) {
  const footing = new THREE.Group();
  footing.name = "citadel-solid-soil-footing";

  // A closed, broad truncated low-poly mesa. Its top fully covers the castle,
  // barbican and cliff-rock footprint; its wider base intersects the existing
  // heightfield so no viewing angle can reveal sky beneath the citadel.
  const body = rangePart(
    new THREE.CylinderGeometry(19.0, 32.0, 12.0, 14, 2, false),
    materials.footing,
    "citadel-solid-soil-footing-body",
    0.045
  );
  body.position.y = -5.92; // top is +0.08 in group-local space
  body.rotation.y = Math.PI / 14;
  footing.add(body);

  // Irregular apron blocks merge the geometric footing into the hand-cut
  // surrounding slope instead of leaving a perfectly mechanical cylinder.
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + (i % 2) * 0.13;
    const apron = rangePart(
      new THREE.IcosahedronGeometry(4.2 + (i % 3) * 0.45, 0),
      materials.footing,
      "citadel-soil-apron-rock",
      0.025
    );
    apron.position.set(
      Math.cos(angle) * (21.5 + (i % 2) * 1.8),
      -7.0 - (i % 3) * 0.55,
      Math.sin(angle) * (21.5 + (i % 2) * 1.8)
    );
    apron.scale.set(1.4, 0.65, 1.15);
    footing.add(apron);
  }
  return footing;
}

function makeLoessGroundSealGeometry(R, segments = 20) {
  const peakTop = BASE_LIFT + CITADEL_PEAK.h;
  const ringDistances = [0.24, 0.42, 0.52, 0.62, 0.72, 0.8];
  const clearance = 0.22;
  const positions = [0, -clearance, 0];
  const rings = [];
  for (const distance of ringDistances) {
    const ring = [];
    const peakAtRing = peakLift(
      CITADEL_PEAK.cx + CITADEL_PEAK.rx * distance,
      CITADEL_PEAK.cz,
      CITADEL_PEAK,
      0.42,
      0.8
    );
    const liftAtRing = BASE_LIFT + peakAtRing;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const tangentX = Math.cos(angle) * CITADEL_PEAK.rx * distance;
      const tangentZ = Math.sin(angle) * CITADEL_PEAK.rz * distance;
      const tangentLength = Math.hypot(R, tangentX, tangentZ);
      const projectedScale = (R + liftAtRing) / tangentLength;
      ring.push(positions.length / 3);
      positions.push(
        tangentX * projectedScale,
        R * projectedScale - (R + peakTop) - clearance,
        tangentZ * projectedScale
      );
    }
    rings.push(ring);
  }

  const bottomCenter = positions.length / 3;
  positions.push(0, -18.2, 0);
  const bottomRing = [];
  for (let i = 0; i < segments; i++) {
    const outerTopIndex = rings.at(-1)[i] * 3;
    bottomRing.push(positions.length / 3);
    positions.push(
      positions[outerTopIndex] * 1.025,
      -18.2,
      positions[outerTopIndex + 2] * 1.025
    );
  }

  const indices = [];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(0, rings[0][next], rings[0][i]);
  }
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex++) {
    const inner = rings[ringIndex];
    const outer = rings[ringIndex + 1];
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const quadX = (
        positions[inner[i] * 3]
        + positions[inner[next] * 3]
        + positions[outer[i] * 3]
        + positions[outer[next] * 3]
      ) * 0.25;
      const quadZ = (
        positions[inner[i] * 3 + 2]
        + positions[inner[next] * 3 + 2]
        + positions[outer[i] * 3 + 2]
        + positions[outer[next] * 3 + 2]
      ) * 0.25;
      if (insideInterCascadeNotch(quadX, quadZ)) continue;
      indices.push(
        inner[i], inner[next], outer[next],
        inner[i], outer[next], outer[i]
      );
    }
  }
  const outerTop = rings.at(-1);
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const sideX = (
      positions[outerTop[i] * 3]
      + positions[outerTop[next] * 3]
    ) * 0.5;
    const sideZ = (
      positions[outerTop[i] * 3 + 2]
      + positions[outerTop[next] * 3 + 2]
    ) * 0.5;
    if (insideInterCascadeNotch(sideX, sideZ)) {
      indices.push(bottomCenter, bottomRing[i], bottomRing[next]);
      continue;
    }
    indices.push(
      outerTop[i], outerTop[next], bottomRing[i],
      outerTop[next], bottomRing[next], bottomRing[i],
      bottomCenter, bottomRing[i], bottomRing[next]
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function buildLoessGroundSeal(R, materials) {
  const seal = new THREE.Group();
  seal.name = "citadel-loess-ground-seal";

  // The visible heightfield is a surface sheet. This closed, tapered volume
  // backs the entire summit and penetrates below planet radius, eliminating
  // the low-angle air gap between yellow slope and spherical ground.
  const body = rangePart(
    makeLoessGroundSealGeometry(R),
    materials.loessSeal,
    "citadel-loess-ground-seal-body",
    0.028
  );
  seal.add(body);

  return seal;
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

function buildPilgrimageWaterSteps(R, materials) {
  const waterSteps = new THREE.Group();
  waterSteps.name = "citadel-pilgrimage-water-steps";
  const stageSpecs = [
    { name: "upper-courtyard-pool", x: 3.0, z: 17.0, rx: 5.8, rz: 3.5, depth: 0.9, lift: 0.16, seed: 9300 },
    { name: "upper-slope-pool", x: 4.3, z: 21.5, rx: 6.3, rz: 3.8, depth: 1.0, lift: 0.14, seed: 9301 },
    { name: "middle-slope-pool", x: 3.2, z: 26.0, rx: 6.9, rz: 4.2, depth: 1.15, lift: 0.12, seed: 9302 },
    { name: "lower-slope-pool", x: 4.5, z: 31.0, rx: 7.8, rz: 4.8, depth: 1.3, lift: 0.1, seed: 9303 },
    { name: "ground-deep-pool", x: 1.0, z: 43.0, rx: 12.5, rz: 8.2, depth: 1.75, lift: 0.08, seed: 9304 },
  ];
  for (let i = 0; i < stageSpecs.length; i++) {
    const spec = stageSpecs[i];
    const stage = buildWhiteStoneLakeStage(spec, materials);
    placeRangeAsset(stage, spec.x, spec.z, R, spec.lift, true);
    stage.userData.composition = {
      sequence: i,
      kind: i === stageSpecs.length - 1 ? "deep-pool" : "stepped-pool",
      localElevation: citadelRangeLiftLocal(spec.x, spec.z) + spec.lift + 0.09,
      rx: spec.rx,
      rz: spec.rz,
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
    const drop = Math.max(0.8, upperWaterY - lowerWaterY);
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

    // From the ground upward, cascades 1–3 are sequences 3, 2 and 1. Keep only
    // small flanking stones well clear of the curtain: the notched contour
    // shelves now frame the falls, so bulky soil shoulders would again cover
    // the water the notch was cut to expose.
    if (i >= 1) {
      const shoulderGroup = new THREE.Group();
      shoulderGroup.name = `citadel-waterfall-soil-shoulders-${i}`;
      for (const side of [-1, 1]) {
        const upperShoulder = rangePart(
          new THREE.IcosahedronGeometry(1.55 + i * 0.1, 0),
          materials.loessSeal,
          "citadel-waterfall-upper-soil-shoulder",
          0.022
        );
        upperShoulder.position.set(
          side * 6.3,
          Math.max(1.3, drop * 0.52),
          -0.85
        );
        upperShoulder.scale.set(
          0.8,
          Math.max(0.7, drop / 6.5),
          1.0
        );
        upperShoulder.rotation.set(0.12 * side, 0.35 * side + i * 0.08, -0.08 * side);
        shoulderGroup.add(upperShoulder);

        const lowerShoulder = rangePart(
          new THREE.IcosahedronGeometry(1.35 + i * 0.08, 0),
          materials.loessSealShade,
          "citadel-waterfall-lower-soil-shoulder",
          0.02
        );
        lowerShoulder.position.set(side * 5.8, 0.55, -0.4);
        lowerShoulder.scale.set(0.75, 0.5, 0.95);
        lowerShoulder.rotation.set(-0.1 * side, -0.28 * side, 0.06 * side);
        shoulderGroup.add(lowerShoulder);
      }
      waterfall.add(shoulderGroup);
      waterfall.userData.rebuiltSoilShoulders = 4;
    } else {
      waterfall.userData.rebuiltSoilShoulders = 0;
    }
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
    const facadeClearance = [1.4, 2.8, 3.5, 4.2][i];
    waterfall.translateZ(facadeClearance);
    waterfall.scale.x = 1.16;
    // Re-center the receiving extension between the shifted impact point and
    // the original lower lake so both water surfaces visibly overlap.
    receivingWater.position.z -= facadeClearance * 0.5;
    waterfall.userData.sequence = i;
    waterfall.userData.upperPool = upper.name;
    waterfall.userData.lowerPool = lower.name;
    waterfall.userData.actualDrop = drop;
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
  return cascades;
}

function buildInterCascadeBridgePool(waterSteps, cascades, materials) {
  // Pool index 2 is shared by waterfall sequences 1 and 2. Construct the
  // bridge from their real world-space endpoints, not from an approximate
  // ellipse, so the water and white basin cover every centimetre between them.
  const bridgePool = new THREE.Group();
  bridgePool.name = "citadel-waterfall-2-3-bridge-pool";
  cascades.updateWorldMatrix(true, true);

  const upperFall = cascades.children[1];
  const lowerFall = cascades.children[2];
  const start = upperFall
    .getObjectByName("citadel-cascade-receiving-water")
    .getWorldPosition(new THREE.Vector3());
  const lowerCurtain = lowerFall.getObjectByName("manga-waterfall-curtain-0");
  const end = new THREE.Vector3(0, 8, 0).applyMatrix4(lowerCurtain.matrixWorld);
  const targetWaterY = waterSteps.children[2].position.dot(_site) + 0.09;
  start.addScaledVector(_site, targetWaterY - start.dot(_site));
  end.addScaledVector(_site, targetWaterY - end.dot(_site));

  const channelDirection = end.clone().sub(start);
  channelDirection.addScaledVector(_site, -channelDirection.dot(_site));
  const channelLength = channelDirection.length();
  channelDirection.normalize();
  const channelRight = new THREE.Vector3()
    .crossVectors(channelDirection, _site)
    .normalize();
  const channelBasis = new THREE.Matrix4().makeBasis(
    channelRight,
    channelDirection,
    _site
  );
  const channelQuaternion = new THREE.Quaternion().setFromRotationMatrix(channelBasis);
  const center = start.clone().add(end).multiplyScalar(0.5);

  const basin = rangePart(
    new THREE.BoxGeometry(7.0, channelLength + 1.6, 1.15),
    materials.whiteStone,
    "citadel-waterfall-2-3-white-stone-basin",
    0.026
  );
  basin.position.copy(center).addScaledVector(_site, -0.54);
  basin.quaternion.copy(channelQuaternion);
  bridgePool.add(basin);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, channelLength + 1.35),
    materials.water
  );
  water.name = "citadel-waterfall-2-3-channel-water";
  water.position.copy(center).addScaledVector(_site, 0.02);
  water.quaternion.copy(channelQuaternion);
  water.castShadow = false;
  water.renderOrder = 9;
  bridgePool.add(water);

  bridgePool.userData.connectsCascadeSequences = [1, 2];
  bridgePool.userData.waterLevel = targetWaterY;
  bridgePool.userData.channelLength = channelLength;
  bridgePool.userData.replacesLoessBand = true;
  bridgePool.userData.start = start;
  bridgePool.userData.end = end;
  return bridgePool;
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
export function buildCitadelRange(scene, R) {
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
      const cellX = LX_MIN + (ix + 0.5) * STEP;
      const cellZ = LZ_MIN + (iz + 0.5) * STEP;
      if (insideInterCascadeNotch(cellX, cellZ)) continue;
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
  mesh.userData.interCascadeNotch = INTER_CASCADE_NOTCH;
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
    footing: toonMat(0xb5ad82, { flatShading: true }),
    loessSeal: toonMat(0xc9c096, { flatShading: true }),
    loessSealShade: toonMat(0xa9a180, { flatShading: true }),
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

  const loessGroundSeal = buildLoessGroundSeal(R, materials);
  placeRangeAsset(loessGroundSeal, 0, 0, R, -0.18, true);
  scene.add(loessGroundSeal);

  const castleFooting = buildCastleSoilFooting(materials);
  // Two units below the heightfield top: enough to reveal the gate threshold
  // while the closed body still seals every underside viewing angle.
  placeRangeAsset(castleFooting, 0, 0, R, -2.0, true);
  scene.add(castleFooting);

  // Foreground mound replacement: the old soil volume is carved out by
  // OUTPOST_CUT, and this tower rises from that same low footprint.
  const foregroundTower = buildForegroundDefenseTower(materials);
  // Right-front shoulder in the gameplay camera, matching the lower outwork
  // position in the painting instead of sitting directly on the view axis.
  placeRangeAsset(foregroundTower, OUTPOST_CUT.cx, OUTPOST_CUT.cz, R, -0.25, true);
  scene.add(foregroundTower);

  // A continuous white-stone pilgrimage slope descends from the gate through
  // four shallow pools into a broad ground-level tarn. Wide flat stones on
  // the near bank form a safe visual overlook toward the citadel and massif.
  const pilgrimageWaterSteps = buildPilgrimageWaterSteps(R, materials);
  scene.add(pilgrimageWaterSteps);
  const pilgrimageCascades = buildPilgrimageCascades(R, pilgrimageWaterSteps, materials);
  scene.add(pilgrimageCascades);
  const interCascadeBridgePool = buildInterCascadeBridgePool(
    pilgrimageWaterSteps,
    pilgrimageCascades,
    materials
  );
  scene.add(interCascadeBridgePool);
  const pilgrimageLookout = buildPilgrimageLookout(R, materials);
  scene.add(pilgrimageLookout);

  // One dominant marsh elder anchors the deep tarn's left bank. Its broad
  // crown remains offset from the central sightline between messenger and
  // citadel, while the smaller lake-edge vegetation stays strictly spherical.
  const sacredTarnTree = buildSacredTarnTree(materials);
  placeRangeAsset(sacredTarnTree, -15.2, 42.0, R, -0.15, true);
  scene.add(sacredTarnTree);

  const lakeBallShrubs = new THREE.Group();
  lakeBallShrubs.name = "citadel-lake-ball-shrubs";
  const lakeShrubSpots = [
    [-6.6, 17.4, 1.05], [9.6, 18.8, 1.0],
    [-6.8, 22.7, 1.15], [11.5, 24.2, 1.2],
    [11.7, 29.4, 1.32], [-6.4, 31.8, 1.12],
    [-10.5, 36.8, 1.28], [13.0, 38.4, 1.34],
    [-11.7, 46.3, 1.06], [14.4, 46.7, 1.16],
  ];
  lakeShrubSpots.forEach(([x, z, scale], index) => {
    const shrub = buildLakeBallShrub(
      `citadel-lake-ball-shrub-${index}`,
      scale,
      materials,
      9600 + index
    );
    placeRangeAsset(shrub, x, z, R, -0.06, true);
    lakeBallShrubs.add(shrub);
  });
  scene.add(lakeBallShrubs);

  // Snowy massif sits on the negative local-Z side: always behind the main
  // citadel when the facade faces the island/observer.
  const snowMountains = new THREE.Group();
  snowMountains.name = "citadel-background-snow-massif";
  const mountainSpecs = [
    // Four independent flank peaks deliberately avoid mirrored silhouettes:
    // their height, footprint and depth alternate to form far/mid mountain
    // planes around the connected central double summit (indices 2 and 3).
    { x: -58, z: -88, r: 11, h: 52, lift: -1.4, seed: 7100 },
    { x: -34, z: -62, r: 16, h: 74, lift: -1.6, seed: 7101 },
    { x: -11, z: -72, r: 15, h: 86, lift: -1.8, seed: 7102 },
    { x: 10, z: -68, r: 20, h: 98, lift: -1.8, seed: 7103 },
    { x: 35, z: -64, r: 18, h: 88, lift: -1.7, seed: 7104 },
    { x: 59, z: -84, r: 12, h: 61, lift: -1.5, seed: 7105 },
  ];
  for (let i = 0; i < mountainSpecs.length; i++) {
    const spec = mountainSpecs[i];
    const mountain = buildSnowMountain(
      `background-snow-mountain-${i}`,
      spec.r,
      spec.h,
      spec.seed,
      materials
    );
    // Architectural composition uses the citadel's common vertical datum;
    // negative lift buries the mountain foot into the ground instead of
    // floating it above the curved planet surface.
    placeRangeAsset(mountain, spec.x, spec.z, R, spec.lift, true);
    mountain.userData.composition = {
      height: spec.h,
      radius: spec.r,
      depth: spec.z,
      connectedCentralPeak: i === 2 || i === 3,
    };
    snowMountains.add(mountain);
  }
  // Central peaks 2 and 3 share one physical rock-and-snow saddle, making
  // them a single continuous massif while the other four peaks stay separate.
  const connectedSnowSaddle = buildConnectedSnowSaddle(materials);
  placeRangeAsset(connectedSnowSaddle, -0.5, -70, R, -1.8, true);
  snowMountains.add(connectedSnowSaddle);
  scene.add(snowMountains);

  const vegetation = new THREE.Group();
  vegetation.name = "citadel-range-vegetation";
  const shrubSpots = [
    [-23, 4, 1.5], [-20, 12, 1.2], [-17, -6, 1.35], [-13, 18, 1.1],
    [16, 8, 1.35], [20, -4, 1.55], [23, 14, 1.2], [11, 22, 1.0],
    [-8, 24, 1.25], [16, 27, 1.15], [-7, 34, 1.25], [18, 38, 1.35],
    [1, 45, 1.2], [-14, 42, 1.05],
  ];
  shrubSpots.forEach(([x, z, scale], index) => {
    const shrub = buildRangeShrub(`range-shrub-${index}`, scale, materials, 8200 + index);
    placeRangeAsset(shrub, x, z, R, -0.1);
    vegetation.add(shrub);
  });
  scene.add(vegetation);

  return {
    mesh,
    loessGroundSeal,
    castleFooting,
    foregroundTower,
    pilgrimageWaterSteps,
    pilgrimageCascades,
    interCascadeBridgePool,
    pilgrimageLookout,
    sacredTarnTree,
    lakeBallShrubs,
    snowMountains,
    vegetation,
    siteDir: _site.clone(),
    fwd: _fwd.clone(),
    right: _right.clone(),
  };
}
