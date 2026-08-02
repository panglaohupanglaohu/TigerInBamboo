// =====================================================================
//  西芳寺（苔寺）· 东方景观架构
//  微型星球 R=40 上的上下二庭：
//    北半球 Phi∈[0, π/2]  — 下层苔藓庭园 + 黄金池 + 北极「黄金阁」
//    南半球 Phi∈[π/2, π]  — 上层洪隐山枯山水 + 三尊石组
//    赤道 Phi=π/2         — 湘南亭茶室（视觉分界）
//    参道                 — 螺旋青石阶：黄金池 → 跨越赤道 → 指东庵石组
//
//  坐标约定（与用户规格一致）：
//    Phi = 自 +Y（北极）的天顶角 / 余纬度
//      Phi=0     → 北极
//      Phi=π/2   → 赤道
//      Phi=π     → 南极
//    Theta = 方位角（绕 +Y）
//    局部 +Y 始终对齐球心外法线（四元数贴地）
// =====================================================================
import * as THREE from "three";
import { createLowPolyHouse, facet } from "../assets/lowPoly.js";
import { toonMat, addOutline, INK_COLOR } from "../assets/toon.js";
import { PLANET_RADIUS } from "./planet.js";

/** 玩家基准身高（世界单位） */
const PLAYER_H = 1.7;

/** 结构物最小间距（防穿模：房/巨石/茶室） */
export const SAIHOJI_MIN_DISTANCE = 5;

/** 苔藓地毯允许更密（仍保持不叠穿） */
const MOSS_MIN_DISTANCE = 1.6;

/** 苔藓三色 · 墨绿色系 */
const MOSS_COLORS = Object.freeze([0x1a331e, 0x2d5434, 0x1f4025]);

/** 枯山水砂色 */
const SAND_COLOR = 0xd9d9d9;

/** 焦墨乱石 */
const KARE_ROCK = 0x222222;

/** 重墨描边厚度 */
const HEAVY_INK = 0.038;

// ---------- 球面工具：Phi/Theta ↔ 方向/贴地 ----------

const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _yUp = new THREE.Vector3(0, 1, 0);

/** Phi(余纬) + Theta(方位) → 单位外法线 */
export function phiThetaToDir(phi, theta, out = new THREE.Vector3()) {
  const sp = Math.sin(phi);
  return out.set(sp * Math.cos(theta), Math.cos(phi), sp * Math.sin(theta));
}

/**
 * 贴球面：底部在 R+lift，局部 +Y = 径向法线。
 * @returns {THREE.Object3D}
 */
export function placeByPhiTheta(obj, phi, theta, radius = PLANET_RADIUS, lift = 0) {
  phiThetaToDir(phi, theta, _dir);
  obj.position.copy(_dir).multiplyScalar(radius + lift);
  _quat.setFromUnitVectors(_yUp, _dir);
  obj.quaternion.copy(_quat);
  return obj;
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 弦长距离是否与已放置点足够远 */
function farEnough(pos, placed, minD) {
  const m2 = minD * minD;
  for (const p of placed) {
    if (pos.distanceToSquared(p) < m2) return false;
  }
  return true;
}

function pushCollider(colliders, obj, radiusOverride) {
  const cr = radiusOverride ?? obj.userData.collideRadius ?? 0.4;
  if (cr >= 0.15) {
    colliders.push({
      position: obj.position.clone(),
      radius: cr * (obj.scale?.x || 1),
    });
  }
}

// ---------- 地标工厂 ----------

/**
 * 北极「黄金阁」：双层古风木屋 + 金箔色屋顶点缀（视觉终点）
 */
function createGoldenPavilion() {
  const g = createLowPolyHouse();
  // 屋顶改鎏金/枯金
  g.traverse((m) => {
    if (!m.isMesh || m.userData.isOutline) return;
    // 屋顶锥在 y 较高处
    if (m.geometry?.type === "ConeGeometry" || (m.position && m.position.y > 0.9)) {
      m.material = toonMat(0xc9a227, { emissive: 0x8a7010, emissiveIntensity: 0.18 });
    }
  });
  // 二层小楼：再叠一层缩略屋顶感
  const upper = new THREE.Mesh(
    facet(new THREE.BoxGeometry(1.1, 0.55, 1.0)),
    toonMat(0xf2ebe0)
  );
  upper.position.y = 1.55;
  upper.castShadow = true;
  addOutline(upper, 0.016, INK_COLOR, 0.05);
  g.add(upper);
  const upperRoof = new THREE.Mesh(
    facet(new THREE.ConeGeometry(0.95, 0.45, 4)),
    toonMat(0xc9a227, { emissive: 0x8a7010, emissiveIntensity: 0.22 })
  );
  upperRoof.rotation.y = Math.PI / 4;
  upperRoof.position.y = 2.0;
  upperRoof.castShadow = true;
  addOutline(upperRoof, 0.016, INK_COLOR, 0.05);
  g.add(upperRoof);

  g.scale.setScalar(1.15);
  g.userData.collideRadius = 1.2;
  g.userData.kind = "goldenPavilion";
  return g;
}

/**
 * 赤道「湘南亭」：克制小巧 Low-Poly 茅草屋
 */
function createShonanTei() {
  const g = new THREE.Group();
  // 矮墙 · 宣纸白
  const body = new THREE.Mesh(
    facet(new THREE.BoxGeometry(1.1, 0.55, 0.95)),
    toonMat(0xf0e8dc)
  );
  body.position.y = 0.28;
  body.castShadow = true;
  addOutline(body, 0.014, INK_COLOR, 0.05);
  g.add(body);
  // 茅草顶 · 枯黄扁锥
  const thatch = new THREE.Mesh(
    facet(new THREE.ConeGeometry(0.95, 0.55, 5)),
    toonMat(0x8a7a4a)
  );
  thatch.position.y = 0.85;
  thatch.castShadow = true;
  addOutline(thatch, 0.014, INK_COLOR, 0.06);
  g.add(thatch);
  // 门洞暗示
  const door = new THREE.Mesh(
    facet(new THREE.BoxGeometry(0.28, 0.4, 0.05)),
    toonMat(0x3a322c)
  );
  door.position.set(0, 0.22, 0.48);
  g.add(door);

  g.scale.setScalar(0.95);
  g.userData.collideRadius = 0.7;
  g.userData.kind = "shonanTei";
  return g;
}

/**
 * 洪隐山焦墨乱石（flat 硬边 + 重墨线）
 * @param {number} heightWorld 目标世界高度（玩家 1~2 倍）
 */
function createKaresansuiRock(heightWorld, color = KARE_ROCK) {
  // 直接建乱石（避免 createLowPolyRock 二次描边开销）
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const cache = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!cache.has(key)) cache.set(key, 0.72 + Math.random() * 0.56);
    v.multiplyScalar(cache.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const rock = new THREE.Mesh(facet(geo), toonMat(color));
  rock.scale.set(1, 0.75, 0.92);
  rock.position.y = 0.32;
  rock.castShadow = true;
  rock.receiveShadow = true;
  addOutline(rock, HEAVY_INK, 0x111111, 0.04);
  g.add(rock);
  // 基准高度约 0.9 → 缩放到玩家 1~2 倍
  const s = heightWorld / 0.9;
  g.scale.set(s * 0.95, s, s * 0.9);
  g.userData.collideRadius = 0.45 * s;
  g.userData.kind = "karesansuiRock";
  return g;
}

// 苔藓共享几何/材质（密铺时避免每块岩+描边拖垮帧）
let _mossGeo = null;
const _mossMats = new Map();
function mossGeo() {
  if (!_mossGeo) {
    // 低分段扁圆盘感：压扁的八面体
    _mossGeo = facet(new THREE.IcosahedronGeometry(0.55, 0));
  }
  return _mossGeo;
}
function mossMat(color) {
  let m = _mossMats.get(color);
  if (!m) {
    m = toonMat(color);
    _mossMats.set(color, m);
  }
  return m;
}

/**
 * 苔藓毯：极扁墨绿斑块（共享几何，无描边，可踩）
 * 规格要求「createLowPolyRock 压扁」的视觉等价：不规则低多边 + 厚度 0.1
 */
function createMossPatch(color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(mossGeo(), mossMat(color));
  m.scale.set(1, 0.18, 1); // 局部先扁
  m.position.y = 0.04;
  m.castShadow = false;
  m.receiveShadow = true;
  g.add(m);
  // 世界厚度 ~0.1：水平 2~4，纵 0.1
  const hx = 2.2 + Math.random() * 1.6;
  const hz = 2.2 + Math.random() * 1.6;
  g.scale.set(hx, 0.1 / 0.18, hz);
  g.userData.collideRadius = 0;
  g.userData.kind = "moss";
  return g;
}

/**
 * 黄金池：扁平镜面淡蓝多边形（贴北半球球面）
 */
function createGoldenPond(radius = 4.2) {
  const g = new THREE.Group();
  // 不规则多边形（7 边）
  const shape = new THREE.Shape();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = radius * (0.82 + (i % 3) * 0.06);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const water = new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 12),
    new THREE.MeshBasicMaterial({
      color: 0x8ec8e0,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  g.add(water);
  // 池缘一圈浅墨砂
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.95, radius * 1.12, 28),
    toonMat(0xb8a888, { side: THREE.DoubleSide })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = -0.02;
  g.add(rim);

  g.userData.collideRadius = 0;
  g.userData.kind = "goldenPond";
  g.userData.pondRadius = radius;
  return g;
}

/** 青石阶：扁平灰色短圆柱 */
function createStoneStep() {
  const m = new THREE.Mesh(
    facet(new THREE.CylinderGeometry(0.42, 0.48, 0.1, 6)),
    toonMat(0x8a8a8a)
  );
  m.castShadow = true;
  m.receiveShadow = true;
  addOutline(m, 0.01, INK_COLOR, 0.04);
  const g = new THREE.Group();
  m.position.y = 0.05;
  g.add(m);
  g.userData.collideRadius = 0; // 可走
  g.userData.kind = "stoneStep";
  return g;
}

// ---------- 主构建 ----------

/**
 * 在半径 40 的微型星球上部署西芳寺（苔寺）景观。
 *
 * @param {THREE.Scene} scene
 * @param {object} [opts]
 * @param {number} [opts.radius=40]
 * @param {THREE.Mesh} [opts.planet] 已创建的星球网格（用于南/北半球换色）
 * @param {number} [opts.seed=884]
 * @param {number} [opts.mossCount=220] 北半球苔藓块数
 * @param {number} [opts.rockCount=20] 南半球乱石数（含 3 尊坐禅石）
 * @returns {{
 *   group: THREE.Group,
 *   colliders: {position:THREE.Vector3,radius:number}[],
 *   landmarks: object,
 *   placed: THREE.Vector3[],
 * }}
 */
export function buildSaihojiPlanet(scene, opts = {}) {
  const radius = opts.radius ?? PLANET_RADIUS;
  const rnd = lcg(opts.seed ?? 884);
  const mossCount = opts.mossCount ?? 220;
  const rockCount = opts.rockCount ?? 20;

  const root = new THREE.Group();
  root.name = "SaihojiPlanet";
  const colliders = [];
  /** @type {THREE.Vector3[]} 结构物中心（minDistance=5） */
  const structurePts = [];
  /** @type {THREE.Vector3[]} 苔藓中心（更密） */
  const mossPts = [];

  const landmarks = {
    goldenPavilion: null,
    goldenPond: null,
    shonanTei: null,
    threeStones: [],
    pondPhi: 0.28,
    pondTheta: 0.35,
    threePhi: (2 * Math.PI) / 3, // ~120° 南半球
    threeTheta: Math.PI * 0.85,
  };

  // =================================================================
  //  0. 星球双半球着色：北沉绿苔地 / 南枯山水砂灰 #D9D9D9
  // =================================================================
  if (opts.planet && opts.planet.isMesh) {
    paintPlanetHemispheres(opts.planet);
  }

  // =================================================================
  //  1. 北半球 · 黄金池（随机方位，纬度偏高）
  // =================================================================
  {
    // Phi ∈ (0.18, 0.45) 避免压北极阁，又在北半球
    landmarks.pondPhi = 0.2 + rnd() * 0.22;
    landmarks.pondTheta = rnd() * Math.PI * 2;
    const pond = createGoldenPond(3.8 + rnd() * 0.8);
    placeByPhiTheta(pond, landmarks.pondPhi, landmarks.pondTheta, radius, 0.06);
    pond.rotateY(rnd() * Math.PI * 2);
    root.add(pond);
    landmarks.goldenPond = pond;
    // 池心占位（结构间距）
    structurePts.push(pond.position.clone());
  }

  // =================================================================
  //  1b. 北极点 · 黄金阁（Phi=0）
  // =================================================================
  {
    const pavilion = createGoldenPavilion();
    placeByPhiTheta(pavilion, 0, 0, radius, 0);
    pavilion.rotateY(rnd() * Math.PI * 2);
    root.add(pavilion);
    landmarks.goldenPavilion = pavilion;
    structurePts.push(pavilion.position.clone());
    pushCollider(colliders, pavilion, 1.35);
  }

  // =================================================================
  //  1c. 北半球 · 苔藓地毯（极扁墨绿岩）
  // =================================================================
  {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = mossCount * 40;
    while (placed < mossCount && attempts < maxAttempts) {
      attempts++;
      // Phi ∈ (0.08, π/2 - 0.05)，避开极点建筑与赤道茶室
      const phi = 0.08 + rnd() * (Math.PI / 2 - 0.14);
      const theta = rnd() * Math.PI * 2;
      phiThetaToDir(phi, theta, _dir);
      const pos = _dir.clone().multiplyScalar(radius);
      // 避开黄金池水面
      if (pos.distanceTo(landmarks.goldenPond.position) < 5.5) continue;
      if (!farEnough(pos, structurePts, SAIHOJI_MIN_DISTANCE * 0.55)) continue;
      if (!farEnough(pos, mossPts, MOSS_MIN_DISTANCE)) continue;

      const col = MOSS_COLORS[(rnd() * MOSS_COLORS.length) | 0];
      const moss = createMossPatch(col);
      placeByPhiTheta(moss, phi, theta, radius, 0.02);
      moss.rotateY(rnd() * Math.PI * 2);
      root.add(moss);
      mossPts.push(pos);
      placed++;
    }
  }

  // =================================================================
  //  2. 南半球 · 三尊石组（坐禅石）+ 洪隐山乱石
  // =================================================================
  {
    landmarks.threePhi = Math.PI / 2 + 0.35 + rnd() * 0.55; // 赤道以南
    landmarks.threeTheta = rnd() * Math.PI * 2;

    // 三尊：3 块特别巨大、靠在一起（玩家 1.8~2.2 倍高）
    const clusterOffsets = [
      { dPhi: 0, dTh: 0, h: PLAYER_H * 2.15 },
      { dPhi: 0.055, dTh: 0.07, h: PLAYER_H * 1.95 },
      { dPhi: 0.02, dTh: -0.08, h: PLAYER_H * 1.85 },
    ];
    for (const off of clusterOffsets) {
      const phi = landmarks.threePhi + off.dPhi;
      const theta = landmarks.threeTheta + off.dTh;
      const rock = createKaresansuiRock(off.h);
      placeByPhiTheta(rock, phi, theta, radius, 0);
      rock.rotateY(rnd() * Math.PI * 2);
      root.add(rock);
      landmarks.threeStones.push(rock);
      structurePts.push(rock.position.clone());
      pushCollider(colliders, rock);
    }

    // 其余乱石：共 rockCount，已放 3 尊 → 再种 17
    const rest = Math.max(0, rockCount - 3);
    let placed = 0;
    let attempts = 0;
    while (placed < rest && attempts < rest * 60) {
      attempts++;
      const phi = Math.PI / 2 + 0.12 + rnd() * (Math.PI / 2 - 0.2); // 南半球
      const theta = rnd() * Math.PI * 2;
      phiThetaToDir(phi, theta, _dir);
      const pos = _dir.clone().multiplyScalar(radius);
      if (!farEnough(pos, structurePts, SAIHOJI_MIN_DISTANCE)) continue;

      const h = PLAYER_H * (1.0 + rnd() * 1.0); // 1~2× 玩家
      const rock = createKaresansuiRock(h);
      placeByPhiTheta(rock, phi, theta, radius, 0);
      rock.rotateY(rnd() * Math.PI * 2);
      root.add(rock);
      structurePts.push(pos);
      pushCollider(colliders, rock);
      placed++;
    }
  }

  // =================================================================
  //  3. 赤道 · 湘南亭茶室（枯实 / 绿苔视觉分界）
  // =================================================================
  {
    // 放在参道螺旋中段附近的赤道点
    const midTheta =
      landmarks.pondTheta +
      0.5 * shortestAngle(landmarks.pondTheta, landmarks.threeTheta) +
      Math.PI * 0.15;
    const tei = createShonanTei();
    // 略偏北/南尝试找到空位
    let ok = false;
    for (let k = 0; k < 24 && !ok; k++) {
      const phi = Math.PI / 2 + (rnd() - 0.5) * 0.08;
      const theta = midTheta + (rnd() - 0.5) * 0.6;
      phiThetaToDir(phi, theta, _dir);
      const pos = _dir.clone().multiplyScalar(radius);
      if (!farEnough(pos, structurePts, SAIHOJI_MIN_DISTANCE)) continue;
      placeByPhiTheta(tei, phi, theta, radius, 0);
      tei.rotateY(rnd() * Math.PI * 2);
      root.add(tei);
      structurePts.push(pos);
      pushCollider(colliders, tei, 0.85);
      landmarks.shonanTei = tei;
      ok = true;
    }
    if (!ok) {
      // 兜底：赤道固定方位
      placeByPhiTheta(tei, Math.PI / 2, midTheta, radius, 0);
      root.add(tei);
      landmarks.shonanTei = tei;
      structurePts.push(tei.position.clone());
      pushCollider(colliders, tei, 0.85);
    }
  }

  // =================================================================
  //  3b. 朝圣石阶 · 螺旋参道
  //      黄金池 → 盘旋跨赤道 → 南半球三尊石组（指东庵）
  //      φ(t) = lerp(φ0, φ1, t)
  //      θ(t) = θ0 + Δθ·t + 2π·turns·t   （阿基米德式球面螺旋）
  // =================================================================
  {
    const steps = 48;
    const turns = 1.15; // 盘旋约一圈多
    const phi0 = landmarks.pondPhi + 0.06;
    const phi1 = landmarks.threePhi - 0.04;
    const theta0 = landmarks.pondTheta + 0.25;
    const dTheta = shortestAngle(theta0, landmarks.threeTheta);

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      // 平滑起步：靠近池与石组时略加密感（位置仍均匀 t）
      const phi = phi0 + (phi1 - phi0) * t;
      const theta = theta0 + dTheta * t + turns * Math.PI * 2 * t;
      const step = createStoneStep();
      placeByPhiTheta(step, phi, theta, radius, 0.04);
      // 朝向路径切线：粗略用下一步方位
      step.rotateY(theta + Math.PI / 2);
      root.add(step);
    }
  }

  scene.add(root);

  return {
    group: root,
    colliders,
    landmarks,
    placed: structurePts,
    mossCount: mossPts.length,
  };
}

/** 最短有符号角差 θ1-θ0 ∈ (-π, π] */
function shortestAngle(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * 星球顶点色：y≥0 沉绿苔地，y<0 枯山水砂灰 #D9D9D9
 * 赤道带做窄过渡，避免硬切。
 */
export function paintPlanetHemispheres(planetMesh) {
  const geo = planetMesh.geometry;
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const north = new THREE.Color(0x3f7a58); // 与既有沉绿呼应
  const south = new THREE.Color(SAND_COLOR);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const r = Math.hypot(pos.getX(i), y, pos.getZ(i)) || 1;
    const ny = y / r; // [-1,1]
    // 赤道过渡带 |ny| < 0.06
    let t = 0.5 - ny * 0.5; // 0 北 → 1 南
    if (ny > 0.06) t = 0;
    else if (ny < -0.06) t = 1;
    else t = (0.06 - ny) / 0.12;
    c.copy(north).lerp(south, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // MeshToonMaterial 支持 vertexColors
  if (planetMesh.material) {
    planetMesh.material = toonMat(0xffffff);
    planetMesh.material.vertexColors = true;
    planetMesh.material.needsUpdate = true;
  }
}
